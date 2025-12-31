import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { resolveClash, viewProof } from '../../services/clashes';
import { supabase } from '../../services/supabase';
import { createSupabaseQuery } from '../helpers/supabaseMock';

vi.mock('../../services/economy', () => ({
  awardClashWin: vi.fn().mockResolvedValue({ success: true, error: null }),
}));

const fromMock = supabase.from as unknown as Mock;

describe('clashes service', () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it('blocks proof viewing for non-participants', async () => {
    const clashQuery = createSupabaseQuery({
      data: {
        id: 'clash-1',
        user1_id: 'user-1',
        user2_id: 'user-2',
        proof_url: 'https://example.com/proof.jpg',
        proof_is_view_once: false,
        proof_viewed_at: null,
      },
      error: null,
    });

    fromMock.mockReturnValue(clashQuery);

    const result = await viewProof('clash-1', 'user-3');

    expect(result.canView).toBe(false);
    expect(result.error).toContain('not part');
  });

  it('rejects view-once proofs after they are viewed', async () => {
    // Mock: 1st call returns clash, 2nd call returns bb_proofs record (already viewed)
    const clashQuery = createSupabaseQuery({
      data: {
        id: 'clash-2',
        user1_id: 'user-1',
        user2_id: 'user-2',
        proof_url: 'proofs/user-1/clash-2.jpg',
        proof_is_view_once: true,
        proof_viewed_at: new Date().toISOString(),
      },
      error: null,
    });

    const proofRecordQuery = createSupabaseQuery({
      data: {
        id: 'proof-1',
        clash_id: 'clash-2',
        view_count: 1, // Already viewed
        max_views: 1,  // Max views is 1
        is_destroyed: false,
        expires_at: new Date(Date.now() + 86400000).toISOString(), // Not expired
      },
      error: null,
    });

    fromMock.mockReturnValueOnce(clashQuery).mockReturnValueOnce(proofRecordQuery);

    const result = await viewProof('clash-2', 'user-1');

    expect(result.canView).toBe(false);
    expect(result.error).toContain('view-once');
  });

  it('expires proofs after the view window and flags the clash', async () => {
    const submittedAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const expiredAt = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(); // 1 hour ago

    // Mock: 1st call returns clash, 2nd returns expired bb_proofs record
    const clashQuery = createSupabaseQuery({
      data: {
        id: 'clash-3',
        user1_id: 'user-1',
        user2_id: 'user-2',
        proof_url: 'proofs/user-1/clash-3.jpg',
        proof_is_view_once: false,
        proof_viewed_at: null,
        proof_submitted_at: submittedAt,
        proof_view_duration: 1,
      },
      error: null,
    });

    const proofRecordQuery = createSupabaseQuery({
      data: {
        id: 'proof-2',
        clash_id: 'clash-3',
        view_count: 0,
        max_views: 10,
        is_destroyed: false,
        expires_at: expiredAt, // Already expired
      },
      error: null,
    });

    const updateProofQuery = createSupabaseQuery({ data: null, error: null });
    const updateClashQuery = createSupabaseQuery({ data: null, error: null });

    fromMock
      .mockReturnValueOnce(clashQuery)
      .mockReturnValueOnce(proofRecordQuery)
      .mockReturnValueOnce(updateProofQuery) // Update bb_proofs
      .mockReturnValueOnce(updateClashQuery); // Update bb_clashes

    const result = await viewProof('clash-3', 'user-1');

    expect(result.canView).toBe(false);
    expect(result.error).toContain('expired');
    expect(updateClashQuery.update).toHaveBeenCalledWith({ proof_expired: true });
  });

  it('awards the prover when proof is accepted', async () => {
    const clashQuery = createSupabaseQuery({
      data: {
        id: 'clash-4',
        user1_id: 'user-1',
        user2_id: 'user-2',
        prover_id: 'user-2',
        total_pot: 40,
      },
      error: null,
    });

    fromMock.mockReturnValue(clashQuery);

    const result = await resolveClash('clash-4', true, 'user-1');

    expect(result.success).toBe(true);
    expect(result.winnerId).toBe('user-2');
  });

  it('awards the non-prover when proof is rejected', async () => {
    const clashQuery = createSupabaseQuery({
      data: {
        id: 'clash-5',
        user1_id: 'user-1',
        user2_id: 'user-2',
        prover_id: 'user-1',
        total_pot: 40,
      },
      error: null,
    });

    fromMock.mockReturnValue(clashQuery);

    const result = await resolveClash('clash-5', false, 'user-2');

    expect(result.success).toBe(true);
    expect(result.winnerId).toBe('user-2');
  });
});
