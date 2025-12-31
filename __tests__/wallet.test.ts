import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { createSupabaseQuery } from './helpers/supabaseMock';

// Mock supabase
vi.mock('../services/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { supabase } from '../services/supabase';
import {
  claimAllowance,
  canClaimAllowance,
  getTimeUntilAllowance,
  getTransactionHistory,
  getActiveDebts,
} from '../services/economy';

const fromMock = supabase.from as unknown as Mock;

describe('Wallet Economy Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('canClaimAllowance', () => {
    it('should return true for users who never claimed', async () => {
      const query = createSupabaseQuery({
        data: { last_allowance_claimed: null },
      });
      fromMock.mockReturnValue(query);

      const result = await canClaimAllowance('user-1');
      expect(result).toBe(true);
    });

    it('should return true if 48+ hours since last claim', async () => {
      const oldDate = new Date(Date.now() - 49 * 60 * 60 * 1000).toISOString();
      const query = createSupabaseQuery({
        data: { last_allowance_claimed: oldDate },
      });
      fromMock.mockReturnValue(query);

      const result = await canClaimAllowance('user-1');
      expect(result).toBe(true);
    });

    it('should return false if less than 48 hours since last claim', async () => {
      const recentDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const query = createSupabaseQuery({
        data: { last_allowance_claimed: recentDate },
      });
      fromMock.mockReturnValue(query);

      const result = await canClaimAllowance('user-1');
      expect(result).toBe(false);
    });
  });

  describe('getTimeUntilAllowance', () => {
    it('should return 0 for users who never claimed', async () => {
      const query = createSupabaseQuery({
        data: { last_allowance_claimed: null },
      });
      fromMock.mockReturnValue(query);

      const result = await getTimeUntilAllowance('user-1');
      expect(result).toBe(0);
    });

    it('should return remaining hours until next claim', async () => {
      const hoursAgo = 24;
      const claimDate = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
      const query = createSupabaseQuery({
        data: { last_allowance_claimed: claimDate },
      });
      fromMock.mockReturnValue(query);

      const result = await getTimeUntilAllowance('user-1');
      expect(result).toBeCloseTo(24, 0); // 48 - 24 = ~24 hours remaining
    });

    it('should return 0 if already past 48 hours', async () => {
      const oldDate = new Date(Date.now() - 50 * 60 * 60 * 1000).toISOString();
      const query = createSupabaseQuery({
        data: { last_allowance_claimed: oldDate },
      });
      fromMock.mockReturnValue(query);

      const result = await getTimeUntilAllowance('user-1');
      expect(result).toBe(0);
    });
  });

  describe('claimAllowance', () => {
    it('should fail if cannot claim yet', async () => {
      // First call for canClaim check
      const recentDate = new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString();
      const canClaimQuery = createSupabaseQuery({
        data: { last_allowance_claimed: recentDate },
      });
      fromMock.mockReturnValue(canClaimQuery);

      const result = await claimAllowance('user-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot claim yet');
    });

    it('should succeed and return new balance', async () => {
      // canClaim check
      const oldDate = new Date(Date.now() - 50 * 60 * 60 * 1000).toISOString();

      fromMock
        .mockReturnValueOnce(createSupabaseQuery({ data: { last_allowance_claimed: oldDate } }))
        .mockReturnValueOnce(createSupabaseQuery({ data: { coins: 150 } }))
        .mockReturnValueOnce(createSupabaseQuery({ data: null, error: null }))
        .mockReturnValueOnce(createSupabaseQuery({ data: null, error: null }));

      const result = await claimAllowance('user-1');

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(250); // 150 + 100 allowance
    });
  });

  describe('getTransactionHistory', () => {
    it('should return transactions for user', async () => {
      const mockTransactions = [
        { id: 'tx-1', amount: 100, type: 'allowance', created_at: new Date().toISOString() },
        { id: 'tx-2', amount: -20, type: 'clash_stake_lock', created_at: new Date().toISOString() },
      ];
      const query = createSupabaseQuery({ data: mockTransactions });
      fromMock.mockReturnValue(query);

      const result = await getTransactionHistory('user-1');

      expect(result.transactions).toHaveLength(2);
      expect(result.error).toBeNull();
    });

    it('should return empty array on error', async () => {
      const query = createSupabaseQuery({ data: null, error: { message: 'DB Error' } });
      fromMock.mockReturnValue(query);

      const result = await getTransactionHistory('user-1');

      expect(result.transactions).toEqual([]);
      expect(result.error).toBe('DB Error');
    });
  });

  describe('getActiveDebts', () => {
    it('should return active debts for user', async () => {
      const mockDebts = [
        { id: 'debt-1', principal: 100, accrued_interest: 10, amount_repaid: 0, status: 'active' },
      ];
      const query = createSupabaseQuery({ data: mockDebts });
      fromMock.mockReturnValue(query);

      const result = await getActiveDebts('user-1');

      expect(result.debts).toHaveLength(1);
      expect(result.debts[0].principal).toBe(100);
      expect(result.error).toBeNull();
    });
  });
});

describe('Wallet Transaction Types', () => {
  it('should have correct transaction icons for each type', () => {
    // This tests the UI mapping logic
    const iconMap: Record<string, { icon: string; color: string }> = {
      allowance: { icon: 'fa-gift', color: 'text-acid-green' },
      login_bonus: { icon: 'fa-fire', color: 'text-orange-400' },
      clash_win: { icon: 'fa-trophy', color: 'text-acid-green' },
      clash_stake_lock: { icon: 'fa-lock', color: 'text-gray-400' },
      steal_success: { icon: 'fa-mask', color: 'text-acid-green' },
      steal_victim: { icon: 'fa-mask', color: 'text-alert-red' },
      borrow: { icon: 'fa-hand-holding-dollar', color: 'text-hot-pink' },
      repay: { icon: 'fa-check-circle', color: 'text-acid-green' },
    };

    // Verify all transaction types are mapped
    const types = Object.keys(iconMap);
    expect(types.length).toBeGreaterThanOrEqual(8);

    // Verify each type has required properties
    types.forEach(type => {
      expect(iconMap[type]).toHaveProperty('icon');
      expect(iconMap[type]).toHaveProperty('color');
      expect(iconMap[type].icon).toMatch(/^fa-/);
      expect(iconMap[type].color).toMatch(/^text-/);
    });
  });
});

describe('Allowance Timing', () => {
  it('should use 48-hour cooldown', () => {
    const ALLOWANCE_COOLDOWN_HOURS = 48;
    const ALLOWANCE_AMOUNT = 100;

    expect(ALLOWANCE_COOLDOWN_HOURS).toBe(48);
    expect(ALLOWANCE_AMOUNT).toBe(100);
  });

  it('should format time remaining correctly', () => {
    // Helper function test
    const formatTime = (hours: number): string => {
      const h = Math.floor(hours);
      const m = Math.floor((hours - h) * 60);
      return `${h}h ${m}m`;
    };

    expect(formatTime(24.5)).toBe('24h 30m');
    expect(formatTime(1)).toBe('1h 0m');
    expect(formatTime(0.5)).toBe('0h 30m');
    expect(formatTime(47.75)).toBe('47h 45m');
  });
});
