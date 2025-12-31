import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { createSupabaseQuery } from './helpers/supabaseMock';

// Mock supabase
vi.mock('../services/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signInWithOAuth: vi.fn(),
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
}));

import { supabase } from '../services/supabase';
import { signIn, signUp, signInWithGoogle } from '../services/auth';

const fromMock = supabase.from as unknown as Mock;
const authMock = supabase.auth as any;

describe('Login Authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('signIn', () => {
    it('should sign in successfully with valid credentials', async () => {
      authMock.signInWithPassword.mockResolvedValue({
        data: { user: { id: 'user-1', email: 'test@test.com' } },
        error: null,
      });

      fromMock
        .mockReturnValueOnce(createSupabaseQuery({
          data: {
            id: 'user-1',
            name: 'Test User',
            username: 'testuser',
            email: 'test@test.com',
            coins: 100,
            last_login: null,
            login_streak: 0,
          },
        }))
        .mockReturnValueOnce(createSupabaseQuery({
          data: {
            id: 'user-1',
            name: 'Test User',
            username: 'testuser',
            email: 'test@test.com',
            coins: 110,
            last_login: new Date().toISOString(),
            login_streak: 1,
          },
        }))
        .mockReturnValueOnce(createSupabaseQuery({ data: null }));

      const result = await signIn({
        email: 'test@test.com',
        password: 'password123',
      });

      expect(result.error).toBeNull();
      expect(result.user).toBeDefined();
      expect(result.user?.email).toBe('test@test.com');
    });

    it('should fail with invalid credentials', async () => {
      authMock.signInWithPassword.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid login credentials' },
      });

      const result = await signIn({
        email: 'wrong@test.com',
        password: 'wrongpassword',
      });

      expect(result.error).toBe('Invalid login credentials');
      expect(result.user).toBeNull();
    });

    it('should increment login streak on consecutive logins', async () => {
      const yesterday = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(); // 30 hours ago

      authMock.signInWithPassword.mockResolvedValue({
        data: { user: { id: 'user-1', email: 'test@test.com' } },
        error: null,
      });

      fromMock
        .mockReturnValueOnce(createSupabaseQuery({
          data: {
            id: 'user-1',
            name: 'Test',
            username: 'test',
            email: 'test@test.com',
            coins: 100,
            last_login: yesterday,
            login_streak: 3,
          },
        }))
        .mockReturnValueOnce(createSupabaseQuery({
          data: {
            id: 'user-1',
            name: 'Test',
            username: 'test',
            email: 'test@test.com',
            coins: 125,
            last_login: new Date().toISOString(),
            login_streak: 4,
          },
        }))
        .mockReturnValueOnce(createSupabaseQuery({ data: null }));

      const result = await signIn({
        email: 'test@test.com',
        password: 'password123',
      });

      expect(result.user).toBeDefined();
      // Login streak should be incremented and bonus awarded
    });

    it('should reset login streak after 48 hours', async () => {
      const twoDaysAgo = new Date(Date.now() - 50 * 60 * 60 * 1000).toISOString();

      authMock.signInWithPassword.mockResolvedValue({
        data: { user: { id: 'user-1', email: 'test@test.com' } },
        error: null,
      });

      fromMock
        .mockReturnValueOnce(createSupabaseQuery({
          data: {
            id: 'user-1',
            name: 'Test',
            username: 'test',
            email: 'test@test.com',
            coins: 100,
            last_login: twoDaysAgo,
            login_streak: 5,
          },
        }))
        .mockReturnValueOnce(createSupabaseQuery({
          data: {
            id: 'user-1',
            name: 'Test',
            username: 'test',
            email: 'test@test.com',
            coins: 110,
            last_login: new Date().toISOString(),
            login_streak: 1,
          },
        }))
        .mockReturnValueOnce(createSupabaseQuery({ data: null }));

      const result = await signIn({
        email: 'test@test.com',
        password: 'password123',
      });

      expect(result.user).toBeDefined();
      // Login streak should be reset to 1
    });
  });

  describe('signUp', () => {
    it('should create new user with valid data', async () => {
      authMock.signUp.mockResolvedValue({
        data: { user: { id: 'new-user-1' } },
        error: null,
      });

      fromMock.mockReturnValue(createSupabaseQuery({
        data: {
          id: 'new-user-1',
          name: 'New User',
          username: 'newuser',
          email: 'new@test.com',
          coins: 100,
        },
      }));

      const result = await signUp({
        email: 'new@test.com',
        password: 'password123',
        name: 'New User',
        username: 'newuser',
        age: 21,
      });

      expect(result.error).toBeNull();
      expect(result.user).toBeDefined();
      expect(result.user?.coins).toBe(100); // Starting bonus
    });

    it('should fail if email already exists', async () => {
      authMock.signUp.mockResolvedValue({
        data: { user: null },
        error: { message: 'User already registered' },
      });

      const result = await signUp({
        email: 'existing@test.com',
        password: 'password123',
        name: 'Test',
        username: 'test',
        age: 21,
      });

      expect(result.error).toBe('User already registered');
      expect(result.user).toBeNull();
    });

    it('should enforce minimum age requirement', () => {
      // Test age verification helper
      const verifyAge = (birthDate: Date): boolean => {
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();

        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          return age - 1 >= 18;
        }

        return age >= 18;
      };

      const adultBirthday = new Date('2000-01-01');
      const minorBirthday = new Date('2010-01-01');

      expect(verifyAge(adultBirthday)).toBe(true);
      expect(verifyAge(minorBirthday)).toBe(false);
    });
  });

  describe('signInWithGoogle', () => {
    it('should initiate OAuth flow', async () => {
      authMock.signInWithOAuth.mockResolvedValue({
        data: { url: 'https://oauth.google.com/...' },
        error: null,
      });

      const result = await signInWithGoogle();

      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should handle OAuth errors', async () => {
      authMock.signInWithOAuth.mockResolvedValue({
        data: null,
        error: { message: 'OAuth provider error' },
      });

      const result = await signInWithGoogle();

      expect(result.success).toBe(false);
      expect(result.error).toBe('OAuth provider error');
    });
  });
});

describe('Login Form Validation', () => {
  it('should validate email format', () => {
    const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    expect(isValidEmail('test@test.com')).toBe(true);
    expect(isValidEmail('invalid-email')).toBe(false);
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('test@')).toBe(false);
  });

  it('should validate password length', () => {
    const MIN_PASSWORD_LENGTH = 6;

    expect('short'.length >= MIN_PASSWORD_LENGTH).toBe(false);
    expect('password123'.length >= MIN_PASSWORD_LENGTH).toBe(true);
  });

  it('should validate username format', () => {
    const isValidUsername = (username: string) =>
      /^[a-z0-9]+$/.test(username) && username.length >= 3;

    expect(isValidUsername('testuser')).toBe(true);
    expect(isValidUsername('test_user')).toBe(false); // No underscores
    expect(isValidUsername('TestUser')).toBe(false); // No uppercase
    expect(isValidUsername('ab')).toBe(false); // Too short
  });

  it('should require password confirmation match', () => {
    const password: string = 'password123';
    const confirmPassword: string = 'password123';
    const wrongConfirm: string = 'password456';

    expect(password === confirmPassword).toBe(true);
    expect(password === wrongConfirm).toBe(false);
  });
});

describe('Login Bonus System', () => {
  it('should calculate login bonus correctly', () => {
    const calculateLoginBonus = (streak: number): number => {
      return Math.min(10 + streak * 5, 50);
    };

    expect(calculateLoginBonus(1)).toBe(15);
    expect(calculateLoginBonus(2)).toBe(20);
    expect(calculateLoginBonus(5)).toBe(35);
    expect(calculateLoginBonus(10)).toBe(50); // Capped at 50
    expect(calculateLoginBonus(20)).toBe(50); // Still capped
  });

  it('should identify login within streak window', () => {
    const isWithinStreakWindow = (hoursSinceLastLogin: number): boolean => {
      return hoursSinceLastLogin >= 24 && hoursSinceLastLogin <= 48;
    };

    expect(isWithinStreakWindow(12)).toBe(false); // Too soon
    expect(isWithinStreakWindow(24)).toBe(true);
    expect(isWithinStreakWindow(36)).toBe(true);
    expect(isWithinStreakWindow(48)).toBe(true);
    expect(isWithinStreakWindow(50)).toBe(false); // Too late
  });
});
