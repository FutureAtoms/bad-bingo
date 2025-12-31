import { supabase } from './supabase';
import type { DBBet, DBBetParticipant, DBUser, DBFriendship } from '../types/database';
import { calculateStake, lockStake, logTransaction } from './economy';
import { createNotification } from './notifications';
import { getUserPushTokens } from './pushTokenService';

// Types for multiplayer bet creation
export interface MultiplayerBetConfig {
  text: string;
  category?: string;
  backgroundType?: 'bedroom' | 'gym' | 'club' | 'street' | 'office' | 'default';
  proofType?: 'photo' | 'video' | 'location' | 'time' | 'confirm';
  stakeAmount?: number; // If not provided, will be calculated from creator's balance
  expiresInHours?: number;
  heatLevelRequired?: 1 | 2 | 3;
}

export interface BetTarget {
  type: 'single' | 'multiple' | 'all';
  friendIds?: string[]; // Required for 'single' and 'multiple'
}

export interface MultiplayerBetResult {
  bet: DBBet | null;
  participants: DBBetParticipant[];
  notificationsSent: number;
  pushNotificationsSent: number;
  error: string | null;
}

// Create a bet for a single friend
export const createBetForFriend = async (
  creatorId: string,
  friendId: string,
  config: MultiplayerBetConfig
): Promise<MultiplayerBetResult> => {
  return createMultiplayerBet(creatorId, { type: 'single', friendIds: [friendId] }, config);
};

// Create a bet for a group of friends
export const createBetForGroup = async (
  creatorId: string,
  friendIds: string[],
  config: MultiplayerBetConfig
): Promise<MultiplayerBetResult> => {
  if (friendIds.length === 0) {
    return { bet: null, participants: [], notificationsSent: 0, pushNotificationsSent: 0, error: 'No friends specified' };
  }
  return createMultiplayerBet(creatorId, { type: 'multiple', friendIds }, config);
};

// Create a bet for all friends
export const createBetForAllFriends = async (
  creatorId: string,
  config: MultiplayerBetConfig
): Promise<MultiplayerBetResult> => {
  return createMultiplayerBet(creatorId, { type: 'all' }, config);
};

// Main multiplayer bet creation function
export const createMultiplayerBet = async (
  creatorId: string,
  target: BetTarget,
  config: MultiplayerBetConfig
): Promise<MultiplayerBetResult> => {
  try {
    // 1. Get creator's profile for stake calculation
    const { data: creator, error: creatorError } = await supabase
      .from('bb_users')
      .select('*')
      .eq('id', creatorId)
      .single();

    if (creatorError || !creator) {
      return { bet: null, participants: [], notificationsSent: 0, pushNotificationsSent: 0, error: 'Creator not found' };
    }

    // 2. Determine stake amount
    const stakeAmount = config.stakeAmount || calculateStake(creator.coins);

    // 3. Get target friends based on target type
    let targetFriendIds: string[] = [];

    if (target.type === 'all') {
      // Get all accepted friendships
      const { data: friendships, error: friendsError } = await supabase
        .from('bb_friendships')
        .select('friend_id, user_id')
        .or(`user_id.eq.${creatorId},friend_id.eq.${creatorId}`)
        .eq('status', 'accepted');

      if (friendsError) {
        return { bet: null, participants: [], notificationsSent: 0, pushNotificationsSent: 0, error: friendsError.message };
      }

      // Extract friend IDs (the one that's not the creator)
      targetFriendIds = (friendships || []).map(f =>
        f.user_id === creatorId ? f.friend_id : f.user_id
      ).filter((id, index, self) => self.indexOf(id) === index); // Remove duplicates

    } else if (target.type === 'single' || target.type === 'multiple') {
      if (!target.friendIds || target.friendIds.length === 0) {
        return { bet: null, participants: [], notificationsSent: 0, pushNotificationsSent: 0, error: 'No friend IDs provided' };
      }

      // Verify all provided friends are actual friends
      const { data: validFriendships, error: verifyError } = await supabase
        .from('bb_friendships')
        .select('friend_id, user_id')
        .or(`user_id.eq.${creatorId},friend_id.eq.${creatorId}`)
        .eq('status', 'accepted');

      if (verifyError) {
        return { bet: null, participants: [], notificationsSent: 0, pushNotificationsSent: 0, error: verifyError.message };
      }

      const validFriendIds = (validFriendships || []).map(f =>
        f.user_id === creatorId ? f.friend_id : f.user_id
      );

      // Filter to only valid friends
      targetFriendIds = target.friendIds.filter(id => validFriendIds.includes(id));

      if (targetFriendIds.length === 0) {
        return { bet: null, participants: [], notificationsSent: 0, pushNotificationsSent: 0, error: 'No valid friends in provided list' };
      }

      if (targetFriendIds.length !== target.friendIds.length) {
        console.warn(`Some friend IDs were invalid: ${target.friendIds.filter(id => !validFriendIds.includes(id)).join(', ')}`);
      }
    }

    if (targetFriendIds.length === 0) {
      return { bet: null, participants: [], notificationsSent: 0, pushNotificationsSent: 0, error: 'No friends to create bet with' };
    }

    // 4. Lock creator's stake
    const stakeLocked = await lockStake(creatorId, stakeAmount);
    if (!stakeLocked) {
      return { bet: null, participants: [], notificationsSent: 0, pushNotificationsSent: 0, error: 'Insufficient funds to lock stake' };
    }

    // 5. Calculate expiry
    const expiresAt = new Date(
      Date.now() + (config.expiresInHours || 2) * 60 * 60 * 1000
    ).toISOString();

    // 6. Create the bet
    const { data: bet, error: betError } = await supabase
      .from('bb_bets')
      .insert({
        text: config.text,
        category: config.category || null,
        background_type: config.backgroundType || 'default',
        base_stake: stakeAmount,
        proof_type: config.proofType || 'photo',
        creator_id: creatorId,
        target_type: target.type,
        target_users: [...targetFriendIds, creatorId],
        heat_level_required: config.heatLevelRequired || 1,
        expires_at: expiresAt,
        is_approved: true,
      })
      .select()
      .single();

    if (betError || !bet) {
      // Refund the locked stake on failure
      await refundStake(creatorId, stakeAmount);
      return { bet: null, participants: [], notificationsSent: 0, pushNotificationsSent: 0, error: betError?.message || 'Failed to create bet' };
    }

    // 7. Create participant records for all participants (including creator)
    const participantInserts = [
      // Creator participant (with swipe already set to 'yes' since they created it)
      {
        bet_id: bet.id,
        user_id: creatorId,
        swipe: 'yes' as const,
        swiped_at: new Date().toISOString(),
        stake_amount: stakeAmount,
        stake_locked: true,
      },
      // Friend participants (pending swipe)
      ...targetFriendIds.map(friendId => ({
        bet_id: bet.id,
        user_id: friendId,
        swipe: null,
        swiped_at: null,
        stake_amount: stakeAmount,
        stake_locked: false,
      })),
    ];

    const { data: participants, error: participantsError } = await supabase
      .from('bb_bet_participants')
      .insert(participantInserts)
      .select();

    if (participantsError) {
      console.error('Failed to create participants:', participantsError);
    }

    // 8. Send notifications to all participants
    const { notificationsSent, pushNotificationsSent } = await notifyBetParticipants(
      bet,
      creatorId,
      creator.name,
      targetFriendIds,
      stakeAmount
    );

    return {
      bet,
      participants: participants || [],
      notificationsSent,
      pushNotificationsSent,
      error: null,
    };
  } catch (err) {
    return {
      bet: null,
      participants: [],
      notificationsSent: 0,
      pushNotificationsSent: 0,
      error: (err as Error).message,
    };
  }
};

// Notify all bet participants via in-app and push notifications
export const notifyBetParticipants = async (
  bet: DBBet,
  creatorId: string,
  creatorName: string,
  participantIds: string[],
  stakeAmount: number
): Promise<{ notificationsSent: number; pushNotificationsSent: number }> => {
  let notificationsSent = 0;
  let pushNotificationsSent = 0;

  const participantCount = participantIds.length;
  const isGroupBet = participantCount > 1;

  for (const participantId of participantIds) {
    try {
      // Create in-app notification
      const notificationTitle = isGroupBet ? 'Group Challenge!' : 'You Got Called Out!';
      const notificationMessage = isGroupBet
        ? `${creatorName} dropped a challenge for ${participantCount} strays! "${bet.text}" - ${stakeAmount} Bingo on the line. You in?`
        : `${creatorName} just threw down the gauntlet: "${bet.text}" - ${stakeAmount} Bingo says they're right. Prove them wrong.`;

      const { notification, error: notifError } = await createNotification({
        userId: participantId,
        type: 'challenge',
        title: notificationTitle,
        message: notificationMessage,
        priority: 'high',
        referenceType: 'bet',
        referenceId: bet.id,
      });

      if (notification && !notifError) {
        notificationsSent++;
      }

      // Send push notification
      const pushResult = await sendPushNotificationToUser(
        participantId,
        notificationTitle,
        notificationMessage,
        {
          type: 'challenge',
          betId: bet.id,
          creatorId,
          stakeAmount,
        }
      );

      if (pushResult.sent) {
        pushNotificationsSent++;
      }
    } catch (err) {
      console.error(`Failed to notify participant ${participantId}:`, err);
    }
  }

  return { notificationsSent, pushNotificationsSent };
};

// Send push notification to a user using Supabase Edge Function
export const sendPushNotificationToUser = async (
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<{ sent: boolean; error?: string }> => {
  try {
    // Get user's push tokens
    const { tokens, error: tokensError } = await getUserPushTokens(userId);

    if (tokensError || tokens.length === 0) {
      return { sent: false, error: tokensError || 'No push tokens found' };
    }

    // Call the Supabase edge function to send push notification
    const { data: result, error: invokeError } = await supabase.functions.invoke('send-push-notification', {
      body: {
        tokens,
        title,
        body,
        data: {
          ...data,
          userId,
          timestamp: Date.now(),
        },
      },
    });

    if (invokeError) {
      console.error('Push notification error:', invokeError);
      return { sent: false, error: invokeError.message };
    }

    // Update notification record to mark push as sent
    if (data?.referenceId) {
      await supabase
        .from('bb_notifications')
        .update({
          push_sent: true,
          push_sent_at: new Date().toISOString(),
        })
        .eq('reference_id', data.referenceId)
        .eq('user_id', userId);
    }

    return { sent: true };
  } catch (err) {
    return { sent: false, error: (err as Error).message };
  }
};

// Helper to refund stake on failure
const refundStake = async (userId: string, amount: number): Promise<void> => {
  try {
    const { data: user } = await supabase
      .from('bb_users')
      .select('coins')
      .eq('id', userId)
      .single();

    if (user) {
      const newBalance = user.coins + amount;
      await supabase
        .from('bb_users')
        .update({ coins: newBalance })
        .eq('id', userId);

      await logTransaction(userId, amount, newBalance, 'allowance', 'Stake refunded due to bet creation failure');
    }
  } catch (err) {
    console.error('Failed to refund stake:', err);
  }
};

// Get bet details with all participants
export const getMultiplayerBetDetails = async (betId: string): Promise<{
  bet: DBBet | null;
  participants: (DBBetParticipant & { user?: DBUser })[];
  error: string | null;
}> => {
  const { data: bet, error: betError } = await supabase
    .from('bb_bets')
    .select('*')
    .eq('id', betId)
    .single();

  if (betError || !bet) {
    return { bet: null, participants: [], error: betError?.message || 'Bet not found' };
  }

  const { data: participants, error: participantsError } = await supabase
    .from('bb_bet_participants')
    .select(`
      *,
      user:bb_users(*)
    `)
    .eq('bet_id', betId);

  if (participantsError) {
    return { bet, participants: [], error: participantsError.message };
  }

  return {
    bet,
    participants: (participants || []).map(p => ({
      ...p,
      user: p.user as DBUser | undefined,
    })),
    error: null,
  };
};

// Check if a bet has all required swipes (for clash detection)
export const checkBetSwipeStatus = async (betId: string): Promise<{
  allSwiped: boolean;
  yesCount: number;
  noCount: number;
  pendingCount: number;
  participants: DBBetParticipant[];
}> => {
  const { data: participants, error } = await supabase
    .from('bb_bet_participants')
    .select('*')
    .eq('bet_id', betId);

  if (error || !participants) {
    return { allSwiped: false, yesCount: 0, noCount: 0, pendingCount: 0, participants: [] };
  }

  const yesCount = participants.filter(p => p.swipe === 'yes').length;
  const noCount = participants.filter(p => p.swipe === 'no').length;
  const pendingCount = participants.filter(p => p.swipe === null).length;

  return {
    allSwiped: pendingCount === 0,
    yesCount,
    noCount,
    pendingCount,
    participants,
  };
};

// Get user's pending bet invitations
export const getPendingBetInvitations = async (userId: string): Promise<{
  bets: (DBBet & { creator?: DBUser })[];
  error: string | null;
}> => {
  const now = new Date().toISOString();

  // Get bets where user is a participant but hasn't swiped yet
  const { data: participations, error: partError } = await supabase
    .from('bb_bet_participants')
    .select(`
      bet_id,
      bb_bets(
        *,
        creator:bb_users!bb_bets_creator_id_fkey(*)
      )
    `)
    .eq('user_id', userId)
    .is('swipe', null);

  if (partError) {
    return { bets: [], error: partError.message };
  }

  // Filter to only non-expired bets
  const bets = (participations || [])
    .map(p => p.bb_bets as (DBBet & { creator?: DBUser }))
    .filter(b => b && new Date(b.expires_at) > new Date());

  return { bets, error: null };
};

// Subscribe to bet updates (realtime)
export const subscribeToBetUpdates = (
  betId: string,
  onParticipantSwipe: (participant: DBBetParticipant) => void
) => {
  const channel = supabase
    .channel(`bet-participants:${betId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'bb_bet_participants',
        filter: `bet_id=eq.${betId}`,
      },
      (payload) => {
        if (payload.new && (payload.new as DBBetParticipant).swipe !== null) {
          onParticipantSwipe(payload.new as DBBetParticipant);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

// Cancel a bet (only creator can cancel before anyone swipes)
export const cancelMultiplayerBet = async (
  betId: string,
  creatorId: string
): Promise<{ success: boolean; error: string | null }> => {
  // Verify bet exists and user is creator
  const { data: bet, error: betError } = await supabase
    .from('bb_bets')
    .select('*')
    .eq('id', betId)
    .eq('creator_id', creatorId)
    .single();

  if (betError || !bet) {
    return { success: false, error: 'Bet not found or you are not the creator' };
  }

  // Check if anyone has swiped (besides creator)
  const { data: participants } = await supabase
    .from('bb_bet_participants')
    .select('*')
    .eq('bet_id', betId)
    .neq('user_id', creatorId)
    .not('swipe', 'is', null);

  if (participants && participants.length > 0) {
    return { success: false, error: 'Cannot cancel: Other participants have already responded' };
  }

  // Refund creator's stake
  const { data: creatorParticipant } = await supabase
    .from('bb_bet_participants')
    .select('stake_amount')
    .eq('bet_id', betId)
    .eq('user_id', creatorId)
    .single();

  if (creatorParticipant) {
    await refundStake(creatorId, creatorParticipant.stake_amount);
  }

  // Delete participants
  await supabase
    .from('bb_bet_participants')
    .delete()
    .eq('bet_id', betId);

  // Delete bet
  const { error: deleteError } = await supabase
    .from('bb_bets')
    .delete()
    .eq('id', betId);

  if (deleteError) {
    return { success: false, error: deleteError.message };
  }

  return { success: true, error: null };
};
