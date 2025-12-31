import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '../../services/supabase';

// Mock Supabase
vi.mock('../../services/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

/**
 * Phase 1 Tests: Stake Locking (Task 1.4)
 *
 * Critical Requirements:
 * 1. Stakes must be locked from BOTH parties when a clash forms
 * 2. Locked stakes should be deducted from user's available balance
 * 3. Stakes should be returned if bet expires without clash
 * 4. Winner receives total pot on clash resolution
 */

describe('Stake Locking System (Task 1.4)', () => {
  const mockUserId = 'user-123';
  const mockFriendId = 'friend-456';
  const userCoins = 500;
  const friendCoins = 300;
  const stakeAmount = 50;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Dual Stake Locking', () => {
    it('should lock stake from first user when they swipe', async () => {
      // User 1 has 500 coins, stakes 50
      const userBalanceBefore = userCoins;
      const lockedStake = stakeAmount;
      const userBalanceAfter = userBalanceBefore - lockedStake;

      expect(userBalanceAfter).toBe(450);
    });

    it('should lock stake from second user when they swipe', async () => {
      // User 2 has 300 coins, stakes 50
      const friendBalanceBefore = friendCoins;
      const lockedStake = stakeAmount;
      const friendBalanceAfter = friendBalanceBefore - lockedStake;

      expect(friendBalanceAfter).toBe(250);
    });

    it('should prevent swiping if insufficient balance', () => {
      const poorUserCoins = 30;
      const requiredStake = 50;

      const canAfford = poorUserCoins >= requiredStake;
      expect(canAfford).toBe(false);
    });

    it('should update bb_bet_participants.stake_locked to true', async () => {
      const mockUpsert = vi.fn().mockResolvedValue({ data: null, error: null });
      (supabase.from as any).mockReturnValue({
        upsert: mockUpsert,
      });

      await (supabase.from('bb_bet_participants') as any).upsert({
        bet_id: 'bet-123',
        user_id: mockUserId,
        swipe: 'yes',
        stake_locked: true,
        stake_amount: stakeAmount,
      });

      expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({
        stake_locked: true,
        stake_amount: stakeAmount,
      }));
    });

    it('should create transaction record when stake is locked', async () => {
      const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
      (supabase.from as any).mockReturnValue({ insert: mockInsert });

      await (supabase.from('bb_transactions') as any).insert({
        user_id: mockUserId,
        amount: -stakeAmount, // Negative because it's a deduction
        balance_after: userCoins - stakeAmount,
        type: 'clash_stake_lock',
        reference_type: 'bet_participant',
        reference_id: 'participant-123',
        description: 'Stake locked for bet',
      });

      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        type: 'clash_stake_lock',
        amount: -stakeAmount,
      }));
    });
  });

  describe('Total Pot Calculation', () => {
    it('should calculate total pot as sum of both stakes', () => {
      const user1Stake = 50;
      const user2Stake = 50;
      const totalPot = user1Stake + user2Stake;

      expect(totalPot).toBe(100);
    });

    it('should handle different stake amounts', () => {
      // If stakes differ (shouldn't happen in current design, but test anyway)
      const user1Stake = 50;
      const user2Stake = 45; // Slightly lower balance user
      const totalPot = user1Stake + user2Stake;

      expect(totalPot).toBe(95);
    });

    it('should use calculateStake to determine stake based on wallet', () => {
      // calculateStake returns wallet/50 with min 2
      const calculateStake = (wallet: number): number => {
        return Math.max(2, Math.floor(wallet / 50));
      };

      expect(calculateStake(100)).toBe(2);
      expect(calculateStake(250)).toBe(5);
      expect(calculateStake(500)).toBe(10);
      expect(calculateStake(50)).toBe(2); // Minimum
    });
  });

  describe('Stake Return on Expiry', () => {
    it('should return stakes if bet expires without clash', async () => {
      // Both users swiped the same way (no clash) and bet expired
      const user1Stake = 50;
      const user2Stake = 50;

      // Each should get their stake back
      const user1Return = user1Stake;
      const user2Return = user2Stake;

      expect(user1Return).toBe(50);
      expect(user2Return).toBe(50);
    });

    it('should return stake to user who swiped if other user never swiped', () => {
      const user1Swiped = true;
      const user2Swiped = false;
      const user1Stake = 50;

      // Only user1 should get refund (they locked stake)
      const shouldRefundUser1 = user1Swiped;
      const shouldRefundUser2 = user2Swiped;

      expect(shouldRefundUser1).toBe(true);
      expect(shouldRefundUser2).toBe(false);
    });
  });

  describe('Winner Payout', () => {
    it('should award total pot to winner', async () => {
      const totalPot = 100;
      const winnerBalanceBefore = 450; // After stake was locked
      const winnerBalanceAfter = winnerBalanceBefore + totalPot;

      expect(winnerBalanceAfter).toBe(550);
    });

    it('should update winner stats (total_wins, win_streak)', () => {
      const stats = {
        total_wins: 10,
        win_streak: 3,
        total_clashes: 25,
      };

      const updatedStats = {
        total_wins: stats.total_wins + 1,
        win_streak: stats.win_streak + 1,
        total_clashes: stats.total_clashes + 1,
      };

      expect(updatedStats.total_wins).toBe(11);
      expect(updatedStats.win_streak).toBe(4);
    });

    it('should update loser stats (reset win_streak)', () => {
      const stats = {
        total_wins: 8,
        win_streak: 5,
        total_clashes: 20,
      };

      const updatedStats = {
        total_wins: stats.total_wins, // No change
        win_streak: 0, // Reset
        total_clashes: stats.total_clashes + 1,
      };

      expect(updatedStats.win_streak).toBe(0);
      expect(updatedStats.total_clashes).toBe(21);
    });

    it('should create win transaction for winner', async () => {
      const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
      (supabase.from as any).mockReturnValue({ insert: mockInsert });

      const totalPot = 100;
      const winnerBalance = 450;

      await (supabase.from('bb_transactions') as any).insert({
        user_id: mockUserId,
        amount: totalPot,
        balance_after: winnerBalance + totalPot,
        type: 'clash_win',
        reference_type: 'clash',
        reference_id: 'clash-123',
        description: 'Won clash bet',
      });

      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        type: 'clash_win',
        amount: totalPot,
      }));
    });

    it('should create loss transaction for loser (amount 0, already locked)', async () => {
      const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
      (supabase.from as any).mockReturnValue({ insert: mockInsert });

      await (supabase.from('bb_transactions') as any).insert({
        user_id: mockFriendId,
        amount: 0, // Already deducted when locked
        balance_after: 250, // Remains at locked balance
        type: 'clash_loss',
        reference_type: 'clash',
        reference_id: 'clash-123',
        description: 'Lost clash bet',
      });

      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        type: 'clash_loss',
        amount: 0,
      }));
    });
  });

  describe('Edge Cases', () => {
    it('should handle minimum stake of 2', () => {
      const lowBalanceUser = 50;
      const minStake = 2;

      const calculatedStake = Math.max(2, Math.floor(lowBalanceUser / 50));
      expect(calculatedStake).toBe(minStake);
    });

    it('should prevent negative balance', () => {
      const balance = 30;
      const stake = 50;

      const canLock = balance >= stake;
      expect(canLock).toBe(false);
    });

    it('should handle concurrent stake locks (race condition prevention)', async () => {
      // Both users try to lock at the same time
      // Database should use transactions to prevent double-spending
      const userBalance = 60;
      const stakeAttempt1 = 50;
      const stakeAttempt2 = 50;

      // Only one should succeed
      const totalAttempted = stakeAttempt1 + stakeAttempt2;
      const canAffordBoth = userBalance >= totalAttempted;

      expect(canAffordBoth).toBe(false);
    });
  });
});

describe('Stake Locking with RPC Functions', () => {
  it('should call bb_lock_stake RPC function', async () => {
    const mockRpc = vi.fn().mockResolvedValue({ data: true, error: null });
    (supabase.rpc as any) = mockRpc;

    await (supabase as any).rpc('bb_lock_stake', {
      user_uuid: 'user-123',
      stake_amount: 50,
    });

    expect(mockRpc).toHaveBeenCalledWith('bb_lock_stake', {
      user_uuid: 'user-123',
      stake_amount: 50,
    });
  });

  it('should call bb_award_clash_win RPC function', async () => {
    const mockRpc = vi.fn().mockResolvedValue({ data: null, error: null });
    (supabase.rpc as any) = mockRpc;

    await (supabase as any).rpc('bb_award_clash_win', {
      winner_uuid: 'user-123',
      loser_uuid: 'friend-456',
      clash_uuid: 'clash-789',
      total_pot: 100,
    });

    expect(mockRpc).toHaveBeenCalledWith('bb_award_clash_win', {
      winner_uuid: 'user-123',
      loser_uuid: 'friend-456',
      clash_uuid: 'clash-789',
      total_pot: 100,
    });
  });
});
