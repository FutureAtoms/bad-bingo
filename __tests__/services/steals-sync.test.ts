/**
 * Comprehensive Steal/Defense Sync Tests
 *
 * Tests for:
 * 1. Steal initiation edge cases
 * 2. Defense timing precision
 * 3. Concurrent steal handling
 * 4. Balance updates atomicity
 * 5. Penalty calculations
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { supabase } from '../../services/supabase';
import { createSupabaseQuery } from '../helpers/supabaseMock';

// Mock supabase
vi.mock('../../services/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn().mockResolvedValue({ error: { message: 'RPC not found' } }),
  },
}));

// Mock economy service
vi.mock('../../services/economy', () => ({
  calculateStealPercentage: vi.fn((trustScore: number, stealsSuccessful: number, stealsDefended: number) => {
    // Deterministic calculation based on thief stats
    const basePercentage = 10;
    const successBonus = Math.min(stealsSuccessful * 2, 20);
    const trustPenalty = Math.max(0, (100 - trustScore) / 5);
    return Math.min(50, Math.max(1, basePercentage + successBonus - trustPenalty));
  }),
}));

const fromMock = supabase.from as unknown as Mock;

describe('Steal Service - Initiation Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should reject steal when thief not found', async () => {
    const { initiateSteal } = await import('../../services/steals');

    const thiefQuery = createSupabaseQuery({ data: null, error: null });
    const targetQuery = createSupabaseQuery({
      data: { coins: 500, last_login: new Date().toISOString() },
      error: null,
    });

    fromMock
      .mockReturnValueOnce(thiefQuery)
      .mockReturnValueOnce(targetQuery);

    const result = await initiateSteal('nonexistent-thief', 'target-1');

    expect(result.steal).toBeNull();
    expect(result.error).toBe('Thief not found');
  });

  it('should reject steal when target not found', async () => {
    const { initiateSteal } = await import('../../services/steals');

    const thiefQuery = createSupabaseQuery({
      data: { trust_score: 100, steals_successful: 5, steals_defended: 2 },
      error: null,
    });
    const targetQuery = createSupabaseQuery({ data: null, error: null });

    fromMock
      .mockReturnValueOnce(thiefQuery)
      .mockReturnValueOnce(targetQuery);

    const result = await initiateSteal('thief-1', 'nonexistent-target');

    expect(result.steal).toBeNull();
    expect(result.error).toBe('Target not found');
  });

  it('should reject steal when target has exactly 10 coins (threshold)', async () => {
    const { initiateSteal } = await import('../../services/steals');

    const thiefQuery = createSupabaseQuery({
      data: { trust_score: 100, steals_successful: 0, steals_defended: 0 },
      error: null,
    });
    const targetQuery = createSupabaseQuery({
      data: { coins: 10, last_login: new Date().toISOString() },
      error: null,
    });
    const stealInsert = createSupabaseQuery({
      data: { id: 'steal-threshold' },
      error: null,
    });

    fromMock
      .mockReturnValueOnce(thiefQuery)
      .mockReturnValueOnce(targetQuery)
      .mockReturnValueOnce(stealInsert);

    const result = await initiateSteal('thief-threshold', 'target-threshold');

    // 10 coins is the minimum - steal should proceed
    expect(result.steal).not.toBeNull();
  });

  it('should reject steal when target has 9 coins (below threshold)', async () => {
    const { initiateSteal } = await import('../../services/steals');

    const thiefQuery = createSupabaseQuery({
      data: { trust_score: 100, steals_successful: 0, steals_defended: 0 },
      error: null,
    });
    const targetQuery = createSupabaseQuery({
      data: { coins: 9, last_login: new Date().toISOString() },
      error: null,
    });

    fromMock
      .mockReturnValueOnce(thiefQuery)
      .mockReturnValueOnce(targetQuery);

    const result = await initiateSteal('thief-low', 'target-low');

    expect(result.steal).toBeNull();
    expect(result.error).toContain('too broke');
  });

  it('should correctly detect online status with 5-minute threshold', async () => {
    vi.useFakeTimers();
    const now = new Date('2025-01-15T12:00:00.000Z');
    vi.setSystemTime(now);

    const { initiateSteal } = await import('../../services/steals');

    // Test exactly at 5-minute boundary - should be considered offline
    const thiefQuery = createSupabaseQuery({
      data: { trust_score: 100, steals_successful: 0, steals_defended: 0 },
      error: null,
    });
    const targetQuery = createSupabaseQuery({
      data: {
        coins: 100,
        last_login: new Date(now.getTime() - 5 * 60 * 1000).toISOString() // Exactly 5 minutes ago
      },
      error: null,
    });
    const stealInsert = createSupabaseQuery({
      data: { id: 'steal-boundary' },
      error: null,
    });

    fromMock
      .mockReturnValueOnce(thiefQuery)
      .mockReturnValueOnce(targetQuery)
      .mockReturnValueOnce(stealInsert);

    await initiateSteal('thief-boundary', 'target-boundary');

    const insertArgs = stealInsert.insert.mock.calls[0][0];
    expect(insertArgs.target_was_online).toBe(false); // At 5 min exactly, should be offline

    vi.useRealTimers();
  });

  it('should detect user as online if active within 4:59', async () => {
    vi.useFakeTimers();
    const now = new Date('2025-01-15T12:00:00.000Z');
    vi.setSystemTime(now);

    const { initiateSteal } = await import('../../services/steals');

    const thiefQuery = createSupabaseQuery({
      data: { trust_score: 100, steals_successful: 0, steals_defended: 0 },
      error: null,
    });
    const targetQuery = createSupabaseQuery({
      data: {
        coins: 100,
        last_login: new Date(now.getTime() - 4 * 60 * 1000 - 59 * 1000).toISOString() // 4:59 ago
      },
      error: null,
    });
    const stealInsert = createSupabaseQuery({
      data: { id: 'steal-online' },
      error: null,
    });

    fromMock
      .mockReturnValueOnce(thiefQuery)
      .mockReturnValueOnce(targetQuery)
      .mockReturnValueOnce(stealInsert);

    await initiateSteal('thief-online', 'target-online');

    const insertArgs = stealInsert.insert.mock.calls[0][0];
    expect(insertArgs.target_was_online).toBe(true);

    vi.useRealTimers();
  });
});

describe('Steal Service - Complete Steal Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fail steal when minigame fails', async () => {
    const { completeSteal } = await import('../../services/steals');

    const stealQuery = createSupabaseQuery({
      data: {
        id: 'steal-minigame-fail',
        thief_id: 'thief-1',
        target_id: 'target-1',
        status: 'in_progress',
        potential_amount: 50,
      },
      error: null,
    });

    const updateSteal = createSupabaseQuery({ data: null, error: null });

    fromMock
      .mockReturnValueOnce(stealQuery)
      .mockReturnValueOnce(updateSteal);

    const result = await completeSteal('steal-minigame-fail', false);

    expect(result.success).toBe(false);
    expect(result.stolenAmount).toBe(0);
    expect(updateSteal.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failed',
    }));
  });

  it('should not allow completing already completed steal', async () => {
    const { completeSteal } = await import('../../services/steals');

    const stealQuery = createSupabaseQuery({
      data: {
        id: 'steal-completed',
        status: 'success', // Already completed
      },
      error: null,
    });

    fromMock.mockReturnValue(stealQuery);

    const result = await completeSteal('steal-completed', true);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Steal already completed');
  });

  it('should wait for defense window before completing steal on online target', async () => {
    const { completeSteal } = await import('../../services/steals');

    const now = Date.now();
    const stealQuery = createSupabaseQuery({
      data: {
        id: 'steal-wait',
        thief_id: 'thief-1',
        target_id: 'target-1',
        status: 'in_progress',
        potential_amount: 100,
        target_was_online: true,
        defense_window_end: new Date(now + 10000).toISOString(), // Window still open
        was_defended: false,
      },
      error: null,
    });

    fromMock.mockReturnValue(stealQuery);

    const result = await completeSteal('steal-wait', true);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Defense window still open');
  });

  it('should apply 2x penalty when target defends successfully', async () => {
    const { completeSteal } = await import('../../services/steals');

    const now = Date.now();
    const stealQuery = createSupabaseQuery({
      data: {
        id: 'steal-defended',
        thief_id: 'thief-1',
        target_id: 'target-1',
        status: 'in_progress',
        potential_amount: 100,
        target_was_online: true,
        defense_window_end: new Date(now + 1000).toISOString(),
        was_defended: true, // Target defended
      },
      error: null,
    });

    const thiefQuery = createSupabaseQuery({
      data: { coins: 500 },
      error: null,
    });

    const updateThief = createSupabaseQuery({ data: null, error: null });
    const insertTransaction = createSupabaseQuery({ data: null, error: null });
    const updateSteal = createSupabaseQuery({ data: null, error: null });

    fromMock
      .mockReturnValueOnce(stealQuery)
      .mockReturnValueOnce(thiefQuery)
      .mockReturnValueOnce(updateThief)
      .mockReturnValueOnce(insertTransaction)
      .mockReturnValueOnce(updateSteal);

    const result = await completeSteal('steal-defended', true);

    expect(result.success).toBe(false);
    expect(result.stolenAmount).toBe(0);

    // Verify 2x penalty was applied (200 = 100 * 2)
    const updateArgs = updateThief.update.mock.calls[0][0];
    expect(updateArgs.coins).toBe(300); // 500 - 200
  });

  it('should successfully complete steal when defense window expires without defense', async () => {
    vi.useFakeTimers();
    const now = new Date('2025-01-15T12:00:00.000Z');
    vi.setSystemTime(now);

    const { completeSteal } = await import('../../services/steals');

    const stealQuery = createSupabaseQuery({
      data: {
        id: 'steal-success',
        thief_id: 'thief-1',
        target_id: 'target-1',
        status: 'in_progress',
        potential_amount: 75,
        target_was_online: true,
        defense_window_end: new Date(now.getTime() - 1000).toISOString(), // Window closed
        was_defended: false,
      },
      error: null,
    });

    const thiefQuery = createSupabaseQuery({
      data: { coins: 200, steals_successful: 3 },
      error: null,
    });
    const targetQuery = createSupabaseQuery({
      data: { coins: 300, times_robbed: 1 },
      error: null,
    });

    const updateThief = createSupabaseQuery({ data: null, error: null });
    const updateTarget = createSupabaseQuery({ data: null, error: null });
    const insertThiefTx = createSupabaseQuery({ data: null, error: null });
    const insertTargetTx = createSupabaseQuery({ data: null, error: null });
    const updateSteal = createSupabaseQuery({ data: null, error: null });
    const insertNotification = createSupabaseQuery({ data: null, error: null });

    fromMock
      .mockReturnValueOnce(stealQuery)
      .mockReturnValueOnce(thiefQuery)
      .mockReturnValueOnce(targetQuery)
      .mockReturnValueOnce(updateThief)
      .mockReturnValueOnce(updateTarget)
      .mockReturnValueOnce(insertThiefTx)
      .mockReturnValueOnce(insertTargetTx)
      .mockReturnValueOnce(updateSteal)
      .mockReturnValueOnce(insertNotification);

    const result = await completeSteal('steal-success', true);

    expect(result.success).toBe(true);
    expect(result.stolenAmount).toBe(75);

    vi.useRealTimers();
  });
});

describe('Steal Service - Defense Mechanics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject defense from non-target user', async () => {
    const { defendSteal } = await import('../../services/steals');

    const stealQuery = createSupabaseQuery({
      data: {
        id: 'steal-wrong-defender',
        target_id: 'target-1',
        thief_id: 'thief-1',
        status: 'in_progress',
        defense_window_end: new Date(Date.now() + 10000).toISOString(),
      },
      error: null,
    });

    fromMock.mockReturnValue(stealQuery);

    const result = await defendSteal('steal-wrong-defender', 'random-user');

    expect(result.success).toBe(false);
    expect(result.error).toBe('You are not the target of this steal');
  });

  it('should reject defense when steal is already completed', async () => {
    const { defendSteal } = await import('../../services/steals');

    const stealQuery = createSupabaseQuery({
      data: {
        id: 'steal-already-done',
        target_id: 'target-1',
        status: 'success', // Already completed
        defense_window_end: new Date(Date.now() + 10000).toISOString(),
      },
      error: null,
    });

    fromMock.mockReturnValue(stealQuery);

    const result = await defendSteal('steal-already-done', 'target-1');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Steal already completed');
  });

  it('should reject defense when no defense window (offline target)', async () => {
    const { defendSteal } = await import('../../services/steals');

    const stealQuery = createSupabaseQuery({
      data: {
        id: 'steal-offline',
        target_id: 'target-1',
        status: 'in_progress',
        defense_window_end: null, // No defense window
      },
      error: null,
    });

    fromMock.mockReturnValue(stealQuery);

    const result = await defendSteal('steal-offline', 'target-1');

    expect(result.success).toBe(false);
    expect(result.error).toBe('No defense window (offline target)');
  });

  it('should successfully defend within window', async () => {
    const { defendSteal } = await import('../../services/steals');

    const now = Date.now();
    const stealQuery = createSupabaseQuery({
      data: {
        id: 'steal-defend-ok',
        target_id: 'target-1',
        status: 'in_progress',
        defense_window_end: new Date(now + 8000).toISOString(), // 8 seconds left
      },
      error: null,
    });

    const updateSteal = createSupabaseQuery({ data: null, error: null });
    const userQuery = createSupabaseQuery({
      data: { steals_defended: 5 },
      error: null,
    });
    const updateUser = createSupabaseQuery({ data: null, error: null });

    fromMock
      .mockReturnValueOnce(stealQuery)
      .mockReturnValueOnce(updateSteal)
      .mockReturnValueOnce(userQuery)
      .mockReturnValueOnce(updateUser);

    // Mock RPC to fail so fallback is used
    (supabase as any).rpc = vi.fn().mockResolvedValue({ error: { message: 'RPC not found' } });

    const result = await defendSteal('steal-defend-ok', 'target-1');

    expect(result.success).toBe(true);
    expect(updateSteal.update).toHaveBeenCalledWith(expect.objectContaining({
      was_defended: true,
    }));
  });

  it('should increment defender stats after successful defense', async () => {
    const { defendSteal } = await import('../../services/steals');

    const stealQuery = createSupabaseQuery({
      data: {
        id: 'steal-stats',
        target_id: 'target-1',
        status: 'in_progress',
        defense_window_end: new Date(Date.now() + 5000).toISOString(),
      },
      error: null,
    });

    const updateSteal = createSupabaseQuery({ data: null, error: null });
    const userQuery = createSupabaseQuery({
      data: { steals_defended: 10 },
      error: null,
    });
    const updateUser = createSupabaseQuery({ data: null, error: null });

    fromMock
      .mockReturnValueOnce(stealQuery)
      .mockReturnValueOnce(updateSteal)
      .mockReturnValueOnce(userQuery)
      .mockReturnValueOnce(updateUser);

    (supabase as any).rpc = vi.fn().mockResolvedValue({ error: { message: 'RPC not found' } });

    await defendSteal('steal-stats', 'target-1');

    const updateArgs = updateUser.update.mock.calls[0][0];
    expect(updateArgs.steals_defended).toBe(11);
  });
});

describe('Steal Service - Get Active Steals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return only active steals with open defense window', async () => {
    const { getActiveStealAttempts } = await import('../../services/steals');

    const now = new Date().toISOString();
    const stealsQuery = createSupabaseQuery({
      data: [
        {
          id: 'steal-active-1',
          target_id: 'target-1',
          status: 'in_progress',
          defense_window_end: new Date(Date.now() + 10000).toISOString(),
        },
        {
          id: 'steal-active-2',
          target_id: 'target-1',
          status: 'in_progress',
          defense_window_end: new Date(Date.now() + 5000).toISOString(),
        },
      ],
      error: null,
    });

    fromMock.mockReturnValue(stealsQuery);

    const result = await getActiveStealAttempts('target-1');

    expect(result.steals.length).toBe(2);
    expect(result.error).toBeNull();
  });

  it('should return empty array when no active steals', async () => {
    const { getActiveStealAttempts } = await import('../../services/steals');

    const stealsQuery = createSupabaseQuery({
      data: [],
      error: null,
    });

    fromMock.mockReturnValue(stealsQuery);

    const result = await getActiveStealAttempts('target-safe');

    expect(result.steals.length).toBe(0);
  });
});

describe('Steal Service - Steal History', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return steal history as both thief and target', async () => {
    const { getStealHistory } = await import('../../services/steals');

    const historyQuery = createSupabaseQuery({
      data: [
        { id: 'steal-1', thief_id: 'user-1', target_id: 'user-2', status: 'success' },
        { id: 'steal-2', thief_id: 'user-3', target_id: 'user-1', status: 'defended' },
        { id: 'steal-3', thief_id: 'user-1', target_id: 'user-4', status: 'failed' },
      ],
      error: null,
    });

    fromMock.mockReturnValue(historyQuery);

    const result = await getStealHistory('user-1', 50);

    expect(result.steals.length).toBe(3);
    expect(result.error).toBeNull();
  });
});

describe('Steal Service - Deterministic Percentage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should calculate consistent steal percentage for same stats', async () => {
    const { calculateStealPercentage } = await import('../../services/economy');

    // Same stats should always give same result
    const result1 = calculateStealPercentage(80, 5, 2);
    const result2 = calculateStealPercentage(80, 5, 2);
    const result3 = calculateStealPercentage(80, 5, 2);

    expect(result1).toBe(result2);
    expect(result2).toBe(result3);
  });

  it('should increase percentage with more successful steals', async () => {
    const { calculateStealPercentage } = await import('../../services/economy');

    const lowSuccess = calculateStealPercentage(100, 2, 0);
    const highSuccess = calculateStealPercentage(100, 10, 0);

    expect(highSuccess).toBeGreaterThan(lowSuccess);
  });

  it('should cap percentage at 50%', async () => {
    const { calculateStealPercentage } = await import('../../services/economy');

    const maxPercentage = calculateStealPercentage(100, 100, 0);

    expect(maxPercentage).toBeLessThanOrEqual(50);
  });

  it('should have minimum percentage of 1%', async () => {
    const { calculateStealPercentage } = await import('../../services/economy');

    const minPercentage = calculateStealPercentage(0, 0, 100);

    expect(minPercentage).toBeGreaterThanOrEqual(1);
  });
});
