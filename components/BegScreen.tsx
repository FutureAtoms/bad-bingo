import React, { useState, useEffect, useRef } from 'react';
import { Friend, DARE_TEMPLATES, BegRequest } from '../types';
import { supabase } from '../services/supabase';
import { uploadProofFromDataUrl } from '../services/proofs';

interface BegScreenProps {
  user: { id: string; name: string; coins: number };
  friends: Friend[];
  activeBeg?: BegRequest;
  onClose: () => void;
  onSubmitBeg: (targetId: string) => Promise<void>;
  onSubmitDareProof: (begId: string, proofUrl: string) => Promise<void>;
}

type Phase = 'select_target' | 'awaiting_dare' | 'complete_dare' | 'proof_submitted' | 'completed';

const BegScreen: React.FC<BegScreenProps> = ({
  user,
  friends,
  activeBeg,
  onClose,
  onSubmitBeg,
  onSubmitDareProof,
}) => {
  const [phase, setPhase] = useState<Phase>(activeBeg ? getPhaseFromBeg(activeBeg) : 'select_target');
  const [selectedTarget, setSelectedTarget] = useState<Friend | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentBeg, setCurrentBeg] = useState<BegRequest | undefined>(activeBeg);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Determine phase from existing beg
  function getPhaseFromBeg(beg: BegRequest): Phase {
    switch (beg.status) {
      case 'pending': return 'awaiting_dare';
      case 'dare_assigned': return 'complete_dare';
      case 'proof_submitted': return 'proof_submitted';
      case 'completed': return 'completed';
      default: return 'select_target';
    }
  }

  const acceptedFriends = friends.filter(f => f.friendshipStatus === 'accepted');

  const handleSelectTarget = async (friend: Friend) => {
    setSelectedTarget(friend);
    setIsSubmitting(true);
    try {
      await onSubmitBeg(friend.id);
      setPhase('awaiting_dare');
    } catch (err) {
      console.error('Failed to submit beg:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Camera functions for dare proof capture
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraOpen(true);
    } catch (err) {
      console.error('Failed to access camera:', err);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setCapturedImage(dataUrl);
      stopCamera();
    }
  };

  const handleDareProofCapture = async () => {
    if (!currentBeg) return;

    // If no image captured yet, open camera
    if (!capturedImage) {
      startCamera();
      return;
    }

    setIsSubmitting(true);
    try {
      // Upload proof to Supabase storage
      const { path, error: uploadError } = await uploadProofFromDataUrl(
        capturedImage,
        user.id,
        currentBeg.id // Using beg ID as reference
      );

      if (uploadError || !path) {
        console.error('Failed to upload proof:', uploadError);
        setIsSubmitting(false);
        return;
      }

      // Submit proof URL to parent handler
      await onSubmitDareProof(currentBeg.id, path);
      setCapturedImage(null);
      setPhase('proof_submitted');
    } catch (err) {
      console.error('Failed to submit dare proof:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Subscribe to beg record changes to get real dare assignment
  useEffect(() => {
    if (phase !== 'awaiting_dare' || !currentBeg) return;

    // Subscribe to changes on this specific beg record
    const subscription = supabase
      .channel(`beg-${currentBeg.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bb_begs',
          filter: `id=eq.${currentBeg.id}`,
        },
        (payload) => {
          const updatedBeg = payload.new as {
            status: string;
            dare_type: string | null;
            dare_text: string | null;
            reward_amount: number;
          };

          // Check if dare was assigned
          if (updatedBeg.status === 'dare_assigned' && updatedBeg.dare_text) {
            setCurrentBeg(prev => prev ? {
              ...prev,
              status: 'dare_assigned',
              dareType: updatedBeg.dare_type || undefined,
              dareText: updatedBeg.dare_text || undefined,
              rewardAmount: updatedBeg.reward_amount,
            } : undefined);
            setPhase('complete_dare');
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [phase, currentBeg?.id]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="h-full bg-bingo-black flex flex-col">
      {/* Header */}
      <div className="pt-[env(safe-area-inset-top)] bg-black/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="p-4 flex items-center gap-3 border-b border-gray-800">
          <button
            onClick={onClose}
            className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-white active:text-acid-green transition-colors -ml-2 rounded-full active:bg-white/10"
          >
            <i className="fas fa-arrow-left text-2xl"></i>
          </button>
          <div>
            <h1 className="text-cyber-cyan font-bold uppercase tracking-widest">Beg Mode</h1>
            <p className="text-xs text-gray-500">
              {phase === 'select_target' && 'Swallow your pride and ask for Bingo'}
              {phase === 'awaiting_dare' && 'Waiting for your dare...'}
              {phase === 'complete_dare' && 'Time to earn your scraps'}
              {phase === 'proof_submitted' && 'Awaiting judgment...'}
              {phase === 'completed' && 'You earned some Bingo!'}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Phase: Select Target */}
        {phase === 'select_target' && (
          <div>
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">🥺</div>
              <h2 className="text-white text-xl font-bold mb-2">Running Low on Bingo?</h2>
              <p className="text-gray-400 text-sm">
                Pick a friend to beg. They'll assign you a dare.<br />
                Complete it for some sweet, sweet Bingo.
              </p>
            </div>

            {user.coins > 50 && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
                <p className="text-yellow-500 text-sm text-center">
                  <i className="fas fa-exclamation-triangle mr-2"></i>
                  You have {user.coins} Bingo. Begging is for the truly desperate.
                </p>
              </div>
            )}

            {acceptedFriends.length === 0 ? (
              <div className="text-center py-12">
                <i className="fas fa-user-slash text-4xl text-gray-700 mb-4"></i>
                <p className="text-gray-500">No friends to beg from yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                  Select a victim... I mean, generous friend
                </p>
                {acceptedFriends.map((friend) => (
                  <button
                    key={friend.id}
                    onClick={() => handleSelectTarget(friend)}
                    disabled={isSubmitting}
                    className="w-full bg-bingo-dark p-4 rounded-lg border border-gray-800 hover:border-cyber-cyan transition-colors flex items-center gap-4 disabled:opacity-50"
                  >
                    <img
                      src={friend.avatarUrl}
                      alt={friend.name}
                      className="w-14 h-14 rounded-full border-2 border-cyber-cyan"
                    />
                    <div className="flex-1 text-left">
                      <div className="text-white font-bold">{friend.name}</div>
                      <div className="text-xs text-gray-500">{friend.coins} Bingo in stash</div>
                    </div>
                    <div className="text-cyber-cyan">
                      <i className="fas fa-praying-hands text-xl"></i>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Phase: Awaiting Dare */}
        {phase === 'awaiting_dare' && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-20 h-20 border-4 border-cyber-cyan border-t-transparent rounded-full animate-spin mb-6"></div>
            <h2 className="text-white text-xl font-bold mb-2">Pathetic Request Sent</h2>
            <p className="text-gray-400 text-sm">
              Waiting for {selectedTarget?.name || 'your friend'} to assign a dare...
            </p>
            <p className="text-gray-600 text-xs mt-4">
              They're probably laughing at you right now.
            </p>
          </div>
        )}

        {/* Phase: Complete Dare */}
        {phase === 'complete_dare' && currentBeg && (
          <div className="text-center">
            {/* Camera overlay */}
            {isCameraOpen && (
              <div className="fixed inset-0 z-50 bg-black flex flex-col">
                <div className="flex-1 relative">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-6 bg-black/80 flex justify-center gap-4">
                  <button
                    onClick={stopCamera}
                    className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center text-white"
                  >
                    <i className="fas fa-times text-2xl"></i>
                  </button>
                  <button
                    onClick={capturePhoto}
                    className="w-20 h-20 rounded-full bg-cyber-cyan flex items-center justify-center text-black"
                  >
                    <i className="fas fa-camera text-3xl"></i>
                  </button>
                </div>
                <canvas ref={canvasRef} className="hidden" />
              </div>
            )}

            <div className="text-6xl mb-4">🎭</div>
            <h2 className="text-white text-xl font-bold mb-2">Your Dare</h2>

            <div className="bg-gradient-to-br from-cyber-cyan/20 to-purple-500/20 border border-cyber-cyan/50 rounded-xl p-6 my-6">
              <p className="text-cyan-400 text-xs uppercase tracking-wider mb-3">You must:</p>
              <p className="text-white text-lg font-bold">
                {currentBeg.dareText}
              </p>
            </div>

            <div className="bg-bingo-dark rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Reward</span>
                <span className="text-acid-green font-bold text-xl">
                  +{currentBeg.rewardAmount} 😼
                </span>
              </div>
            </div>

            {/* Captured image preview */}
            {capturedImage && (
              <div className="mb-6">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Your Proof</p>
                <div className="relative inline-block">
                  <img
                    src={capturedImage}
                    alt="Captured proof"
                    className="max-h-48 rounded-lg border border-cyber-cyan"
                  />
                  <button
                    onClick={() => setCapturedImage(null)}
                    className="absolute -top-2 -right-2 w-8 h-8 bg-alert-red rounded-full flex items-center justify-center text-white"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={handleDareProofCapture}
              disabled={isSubmitting}
              className="w-full bg-cyber-cyan text-black font-bold py-4 rounded-lg uppercase tracking-wider disabled:opacity-50"
            >
              {isSubmitting ? (
                <span><i className="fas fa-spinner fa-spin mr-2"></i>Uploading...</span>
              ) : capturedImage ? (
                <span><i className="fas fa-paper-plane mr-2"></i>Submit Proof</span>
              ) : (
                <span><i className="fas fa-camera mr-2"></i>Take Photo</span>
              )}
            </button>

            <p className="text-gray-600 text-xs mt-4">
              Don't half-ass it. Your friend will review the proof.
            </p>
          </div>
        )}

        {/* Phase: Proof Submitted */}
        {phase === 'proof_submitted' && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-6xl mb-4">⏳</div>
            <h2 className="text-white text-xl font-bold mb-2">Proof Submitted</h2>
            <p className="text-gray-400 text-sm">
              Waiting for {selectedTarget?.name || 'your friend'} to review your dare...
            </p>
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 mt-6">
              <p className="text-purple-400 text-sm">
                If they accept, you'll get your bingos. If not... well.
              </p>
            </div>
          </div>
        )}

        {/* Phase: Completed */}
        {phase === 'completed' && currentBeg && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-acid-green text-2xl font-bold mb-2">Bingo Received!</h2>
            <p className="text-white text-4xl font-black my-4">
              +{currentBeg.rewardAmount} 😼
            </p>
            <p className="text-gray-400 text-sm">
              Your embarrassing dare was worth something after all.
            </p>

            <button
              onClick={onClose}
              className="mt-8 bg-acid-green text-black font-bold py-4 px-8 rounded-lg uppercase tracking-wider"
            >
              Back to Grinding
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BegScreen;
