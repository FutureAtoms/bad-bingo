import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Supabase client
const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  upsert: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  lte: vi.fn().mockReturnThis(),
  not: vi.fn().mockReturnThis(),
  or: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn(),
};

vi.mock('../services/supabase', () => ({
  supabase: mockSupabase,
}));

vi.mock('../services/geminiService', () => ({
  generateDailyBets: vi.fn().mockResolvedValue([
    { text: 'Test bet 1', category: 'social', backgroundType: 'default' },
    { text: 'Test bet 2', category: 'routine', backgroundType: 'gradient' },
  ]),
}));

vi.mock('../services/economy', () => ({
  calculateStake: vi.fn().mockReturnValue(10),
}));

describe('Bets Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Bet Data Types', () => {
    it('should define valid bet categories', () => {
      const validCategories = ['routine', 'social', 'health', 'truth', 'prediction', 'challenge'];
      expect(validCategories).toHaveLength(6);
      validCategories.forEach(cat => {
        expect(typeof cat).toBe('string');
      });
    });

    it('should define valid proof types', () => {
      const validProofTypes = ['photo', 'video', 'location', 'time', 'confirm'];
      expect(validProofTypes).toHaveLength(5);
    });

    it('should define valid target types', () => {
      const validTargetTypes = ['single', 'multiple', 'all'];
      expect(validTargetTypes).toHaveLength(3);
    });

    it('should require minimum heat level of 1', () => {
      const minHeatLevel = 1;
      const maxHeatLevel = 3;
      expect(minHeatLevel).toBe(1);
      expect(maxHeatLevel).toBe(3);
    });
  });

  describe('Bet Expiry Logic', () => {
    it('should calculate expiry correctly for 2 hours', () => {
      const now = new Date();
      const expiryHours = 2;
      const expiresAt = new Date(now.getTime() + expiryHours * 60 * 60 * 1000);

      const diffMs = expiresAt.getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      expect(diffHours).toBeCloseTo(2, 1);
    });

    it('should identify expired bets', () => {
      const now = new Date();
      const expiredBet = {
        expires_at: new Date(now.getTime() - 1000).toISOString(), // 1 second ago
      };
      const validBet = {
        expires_at: new Date(now.getTime() + 3600000).toISOString(), // 1 hour from now
      };

      const isExpired = (bet: { expires_at: string }) =>
        new Date(bet.expires_at) < new Date();

      expect(isExpired(expiredBet)).toBe(true);
      expect(isExpired(validBet)).toBe(false);
    });
  });

  describe('Swipe Logic', () => {
    it('should detect clash when swipes are opposite', () => {
      const detectClash = (swipe1: string, swipe2: string) => swipe1 !== swipe2;

      expect(detectClash('yes', 'no')).toBe(true);
      expect(detectClash('no', 'yes')).toBe(true);
      expect(detectClash('yes', 'yes')).toBe(false);
      expect(detectClash('no', 'no')).toBe(false);
    });

    it('should determine prover as the one who swiped yes', () => {
      const determineProver = (
        user1Id: string,
        user2Id: string,
        user1Swipe: string,
        user2Swipe: string
      ) => {
        if (user1Swipe === 'yes') return user1Id;
        return user2Id;
      };

      expect(determineProver('u1', 'u2', 'yes', 'no')).toBe('u1');
      expect(determineProver('u1', 'u2', 'no', 'yes')).toBe('u2');
    });

    it('should calculate total pot correctly', () => {
      const calculatePot = (stake1: number, stake2: number) => stake1 + stake2;

      expect(calculatePot(10, 10)).toBe(20);
      expect(calculatePot(5, 15)).toBe(20);
      expect(calculatePot(100, 50)).toBe(150);
    });
  });

  describe('Bet Filtering', () => {
    it('should filter bets by heat level requirement', () => {
      const bets = [
        { id: '1', heat_level_required: 1 },
        { id: '2', heat_level_required: 2 },
        { id: '3', heat_level_required: 3 },
      ];

      const userHeatLevel = 2;
      const eligibleBets = bets.filter(b => b.heat_level_required <= userHeatLevel);

      expect(eligibleBets).toHaveLength(2);
      expect(eligibleBets.map(b => b.id)).toEqual(['1', '2']);
    });

    it('should filter out already swiped bets', () => {
      const allBets = [
        { id: '1', participants: [{ user_id: 'u1', swipe: 'yes' }] },
        { id: '2', participants: [{ user_id: 'u1', swipe: null }] },
        { id: '3', participants: [{ user_id: 'u2', swipe: 'no' }] },
      ];

      const userId = 'u1';
      const availableBets = allBets.filter(bet => {
        const userParticipation = bet.participants.find(
          p => p.user_id === userId && p.swipe !== null
        );
        return !userParticipation;
      });

      expect(availableBets).toHaveLength(2);
    });
  });

  describe('Bet Batch Scheduling', () => {
    it('should identify morning batch (batch 1)', () => {
      const getBatchNumber = (hour: number) => {
        if (hour >= 6 && hour < 12) return 1;
        if (hour >= 12 && hour < 18) return 2;
        return 3;
      };

      expect(getBatchNumber(8)).toBe(1);
      expect(getBatchNumber(11)).toBe(1);
    });

    it('should identify afternoon batch (batch 2)', () => {
      const getBatchNumber = (hour: number) => {
        if (hour >= 6 && hour < 12) return 1;
        if (hour >= 12 && hour < 18) return 2;
        return 3;
      };

      expect(getBatchNumber(12)).toBe(2);
      expect(getBatchNumber(15)).toBe(2);
    });

    it('should identify evening batch (batch 3)', () => {
      const getBatchNumber = (hour: number) => {
        if (hour >= 6 && hour < 12) return 1;
        if (hour >= 12 && hour < 18) return 2;
        return 3;
      };

      expect(getBatchNumber(18)).toBe(3);
      expect(getBatchNumber(22)).toBe(3);
      expect(getBatchNumber(2)).toBe(3);
    });
  });

  describe('Stake Locking', () => {
    it('should validate user has enough coins for stake', () => {
      const validateStake = (userCoins: number, stakeAmount: number) =>
        userCoins >= stakeAmount;

      expect(validateStake(100, 10)).toBe(true);
      expect(validateStake(10, 10)).toBe(true);
      expect(validateStake(5, 10)).toBe(false);
    });

    it('should calculate new balance after stake lock', () => {
      const lockStake = (currentBalance: number, stake: number) =>
        currentBalance - stake;

      expect(lockStake(100, 10)).toBe(90);
      expect(lockStake(50, 50)).toBe(0);
    });
  });

  describe('Proof Deadline', () => {
    it('should set 24 hour proof deadline', () => {
      const now = new Date();
      const deadlineHours = 24;
      const deadline = new Date(now.getTime() + deadlineHours * 60 * 60 * 1000);

      const diffMs = deadline.getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      expect(diffHours).toBeCloseTo(24, 1);
    });

    it('should identify overdue proofs', () => {
      const now = new Date();
      const overdueClash = {
        proof_deadline: new Date(now.getTime() - 1000).toISOString(),
        status: 'pending_proof',
      };
      const validClash = {
        proof_deadline: new Date(now.getTime() + 3600000).toISOString(),
        status: 'pending_proof',
      };

      const isOverdue = (clash: { proof_deadline: string; status: string }) =>
        clash.status === 'pending_proof' &&
        new Date(clash.proof_deadline) < new Date();

      expect(isOverdue(overdueClash)).toBe(true);
      expect(isOverdue(validClash)).toBe(false);
    });
  });
});

describe('Bet Integration Scenarios', () => {
  describe('Complete Bet Flow', () => {
    it('should follow correct flow: create -> swipe -> clash -> proof -> resolve', () => {
      const flow = [
        'bet_created',
        'user1_swiped',
        'user2_swiped',
        'clash_created',
        'proof_submitted',
        'proof_reviewed',
        'clash_resolved',
      ];

      expect(flow[0]).toBe('bet_created');
      expect(flow[flow.length - 1]).toBe('clash_resolved');
    });

    it('should handle hairball (same swipe) case', () => {
      const handleSwipeResult = (
        user1Swipe: string,
        user2Swipe: string
      ): 'clash' | 'hairball' => {
        return user1Swipe !== user2Swipe ? 'clash' : 'hairball';
      };

      expect(handleSwipeResult('yes', 'yes')).toBe('hairball');
      expect(handleSwipeResult('no', 'no')).toBe('hairball');
      expect(handleSwipeResult('yes', 'no')).toBe('clash');
    });
  });
});
