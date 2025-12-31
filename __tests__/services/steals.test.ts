import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { completeSteal, initiateSteal } from '../../services/steals';
import { supabase, db } from '../../services/supabase';
import { createSupabaseQuery } from '../helpers/supabaseMock';

vi.mock('../../services/economy', () => ({
  calculateStealPercentage: vi.fn(() => 25),
}));

const fromMock = supabase.from as unknown as Mock;

describe('steals service', () => {
  beforeEach(() => {
    fromMock.mockReset();
    vi.useRealTimers();
  });

  it('blocks stealing from broke targets', async () => {
    // Now initiateSteal fetches both thief and target data (deterministic steal calculation)
    const thiefQuery = createSupabaseQuery({
      data: { trust_score: 100, steals_successful: 0, steals_defended: 0 },
      error: null,
    });
    const targetQuery = createSupabaseQuery({
      data: { coins: 5, last_login: new Date().toISOString() },
      error: null,
    });

    fromMock.mockReturnValueOnce(thiefQuery).mockReturnValueOnce(targetQuery);

    const result = await initiateSteal('thief-1', 'target-1');

    expect(result.error).toContain('too broke');
    expect(result.steal).toBeNull();
  });

  it('marks online targets with a defense window', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));

    // Now initiateSteal fetches both thief and target data (deterministic steal calculation)
    const thiefQuery = createSupabaseQuery({
      data: { trust_score: 100, steals_successful: 0, steals_defended: 0 },
      error: null,
    });
    const targetQuery = createSupabaseQuery({
      data: { coins: 200, last_login: new Date().toISOString() },
      error: null,
    });
    const insertQuery = createSupabaseQuery({
      data: { id: 'steal-1', target_was_online: true },
      error: null,
    });

    fromMock
      .mockReturnValueOnce(thiefQuery)
      .mockReturnValueOnce(targetQuery)
      .mockReturnValueOnce(insertQuery);

    const result = await initiateSteal('thief-1', 'target-1');

    expect(result.error).toBeNull();
    expect(result.steal?.target_was_online).toBe(true);
    expect(insertQuery.insert.mock.calls[0][0].defense_window_end).toBeTruthy();
  });

  it('applies 2x penalty when a steal is defended', async () => {
    const stealQuery = createSupabaseQuery({
      data: {
        id: 'steal-2',
        status: 'in_progress',
        thief_id: 'thief-1',
        target_id: 'target-1',
        potential_amount: 50,
        target_was_online: true,
        defense_window_end: new Date(Date.now() + 10000).toISOString(),
        was_defended: true,
      },
      error: null,
    });
    const thiefQuery = createSupabaseQuery({
      data: { coins: 200 },
      error: null,
    });
    const thiefUpdateQuery = createSupabaseQuery({ data: null, error: null });
    const txQuery = createSupabaseQuery({ data: null, error: null });
    const stealUpdateQuery = createSupabaseQuery({ data: null, error: null });

    fromMock
      .mockReturnValueOnce(stealQuery)
      .mockReturnValueOnce(thiefQuery)
      .mockReturnValueOnce(thiefUpdateQuery)
      .mockReturnValueOnce(txQuery)
      .mockReturnValueOnce(stealUpdateQuery);

    const result = await completeSteal('steal-2', true);

    expect(result.success).toBe(false);
    expect(result.stolenAmount).toBe(0);
    expect(thiefUpdateQuery.update.mock.calls[0][0].coins).toBe(100);
    expect(stealUpdateQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'defended', thief_penalty: 100 })
    );
  });

  it('credits the thief and debits the target when a steal succeeds', async () => {
    const stealQuery = createSupabaseQuery({
      data: {
        id: 'steal-3',
        status: 'in_progress',
        thief_id: 'thief-1',
        target_id: 'target-1',
        potential_amount: 40,
        target_was_online: false,
        was_defended: false,
      },
      error: null,
    });
    const thiefQuery = createSupabaseQuery({
      data: { coins: 60, steals_successful: 1 },
      error: null,
    });
    const targetQuery = createSupabaseQuery({
      data: { coins: 80, times_robbed: 2 },
      error: null,
    });
    const thiefUpdateQuery = createSupabaseQuery({ data: null, error: null });
    const targetUpdateQuery = createSupabaseQuery({ data: null, error: null });
    const thiefTxQuery = createSupabaseQuery({ data: null, error: null });
    const targetTxQuery = createSupabaseQuery({ data: null, error: null });
    const stealUpdateQuery = createSupabaseQuery({ data: null, error: null });
    const notificationQuery = createSupabaseQuery({ data: null, error: null });

    fromMock
      .mockReturnValueOnce(stealQuery)
      .mockReturnValueOnce(thiefQuery)
      .mockReturnValueOnce(targetQuery)
      .mockReturnValueOnce(thiefUpdateQuery)
      .mockReturnValueOnce(targetUpdateQuery)
      .mockReturnValueOnce(thiefTxQuery)
      .mockReturnValueOnce(targetTxQuery)
      .mockReturnValueOnce(stealUpdateQuery)
      .mockReturnValueOnce(notificationQuery);

    const result = await completeSteal('steal-3', true);

    expect(result.success).toBe(true);
    expect(result.stolenAmount).toBe(40);
    expect(thiefUpdateQuery.update.mock.calls[0][0].coins).toBe(100);
    expect(targetUpdateQuery.update.mock.calls[0][0].coins).toBe(40);
  });
});
