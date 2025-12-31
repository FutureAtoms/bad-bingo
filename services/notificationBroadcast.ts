import { supabase } from './supabase';
import type { DBNotification, DBUser } from '../types/database';
import { createNotification } from './notifications';
import { getUserPushTokens } from './pushTokenService';

// Notification types for broadcasting
export type NotificationType =
  | 'challenge'      // New bet challenge
  | 'clash'          // Clash created from opposing swipes
  | 'proof_needed'   // Proof submission required
  | 'proof_received' // Proof was submitted
  | 'win'            // Won a clash
  | 'loss'           // Lost a clash
  | 'steal_alert'    // Someone trying to steal
  | 'steal_success'  // Successfully stole
  | 'defense_win'    // Defended against steal
  | 'system'         // System notification
  | 'friend_request' // New friend request
  | 'bet_expired';   // Bet expired without resolution

export interface BroadcastConfig {
  type: NotificationType;
  title: string;
  message: string;
  priority?: 'critical' | 'high' | 'medium' | 'normal';
  referenceType?: string;
  referenceId?: string;
  data?: Record<string, unknown>;
  sendPush?: boolean;
}

export interface BroadcastResult {
  totalRecipients: number;
  notificationsSent: number;
  pushNotificationsSent: number;
  failures: { userId: string; error: string }[];
}

// Broadcast notification to multiple users simultaneously
export const broadcastNotification = async (
  userIds: string[],
  config: BroadcastConfig
): Promise<BroadcastResult> => {
  const result: BroadcastResult = {
    totalRecipients: userIds.length,
    notificationsSent: 0,
    pushNotificationsSent: 0,
    failures: [],
  };

  // Process in parallel for speed
  const promises = userIds.map(async (userId) => {
    try {
      // Create in-app notification
      const { notification, error } = await createNotification({
        userId,
        type: config.type,
        title: config.title,
        message: config.message,
        priority: config.priority || 'normal',
        referenceType: config.referenceType,
        referenceId: config.referenceId,
      });

      if (notification && !error) {
        result.notificationsSent++;

        // Send push notification if enabled
        if (config.sendPush !== false) {
          const pushSent = await sendPushToUser(userId, config);
          if (pushSent) {
            result.pushNotificationsSent++;
          }
        }
      } else if (error) {
        result.failures.push({ userId, error });
      }
    } catch (err) {
      result.failures.push({ userId, error: (err as Error).message });
    }
  });

  await Promise.all(promises);

  return result;
};

// Broadcast bet created notification
export const broadcastBetCreated = async (
  creatorName: string,
  betText: string,
  betId: string,
  stakeAmount: number,
  participantIds: string[]
): Promise<BroadcastResult> => {
  const isGroup = participantIds.length > 1;

  return broadcastNotification(participantIds, {
    type: 'challenge',
    title: isGroup ? 'Group Challenge!' : 'You Got Called Out!',
    message: isGroup
      ? `${creatorName} dropped a challenge for ${participantIds.length} strays! "${betText}" - ${stakeAmount} Bingo on the line.`
      : `${creatorName} just threw down: "${betText}" - ${stakeAmount} Bingo says they're right.`,
    priority: 'high',
    referenceType: 'bet',
    referenceId: betId,
    data: {
      betId,
      stakeAmount,
      creatorName,
      isGroup,
    },
    sendPush: true,
  });
};

// Broadcast clash created notification
export const broadcastClashCreated = async (
  clashId: string,
  betText: string,
  totalPot: number,
  proverId: string,
  challengerId: string
): Promise<BroadcastResult> => {
  // Notify the prover
  const proverResult = await broadcastNotification([proverId], {
    type: 'clash',
    title: 'CLASH!',
    message: `Opposing swipes! You need to prove: "${betText}". ${totalPot} Bingo in the pot. 24 hours to submit proof.`,
    priority: 'critical',
    referenceType: 'clash',
    referenceId: clashId,
    data: { clashId, totalPot, isProver: true },
    sendPush: true,
  });

  // Notify the challenger
  const challengerResult = await broadcastNotification([challengerId], {
    type: 'clash',
    title: 'CLASH!',
    message: `Opposing swipes! "${betText}" - ${totalPot} Bingo on the line. Waiting for proof.`,
    priority: 'high',
    referenceType: 'clash',
    referenceId: clashId,
    data: { clashId, totalPot, isProver: false },
    sendPush: true,
  });

  return {
    totalRecipients: 2,
    notificationsSent: proverResult.notificationsSent + challengerResult.notificationsSent,
    pushNotificationsSent: proverResult.pushNotificationsSent + challengerResult.pushNotificationsSent,
    failures: [...proverResult.failures, ...challengerResult.failures],
  };
};

// Broadcast proof submitted notification
export const broadcastProofSubmitted = async (
  clashId: string,
  proverName: string,
  challengerId: string
): Promise<BroadcastResult> => {
  return broadcastNotification([challengerId], {
    type: 'proof_received',
    title: 'Proof Submitted',
    message: `${proverName} submitted their proof. Review it before it expires and decide: Accept or Dispute?`,
    priority: 'high',
    referenceType: 'clash',
    referenceId: clashId,
    data: { clashId },
    sendPush: true,
  });
};

// Broadcast clash result notifications
export const broadcastClashResult = async (
  clashId: string,
  winnerId: string,
  loserId: string,
  winnerName: string,
  loserName: string,
  potAmount: number,
  betText: string
): Promise<BroadcastResult> => {
  // Notify winner
  const winnerResult = await broadcastNotification([winnerId], {
    type: 'win',
    title: 'VICTORY!',
    message: `You won the clash against ${loserName}! "${betText}" - ${potAmount} Bingo is yours.`,
    priority: 'high',
    referenceType: 'clash',
    referenceId: clashId,
    data: { clashId, potAmount, opponent: loserName },
    sendPush: true,
  });

  // Notify loser
  const loserResult = await broadcastNotification([loserId], {
    type: 'loss',
    title: 'Defeat...',
    message: `You lost the clash against ${winnerName}. "${betText}" - ${potAmount} Bingo gone. Get revenge next time.`,
    priority: 'medium',
    referenceType: 'clash',
    referenceId: clashId,
    data: { clashId, potAmount, opponent: winnerName },
    sendPush: true,
  });

  return {
    totalRecipients: 2,
    notificationsSent: winnerResult.notificationsSent + loserResult.notificationsSent,
    pushNotificationsSent: winnerResult.pushNotificationsSent + loserResult.pushNotificationsSent,
    failures: [...winnerResult.failures, ...loserResult.failures],
  };
};

// Broadcast steal alert
export const broadcastStealAlert = async (
  stealId: string,
  targetId: string,
  thiefName: string,
  potentialAmount: number,
  defenseWindowEnd: string
): Promise<BroadcastResult> => {
  const windowMinutes = Math.round(
    (new Date(defenseWindowEnd).getTime() - Date.now()) / (1000 * 60)
  );

  return broadcastNotification([targetId], {
    type: 'steal_alert',
    title: 'HEIST IN PROGRESS!',
    message: `${thiefName} is trying to steal ${potentialAmount} Bingo! You have ${windowMinutes} seconds to defend!`,
    priority: 'critical',
    referenceType: 'steal',
    referenceId: stealId,
    data: { stealId, thiefName, potentialAmount, defenseWindowEnd },
    sendPush: true,
  });
};

// Broadcast bet expired notification
export const broadcastBetExpired = async (
  betId: string,
  betText: string,
  participantIds: string[]
): Promise<BroadcastResult> => {
  return broadcastNotification(participantIds, {
    type: 'bet_expired',
    title: 'Bet Expired',
    message: `"${betText}" expired without resolution. No stakes were lost.`,
    priority: 'normal',
    referenceType: 'bet',
    referenceId: betId,
    data: { betId },
    sendPush: false, // Don't push for expiration
  });
};

// Send push notification to a single user
export const sendPushToUser = async (
  userId: string,
  config: BroadcastConfig
): Promise<boolean> => {
  try {
    const { tokens, error: tokensError } = await getUserPushTokens(userId);

    if (tokensError || tokens.length === 0) {
      return false;
    }

    const { error: invokeError } = await supabase.functions.invoke('send-push-notification', {
      body: {
        tokens,
        title: config.title,
        body: config.message,
        data: {
          type: config.type,
          ...config.data,
          userId,
          timestamp: Date.now(),
        },
      },
    });

    if (invokeError) {
      console.error('Push notification error:', invokeError);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Push notification exception:', err);
    return false;
  }
};

// Send push notification to multiple users
export const sendPushToUsers = async (
  userIds: string[],
  config: BroadcastConfig
): Promise<{ sent: number; failed: number }> => {
  let sent = 0;
  let failed = 0;

  const promises = userIds.map(async (userId) => {
    const success = await sendPushToUser(userId, config);
    if (success) {
      sent++;
    } else {
      failed++;
    }
  });

  await Promise.all(promises);

  return { sent, failed };
};

// Subscribe to real-time notifications for a user
export const subscribeToNotifications = (
  userId: string,
  onNotification: (notification: DBNotification) => void
) => {
  const channel = supabase
    .channel(`user-notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'bb_notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        if (payload.new) {
          onNotification(payload.new as DBNotification);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

// Get notification statistics for a user
export const getNotificationStats = async (userId: string): Promise<{
  total: number;
  unread: number;
  byType: Record<string, number>;
  error: string | null;
}> => {
  const { data, error } = await supabase
    .from('bb_notifications')
    .select('type, read')
    .eq('user_id', userId);

  if (error) {
    return { total: 0, unread: 0, byType: {}, error: error.message };
  }

  const total = data?.length || 0;
  const unread = data?.filter(n => !n.read).length || 0;
  const byType: Record<string, number> = {};

  (data || []).forEach(n => {
    byType[n.type] = (byType[n.type] || 0) + 1;
  });

  return { total, unread, byType, error: null };
};

// Clear all notifications for a user
export const clearAllNotifications = async (userId: string): Promise<{
  deletedCount: number;
  error: string | null;
}> => {
  const { data, error } = await supabase
    .from('bb_notifications')
    .delete()
    .eq('user_id', userId)
    .select();

  return {
    deletedCount: data?.length || 0,
    error: error?.message || null,
  };
};
