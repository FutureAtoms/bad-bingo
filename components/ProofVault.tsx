import React, { useState, useEffect, useCallback } from 'react';
import { ActiveBet } from '../types';
import ReportModal from './ReportModal';

interface ProofVaultProps {
  bet: ActiveBet;
  userId?: string; // Current user's ID for reporting
  onClose: () => void;
  onAccept: () => void;
  onDispute: (reason: string) => void;
}

const ProofVault: React.FC<ProofVaultProps> = ({
  bet,
  userId,
  onClose,
  onAccept,
  onDispute,
}) => {
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [isExpired, setIsExpired] = useState(false);
  const [viewed, setViewed] = useState(false);
  const [showDispute, setShowDispute] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [countdown, setCountdown] = useState(3);
  const [showContent, setShowContent] = useState(false);

  // Calculate time remaining for proof
  useEffect(() => {
    if (!bet.proofDeadline) return;

    const updateTimer = () => {
      const deadline = new Date(bet.proofDeadline!);
      const now = new Date();
      const diff = deadline.getTime() - now.getTime();

      if (diff <= 0) {
        setIsExpired(true);
        setTimeRemaining('Expired');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m`);
      } else if (minutes > 0) {
        setTimeRemaining(`${minutes}m ${seconds}s`);
      } else {
        setTimeRemaining(`${seconds}s`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [bet.proofDeadline]);

  // Countdown before showing proof (view-once protection)
  useEffect(() => {
    if (bet.proofIsViewOnce && !showContent) {
      if (countdown > 0) {
        const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
        return () => clearTimeout(timer);
      } else {
        setShowContent(true);
        setViewed(true);
      }
    } else if (!bet.proofIsViewOnce) {
      setShowContent(true);
      setViewed(true);
    }
  }, [countdown, bet.proofIsViewOnce, showContent]);

  const handleDispute = () => {
    if (disputeReason.trim()) {
      onDispute(disputeReason);
      setShowDispute(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-bingo-black z-50 flex flex-col">
      {/* Header */}
      <div className="pt-[env(safe-area-inset-top)] bg-black/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="p-4 flex items-center justify-between border-b border-gray-800">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-white active:text-acid-green transition-colors -ml-2 rounded-full active:bg-white/10"
            >
              <i className="fas fa-times text-2xl"></i>
            </button>
            <div>
              <h1 className="text-acid-green font-bold uppercase tracking-widest text-sm">
                Proof Vault
              </h1>
              <p className="text-xs text-gray-500">
                {bet.proofIsViewOnce ? '🔒 View Once' : '👁️ Multiple Views'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Report proof button */}
            {userId && (
              <button
                onClick={() => setShowReportModal(true)}
                className="w-10 h-10 flex items-center justify-center text-gray-500 hover:text-alert-red transition-colors rounded-full hover:bg-white/10"
                title="Report this proof"
              >
                <i className="fas fa-flag text-sm"></i>
              </button>
            )}
            <div className="text-right">
              <div className={`text-xs uppercase tracking-wider ${isExpired ? 'text-alert-red' : 'text-gray-500'}`}>
                {isExpired ? 'Expired' : 'Expires in'}
              </div>
              <div className={`font-mono font-bold ${isExpired ? 'text-alert-red' : 'text-acid-green'}`}>
                {timeRemaining}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        {/* View-once countdown */}
        {bet.proofIsViewOnce && !showContent && (
          <div className="text-center">
            <div className="w-32 h-32 rounded-full border-4 border-acid-green flex items-center justify-center mb-6">
              <span className="text-6xl font-black text-acid-green">{countdown}</span>
            </div>
            <p className="text-gray-400 text-sm mb-2">Preparing proof...</p>
            <p className="text-yellow-500 text-xs uppercase tracking-wider">
              ⚠️ View Once - Screenshot = Penalty
            </p>
          </div>
        )}

        {/* Proof content */}
        {showContent && (
          <div className="w-full max-w-md">
            {/* Bet context */}
            <div className="bg-bingo-dark border border-gray-800 rounded-lg p-4 mb-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">The Bet</p>
              <p className="text-white">{bet.scenario}</p>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-700">
                <span className="text-xs text-gray-500">Pot</span>
                <span className="text-acid-green font-bold">{bet.totalPot} 🐱</span>
              </div>
            </div>

            {/* Proof display */}
            {bet.proofUrl ? (
              <div className="relative rounded-lg overflow-hidden bg-black border border-gray-800">
                {bet.proofType === 'photo' && (
                  <img
                    src={bet.proofUrl}
                    alt="Proof"
                    className="w-full h-auto max-h-[50vh] object-contain"
                  />
                )}
                {bet.proofType === 'video' && (
                  <video
                    src={bet.proofUrl}
                    controls
                    className="w-full max-h-[50vh]"
                    playsInline
                  />
                )}

                {/* Watermark overlay */}
                <div className="absolute bottom-2 left-2 right-2 flex justify-between items-end">
                  <div className="bg-black/70 px-2 py-1 rounded text-[10px] text-gray-400">
                    <i className="fas fa-clock mr-1"></i>
                    {new Date().toLocaleString()}
                  </div>
                  {bet.proofIsViewOnce && viewed && (
                    <div className="bg-yellow-500/80 px-2 py-1 rounded text-[10px] text-black font-bold uppercase">
                      Viewed
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="aspect-video bg-gray-900 rounded-lg flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <i className="fas fa-image text-4xl mb-2"></i>
                  <p className="text-sm">No proof available</p>
                </div>
              </div>
            )}

            {/* View once warning */}
            {bet.proofIsViewOnce && viewed && (
              <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-yellow-500 text-xs text-center">
                  <i className="fas fa-exclamation-triangle mr-2"></i>
                  This proof is now destroyed. Screenshots result in penalties.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      {showContent && !showDispute && (
        <div className="p-4 pb-[env(safe-area-inset-bottom)] bg-black/80 backdrop-blur-sm border-t border-gray-800">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setShowDispute(true)}
              className="bg-bingo-dark border border-gray-700 py-4 rounded-lg text-white font-bold uppercase tracking-wider hover:bg-gray-800 transition-colors"
            >
              <i className="fas fa-flag mr-2"></i>
              Dispute
            </button>
            <button
              onClick={onAccept}
              className="bg-acid-green py-4 rounded-lg text-black font-bold uppercase tracking-wider hover:bg-acid-green/90 transition-colors"
            >
              <i className="fas fa-check mr-2"></i>
              Accept
            </button>
          </div>
        </div>
      )}

      {/* Dispute form */}
      {showDispute && (
        <div className="p-4 pb-[env(safe-area-inset-bottom)] bg-black/80 backdrop-blur-sm border-t border-gray-800">
          <div className="mb-4">
            <label className="block text-xs text-gray-500 uppercase tracking-wider mb-2">
              Why are you disputing this proof?
            </label>
            <textarea
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="The proof doesn't show what was bet on..."
              className="w-full bg-bingo-dark border border-gray-700 rounded-lg p-3 text-white placeholder-gray-500 resize-none h-24 focus:border-acid-green focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setShowDispute(false)}
              className="bg-bingo-dark border border-gray-700 py-3 rounded-lg text-white font-bold uppercase tracking-wider"
            >
              Cancel
            </button>
            <button
              onClick={handleDispute}
              disabled={!disputeReason.trim()}
              className="bg-alert-red py-3 rounded-lg text-white font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Submit Dispute
            </button>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {userId && (
        <ReportModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          reporterId={userId}
          reportType="proof"
          reportedId={bet.id}
          reportedUserId={bet.opponentId}
          contextInfo={`Proof for bet: "${bet.scenario}"`}
        />
      )}
    </div>
  );
};

export default ProofVault;
