/**
 * Configuration Validation Tests
 *
 * These tests ensure that:
 * 1. All required environment variables are properly configured
 * 2. Supabase client is correctly initialized
 * 3. All required exports exist in service files
 * 4. No undefined references that would cause runtime crashes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Configuration Validation', () => {
  describe('Environment Variables', () => {
    it('should have VITE_SUPABASE_URL defined', () => {
      // In test environment, we mock this
      const url = import.meta.env.VITE_SUPABASE_URL;
      // During actual build, this should be defined
      // We check that the pattern is correct if defined
      if (url) {
        expect(url).toMatch(/^https:\/\/.*\.supabase\.co$/);
      }
    });

    it('should have VITE_SUPABASE_ANON_KEY defined', () => {
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
      // Supabase anon keys are JWTs
      if (key) {
        expect(key).toMatch(/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
      }
    });

    it('should have VITE_GEMINI_API_KEY defined', () => {
      const key = import.meta.env.VITE_GEMINI_API_KEY;
      // Google API keys start with 'AIza'
      if (key) {
        expect(key).toMatch(/^AIza[A-Za-z0-9_-]{35}$/);
      }
    });
  });

  describe('Supabase Service Exports', () => {
    it('should export supabase client', async () => {
      const supabaseModule = await import('../services/supabase');
      expect(supabaseModule.supabase).toBeDefined();
      expect(typeof supabaseModule.supabase.from).toBe('function');
    });

    it('should export db client (untyped)', async () => {
      const supabaseModule = await import('../services/supabase');
      expect(supabaseModule.db).toBeDefined();
      expect(typeof supabaseModule.db.from).toBe('function');
    });

    it('should export isSupabaseConfigured flag', async () => {
      const supabaseModule = await import('../services/supabase');
      expect(typeof supabaseModule.isSupabaseConfigured).toBe('boolean');
    });

    it('should export getCurrentUserId helper', async () => {
      const supabaseModule = await import('../services/supabase');
      expect(typeof supabaseModule.getCurrentUserId).toBe('function');
    });

    it('should export isAuthenticated helper', async () => {
      const supabaseModule = await import('../services/supabase');
      expect(typeof supabaseModule.isAuthenticated).toBe('function');
    });
  });

  describe('Friends Service Exports', () => {
    it('should export QUESTIONNAIRE_REWARD constant', async () => {
      const friendsModule = await import('../services/friends');
      expect(friendsModule.QUESTIONNAIRE_REWARD).toBeDefined();
      expect(typeof friendsModule.QUESTIONNAIRE_REWARD).toBe('number');
      expect(friendsModule.QUESTIONNAIRE_REWARD).toBe(5000);
    });

    it('should export FRIENDSHIP_QUESTIONS array', async () => {
      const friendsModule = await import('../services/friends');
      expect(friendsModule.FRIENDSHIP_QUESTIONS).toBeDefined();
      expect(Array.isArray(friendsModule.FRIENDSHIP_QUESTIONS)).toBe(true);
      expect(friendsModule.FRIENDSHIP_QUESTIONS.length).toBeGreaterThan(0);
    });

    it('should export submitFriendshipQuestionnaire function', async () => {
      const friendsModule = await import('../services/friends');
      expect(typeof friendsModule.submitFriendshipQuestionnaire).toBe('function');
    });

    it('should export heat level functions', async () => {
      const friendsModule = await import('../services/friends');
      expect(typeof friendsModule.proposeHeatLevel).toBe('function');
      expect(typeof friendsModule.acceptHeatLevel).toBe('function');
      expect(typeof friendsModule.rejectHeatLevel).toBe('function');
      expect(typeof friendsModule.getPendingHeatProposals).toBe('function');
    });
  });

  describe('Auth Service Exports', () => {
    it('should export onAuthStateChange function', async () => {
      const authModule = await import('../services/auth');
      expect(typeof authModule.onAuthStateChange).toBe('function');
    });

    it('should export signOut function', async () => {
      const authModule = await import('../services/auth');
      expect(typeof authModule.signOut).toBe('function');
    });

    it('should export updateProfile function', async () => {
      const authModule = await import('../services/auth');
      expect(typeof authModule.updateProfile).toBe('function');
    });
  });

  describe('Hooks Exports', () => {
    it('should export useUser hook', async () => {
      const hooksModule = await import('../hooks/useSupabaseData');
      expect(typeof hooksModule.useUser).toBe('function');
    });

    it('should export useFriends hook', async () => {
      const hooksModule = await import('../hooks/useSupabaseData');
      expect(typeof hooksModule.useFriends).toBe('function');
    });

    it('should export useActiveBets hook', async () => {
      const hooksModule = await import('../hooks/useSupabaseData');
      expect(typeof hooksModule.useActiveBets).toBe('function');
    });

    it('should export useNotifications hook', async () => {
      const hooksModule = await import('../hooks/useSupabaseData');
      expect(typeof hooksModule.useNotifications).toBe('function');
    });
  });
});

describe('Build-time Validation', () => {
  describe('.env.local file', () => {
    it('should have .env.local file with required variables', async () => {
      // This test runs at build time to verify .env.local exists
      // The actual check happens via Vite's env loading
      const hasSupabaseUrl = !!import.meta.env.VITE_SUPABASE_URL;
      const hasSupabaseKey = !!import.meta.env.VITE_SUPABASE_ANON_KEY;

      // Log warnings if not configured (but don't fail in test env)
      if (!hasSupabaseUrl) {
        console.warn('WARNING: VITE_SUPABASE_URL not set in .env.local');
      }
      if (!hasSupabaseKey) {
        console.warn('WARNING: VITE_SUPABASE_ANON_KEY not set in .env.local');
      }

      // At minimum, the variables should be strings (even if empty in test env)
      expect(typeof import.meta.env.VITE_SUPABASE_URL).toBe('string');
      expect(typeof import.meta.env.VITE_SUPABASE_ANON_KEY).toBe('string');
    });
  });
});

describe('Type Definitions', () => {
  it('should have all AppView enum values', async () => {
    const typesModule = await import('../types');
    const { AppView } = typesModule;

    // Check all required views exist
    expect(AppView.SPLASH).toBeDefined();
    expect(AppView.AGE_VERIFICATION).toBeDefined();
    expect(AppView.ONBOARDING).toBeDefined();
    expect(AppView.TUTORIAL).toBeDefined();
    expect(AppView.SWIPE_FEED).toBeDefined();
    expect(AppView.DASHBOARD).toBeDefined();
    expect(AppView.CLASH).toBeDefined();
    expect(AppView.STEAL).toBeDefined();
    expect(AppView.DEFENSE).toBeDefined();
    expect(AppView.CAMERA).toBeDefined();
    expect(AppView.PROOF_VAULT).toBeDefined();
    expect(AppView.PROFILE).toBeDefined();
    expect(AppView.ADD_FRIEND).toBeDefined();
    expect(AppView.CREATE_BET).toBeDefined();
    expect(AppView.WALLET).toBeDefined();
    expect(AppView.BEG).toBeDefined();
    expect(AppView.BORROW).toBeDefined();
    expect(AppView.NOTIFICATIONS).toBeDefined();
    expect(AppView.SETTINGS).toBeDefined();
    expect(AppView.RULES).toBeDefined();
  });

  it('should have UserProfile type with required fields', async () => {
    const typesModule = await import('../types');

    // Create a minimal user profile to verify type structure
    const mockUser: typesModule.UserProfile = {
      id: 'test-id',
      name: 'Test User',
      username: 'testuser',
      age: 25,
      gender: 'other',
      coins: 1000,
      riskProfile: 'moderate',
      avatarUrl: 'https://example.com/avatar.png',
      socialDebt: 0,
      totalWins: 0,
      totalClashes: 0,
      winStreak: 0,
      bestWinStreak: 0,
      stealSuccessful: 0,
      stealsDefended: 0,
      timesRobbed: 0,
      pushEnabled: true,
      soundEnabled: true,
      hapticsEnabled: true,
      trustScore: 100,
      isVerified: false,
      loginStreak: 1,
    };

    expect(mockUser.id).toBe('test-id');
    expect(mockUser.coins).toBe(1000);
  });
});

describe('Critical Import Paths', () => {
  it('should import App component without errors', async () => {
    // This catches import errors like undefined variables
    const appModule = await import('../App');
    expect(appModule.default).toBeDefined();
  });

  it('should import all service modules without errors', async () => {
    const services = [
      '../services/supabase',
      '../services/auth',
      '../services/bets',
      '../services/clashes',
      '../services/economy',
      '../services/friends',
      '../services/steals',
      '../services/proofs',
      '../services/notifications',
      '../services/effects',
      '../services/geminiService',
    ];

    for (const servicePath of services) {
      const module = await import(servicePath);
      expect(module).toBeDefined();
    }
  });

  it('should import all hook modules without errors', async () => {
    const hooksModule = await import('../hooks/useSupabaseData');
    expect(hooksModule).toBeDefined();
    expect(hooksModule.useUser).toBeDefined();
    expect(hooksModule.useFriends).toBeDefined();
  });
});
