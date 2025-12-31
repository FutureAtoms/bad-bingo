import { supabase } from './supabase';
import type { DBFriendship, DBUser } from '../types/database';
import { generateFriendshipProfile } from './geminiService';

export interface FriendWithProfile extends DBFriendship {
  friend: DBUser;
}

// ============================================
// FRIENDSHIP QUESTIONNAIRE SYSTEM
// ============================================

// Questionnaire reward constant
export const QUESTIONNAIRE_REWARD = 5000;

// Friendship questionnaire questions
export const FRIENDSHIP_QUESTIONS = [
  "How did you two meet? Chaos finds its own.",
  "How long have you known this person? Time is just a number, but I'm judging.",
  "What's the most embarrassing thing you know about them?",
  "How often do you actually hang out? Be honest.",
  "On a scale of 1-10, how likely are they to bail on plans?",
  "What's their worst habit that you tolerate?",
  "Would you trust them with a secret? Think carefully.",
  "What's one thing they do that drives you INSANE?",
];

// Submit questionnaire answers for a friendship
export const submitFriendshipQuestionnaire = async (
  friendshipId: string,
  userId: string,
  answers: string[]
): Promise<{ success: boolean; bothCompleted: boolean; rewardClaimed: boolean; error: string | null }> => {
  // Get the friendship
  const { data: friendship, error: fetchError } = await supabase
    .from('bb_friendships')
    .select('*')
    .eq('id', friendshipId)
    .single();

  if (fetchError || !friendship) {
    return { success: false, bothCompleted: false, rewardClaimed: false, error: 'Friendship not found' };
  }

  // Determine if user is the owner or friend
  const isUserOwner = (friendship as any).user_id === userId;
  const isFriendOwner = (friendship as any).friend_id === userId;

  if (!isUserOwner && !isFriendOwner) {
    return { success: false, bothCompleted: false, rewardClaimed: false, error: 'Not part of this friendship' };
  }

  // Check if already completed
  const alreadyCompleted = isUserOwner
    ? (friendship as any).user_questionnaire_completed
    : (friendship as any).friend_questionnaire_completed;

  if (alreadyCompleted) {
    return { success: false, bothCompleted: false, rewardClaimed: false, error: 'Questionnaire already completed' };
  }

  // Update questionnaire completion
  const updateField = isUserOwner ? 'user_questionnaire_completed' : 'friend_questionnaire_completed';
  const updateTimeField = isUserOwner ? 'user_questionnaire_completed_at' : 'friend_questionnaire_completed_at';

  const { error: updateError } = await supabase
    .from('bb_friendships')
    .update({
      [updateField]: true,
      [updateTimeField]: new Date().toISOString(),
    } as any)
    .eq('id', friendshipId);

  if (updateError) {
    return { success: false, bothCompleted: false, rewardClaimed: false, error: updateError.message };
  }

  // Also update the reverse friendship
  await supabase
    .from('bb_friendships')
    .update({
      [isUserOwner ? 'friend_questionnaire_completed' : 'user_questionnaire_completed']: true,
      [isUserOwner ? 'friend_questionnaire_completed_at' : 'user_questionnaire_completed_at']: new Date().toISOString(),
    } as any)
    .eq('user_id', (friendship as any).friend_id)
    .eq('friend_id', (friendship as any).user_id);

  // Check if both have now completed
  const otherCompleted = isUserOwner
    ? (friendship as any).friend_questionnaire_completed
    : (friendship as any).user_questionnaire_completed;

  if (otherCompleted && !(friendship as any).questionnaire_reward_claimed) {
    // Both completed! Award 5000 bingos to each
    const FRIEND_BONUS = 5000;

    // Award to current user
    await supabase.rpc('increment', { row_id: userId, column_name: 'coins', amount: FRIEND_BONUS } as any);

    // Award to other user
    const otherUserId = isUserOwner ? (friendship as any).friend_id : (friendship as any).user_id;
    await supabase.rpc('increment', { row_id: otherUserId, column_name: 'coins', amount: FRIEND_BONUS } as any);

    // Log transactions for both
    const { data: user1 } = await supabase.from('bb_users').select('coins').eq('id', userId).single();
    const { data: user2 } = await supabase.from('bb_users').select('coins').eq('id', otherUserId).single();

    await supabase.from('bb_transactions').insert([
      {
        user_id: userId,
        amount: FRIEND_BONUS,
        balance_after: (user1 as any)?.coins || FRIEND_BONUS,
        type: 'friend_bonus',
        reference_type: 'friendship',
        reference_id: friendshipId,
        description: 'Friend questionnaire bonus! You both know each other.',
      },
      {
        user_id: otherUserId,
        amount: FRIEND_BONUS,
        balance_after: (user2 as any)?.coins || FRIEND_BONUS,
        type: 'friend_bonus',
        reference_type: 'friendship',
        reference_id: friendshipId,
        description: 'Friend questionnaire bonus! You both know each other.',
      }
    ] as any);

    // Mark reward as claimed on both records
    await supabase
      .from('bb_friendships')
      .update({
        questionnaire_reward_claimed: true,
        questionnaire_reward_claimed_at: new Date().toISOString(),
      } as any)
      .or(`id.eq.${friendshipId},and(user_id.eq.${(friendship as any).friend_id},friend_id.eq.${(friendship as any).user_id})`);

    // Notify both users
    await supabase.from('bb_notifications').insert([
      {
        user_id: userId,
        type: 'system',
        title: '5000 BINGOS EARNED!',
        message: 'You and your friend both completed the questionnaire! Here\'s 5000 bingos for knowing each other.',
        priority: 'high',
        reference_type: 'friendship',
        reference_id: friendshipId,
      },
      {
        user_id: otherUserId,
        type: 'system',
        title: '5000 BINGOS EARNED!',
        message: 'You and your friend both completed the questionnaire! Here\'s 5000 bingos for knowing each other.',
        priority: 'high',
        reference_type: 'friendship',
        reference_id: friendshipId,
      }
    ] as any);

    return { success: true, bothCompleted: true, rewardClaimed: true, error: null };
  }

  // Notify the other user to complete theirs
  const otherUserId = isUserOwner ? (friendship as any).friend_id : (friendship as any).user_id;
  const { data: currentUser } = await supabase.from('bb_users').select('name').eq('id', userId).single();

  await supabase.from('bb_notifications').insert({
    user_id: otherUserId,
    type: 'system',
    title: 'Complete the Questionnaire!',
    message: `${(currentUser as any)?.name || 'Your friend'} completed their questionnaire. Complete yours to earn 5000 bingos each!`,
    priority: 'high',
    reference_type: 'friendship',
    reference_id: friendshipId,
  } as any);

  return { success: true, bothCompleted: false, rewardClaimed: false, error: null };
};

// Check questionnaire status for a friendship
export const getQuestionnaireStatus = async (
  friendshipId: string,
  userId: string
): Promise<{
  userCompleted: boolean;
  friendCompleted: boolean;
  rewardClaimed: boolean;
  error: string | null;
}> => {
  const { data: friendship, error } = await supabase
    .from('bb_friendships')
    .select('user_id, user_questionnaire_completed, friend_questionnaire_completed, questionnaire_reward_claimed')
    .eq('id', friendshipId)
    .single();

  if (error || !friendship) {
    return { userCompleted: false, friendCompleted: false, rewardClaimed: false, error: error?.message || 'Not found' };
  }

  const isUserOwner = (friendship as any).user_id === userId;

  return {
    userCompleted: isUserOwner ? (friendship as any).user_questionnaire_completed : (friendship as any).friend_questionnaire_completed,
    friendCompleted: isUserOwner ? (friendship as any).friend_questionnaire_completed : (friendship as any).user_questionnaire_completed,
    rewardClaimed: (friendship as any).questionnaire_reward_claimed,
    error: null,
  };
};

// Get friendships with pending questionnaires
export const getPendingQuestionnaires = async (
  userId: string
): Promise<{ friendships: FriendWithProfile[]; error: string | null }> => {
  const { data, error } = await supabase
    .from('bb_friendships')
    .select(`
      *,
      friend:bb_users!bb_friendships_friend_id_fkey(*)
    `)
    .eq('user_id', userId)
    .eq('status', 'accepted')
    .eq('user_questionnaire_completed', false);

  if (error) {
    return { friendships: [], error: error.message };
  }

  return {
    friendships: (data || []).map((f: any) => ({ ...f, friend: f.friend as DBUser })),
    error: null,
  };
};

// Heat proposal interface for pending proposals
export interface HeatProposal {
  friendshipId: string;
  proposedLevel: 1 | 2 | 3;
  proposedBy: string;
  proposedByName: string;
  proposedAt: string;
  currentLevel: 1 | 2 | 3;
  friendName: string;
  friendId: string;
  friendAvatarUrl: string | null;
}

// Constants
const HEAT_COOLDOWN_HOURS = 24;

// Get all friends for a user
export const getFriends = async (userId: string): Promise<{
  friends: FriendWithProfile[];
  error: string | null;
}> => {
  const { data, error } = await supabase
    .from('bb_friendships')
    .select(`
      *,
      friend:bb_users!bb_friendships_friend_id_fkey(*)
    `)
    .eq('user_id', userId)
    .eq('status', 'accepted');

  if (error) {
    return { friends: [], error: error.message };
  }

  const friends = (data || []).map(f => ({
    ...f,
    friend: f.friend as DBUser
  }));

  return { friends, error: null };
};

// Get pending friend requests (incoming)
export const getPendingRequests = async (userId: string): Promise<{
  requests: FriendWithProfile[];
  error: string | null;
}> => {
  const { data, error } = await supabase
    .from('bb_friendships')
    .select(`
      *,
      friend:bb_users!bb_friendships_user_id_fkey(*)
    `)
    .eq('friend_id', userId)
    .eq('status', 'pending');

  if (error) {
    return { requests: [], error: error.message };
  }

  const requests = (data || []).map(f => ({
    ...f,
    friend: f.friend as DBUser
  }));

  return { requests, error: null };
};

// Send friend request
export const sendFriendRequest = async (
  userId: string,
  friendId: string,
  surveyAnswers: string[]
): Promise<{ friendship: DBFriendship | null; error: string | null }> => {
  // Check if friendship already exists
  const { data: existing } = await supabase
    .from('bb_friendships')
    .select('id')
    .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`)
    .single();

  if (existing) {
    return { friendship: null, error: 'Friendship already exists or pending' };
  }

  // Get friend's name for AI profile
  const { data: friend } = await supabase
    .from('bb_users')
    .select('name')
    .eq('id', friendId)
    .single();

  if (!friend) {
    return { friendship: null, error: 'Friend not found' };
  }

  // Generate relationship profile using AI
  const { level, description } = await generateFriendshipProfile(friend.name, surveyAnswers);

  // Create friendship
  const { data: friendship, error } = await supabase
    .from('bb_friendships')
    .insert({
      user_id: userId,
      friend_id: friendId,
      initiated_by: userId,
      heat_level: level,
      user_proposed_heat: level,
      relationship_description: description,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    return { friendship: null, error: error.message };
  }

  // Create notification for recipient
  await supabase.from('bb_notifications').insert({
    user_id: friendId,
    type: 'system',
    title: 'New Stray Wants In',
    message: `Someone wants to join your pride. Accept or reject?`,
    priority: 'normal',
    reference_type: 'friendship',
    reference_id: friendship?.id,
  });

  return { friendship, error: null };
};

// Accept friend request
export const acceptFriendRequest = async (
  friendshipId: string,
  userId: string,
  proposedHeatLevel?: 1 | 2 | 3
): Promise<{ success: boolean; error: string | null }> => {
  const { data: friendship } = await supabase
    .from('bb_friendships')
    .select('*')
    .eq('id', friendshipId)
    .single();

  if (!friendship) {
    return { success: false, error: 'Friendship not found' };
  }

  if (friendship.friend_id !== userId) {
    return { success: false, error: 'You cannot accept this request' };
  }

  // Determine final heat level (use proposed or mutual agreement)
  let finalHeatLevel = friendship.heat_level;
  let heatConfirmed = true;

  if (proposedHeatLevel && proposedHeatLevel !== friendship.user_proposed_heat) {
    // Use the lower of the two for safety
    finalHeatLevel = Math.min(proposedHeatLevel, friendship.user_proposed_heat || 1) as 1 | 2 | 3;
    heatConfirmed = proposedHeatLevel === friendship.user_proposed_heat;
  }

  // Update friendship
  const { error } = await supabase
    .from('bb_friendships')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
      friend_proposed_heat: proposedHeatLevel,
      heat_level: finalHeatLevel,
      heat_confirmed: heatConfirmed,
    })
    .eq('id', friendshipId);

  if (error) {
    return { success: false, error: error.message };
  }

  // Create reverse friendship record
  await supabase.from('bb_friendships').insert({
    user_id: friendship.friend_id,
    friend_id: friendship.user_id,
    initiated_by: friendship.user_id,
    heat_level: finalHeatLevel,
    user_proposed_heat: proposedHeatLevel,
    friend_proposed_heat: friendship.user_proposed_heat,
    heat_confirmed: heatConfirmed,
    relationship_description: friendship.relationship_description,
    status: 'accepted',
    accepted_at: new Date().toISOString(),
  });

  // Notify the requester
  await supabase.from('bb_notifications').insert({
    user_id: friendship.user_id,
    type: 'system',
    title: 'New Pride Member',
    message: `Your friend request was accepted. Time to cause chaos together.`,
    priority: 'normal',
    reference_type: 'friendship',
    reference_id: friendshipId,
  });

  return { success: true, error: null };
};

// Reject friend request
export const rejectFriendRequest = async (
  friendshipId: string,
  userId: string
): Promise<{ success: boolean; error: string | null }> => {
  const { data: friendship } = await supabase
    .from('bb_friendships')
    .select('friend_id')
    .eq('id', friendshipId)
    .single();

  if (!friendship || friendship.friend_id !== userId) {
    return { success: false, error: 'Cannot reject this request' };
  }

  const { error } = await supabase
    .from('bb_friendships')
    .update({ status: 'rejected' })
    .eq('id', friendshipId);

  return { success: !error, error: error?.message || null };
};

// Block a friend
export const blockFriend = async (
  userId: string,
  friendId: string
): Promise<{ success: boolean; error: string | null }> => {
  // Update both directions
  await supabase
    .from('bb_friendships')
    .update({ status: 'blocked' })
    .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`);

  return { success: true, error: null };
};

// ============================================
// MUTUAL HEAT CONSENT SYSTEM
// ============================================

/**
 * Propose a new heat level for a friendship.
 * The proposal becomes pending until the other user accepts or rejects it.
 * 24-hour cooldown applies after any confirmed heat level change.
 */
export const proposeHeatLevel = async (
  friendshipId: string,
  proposerId: string,
  level: 1 | 2 | 3
): Promise<{ success: boolean; error: string | null }> => {
  // Get both friendship records (user->friend and friend->user)
  const { data: friendship } = await supabase
    .from('bb_friendships')
    .select('*')
    .eq('id', friendshipId)
    .single();

  if (!friendship) {
    return { success: false, error: 'Friendship not found' };
  }

  // Check 24h cooldown since last confirmed heat change
  if (friendship.heat_changed_at) {
    const lastChange = new Date(friendship.heat_changed_at);
    const hoursSinceChange = (Date.now() - lastChange.getTime()) / (1000 * 60 * 60);

    if (hoursSinceChange < HEAT_COOLDOWN_HOURS) {
      const hoursRemaining = Math.ceil(HEAT_COOLDOWN_HOURS - hoursSinceChange);
      return {
        success: false,
        error: `Must wait ${hoursRemaining} more hour${hoursRemaining === 1 ? '' : 's'} before changing heat level`
      };
    }
  }

  // Check if proposer is part of this friendship
  const isUserOwner = friendship.user_id === proposerId;
  const isFriendOwner = friendship.friend_id === proposerId;

  if (!isUserOwner && !isFriendOwner) {
    return { success: false, error: 'You are not part of this friendship' };
  }

  // If proposing the same level as current, no need for proposal
  if (friendship.heat_level === level && friendship.heat_confirmed) {
    return { success: false, error: 'Heat level is already at this level' };
  }

  // Check if there's already a pending proposal from the other user
  const existingProposal = friendship.heat_level_proposed;
  const existingProposer = friendship.heat_level_proposed_by;

  // If other user proposed the same level, auto-confirm
  if (existingProposal === level && existingProposer && existingProposer !== proposerId) {
    // Both users agree! Confirm the heat level
    const { error: updateError } = await supabase
      .from('bb_friendships')
      .update({
        heat_level: level,
        heat_confirmed: true,
        heat_changed_at: new Date().toISOString(),
        heat_level_proposed: null,
        heat_level_proposed_by: null,
        heat_level_proposed_at: null,
        user_proposed_heat: level,
        friend_proposed_heat: level,
      })
      .eq('id', friendshipId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Also update the reverse friendship record
    await supabase
      .from('bb_friendships')
      .update({
        heat_level: level,
        heat_confirmed: true,
        heat_changed_at: new Date().toISOString(),
        heat_level_proposed: null,
        heat_level_proposed_by: null,
        heat_level_proposed_at: null,
        user_proposed_heat: level,
        friend_proposed_heat: level,
      })
      .eq('user_id', friendship.friend_id)
      .eq('friend_id', friendship.user_id);

    // Create notification for the other user
    const targetUserId = isUserOwner ? friendship.friend_id : friendship.user_id;
    await supabase.from('bb_notifications').insert({
      user_id: targetUserId,
      type: 'system',
      title: 'Heat Level Confirmed!',
      message: `Your heat level has been updated to level ${level}. Things are about to get ${level === 3 ? 'SAVAGE' : level === 2 ? 'SPICY' : 'CHILL'}.`,
      priority: 'normal',
      reference_type: 'friendship',
      reference_id: friendshipId,
    });

    return { success: true, error: null };
  }

  // Create a new proposal
  const { error: updateError } = await supabase
    .from('bb_friendships')
    .update({
      heat_level_proposed: level,
      heat_level_proposed_by: proposerId,
      heat_level_proposed_at: new Date().toISOString(),
      // Also update the individual proposal tracking
      [isUserOwner ? 'user_proposed_heat' : 'friend_proposed_heat']: level,
    })
    .eq('id', friendshipId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  // Update reverse friendship as well
  await supabase
    .from('bb_friendships')
    .update({
      heat_level_proposed: level,
      heat_level_proposed_by: proposerId,
      heat_level_proposed_at: new Date().toISOString(),
      [isUserOwner ? 'friend_proposed_heat' : 'user_proposed_heat']: level,
    })
    .eq('user_id', friendship.friend_id)
    .eq('friend_id', friendship.user_id);

  // Get proposer name for notification
  const { data: proposer } = await supabase
    .from('bb_users')
    .select('name')
    .eq('id', proposerId)
    .single();

  // Notify the other user about the proposal
  const targetUserId = isUserOwner ? friendship.friend_id : friendship.user_id;
  await supabase.from('bb_notifications').insert({
    user_id: targetUserId,
    type: 'system',
    title: 'Heat Level Proposal',
    message: `${proposer?.name || 'Someone'} wants to change your heat level to ${level === 3 ? 'SAVAGE' : level === 2 ? 'SPICY' : 'CHILL'}. Accept or reject?`,
    priority: 'high',
    reference_type: 'heat_proposal',
    reference_id: friendshipId,
  });

  return { success: true, error: null };
};

/**
 * Accept a pending heat level proposal.
 * This confirms the heat level and starts the 24h cooldown.
 */
export const acceptHeatLevel = async (
  friendshipId: string,
  userId: string
): Promise<{ success: boolean; newLevel: number; error: string | null }> => {
  const { data: friendship } = await supabase
    .from('bb_friendships')
    .select('*')
    .eq('id', friendshipId)
    .single();

  if (!friendship) {
    return { success: false, newLevel: 0, error: 'Friendship not found' };
  }

  // Check that there's a pending proposal
  if (!friendship.heat_level_proposed || !friendship.heat_level_proposed_by) {
    return { success: false, newLevel: 0, error: 'No pending heat level proposal' };
  }

  // Check that the user is not the one who proposed (can't accept own proposal)
  if (friendship.heat_level_proposed_by === userId) {
    return { success: false, newLevel: 0, error: 'Cannot accept your own proposal' };
  }

  // Check user is part of this friendship
  const isUserOwner = friendship.user_id === userId;
  const isFriendOwner = friendship.friend_id === userId;

  if (!isUserOwner && !isFriendOwner) {
    return { success: false, newLevel: 0, error: 'You are not part of this friendship' };
  }

  const newLevel = friendship.heat_level_proposed as 1 | 2 | 3;

  // Accept the proposal - update both records
  const { error: updateError } = await supabase
    .from('bb_friendships')
    .update({
      heat_level: newLevel,
      heat_confirmed: true,
      heat_changed_at: new Date().toISOString(),
      heat_level_proposed: null,
      heat_level_proposed_by: null,
      heat_level_proposed_at: null,
      user_proposed_heat: newLevel,
      friend_proposed_heat: newLevel,
    })
    .eq('id', friendshipId);

  if (updateError) {
    return { success: false, newLevel: 0, error: updateError.message };
  }

  // Update reverse friendship
  await supabase
    .from('bb_friendships')
    .update({
      heat_level: newLevel,
      heat_confirmed: true,
      heat_changed_at: new Date().toISOString(),
      heat_level_proposed: null,
      heat_level_proposed_by: null,
      heat_level_proposed_at: null,
      user_proposed_heat: newLevel,
      friend_proposed_heat: newLevel,
    })
    .eq('user_id', friendship.friend_id)
    .eq('friend_id', friendship.user_id);

  // Notify the proposer that their proposal was accepted
  await supabase.from('bb_notifications').insert({
    user_id: friendship.heat_level_proposed_by,
    type: 'system',
    title: 'Heat Level Accepted!',
    message: `Your heat level proposal was accepted! You're now at ${newLevel === 3 ? 'SAVAGE' : newLevel === 2 ? 'SPICY' : 'CHILL'} level.`,
    priority: 'normal',
    reference_type: 'friendship',
    reference_id: friendshipId,
  });

  return { success: true, newLevel, error: null };
};

/**
 * Reject a pending heat level proposal.
 * The heat level remains at the current level or falls back to the lower level.
 */
export const rejectHeatLevel = async (
  friendshipId: string,
  userId: string
): Promise<{ success: boolean; error: string | null }> => {
  const { data: friendship } = await supabase
    .from('bb_friendships')
    .select('*')
    .eq('id', friendshipId)
    .single();

  if (!friendship) {
    return { success: false, error: 'Friendship not found' };
  }

  // Check that there's a pending proposal
  if (!friendship.heat_level_proposed || !friendship.heat_level_proposed_by) {
    return { success: false, error: 'No pending heat level proposal' };
  }

  // Check that the user is not the one who proposed
  if (friendship.heat_level_proposed_by === userId) {
    return { success: false, error: 'Cannot reject your own proposal' };
  }

  // Check user is part of this friendship
  const isUserOwner = friendship.user_id === userId;
  const isFriendOwner = friendship.friend_id === userId;

  if (!isUserOwner && !isFriendOwner) {
    return { success: false, error: 'You are not part of this friendship' };
  }

  const proposedLevel = friendship.heat_level_proposed;
  const proposerId = friendship.heat_level_proposed_by;

  // If the proposal was to INCREASE heat, keep current level
  // If the proposal was to DECREASE heat, use the LOWER level (rejector's preference)
  let finalLevel = friendship.heat_level;
  if (proposedLevel < friendship.heat_level) {
    // Proposer wanted lower heat - use lower since one person wants less spicy
    finalLevel = proposedLevel as 1 | 2 | 3;
  }

  // Clear the proposal
  const { error: updateError } = await supabase
    .from('bb_friendships')
    .update({
      heat_level: finalLevel,
      heat_confirmed: finalLevel === 1, // Only confirmed if at lowest level
      heat_level_proposed: null,
      heat_level_proposed_by: null,
      heat_level_proposed_at: null,
    })
    .eq('id', friendshipId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  // Update reverse friendship
  await supabase
    .from('bb_friendships')
    .update({
      heat_level: finalLevel,
      heat_confirmed: finalLevel === 1,
      heat_level_proposed: null,
      heat_level_proposed_by: null,
      heat_level_proposed_at: null,
    })
    .eq('user_id', friendship.friend_id)
    .eq('friend_id', friendship.user_id);

  // Notify the proposer
  await supabase.from('bb_notifications').insert({
    user_id: proposerId,
    type: 'system',
    title: 'Heat Level Rejected',
    message: proposedLevel > friendship.heat_level
      ? `Your request to increase heat level was rejected. Staying at current level.`
      : `Heat level adjusted to ${finalLevel === 1 ? 'CHILL' : finalLevel === 2 ? 'SPICY' : 'SAVAGE'} - the lower preference wins.`,
    priority: 'normal',
    reference_type: 'friendship',
    reference_id: friendshipId,
  });

  return { success: true, error: null };
};

/**
 * Get all pending heat level proposals for a user.
 * Returns proposals where someone else proposed a heat level change.
 */
export const getPendingHeatProposals = async (
  userId: string
): Promise<{ proposals: HeatProposal[]; error: string | null }> => {
  // Get friendships where there's a pending proposal not made by this user
  const { data: friendships, error } = await supabase
    .from('bb_friendships')
    .select(`
      id,
      heat_level,
      heat_level_proposed,
      heat_level_proposed_by,
      heat_level_proposed_at,
      friend_id,
      friend:bb_users!bb_friendships_friend_id_fkey(id, name, avatar_url)
    `)
    .eq('user_id', userId)
    .eq('status', 'accepted')
    .not('heat_level_proposed', 'is', null)
    .neq('heat_level_proposed_by', userId);

  if (error) {
    return { proposals: [], error: error.message };
  }

  // Get proposer names for each proposal
  const proposerIds = [...new Set(friendships?.map(f => f.heat_level_proposed_by).filter(Boolean))];
  const { data: proposers } = await supabase
    .from('bb_users')
    .select('id, name')
    .in('id', proposerIds);

  const proposerMap = new Map(proposers?.map(p => [p.id, p.name]) || []);

  const proposals: HeatProposal[] = (friendships || []).map(f => ({
    friendshipId: f.id,
    proposedLevel: f.heat_level_proposed as 1 | 2 | 3,
    proposedBy: f.heat_level_proposed_by!,
    proposedByName: proposerMap.get(f.heat_level_proposed_by!) || 'Someone',
    proposedAt: f.heat_level_proposed_at!,
    currentLevel: f.heat_level,
    friendName: (f.friend as any)?.name || 'Unknown',
    friendId: f.friend_id,
    friendAvatarUrl: (f.friend as any)?.avatar_url || null,
  }));

  return { proposals, error: null };
};

/**
 * Get remaining cooldown time in hours for heat level change.
 * Returns null if no cooldown is active.
 */
export const getHeatChangeCooldownHours = (heatChangedAt: string | null): number | null => {
  if (!heatChangedAt) return null;

  const lastChange = new Date(heatChangedAt);
  const hoursSinceChange = (Date.now() - lastChange.getTime()) / (1000 * 60 * 60);

  if (hoursSinceChange >= HEAT_COOLDOWN_HOURS) return null;

  return HEAT_COOLDOWN_HOURS - hoursSinceChange;
};

// Get remaining cooldown time for heat level change
export const getHeatChangeCooldown = (heatChangedAt: string | null): number | null => {
  if (!heatChangedAt) return null;

  const lastChange = new Date(heatChangedAt);
  const hoursSinceChange = (Date.now() - lastChange.getTime()) / (1000 * 60 * 60);

  if (hoursSinceChange >= 24) return null;

  return 24 - hoursSinceChange;
};

// Check if heat level change is allowed (24h cooldown check)
export const canChangeHeatLevel = (heatChangedAt: string | null): boolean => {
  if (!heatChangedAt) return true;

  const lastChange = new Date(heatChangedAt);
  const hoursSinceChange = (Date.now() - lastChange.getTime()) / (1000 * 60 * 60);

  return hoursSinceChange >= 24;
};

// Search for users by username
export const searchUsers = async (query: string, excludeUserId: string): Promise<{
  users: DBUser[];
  error: string | null;
}> => {
  const { data, error } = await supabase
    .from('bb_users')
    .select('*')
    .neq('id', excludeUserId)
    .ilike('username', `%${query}%`)
    .limit(20);

  return { users: data || [], error: error?.message || null };
};

// Get friendship between two users
export const getFriendship = async (userId: string, friendId: string): Promise<{
  friendship: DBFriendship | null;
  error: string | null;
}> => {
  const { data, error } = await supabase
    .from('bb_friendships')
    .select('*')
    .eq('user_id', userId)
    .eq('friend_id', friendId)
    .single();

  return { friendship: data, error: error?.message || null };
};
