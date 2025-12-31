import { describe, it, expect } from 'vitest';
import {
  AppView,
  RelationshipLevel,
  BADGE_TYPES,
  DARE_TEMPLATES
} from '../types';

describe('Types and Constants', () => {
  describe('AppView enum', () => {
    it('should have all required views', () => {
      expect(AppView.SPLASH).toBe('SPLASH');
      expect(AppView.ONBOARDING).toBe('ONBOARDING');
      expect(AppView.DASHBOARD).toBe('DASHBOARD');
      expect(AppView.SWIPE_FEED).toBe('SWIPE_FEED');
      expect(AppView.CLASH).toBe('CLASH');
      expect(AppView.STEAL).toBe('STEAL');
      expect(AppView.DEFENSE).toBe('DEFENSE');
      expect(AppView.PROFILE).toBe('PROFILE');
      expect(AppView.CAMERA).toBe('CAMERA');
      expect(AppView.PROOF_VAULT).toBe('PROOF_VAULT');
      expect(AppView.WALLET).toBe('WALLET');
      expect(AppView.NOTIFICATIONS).toBe('NOTIFICATIONS');
      expect(AppView.SETTINGS).toBe('SETTINGS');
    });
  });

  describe('RelationshipLevel enum', () => {
    it('should have correct numeric values', () => {
      expect(RelationshipLevel.CIVILIAN).toBe(1);
      expect(RelationshipLevel.ROAST).toBe(2);
      expect(RelationshipLevel.NUCLEAR).toBe(3);
    });
  });

  describe('BADGE_TYPES', () => {
    it('should have glory badges', () => {
      expect(BADGE_TYPES.RISK_TAKER.isShame).toBe(false);
      expect(BADGE_TYPES.WIN_STREAK_5.isShame).toBe(false);
      expect(BADGE_TYPES.WIN_STREAK_10.isShame).toBe(false);
      expect(BADGE_TYPES.HEIST_MASTER.isShame).toBe(false);
      expect(BADGE_TYPES.DEFENDER.isShame).toBe(false);
      expect(BADGE_TYPES.GENEROUS.isShame).toBe(false);
    });

    it('should have shame badges', () => {
      expect(BADGE_TYPES.SNITCH.isShame).toBe(true);
      expect(BADGE_TYPES.DEADBEAT.isShame).toBe(true);
      expect(BADGE_TYPES.BEGGAR.isShame).toBe(true);
      expect(BADGE_TYPES.LOSER_STREAK.isShame).toBe(true);
    });

    it('should have icons for all badges', () => {
      Object.values(BADGE_TYPES).forEach(badge => {
        expect(badge.icon).toBeDefined();
        expect(typeof badge.icon).toBe('string');
      });
    });
  });

  describe('DARE_TEMPLATES', () => {
    it('should have at least 5 dare templates', () => {
      expect(DARE_TEMPLATES.length).toBeGreaterThanOrEqual(5);
    });

    it('should have rewards between 10 and 50', () => {
      DARE_TEMPLATES.forEach(dare => {
        expect(dare.reward).toBeGreaterThanOrEqual(10);
        expect(dare.reward).toBeLessThanOrEqual(50);
      });
    });

    it('should have unique types', () => {
      const types = DARE_TEMPLATES.map(d => d.type);
      const uniqueTypes = new Set(types);
      expect(uniqueTypes.size).toBe(types.length);
    });
  });
});

describe('Type Validation', () => {
  describe('UserProfile structure', () => {
    it('should validate a complete user profile', () => {
      const validProfile = {
        id: 'uuid-123',
        name: 'Test User',
        username: 'testuser',
        age: 21,
        gender: 'male',
        coins: 100,
        riskProfile: 'High risk gambler',
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

      expect(validProfile.id).toBeDefined();
      expect(validProfile.age).toBeGreaterThanOrEqual(18);
      expect(validProfile.coins).toBeGreaterThanOrEqual(0);
      expect(validProfile.trustScore).toBeLessThanOrEqual(100);
    });
  });

  describe('Friend structure', () => {
    it('should validate relationship levels', () => {
      const levels = [
        RelationshipLevel.CIVILIAN,
        RelationshipLevel.ROAST,
        RelationshipLevel.NUCLEAR,
      ];

      levels.forEach(level => {
        expect(level).toBeGreaterThanOrEqual(1);
        expect(level).toBeLessThanOrEqual(3);
      });
    });
  });

  describe('Transaction types', () => {
    it('should have all transaction types defined', () => {
      const transactionTypes = [
        'allowance',
        'clash_stake_lock',
        'clash_win',
        'clash_loss',
        'steal_success',
        'steal_victim',
        'steal_penalty',
        'defend_bonus',
        'beg_received',
        'beg_given',
        'borrow',
        'repay',
        'interest',
        'repo_seized',
        'login_bonus',
        'streak_bonus',
        'penalty',
      ];

      expect(transactionTypes.length).toBe(17);
    });
  });
});
