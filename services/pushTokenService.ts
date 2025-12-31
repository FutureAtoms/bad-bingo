import { supabase } from './supabase';
import { logDebug, logError } from '../utils/logger';

// Save or update push token for a user
export const savePushToken = async (
  userId: string,
  token: string,
  platform: 'android' | 'ios' = 'android',
  deviceId?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Upsert - if token exists, update it; otherwise insert
    const { error } = await supabase
      .from('bb_push_tokens')
      .upsert(
        {
          user_id: userId,
          token: token,
          platform: platform,
          device_id: deviceId || null,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'token',
        }
      );

    if (error) {
      logError('Error saving push token');
      return { success: false, error: error.message };
    }

    logDebug('Push token saved successfully');
    return { success: true };
  } catch (err) {
    logError('Exception saving push token');
    return { success: false, error: String(err) };
  }
};

// Get all active push tokens for a user
export const getUserPushTokens = async (
  userId: string
): Promise<{ tokens: string[]; error?: string }> => {
  try {
    const { data, error } = await supabase
      .from('bb_push_tokens')
      .select('token')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) {
      return { tokens: [], error: error.message };
    }

    return { tokens: data?.map((t) => t.token) || [] };
  } catch (err) {
    return { tokens: [], error: String(err) };
  }
};

// Deactivate a specific token (e.g., on logout)
export const deactivatePushToken = async (
  token: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('bb_push_tokens')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('token', token);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
};

// Deactivate all tokens for a user (e.g., on logout from all devices)
export const deactivateAllUserTokens = async (
  userId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('bb_push_tokens')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('user_id', userId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
};

// Delete old/inactive tokens (cleanup)
export const cleanupOldTokens = async (
  daysOld: number = 30
): Promise<{ deletedCount: number; error?: string }> => {
  try {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('bb_push_tokens')
      .delete()
      .eq('is_active', false)
      .lt('updated_at', cutoffDate)
      .select();

    if (error) {
      return { deletedCount: 0, error: error.message };
    }

    return { deletedCount: data?.length || 0 };
  } catch (err) {
    return { deletedCount: 0, error: String(err) };
  }
};
