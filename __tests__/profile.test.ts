/**
 * Profile Tests
 * Tests for bio field, profile picture editing, and related functionality
 */

import { describe, it, expect } from 'vitest';
import { UserProfile } from '../types';

describe('UserProfile Bio Field', () => {
  const createMockUser = (overrides: Partial<UserProfile> = {}): UserProfile => ({
    id: 'test-user-1',
    name: 'Test User',
    username: 'testuser',
    email: 'test@example.com',
    age: 25,
    gender: 'Male',
    coins: 1000,
    riskProfile: 'Calculated risk-taker',
    avatarUrl: 'https://example.com/avatar.jpg',
    socialDebt: 0,
    totalWins: 10,
    totalClashes: 20,
    winStreak: 3,
    bestWinStreak: 5,
    stealSuccessful: 2,
    stealsDefended: 1,
    timesRobbed: 3,
    pushEnabled: true,
    soundEnabled: true,
    hapticsEnabled: true,
    trustScore: 100,
    isVerified: false,
    loginStreak: 7,
    ...overrides,
  });

  describe('Bio Field Existence', () => {
    it('should allow bio field to be undefined', () => {
      const user = createMockUser();
      expect(user.bio).toBeUndefined();
    });

    it('should allow bio field to have a value', () => {
      const user = createMockUser({ bio: 'Professional stray, chaos enthusiast' });
      expect(user.bio).toBe('Professional stray, chaos enthusiast');
    });

    it('should allow empty string bio', () => {
      const user = createMockUser({ bio: '' });
      expect(user.bio).toBe('');
    });

    it('should allow long bio text', () => {
      const longBio = 'A'.repeat(500);
      const user = createMockUser({ bio: longBio });
      expect(user.bio).toHaveLength(500);
    });
  });

  describe('Bio Field with Extended Profile', () => {
    it('should work alongside other extended profile fields', () => {
      const user = createMockUser({
        bio: 'Night owl, coffee addict',
        work: 'Software Developer',
        schools: ['MIT', 'Stanford'],
        hasPets: true,
        petType: 'cat',
        siblingCount: 2,
        city: 'San Francisco',
      });

      expect(user.bio).toBe('Night owl, coffee addict');
      expect(user.work).toBe('Software Developer');
      expect(user.schools).toEqual(['MIT', 'Stanford']);
      expect(user.hasPets).toBe(true);
      expect(user.petType).toBe('cat');
      expect(user.siblingCount).toBe(2);
      expect(user.city).toBe('San Francisco');
    });

    it('should allow bio with special characters', () => {
      const user = createMockUser({ bio: "I'm a 🐱 lover! Can't stop, won't stop." });
      expect(user.bio).toContain('🐱');
      expect(user.bio).toContain("'");
    });

    it('should allow bio with newlines', () => {
      const user = createMockUser({ bio: 'Line 1\nLine 2\nLine 3' });
      expect(user.bio).toContain('\n');
      expect(user.bio?.split('\n')).toHaveLength(3);
    });
  });
});

describe('UserProfile Avatar Field', () => {
  const createMockUser = (overrides: Partial<UserProfile> = {}): UserProfile => ({
    id: 'test-user-1',
    name: 'Test User',
    username: 'testuser',
    age: 25,
    gender: 'Male',
    coins: 1000,
    riskProfile: 'Test profile',
    avatarUrl: 'https://example.com/avatar.jpg',
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
    ...overrides,
  });

  it('should require avatarUrl field', () => {
    const user = createMockUser();
    expect(user.avatarUrl).toBeDefined();
    expect(typeof user.avatarUrl).toBe('string');
  });

  it('should accept DiceBear URL format', () => {
    const diceBearUrl = 'https://api.dicebear.com/7.x/avataaars/svg?seed=test&backgroundColor=b6e3f4';
    const user = createMockUser({ avatarUrl: diceBearUrl });
    expect(user.avatarUrl).toContain('dicebear.com');
    expect(user.avatarUrl).toContain('avataaars');
  });

  it('should accept Supabase storage URL format', () => {
    const supabaseUrl = 'https://rsienbixfyzoiullonvw.supabase.co/storage/v1/object/public/proofs/avatars/user-1/photo.jpg';
    const user = createMockUser({ avatarUrl: supabaseUrl });
    expect(user.avatarUrl).toContain('supabase.co');
    expect(user.avatarUrl).toContain('storage');
  });

  it('should accept data URL format', () => {
    const dataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD';
    const user = createMockUser({ avatarUrl: dataUrl });
    expect(user.avatarUrl).toContain('data:image');
  });
});

describe('Extended Profile Fields', () => {
  const createMockUser = (overrides: Partial<UserProfile> = {}): UserProfile => ({
    id: 'test-user-1',
    name: 'Test User',
    username: 'testuser',
    age: 25,
    gender: 'Male',
    coins: 1000,
    riskProfile: 'Test profile',
    avatarUrl: 'https://example.com/avatar.jpg',
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
    ...overrides,
  });

  describe('Work Field', () => {
    it('should allow work field to be undefined', () => {
      const user = createMockUser();
      expect(user.work).toBeUndefined();
    });

    it('should allow work field to have a value', () => {
      const user = createMockUser({ work: 'Professional Chaos Agent' });
      expect(user.work).toBe('Professional Chaos Agent');
    });
  });

  describe('Schools Field', () => {
    it('should allow schools as array', () => {
      const user = createMockUser({ schools: ['School of Hard Knocks', 'University of Chaos'] });
      expect(user.schools).toHaveLength(2);
      expect(user.schools?.[0]).toBe('School of Hard Knocks');
    });

    it('should allow empty schools array', () => {
      const user = createMockUser({ schools: [] });
      expect(user.schools).toHaveLength(0);
    });
  });

  describe('Pets Fields', () => {
    it('should track hasPets boolean', () => {
      const user = createMockUser({ hasPets: true, petType: 'cat' });
      expect(user.hasPets).toBe(true);
      expect(user.petType).toBe('cat');
    });

    it('should allow hasPets false with null petType', () => {
      const user = createMockUser({ hasPets: false, petType: null });
      expect(user.hasPets).toBe(false);
      expect(user.petType).toBeNull();
    });
  });

  describe('City/Location Field', () => {
    it('should allow city field', () => {
      const user = createMockUser({ city: 'Tokyo' });
      expect(user.city).toBe('Tokyo');
    });

    it('should allow country field', () => {
      const user = createMockUser({ country: 'Japan' });
      expect(user.country).toBe('Japan');
    });
  });

  describe('Vices, Triggers, and Lies', () => {
    it('should track vices array', () => {
      const user = createMockUser({ vices: ['caffeine', 'doomscrolling'] });
      expect(user.vices).toHaveLength(2);
    });

    it('should track triggers array', () => {
      const user = createMockUser({ triggers: ['slow wifi', 'left on read'] });
      expect(user.triggers).toHaveLength(2);
    });

    it('should track common lies array', () => {
      const user = createMockUser({ commonLies: ["I'm fine", "On my way"] });
      expect(user.commonLies).toHaveLength(2);
    });
  });

  describe('Relationship Status', () => {
    it('should allow relationship status', () => {
      const user = createMockUser({ relationshipStatus: 'Situationship Hell' });
      expect(user.relationshipStatus).toBe('Situationship Hell');
    });
  });

  describe('Daily Routine', () => {
    it('should allow daily routine field', () => {
      const user = createMockUser({ dailyRoutine: 'Bed rot champion' });
      expect(user.dailyRoutine).toBe('Bed rot champion');
    });
  });
});

describe('Profile Picture Integration', () => {
  it('should maintain avatarUrl after profile update', () => {
    interface ProfileUpdate {
      name?: string;
      avatarUrl?: string;
      bio?: string;
    }

    const currentUser = {
      avatarUrl: 'https://old-avatar.jpg',
      name: 'Old Name',
    };

    const update: ProfileUpdate = {
      name: 'New Name',
    };

    const updatedUser = { ...currentUser, ...update };
    expect(updatedUser.avatarUrl).toBe('https://old-avatar.jpg');
    expect(updatedUser.name).toBe('New Name');
  });

  it('should update avatarUrl when explicitly provided', () => {
    interface ProfileUpdate {
      avatarUrl?: string;
    }

    const currentUser = {
      avatarUrl: 'https://old-avatar.jpg',
    };

    const update: ProfileUpdate = {
      avatarUrl: 'https://new-avatar-with-cat-filter.jpg',
    };

    const updatedUser = { ...currentUser, ...update };
    expect(updatedUser.avatarUrl).toBe('https://new-avatar-with-cat-filter.jpg');
  });
});
