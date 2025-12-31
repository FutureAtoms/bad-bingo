import { supabase } from './supabase';
import type { DBNotification } from '../types/database';

// Get user's notifications
export const getNotifications = async (
  userId: string,
  limit: number = 50,
  unreadOnly: boolean = false
): Promise<{ notifications: DBNotification[]; error: string | null }> => {
  let query = supabase
    .from('bb_notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (unreadOnly) {
    query = query.eq('read', false);
  }

  const { data, error } = await query;

  return { notifications: data || [], error: error?.message || null };
};

// Get unread notification count
export const getUnreadCount = async (userId: string): Promise<{
  count: number;
  error: string | null;
}> => {
  const { count, error } = await supabase
    .from('bb_notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);

  return { count: count || 0, error: error?.message || null };
};

// Mark notification as read
export const markAsRead = async (notificationId: string): Promise<{
  success: boolean;
  error: string | null;
}> => {
  const { error } = await supabase
    .from('bb_notifications')
    .update({
      read: true,
      read_at: new Date().toISOString(),
    })
    .eq('id', notificationId);

  return { success: !error, error: error?.message || null };
};

// Mark all notifications as read
export const markAllAsRead = async (userId: string): Promise<{
  success: boolean;
  error: string | null;
}> => {
  const { error } = await supabase
    .from('bb_notifications')
    .update({
      read: true,
      read_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('read', false);

  return { success: !error, error: error?.message || null };
};

// Create notification
export const createNotification = async (notification: {
  userId: string;
  type: string;
  title: string;
  message: string;
  priority?: 'critical' | 'high' | 'medium' | 'normal';
  referenceType?: string;
  referenceId?: string;
}): Promise<{ notification: DBNotification | null; error: string | null }> => {
  const { data, error } = await supabase
    .from('bb_notifications')
    .insert({
      user_id: notification.userId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      priority: notification.priority || 'normal',
      reference_type: notification.referenceType || null,
      reference_id: notification.referenceId || null,
    })
    .select()
    .single();

  return { notification: data, error: error?.message || null };
};

// Delete notification
export const deleteNotification = async (notificationId: string): Promise<{
  success: boolean;
  error: string | null;
}> => {
  const { error } = await supabase
    .from('bb_notifications')
    .delete()
    .eq('id', notificationId);

  return { success: !error, error: error?.message || null };
};

// Clear old notifications (older than 30 days)
export const clearOldNotifications = async (userId: string): Promise<{
  deletedCount: number;
  error: string | null;
}> => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('bb_notifications')
    .delete()
    .eq('user_id', userId)
    .lt('created_at', thirtyDaysAgo)
    .select();

  return { deletedCount: data?.length || 0, error: error?.message || null };
};

// Subscribe to real-time notifications
export const subscribeToNotifications = (
  userId: string,
  onNotification: (notification: DBNotification) => void
) => {
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'bb_notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        onNotification(payload.new as DBNotification);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

// Subscribe to steal alerts (critical priority)
export const subscribeToStealAlerts = (
  userId: string,
  onStealAlert: (steal: { stealId: string; thiefName: string; amount: number; windowEnd: string }) => void
) => {
  const channel = supabase
    .channel(`steals:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'bb_steals',
        filter: `target_id=eq.${userId}`,
      },
      async (payload) => {
        const steal = payload.new;
        if (steal.target_was_online && steal.defense_window_end) {
          // Get thief info
          const { data: thief } = await supabase
            .from('bb_users')
            .select('name')
            .eq('id', steal.thief_id)
            .single();

          onStealAlert({
            stealId: steal.id,
            thiefName: thief?.name || 'Unknown',
            amount: steal.potential_amount,
            windowEnd: steal.defense_window_end,
          });
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};
