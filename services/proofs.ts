import { supabase } from './supabase';
import type { ProofMetadata, ProofViewSettings } from '../types';
import type { DBProof } from '../types/database';

// Proof storage bucket name
export const PROOF_STORAGE_BUCKET = 'bb_proofs';

// Proof expiry durations in hours
export const PROOF_EXPIRY_OPTIONS = {
  SHORT: 1,
  MEDIUM: 6,
  LONG: 12,
} as const;

// Minimum and maximum video duration in seconds
export const VIDEO_DURATION_LIMITS = {
  MIN: 5,
  MAX: 15,
} as const;

// Calculate proof expiry timestamp
export const calculateProofExpiry = (
  submittedAt: Date | string,
  durationHours: number
): Date => {
  const expiresAt = new Date(submittedAt);
  expiresAt.setHours(expiresAt.getHours() + durationHours);
  return expiresAt;
};

// Check if proof has expired
export const isProofExpired = (
  submittedAt: Date | string,
  durationHours: number
): boolean => {
  const expiresAt = calculateProofExpiry(submittedAt, durationHours);
  return new Date() > expiresAt;
};

// Get time remaining until expiry (in ms)
export const getProofTimeRemaining = (
  submittedAt: Date | string,
  durationHours: number
): number => {
  const expiresAt = calculateProofExpiry(submittedAt, durationHours);
  const remaining = expiresAt.getTime() - Date.now();
  return Math.max(0, remaining);
};

// Format time remaining as human-readable string
export const formatTimeRemaining = (ms: number): string => {
  if (ms <= 0) return 'Expired';

  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
};

// Check if a string is a data URL
export const isDataUrl = (str: string): boolean => {
  return str.startsWith('data:');
};

// Validate that a proof URL is a storage path, not a data URL
export const validateProofPath = (path: string): { valid: boolean; error: string | null } => {
  if (isDataUrl(path)) {
    return { valid: false, error: 'Data URLs are not allowed. Proof must be uploaded to storage first.' };
  }
  if (!path.startsWith('proofs/')) {
    return { valid: false, error: 'Invalid proof path format. Must start with "proofs/"' };
  }
  return { valid: true, error: null };
};

// Upload proof to Supabase storage (from File or Blob)
export const uploadProof = async (
  userId: string,
  clashId: string,
  file: File | Blob,
  proofType: 'photo' | 'video'
): Promise<{ path: string | null; error: string | null }> => {
  try {
    const fileExt = proofType === 'photo' ? 'jpg' : 'mp4';
    const timestamp = Date.now();
    const fileName = `proofs/${userId}/${clashId}_${timestamp}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from(PROOF_STORAGE_BUCKET)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      return { path: null, error: error.message };
    }

    // Return the storage path (NOT public URL - we use signed URLs for privacy)
    return { path: data.path, error: null };
  } catch (err) {
    return { path: null, error: 'Failed to upload proof' };
  }
};

// Upload proof from data URL (converts data URL to blob first)
export const uploadProofFromDataUrl = async (
  dataUrl: string,
  userId: string,
  clashId: string
): Promise<{ path: string | null; error: string | null }> => {
  try {
    // Validate input is actually a data URL
    if (!isDataUrl(dataUrl)) {
      return { path: null, error: 'Input must be a data URL' };
    }

    // Convert data URL to Blob
    const blob = dataURLtoBlob(dataUrl);

    // Determine media type from blob
    const proofType: 'photo' | 'video' = blob.type.startsWith('video/') ? 'video' : 'photo';

    // Upload the blob
    return await uploadProof(userId, clashId, blob, proofType);
  } catch (err) {
    return { path: null, error: 'Failed to convert and upload proof' };
  }
};

// Get a signed URL for a proof in storage (for private access)
export const getSignedProofUrl = async (
  storagePath: string,
  expiresInSeconds: number = 3600 // Default 1 hour
): Promise<{ url: string | null; error: string | null }> => {
  try {
    const { data, error } = await supabase.storage
      .from(PROOF_STORAGE_BUCKET)
      .createSignedUrl(storagePath, expiresInSeconds);

    if (error) {
      return { url: null, error: error.message };
    }

    return { url: data.signedUrl, error: null };
  } catch (err) {
    return { url: null, error: 'Failed to get signed URL' };
  }
};

// Delete proof from storage (for privacy/cleanup)
// Accepts either a storage path (proofs/...) or a full URL
export const deleteProof = async (
  proofPathOrUrl: string
): Promise<{ success: boolean; error: string | null }> => {
  try {
    let storagePath: string;

    // Check if it's a full URL or just a storage path
    if (proofPathOrUrl.startsWith('http')) {
      // Extract path from URL
      const url = new URL(proofPathOrUrl);
      const pathParts = url.pathname.split('/');
      const proofIndex = pathParts.indexOf('proofs');
      if (proofIndex === -1) {
        return { success: false, error: 'Invalid proof URL format' };
      }
      storagePath = pathParts.slice(proofIndex).join('/');
    } else {
      // It's already a storage path
      storagePath = proofPathOrUrl;
    }

    const { error } = await supabase.storage
      .from(PROOF_STORAGE_BUCKET)
      .remove([storagePath]);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err) {
    return { success: false, error: 'Failed to delete proof' };
  }
};

// Delete proof from storage by path only
export const deleteProofFromStorage = async (
  storagePath: string
): Promise<{ success: boolean; error: string | null }> => {
  try {
    const { error } = await supabase.storage
      .from(PROOF_STORAGE_BUCKET)
      .remove([storagePath]);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err) {
    return { success: false, error: 'Failed to delete proof from storage' };
  }
};

// Generate proof metadata from device
export const generateProofMetadata = async (): Promise<ProofMetadata> => {
  const metadata: ProofMetadata = {
    capturedAt: new Date().toISOString(),
    locationVerified: false,
  };

  // Try to get device info
  try {
    metadata.deviceInfo = `${navigator.userAgent.slice(0, 100)}`;
  } catch {
    // Ignore
  }

  // Try to get location
  if ('geolocation' in navigator) {
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 5000,
          enableHighAccuracy: false,
        });
      });

      metadata.locationLat = position.coords.latitude;
      metadata.locationLng = position.coords.longitude;
      metadata.locationVerified = true;
    } catch {
      // Location not available or denied
    }
  }

  return metadata;
};

// Save proof record to database (legacy function - use createProofRecord instead)
export const saveProofRecord = async (
  clashId: string,
  userId: string,
  proofUrl: string,
  proofType: 'photo' | 'video',
  settings: ProofViewSettings,
  metadata: ProofMetadata
): Promise<{ success: boolean; error: string | null }> => {
  // Convert proofUrl to storage path if it's a data URL (for backwards compatibility)
  const storagePath = isDataUrl(proofUrl) ? '' : proofUrl;

  const expiresAt = calculateProofExpiry(new Date(), settings.viewDurationHours);

  const { error } = await supabase
    .from('bb_proofs')
    .insert({
      clash_id: clashId,
      uploader_id: userId,
      storage_bucket: PROOF_STORAGE_BUCKET,
      storage_path: storagePath,
      media_type: proofType,
      view_duration_hours: settings.viewDurationHours,
      max_views: settings.isViewOnce ? 1 : 999, // View-once = max 1 view
      view_count: 0,
      expires_at: expiresAt.toISOString(),
      is_destroyed: false,
      captured_at: metadata.capturedAt,
      device_info: metadata.deviceInfo || null,
      location_lat: metadata.locationLat || null,
      location_lng: metadata.locationLng || null,
      location_verified: metadata.locationVerified,
      created_at: new Date().toISOString(),
    });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
};

// Create proof metadata record in bb_proofs table (new recommended function)
export const createProofRecord = async (
  clashId: string,
  uploaderId: string,
  storagePath: string,
  mediaType: 'photo' | 'video',
  viewDurationHours: number,
  isViewOnce: boolean,
  metadata?: ProofMetadata
): Promise<{ proofId: string | null; error: string | null }> => {
  try {
    // Validate storage path - reject data URLs
    const validation = validateProofPath(storagePath);
    if (!validation.valid) {
      return { proofId: null, error: validation.error };
    }

    const expiresAt = calculateProofExpiry(new Date(), viewDurationHours);

    const { data, error } = await supabase
      .from('bb_proofs')
      .insert({
        clash_id: clashId,
        uploader_id: uploaderId,
        storage_bucket: PROOF_STORAGE_BUCKET,
        storage_path: storagePath,
        media_type: mediaType,
        view_duration_hours: viewDurationHours,
        max_views: isViewOnce ? 1 : 999, // View-once = max 1 view
        view_count: 0,
        expires_at: expiresAt.toISOString(),
        is_destroyed: false,
        captured_at: metadata?.capturedAt || new Date().toISOString(),
        device_info: metadata?.deviceInfo || null,
        location_lat: metadata?.locationLat || null,
        location_lng: metadata?.locationLng || null,
        location_verified: metadata?.locationVerified || false,
        screenshot_detected: false,
        screenshot_penalty_applied: false,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      return { proofId: null, error: error.message };
    }

    return { proofId: data.id, error: null };
  } catch (err) {
    return { proofId: null, error: 'Failed to create proof record' };
  }
};

// Get proof record from bb_proofs table
export const getProofRecord = async (
  clashId: string
): Promise<{ proof: DBProof | null; error: string | null }> => {
  const { data, error } = await supabase
    .from('bb_proofs')
    .select('*')
    .eq('clash_id', clashId)
    .single();

  if (error) {
    return { proof: null, error: error.message };
  }

  return { proof: data, error: null };
};

// Get proof details
export const getProofDetails = async (
  clashId: string
): Promise<{
  proof: {
    url: string;
    type: 'photo' | 'video';
    submittedAt: string;
    viewDurationHours: number;
    isViewOnce: boolean;
    expiresAt: Date;
    timeRemaining: number;
    viewedAt: string | null;
  } | null;
  error: string | null;
}> => {
  const { data: clash, error } = await supabase
    .from('bb_clashes')
    .select('proof_url, proof_type, proof_submitted_at, proof_view_duration, proof_is_view_once, proof_viewed_at')
    .eq('id', clashId)
    .single();

  if (error || !clash || !clash.proof_url) {
    return { proof: null, error: error?.message || 'Proof not found' };
  }

  const expiresAt = calculateProofExpiry(clash.proof_submitted_at, clash.proof_view_duration);
  const timeRemaining = getProofTimeRemaining(clash.proof_submitted_at, clash.proof_view_duration);

  return {
    proof: {
      url: clash.proof_url,
      type: clash.proof_type as 'photo' | 'video',
      submittedAt: clash.proof_submitted_at,
      viewDurationHours: clash.proof_view_duration,
      isViewOnce: clash.proof_is_view_once,
      expiresAt,
      timeRemaining,
      viewedAt: clash.proof_viewed_at,
    },
    error: null,
  };
};

// Cleanup expired proofs (run periodically)
export const cleanupExpiredProofs = async (): Promise<{
  cleanedCount: number;
  error: string | null;
}> => {
  // Get all clashes with expired proofs
  const { data: expiredClashes, error: fetchError } = await supabase
    .from('bb_clashes')
    .select('id, proof_url, proof_submitted_at, proof_view_duration')
    .not('proof_url', 'is', null)
    .eq('proof_expired', false);

  if (fetchError) {
    return { cleanedCount: 0, error: fetchError.message };
  }

  let cleanedCount = 0;

  for (const clash of expiredClashes || []) {
    if (isProofExpired(clash.proof_submitted_at, clash.proof_view_duration)) {
      // Delete the proof file
      await deleteProof(clash.proof_url);

      // Mark as expired in DB
      await supabase
        .from('bb_clashes')
        .update({
          proof_expired: true,
          proof_url: null, // Clear URL for privacy
        })
        .eq('id', clash.id);

      cleanedCount++;
    }
  }

  return { cleanedCount, error: null };
};

// Capture frame from video for thumbnail
export const captureVideoThumbnail = (video: HTMLVideoElement): Promise<Blob | null> => {
  return new Promise((resolve) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.8);
    } catch {
      resolve(null);
    }
  });
};

// Convert base64 data URL to Blob
export const dataURLtoBlob = (dataUrl: string): Blob => {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)![1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
};

// =============================================================================
// VIEW ENFORCEMENT SYSTEM
// =============================================================================

// View proof with full enforcement (view-once, expiry, participant check)
export const viewProof = async (
  clashId: string,
  viewerId: string
): Promise<{
  url: string | null;
  canView: boolean;
  error: string | null;
}> => {
  try {
    // 1. Get clash details
    const { data: clash, error: clashError } = await supabase
      .from('bb_clashes')
      .select('*')
      .eq('id', clashId)
      .single();

    if (clashError || !clash) {
      return { url: null, canView: false, error: 'Clash not found' };
    }

    // 2. Verify viewer is a participant in the clash
    if (clash.user1_id !== viewerId && clash.user2_id !== viewerId) {
      return { url: null, canView: false, error: 'You are not part of this clash' };
    }

    // 3. Check if proof exists
    if (!clash.proof_url) {
      return { url: null, canView: false, error: 'No proof submitted yet' };
    }

    // 4. Get proof record from bb_proofs for view count tracking
    const { data: proofRecord } = await supabase
      .from('bb_proofs')
      .select('*')
      .eq('clash_id', clashId)
      .single();

    // 5. Check if proof is expired
    if (clash.proof_submitted_at && clash.proof_view_duration) {
      if (isProofExpired(clash.proof_submitted_at, clash.proof_view_duration)) {
        // Mark as expired if not already
        if (!clash.proof_expired) {
          await supabase
            .from('bb_clashes')
            .update({ proof_expired: true })
            .eq('id', clashId);

          // Also mark proof record as destroyed
          if (proofRecord) {
            await supabase
              .from('bb_proofs')
              .update({ is_destroyed: true })
              .eq('id', proofRecord.id);
          }
        }
        return { url: null, canView: false, error: 'Proof has expired' };
      }
    }

    // 6. Check view-once enforcement using bb_proofs record
    if (proofRecord) {
      // Check max_views limit
      if (proofRecord.view_count >= proofRecord.max_views) {
        return { url: null, canView: false, error: 'Proof was view-once and already viewed' };
      }

      // Check if already destroyed
      if (proofRecord.is_destroyed) {
        return { url: null, canView: false, error: 'Proof has been destroyed' };
      }

      // Increment view count
      const newViewCount = proofRecord.view_count + 1;
      const shouldDestroy = newViewCount >= proofRecord.max_views;

      await supabase
        .from('bb_proofs')
        .update({
          view_count: newViewCount,
          is_destroyed: shouldDestroy,
        })
        .eq('id', proofRecord.id);

      // Also update clash proof_viewed_at if first view
      if (!clash.proof_viewed_at) {
        await supabase
          .from('bb_clashes')
          .update({ proof_viewed_at: new Date().toISOString() })
          .eq('id', clashId);
      }
    } else {
      // Fallback to clash-level view-once check (for backwards compatibility)
      if (clash.proof_is_view_once && clash.proof_viewed_at) {
        return { url: null, canView: false, error: 'Proof was view-once and already viewed' };
      }

      // Mark as viewed if first view
      if (!clash.proof_viewed_at) {
        await supabase
          .from('bb_clashes')
          .update({ proof_viewed_at: new Date().toISOString() })
          .eq('id', clashId);
      }
    }

    // 7. Get the proof URL - either signed URL from storage or direct URL
    let finalUrl: string;

    if (clash.proof_url.startsWith('proofs/')) {
      // It's a storage path - get signed URL
      const { url: signedUrl, error: signedError } = await getSignedProofUrl(clash.proof_url);
      if (signedError || !signedUrl) {
        return { url: null, canView: false, error: signedError || 'Failed to get proof URL' };
      }
      finalUrl = signedUrl;
    } else {
      // It's already a URL (legacy support)
      finalUrl = clash.proof_url;
    }

    return { url: finalUrl, canView: true, error: null };
  } catch (err) {
    return { url: null, canView: false, error: 'Failed to view proof' };
  }
};

// Mark proof as destroyed (for view-once after viewing)
export const markProofDestroyed = async (
  clashId: string
): Promise<{ success: boolean; error: string | null }> => {
  try {
    // Update bb_proofs
    await supabase
      .from('bb_proofs')
      .update({ is_destroyed: true })
      .eq('clash_id', clashId);

    return { success: true, error: null };
  } catch (err) {
    return { success: false, error: 'Failed to mark proof as destroyed' };
  }
};

// Record screenshot detection and apply penalty
export const recordScreenshotDetection = async (
  clashId: string,
  viewerId: string,
  penaltyAmount: number = 50
): Promise<{ success: boolean; error: string | null }> => {
  try {
    // Update bb_proofs with screenshot detection
    const { data: proofRecord } = await supabase
      .from('bb_proofs')
      .select('id, screenshot_penalty_applied')
      .eq('clash_id', clashId)
      .single();

    if (proofRecord && !proofRecord.screenshot_penalty_applied) {
      await supabase
        .from('bb_proofs')
        .update({
          screenshot_detected: true,
          screenshot_detected_at: new Date().toISOString(),
          screenshot_penalty_applied: true,
        })
        .eq('id', proofRecord.id);

      // Deduct penalty from viewer's balance
      // (Economy service would handle the actual transaction)
    }

    return { success: true, error: null };
  } catch (err) {
    return { success: false, error: 'Failed to record screenshot detection' };
  }
};

// Enhanced cleanup for expired proofs (uses bb_proofs table)
export const cleanupExpiredProofsEnhanced = async (): Promise<{
  deletedCount: number;
  error: string | null;
}> => {
  try {
    const now = new Date().toISOString();

    // 1. Get all expired proofs from bb_proofs that aren't yet destroyed
    const { data: expiredProofs, error: fetchError } = await supabase
      .from('bb_proofs')
      .select('id, storage_path, clash_id')
      .lt('expires_at', now)
      .eq('is_destroyed', false);

    if (fetchError) {
      return { deletedCount: 0, error: fetchError.message };
    }

    let deletedCount = 0;

    for (const proof of expiredProofs || []) {
      // Delete from storage
      if (proof.storage_path) {
        await deleteProofFromStorage(proof.storage_path);
      }

      // Mark as destroyed in bb_proofs
      await supabase
        .from('bb_proofs')
        .update({ is_destroyed: true })
        .eq('id', proof.id);

      // Update bb_clashes
      if (proof.clash_id) {
        await supabase
          .from('bb_clashes')
          .update({
            proof_expired: true,
          })
          .eq('id', proof.clash_id);
      }

      deletedCount++;
    }

    return { deletedCount, error: null };
  } catch (err) {
    return { deletedCount: 0, error: 'Failed to cleanup expired proofs' };
  }
};

// Check if viewer can view proof without actually viewing it
export const canViewProof = async (
  clashId: string,
  viewerId: string
): Promise<{
  canView: boolean;
  reason: string | null;
}> => {
  try {
    // Get clash
    const { data: clash } = await supabase
      .from('bb_clashes')
      .select('user1_id, user2_id, proof_url, proof_submitted_at, proof_view_duration, proof_expired')
      .eq('id', clashId)
      .single();

    if (!clash) {
      return { canView: false, reason: 'Clash not found' };
    }

    // Check participant
    if (clash.user1_id !== viewerId && clash.user2_id !== viewerId) {
      return { canView: false, reason: 'Not a participant' };
    }

    // Check proof exists
    if (!clash.proof_url) {
      return { canView: false, reason: 'No proof submitted' };
    }

    // Check expired
    if (clash.proof_expired) {
      return { canView: false, reason: 'Proof expired' };
    }

    if (clash.proof_submitted_at && clash.proof_view_duration) {
      if (isProofExpired(clash.proof_submitted_at, clash.proof_view_duration)) {
        return { canView: false, reason: 'Proof expired' };
      }
    }

    // Check view-once from bb_proofs
    const { data: proofRecord } = await supabase
      .from('bb_proofs')
      .select('view_count, max_views, is_destroyed')
      .eq('clash_id', clashId)
      .single();

    if (proofRecord) {
      if (proofRecord.is_destroyed) {
        return { canView: false, reason: 'Proof destroyed' };
      }
      if (proofRecord.view_count >= proofRecord.max_views) {
        return { canView: false, reason: 'Max views reached' };
      }
    }

    return { canView: true, reason: null };
  } catch {
    return { canView: false, reason: 'Error checking proof' };
  }
};
