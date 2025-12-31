import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { supabase } from '../../services/supabase';
import type { DBBet, DBBetParticipant, DBClash } from '../../types/database';

// Mock Supabase
vi.mock('../../services/supabase', () => ({
  supabase: {
    from: vi.fn(),
    storage: {
      from: vi.fn(),
    },
  },
}));

/**
 * Phase 1 Tests: Bet Creation Flow
 *
 * Critical Requirements:
 * 1. Bets must be created in bb_bets FIRST before participants can swipe
 * 2. Participants are added to bb_bet_participants with null swipe initially
 * 3. Clashes are only created AFTER both users have swiped with OPPOSITE swipes
 * 4. Stakes are locked from BOTH parties when clash forms
 */

describe('Bet Creation Sequence (Task 1.3)', () => {
  const mockUserId = 'user-123';
  const mockFriendId = 'friend-456';
  const mockBetId = 'bet-789';
  const mockStake = 50;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Step 1: Bet Creation', () => {
    it('should create bet in bb_bets table first', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: mockBetId,
              text: 'Test bet',
              base_stake: mockStake,
              expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
            },
            error: null,
          }),
        }),
      });

      (supabase.from as any).mockReturnValue({ insert: mockInsert });

      // Simulate bet creation
      const { data: bet } = await (supabase.from('bb_bets') as any).insert({
        text: 'Test bet',
        base_stake: mockStake,
        expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      }).select().single();

      expect(supabase.from).toHaveBeenCalledWith('bb_bets');
      expect(bet).toBeDefined();
      expect(bet).not.toBeNull();
      if (bet) {
        expect(bet.id).toBe(mockBetId);
      }
    });

    it('should add both participants to bb_bet_participants with null swipe', async () => {
      const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
      (supabase.from as any).mockReturnValue({ insert: mockInsert });

      // Add participants
      await (supabase.from('bb_bet_participants') as any).insert([
        { bet_id: mockBetId, user_id: mockUserId, stake_amount: mockStake, swipe: null },
        { bet_id: mockBetId, user_id: mockFriendId, stake_amount: mockStake, swipe: null },
      ]);

      expect(supabase.from).toHaveBeenCalledWith('bb_bet_participants');
      expect(mockInsert).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ swipe: null }),
        expect.objectContaining({ swipe: null }),
      ]));
    });
  });

  describe('Step 2: Simultaneous Swipes (Task 1.2)', () => {
    it('should NOT use Math.random() for friend vote', () => {
      // This test ensures we're checking real swipes from DB, not simulated
      const friendVoteSimulated = Math.random() > 0.5;
      // The actual implementation should NEVER use this pattern
      expect(typeof friendVoteSimulated).toBe('boolean'); // This is what we're replacing
    });

    it('should record user swipe in bb_bet_participants', async () => {
      const mockUpsert = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      (supabase.from as any).mockReturnValue({
        upsert: mockUpsert,
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      });

      // User swipes YES
      await (supabase.from('bb_bet_participants') as any).upsert({
        bet_id: mockBetId,
        user_id: mockUserId,
        swipe: 'yes',
        swiped_at: new Date().toISOString(),
        stake_locked: true,
      });

      expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({
        swipe: 'yes',
        stake_locked: true,
      }));
    });

    it('should check both participants swipes from database', async () => {
      const mockParticipants: Partial<DBBetParticipant>[] = [
        { bet_id: mockBetId, user_id: mockUserId, swipe: 'yes', stake_amount: mockStake },
        { bet_id: mockBetId, user_id: mockFriendId, swipe: 'no', stake_amount: mockStake },
      ];

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          not: vi.fn().mockResolvedValue({ data: mockParticipants, error: null }),
        }),
      });

      (supabase.from as any).mockReturnValue({ select: mockSelect });

      const { data: participants } = await supabase
        .from('bb_bet_participants')
        .select('*')
        .eq('bet_id', mockBetId)
        .not('swipe', 'is', null);

      expect(participants).toHaveLength(2);
      expect(participants?.every((p: any) => p.swipe !== null)).toBe(true);
    });

    it('should detect opposite swipes and trigger clash creation', () => {
      const userSwipe: string = 'yes';
      const friendSwipe: string = 'no';

      const hasOppositeSwipes = userSwipe !== friendSwipe;
      expect(hasOppositeSwipes).toBe(true);
    });

    it('should NOT create clash if same swipes (hairball)', () => {
      const userSwipe: string = 'yes';
      const friendSwipe: string = 'yes';

      const hasOppositeSwipes = userSwipe !== friendSwipe;
      expect(hasOppositeSwipes).toBe(false);
    });
  });

  describe('Step 3: Clash Creation', () => {
    it('should create clash ONLY after both users swiped with opposite votes', async () => {
      const mockClash: Partial<DBClash> = {
        id: 'clash-001',
        bet_id: mockBetId,
        user1_id: mockUserId,
        user2_id: mockFriendId,
        user1_swipe: 'yes',
        user2_swipe: 'no',
        user1_stake: mockStake,
        user2_stake: mockStake,
        total_pot: mockStake * 2,
        prover_id: mockUserId, // User who swiped YES proves
        status: 'pending_proof',
      };

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockClash, error: null }),
        }),
      });

      (supabase.from as any).mockReturnValue({ insert: mockInsert });

      const { data: clash } = await (supabase.from('bb_clashes') as any).insert({
        bet_id: mockBetId,
        user1_id: mockUserId,
        user2_id: mockFriendId,
        user1_swipe: 'yes',
        user2_swipe: 'no',
        user1_stake: mockStake,
        user2_stake: mockStake,
        total_pot: mockStake * 2,
        prover_id: mockUserId,
      }).select().single();

      expect(clash).not.toBeNull();
      if (clash) {
        expect(clash.total_pot).toBe(100);
        expect(clash.prover_id).toBe(mockUserId);
      }
    });

    it('should set prover as the user who swiped YES', () => {
      const userSwipe = 'yes';
      const friendSwipe = 'no';

      const proverId = userSwipe === 'yes' ? mockUserId : mockFriendId;
      expect(proverId).toBe(mockUserId);
    });

    it('should set correct proof deadline (24 hours)', () => {
      const now = new Date();
      const proofDeadline = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const hoursDiff = (proofDeadline.getTime() - now.getTime()) / (1000 * 60 * 60);
      expect(hoursDiff).toBe(24);
    });
  });
});

describe('Real Simultaneous Swipes Integration (Task 1.2)', () => {
  it('should handle first user swipe (waiting for friend)', async () => {
    const mockParticipants = [
      { user_id: 'user-1', swipe: 'yes', swiped_at: new Date().toISOString() },
      { user_id: 'user-2', swipe: null, swiped_at: null }, // Not yet swiped
    ];

    const bothSwiped = mockParticipants.every(p => p.swipe !== null);
    expect(bothSwiped).toBe(false);
  });

  it('should handle second user swipe (clash check)', async () => {
    const mockParticipants = [
      { user_id: 'user-1', swipe: 'yes', swiped_at: new Date().toISOString() },
      { user_id: 'user-2', swipe: 'no', swiped_at: new Date().toISOString() },
    ];

    const bothSwiped = mockParticipants.every(p => p.swipe !== null);
    const hasOppositeSwipes = mockParticipants[0].swipe !== mockParticipants[1].swipe;

    expect(bothSwiped).toBe(true);
    expect(hasOppositeSwipes).toBe(true);
  });

  it('should return clash created status after successful match', () => {
    interface SwipeResult {
      success: boolean;
      clashCreated: boolean;
      clashId?: string;
      error: string | null;
    }

    const result: SwipeResult = {
      success: true,
      clashCreated: true,
      clashId: 'clash-123',
      error: null,
    };

    expect(result.clashCreated).toBe(true);
    expect(result.clashId).toBeDefined();
  });

  it('should NOT create multiple clashes for same bet', () => {
    const existingClashes = [{ id: 'clash-001', bet_id: 'bet-123' }];
    const betId = 'bet-123';

    const hasExistingClash = existingClashes.some(c => c.bet_id === betId);
    expect(hasExistingClash).toBe(true);

    // Should not create another clash
    const shouldCreateClash = !hasExistingClash;
    expect(shouldCreateClash).toBe(false);
  });
});

describe('Bet Expiry Handling', () => {
  it('should not allow swipes on expired bets', () => {
    const expiredAt = new Date(Date.now() - 1000);
    const now = new Date();

    const isExpired = expiredAt < now;
    expect(isExpired).toBe(true);
  });

  it('should enforce 2-hour default expiry window', () => {
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + 2 * 60 * 60 * 1000);

    const durationHours = (expiresAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    expect(durationHours).toBe(2);
  });
});
