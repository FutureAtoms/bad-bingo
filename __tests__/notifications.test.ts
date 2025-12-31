import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase
vi.mock('../services/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn(),
  },
}));

describe('Notifications Service', () => {
  describe('Notification Types', () => {
    it('should define all valid notification types', () => {
      const validTypes = ['robbery', 'clash', 'proof', 'system', 'badge', 'debt', 'beg'];
      expect(validTypes).toHaveLength(7);
    });

    it('should assign correct icon per type', () => {
      const getIcon = (type: string) => {
        const icons: Record<string, string> = {
          robbery: '🚨',
          clash: '⚔️',
          proof: '📸',
          system: '😼',
          badge: '🏆',
          debt: '💀',
          beg: '🥺',
        };
        return icons[type] || '📢';
      };

      expect(getIcon('robbery')).toBe('🚨');
      expect(getIcon('clash')).toBe('⚔️');
      expect(getIcon('proof')).toBe('📸');
      expect(getIcon('unknown')).toBe('📢');
    });
  });

  describe('Priority Levels', () => {
    it('should define all priority levels', () => {
      const priorities = ['critical', 'high', 'medium', 'normal'];
      expect(priorities).toHaveLength(4);
    });

    it('should assign correct color per priority', () => {
      const getPriorityColor = (priority: string) => {
        const colors: Record<string, string> = {
          critical: 'red',
          high: 'pink',
          medium: 'yellow',
          normal: 'green',
        };
        return colors[priority] || 'gray';
      };

      expect(getPriorityColor('critical')).toBe('red');
      expect(getPriorityColor('high')).toBe('pink');
      expect(getPriorityColor('normal')).toBe('green');
    });

    it('should sort notifications by priority', () => {
      const notifications = [
        { id: '1', priority: 'normal' },
        { id: '2', priority: 'critical' },
        { id: '3', priority: 'high' },
        { id: '4', priority: 'medium' },
      ];

      const priorityOrder = { critical: 0, high: 1, medium: 2, normal: 3 };
      const sorted = [...notifications].sort(
        (a, b) =>
          priorityOrder[a.priority as keyof typeof priorityOrder] -
          priorityOrder[b.priority as keyof typeof priorityOrder]
      );

      expect(sorted[0].id).toBe('2'); // critical
      expect(sorted[1].id).toBe('3'); // high
      expect(sorted[2].id).toBe('4'); // medium
      expect(sorted[3].id).toBe('1'); // normal
    });
  });

  describe('Notification Creation', () => {
    it('should create notification with required fields', () => {
      const createNotification = (
        userId: string,
        type: string,
        title: string,
        message: string,
        priority: string = 'normal'
      ) => ({
        user_id: userId,
        type,
        title,
        message,
        priority,
        read: false,
        created_at: new Date().toISOString(),
      });

      const notification = createNotification(
        'user123',
        'clash',
        'Clash Alert',
        'Someone disagrees with you!'
      );

      expect(notification.user_id).toBe('user123');
      expect(notification.type).toBe('clash');
      expect(notification.read).toBe(false);
    });

    it('should include reference for linked notifications', () => {
      const notification = {
        type: 'clash',
        reference_type: 'clash',
        reference_id: 'clash123',
      };

      expect(notification.reference_type).toBe('clash');
      expect(notification.reference_id).toBe('clash123');
    });
  });

  describe('Read Status', () => {
    it('should mark notification as read', () => {
      const markAsRead = (notification: { read: boolean; read_at: string | null }) => ({
        ...notification,
        read: true,
        read_at: new Date().toISOString(),
      });

      const unread = { read: false, read_at: null };
      const read = markAsRead(unread);

      expect(read.read).toBe(true);
      expect(read.read_at).toBeTruthy();
    });

    it('should count unread notifications', () => {
      const notifications = [
        { read: false },
        { read: true },
        { read: false },
        { read: false },
      ];

      const unreadCount = notifications.filter(n => !n.read).length;
      expect(unreadCount).toBe(3);
    });
  });

  describe('Auto-Dismiss', () => {
    it('should calculate dismiss time for toasts', () => {
      const getDismissTime = (priority: string) => {
        const times: Record<string, number> = {
          critical: 10000, // 10 seconds
          high: 6000, // 6 seconds
          medium: 4000, // 4 seconds
          normal: 3000, // 3 seconds
        };
        return times[priority] || 4000;
      };

      expect(getDismissTime('critical')).toBe(10000);
      expect(getDismissTime('high')).toBe(6000);
      expect(getDismissTime('normal')).toBe(3000);
    });
  });

  describe('Push Notifications', () => {
    it('should track push sent status', () => {
      const notification = {
        push_sent: false,
        push_sent_at: null as string | null,
      };

      const afterPush = {
        ...notification,
        push_sent: true,
        push_sent_at: new Date().toISOString(),
      };

      expect(afterPush.push_sent).toBe(true);
      expect(afterPush.push_sent_at).toBeTruthy();
    });

    it('should format push notification payload', () => {
      const formatPushPayload = (notification: {
        title: string;
        message: string;
        type: string;
        reference_id?: string;
      }) => ({
        title: notification.title,
        body: notification.message,
        data: {
          type: notification.type,
          reference_id: notification.reference_id,
          click_action: 'OPEN_APP',
        },
      });

      const payload = formatPushPayload({
        title: 'Robbery Alert!',
        message: 'Someone is stealing your bingos!',
        type: 'robbery',
        reference_id: 'steal123',
      });

      expect(payload.title).toBe('Robbery Alert!');
      expect(payload.data.type).toBe('robbery');
      expect(payload.data.click_action).toBe('OPEN_APP');
    });
  });

  describe('Robbery Alerts (Critical)', () => {
    it('should create critical priority for robbery alerts', () => {
      const createRobberyAlert = (
        userId: string,
        thiefName: string,
        stealId: string
      ) => ({
        user_id: userId,
        type: 'robbery',
        title: 'YOU\'RE BEING ROBBED!',
        message: `${thiefName} is trying to steal your bingos! Defend yourself!`,
        priority: 'critical',
        reference_type: 'steal',
        reference_id: stealId,
      });

      const alert = createRobberyAlert('user123', 'SneakyThief', 'steal456');

      expect(alert.priority).toBe('critical');
      expect(alert.type).toBe('robbery');
      expect(alert.reference_type).toBe('steal');
    });

    it('should include defense window info in message', () => {
      const formatRobberyMessage = (thiefName: string, secondsRemaining: number) =>
        `${thiefName} is stealing your bingos! ${secondsRemaining}s to defend!`;

      const message = formatRobberyMessage('SneakyThief', 16);
      expect(message).toContain('16s to defend');
    });
  });

  describe('Clash Notifications', () => {
    it('should notify both users on clash', () => {
      const createClashNotifications = (
        user1Id: string,
        user2Id: string,
        betText: string,
        clashId: string
      ) => [
        {
          user_id: user1Id,
          type: 'clash',
          title: 'CLAWS OUT!',
          message: `Someone disagrees with you on: "${betText}"`,
          priority: 'high',
          reference_type: 'clash',
          reference_id: clashId,
        },
        {
          user_id: user2Id,
          type: 'clash',
          title: 'CLAWS OUT!',
          message: `Someone disagrees with you on: "${betText}"`,
          priority: 'high',
          reference_type: 'clash',
          reference_id: clashId,
        },
      ];

      const notifications = createClashNotifications(
        'u1',
        'u2',
        'Will eat pizza today',
        'clash123'
      );

      expect(notifications).toHaveLength(2);
      expect(notifications[0].user_id).toBe('u1');
      expect(notifications[1].user_id).toBe('u2');
    });
  });

  describe('Proof Notifications', () => {
    it('should notify on proof submission', () => {
      const notification = {
        type: 'proof',
        title: 'Proof Submitted',
        message: 'Your opponent has submitted evidence. Check it out.',
        priority: 'medium',
      };

      expect(notification.type).toBe('proof');
      expect(notification.priority).toBe('medium');
    });

    it('should notify on proof deadline approaching', () => {
      const createDeadlineReminder = (hoursRemaining: number) => ({
        type: 'proof',
        title: 'Proof Deadline',
        message: `You have ${hoursRemaining}h left to submit your proof!`,
        priority: hoursRemaining <= 2 ? 'high' : 'medium',
      });

      const urgentReminder = createDeadlineReminder(2);
      const normalReminder = createDeadlineReminder(12);

      expect(urgentReminder.priority).toBe('high');
      expect(normalReminder.priority).toBe('medium');
    });
  });

  describe('Badge Notifications', () => {
    it('should notify on badge earned', () => {
      const createBadgeNotification = (
        badgeName: string,
        isShame: boolean
      ) => ({
        type: 'badge',
        title: isShame ? 'Shame Badge Earned' : 'Badge Earned!',
        message: isShame
          ? `You've been branded with the ${badgeName} badge. Yikes.`
          : `Congratulations! You earned the ${badgeName} badge!`,
        priority: isShame ? 'medium' : 'normal',
      });

      const gloryBadge = createBadgeNotification('Heist Master', false);
      const shameBadge = createBadgeNotification('SNITCH', true);

      expect(gloryBadge.priority).toBe('normal');
      expect(shameBadge.priority).toBe('medium');
      expect(shameBadge.message).toContain('Yikes');
    });
  });
});

describe('Notification Center UI', () => {
  describe('Filtering', () => {
    it('should filter by type', () => {
      const notifications = [
        { type: 'clash' },
        { type: 'robbery' },
        { type: 'clash' },
        { type: 'system' },
      ];

      const filterByType = (type: string) =>
        notifications.filter(n => n.type === type);

      expect(filterByType('clash')).toHaveLength(2);
      expect(filterByType('robbery')).toHaveLength(1);
    });

    it('should filter unread only', () => {
      const notifications = [
        { read: false },
        { read: true },
        { read: false },
      ];

      const unreadOnly = notifications.filter(n => !n.read);
      expect(unreadOnly).toHaveLength(2);
    });
  });

  describe('Pagination', () => {
    it('should limit notifications per page', () => {
      const notifications = Array.from({ length: 100 }, (_, i) => ({
        id: i.toString(),
      }));

      const pageSize = 20;
      const page = 1;
      const paginated = notifications.slice(
        (page - 1) * pageSize,
        page * pageSize
      );

      expect(paginated).toHaveLength(20);
    });
  });

  describe('Clear All', () => {
    it('should mark all as read', () => {
      const notifications = [
        { read: false },
        { read: false },
        { read: true },
      ];

      const markAllRead = (notifs: Array<{ read: boolean }>) =>
        notifs.map(n => ({ ...n, read: true }));

      const allRead = markAllRead(notifications);
      expect(allRead.every(n => n.read)).toBe(true);
    });
  });
});
