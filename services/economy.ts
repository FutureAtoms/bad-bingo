import { supabase } from './supabase';
import type { DBUser, DBTransaction, DBDebt } from '../types/database';

// Calculate stake based on wallet (wallet/50, min 2)
export const calculateStake = (walletBalance: number): number => {
  return Math.max(2, Math.floor(walletBalance / 50));
};

// Calculate steal percentage based on user stats (deterministic, server-validated)
// Returns 1-50% based on thief's trust score, steal success history, and timing
export const calculateStealPercentage = (
  thiefTrustScore: number = 100,
  thiefStealsSuccessful: number = 0,
  thiefStealsDefended: number = 0
): number => {
  // Base percentage starts at 10%
  let percentage = 10;

  // Higher trust score = higher potential steal (up to +20%)
  percentage += Math.floor(thiefTrustScore / 5);

  // Successful steals increase potential (up to +10%)
  percentage += Math.min(10, thiefStealsSuccessful * 2);

  // Getting caught reduces potential (down to -15%)
  percentage -= Math.min(15, thiefStealsDefended * 3);

  // Add time-based variation (hour of day affects steal percentage)
  // This creates predictable variation without using random
  const hourOfDay = new Date().getHours();
  const timeBonus = Math.abs(12 - hourOfDay); // Peak at midnight/noon, lowest at 6am/6pm
  percentage += Math.floor(timeBonus / 2);

  // Clamp between 1 and 50
  return Math.max(1, Math.min(50, percentage));
};

// Log a transaction to the database
export const logTransaction = async (
  userId: string,
  amount: number,
  balanceAfter: number,
  type: string,
  description: string,
  referenceType?: string,
  referenceId?: string
): Promise<{ success: boolean; error: string | null }> => {
  const { error } = await supabase
    .from('bb_transactions')
    .insert({
      user_id: userId,
      amount,
      balance_after: balanceAfter,
      type,
      description,
      reference_type: referenceType || null,
      reference_id: referenceId || null,
    });

  return { success: !error, error: error?.message || null };
};

// Check if user can claim allowance (48 hours since last claim)
export const canClaimAllowance = async (userId: string): Promise<boolean> => {
  const { data: user } = await supabase
    .from('bb_users')
    .select('last_allowance_claimed')
    .eq('id', userId)
    .single();

  if (!user || !user.last_allowance_claimed) {
    return true;
  }

  const lastClaim = new Date(user.last_allowance_claimed);
  const hoursSinceClaim = (Date.now() - lastClaim.getTime()) / (1000 * 60 * 60);

  return hoursSinceClaim >= 48;
};

// Get time until next allowance (in hours)
export const getTimeUntilAllowance = async (userId: string): Promise<number> => {
  const { data: user } = await supabase
    .from('bb_users')
    .select('last_allowance_claimed')
    .eq('id', userId)
    .single();

  if (!user || !user.last_allowance_claimed) {
    return 0;
  }

  const lastClaim = new Date(user.last_allowance_claimed);
  const hoursSinceClaim = (Date.now() - lastClaim.getTime()) / (1000 * 60 * 60);

  return Math.max(0, 48 - hoursSinceClaim);
};

// Claim daily allowance
export const claimAllowance = async (userId: string): Promise<{
  success: boolean;
  newBalance: number;
  error: string | null
}> => {
  const canClaim = await canClaimAllowance(userId);

  if (!canClaim) {
    return { success: false, newBalance: 0, error: 'Cannot claim yet. Wait 48 hours between claims.' };
  }

  const ALLOWANCE_AMOUNT = 100;

  // Get current balance
  const { data: user } = await supabase
    .from('bb_users')
    .select('coins')
    .eq('id', userId)
    .single();

  if (!user) {
    return { success: false, newBalance: 0, error: 'User not found' };
  }

  const newBalance = user.coins + ALLOWANCE_AMOUNT;

  // Update user
  const { error: updateError } = await supabase
    .from('bb_users')
    .update({
      coins: newBalance,
      last_allowance_claimed: new Date().toISOString(),
    })
    .eq('id', userId);

  if (updateError) {
    return { success: false, newBalance: 0, error: updateError.message };
  }

  // Log transaction
  await supabase.from('bb_transactions').insert({
    user_id: userId,
    amount: ALLOWANCE_AMOUNT,
    balance_after: newBalance,
    type: 'allowance',
    description: 'Feeding time! 100 bingos dropped in your bowl.',
  });

  return { success: true, newBalance, error: null };
};

// Lock stake from user wallet (basic version - use lockStakeForSwipe for full tracking)
export const lockStake = async (userId: string, stakeAmount: number): Promise<{
  success: boolean;
  newBalance: number;
  error: string | null;
}> => {
  // Get current balance
  const { data: user } = await supabase
    .from('bb_users')
    .select('coins')
    .eq('id', userId)
    .single();

  if (!user) {
    return { success: false, newBalance: 0, error: 'User not found' };
  }

  if (user.coins < stakeAmount) {
    return { success: false, newBalance: user.coins, error: 'Not enough bingos! You broke?' };
  }

  const newBalance = user.coins - stakeAmount;

  // Update user
  const { error: updateError } = await supabase
    .from('bb_users')
    .update({ coins: newBalance })
    .eq('id', userId);

  if (updateError) {
    return { success: false, newBalance: user.coins, error: updateError.message };
  }

  // Log transaction
  await supabase.from('bb_transactions').insert({
    user_id: userId,
    amount: -stakeAmount,
    balance_after: newBalance,
    type: 'clash_stake_lock',
    description: 'Bingos locked for clash. No takebacks.',
  });

  return { success: true, newBalance, error: null };
};

// Lock stake from user when they swipe (deduct from balance and track in participant)
export const lockStakeForSwipe = async (
  userId: string,
  betId: string,
  stakeAmount: number
): Promise<{ success: boolean; newBalance: number; error: string | null }> => {
  // Get current balance
  const { data: user } = await supabase
    .from('bb_users')
    .select('coins')
    .eq('id', userId)
    .single();

  if (!user) {
    return { success: false, newBalance: 0, error: 'User not found' };
  }

  if (user.coins < stakeAmount) {
    return { success: false, newBalance: user.coins, error: 'Not enough bingos! You broke?' };
  }

  const newBalance = user.coins - stakeAmount;

  // Update user balance
  const { error: updateError } = await supabase
    .from('bb_users')
    .update({ coins: newBalance })
    .eq('id', userId);

  if (updateError) {
    return { success: false, newBalance: user.coins, error: updateError.message };
  }

  // Get participant record ID for reference
  const { data: participant } = await supabase
    .from('bb_bet_participants')
    .select('id')
    .eq('bet_id', betId)
    .eq('user_id', userId)
    .single();

  // Log transaction with bet reference
  await supabase.from('bb_transactions').insert({
    user_id: userId,
    amount: -stakeAmount,
    balance_after: newBalance,
    type: 'clash_stake_lock',
    reference_type: 'bet_participant',
    reference_id: participant?.id || betId,
    description: 'Bingos locked for bet. No takebacks.',
  });

  return { success: true, newBalance, error: null };
};

// Return stake if bet expires without clash
export const returnExpiredStake = async (
  userId: string,
  betId: string,
  stakeAmount: number
): Promise<{ success: boolean; newBalance: number; error: string | null }> => {
  // Get current balance
  const { data: user } = await supabase
    .from('bb_users')
    .select('coins')
    .eq('id', userId)
    .single();

  if (!user) {
    return { success: false, newBalance: 0, error: 'User not found' };
  }

  const newBalance = user.coins + stakeAmount;

  // Update user balance
  const { error: updateError } = await supabase
    .from('bb_users')
    .update({ coins: newBalance })
    .eq('id', userId);

  if (updateError) {
    return { success: false, newBalance: user.coins, error: updateError.message };
  }

  // Update participant record to mark stake as unlocked
  await supabase
    .from('bb_bet_participants')
    .update({ stake_locked: false })
    .eq('bet_id', betId)
    .eq('user_id', userId);

  // Get participant record ID for reference
  const { data: participant } = await supabase
    .from('bb_bet_participants')
    .select('id')
    .eq('bet_id', betId)
    .eq('user_id', userId)
    .single();

  // Log refund transaction
  await supabase.from('bb_transactions').insert({
    user_id: userId,
    amount: stakeAmount,
    balance_after: newBalance,
    type: 'clash_stake_lock', // Using same type with positive amount indicates refund
    reference_type: 'bet_participant',
    reference_id: participant?.id || betId,
    description: 'Stake returned - bet expired without clash. Lucky you.',
  });

  return { success: true, newBalance, error: null };
};

// Refund stakes to all participants when bet expires
export const refundExpiredBetStakes = async (
  betId: string
): Promise<{ refundedCount: number; errors: string[] }> => {
  // Get all participants who locked stakes for this bet
  const { data: participants, error: fetchError } = await supabase
    .from('bb_bet_participants')
    .select('user_id, stake_amount, stake_locked')
    .eq('bet_id', betId)
    .eq('stake_locked', true);

  if (fetchError) {
    return { refundedCount: 0, errors: [fetchError.message] };
  }

  const errors: string[] = [];
  let refundedCount = 0;

  for (const participant of participants || []) {
    const result = await returnExpiredStake(
      participant.user_id,
      betId,
      participant.stake_amount
    );

    if (result.success) {
      refundedCount++;
    } else if (result.error) {
      errors.push(`User ${participant.user_id}: ${result.error}`);
    }
  }

  return { refundedCount, errors };
};

// Award clash winnings
export const awardClashWin = async (
  winnerId: string,
  loserId: string,
  clashId: string,
  totalPot: number
): Promise<{ success: boolean; error: string | null }> => {
  // Get winner's current balance and stats
  const { data: winner } = await supabase
    .from('bb_users')
    .select('coins, total_wins, win_streak, best_win_streak, total_earnings')
    .eq('id', winnerId)
    .single();

  if (!winner) {
    return { success: false, error: 'Winner not found' };
  }

  // Get loser's current balance for transaction record
  const { data: loser } = await supabase
    .from('bb_users')
    .select('coins, total_losses, total_clashes')
    .eq('id', loserId)
    .single();

  if (!loser) {
    return { success: false, error: 'Loser not found' };
  }

  const newWinStreak = winner.win_streak + 1;
  const newWinnerBalance = winner.coins + totalPot;

  // Update winner
  const { error: winnerError } = await supabase
    .from('bb_users')
    .update({
      coins: newWinnerBalance,
      total_wins: winner.total_wins + 1,
      win_streak: newWinStreak,
      best_win_streak: Math.max(winner.best_win_streak, newWinStreak),
      total_earnings: winner.total_earnings + totalPot,
      total_clashes: (winner as { total_clashes?: number }).total_clashes ? (winner as { total_clashes?: number }).total_clashes! + 1 : 1,
    })
    .eq('id', winnerId);

  if (winnerError) {
    return { success: false, error: winnerError.message };
  }

  // Update loser (stake was already deducted when they swiped)
  const { error: loserError } = await supabase
    .from('bb_users')
    .update({
      win_streak: 0,
      total_losses: loser.total_losses + 1,
      total_clashes: loser.total_clashes + 1,
    })
    .eq('id', loserId);

  if (loserError) {
    return { success: false, error: loserError.message };
  }

  // Log winner transaction
  await supabase.from('bb_transactions').insert({
    user_id: winnerId,
    amount: totalPot,
    balance_after: newWinnerBalance,
    type: 'clash_win',
    reference_type: 'clash',
    reference_id: clashId,
    description: 'Landed on your paws! Bingos secured.',
  });

  // Log loser transaction (amount is 0 because stake was already locked/deducted)
  await supabase.from('bb_transactions').insert({
    user_id: loserId,
    amount: 0, // Already deducted when stake was locked
    balance_after: loser.coins, // Balance unchanged - stake was already taken
    type: 'clash_loss',
    reference_type: 'clash',
    reference_id: clashId,
    description: 'Ate dirt on this one. Your bingos went to the winner.',
  });

  // Update clash
  await supabase
    .from('bb_clashes')
    .update({
      status: 'completed',
      winner_id: winnerId,
      loser_id: loserId,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', clashId);

  return { success: true, error: null };
};

// Get user's transaction history
export const getTransactionHistory = async (
  userId: string,
  limit: number = 50
): Promise<{ transactions: DBTransaction[]; error: string | null }> => {
  const { data, error } = await supabase
    .from('bb_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return { transactions: data || [], error: error?.message || null };
};

// Borrow bingos (creates debt)
export const borrowCoins = async (
  borrowerId: string,
  amount: number
): Promise<{ success: boolean; debt: DBDebt | null; error: string | null }> => {
  // Get current balance
  const { data: user } = await supabase
    .from('bb_users')
    .select('coins')
    .eq('id', borrowerId)
    .single();

  if (!user) {
    return { success: false, debt: null, error: 'User not found' };
  }

  const newBalance = user.coins + amount;

  // Create debt record
  const { data: debt, error: debtError } = await supabase
    .from('bb_debts')
    .insert({
      borrower_id: borrowerId,
      principal: amount,
      interest_rate: 0.10, // 10% daily
      due_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
    })
    .select()
    .single();

  if (debtError) {
    return { success: false, debt: null, error: debtError.message };
  }

  // Update user balance
  await supabase
    .from('bb_users')
    .update({ coins: newBalance })
    .eq('id', borrowerId);

  // Update social_debt atomically using RPC
  const { error: rpcError } = await supabase.rpc('bb_increment_social_debt', {
    user_uuid: borrowerId,
    amount: amount
  });

  if (rpcError) {
    // Fallback: fetch and update manually if RPC doesn't exist yet
    const { data: currentUser } = await supabase
      .from('bb_users')
      .select('social_debt')
      .eq('id', borrowerId)
      .single();

    if (currentUser) {
      await supabase
        .from('bb_users')
        .update({
          social_debt: (currentUser.social_debt || 0) + amount,
        })
        .eq('id', borrowerId);
    }
  }

  // Log transaction
  await supabase.from('bb_transactions').insert({
    user_id: borrowerId,
    amount: amount,
    balance_after: newBalance,
    type: 'borrow',
    reference_type: 'debt',
    reference_id: debt.id,
    description: `Borrowed ${amount} bingos. Debt is just future you's problem.`,
  });

  return { success: true, debt, error: null };
};

// Repay debt
export const repayDebt = async (
  userId: string,
  debtId: string,
  amount: number
): Promise<{ success: boolean; remainingDebt: number; error: string | null }> => {
  // Get user and debt
  const [{ data: user }, { data: debt }] = await Promise.all([
    supabase.from('bb_users').select('coins').eq('id', userId).single(),
    supabase.from('bb_debts').select('*').eq('id', debtId).single(),
  ]);

  if (!user || !debt) {
    return { success: false, remainingDebt: 0, error: 'User or debt not found' };
  }

  if (user.coins < amount) {
    return { success: false, remainingDebt: 0, error: 'Not enough bingos to repay' };
  }

  const totalOwed = debt.principal + debt.accrued_interest - debt.amount_repaid;
  const actualRepayment = Math.min(amount, totalOwed);
  const newAmountRepaid = debt.amount_repaid + actualRepayment;
  const remainingDebt = totalOwed - actualRepayment;

  // Update debt
  await supabase
    .from('bb_debts')
    .update({
      amount_repaid: newAmountRepaid,
      status: remainingDebt <= 0 ? 'repaid' : 'active',
    })
    .eq('id', debtId);

  // Update user balance
  const newBalance = user.coins - actualRepayment;
  await supabase
    .from('bb_users')
    .update({ coins: newBalance })
    .eq('id', userId);

  // Update social_debt atomically using RPC
  const { error: rpcError } = await supabase.rpc('bb_decrement_social_debt', {
    user_uuid: userId,
    amount: actualRepayment
  });

  if (rpcError) {
    // Fallback: fetch and update manually if RPC doesn't exist yet
    const { data: currentUser } = await supabase
      .from('bb_users')
      .select('social_debt')
      .eq('id', userId)
      .single();

    if (currentUser) {
      await supabase
        .from('bb_users')
        .update({
          social_debt: Math.max(0, (currentUser.social_debt || 0) - actualRepayment),
        })
        .eq('id', userId);
    }
  }

  // Log transaction
  await supabase.from('bb_transactions').insert({
    user_id: userId,
    amount: -actualRepayment,
    balance_after: newBalance,
    type: 'repay',
    reference_type: 'debt',
    reference_id: debtId,
    description: `Repaid ${actualRepayment} bingos. ${remainingDebt > 0 ? `Still owe ${remainingDebt}.` : 'Debt cleared!'}`,
  });

  return { success: true, remainingDebt, error: null };
};

// Get user's active debts
export const getActiveDebts = async (userId: string): Promise<{ debts: DBDebt[]; error: string | null }> => {
  const { data, error } = await supabase
    .from('bb_debts')
    .select('*')
    .eq('borrower_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  return { debts: data || [], error: error?.message || null };
};

// Accrue interest on a single debt (daily 10%)
export const accrueInterestOnDebt = async (debtId: string): Promise<{
  success: boolean;
  newInterest: number;
  error: string | null;
}> => {
  const { data: debt, error: fetchError } = await supabase
    .from('bb_debts')
    .select('*')
    .eq('id', debtId)
    .eq('status', 'active')
    .single();

  if (fetchError || !debt) {
    return { success: false, newInterest: 0, error: fetchError?.message || 'Debt not found' };
  }

  // Check if interest was already accrued today
  const lastAccrual = debt.last_interest_accrual ? new Date(debt.last_interest_accrual) : new Date(debt.created_at);
  const hoursSinceAccrual = (Date.now() - lastAccrual.getTime()) / (1000 * 60 * 60);

  if (hoursSinceAccrual < 24) {
    return { success: false, newInterest: 0, error: 'Interest already accrued within 24 hours' };
  }

  // Calculate interest (10% daily on principal + accrued interest)
  const totalOwed = debt.principal + debt.accrued_interest - debt.amount_repaid;
  const dailyInterest = Math.ceil(totalOwed * debt.interest_rate);
  const newAccruedInterest = debt.accrued_interest + dailyInterest;

  // Update debt
  const { error: updateError } = await supabase
    .from('bb_debts')
    .update({
      accrued_interest: newAccruedInterest,
      last_interest_accrual: new Date().toISOString(),
    })
    .eq('id', debtId);

  if (updateError) {
    return { success: false, newInterest: 0, error: updateError.message };
  }

  // Check if debt is due and trigger repo if overdue
  const dueDate = new Date(debt.due_at);
  if (Date.now() > dueDate.getTime() && !debt.repo_triggered) {
    // Trigger repo - reduce user's trust score and mark debt
    await supabase
      .from('bb_debts')
      .update({ repo_triggered: true })
      .eq('id', debtId);

    // Decrement trust score atomically using RPC
    const { error: rpcError } = await supabase.rpc('bb_decrement_trust_score', {
      user_uuid: debt.borrower_id,
      amount: 10
    });

    if (rpcError) {
      // Fallback: fetch and update manually if RPC doesn't exist yet
      const { data: borrower } = await supabase
        .from('bb_users')
        .select('trust_score')
        .eq('id', debt.borrower_id)
        .single();

      if (borrower) {
        await supabase
          .from('bb_users')
          .update({
            trust_score: Math.max(0, (borrower.trust_score || 100) - 10),
          })
          .eq('id', debt.borrower_id);
      }
    }

    // Create notification
    await supabase.from('bb_notifications').insert({
      user_id: debt.borrower_id,
      type: 'system',
      title: 'Debt Overdue!',
      message: `Your debt is overdue! Pay up or face the consequences. Interest keeps piling up.`,
      priority: 'critical',
      reference_type: 'debt',
      reference_id: debtId,
    });
  }

  return { success: true, newInterest: dailyInterest, error: null };
};

// Accrue interest on all active debts (batch operation for cron/scheduler)
export const accrueAllInterest = async (): Promise<{
  processed: number;
  errors: string[];
}> => {
  const { data: debts, error } = await supabase
    .from('bb_debts')
    .select('id')
    .eq('status', 'active');

  if (error || !debts) {
    return { processed: 0, errors: [error?.message || 'Failed to fetch debts'] };
  }

  const errors: string[] = [];
  let processed = 0;

  for (const debt of debts) {
    const result = await accrueInterestOnDebt(debt.id);
    if (result.success) {
      processed++;
    } else if (result.error && !result.error.includes('already accrued')) {
      errors.push(`Debt ${debt.id}: ${result.error}`);
    }
  }

  return { processed, errors };
};

// Get total debt amount for a user
export const getTotalDebt = async (userId: string): Promise<{
  principal: number;
  interest: number;
  total: number;
  error: string | null;
}> => {
  const { data: debts, error } = await supabase
    .from('bb_debts')
    .select('principal, accrued_interest, amount_repaid')
    .eq('borrower_id', userId)
    .eq('status', 'active');

  if (error) {
    return { principal: 0, interest: 0, total: 0, error: error.message };
  }

  let principal = 0;
  let interest = 0;

  for (const debt of debts || []) {
    const remainingPrincipal = Math.max(0, debt.principal - debt.amount_repaid);
    principal += remainingPrincipal;
    interest += debt.accrued_interest;
  }

  return { principal, interest, total: principal + interest, error: null };
};

// Check if user can borrow (max debt limit)
export const canBorrow = async (userId: string, amount: number): Promise<{
  allowed: boolean;
  maxBorrowable: number;
  reason: string | null;
}> => {
  const MAX_DEBT_RATIO = 2; // Max debt = 2x current balance

  // Get user balance
  const { data: user } = await supabase
    .from('bb_users')
    .select('coins, trust_score')
    .eq('id', userId)
    .single();

  if (!user) {
    return { allowed: false, maxBorrowable: 0, reason: 'User not found' };
  }

  // Check trust score
  if (user.trust_score < 30) {
    return { allowed: false, maxBorrowable: 0, reason: 'Trust score too low. Pay your debts first.' };
  }

  // Get current debt
  const { total: currentDebt } = await getTotalDebt(userId);

  // Calculate max borrowable
  const maxDebt = user.coins * MAX_DEBT_RATIO;
  const maxBorrowable = Math.max(0, maxDebt - currentDebt);

  if (amount > maxBorrowable) {
    return {
      allowed: false,
      maxBorrowable,
      reason: `Can only borrow ${maxBorrowable} more. Clear some debt first.`,
    };
  }

  return { allowed: true, maxBorrowable, reason: null };
};
