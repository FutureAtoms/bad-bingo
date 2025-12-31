import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { getUnreadCount, markAsRead } from '../../services/notifications';
import { supabase } from '../../services/supabase';
import { createSupabaseQuery } from '../helpers/supabaseMock';

const fromMock = supabase.from as unknown as Mock;

describe('notifications service', () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it('returns unread notification count', async () => {
    fromMock.mockReturnValue(
      createSupabaseQuery({ count: 3, error: null })
    );

    const result = await getUnreadCount('user-1');

    expect(result.error).toBeNull();
    expect(result.count).toBe(3);
  });

  it('marks a notification as read', async () => {
    const query = createSupabaseQuery({ data: null, error: null });
    fromMock.mockReturnValue(query);

    const result = await markAsRead('notif-1');

    expect(result.success).toBe(true);
    expect(query.update).toHaveBeenCalledWith(
      expect.objectContaining({ read: true })
    );
  });
});
