import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { createSupabaseQuery } from './helpers/supabaseMock';

// Mock supabase
vi.mock('../services/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { supabase } from '../services/supabase';
import { searchUsers, sendFriendRequest, getFriends, getPendingRequests } from '../services/friends';

const fromMock = supabase.from as unknown as Mock;

describe('AddFriend Search Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('searchUsers', () => {
    it('should return users matching the query', async () => {
      const mockUsers = [
        { id: 'user-1', name: 'Test User', username: 'testuser', email: 'test@test.com', coins: 100 },
        { id: 'user-2', name: 'Test User 2', username: 'testuser2', email: 'test2@test.com', coins: 200 },
      ];
      const query = createSupabaseQuery({ data: mockUsers });
      fromMock.mockReturnValue(query);

      const result = await searchUsers('test', 'current-user-id');

      expect(result.users).toHaveLength(2);
      expect(result.error).toBeNull();
    });

    it('should exclude the current user from results', async () => {
      const query = createSupabaseQuery({ data: [] });
      fromMock.mockReturnValue(query);

      await searchUsers('test', 'current-user-id');

      // Verify the chain was called with neq
      expect(query.neq).toHaveBeenCalledWith('id', 'current-user-id');
    });

    it('should return empty array on error', async () => {
      const query = createSupabaseQuery({ data: null, error: { message: 'DB Error' } });
      fromMock.mockReturnValue(query);

      const result = await searchUsers('test', 'current-user-id');

      expect(result.users).toEqual([]);
      expect(result.error).toBe('DB Error');
    });

    it('should use ilike for case-insensitive search', async () => {
      const query = createSupabaseQuery({ data: [] });
      fromMock.mockReturnValue(query);

      await searchUsers('TeStUser', 'current-user-id');

      expect(query.ilike).toHaveBeenCalledWith('username', '%TeStUser%');
    });
  });

  describe('sendFriendRequest', () => {
    it('should fail if friendship already exists', async () => {
      fromMock.mockReturnValue(createSupabaseQuery({
        data: { id: 'existing-friendship' },
      }));

      const result = await sendFriendRequest('user-1', 'user-2', ['answer1']);

      expect(result.friendship).toBeNull();
      expect(result.error).toContain('already exists');
    });

    it('should fail if friend not found', async () => {
      fromMock
        .mockReturnValueOnce(createSupabaseQuery({ data: null })) // No existing friendship
        .mockReturnValueOnce(createSupabaseQuery({ data: null })); // Friend not found

      const result = await sendFriendRequest('user-1', 'user-2', ['answer1']);

      expect(result.friendship).toBeNull();
      expect(result.error).toBe('Friend not found');
    });
  });

  describe('getFriends', () => {
    it('should return accepted friends with profiles', async () => {
      const mockFriends = [
        {
          id: 'fs-1',
          user_id: 'user-1',
          friend_id: 'friend-1',
          status: 'accepted',
          friend: { id: 'friend-1', name: 'Friend 1', username: 'friend1', coins: 100 },
        },
      ];
      const query = createSupabaseQuery({ data: mockFriends });
      fromMock.mockReturnValue(query);

      const result = await getFriends('user-1');

      expect(result.friends).toHaveLength(1);
      expect(result.friends[0].friend.name).toBe('Friend 1');
      expect(result.error).toBeNull();
    });

    it('should filter by accepted status', async () => {
      const query = createSupabaseQuery({ data: [] });
      fromMock.mockReturnValue(query);

      await getFriends('user-1');

      expect(query.eq).toHaveBeenCalledWith('status', 'accepted');
    });

    it('should return empty array on error', async () => {
      const query = createSupabaseQuery({ data: null, error: { message: 'DB Error' } });
      fromMock.mockReturnValue(query);

      const result = await getFriends('user-1');

      expect(result.friends).toEqual([]);
      expect(result.error).toBe('DB Error');
    });
  });

  describe('getPendingRequests', () => {
    it('should return pending incoming requests', async () => {
      const mockRequests = [
        {
          id: 'fs-1',
          user_id: 'sender-1',
          friend_id: 'user-1',
          status: 'pending',
          friend: { id: 'sender-1', name: 'Sender', username: 'sender', coins: 100 },
        },
      ];
      const query = createSupabaseQuery({ data: mockRequests });
      fromMock.mockReturnValue(query);

      const result = await getPendingRequests('user-1');

      expect(result.requests).toHaveLength(1);
      expect(result.error).toBeNull();
    });

    it('should filter by pending status', async () => {
      const query = createSupabaseQuery({ data: [] });
      fromMock.mockReturnValue(query);

      await getPendingRequests('user-1');

      expect(query.eq).toHaveBeenCalledWith('status', 'pending');
    });
  });
});

describe('Friend Request Validation', () => {
  it('should validate survey answers length', () => {
    const minSurveyAnswers = 4;
    const validAnswers = ['a1', 'a2', 'a3', 'a4'];
    const invalidAnswers = ['a1', 'a2'];

    expect(validAnswers.length >= minSurveyAnswers).toBe(true);
    expect(invalidAnswers.length >= minSurveyAnswers).toBe(false);
  });

  it('should validate username search query length', () => {
    const minQueryLength = 2;

    expect('ab'.length >= minQueryLength).toBe(true);
    expect('a'.length >= minQueryLength).toBe(false);
    expect(''.length >= minQueryLength).toBe(false);
  });
});

describe('Relationship Level Mapping', () => {
  it('should have correct heat levels', () => {
    const heatLevels = {
      CHILL: 1,
      ROAST: 2,
      NUCLEAR: 3,
    };

    expect(heatLevels.CHILL).toBe(1);
    expect(heatLevels.ROAST).toBe(2);
    expect(heatLevels.NUCLEAR).toBe(3);
  });

  it('should map heat level to bet permissions', () => {
    const getBetPermissions = (heatLevel: number) => ({
      safeBets: true,
      embarrassingBets: heatLevel >= 2,
      locationBets: heatLevel >= 3,
      secretBets: heatLevel >= 3,
      videoProof: heatLevel >= 2,
      viewOnceProof: heatLevel >= 3,
    });

    const chillPerms = getBetPermissions(1);
    expect(chillPerms.safeBets).toBe(true);
    expect(chillPerms.embarrassingBets).toBe(false);
    expect(chillPerms.locationBets).toBe(false);

    const roastPerms = getBetPermissions(2);
    expect(roastPerms.embarrassingBets).toBe(true);
    expect(roastPerms.videoProof).toBe(true);
    expect(roastPerms.locationBets).toBe(false);

    const nuclearPerms = getBetPermissions(3);
    expect(nuclearPerms.locationBets).toBe(true);
    expect(nuclearPerms.secretBets).toBe(true);
    expect(nuclearPerms.viewOnceProof).toBe(true);
  });
});
