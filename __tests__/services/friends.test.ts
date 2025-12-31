import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { acceptFriendRequest, sendFriendRequest } from '../../services/friends';
import { supabase } from '../../services/supabase';
import { createSupabaseQuery } from '../helpers/supabaseMock';

vi.mock('../../services/geminiService', () => ({
  generateFriendshipProfile: vi.fn().mockResolvedValue({
    level: 2,
    description: 'Chaos with extra spice.',
  }),
}));

const fromMock = supabase.from as unknown as Mock;

describe('friends service', () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it('blocks duplicate friend requests', async () => {
    fromMock.mockReturnValue(
      createSupabaseQuery({
        data: { id: 'friendship-1' },
        error: null,
      })
    );

    const result = await sendFriendRequest('user-1', 'user-2', ['a', 'b']);

    expect(result.friendship).toBeNull();
    expect(result.error).toContain('already exists');
  });

  it('creates a friend request and notification', async () => {
    const existingQuery = createSupabaseQuery({ data: null, error: null });
    const friendQuery = createSupabaseQuery({ data: { name: 'Rival' }, error: null });
    const insertQuery = createSupabaseQuery({ data: { id: 'friendship-2' }, error: null });
    const notifQuery = createSupabaseQuery({ data: null, error: null });

    fromMock
      .mockReturnValueOnce(existingQuery)
      .mockReturnValueOnce(friendQuery)
      .mockReturnValueOnce(insertQuery)
      .mockReturnValueOnce(notifQuery);

    const result = await sendFriendRequest('user-1', 'user-2', ['a', 'b', 'c']);

    expect(result.error).toBeNull();
    expect(result.friendship?.id).toBe('friendship-2');
    expect(insertQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        friend_id: 'user-2',
        heat_level: 2,
      })
    );
  });

  it('accepts a friend request and creates the reverse record', async () => {
    const friendshipQuery = createSupabaseQuery({
      data: {
        id: 'friendship-3',
        user_id: 'user-1',
        friend_id: 'user-2',
        user_proposed_heat: 2,
        heat_level: 2,
        relationship_description: 'We go way back.',
      },
      error: null,
    });
    const updateQuery = createSupabaseQuery({ data: null, error: null });
    const reverseQuery = createSupabaseQuery({ data: null, error: null });
    const notifQuery = createSupabaseQuery({ data: null, error: null });

    fromMock
      .mockReturnValueOnce(friendshipQuery)
      .mockReturnValueOnce(updateQuery)
      .mockReturnValueOnce(reverseQuery)
      .mockReturnValueOnce(notifQuery);

    const result = await acceptFriendRequest('friendship-3', 'user-2', 2);

    expect(result.success).toBe(true);
    expect(updateQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'accepted', heat_confirmed: true })
    );
    expect(reverseQuery.insert).toHaveBeenCalled();
  });
});
