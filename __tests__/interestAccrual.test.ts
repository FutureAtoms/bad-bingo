import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { createSupabaseQuery } from './helpers/supabaseMock';

// Mock supabase
vi.mock('../services/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

import { supabase } from '../services/supabase';
import {
  accrueInterestOnDebt,
  accrueAllInterest,
  getTotalDebt,
  canBorrow,
} from '../services/economy';

const fromMock = supabase.from as unknown as Mock;

describe('Interest Accrual', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('accrueInterestOnDebt', () => {
    it('should accrue interest on active debt', async () => {
      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); // 25 hours ago
      fromMock
        .mockReturnValueOnce(createSupabaseQuery({
          data: {
            id: 'debt-1',
            principal: 100,
            accrued_interest: 0,
            amount_repaid: 0,
            interest_rate: 0.1,
            last_interest_accrual: oldDate,
            due_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            repo_triggered: false,
            borrower_id: 'user-1',
          },
        }))
        .mockReturnValueOnce(createSupabaseQuery({ data: null, error: null }));

      const result = await accrueInterestOnDebt('debt-1');

      expect(result.success).toBe(true);
      expect(result.newInterest).toBe(10); // 10% of 100
    });

    it('should not accrue if already accrued within 24 hours', async () => {
      const recentDate = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(); // 12 hours ago
      fromMock.mockReturnValue(createSupabaseQuery({
        data: {
          id: 'debt-1',
          principal: 100,
          accrued_interest: 0,
          amount_repaid: 0,
          interest_rate: 0.1,
          last_interest_accrual: recentDate,
          due_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
      }));

      const result = await accrueInterestOnDebt('debt-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('already accrued');
    });

    it('should return error for non-existent debt', async () => {
      fromMock.mockReturnValue(createSupabaseQuery({
        data: null,
        error: { message: 'Not found' },
      }));

      const result = await accrueInterestOnDebt('invalid-id');

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  describe('accrueAllInterest', () => {
    it('should process all active debts', async () => {
      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();

      // First call gets list of debts
      fromMock
        .mockReturnValueOnce(createSupabaseQuery({
          data: [{ id: 'debt-1' }, { id: 'debt-2' }],
        }))
        // Each debt fetch + update
        .mockReturnValueOnce(createSupabaseQuery({
          data: {
            id: 'debt-1',
            principal: 100,
            accrued_interest: 0,
            amount_repaid: 0,
            interest_rate: 0.1,
            last_interest_accrual: oldDate,
            due_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            repo_triggered: false,
          },
        }))
        .mockReturnValueOnce(createSupabaseQuery({ data: null }))
        .mockReturnValueOnce(createSupabaseQuery({
          data: {
            id: 'debt-2',
            principal: 200,
            accrued_interest: 10,
            amount_repaid: 0,
            interest_rate: 0.1,
            last_interest_accrual: oldDate,
            due_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            repo_triggered: false,
          },
        }))
        .mockReturnValueOnce(createSupabaseQuery({ data: null }));

      const result = await accrueAllInterest();

      expect(result.processed).toBe(2);
      expect(result.errors).toHaveLength(0);
    });

    it('should return empty when no active debts', async () => {
      fromMock.mockReturnValue(createSupabaseQuery({ data: [] }));

      const result = await accrueAllInterest();

      expect(result.processed).toBe(0);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('getTotalDebt', () => {
    it('should calculate total debt correctly', async () => {
      fromMock.mockReturnValue(createSupabaseQuery({
        data: [
          { principal: 100, accrued_interest: 10, amount_repaid: 20 },
          { principal: 200, accrued_interest: 30, amount_repaid: 0 },
        ],
      }));

      const result = await getTotalDebt('user-1');

      expect(result.principal).toBe(280); // (100-20) + 200
      expect(result.interest).toBe(40); // 10 + 30
      expect(result.total).toBe(320);
    });

    it('should return zero when no debts', async () => {
      fromMock.mockReturnValue(createSupabaseQuery({ data: [] }));

      const result = await getTotalDebt('user-1');

      expect(result.principal).toBe(0);
      expect(result.interest).toBe(0);
      expect(result.total).toBe(0);
    });
  });

  describe('canBorrow', () => {
    it('should allow borrowing within limit', async () => {
      // Get user
      fromMock
        .mockReturnValueOnce(createSupabaseQuery({
          data: { coins: 100, trust_score: 50 },
        }))
        // Get total debt
        .mockReturnValueOnce(createSupabaseQuery({ data: [] }));

      const result = await canBorrow('user-1', 50);

      expect(result.allowed).toBe(true);
      expect(result.maxBorrowable).toBe(200); // 100 * 2 (MAX_DEBT_RATIO)
    });

    it('should reject if trust score too low', async () => {
      fromMock.mockReturnValue(createSupabaseQuery({
        data: { coins: 100, trust_score: 20 },
      }));

      const result = await canBorrow('user-1', 50);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Trust score');
    });

    it('should reject if exceeds max borrowable', async () => {
      fromMock
        .mockReturnValueOnce(createSupabaseQuery({
          data: { coins: 100, trust_score: 50 },
        }))
        .mockReturnValueOnce(createSupabaseQuery({
          data: [{ principal: 180, accrued_interest: 10, amount_repaid: 0 }],
        }));

      const result = await canBorrow('user-1', 50);

      expect(result.allowed).toBe(false);
      expect(result.maxBorrowable).toBe(10); // 200 - 190
    });
  });
});

describe('Interest Calculation', () => {
  it('should calculate daily interest correctly', () => {
    const calculateDailyInterest = (totalOwed: number, rate: number) =>
      Math.ceil(totalOwed * rate);

    expect(calculateDailyInterest(100, 0.1)).toBe(10);
    expect(calculateDailyInterest(150, 0.1)).toBe(15);
    expect(calculateDailyInterest(99, 0.1)).toBe(10); // Ceil rounds up
    expect(calculateDailyInterest(1, 0.1)).toBe(1); // Minimum 1
  });

  it('should compound interest correctly over multiple days', () => {
    const calculateCompoundedDebt = (principal: number, rate: number, days: number) => {
      let total = principal;
      for (let i = 0; i < days; i++) {
        total += Math.ceil(total * rate);
      }
      return total;
    };

    // 100 at 10% for 3 days
    // Day 1: 100 + 10 = 110
    // Day 2: 110 + 11 = 121
    // Day 3: 121 + 13 = 134 (ceil of 12.1)
    expect(calculateCompoundedDebt(100, 0.1, 3)).toBe(134);
  });
});

describe('Debt Due Date', () => {
  it('should identify overdue debts', () => {
    const isOverdue = (dueAt: string) => new Date(dueAt).getTime() < Date.now();

    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    expect(isOverdue(pastDate)).toBe(true);
    expect(isOverdue(futureDate)).toBe(false);
  });

  it('should calculate days until due', () => {
    const daysUntilDue = (dueAt: string) => {
      const due = new Date(dueAt);
      const diff = due.getTime() - Date.now();
      return Math.ceil(diff / (24 * 60 * 60 * 1000));
    };

    const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(daysUntilDue(threeDaysFromNow)).toBe(3);
  });
});
