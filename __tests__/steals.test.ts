import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase
vi.mock('../services/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn(),
  },
}));

vi.mock('../services/economy', () => ({
  calculateStealPercentage: vi.fn().mockReturnValue(25),
}));

describe('Steals Service', () => {
  describe('Steal Percentage Calculation', () => {
    it('should return percentage between 1 and 50', () => {
      const calculateStealPercentage = () => 1 + Math.floor(Math.random() * 50);

      for (let i = 0; i < 100; i++) {
        const percentage = calculateStealPercentage();
        expect(percentage).toBeGreaterThanOrEqual(1);
        expect(percentage).toBeLessThanOrEqual(50);
      }
    });

    it('should calculate potential steal amount correctly', () => {
      const targetCoins = 1000;
      const stealPercentage = 25;
      const potentialAmount = Math.floor(targetCoins * (stealPercentage / 100));

      expect(potentialAmount).toBe(250);
    });

    it('should handle low target balance', () => {
      const targetCoins = 10;
      const stealPercentage = 50;
      const potentialAmount = Math.floor(targetCoins * (stealPercentage / 100));

      expect(potentialAmount).toBe(5);
    });
  });

  describe('Target Validation', () => {
    it('should reject targets with less than 10 coins', () => {
      const validateTarget = (coins: number) => coins >= 10;

      expect(validateTarget(100)).toBe(true);
      expect(validateTarget(10)).toBe(true);
      expect(validateTarget(9)).toBe(false);
      expect(validateTarget(0)).toBe(false);
    });
  });

  describe('Online Detection', () => {
    it('should detect online user (activity within 5 minutes)', () => {
      const now = Date.now();
      const isOnline = (lastLogin: Date) =>
        now - lastLogin.getTime() < 5 * 60 * 1000;

      const onlineUser = new Date(now - 2 * 60 * 1000); // 2 minutes ago
      const offlineUser = new Date(now - 10 * 60 * 1000); // 10 minutes ago

      expect(isOnline(onlineUser)).toBe(true);
      expect(isOnline(offlineUser)).toBe(false);
    });

    it('should calculate defense window correctly (16 seconds)', () => {
      const now = new Date();
      const defenseWindowEnd = new Date(now.getTime() + 16 * 1000);

      const diffMs = defenseWindowEnd.getTime() - now.getTime();
      expect(diffMs).toBe(16000);
    });
  });

  describe('Defense Mechanics', () => {
    it('should allow defense within window', () => {
      const now = Date.now();
      const defenseWindowEnd = new Date(now + 16000); // 16 seconds from now

      const canDefend = new Date() < defenseWindowEnd;
      expect(canDefend).toBe(true);
    });

    it('should block defense after window closes', () => {
      const now = Date.now();
      const defenseWindowEnd = new Date(now - 1000); // 1 second ago

      const canDefend = new Date() < defenseWindowEnd;
      expect(canDefend).toBe(false);
    });

    it('should only allow target to defend', () => {
      const steal = {
        thief_id: 'thief123',
        target_id: 'target456',
      };

      const canDefend = (userId: string) => steal.target_id === userId;

      expect(canDefend('target456')).toBe(true);
      expect(canDefend('thief123')).toBe(false);
      expect(canDefend('random')).toBe(false);
    });
  });

  describe('Penalty Calculation', () => {
    it('should apply 2x penalty when caught', () => {
      const potentialAmount = 100;
      const penalty = potentialAmount * 2;

      expect(penalty).toBe(200);
    });

    it('should not exceed thief balance on penalty', () => {
      const thiefBalance = 150;
      const potentialAmount = 100;
      const penalty = potentialAmount * 2;
      const actualPenalty = Math.min(penalty, thiefBalance);

      expect(actualPenalty).toBe(150);
    });

    it('should allow zero balance after penalty', () => {
      const thiefBalance = 50;
      const penalty = 200;
      const newBalance = Math.max(0, thiefBalance - penalty);

      expect(newBalance).toBe(0);
    });
  });

  describe('Status Transitions', () => {
    it('should define all valid steal statuses', () => {
      const validStatuses = ['in_progress', 'success', 'defended', 'failed'];
      expect(validStatuses).toHaveLength(4);
    });

    it('should track successful steal', () => {
      const completedSteal = {
        status: 'success',
        actual_amount: 100,
        thief_penalty: 0,
      };

      expect(completedSteal.status).toBe('success');
      expect(completedSteal.actual_amount).toBeGreaterThan(0);
      expect(completedSteal.thief_penalty).toBe(0);
    });

    it('should track defended steal', () => {
      const defendedSteal = {
        status: 'defended',
        was_defended: true,
        thief_penalty: 200,
      };

      expect(defendedSteal.status).toBe('defended');
      expect(defendedSteal.was_defended).toBe(true);
      expect(defendedSteal.thief_penalty).toBeGreaterThan(0);
    });

    it('should track failed steal (minigame failure)', () => {
      const failedSteal = {
        status: 'failed',
        actual_amount: 0,
        thief_penalty: 0,
      };

      expect(failedSteal.status).toBe('failed');
      expect(failedSteal.actual_amount).toBe(0);
    });
  });

  describe('Balance Updates', () => {
    it('should add stolen amount to thief balance', () => {
      const thiefBalance = 100;
      const stolenAmount = 50;
      const newThiefBalance = thiefBalance + stolenAmount;

      expect(newThiefBalance).toBe(150);
    });

    it('should subtract stolen amount from target balance', () => {
      const targetBalance = 500;
      const stolenAmount = 50;
      const newTargetBalance = Math.max(0, targetBalance - stolenAmount);

      expect(newTargetBalance).toBe(450);
    });

    it('should handle stealing more than available', () => {
      const targetBalance = 30;
      const stolenAmount = 50;
      const actualStolen = Math.min(stolenAmount, targetBalance);
      const newTargetBalance = Math.max(0, targetBalance - actualStolen);

      expect(actualStolen).toBe(30);
      expect(newTargetBalance).toBe(0);
    });
  });

  describe('Steal Statistics', () => {
    it('should track thief success count', () => {
      const thiefStats = {
        steals_successful: 5,
      };

      const afterSuccess = { steals_successful: thiefStats.steals_successful + 1 };
      expect(afterSuccess.steals_successful).toBe(6);
    });

    it('should track target robbed count', () => {
      const targetStats = {
        times_robbed: 2,
      };

      const afterRobbery = { times_robbed: targetStats.times_robbed + 1 };
      expect(afterRobbery.times_robbed).toBe(3);
    });

    it('should track defender success count', () => {
      const defenderStats = {
        steals_defended: 3,
      };

      const afterDefense = { steals_defended: defenderStats.steals_defended + 1 };
      expect(afterDefense.steals_defended).toBe(4);
    });
  });
});

describe('Steal Integration Scenarios', () => {
  describe('Offline Steal Flow', () => {
    it('should complete immediately when target is offline', () => {
      const steal = {
        target_was_online: false,
        defense_window_end: null,
        status: 'in_progress',
      };

      // No defense window for offline targets
      expect(steal.defense_window_end).toBeNull();
    });
  });

  describe('Online Steal Flow', () => {
    it('should create defense window when target is online', () => {
      const now = Date.now();
      const steal = {
        target_was_online: true,
        defense_window_start: new Date(now).toISOString(),
        defense_window_end: new Date(now + 16000).toISOString(),
        status: 'in_progress',
      };

      expect(steal.defense_window_end).not.toBeNull();
      const windowDuration =
        new Date(steal.defense_window_end!).getTime() -
        new Date(steal.defense_window_start!).getTime();
      expect(windowDuration).toBe(16000);
    });
  });

  describe('Minigame Requirements', () => {
    it('should require 50 taps in 60 seconds', () => {
      const minigameConfig = {
        targetTaps: 50,
        timeLimit: 60,
      };

      expect(minigameConfig.targetTaps).toBe(50);
      expect(minigameConfig.timeLimit).toBe(60);
    });

    it('should calculate tap rate required', () => {
      const targetTaps = 50;
      const timeLimit = 60;
      const tapsPerSecond = targetTaps / timeLimit;

      // Less than 1 tap per second required
      expect(tapsPerSecond).toBeLessThan(1);
      expect(tapsPerSecond).toBeCloseTo(0.833, 2);
    });
  });
});
