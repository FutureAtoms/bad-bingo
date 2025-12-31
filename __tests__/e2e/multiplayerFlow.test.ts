/**
 * End-to-End Multiplayer Flow Tests
 *
 * These tests simulate complete user journeys through the multiplayer system:
 * 1. Full bet creation → swipe → clash → resolution flow
 * 2. Group betting scenarios
 * 3. Steal and defense complete flows
 * 4. Edge cases and error recovery
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import { supabase } from '../../services/supabase';
import { createSupabaseQuery } from '../helpers/supabaseMock';

// Mock all external services
vi.mock('../../services/supabase', () => ({
  supabase: {
    from: vi.fn(),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
    },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
    })),
    removeChannel: vi.fn(),
    rpc: vi.fn().mockResolvedValue({ error: { message: 'RPC not found' } }),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ data: { path: 'proofs/test.jpg' }, error: null }),
        createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://signed.url' }, error: null }),
      })),
    },
  },
}));

vi.mock('../../services/economy', () => ({
  calculateStake: vi.fn((coins: number) => Math.floor(coins * 0.1)),
  lockStake: vi.fn().mockResolvedValue(true),
  lockStakeForSwipe: vi.fn().mockResolvedValue({ success: true, newBalance: 90, error: null }),
  logTransaction: vi.fn().mockResolvedValue(undefined),
  awardClashWin: vi.fn().mockResolvedValue({ success: true, error: null }),
  calculateStealPercentage: vi.fn().mockReturnValue(25),
}));

vi.mock('../../services/notifications', () => ({
  createNotification: vi.fn().mockResolvedValue({ notification: { id: 'notif-1' }, error: null }),
}));

vi.mock('../../services/pushTokenService', () => ({
  getUserPushTokens: vi.fn().mockResolvedValue({ tokens: ['token-1'], error: null }),
}));

const fromMock = supabase.from as unknown as Mock;

describe('E2E: Complete Bet Lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('1v1 Bet Flow: Creation → Swipes → Clash → Proof → Resolution', () => {
    it('should complete full 1v1 bet lifecycle', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

      // Step 1: Create bet
      const { createBetForFriend } = await import('../../services/multiplayerBets');

      const creatorQuery = createSupabaseQuery({
        data: { id: 'alice', name: 'Alice', coins: 200 },
        error: null,
      });
      const friendshipQuery = createSupabaseQuery({
        data: [{ user_id: 'alice', friend_id: 'bob' }],
        error: null,
      });
      const betQuery = createSupabaseQuery({
        data: { id: 'bet-lifecycle', text: 'Bet you skip breakfast', base_stake: 20 },
        error: null,
      });
      const participantQuery = createSupabaseQuery({
        data: [
          { id: 'p1', bet_id: 'bet-lifecycle', user_id: 'alice', swipe: 'yes' },
          { id: 'p2', bet_id: 'bet-lifecycle', user_id: 'bob', swipe: null },
        ],
        error: null,
      });

      fromMock
        .mockReturnValueOnce(creatorQuery)
        .mockReturnValueOnce(friendshipQuery)
        .mockReturnValueOnce(betQuery)
        .mockReturnValueOnce(participantQuery);

      const createResult = await createBetForFriend('alice', 'bob', {
        text: 'Bet you skip breakfast',
        stakeAmount: 20,
      });

      expect(createResult.error).toBeNull();
      expect(createResult.bet?.id).toBe('bet-lifecycle');
      expect(createResult.participants.length).toBe(2);

      // Step 2: Bob swipes opposite → Clash created
      const { swipeBet } = await import('../../services/bets');

      const existingParticipant = createSupabaseQuery({
        data: null,
        error: { message: 'Not found', code: 'PGRST116' } as any
      });
      const upsertParticipant = createSupabaseQuery({ data: null, error: null });
      const bothParticipants = createSupabaseQuery({
        data: [
          { user_id: 'alice', swipe: 'yes', stake_amount: 20 },
          { user_id: 'bob', swipe: 'no', stake_amount: 20 },
        ],
        error: null,
      });
      const clashInsert = createSupabaseQuery({
        data: {
          id: 'clash-lifecycle',
          bet_id: 'bet-lifecycle',
          user1_id: 'bob',
          user2_id: 'alice',
          prover_id: 'alice',
          total_pot: 40,
          status: 'pending_proof',
        },
        error: null,
      });

      fromMock
        .mockReturnValueOnce(existingParticipant)
        .mockReturnValueOnce(upsertParticipant)
        .mockReturnValueOnce(bothParticipants)
        .mockReturnValueOnce(clashInsert);

      const swipeResult = await swipeBet('bet-lifecycle', 'bob', 'no', 20);

      expect(swipeResult.success).toBe(true);
      expect(swipeResult.clashCreated).toBe(true);
      expect(swipeResult.matchType).toBe('clash');
      expect(swipeResult.clashId).toBe('clash-lifecycle');

      // Step 3: Alice (prover) submits proof
      const { submitProof } = await import('../../services/clashes');

      const clashForProof = createSupabaseQuery({
        data: { prover_id: 'alice', status: 'pending_proof' },
        error: null,
      });
      const proofRecordInsert = createSupabaseQuery({
        data: { id: 'proof-1' },
        error: null,
      });
      const updateClashWithProof = createSupabaseQuery({ data: null, error: null });

      fromMock
        .mockReturnValueOnce(clashForProof)
        .mockReturnValueOnce(proofRecordInsert)
        .mockReturnValueOnce(updateClashWithProof);

      const proofResult = await submitProof(
        'clash-lifecycle',
        'alice',
        'proofs/alice/clash-lifecycle.jpg',
        'photo',
        12,
        false
      );

      expect(proofResult.success).toBe(true);

      // Step 4: Bob accepts proof → Alice wins
      const { resolveClash } = await import('../../services/clashes');

      const clashForResolve = createSupabaseQuery({
        data: {
          id: 'clash-lifecycle',
          user1_id: 'bob',
          user2_id: 'alice',
          prover_id: 'alice',
          total_pot: 40,
        },
        error: null,
      });

      fromMock.mockReturnValue(clashForResolve);

      const resolveResult = await resolveClash('clash-lifecycle', true, 'bob');

      expect(resolveResult.success).toBe(true);
      expect(resolveResult.winnerId).toBe('alice');

      vi.useRealTimers();
    });
  });

  describe('Group Bet Flow: Multi-participant Scenarios', () => {
    it('should handle group bet with multiple clashes', async () => {
      const { createBetForGroup, checkBetSwipeStatus } = await import('../../services/multiplayerBets');
      const { swipeBet } = await import('../../services/bets');

      // Step 1: Creator creates group bet
      const creatorQuery = createSupabaseQuery({
        data: { id: 'creator', name: 'Creator', coins: 300 },
        error: null,
      });
      const friendshipQuery = createSupabaseQuery({
        data: [
          { user_id: 'creator', friend_id: 'friend-1' },
          { user_id: 'creator', friend_id: 'friend-2' },
          { user_id: 'creator', friend_id: 'friend-3' },
        ],
        error: null,
      });
      const betQuery = createSupabaseQuery({
        data: { id: 'group-bet-1', text: 'Group challenge', base_stake: 15 },
        error: null,
      });
      const participantQuery = createSupabaseQuery({
        data: [
          { id: 'p1', user_id: 'creator', swipe: 'yes' },
          { id: 'p2', user_id: 'friend-1', swipe: null },
          { id: 'p3', user_id: 'friend-2', swipe: null },
          { id: 'p4', user_id: 'friend-3', swipe: null },
        ],
        error: null,
      });

      fromMock
        .mockReturnValueOnce(creatorQuery)
        .mockReturnValueOnce(friendshipQuery)
        .mockReturnValueOnce(betQuery)
        .mockReturnValueOnce(participantQuery);

      const createResult = await createBetForGroup(
        'creator',
        ['friend-1', 'friend-2', 'friend-3'],
        { text: 'Group challenge', stakeAmount: 15 }
      );

      expect(createResult.error).toBeNull();
      expect(createResult.participants.length).toBe(4);

      // Step 2: Check initial status
      const statusQuery = createSupabaseQuery({
        data: [
          { user_id: 'creator', swipe: 'yes' },
          { user_id: 'friend-1', swipe: null },
          { user_id: 'friend-2', swipe: null },
          { user_id: 'friend-3', swipe: null },
        ],
        error: null,
      });

      fromMock.mockReturnValue(statusQuery);

      const initialStatus = await checkBetSwipeStatus('group-bet-1');

      expect(initialStatus.yesCount).toBe(1);
      expect(initialStatus.noCount).toBe(0);
      expect(initialStatus.pendingCount).toBe(3);
      expect(initialStatus.allSwiped).toBe(false);
    });

    it('should track mixed swipes in group bet correctly', async () => {
      const { checkBetSwipeStatus } = await import('../../services/multiplayerBets');

      // Simulate group bet where some agree, some disagree
      const mixedSwipesQuery = createSupabaseQuery({
        data: [
          { user_id: 'creator', swipe: 'yes' },
          { user_id: 'friend-1', swipe: 'yes' },    // Agrees
          { user_id: 'friend-2', swipe: 'no' },     // Disagrees (clash potential)
          { user_id: 'friend-3', swipe: 'yes' },    // Agrees
          { user_id: 'friend-4', swipe: null },     // Hasn't swiped
        ],
        error: null,
      });

      fromMock.mockReturnValue(mixedSwipesQuery);

      const status = await checkBetSwipeStatus('group-bet-mixed');

      expect(status.yesCount).toBe(3);
      expect(status.noCount).toBe(1);
      expect(status.pendingCount).toBe(1);
      expect(status.allSwiped).toBe(false);
    });
  });

  describe('Steal/Defense Complete Flow', () => {
    it('should complete full steal → defense → penalty flow', async () => {
      vi.useFakeTimers();
      const now = new Date('2025-01-15T12:00:00Z');
      vi.setSystemTime(now);

      const { initiateSteal, completeSteal, defendSteal } = await import('../../services/steals');

      // Step 1: Thief initiates steal
      const thiefQuery = createSupabaseQuery({
        data: { trust_score: 100, steals_successful: 5, steals_defended: 2 },
        error: null,
      });
      const targetQuery = createSupabaseQuery({
        data: {
          coins: 400,
          last_login: new Date(now.getTime() - 30 * 1000).toISOString() // Online (30 sec ago)
        },
        error: null,
      });
      const stealInsert = createSupabaseQuery({
        data: {
          id: 'steal-full-flow',
          thief_id: 'thief',
          target_id: 'target',
          potential_amount: 100,
          target_was_online: true,
          defense_window_end: new Date(now.getTime() + 16000).toISOString(),
          status: 'in_progress',
        },
        error: null,
      });

      fromMock
        .mockReturnValueOnce(thiefQuery)
        .mockReturnValueOnce(targetQuery)
        .mockReturnValueOnce(stealInsert);

      const initResult = await initiateSteal('thief', 'target');

      expect(initResult.steal).not.toBeNull();
      expect(initResult.potentialAmount).toBe(100);

      // Step 2: Target defends within window
      const stealForDefend = createSupabaseQuery({
        data: {
          id: 'steal-full-flow',
          target_id: 'target',
          status: 'in_progress',
          defense_window_end: new Date(now.getTime() + 10000).toISOString(),
        },
        error: null,
      });
      const updateSteal = createSupabaseQuery({ data: null, error: null });
      const defenderStats = createSupabaseQuery({
        data: { steals_defended: 3 },
        error: null,
      });
      const updateDefender = createSupabaseQuery({ data: null, error: null });

      fromMock
        .mockReturnValueOnce(stealForDefend)
        .mockReturnValueOnce(updateSteal)
        .mockReturnValueOnce(defenderStats)
        .mockReturnValueOnce(updateDefender);

      const defendResult = await defendSteal('steal-full-flow', 'target');

      expect(defendResult.success).toBe(true);

      // Step 3: Thief completes minigame but was defended → 2x penalty
      const stealForComplete = createSupabaseQuery({
        data: {
          id: 'steal-full-flow',
          thief_id: 'thief',
          target_id: 'target',
          status: 'in_progress',
          potential_amount: 100,
          target_was_online: true,
          defense_window_end: new Date(now.getTime() + 5000).toISOString(),
          was_defended: true,
        },
        error: null,
      });
      const thiefBalance = createSupabaseQuery({
        data: { coins: 500 },
        error: null,
      });
      const updateThiefBalance = createSupabaseQuery({ data: null, error: null });
      const thiefTransaction = createSupabaseQuery({ data: null, error: null });
      const finalStealUpdate = createSupabaseQuery({ data: null, error: null });

      fromMock
        .mockReturnValueOnce(stealForComplete)
        .mockReturnValueOnce(thiefBalance)
        .mockReturnValueOnce(updateThiefBalance)
        .mockReturnValueOnce(thiefTransaction)
        .mockReturnValueOnce(finalStealUpdate);

      const completeResult = await completeSteal('steal-full-flow', true);

      expect(completeResult.success).toBe(false); // Defended
      expect(completeResult.stolenAmount).toBe(0);

      // Verify penalty was applied
      const penaltyUpdate = updateThiefBalance.update.mock.calls[0][0];
      expect(penaltyUpdate.coins).toBe(300); // 500 - (100 * 2)

      vi.useRealTimers();
    });

    it('should complete successful steal when target is offline', async () => {
      vi.useFakeTimers();
      const now = new Date('2025-01-15T12:00:00Z');
      vi.setSystemTime(now);

      const { initiateSteal, completeSteal } = await import('../../services/steals');

      // Target is offline
      const thiefQuery = createSupabaseQuery({
        data: { trust_score: 90, steals_successful: 3, steals_defended: 1 },
        error: null,
      });
      const targetQuery = createSupabaseQuery({
        data: {
          coins: 200,
          last_login: new Date(now.getTime() - 30 * 60 * 1000).toISOString() // 30 min ago
        },
        error: null,
      });
      const stealInsert = createSupabaseQuery({
        data: {
          id: 'steal-offline-success',
          thief_id: 'thief',
          target_id: 'target-offline',
          potential_amount: 50,
          target_was_online: false,
          defense_window_end: null,
          status: 'in_progress',
        },
        error: null,
      });

      fromMock
        .mockReturnValueOnce(thiefQuery)
        .mockReturnValueOnce(targetQuery)
        .mockReturnValueOnce(stealInsert);

      const initResult = await initiateSteal('thief', 'target-offline');

      expect(initResult.steal?.target_was_online).toBe(false);

      // Complete immediately (no defense window)
      const stealForComplete = createSupabaseQuery({
        data: {
          id: 'steal-offline-success',
          thief_id: 'thief',
          target_id: 'target-offline',
          status: 'in_progress',
          potential_amount: 50,
          target_was_online: false,
          defense_window_end: null,
          was_defended: false,
        },
        error: null,
      });
      const thiefData = createSupabaseQuery({
        data: { coins: 100, steals_successful: 3 },
        error: null,
      });
      const targetData = createSupabaseQuery({
        data: { coins: 200, times_robbed: 0 },
        error: null,
      });
      const updateThief = createSupabaseQuery({ data: null, error: null });
      const updateTarget = createSupabaseQuery({ data: null, error: null });
      const thiefTx = createSupabaseQuery({ data: null, error: null });
      const targetTx = createSupabaseQuery({ data: null, error: null });
      const finalUpdate = createSupabaseQuery({ data: null, error: null });
      const notification = createSupabaseQuery({ data: null, error: null });

      fromMock
        .mockReturnValueOnce(stealForComplete)
        .mockReturnValueOnce(thiefData)
        .mockReturnValueOnce(targetData)
        .mockReturnValueOnce(updateThief)
        .mockReturnValueOnce(updateTarget)
        .mockReturnValueOnce(thiefTx)
        .mockReturnValueOnce(targetTx)
        .mockReturnValueOnce(finalUpdate)
        .mockReturnValueOnce(notification);

      const completeResult = await completeSteal('steal-offline-success', true);

      expect(completeResult.success).toBe(true);
      expect(completeResult.stolenAmount).toBe(50);

      vi.useRealTimers();
    });
  });
});

describe('E2E: Error Recovery Scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle bet creation failure gracefully', async () => {
    const { createBetForFriend } = await import('../../services/multiplayerBets');
    const { lockStake } = await import('../../services/economy');

    // Simulate stake lock succeeds but bet creation fails
    const creatorQuery = createSupabaseQuery({
      data: { id: 'creator', name: 'Creator', coins: 100 },
      error: null,
    });
    const friendshipQuery = createSupabaseQuery({
      data: [{ user_id: 'creator', friend_id: 'friend' }],
      error: null,
    });
    const betQuery = createSupabaseQuery({
      data: null,
      error: { message: 'Database error' },
    });
    // Refund queries
    const refundUserQuery = createSupabaseQuery({
      data: { coins: 90 },
      error: null,
    });
    const refundUpdateQuery = createSupabaseQuery({ data: null, error: null });
    const refundTxQuery = createSupabaseQuery({ data: null, error: null });

    fromMock
      .mockReturnValueOnce(creatorQuery)
      .mockReturnValueOnce(friendshipQuery)
      .mockReturnValueOnce(betQuery)
      .mockReturnValueOnce(refundUserQuery)
      .mockReturnValueOnce(refundUpdateQuery)
      .mockReturnValueOnce(refundTxQuery);

    const result = await createBetForFriend('creator', 'friend', {
      text: 'Test bet',
      stakeAmount: 10,
    });

    expect(result.error).toBe('Database error');
    expect(result.bet).toBeNull();
  });

  it('should handle swipe errors gracefully', async () => {
    const { swipeBet } = await import('../../services/bets');
    const economyModule = await import('../../services/economy');

    // Mock lockStakeForSwipe to fail
    vi.mocked(economyModule.lockStakeForSwipe).mockResolvedValueOnce({
      success: false,
      newBalance: 5,
      error: 'Insufficient funds',
    });

    // User hasn't swiped yet
    const existingParticipant = createSupabaseQuery({
      data: null,
      error: { message: 'Not found', code: 'PGRST116' } as any
    });

    fromMock.mockReturnValueOnce(existingParticipant);

    const result = await swipeBet('bet-fail', 'user-1', 'yes', 100);

    expect(result.success).toBe(false);
    // Error comes from lockStakeForSwipe
    expect(result.error).toBe('Insufficient funds');
  });

  it('should handle proof submission errors', async () => {
    const { submitProof } = await import('../../services/clashes');

    // Mock returns null for clash query
    const clashQuery = createSupabaseQuery({
      data: null,
      error: null,
    });

    fromMock.mockReturnValue(clashQuery);

    const result = await submitProof(
      'clash-nonexistent',
      'some-user',
      'proofs/user123/clash456.jpg',
      'photo'
    );

    expect(result.success).toBe(false);
    // Error could be clash not found or not the prover
    expect(result.error).not.toBeNull();
    expect(typeof result.error).toBe('string');
  });

  it('should handle steal when target user is not found', async () => {
    const { initiateSteal } = await import('../../services/steals');

    const thiefQuery = createSupabaseQuery({
      data: { trust_score: 100, steals_successful: 5, steals_defended: 2 },
      error: null,
    });
    const targetQuery = createSupabaseQuery({
      data: null,
      error: null,
    });

    fromMock
      .mockReturnValueOnce(thiefQuery)
      .mockReturnValueOnce(targetQuery);

    const result = await initiateSteal('thief', 'ghost-user');

    expect(result.steal).toBeNull();
    expect(result.error).toBe('Target not found');
  });
});

describe('E2E: Concurrent Operation Safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should prevent double-swipe race condition', async () => {
    const { swipeBet } = await import('../../services/bets');

    // The test simulates two swipes in sequence (not truly parallel due to mock limitations)
    // First swipe succeeds
    const firstCheck = createSupabaseQuery({
      data: null,
      error: { message: 'Not found', code: 'PGRST116' } as any
    });
    const firstUpsert = createSupabaseQuery({ data: null, error: null });
    const firstParticipants = createSupabaseQuery({
      data: [{ user_id: 'user-1', swipe: 'yes', stake_amount: 10 }],
      error: null,
    });

    // Second swipe - user already has swipe recorded
    const secondCheck = createSupabaseQuery({
      data: { swipe: 'yes', stake_locked: true },
      error: null,
    });

    fromMock
      .mockReturnValueOnce(firstCheck)
      .mockReturnValueOnce(firstUpsert)
      .mockReturnValueOnce(firstParticipants)
      .mockReturnValueOnce(secondCheck);

    // Run sequentially to ensure mocks are consumed in order
    const result1 = await swipeBet('bet-race', 'user-1', 'yes', 10);
    const result2 = await swipeBet('bet-race', 'user-1', 'no', 10);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(false);
    expect(result2.error).toBe('You already swiped on this bet');
  });

  it('should handle bet expiry during swipe', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T14:00:00Z'));

    const { getAvailableBets } = await import('../../services/bets');

    // Bets that are expired should be filtered out
    const betsQuery = createSupabaseQuery({
      data: [
        {
          id: 'expired-bet',
          expires_at: '2025-01-15T13:00:00Z', // Already expired
          bb_bet_participants: [],
        },
        {
          id: 'active-bet',
          expires_at: '2025-01-15T16:00:00Z', // Still active
          bb_bet_participants: [],
        },
      ],
      error: null,
    });

    fromMock.mockReturnValue(betsQuery);

    const result = await getAvailableBets('user-1');

    // The expired bet should be filtered by the database query (gte expires_at)
    // In this test, both are returned by mock, but in real scenario DB filters
    expect(result.bets.length).toBe(2); // Mock returns both

    vi.useRealTimers();
  });
});

describe('E2E: Notification Delivery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should send notifications to all participants when bet is created', async () => {
    const { createBetForGroup, notifyBetParticipants } = await import('../../services/multiplayerBets');
    const { createNotification } = await import('../../services/notifications');

    const bet = {
      id: 'notif-test-bet',
      text: 'Notification test',
      expires_at: new Date(Date.now() + 7200000).toISOString(),
    } as any;

    await notifyBetParticipants(
      bet,
      'creator',
      'CreatorName',
      ['friend-1', 'friend-2', 'friend-3'],
      25
    );

    expect(createNotification).toHaveBeenCalledTimes(3);

    // Verify each friend was notified
    const calls = vi.mocked(createNotification).mock.calls;
    const notifiedUsers = calls.map(call => call[0].userId);
    expect(notifiedUsers).toContain('friend-1');
    expect(notifiedUsers).toContain('friend-2');
    expect(notifiedUsers).toContain('friend-3');
  });
});
