import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { signIn, verifyAge } from '../../services/auth';
import { supabase } from '../../services/supabase';
import { createSupabaseQuery } from '../helpers/supabaseMock';

const fromMock = supabase.from as unknown as Mock;
const authMock = supabase.auth as unknown as {
  signInWithPassword: Mock;
};

describe('auth service', () => {
  beforeEach(() => {
    fromMock.mockReset();
    authMock.signInWithPassword.mockReset();
    vi.useRealTimers();
  });

  it('verifies users are 18+', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    const adultBirthDate = new Date('2000-01-01T00:00:00Z');
    const minorBirthDate = new Date('2010-01-01T00:00:00Z');

    expect(verifyAge(adultBirthDate)).toBe(true);
    expect(verifyAge(minorBirthDate)).toBe(false);
    vi.useRealTimers();
  });

  it('increments login streak when user returns within 24-48 hours', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-02T12:00:00Z'));

    authMock.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });

    const userQuery = createSupabaseQuery({
      data: {
        id: 'user-1',
        coins: 100,
        last_login: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
        login_streak: 2,
      },
      error: null,
    });
    const updateQuery = createSupabaseQuery({
      data: {
        id: 'user-1',
        coins: 125,
        login_streak: 3,
      },
      error: null,
    });
    const txQuery = createSupabaseQuery({ data: null, error: null });

    fromMock
      .mockReturnValueOnce(userQuery)
      .mockReturnValueOnce(updateQuery)
      .mockReturnValueOnce(txQuery);

    const result = await signIn({ email: 'test@example.com', password: 'secret' });

    expect(result.error).toBeNull();
    expect(updateQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({ login_streak: 3, coins: 125 })
    );
    expect(txQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'login_bonus' })
    );
  });

  it('resets login streak when user is away longer than 48 hours', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-05T12:00:00Z'));

    authMock.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'user-2' } },
      error: null,
    });

    const userQuery = createSupabaseQuery({
      data: {
        id: 'user-2',
        coins: 200,
        last_login: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
        login_streak: 5,
      },
      error: null,
    });
    const updateQuery = createSupabaseQuery({
      data: {
        id: 'user-2',
        coins: 210,
        login_streak: 1,
      },
      error: null,
    });
    const txQuery = createSupabaseQuery({ data: null, error: null });

    fromMock
      .mockReturnValueOnce(userQuery)
      .mockReturnValueOnce(updateQuery)
      .mockReturnValueOnce(txQuery);

    const result = await signIn({ email: 'test@example.com', password: 'secret' });

    expect(result.error).toBeNull();
    expect(updateQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({ login_streak: 1, coins: 210 })
    );
  });
});
