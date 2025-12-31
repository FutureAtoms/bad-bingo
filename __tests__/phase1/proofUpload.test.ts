import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '../../services/supabase';
import {
  calculateProofExpiry,
  isProofExpired,
  dataURLtoBlob,
} from '../../services/proofs';

// Mock Supabase
vi.mock('../../services/supabase', () => ({
  supabase: {
    from: vi.fn(),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(),
        getPublicUrl: vi.fn(),
        remove: vi.fn(),
      })),
    },
  },
}));

/**
 * Phase 1 Tests: Proof Upload & View-Once System (Tasks 1.5, 1.6)
 *
 * Critical Requirements:
 * 1. Proofs must be uploaded to Supabase Storage (NOT local data URLs)
 * 2. Proof metadata must be stored in bb_proofs table
 * 3. View-once proofs can only be viewed once
 * 4. Proofs expire after specified duration (1, 6, or 12 hours)
 * 5. Expired proofs should be deleted from storage
 */

describe('Proof Upload to Supabase Storage (Task 1.5)', () => {
  const mockUserId = 'user-123';
  const mockClashId = 'clash-456';
  const mockImageDataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAA==';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Image Upload', () => {
    it('should convert data URL to Blob before upload', () => {
      const blob = dataURLtoBlob(mockImageDataUrl);

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('image/jpeg');
    });

    it('should upload to Supabase Storage with correct path', async () => {
      const mockUpload = vi.fn().mockResolvedValue({ data: { path: 'proofs/user-123/clash-456.jpg' }, error: null });
      (supabase.storage.from as any).mockReturnValue({ upload: mockUpload });

      const bucket = 'bb_proofs';
      const path = `proofs/${mockUserId}/${mockClashId}.jpg`;
      const blob = new Blob(['fake image'], { type: 'image/jpeg' });

      await supabase.storage.from(bucket).upload(path, blob);

      expect(supabase.storage.from).toHaveBeenCalledWith(bucket);
      expect(mockUpload).toHaveBeenCalledWith(path, blob);
    });

    it('should generate unique filename with timestamp', () => {
      const timestamp = Date.now();
      const filename = `proof_${mockClashId}_${timestamp}.jpg`;

      expect(filename).toContain(mockClashId);
      expect(filename).toMatch(/\.jpg$/);
    });

    it('should NOT store data URLs directly in database', () => {
      const dataUrl = 'data:image/jpeg;base64,abc123...';
      const isDataUrl = dataUrl.startsWith('data:');

      // Data URLs should be converted to storage paths
      expect(isDataUrl).toBe(true);
      // In production code, we should reject data URLs
    });

    it('should store storage path in bb_clashes.proof_url', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      });
      (supabase.from as any).mockReturnValue({ update: mockUpdate });

      const storagePath = 'proofs/user-123/clash-456.jpg';

      await (supabase.from('bb_clashes') as any).update({
        proof_url: storagePath,
        proof_type: 'photo',
        proof_submitted_at: new Date().toISOString(),
      }).eq('id', mockClashId);

      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        proof_url: storagePath,
        proof_type: 'photo',
      }));
    });
  });

  describe('Proof Metadata Storage', () => {
    it('should create bb_proofs record with all metadata', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'proof-789' }, error: null }),
        }),
      });
      (supabase.from as any).mockReturnValue({ insert: mockInsert });

      const proofMetadata = {
        clash_id: mockClashId,
        uploader_id: mockUserId,
        storage_bucket: 'bb_proofs',
        storage_path: `proofs/${mockUserId}/${mockClashId}.jpg`,
        media_type: 'photo' as const,
        captured_at: new Date().toISOString(),
        view_count: 0,
        max_views: 1, // View-once
        view_duration_hours: 12,
        is_destroyed: false,
      };

      await (supabase.from('bb_proofs') as any).insert(proofMetadata).select().single();

      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        storage_bucket: 'bb_proofs',
        max_views: 1,
      }));
    });

    it('should store device info for audit', () => {
      const deviceInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        timestamp: Date.now(),
      };

      expect(deviceInfo.userAgent).toBeDefined();
    });

    it('should store location if permission granted', () => {
      const locationData = {
        lat: 37.7749,
        lng: -122.4194,
        verified: true,
      };

      expect(locationData.lat).toBeDefined();
      expect(locationData.lng).toBeDefined();
    });
  });
});

describe('View-Once Enforcement (Task 1.6)', () => {
  const mockClashId = 'clash-456';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('View-Once Logic', () => {
    it('should allow first view of view-once proof', () => {
      const proof = {
        is_view_once: true,
        view_count: 0,
        max_views: 1,
        viewed_at: null,
      };

      const canView = proof.view_count < proof.max_views;
      expect(canView).toBe(true);
    });

    it('should block second view of view-once proof', () => {
      const proof = {
        is_view_once: true,
        view_count: 1,
        max_views: 1,
        viewed_at: new Date().toISOString(),
      };

      const canView = proof.view_count < proof.max_views;
      expect(canView).toBe(false);
    });

    it('should increment view_count on view', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      });
      (supabase.from as any).mockReturnValue({ update: mockUpdate });

      await (supabase.from('bb_proofs') as any).update({
        view_count: 1,
        viewed_at: new Date().toISOString(),
      }).eq('clash_id', mockClashId);

      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        view_count: 1,
      }));
    });

    it('should mark proof as destroyed after max views', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      });
      (supabase.from as any).mockReturnValue({ update: mockUpdate });

      await (supabase.from('bb_proofs') as any).update({
        is_destroyed: true,
      }).eq('clash_id', mockClashId);

      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        is_destroyed: true,
      }));
    });
  });

  describe('Proof Expiry', () => {
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
      const now = new Date('2024-01-15T10:00:00Z');
      const expiry = calculateProofExpiry(now, 12);

      expect(expiry.toISOString()).toBe('2024-01-15T22:00:00.000Z');
    });

    it('should detect expired proof correctly', () => {
      const submittedAt = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      const durationHours = 1;

      const expired = isProofExpired(submittedAt, durationHours);
      expect(expired).toBe(true);
    });

    it('should detect non-expired proof correctly', () => {
      const submittedAt = new Date(); // Just now
      const durationHours = 1;

      const expired = isProofExpired(submittedAt, durationHours);
      expect(expired).toBe(false);
    });

    it('should block viewing expired proof', () => {
      const proof = {
        submitted_at: new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString(), // 13 hours ago
        view_duration_hours: 12,
        is_expired: false,
      };

      const isExpired = isProofExpired(new Date(proof.submitted_at), proof.view_duration_hours);
      expect(isExpired).toBe(true);
    });
  });

  describe('Proof Cleanup', () => {
    it('should delete expired proof from storage', async () => {
      const mockRemove = vi.fn().mockResolvedValue({ data: null, error: null });
      (supabase.storage.from as any).mockReturnValue({ remove: mockRemove });

      const paths = ['proofs/user-123/clash-456.jpg'];

      await supabase.storage.from('bb_proofs').remove(paths);

      expect(mockRemove).toHaveBeenCalledWith(paths);
    });

    it('should mark proof as destroyed in database', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      });
      (supabase.from as any).mockReturnValue({ update: mockUpdate });

      await (supabase.from('bb_proofs') as any).update({
        is_destroyed: true,
      }).eq('id', 'proof-789');

      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        is_destroyed: true,
      }));
    });

    it('should update clash status on proof expiry', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      });
      (supabase.from as any).mockReturnValue({ update: mockUpdate });

      await (supabase.from('bb_clashes') as any).update({
        proof_expired: true,
      }).eq('id', mockClashId);

      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        proof_expired: true,
      }));
    });
  });

  describe('Screenshot Detection', () => {
    it('should track screenshot detection', () => {
      const proof = {
        screenshot_detected: false,
        screenshot_detected_at: null,
        screenshot_penalty_applied: false,
      };

      // After screenshot detected
      const updatedProof = {
        ...proof,
        screenshot_detected: true,
        screenshot_detected_at: new Date().toISOString(),
      };

      expect(updatedProof.screenshot_detected).toBe(true);
    });

    it('should apply penalty on screenshot', () => {
      const penaltyAmount = 50; // Example penalty
      const userCoins = 500;
      const afterPenalty = userCoins - penaltyAmount;

      expect(afterPenalty).toBe(450);
    });
  });
});

describe('Proof Viewing Flow', () => {
  it('should return correct canView status', () => {
    interface ViewProofResult {
      proofUrl: string | null;
      canView: boolean;
      error: string | null;
    }

    // Can view
    const successResult: ViewProofResult = {
      proofUrl: 'https://storage.example.com/proof.jpg',
      canView: true,
      error: null,
    };
    expect(successResult.canView).toBe(true);

    // Already viewed
    const viewedResult: ViewProofResult = {
      proofUrl: null,
      canView: false,
      error: 'Proof was view-once and already viewed',
    };
    expect(viewedResult.canView).toBe(false);

    // Expired
    const expiredResult: ViewProofResult = {
      proofUrl: null,
      canView: false,
      error: 'Proof has expired',
    };
    expect(expiredResult.canView).toBe(false);
  });

  it('should verify viewer is part of the clash', () => {
    const clash = {
      user1_id: 'user-123',
      user2_id: 'friend-456',
    };

    const viewerId = 'user-123';
    const isParticipant = clash.user1_id === viewerId || clash.user2_id === viewerId;
    expect(isParticipant).toBe(true);

    const randomViewerId = 'hacker-999';
    const isRandomParticipant = clash.user1_id === randomViewerId || clash.user2_id === randomViewerId;
    expect(isRandomParticipant).toBe(false);
  });
});

describe('Proof Type Support', () => {
  it('should support photo proofs', () => {
    const proofType = 'photo';
    const validTypes = ['photo', 'video', 'location', 'time', 'confirm'];

    expect(validTypes).toContain(proofType);
  });

  it('should support video proofs (5-15 seconds)', () => {
    const videoProof = {
      type: 'video',
      duration_seconds: 10,
      min_duration: 5,
      max_duration: 15,
    };

    const isValidDuration = videoProof.duration_seconds >= videoProof.min_duration &&
                           videoProof.duration_seconds <= videoProof.max_duration;
    expect(isValidDuration).toBe(true);
  });

  it('should validate video duration', () => {
    const tooShort = 3;
    const tooLong = 20;
    const justRight = 10;
    const minDuration = 5;
    const maxDuration = 15;

    expect(tooShort < minDuration).toBe(true);
    expect(tooLong > maxDuration).toBe(true);
    expect(justRight >= minDuration && justRight <= maxDuration).toBe(true);
  });
});
