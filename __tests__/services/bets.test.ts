import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { createBet, getAvailableBets, swipeBet } from '../../services/bets';
import { supabase } from '../../services/supabase';
import { createSupabaseQuery } from '../helpers/supabaseMock';
import * as economyModule from '../../services/economy';

const fromMock = supabase.from as unknown as Mock;

// Mock lockStakeForSwipe from economy module
vi.mock('../../services/economy', async () => {
  const actual = await vi.importActual('../../services/economy');
  return {
    ...actual,
    lockStakeForSwipe: vi.fn().mockResolvedValue({ success: true, newBalance: 100, error: null }),
  };
});

describe('bets service', () => {
  beforeEach(() => {
    fromMock.mockReset();
    vi.useRealTimers();
    // Reset the lockStakeForSwipe mock before each test
    vi.mocked(economyModule.lockStakeForSwipe).mockResolvedValue({ success: true, newBalance: 100, error: null });
  });

  it('filters out bets already swiped by the user', async () => {
    const bets = [
      {
        id: 'bet1',
        bb_bet_participants: [{ user_id: 'user-1', swipe: 'yes' }],
      },
      {
        id: 'bet2',
        bb_bet_participants: [{ user_id: 'user-2', swipe: 'no' }],
      },
      {
        id: 'bet3',
        bb_bet_participants: [],
      },
    ];

    fromMock.mockReturnValue(createSupabaseQuery({ data: bets, error: null }));

    const result = await getAvailableBets('user-1');

    expect(result.error).toBeNull();
    expect(result.bets.map((b) => b.id)).toEqual(['bet2', 'bet3']);
  });

  it('creates a clash when swipes are opposite', async () => {
    // Mock for checking existing participant (null means no existing swipe)
    const existingParticipantQuery = createSupabaseQuery({ data: null, error: { message: 'Not found', code: 'PGRST116' } as any });
    const upsertQuery = createSupabaseQuery({ data: null, error: null });
    const participantsQuery = createSupabaseQuery({
      data: [
        { user_id: 'user-1', swipe: 'yes', stake_amount: 10 },
        { user_id: 'user-2', swipe: 'no', stake_amount: 10 },
      ],
      error: null,
    });
    const clashQuery = createSupabaseQuery({ data: { id: 'clash-1' }, error: null });

    fromMock
      .mockReturnValueOnce(existingParticipantQuery) // Check existing participant
      .mockReturnValueOnce(upsertQuery) // Upsert participant
      .mockReturnValueOnce(participantsQuery) // Get all participants
      .mockReturnValueOnce(clashQuery); // Create clash

    const result = await swipeBet('bet-1', 'user-1', 'yes', 10);

    expect(result.success).toBe(true);
    expect(result.clashCreated).toBe(true);
    expect(result.clashId).toBe('clash-1');

    const insertArgs = clashQuery.insert.mock.calls[0][0];
    expect(insertArgs.prover_id).toBe('user-1');
    expect(insertArgs.total_pot).toBe(20);
  });

  it('returns no clash until both users swipe', async () => {
    // Mock for checking existing participant
    const existingParticipantQuery = createSupabaseQuery({ data: null, error: { message: 'Not found', code: 'PGRST116' } as any });
    const upsertQuery = createSupabaseQuery({ data: null, error: null });
    const participantsQuery = createSupabaseQuery({
      data: [{ user_id: 'user-1', swipe: 'yes', stake_amount: 10 }],
      error: null,
    });

    fromMock
      .mockReturnValueOnce(existingParticipantQuery)
      .mockReturnValueOnce(upsertQuery)
      .mockReturnValueOnce(participantsQuery);

    const result = await swipeBet('bet-2', 'user-1', 'yes', 10);

    expect(result.success).toBe(true);
    expect(result.clashCreated).toBe(false);
  });

  it('returns no clash when both swipes match', async () => {
    // Mock for checking existing participant
    const existingParticipantQuery = createSupabaseQuery({ data: null, error: { message: 'Not found', code: 'PGRST116' } as any });
    const upsertQuery = createSupabaseQuery({ data: null, error: null });
    const participantsQuery = createSupabaseQuery({
      data: [
        { user_id: 'user-1', swipe: 'no', stake_amount: 8 },
        { user_id: 'user-2', swipe: 'no', stake_amount: 8 },
      ],
      error: null,
    });

    fromMock
      .mockReturnValueOnce(existingParticipantQuery)
      .mockReturnValueOnce(upsertQuery)
      .mockReturnValueOnce(participantsQuery);

    const result = await swipeBet('bet-3', 'user-1', 'no', 8);

    expect(result.success).toBe(true);
    expect(result.clashCreated).toBe(false);
  });

  it('fails to swipe if user already swiped on this bet', async () => {
    // Mock for checking existing participant - user already swiped
    const existingParticipantQuery = createSupabaseQuery({
      data: { swipe: 'yes', stake_locked: true },
      error: null
    });

    fromMock.mockReturnValueOnce(existingParticipantQuery);

    const result = await swipeBet('bet-4', 'user-1', 'yes', 10);

    expect(result.success).toBe(false);
    expect(result.error).toBe('You already swiped on this bet');
  });

  it('fails to swipe if insufficient balance', async () => {
    // Mock for checking existing participant
    const existingParticipantQuery = createSupabaseQuery({ data: null, error: { message: 'Not found', code: 'PGRST116' } as any });

    // Mock lockStakeForSwipe to fail
    vi.mocked(economyModule.lockStakeForSwipe).mockResolvedValue({
      success: false,
      newBalance: 5,
      error: 'Not enough bingos! You broke?'
    });

    fromMock.mockReturnValueOnce(existingParticipantQuery);

    const result = await swipeBet('bet-5', 'user-1', 'yes', 50);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Not enough bingos! You broke?');
  });

  it('defaults to a 2-hour expiry window for new bets', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));

    const insertQuery = createSupabaseQuery({ data: { id: 'bet-99' }, error: null });
    fromMock.mockReturnValue(insertQuery);

    await createBet({
      text: 'Bet you skipped breakfast',
      baseStake: 4,
    });

    const insertArgs = insertQuery.insert.mock.calls[0][0];
    expect(insertArgs.background_type).toBe('default');
    expect(insertArgs.proof_type).toBe('photo');
    expect(insertArgs.target_type).toBe('all');
    expect(insertArgs.heat_level_required).toBe(1);
    expect(new Date(insertArgs.expires_at).toISOString()).toBe('2025-01-01T02:00:00.000Z');
  });
});
