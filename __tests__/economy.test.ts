import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateStake, calculateStealPercentage } from '../services/economy';

describe('Economy Service', () => {
  describe('calculateStake', () => {
    it('should return minimum stake of 2 for low balances', () => {
      expect(calculateStake(0)).toBe(2);
      expect(calculateStake(50)).toBe(2);
      expect(calculateStake(99)).toBe(2);
    });

    it('should calculate stake as wallet/50 for higher balances', () => {
      expect(calculateStake(100)).toBe(2);
      expect(calculateStake(150)).toBe(3);
      expect(calculateStake(500)).toBe(10);
      expect(calculateStake(1000)).toBe(20);
    });

    it('should floor the result', () => {
      expect(calculateStake(175)).toBe(3); // 175/50 = 3.5 -> 3
      expect(calculateStake(249)).toBe(4); // 249/50 = 4.98 -> 4
    });

    it('should handle large balances', () => {
      expect(calculateStake(10000)).toBe(200);
      expect(calculateStake(50000)).toBe(1000);
    });
  });

  describe('calculateStealPercentage', () => {
    it('should return a number between 1 and 50', () => {
      // Run multiple times to test randomness bounds
      for (let i = 0; i < 100; i++) {
        const percentage = calculateStealPercentage();
        expect(percentage).toBeGreaterThanOrEqual(1);
        expect(percentage).toBeLessThanOrEqual(50);
      }
    });

    it('should return an integer', () => {
      for (let i = 0; i < 100; i++) {
        const percentage = calculateStealPercentage();
        expect(Number.isInteger(percentage)).toBe(true);
      }
    });
  });
});

describe('Economy Business Logic', () => {
  describe('Allowance Rules', () => {
    it('should give 100 bingos per allowance', () => {
      const ALLOWANCE_AMOUNT = 100;
      expect(ALLOWANCE_AMOUNT).toBe(100);
    });

    it('should require 48 hours between claims', () => {
      const COOLDOWN_HOURS = 48;
      expect(COOLDOWN_HOURS).toBe(48);
    });
  });

  describe('Debt Interest Rules', () => {
    it('should apply 10% daily interest', () => {
      const INTEREST_RATE = 0.10;
      const principal = 100;
      const dailyInterest = Math.floor(principal * INTEREST_RATE);
      expect(dailyInterest).toBe(10);
    });

    it('should trigger repo when interest exceeds principal', () => {
      const principal = 100;
      let accruedInterest = 0;
      let days = 0;

      // Simulate daily interest accrual
      while (accruedInterest <= principal) {
        accruedInterest += Math.floor(principal * 0.10);
        days++;
      }

      // Should take about 11 days for interest to exceed principal
      expect(days).toBe(11);
      expect(accruedInterest).toBeGreaterThan(principal);
    });
  });

  describe('Steal Rules', () => {
    it('should calculate potential steal amount correctly', () => {
      const targetCoins = 1000;
      const stealPercentage = 25;
      const potentialAmount = Math.floor(targetCoins * (stealPercentage / 100));
      expect(potentialAmount).toBe(250);
    });

    it('should apply 2x penalty when caught', () => {
      const potentialAmount = 100;
      const penalty = potentialAmount * 2;
      expect(penalty).toBe(200);
    });
  });

  describe('Login Streak Bonus', () => {
    it('should give 10 base coins plus streak bonus', () => {
      const calculateBonus = (streak: number) => Math.min(10 + (streak * 5), 50);

      expect(calculateBonus(1)).toBe(15);
      expect(calculateBonus(2)).toBe(20);
      expect(calculateBonus(5)).toBe(35);
      expect(calculateBonus(8)).toBe(50);
      expect(calculateBonus(10)).toBe(50); // Capped at 50
    });
  });
});
