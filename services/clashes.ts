import { supabase } from './supabase';
import type { DBClash, DBBet } from '../types/database';
import { awardClashWin } from './economy';
import {
  isDataUrl,
  validateProofPath,
  createProofRecord,
  getSignedProofUrl,
  isProofExpired,
  generateProofMetadata
} from './proofs';

export interface ClashWithBet extends DBClash {
  bet: DBBet;
}

// Get user's active clashes (pending proof or reviewing)
export const getActiveClashes = async (userId: string): Promise<{
  clashes: ClashWithBet[];
  error: string | null;
}> => {
  const { data, error } = await supabase
    .from('bb_clashes')
    .select(`
      *,
      bb_bets(*)
    `)
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
    .in('status', ['pending_proof', 'proof_submitted', 'reviewing'])
    .order('created_at', { ascending: false });

  if (error) {
    return { clashes: [], error: error.message };
  }

  const clashes = (data || []).map(c => ({
    ...c,
    bet: c.bb_bets as DBBet
  }));

  return { clashes, error: null };
};

// Get clash by ID
export const getClashById = async (clashId: string): Promise<{
  clash: ClashWithBet | null;
  error: string | null;
}> => {
  const { data, error } = await supabase
    .from('bb_clashes')
    .select(`
      *,
      bb_bets(*)
    `)
    .eq('id', clashId)
    .single();

  if (error) {
    return { clash: null, error: error.message };
  }

  return {
    clash: data ? {
      ...data,
      bet: data.bb_bets as DBBet
    } : null,
    error: null
  };
};

// Submit proof for a clash
// IMPORTANT: proofPath must be a storage path (e.g., "proofs/user123/clash456_1234567890.jpg")
// Data URLs are NOT allowed - upload to storage first using uploadProofFromDataUrl
export const submitProof = async (
  clashId: string,
  userId: string,
  proofPath: string,
  proofType: 'photo' | 'video',
  viewDurationHours: number = 12,
  isViewOnce: boolean = false
): Promise<{ success: boolean; error: string | null }> => {
  // CRITICAL: Reject data URLs - proofs must be uploaded to storage first
  if (isDataUrl(proofPath)) {
    return {
      success: false,
      error: 'Data URLs are not allowed. Upload proof to storage first using uploadProofFromDataUrl()'
    };
  }

  // Validate the proof path format
  const pathValidation = validateProofPath(proofPath);
  if (!pathValidation.valid) {
    return { success: false, error: pathValidation.error };
  }

  // Verify user is the prover
  const { data: clash } = await supabase
    .from('bb_clashes')
    .select('prover_id, status')
    .eq('id', clashId)
    .single();

  if (!clash) {
    return { success: false, error: 'Clash not found' };
  }

  if (clash.prover_id !== userId) {
    return { success: false, error: 'You are not the one who needs to prove this bet' };
  }

  if (clash.status !== 'pending_proof') {
    return { success: false, error: 'Proof already submitted or clash resolved' };
  }

  // Create proof record in bb_proofs table
  const metadata = await generateProofMetadata();
  const { proofId, error: proofRecordError } = await createProofRecord(
    clashId,
    userId,
    proofPath,
    proofType,
    viewDurationHours,
    isViewOnce,
    metadata
  );

  if (proofRecordError) {
    return { success: false, error: `Failed to create proof record: ${proofRecordError}` };
  }

  // Update clash with proof storage path (NOT a data URL or public URL)
  const { error } = await supabase
    .from('bb_clashes')
    .update({
      proof_url: proofPath, // This is a storage path, not a URL
      proof_type: proofType,
      proof_submitted_at: new Date().toISOString(),
      proof_view_duration: viewDurationHours,
      proof_is_view_once: isViewOnce,
      status: 'proof_submitted',
    })
    .eq('id', clashId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
};

// View proof (marks as viewed, enforces view-once)
// This function now uses the enhanced proofs service for proper enforcement
// It handles both storage paths (new) and URLs (legacy)
export const viewProofClash = async (clashId: string, viewerId: string): Promise<{
  proofUrl: string | null;
  canView: boolean;
  error: string | null;
}> => {
  const { data: clash } = await supabase
    .from('bb_clashes')
    .select('*')
    .eq('id', clashId)
    .single();

  if (!clash) {
    return { proofUrl: null, canView: false, error: 'Clash not found' };
  }

  // Check if viewer is part of this clash
  if (clash.user1_id !== viewerId && clash.user2_id !== viewerId) {
    return { proofUrl: null, canView: false, error: 'You are not part of this clash' };
  }

  // Check if proof exists
  if (!clash.proof_url) {
    return { proofUrl: null, canView: false, error: 'No proof submitted yet' };
  }

  // Check if proof already viewed (for view-once) using bb_proofs table
  const { data: proofRecord } = await supabase
    .from('bb_proofs')
    .select('*')
    .eq('clash_id', clashId)
    .single();

  if (proofRecord) {
    // Check max_views limit
    if (proofRecord.view_count >= proofRecord.max_views) {
      return { proofUrl: null, canView: false, error: 'Proof was view-once and already viewed' };
    }

    // Check if destroyed
    if (proofRecord.is_destroyed) {
      return { proofUrl: null, canView: false, error: 'Proof has been destroyed' };
    }

    // Check expiry from proof record
    if (proofRecord.expires_at && new Date() > new Date(proofRecord.expires_at)) {
      // Mark as destroyed
      await supabase
        .from('bb_proofs')
        .update({ is_destroyed: true })
        .eq('id', proofRecord.id);

      await supabase
        .from('bb_clashes')
        .update({ proof_expired: true })
        .eq('id', clashId);

      return { proofUrl: null, canView: false, error: 'Proof has expired' };
    }
  } else {
    // Fallback to clash-level checks (for backwards compatibility)
    if (clash.proof_is_view_once && clash.proof_viewed_at) {
      return { proofUrl: null, canView: false, error: 'Proof was view-once and already viewed' };
    }

    // Check if proof expired
    if (clash.proof_submitted_at && clash.proof_view_duration) {
      if (isProofExpired(clash.proof_submitted_at, clash.proof_view_duration)) {
        await supabase
          .from('bb_clashes')
          .update({ proof_expired: true })
          .eq('id', clashId);

        return { proofUrl: null, canView: false, error: 'Proof has expired' };
      }
    }
  }

  // Increment view count and mark as viewed
  if (proofRecord) {
    const newViewCount = proofRecord.view_count + 1;
    const shouldDestroy = newViewCount >= proofRecord.max_views;

    await supabase
      .from('bb_proofs')
      .update({
        view_count: newViewCount,
        is_destroyed: shouldDestroy,
      })
      .eq('id', proofRecord.id);
  }

  // Mark as viewed in clash (for view-once tracking)
  if (!clash.proof_viewed_at) {
    await supabase
      .from('bb_clashes')
      .update({ proof_viewed_at: new Date().toISOString() })
      .eq('id', clashId);
  }

  // If it's a storage path, get signed URL; otherwise return the URL directly
  let finalUrl: string;
  if (clash.proof_url.startsWith('proofs/')) {
    const { url, error } = await getSignedProofUrl(clash.proof_url);
    if (error || !url) {
      return { proofUrl: null, canView: false, error: error || 'Failed to get proof URL' };
    }
    finalUrl = url;
  } else {
    // Legacy: direct URL
    finalUrl = clash.proof_url;
  }

  return { proofUrl: finalUrl, canView: true, error: null };
};

// Alias for backwards compatibility
export const viewProof = viewProofClash;

// Resolve clash (verify proof and award winner)
export const resolveClash = async (
  clashId: string,
  proofAccepted: boolean,
  resolverId: string
): Promise<{ success: boolean; winnerId: string | null; error: string | null }> => {
  const { data: clash } = await supabase
    .from('bb_clashes')
    .select('*')
    .eq('id', clashId)
    .single();

  if (!clash) {
    return { success: false, winnerId: null, error: 'Clash not found' };
  }

  // Verify resolver is part of clash
  if (clash.user1_id !== resolverId && clash.user2_id !== resolverId) {
    return { success: false, winnerId: null, error: 'You are not part of this clash' };
  }

  // Determine winner
  // If proof is accepted, prover wins (they were right)
  // If proof rejected, the other person wins
  let winnerId: string;
  let loserId: string;

  if (proofAccepted) {
    winnerId = clash.prover_id!;
    loserId = clash.prover_id === clash.user1_id ? clash.user2_id : clash.user1_id;
  } else {
    loserId = clash.prover_id!;
    winnerId = clash.prover_id === clash.user1_id ? clash.user2_id : clash.user1_id;
  }

  // Award winnings
  const { error: awardError } = await awardClashWin(
    winnerId,
    loserId,
    clashId,
    clash.total_pot
  );

  if (awardError) {
    return { success: false, winnerId: null, error: awardError };
  }

  return { success: true, winnerId, error: null };
};

// Dispute a clash
export const disputeClash = async (
  clashId: string,
  userId: string,
  reason: string
): Promise<{ success: boolean; error: string | null }> => {
  const { data: clash } = await supabase
    .from('bb_clashes')
    .select('user1_id, user2_id, status')
    .eq('id', clashId)
    .single();

  if (!clash) {
    return { success: false, error: 'Clash not found' };
  }

  if (clash.user1_id !== userId && clash.user2_id !== userId) {
    return { success: false, error: 'You are not part of this clash' };
  }

  if (clash.status !== 'proof_submitted') {
    return { success: false, error: 'Can only dispute after proof is submitted' };
  }

  const { error } = await supabase
    .from('bb_clashes')
    .update({
      status: 'disputed',
      disputed_by: userId,
      dispute_reason: reason,
    })
    .eq('id', clashId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
};

// Auto-expire clashes past deadline
export const expireOverdueClashes = async (): Promise<{
  expiredCount: number;
  error: string | null;
}> => {
  const now = new Date().toISOString();

  // Get clashes past proof deadline
  const { data: overdueClashes, error: fetchError } = await supabase
    .from('bb_clashes')
    .select('id, prover_id, user1_id, user2_id, total_pot')
    .eq('status', 'pending_proof')
    .lt('proof_deadline', now);

  if (fetchError) {
    return { expiredCount: 0, error: fetchError.message };
  }

  let expiredCount = 0;

  for (const clash of overdueClashes || []) {
    // Prover loses because they didn't submit proof
    const loserId = clash.prover_id;
    const winnerId = clash.prover_id === clash.user1_id ? clash.user2_id : clash.user1_id;

    await awardClashWin(winnerId, loserId, clash.id, clash.total_pot);

    await supabase
      .from('bb_clashes')
      .update({
        status: 'expired',
        resolution_notes: 'Proof deadline expired - prover forfeited',
      })
      .eq('id', clash.id);

    expiredCount++;
  }

  return { expiredCount, error: null };
};

// Get clash history for user
export const getClashHistory = async (userId: string, limit: number = 50): Promise<{
  clashes: ClashWithBet[];
  error: string | null;
}> => {
  const { data, error } = await supabase
    .from('bb_clashes')
    .select(`
      *,
      bb_bets(*)
    `)
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
    .eq('status', 'completed')
    .order('resolved_at', { ascending: false })
    .limit(limit);

  if (error) {
    return { clashes: [], error: error.message };
  }

  const clashes = (data || []).map(c => ({
    ...c,
    bet: c.bb_bets as DBBet
  }));

  return { clashes, error: null };
};
