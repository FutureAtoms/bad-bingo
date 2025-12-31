import { beforeEach, describe, expect, it, vi, Mock } from 'vitest';
import {
  createMultiplayerBet,
  createBetForFriend,
  createBetForGroup,
  createBetForAllFriends,
  notifyBetParticipants,
  getMultiplayerBetDetails,
  checkBetSwipeStatus,
  getPendingBetInvitations,
  cancelMultiplayerBet,
} from '../services/multiplayerBets';
import { supabase } from '../services/supabase';
import { createSupabaseQuery } from './helpers/supabaseMock';

// Mock supabase
vi.mock('../services/supabase', () => ({
  supabase: {
    from: vi.fn(),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
    },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  },
}));

// Mock economy service
vi.mock('../services/economy', () => ({
  calculateStake: vi.fn().mockReturnValue(10),
  lockStake: vi.fn().mockResolvedValue(true),
  logTransaction: vi.fn().mockResolvedValue(undefined),
}));

// Mock notifications service
vi.mock('../services/notifications', () => ({
  createNotification: vi.fn().mockResolvedValue({ notification: { id: 'notif-1' }, error: null }),
}));

// Mock push token service
vi.mock('../services/pushTokenService', () => ({
  getUserPushTokens: vi.fn().mockResolvedValue({ tokens: ['token-1'], error: null }),
}));

const fromMock = supabase.from as unknown as Mock;

describe('multiplayerBets service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createBetForFriend', () => {
    it('should create a bet for a single friend', async () => {
      const creatorId = 'user-1';
      const friendId = 'user-2';

      // Mock creator lookup
      const creatorQuery = createSupabaseQuery({
        data: { id: creatorId, name: 'Creator', coins: 100 },
        error: null,
      });

      // Mock friendship verification
      const friendshipQuery = createSupabaseQuery({
        data: [{ user_id: creatorId, friend_id: friendId }],
        error: null,
      });

      // Mock stake lock (handled by mock)

      // Mock bet creation
      const betQuery = createSupabaseQuery({
        data: { id: 'bet-1', text: 'Test bet', base_stake: 10 },
        error: null,
      });

      // Mock participant creation
      const participantQuery = createSupabaseQuery({
        data: [
          { id: 'part-1', bet_id: 'bet-1', user_id: creatorId },
          { id: 'part-2', bet_id: 'bet-1', user_id: friendId },
        ],
        error: null,
      });

      fromMock
        .mockReturnValueOnce(creatorQuery) // creator lookup
        .mockReturnValueOnce(friendshipQuery) // friendship verification
        .mockReturnValueOnce(betQuery) // bet creation
        .mockReturnValueOnce(participantQuery); // participant creation

      const result = await createBetForFriend(creatorId, friendId, {
        text: 'Test bet',
        stakeAmount: 10,
      });

      expect(result.error).toBeNull();
      expect(result.bet).toBeDefined();
      expect(result.bet?.id).toBe('bet-1');
      expect(result.participants.length).toBe(2);
    });

    it('should fail if creator not found', async () => {
      const creatorQuery = createSupabaseQuery({
        data: null,
        error: { message: 'User not found' },
      });

      fromMock.mockReturnValue(creatorQuery);

      const result = await createBetForFriend('invalid-user', 'friend-1', {
        text: 'Test bet',
      });

      expect(result.error).toBe('Creator not found');
      expect(result.bet).toBeNull();
    });

    it('should fail if friend is not a valid friend', async () => {
      const creatorQuery = createSupabaseQuery({
        data: { id: 'user-1', coins: 100 },
        error: null,
      });

      const friendshipQuery = createSupabaseQuery({
        data: [], // No friendships
        error: null,
      });

      fromMock
        .mockReturnValueOnce(creatorQuery)
        .mockReturnValueOnce(friendshipQuery);

      const result = await createBetForFriend('user-1', 'not-a-friend', {
        text: 'Test bet',
      });

      expect(result.error).toBe('No valid friends in provided list');
      expect(result.bet).toBeNull();
    });
  });

  describe('createBetForGroup', () => {
    it('should create a bet for multiple friends', async () => {
      const creatorId = 'user-1';
      const friendIds = ['user-2', 'user-3', 'user-4'];

      const creatorQuery = createSupabaseQuery({
        data: { id: creatorId, name: 'Creator', coins: 200 },
        error: null,
      });

      const friendshipQuery = createSupabaseQuery({
        data: friendIds.map(id => ({ user_id: creatorId, friend_id: id })),
        error: null,
      });

      const betQuery = createSupabaseQuery({
        data: { id: 'bet-group', text: 'Group bet', base_stake: 15 },
        error: null,
      });

      const participantQuery = createSupabaseQuery({
        data: [
          { id: 'p1', bet_id: 'bet-group', user_id: creatorId },
          { id: 'p2', bet_id: 'bet-group', user_id: 'user-2' },
          { id: 'p3', bet_id: 'bet-group', user_id: 'user-3' },
          { id: 'p4', bet_id: 'bet-group', user_id: 'user-4' },
        ],
        error: null,
      });

      fromMock
        .mockReturnValueOnce(creatorQuery)
        .mockReturnValueOnce(friendshipQuery)
        .mockReturnValueOnce(betQuery)
        .mockReturnValueOnce(participantQuery);

      const result = await createBetForGroup(creatorId, friendIds, {
        text: 'Group bet',
        stakeAmount: 15,
      });

      expect(result.error).toBeNull();
      expect(result.bet?.text).toBe('Group bet');
      expect(result.participants.length).toBe(4);
    });

    it('should fail with empty friend list', async () => {
      const result = await createBetForGroup('user-1', [], {
        text: 'Test bet',
      });

      expect(result.error).toBe('No friends specified');
      expect(result.bet).toBeNull();
    });

    it('should filter out invalid friends from the list', async () => {
      const creatorId = 'user-1';
      const friendIds = ['user-2', 'invalid-user', 'user-3'];

      const creatorQuery = createSupabaseQuery({
        data: { id: creatorId, coins: 100 },
        error: null,
      });

      // Only user-2 and user-3 are valid friends
      const friendshipQuery = createSupabaseQuery({
        data: [
          { user_id: creatorId, friend_id: 'user-2' },
          { user_id: creatorId, friend_id: 'user-3' },
        ],
        error: null,
      });

      const betQuery = createSupabaseQuery({
        data: { id: 'bet-filtered', text: 'Filtered bet' },
        error: null,
      });

      const participantQuery = createSupabaseQuery({
        data: [
          { id: 'p1', user_id: creatorId },
          { id: 'p2', user_id: 'user-2' },
          { id: 'p3', user_id: 'user-3' },
        ],
        error: null,
      });

      fromMock
        .mockReturnValueOnce(creatorQuery)
        .mockReturnValueOnce(friendshipQuery)
        .mockReturnValueOnce(betQuery)
        .mockReturnValueOnce(participantQuery);

      const result = await createBetForGroup(creatorId, friendIds, {
        text: 'Filtered bet',
      });

      expect(result.error).toBeNull();
      expect(result.participants.length).toBe(3); // creator + 2 valid friends
    });
  });

  describe('createBetForAllFriends', () => {
    it('should create a bet for all accepted friends', async () => {
      const creatorId = 'user-1';

      const creatorQuery = createSupabaseQuery({
        data: { id: creatorId, name: 'Creator', coins: 500 },
        error: null,
      });

      // All friends query
      const allFriendsQuery = createSupabaseQuery({
        data: [
          { user_id: creatorId, friend_id: 'friend-1' },
          { user_id: creatorId, friend_id: 'friend-2' },
          { user_id: 'friend-3', friend_id: creatorId }, // Creator on other side
        ],
        error: null,
      });

      const betQuery = createSupabaseQuery({
        data: { id: 'bet-all', text: 'All friends bet', base_stake: 20 },
        error: null,
      });

      const participantQuery = createSupabaseQuery({
        data: [
          { id: 'p1', user_id: creatorId },
          { id: 'p2', user_id: 'friend-1' },
          { id: 'p3', user_id: 'friend-2' },
          { id: 'p4', user_id: 'friend-3' },
        ],
        error: null,
      });

      fromMock
        .mockReturnValueOnce(creatorQuery)
        .mockReturnValueOnce(allFriendsQuery)
        .mockReturnValueOnce(betQuery)
        .mockReturnValueOnce(participantQuery);

      const result = await createBetForAllFriends(creatorId, {
        text: 'All friends bet',
        stakeAmount: 20,
      });

      expect(result.error).toBeNull();
      expect(result.bet?.text).toBe('All friends bet');
      expect(result.participants.length).toBe(4);
    });

    it('should fail if user has no friends', async () => {
      const creatorQuery = createSupabaseQuery({
        data: { id: 'lonely-user', coins: 100 },
        error: null,
      });

      const emptyFriendsQuery = createSupabaseQuery({
        data: [],
        error: null,
      });

      fromMock
        .mockReturnValueOnce(creatorQuery)
        .mockReturnValueOnce(emptyFriendsQuery);

      const result = await createBetForAllFriends('lonely-user', {
        text: 'No friends bet',
      });

      expect(result.error).toBe('No friends to create bet with');
      expect(result.bet).toBeNull();
    });
  });

  describe('notifyBetParticipants', () => {
    it('should send notifications to all participants', async () => {
      const bet = {
        id: 'bet-1',
        text: 'Test notification bet',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      } as any;

      const participantIds = ['user-2', 'user-3', 'user-4'];

      const result = await notifyBetParticipants(
        bet,
        'user-1',
        'Creator Name',
        participantIds,
        25
      );

      expect(result.notificationsSent).toBe(3);
      expect(result.pushNotificationsSent).toBeGreaterThanOrEqual(0);
    });
  });

  describe('checkBetSwipeStatus', () => {
    it('should correctly count swipe statuses', async () => {
      const participantsQuery = createSupabaseQuery({
        data: [
          { user_id: 'user-1', swipe: 'yes' },
          { user_id: 'user-2', swipe: 'no' },
          { user_id: 'user-3', swipe: null },
          { user_id: 'user-4', swipe: 'yes' },
        ],
        error: null,
      });

      fromMock.mockReturnValue(participantsQuery);

      const result = await checkBetSwipeStatus('bet-1');

      expect(result.yesCount).toBe(2);
      expect(result.noCount).toBe(1);
      expect(result.pendingCount).toBe(1);
      expect(result.allSwiped).toBe(false);
    });

    it('should return allSwiped true when all participants have swiped', async () => {
      const participantsQuery = createSupabaseQuery({
        data: [
          { user_id: 'user-1', swipe: 'yes' },
          { user_id: 'user-2', swipe: 'no' },
        ],
        error: null,
      });

      fromMock.mockReturnValue(participantsQuery);

      const result = await checkBetSwipeStatus('bet-1');

      expect(result.allSwiped).toBe(true);
      expect(result.pendingCount).toBe(0);
    });
  });

  describe('getMultiplayerBetDetails', () => {
    it('should return bet with all participants', async () => {
      const betQuery = createSupabaseQuery({
        data: { id: 'bet-1', text: 'Detail bet', base_stake: 10 },
        error: null,
      });

      const participantsQuery = createSupabaseQuery({
        data: [
          { id: 'p1', user_id: 'user-1', user: { id: 'user-1', name: 'User 1' } },
          { id: 'p2', user_id: 'user-2', user: { id: 'user-2', name: 'User 2' } },
        ],
        error: null,
      });

      fromMock
        .mockReturnValueOnce(betQuery)
        .mockReturnValueOnce(participantsQuery);

      const result = await getMultiplayerBetDetails('bet-1');

      expect(result.error).toBeNull();
      expect(result.bet?.text).toBe('Detail bet');
      expect(result.participants.length).toBe(2);
      expect(result.participants[0].user?.name).toBe('User 1');
    });

    it('should return error for non-existent bet', async () => {
      const betQuery = createSupabaseQuery({
        data: null,
        error: { message: 'Bet not found' },
      });

      fromMock.mockReturnValue(betQuery);

      const result = await getMultiplayerBetDetails('invalid-bet');

      expect(result.error).toBe('Bet not found');
      expect(result.bet).toBeNull();
    });
  });

  describe('getPendingBetInvitations', () => {
    it('should return bets where user has not swiped yet', async () => {
      const participationsQuery = createSupabaseQuery({
        data: [
          {
            bet_id: 'bet-1',
            bb_bets: {
              id: 'bet-1',
              text: 'Pending bet 1',
              expires_at: new Date(Date.now() + 3600000).toISOString(),
              creator: { id: 'creator-1', name: 'Creator 1' },
            },
          },
          {
            bet_id: 'bet-2',
            bb_bets: {
              id: 'bet-2',
              text: 'Pending bet 2',
              expires_at: new Date(Date.now() + 7200000).toISOString(),
              creator: { id: 'creator-2', name: 'Creator 2' },
            },
          },
        ],
        error: null,
      });

      fromMock.mockReturnValue(participationsQuery);

      const result = await getPendingBetInvitations('user-1');

      expect(result.error).toBeNull();
      expect(result.bets.length).toBe(2);
    });

    it('should filter out expired bets', async () => {
      const participationsQuery = createSupabaseQuery({
        data: [
          {
            bet_id: 'bet-expired',
            bb_bets: {
              id: 'bet-expired',
              text: 'Expired bet',
              expires_at: new Date(Date.now() - 3600000).toISOString(), // Already expired
            },
          },
          {
            bet_id: 'bet-active',
            bb_bets: {
              id: 'bet-active',
              text: 'Active bet',
              expires_at: new Date(Date.now() + 3600000).toISOString(),
            },
          },
        ],
        error: null,
      });

      fromMock.mockReturnValue(participationsQuery);

      const result = await getPendingBetInvitations('user-1');

      expect(result.bets.length).toBe(1);
      expect(result.bets[0].text).toBe('Active bet');
    });
  });

  describe('cancelMultiplayerBet', () => {
    it('should allow creator to cancel bet before anyone swipes', async () => {
      const betQuery = createSupabaseQuery({
        data: { id: 'bet-1', creator_id: 'user-1' },
        error: null,
      });

      // Check for other swipes (none)
      const otherSwipesQuery = createSupabaseQuery({
        data: [],
        error: null,
      });

      // Get creator's stake
      const stakeQuery = createSupabaseQuery({
        data: { stake_amount: 10 },
        error: null,
      });

      // Refund mock (get user coins)
      const userCoinsQuery = createSupabaseQuery({
        data: { coins: 90 },
        error: null,
      });

      // Update user coins
      const updateCoinsQuery = createSupabaseQuery({
        data: null,
        error: null,
      });

      // Log transaction
      const transactionQuery = createSupabaseQuery({
        data: null,
        error: null,
      });

      // Delete participants
      const deleteParticipantsQuery = createSupabaseQuery({
        data: null,
        error: null,
      });

      // Delete bet
      const deleteBetQuery = createSupabaseQuery({
        data: null,
        error: null,
      });

      fromMock
        .mockReturnValueOnce(betQuery)
        .mockReturnValueOnce(otherSwipesQuery)
        .mockReturnValueOnce(stakeQuery)
        .mockReturnValueOnce(userCoinsQuery)
        .mockReturnValueOnce(updateCoinsQuery)
        .mockReturnValueOnce(transactionQuery)
        .mockReturnValueOnce(deleteParticipantsQuery)
        .mockReturnValueOnce(deleteBetQuery);

      const result = await cancelMultiplayerBet('bet-1', 'user-1');

      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should not allow non-creator to cancel', async () => {
      const betQuery = createSupabaseQuery({
        data: null,
        error: null,
      });

      fromMock.mockReturnValue(betQuery);

      const result = await cancelMultiplayerBet('bet-1', 'not-creator');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Bet not found or you are not the creator');
    });

    it('should not allow cancellation after others have swiped', async () => {
      const betQuery = createSupabaseQuery({
        data: { id: 'bet-1', creator_id: 'user-1' },
        error: null,
      });

      const otherSwipesQuery = createSupabaseQuery({
        data: [{ user_id: 'user-2', swipe: 'yes' }], // Someone swiped
        error: null,
      });

      fromMock
        .mockReturnValueOnce(betQuery)
        .mockReturnValueOnce(otherSwipesQuery);

      const result = await cancelMultiplayerBet('bet-1', 'user-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot cancel: Other participants have already responded');
    });
  });

  describe('createMultiplayerBet stake calculation', () => {
    it('should use provided stake amount when specified', async () => {
      const creatorQuery = createSupabaseQuery({
        data: { id: 'user-1', coins: 100 },
        error: null,
      });

      const friendshipQuery = createSupabaseQuery({
        data: [{ user_id: 'user-1', friend_id: 'user-2' }],
        error: null,
      });

      const betQuery = createSupabaseQuery({
        data: { id: 'bet-1', base_stake: 50 },
        error: null,
      });

      const participantQuery = createSupabaseQuery({
        data: [],
        error: null,
      });

      fromMock
        .mockReturnValueOnce(creatorQuery)
        .mockReturnValueOnce(friendshipQuery)
        .mockReturnValueOnce(betQuery)
        .mockReturnValueOnce(participantQuery);

      const result = await createMultiplayerBet(
        'user-1',
        { type: 'single', friendIds: ['user-2'] },
        { text: 'Custom stake bet', stakeAmount: 50 }
      );

      // The bet insert should have used stake 50
      const insertCall = betQuery.insert.mock.calls[0][0];
      expect(insertCall.base_stake).toBe(50);
    });

    it('should calculate stake from balance when not specified', async () => {
      const { calculateStake } = await import('../services/economy');

      const creatorQuery = createSupabaseQuery({
        data: { id: 'user-1', coins: 200 },
        error: null,
      });

      const friendshipQuery = createSupabaseQuery({
        data: [{ user_id: 'user-1', friend_id: 'user-2' }],
        error: null,
      });

      const betQuery = createSupabaseQuery({
        data: { id: 'bet-1' },
        error: null,
      });

      const participantQuery = createSupabaseQuery({
        data: [],
        error: null,
      });

      fromMock
        .mockReturnValueOnce(creatorQuery)
        .mockReturnValueOnce(friendshipQuery)
        .mockReturnValueOnce(betQuery)
        .mockReturnValueOnce(participantQuery);

      await createMultiplayerBet(
        'user-1',
        { type: 'single', friendIds: ['user-2'] },
        { text: 'Auto stake bet' } // No stakeAmount
      );

      expect(calculateStake).toHaveBeenCalledWith(200);
    });
  });

  describe('expiry configuration', () => {
    it('should default to 2 hours expiry', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-01T12:00:00Z'));

      const creatorQuery = createSupabaseQuery({
        data: { id: 'user-1', coins: 100 },
        error: null,
      });

      const friendshipQuery = createSupabaseQuery({
        data: [{ user_id: 'user-1', friend_id: 'user-2' }],
        error: null,
      });

      const betQuery = createSupabaseQuery({
        data: { id: 'bet-1' },
        error: null,
      });

      const participantQuery = createSupabaseQuery({
        data: [],
        error: null,
      });

      fromMock
        .mockReturnValueOnce(creatorQuery)
        .mockReturnValueOnce(friendshipQuery)
        .mockReturnValueOnce(betQuery)
        .mockReturnValueOnce(participantQuery);

      await createMultiplayerBet(
        'user-1',
        { type: 'single', friendIds: ['user-2'] },
        { text: 'Default expiry bet' }
      );

      const insertCall = betQuery.insert.mock.calls[0][0];
      expect(new Date(insertCall.expires_at).toISOString()).toBe('2025-01-01T14:00:00.000Z');

      vi.useRealTimers();
    });

    it('should use custom expiry when provided', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-01T12:00:00Z'));

      const creatorQuery = createSupabaseQuery({
        data: { id: 'user-1', coins: 100 },
        error: null,
      });

      const friendshipQuery = createSupabaseQuery({
        data: [{ user_id: 'user-1', friend_id: 'user-2' }],
        error: null,
      });

      const betQuery = createSupabaseQuery({
        data: { id: 'bet-1' },
        error: null,
      });

      const participantQuery = createSupabaseQuery({
        data: [],
        error: null,
      });

      fromMock
        .mockReturnValueOnce(creatorQuery)
        .mockReturnValueOnce(friendshipQuery)
        .mockReturnValueOnce(betQuery)
        .mockReturnValueOnce(participantQuery);

      await createMultiplayerBet(
        'user-1',
        { type: 'single', friendIds: ['user-2'] },
        { text: 'Custom expiry bet', expiresInHours: 24 }
      );

      const insertCall = betQuery.insert.mock.calls[0][0];
      expect(new Date(insertCall.expires_at).toISOString()).toBe('2025-01-02T12:00:00.000Z');

      vi.useRealTimers();
    });
  });
});
