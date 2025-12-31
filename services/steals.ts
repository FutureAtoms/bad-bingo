import { supabase } from './supabase';
import type { DBSteal, DBUser } from '../types/database';
import { calculateStealPercentage } from './economy';

// Initiate a steal attempt
export const initiateSteal = async (
  thiefId: string,
  targetId: string
): Promise<{
  steal: DBSteal | null;
  potentialAmount: number;
  error: string | null;
}> => {
  // Get both thief and target data for deterministic steal calculation
  const [{ data: thief }, { data: target }] = await Promise.all([
    supabase
      .from('bb_users')
      .select('trust_score, steals_successful, steals_defended')
      .eq('id', thiefId)
      .single(),
    supabase
      .from('bb_users')
      .select('coins, last_login')
      .eq('id', targetId)
      .single(),
  ]);

  if (!thief) {
    return { steal: null, potentialAmount: 0, error: 'Thief not found' };
  }

  if (!target) {
    return { steal: null, potentialAmount: 0, error: 'Target not found' };
  }

  if (target.coins < 10) {
    return { steal: null, potentialAmount: 0, error: 'Target is too broke to rob. Even thieves have standards.' };
  }

  // Calculate steal percentage using thief's stats (deterministic, no Math.random())
  const stealPercentage = calculateStealPercentage(
    thief.trust_score || 100,
    thief.steals_successful || 0,
    thief.steals_defended || 0
  );
  const potentialAmount = Math.floor(target.coins * (stealPercentage / 100));

  // Check if target is online (last activity within 5 minutes)
  const lastLogin = new Date(target.last_login);
  const isOnline = (Date.now() - lastLogin.getTime()) < 5 * 60 * 1000;

  // Create steal record
  const defenseWindowEnd = isOnline
    ? new Date(Date.now() + 16 * 1000).toISOString() // 16 seconds for online defense
    : null;

  const { data: steal, error } = await supabase
    .from('bb_steals')
    .insert({
      thief_id: thiefId,
      target_id: targetId,
      steal_percentage: stealPercentage,
      potential_amount: potentialAmount,
      target_was_online: isOnline,
      defense_window_start: isOnline ? new Date().toISOString() : null,
      defense_window_end: defenseWindowEnd,
    })
    .select()
    .single();

  if (error) {
    return { steal: null, potentialAmount: 0, error: error.message };
  }

  // If target is offline, process steal immediately after minigame
  // If online, wait for defense window

  return { steal, potentialAmount, error: null };
};

// Complete steal (after minigame success)
export const completeSteal = async (
  stealId: string,
  minigameSuccess: boolean
): Promise<{
  success: boolean;
  stolenAmount: number;
  error: string | null;
}> => {
  const { data: steal } = await supabase
    .from('bb_steals')
    .select('*')
    .eq('id', stealId)
    .single();

  if (!steal) {
    return { success: false, stolenAmount: 0, error: 'Steal not found' };
  }

  if (steal.status !== 'in_progress') {
    return { success: false, stolenAmount: 0, error: 'Steal already completed' };
  }

  if (!minigameSuccess) {
    // Failed minigame
    await supabase
      .from('bb_steals')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', stealId);

    return { success: false, stolenAmount: 0, error: null };
  }

  // Check if target defended (for online targets)
  if (steal.target_was_online && steal.defense_window_end) {
    const windowEnd = new Date(steal.defense_window_end);

    if (steal.was_defended) {
      // Target defended - thief pays 2x penalty
      const penalty = steal.potential_amount! * 2;

      // Deduct from thief
      const { data: thief } = await supabase
        .from('bb_users')
        .select('coins')
        .eq('id', steal.thief_id)
        .single();

      if (thief) {
        const newThiefBalance = Math.max(0, thief.coins - penalty);
        await supabase
          .from('bb_users')
          .update({ coins: newThiefBalance })
          .eq('id', steal.thief_id);

        // Log transaction
        await supabase.from('bb_transactions').insert({
          user_id: steal.thief_id,
          amount: -penalty,
          balance_after: newThiefBalance,
          type: 'steal_penalty',
          reference_type: 'steal',
          reference_id: stealId,
          description: 'BUSTED! 2x penalty for getting caught.',
        });

        // Update steal record
        await supabase
          .from('bb_steals')
          .update({
            status: 'defended',
            thief_penalty: penalty,
            completed_at: new Date().toISOString(),
          })
          .eq('id', stealId);
      }

      return { success: false, stolenAmount: 0, error: null };
    }

    // If defense window still open, wait
    if (new Date() < windowEnd) {
      return { success: false, stolenAmount: 0, error: 'Defense window still open' };
    }
  }

  // Steal successful!
  const stolenAmount = steal.potential_amount!;

  // Get current balances
  const [{ data: thief }, { data: target }] = await Promise.all([
    supabase.from('bb_users').select('coins, steals_successful').eq('id', steal.thief_id).single(),
    supabase.from('bb_users').select('coins, times_robbed').eq('id', steal.target_id).single(),
  ]);

  if (!thief || !target) {
    return { success: false, stolenAmount: 0, error: 'Users not found' };
  }

  const newThiefBalance = thief.coins + stolenAmount;
  const newTargetBalance = Math.max(0, target.coins - stolenAmount);

  // Update balances
  await Promise.all([
    supabase
      .from('bb_users')
      .update({
        coins: newThiefBalance,
        steals_successful: thief.steals_successful + 1,
      })
      .eq('id', steal.thief_id),
    supabase
      .from('bb_users')
      .update({
        coins: newTargetBalance,
        times_robbed: target.times_robbed + 1,
      })
      .eq('id', steal.target_id),
  ]);

  // Log transactions
  await Promise.all([
    supabase.from('bb_transactions').insert({
      user_id: steal.thief_id,
      amount: stolenAmount,
      balance_after: newThiefBalance,
      type: 'steal_success',
      reference_type: 'steal',
      reference_id: stealId,
      description: `Clean heist! Stole ${stolenAmount} bingos.`,
    }),
    supabase.from('bb_transactions').insert({
      user_id: steal.target_id,
      amount: -stolenAmount,
      balance_after: newTargetBalance,
      type: 'steal_victim',
      reference_type: 'steal',
      reference_id: stealId,
      description: `Robbed! Lost ${stolenAmount} bingos to a dirty thief.`,
    }),
  ]);

  // Update steal record
  await supabase
    .from('bb_steals')
    .update({
      status: 'success',
      actual_amount: stolenAmount,
      completed_at: new Date().toISOString(),
    })
    .eq('id', stealId);

  // Create notification for victim
  await supabase.from('bb_notifications').insert({
    user_id: steal.target_id,
    type: 'robbery',
    title: 'YOU GOT ROBBED!',
    message: `Some stray just pawned ${stolenAmount} bingos from your stash!`,
    priority: 'high',
    reference_type: 'steal',
    reference_id: stealId,
  });

  return { success: true, stolenAmount, error: null };
};

// Defend against a steal (for online targets)
export const defendSteal = async (
  stealId: string,
  defenderId: string
): Promise<{ success: boolean; error: string | null }> => {
  const { data: steal } = await supabase
    .from('bb_steals')
    .select('*')
    .eq('id', stealId)
    .single();

  if (!steal) {
    return { success: false, error: 'Steal not found' };
  }

  if (steal.target_id !== defenderId) {
    return { success: false, error: 'You are not the target of this steal' };
  }

  if (steal.status !== 'in_progress') {
    return { success: false, error: 'Steal already completed' };
  }

  if (!steal.defense_window_end) {
    return { success: false, error: 'No defense window (offline target)' };
  }

  const windowEnd = new Date(steal.defense_window_end);
  if (new Date() > windowEnd) {
    return { success: false, error: 'Defense window has closed' };
  }

  // Successful defense!
  await supabase
    .from('bb_steals')
    .update({
      was_defended: true,
      defended_at: new Date().toISOString(),
    })
    .eq('id', stealId);

  // Update defender stats atomically using RPC
  const { error: rpcError } = await supabase.rpc('bb_increment_steals_defended', {
    user_uuid: defenderId
  });

  if (rpcError) {
    // Fallback: fetch and update manually if RPC doesn't exist yet
    const { data: defender } = await supabase
      .from('bb_users')
      .select('steals_defended')
      .eq('id', defenderId)
      .single();

    if (defender) {
      await supabase
        .from('bb_users')
        .update({
          steals_defended: (defender.steals_defended || 0) + 1,
        })
        .eq('id', defenderId);
    }
  }

  return { success: true, error: null };
};

// Get active steal attempts against user
export const getActiveStealAttempts = async (userId: string): Promise<{
  steals: DBSteal[];
  error: string | null;
}> => {
  const { data, error } = await supabase
    .from('bb_steals')
    .select('*')
    .eq('target_id', userId)
    .eq('status', 'in_progress')
    .not('defense_window_end', 'is', null)
    .gte('defense_window_end', new Date().toISOString());

  return { steals: data || [], error: error?.message || null };
};

// Get steal history
export const getStealHistory = async (userId: string, limit: number = 50): Promise<{
  steals: DBSteal[];
  error: string | null;
}> => {
  const { data, error } = await supabase
    .from('bb_steals')
    .select('*')
    .or(`thief_id.eq.${userId},target_id.eq.${userId}`)
    .neq('status', 'in_progress')
    .order('completed_at', { ascending: false })
    .limit(limit);

  return { steals: data || [], error: error?.message || null };
};
