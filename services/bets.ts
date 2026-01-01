import { supabase } from './supabase';
import type { DBBet, DBBetParticipant } from '../types/database';
import { generateDailyBets } from './geminiService';
import { calculateStake, lockStakeForSwipe } from './economy';

// Get available bets for user (not yet swiped, not expired)
export const getAvailableBets = async (userId: string): Promise<{
  bets: (DBBet & { participant?: DBBetParticipant })[];
  error: string | null;
}> => {
  const now = new Date().toISOString();

  // Get bets that:
  // 1. Haven't expired
  // 2. Are available
  // 3. User hasn't swiped on yet
  const { data: bets, error } = await supabase
    .from('bb_bets')
    .select(`
      *,
      bb_bet_participants!left(*)
    `)
    .gte('expires_at', now)
    .lte('available_at', now)
    .eq('is_approved', true)
    .order('created_at', { ascending: false });

  if (error) {
    return { bets: [], error: error.message };
  }

  // Filter out bets user has already swiped on
  const availableBets = (bets || []).filter(bet => {
    const userParticipation = (bet.bb_bet_participants as DBBetParticipant[])?.find(
      p => p.user_id === userId && p.swipe !== null
    );
    return !userParticipation;
  });

  return { bets: availableBets, error: null };
};

// Create a new bet (user-generated or AI-generated)
export const createBet = async (bet: {
  text: string;
  category?: string;
  backgroundType?: string;
  baseStake: number;
  proofType?: 'photo' | 'video' | 'location' | 'time' | 'confirm';
  creatorId?: string;
  targetType?: 'single' | 'multiple' | 'all';
  targetUsers?: string[];
  heatLevelRequired?: number;
  expiresInHours?: number;
}): Promise<{ bet: DBBet | null; error: string | null }> => {
  const expiresAt = new Date(
    Date.now() + (bet.expiresInHours || 2) * 60 * 60 * 1000
  ).toISOString();

  const { data, error } = await supabase
    .from('bb_bets')
    .insert({
      text: bet.text,
      category: bet.category || null,
      background_type: bet.backgroundType || 'default',
      base_stake: bet.baseStake,
      proof_type: bet.proofType || 'photo',
      creator_id: bet.creatorId || null,
      target_type: bet.targetType || 'all',
      target_users: bet.targetUsers || null,
      heat_level_required: bet.heatLevelRequired || 1,
      expires_at: expiresAt,
    })
    .select()
    .single();

  return { bet: data, error: error?.message || null };
};

// Generate daily bets for a user-friend pair
export const generateBetsForFriend = async (
  userId: string,
  friendId: string,
  friendName: string,
  relationshipLevel: 1 | 2 | 3,
  userRiskProfile: string,
  userCoins: number
): Promise<{ bets: DBBet[]; error: string | null }> => {
  try {
    // Generate bets using AI
    const aiGeneratedBets = await generateDailyBets(
      relationshipLevel,
      friendName,
      userRiskProfile
    );

    // Calculate stake based on user's wallet
    const stake = calculateStake(userCoins);

    // Create bets in database
    const createdBets: DBBet[] = [];

    for (const aiBet of aiGeneratedBets) {
      const { bet, error } = await createBet({
        text: aiBet.text,
        category: aiBet.category,
        backgroundType: aiBet.backgroundType,
        baseStake: stake,
        creatorId: null, // AI generated
        targetType: 'single',
        targetUsers: [userId, friendId],
        heatLevelRequired: relationshipLevel,
        expiresInHours: 2,
      });

      if (bet && !error) {
        // Add both users as participants (not yet swiped)
        await supabase.from('bb_bet_participants').insert([
          { bet_id: bet.id, user_id: userId, stake_amount: stake },
          { bet_id: bet.id, user_id: friendId, stake_amount: stake },
        ]);

        createdBets.push(bet);
      }
    }

    return { bets: createdBets, error: null };
  } catch (err) {
    return { bets: [], error: (err as Error).message };
  }
};

// Match type returned from swipeBet
// - 'clash': Both users swiped with opposite votes -> clash created
// - 'hairball': Both users swiped the same way -> no clash, both agree
// - 'pending': Only one user has swiped, waiting for the other
export type SwipeMatchType = 'clash' | 'hairball' | 'pending';

// Record user's swipe on a bet
export const swipeBet = async (
  betId: string,
  userId: string,
  swipe: 'yes' | 'no',
  stakeAmount: number
): Promise<{
  success: boolean;
  clashCreated: boolean;
  matchType: SwipeMatchType;
  clashId?: string;
  error: string | null;
}> => {
  // Check if user has already swiped on this bet
  const { data: existingParticipant } = await supabase
    .from('bb_bet_participants')
    .select('swipe, stake_locked')
    .eq('bet_id', betId)
    .eq('user_id', userId)
    .single();

  // If participant exists and has already swiped, don't process again
  // Note: existingParticipant will be null if no record exists (PGRST116 error)
  if (existingParticipant && existingParticipant.swipe !== null) {
    return { success: false, clashCreated: false, matchType: 'pending', error: 'You already swiped on this bet' };
  }

  // Lock stake from user's wallet BEFORE recording swipe
  // This deducts bingos and creates a transaction record
  const lockResult = await lockStakeForSwipe(userId, betId, stakeAmount);

  if (!lockResult.success) {
    return { success: false, clashCreated: false, matchType: 'pending', error: lockResult.error };
  }

  // Update or create participant record
  const { error: upsertError } = await supabase
    .from('bb_bet_participants')
    .upsert({
      bet_id: betId,
      user_id: userId,
      swipe: swipe,
      swiped_at: new Date().toISOString(),
      stake_amount: stakeAmount,
      stake_locked: true,
    }, {
      onConflict: 'bet_id,user_id'
    });

  if (upsertError) {
    // Note: Ideally we should rollback the stake lock here, but Supabase doesn't support
    // client-side transactions. In production, use an RPC function for atomicity.
    return { success: false, clashCreated: false, matchType: 'pending', error: upsertError.message };
  }

  // Check if other participant has swiped
  const { data: participants } = await supabase
    .from('bb_bet_participants')
    .select('*')
    .eq('bet_id', betId)
    .not('swipe', 'is', null);

  if (!participants || participants.length < 2) {
    // Other user hasn't swiped yet - pending state
    return { success: true, clashCreated: false, matchType: 'pending', error: null };
  }

  const otherParticipant = participants.find(p => p.user_id !== userId);

  if (!otherParticipant) {
    return { success: true, clashCreated: false, matchType: 'pending', error: null };
  }

  // Check if swipes are opposite (clash!)
  if (otherParticipant.swipe !== swipe) {
    // Create clash!
    const totalPot = stakeAmount + otherParticipant.stake_amount;
    const proverId = swipe === 'yes' ? userId : otherParticipant.user_id;

    const { data: clash, error: clashError } = await supabase
      .from('bb_clashes')
      .insert({
        bet_id: betId,
        user1_id: userId,
        user2_id: otherParticipant.user_id,
        user1_swipe: swipe,
        user2_swipe: otherParticipant.swipe!,
        user1_stake: stakeAmount,
        user2_stake: otherParticipant.stake_amount,
        total_pot: totalPot,
        prover_id: proverId,
        proof_deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      })
      .select()
      .single();

    if (clashError) {
      return { success: true, clashCreated: false, matchType: 'pending', error: clashError.message };
    }

    return { success: true, clashCreated: true, matchType: 'clash', clashId: clash?.id, error: null };
  }

  // Same swipe - no clash (hairball) - both users voted the same way
  return { success: true, clashCreated: false, matchType: 'hairball', error: null };
};

// Get bet by ID with participants
export const getBetById = async (betId: string): Promise<{
  bet: (DBBet & { participants: DBBetParticipant[] }) | null;
  error: string | null;
}> => {
  const { data, error } = await supabase
    .from('bb_bets')
    .select(`
      *,
      bb_bet_participants(*)
    `)
    .eq('id', betId)
    .single();

  if (error) {
    return { bet: null, error: error.message };
  }

  return {
    bet: data ? {
      ...data,
      participants: data.bb_bet_participants as DBBetParticipant[]
    } : null,
    error: null
  };
};

// Get user's bet history
export const getUserBetHistory = async (userId: string, limit: number = 50): Promise<{
  bets: DBBet[];
  error: string | null;
}> => {
  const { data, error } = await supabase
    .from('bb_bet_participants')
    .select(`
      bet_id,
      swipe,
      swiped_at,
      bb_bets(*)
    `)
    .eq('user_id', userId)
    .not('swipe', 'is', null)
    .order('swiped_at', { ascending: false })
    .limit(limit);

  if (error) {
    return { bets: [], error: error.message };
  }

  const bets = data?.map(p => p.bb_bets as DBBet).filter(Boolean) || [];
  return { bets, error: null };
};
