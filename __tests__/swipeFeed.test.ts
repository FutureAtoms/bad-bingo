import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { createSupabaseQuery } from './helpers/supabaseMock';

// Mock supabase
vi.mock('../services/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

// Mock gemini service
vi.mock('../services/geminiService', () => ({
  generateDailyBets: vi.fn().mockResolvedValue([
    { id: 'bet-1', text: 'Test bet', category: 'social', backgroundType: 'default', stake: 20, friendVote: true },
  ]),
}));

// Mock economy service - lockStakeForSwipe is now called by swipeBet
vi.mock('../services/economy', () => ({
  lockStakeForSwipe: vi.fn().mockResolvedValue({ success: true, newBalance: 80, error: null }),
}));

// Mock notificationBroadcast service
vi.mock('../services/notificationBroadcast', () => ({
  broadcastClashCreated: vi.fn().mockResolvedValue({
    totalRecipients: 2,
    notificationsSent: 2,
    pushNotificationsSent: 0,
    failures: [],
  }),
}));

import { supabase } from '../services/supabase';
import { generateBetsForFriend, swipeBet, getAvailableBets } from '../services/bets';
import { lockStakeForSwipe } from '../services/economy';

const fromMock = supabase.from as unknown as Mock;

describe('SwipeFeed Bet Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('swipeBet', () => {
    it('should record user swipe successfully', async () => {
      // Flow: 1. check existing participant, 2. upsert participant, 3. get all participants
      // lockStakeForSwipe is mocked separately
      fromMock
        .mockReturnValueOnce(createSupabaseQuery({ data: null, error: null })) // Check existing (none)
        .mockReturnValueOnce(createSupabaseQuery({ data: null, error: null })) // Upsert
        .mockReturnValueOnce(createSupabaseQuery({
          data: [{ user_id: 'user-1', swipe: 'yes', stake_amount: 20 }],
        })); // Get all participants

      const result = await swipeBet('bet-1', 'user-1', 'yes', 20);

      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should not create clash if only one user has swiped', async () => {
      fromMock
        .mockReturnValueOnce(createSupabaseQuery({ data: null, error: null })) // Check existing
        .mockReturnValueOnce(createSupabaseQuery({ data: null, error: null })) // Upsert
        .mockReturnValueOnce(createSupabaseQuery({
          data: [{ user_id: 'user-1', swipe: 'yes', stake_amount: 20 }],
        })); // Get all participants

      const result = await swipeBet('bet-1', 'user-1', 'yes', 20);

      expect(result.success).toBe(true);
      expect(result.clashCreated).toBe(false);
    });

    it('should create clash when two users swipe opposite', async () => {
      fromMock
        .mockReturnValueOnce(createSupabaseQuery({ data: null, error: null })) // Check existing
        .mockReturnValueOnce(createSupabaseQuery({ data: null, error: null })) // Upsert
        .mockReturnValueOnce(createSupabaseQuery({
          data: [
            { user_id: 'user-1', swipe: 'yes', stake_amount: 20 },
            { user_id: 'user-2', swipe: 'no', stake_amount: 20 },
          ],
        })) // Get all participants
        .mockReturnValueOnce(createSupabaseQuery({
          data: { id: 'clash-1' },
        })) // Insert clash
        .mockReturnValueOnce(createSupabaseQuery({
          data: { text: 'Test bet text' },
        })); // Get bet text for notification

      const result = await swipeBet('bet-1', 'user-1', 'yes', 20);

      expect(result.success).toBe(true);
      expect(result.clashCreated).toBe(true);
      expect(result.clashId).toBe('clash-1');
    });

    it('should not create clash when two users swipe same direction', async () => {
      fromMock
        .mockReturnValueOnce(createSupabaseQuery({ data: null, error: null })) // Check existing
        .mockReturnValueOnce(createSupabaseQuery({ data: null, error: null })) // Upsert
        .mockReturnValueOnce(createSupabaseQuery({
          data: [
            { user_id: 'user-1', swipe: 'yes', stake_amount: 20 },
            { user_id: 'user-2', swipe: 'yes', stake_amount: 20 },
          ],
        })); // Get all participants (same direction = hairball)

      const result = await swipeBet('bet-1', 'user-1', 'yes', 20);

      expect(result.success).toBe(true);
      expect(result.clashCreated).toBe(false);
    });
  });

  describe('getAvailableBets', () => {
    it('should return bets user has not swiped on', async () => {
      const mockBets = [
        {
          id: 'bet-1',
          text: 'Test bet 1',
          expires_at: new Date(Date.now() + 3600000).toISOString(),
          available_at: new Date(Date.now() - 3600000).toISOString(),
          is_approved: true,
          bb_bet_participants: [],
        },
        {
          id: 'bet-2',
          text: 'Test bet 2',
          expires_at: new Date(Date.now() + 3600000).toISOString(),
          available_at: new Date(Date.now() - 3600000).toISOString(),
          is_approved: true,
          bb_bet_participants: [{ user_id: 'user-1', swipe: 'yes' }], // Already swiped
        },
      ];
      const query = createSupabaseQuery({ data: mockBets });
      fromMock.mockReturnValue(query);

      const result = await getAvailableBets('user-1');

      expect(result.bets).toHaveLength(1);
      expect(result.bets[0].id).toBe('bet-1');
    });

    it('should return empty array on error', async () => {
      const query = createSupabaseQuery({ data: null, error: { message: 'DB Error' } });
      fromMock.mockReturnValue(query);

      const result = await getAvailableBets('user-1');

      expect(result.bets).toEqual([]);
      expect(result.error).toBe('DB Error');
    });
  });
});

describe('Bet Swipe Logic', () => {
  it('should correctly determine if swipes are opposite', () => {
    const areOpposite = (swipe1: 'yes' | 'no', swipe2: 'yes' | 'no') => swipe1 !== swipe2;

    expect(areOpposite('yes', 'no')).toBe(true);
    expect(areOpposite('no', 'yes')).toBe(true);
    expect(areOpposite('yes', 'yes')).toBe(false);
    expect(areOpposite('no', 'no')).toBe(false);
  });

  it('should calculate total pot correctly', () => {
    const calculatePot = (stake1: number, stake2: number) => stake1 + stake2;

    expect(calculatePot(20, 20)).toBe(40);
    expect(calculatePot(50, 30)).toBe(80);
    expect(calculatePot(10, 10)).toBe(20);
  });

  it('should determine prover based on YES vote', () => {
    const determineProver = (user1Swipe: 'yes' | 'no', user1Id: string, user2Id: string) => {
      return user1Swipe === 'yes' ? user1Id : user2Id;
    };

    expect(determineProver('yes', 'user-1', 'user-2')).toBe('user-1');
    expect(determineProver('no', 'user-1', 'user-2')).toBe('user-2');
  });
});

describe('Bet Card Mapping', () => {
  it('should map DB bet to card format', () => {
    const dbBet = {
      id: 'bet-1',
      text: 'Test bet',
      category: 'social',
      background_type: 'bedroom',
      base_stake: 25,
    };

    const friend = {
      id: 'friend-1',
      name: 'Test Friend',
      relationshipLevel: 2,
    };

    const card = {
      id: dbBet.id,
      dbBetId: dbBet.id,
      text: dbBet.text,
      category: dbBet.category || 'general',
      backgroundType: dbBet.background_type || 'default',
      stake: dbBet.base_stake,
      friend,
    };

    expect(card.dbBetId).toBe('bet-1');
    expect(card.text).toBe('Test bet');
    expect(card.backgroundType).toBe('bedroom');
    expect(card.stake).toBe(25);
  });

  it('should use default values for missing properties', () => {
    const dbBet = {
      id: 'bet-1',
      text: 'Test bet',
      category: null,
      background_type: null,
      base_stake: 20,
    };

    const card = {
      id: dbBet.id,
      category: dbBet.category || 'general',
      backgroundType: dbBet.background_type || 'default',
    };

    expect(card.category).toBe('general');
    expect(card.backgroundType).toBe('default');
  });
});
