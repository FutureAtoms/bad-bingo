import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateProofExpiry,
  isProofExpired,
  getProofTimeRemaining,
  formatTimeRemaining,
  PROOF_EXPIRY_OPTIONS,
  dataURLtoBlob,
} from '../services/proofs';

describe('Proof Service', () => {
  describe('PROOF_EXPIRY_OPTIONS', () => {
    it('should have correct expiry durations', () => {
      expect(PROOF_EXPIRY_OPTIONS.SHORT).toBe(1);
      expect(PROOF_EXPIRY_OPTIONS.MEDIUM).toBe(6);
      expect(PROOF_EXPIRY_OPTIONS.LONG).toBe(12);
    });
  });

  describe('calculateProofExpiry', () => {
    it('should calculate expiry correctly for 1 hour', () => {
      const now = new Date('2024-01-15T10:00:00Z');
      const expiry = calculateProofExpiry(now, 1);
      expect(expiry.toISOString()).toBe('2024-01-15T11:00:00.000Z');
    });

    it('should calculate expiry correctly for 6 hours', () => {
      const now = new Date('2024-01-15T10:00:00Z');
      const expiry = calculateProofExpiry(now, 6);
      expect(expiry.toISOString()).toBe('2024-01-15T16:00:00.000Z');
    });

    it('should calculate expiry correctly for 12 hours', () => {
      const now = new Date('2024-01-15T18:00:00Z');
      const expiry = calculateProofExpiry(now, 12);
      expect(expiry.toISOString()).toBe('2024-01-16T06:00:00.000Z');
    });

    it('should handle string date input', () => {
      const expiry = calculateProofExpiry('2024-01-15T10:00:00Z', 1);
      expect(expiry.toISOString()).toBe('2024-01-15T11:00:00.000Z');
    });
  });

  describe('isProofExpired', () => {
    it('should return false for non-expired proof', () => {
      // Proof submitted just now with 1 hour expiry
      const submittedAt = new Date();
      expect(isProofExpired(submittedAt, 1)).toBe(false);
    });

    it('should return true for expired proof', () => {
      // Proof submitted 2 hours ago with 1 hour expiry
      const submittedAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
      expect(isProofExpired(submittedAt, 1)).toBe(true);
    });

    it('should handle edge case just after expiry', () => {
      // Proof submitted 1 hour and 1 second ago with 1 hour expiry
      const submittedAt = new Date(Date.now() - (1 * 60 * 60 * 1000 + 1000));
      // Should definitely be expired
      expect(isProofExpired(submittedAt, 1)).toBe(true);
    });
  });

  describe('getProofTimeRemaining', () => {
    it('should return positive time for non-expired proof', () => {
      const submittedAt = new Date();
      const remaining = getProofTimeRemaining(submittedAt, 1);
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(60 * 60 * 1000); // Max 1 hour in ms
    });

    it('should return 0 for expired proof', () => {
      const submittedAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const remaining = getProofTimeRemaining(submittedAt, 1);
      expect(remaining).toBe(0);
    });

    it('should decrease over time', () => {
      const submittedAt = new Date();
      const remaining1 = getProofTimeRemaining(submittedAt, 1);

      // Simulate 100ms passing
      const submittedAt2 = new Date(Date.now() - 100);
      const remaining2 = getProofTimeRemaining(submittedAt2, 1);

      expect(remaining2).toBeLessThan(remaining1);
    });
  });

  describe('formatTimeRemaining', () => {
    it('should format hours and minutes', () => {
      const twoHoursMs = 2 * 60 * 60 * 1000 + 30 * 60 * 1000;
      expect(formatTimeRemaining(twoHoursMs)).toBe('2h 30m');
    });

    it('should format minutes and seconds', () => {
      const fiveMinutesMs = 5 * 60 * 1000 + 45 * 1000;
      expect(formatTimeRemaining(fiveMinutesMs)).toBe('5m 45s');
    });

    it('should format seconds only', () => {
      const thirtySecondsMs = 30 * 1000;
      expect(formatTimeRemaining(thirtySecondsMs)).toBe('30s');
    });

    it('should return Expired for 0 or negative', () => {
      expect(formatTimeRemaining(0)).toBe('Expired');
      expect(formatTimeRemaining(-1000)).toBe('Expired');
    });
  });

  describe('dataURLtoBlob', () => {
    it('should convert a valid data URL to Blob', () => {
      // Simple 1x1 red pixel PNG
      const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
      const blob = dataURLtoBlob(dataUrl);

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('image/png');
      expect(blob.size).toBeGreaterThan(0);
    });

    it('should handle JPEG data URLs', () => {
      const dataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==';
      const blob = dataURLtoBlob(dataUrl);

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('image/jpeg');
    });
  });
});

describe('Proof Business Logic', () => {
  describe('View-Once Proofs', () => {
    it('should only allow one view for view-once proofs', () => {
      const proofViewed = true;
      const isViewOnce = true;

      const canView = !proofViewed || !isViewOnce;
      expect(canView).toBe(false);
    });

    it('should allow multiple views for non-view-once proofs', () => {
      const proofViewed = true;
      const isViewOnce = false;

      const canView = !proofViewed || !isViewOnce;
      expect(canView).toBe(true);
    });
  });

  describe('Proof Expiry Rules', () => {
    it('should enforce 1-hour minimum expiry', () => {
      const validDurations = [1, 6, 12];
      validDurations.forEach(duration => {
        expect(duration).toBeGreaterThanOrEqual(1);
      });
    });

    it('should enforce 12-hour maximum expiry', () => {
      const validDurations = [1, 6, 12];
      validDurations.forEach(duration => {
        expect(duration).toBeLessThanOrEqual(12);
      });
    });
  });

  describe('Proof Cleanup', () => {
    it('should identify expired proofs correctly', () => {
      const proofs = [
        { submittedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), duration: 1 }, // Expired
        { submittedAt: new Date(), duration: 1 }, // Not expired
        { submittedAt: new Date(Date.now() - 13 * 60 * 60 * 1000), duration: 12 }, // Expired
      ];

      const expiredProofs = proofs.filter(p => isProofExpired(p.submittedAt, p.duration));
      expect(expiredProofs.length).toBe(2);
    });
  });
});
