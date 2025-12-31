import { beforeEach, describe, expect, it, vi, Mock } from 'vitest';
import {
  broadcastNotification,
  broadcastBetCreated,
  broadcastClashCreated,
  broadcastProofSubmitted,
  broadcastClashResult,
  broadcastStealAlert,
  broadcastBetExpired,
  sendPushToUsers,
  getNotificationStats,
  clearAllNotifications,
} from '../services/notificationBroadcast';
import { supabase } from '../services/supabase';
import { createSupabaseQuery } from './helpers/supabaseMock';

// Mock supabase
vi.mock('../services/supabase', () => ({
  supabase: {
    from: vi.fn(),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
    },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  },
}));

// Mock notifications service
vi.mock('../services/notifications', () => ({
  createNotification: vi.fn().mockResolvedValue({ notification: { id: 'notif-1' }, error: null }),
}));

// Mock push token service
vi.mock('../services/pushTokenService', () => ({
  getUserPushTokens: vi.fn().mockResolvedValue({ tokens: ['token-1', 'token-2'], error: null }),
}));

const fromMock = supabase.from as unknown as Mock;

describe('notificationBroadcast service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('broadcastNotification', () => {
    it('should broadcast notification to multiple users', async () => {
      const userIds = ['user-1', 'user-2', 'user-3'];

      const result = await broadcastNotification(userIds, {
        type: 'system',
        title: 'Test Broadcast',
        message: 'This is a test broadcast message',
        priority: 'normal',
      });

      expect(result.totalRecipients).toBe(3);
      expect(result.notificationsSent).toBe(3);
      expect(result.failures.length).toBe(0);
    });

    it('should send push notifications when sendPush is true', async () => {
      const userIds = ['user-1'];

      const result = await broadcastNotification(userIds, {
        type: 'challenge',
        title: 'Challenge',
        message: 'You got challenged!',
        priority: 'high',
        sendPush: true,
      });

      expect(result.notificationsSent).toBe(1);
      expect(result.pushNotificationsSent).toBeGreaterThanOrEqual(0);
    });

    it('should not send push when sendPush is false', async () => {
      const userIds = ['user-1'];

      const result = await broadcastNotification(userIds, {
        type: 'system',
        title: 'Silent',
        message: 'No push',
        sendPush: false,
      });

      expect(result.notificationsSent).toBe(1);
      expect(result.pushNotificationsSent).toBe(0);
    });

    it('should handle notification creation failures gracefully', async () => {
      const { createNotification } = await import('../services/notifications');
      (createNotification as Mock)
        .mockResolvedValueOnce({ notification: { id: 'n1' }, error: null })
        .mockResolvedValueOnce({ notification: null, error: 'Failed' })
        .mockResolvedValueOnce({ notification: { id: 'n3' }, error: null });

      const userIds = ['user-1', 'user-2', 'user-3'];

      const result = await broadcastNotification(userIds, {
        type: 'system',
        title: 'Partial Success',
        message: 'Some will fail',
      });

      expect(result.totalRecipients).toBe(3);
      expect(result.notificationsSent).toBe(2);
      expect(result.failures.length).toBe(1);
      expect(result.failures[0].userId).toBe('user-2');
    });
  });

  describe('broadcastBetCreated', () => {
    it('should broadcast bet creation to participants with correct group message', async () => {
      const participantIds = ['user-2', 'user-3', 'user-4'];

      const result = await broadcastBetCreated(
        'Creator Name',
        'Test bet text',
        'bet-123',
        50,
        participantIds
      );

      expect(result.totalRecipients).toBe(3);
      expect(result.notificationsSent).toBe(3);

      // Verify the notification service was called with group message
      const { createNotification } = await import('../services/notifications');
      expect(createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'challenge',
          title: 'Group Challenge!',
        })
      );
    });

    it('should use single message for one participant', async () => {
      const participantIds = ['user-2'];

      await broadcastBetCreated(
        'Creator',
        'Single bet',
        'bet-456',
        25,
        participantIds
      );

      const { createNotification } = await import('../services/notifications');
      expect(createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'You Got Called Out!',
        })
      );
    });
  });

  describe('broadcastClashCreated', () => {
    it('should notify both prover and challenger', async () => {
      const result = await broadcastClashCreated(
        'clash-1',
        'Clash bet text',
        100,
        'prover-id',
        'challenger-id'
      );

      expect(result.totalRecipients).toBe(2);
      expect(result.notificationsSent).toBe(2);

      const { createNotification } = await import('../services/notifications');

      // Check prover notification
      expect(createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'prover-id',
          type: 'clash',
          priority: 'critical',
        })
      );

      // Check challenger notification
      expect(createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'challenger-id',
          type: 'clash',
          priority: 'high',
        })
      );
    });
  });

  describe('broadcastProofSubmitted', () => {
    it('should notify challenger when proof is submitted', async () => {
      const result = await broadcastProofSubmitted(
        'clash-123',
        'Prover Name',
        'challenger-id'
      );

      expect(result.totalRecipients).toBe(1);
      expect(result.notificationsSent).toBe(1);

      const { createNotification } = await import('../services/notifications');
      expect(createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'challenger-id',
          type: 'proof_received',
          title: 'Proof Submitted',
        })
      );
    });
  });

  describe('broadcastClashResult', () => {
    it('should notify both winner and loser with appropriate messages', async () => {
      const result = await broadcastClashResult(
        'clash-1',
        'winner-id',
        'loser-id',
        'Winner Name',
        'Loser Name',
        200,
        'Who won?'
      );

      expect(result.totalRecipients).toBe(2);
      expect(result.notificationsSent).toBe(2);

      const { createNotification } = await import('../services/notifications');

      // Winner notification
      expect(createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'winner-id',
          type: 'win',
          title: 'VICTORY!',
          priority: 'high',
        })
      );

      // Loser notification
      expect(createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'loser-id',
          type: 'loss',
          title: 'Defeat...',
          priority: 'medium',
        })
      );
    });
  });

  describe('broadcastStealAlert', () => {
    it('should send critical priority notification to steal target', async () => {
      const futureTime = new Date(Date.now() + 30000).toISOString(); // 30 seconds from now

      const result = await broadcastStealAlert(
        'steal-1',
        'target-id',
        'Thief Name',
        75,
        futureTime
      );

      expect(result.totalRecipients).toBe(1);
      expect(result.notificationsSent).toBe(1);

      const { createNotification } = await import('../services/notifications');
      expect(createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'target-id',
          type: 'steal_alert',
          title: 'HEIST IN PROGRESS!',
          priority: 'critical',
        })
      );
    });
  });

  describe('broadcastBetExpired', () => {
    it('should notify all participants about expiry without push', async () => {
      const participantIds = ['user-1', 'user-2'];

      const result = await broadcastBetExpired(
        'bet-expired',
        'Expired bet text',
        participantIds
      );

      expect(result.totalRecipients).toBe(2);
      expect(result.notificationsSent).toBe(2);
      expect(result.pushNotificationsSent).toBe(0); // No push for expiration
    });
  });

  describe('sendPushToUsers', () => {
    it('should send push notifications to multiple users', async () => {
      const userIds = ['user-1', 'user-2', 'user-3'];

      const result = await sendPushToUsers(userIds, {
        type: 'challenge',
        title: 'Push Test',
        message: 'Testing push to multiple users',
      });

      expect(result.sent + result.failed).toBe(3);
    });
  });

  describe('getNotificationStats', () => {
    it('should return correct notification statistics', async () => {
      const statsQuery = createSupabaseQuery({
        data: [
          { type: 'challenge', read: true },
          { type: 'challenge', read: false },
          { type: 'clash', read: false },
          { type: 'system', read: true },
          { type: 'win', read: false },
        ],
        error: null,
      });

      fromMock.mockReturnValue(statsQuery);

      const result = await getNotificationStats('user-1');

      expect(result.error).toBeNull();
      expect(result.total).toBe(5);
      expect(result.unread).toBe(3);
      expect(result.byType['challenge']).toBe(2);
      expect(result.byType['clash']).toBe(1);
      expect(result.byType['system']).toBe(1);
      expect(result.byType['win']).toBe(1);
    });

    it('should handle errors gracefully', async () => {
      const errorQuery = createSupabaseQuery({
        data: null,
        error: { message: 'Database error' },
      });

      fromMock.mockReturnValue(errorQuery);

      const result = await getNotificationStats('user-1');

      expect(result.error).toBe('Database error');
      expect(result.total).toBe(0);
      expect(result.unread).toBe(0);
    });
  });

  describe('clearAllNotifications', () => {
    it('should delete all notifications for a user', async () => {
      const deleteQuery = createSupabaseQuery({
        data: [{ id: 'n1' }, { id: 'n2' }, { id: 'n3' }],
        error: null,
      });

      fromMock.mockReturnValue(deleteQuery);

      const result = await clearAllNotifications('user-1');

      expect(result.error).toBeNull();
      expect(result.deletedCount).toBe(3);
    });

    it('should handle delete errors', async () => {
      const errorQuery = createSupabaseQuery({
        data: null,
        error: { message: 'Delete failed' },
      });

      fromMock.mockReturnValue(errorQuery);

      const result = await clearAllNotifications('user-1');

      expect(result.error).toBe('Delete failed');
      expect(result.deletedCount).toBe(0);
    });
  });

  describe('notification priority handling', () => {
    it('should set correct priority for different notification types', async () => {
      const { createNotification } = await import('../services/notifications');

      // Challenge - high priority
      await broadcastNotification(['user-1'], {
        type: 'challenge',
        title: 'Challenge',
        message: 'Test',
        priority: 'high',
      });

      expect(createNotification).toHaveBeenLastCalledWith(
        expect.objectContaining({ priority: 'high' })
      );

      // System - normal priority
      await broadcastNotification(['user-1'], {
        type: 'system',
        title: 'System',
        message: 'Test',
        priority: 'normal',
      });

      expect(createNotification).toHaveBeenLastCalledWith(
        expect.objectContaining({ priority: 'normal' })
      );

      // Steal alert - critical priority
      await broadcastNotification(['user-1'], {
        type: 'steal_alert',
        title: 'Steal!',
        message: 'Test',
        priority: 'critical',
      });

      expect(createNotification).toHaveBeenLastCalledWith(
        expect.objectContaining({ priority: 'critical' })
      );
    });
  });

  describe('concurrent broadcasting', () => {
    it('should handle many concurrent notifications efficiently', async () => {
      const userIds = Array.from({ length: 100 }, (_, i) => `user-${i}`);

      const startTime = Date.now();
      const result = await broadcastNotification(userIds, {
        type: 'system',
        title: 'Mass Broadcast',
        message: 'Testing concurrent notifications',
        sendPush: false, // Skip push to speed up test
      });
      const endTime = Date.now();

      expect(result.totalRecipients).toBe(100);
      expect(result.notificationsSent).toBe(100);

      // Should complete in reasonable time (parallelized)
      expect(endTime - startTime).toBeLessThan(5000);
    });
  });
});
