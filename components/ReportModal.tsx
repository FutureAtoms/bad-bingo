import React, { useState } from 'react';
import { supabase } from '../services/supabase';

// Type-safe workaround for Supabase operations where inference fails


export type ReportType = 'bet' | 'proof' | 'user';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reporterId: string;
  reportType: ReportType;
  reportedId: string; // bet_id, proof_id, or user_id
  reportedUserId?: string; // For bet/proof, the user who created it
  contextInfo?: string; // Optional context like bet text or username
}

const REPORT_REASONS = [
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'hate_speech', label: 'Hate speech' },
  { value: 'threats', label: 'Threats or violence' },
  { value: 'spam', label: 'Spam or scam' },
  { value: 'privacy', label: 'Privacy violation' },
  { value: 'fake', label: 'Fake or misleading' },
  { value: 'nsfw', label: 'Sexually explicit content' },
  { value: 'cheating', label: 'Cheating or manipulation' },
  { value: 'other', label: 'Other' },
];

const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  reporterId,
  reportType,
  reportedId,
  reportedUserId,
  contextInfo,
}) => {
  const [selectedReason, setSelectedReason] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!selectedReason) {
      setError('Please select a reason for your report');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const { error: insertError } = await supabase.from('bb_reports').insert({
        reporter_id: reporterId,
        content_type: reportType,
        content_id: reportedId,
        reported_user_id: reportedUserId || null,
        reason: selectedReason,
        description: description.trim() || null,
        status: 'pending',
      });

      if (insertError) {
        console.error('Report insert error:', insertError);
        setError('Failed to submit report. Please try again.');
        setIsSubmitting(false);
        return;
      }

      setSubmitted(true);
    } catch (err) {
      console.error('Report submission error:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedReason('');
    setDescription('');
    setSubmitted(false);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  const getTypeLabel = () => {
    switch (reportType) {
      case 'bet': return 'Bet';
      case 'proof': return 'Proof';
      case 'user': return 'User';
      default: return 'Content';
    }
  };

  const getTypeIcon = () => {
    switch (reportType) {
      case 'bet': return 'fa-dice';
      case 'proof': return 'fa-image';
      case 'user': return 'fa-user';
      default: return 'fa-flag';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-bingo-dark border border-gray-800 rounded-xl max-w-md w-full max-h-[90vh] overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.5)]">
        {/* Header */}
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-alert-red/20 flex items-center justify-center">
              <i className={`fas ${getTypeIcon()} text-alert-red`}></i>
            </div>
            <div>
              <h2 className="text-white font-bold">Report {getTypeLabel()}</h2>
              <p className="text-xs text-gray-500">Help keep Bad Bingo safe</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-10 h-10 flex items-center justify-center text-gray-500 hover:text-white rounded-full hover:bg-white/10 transition-colors"
          >
            <i className="fas fa-times text-lg"></i>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-180px)]">
          {submitted ? (
            // Success State
            <div className="text-center py-8">
              <div className="w-20 h-20 rounded-full bg-acid-green/20 flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-check text-4xl text-acid-green"></i>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Report Submitted</h3>
              <p className="text-gray-400 text-sm mb-6">
                Thanks for helping keep Bad Bingo safe.
                <br />
                We'll review this and take action if needed.
              </p>
              <button
                onClick={handleClose}
                className="bg-gray-800 text-white font-bold py-3 px-8 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Done
              </button>
            </div>
          ) : (
            // Report Form
            <>
              {/* Context Info */}
              {contextInfo && (
                <div className="mb-4 p-3 bg-black/50 rounded-lg border border-gray-800">
                  <div className="text-xs text-gray-500 uppercase mb-1">Reporting</div>
                  <div className="text-white text-sm truncate">{contextInfo}</div>
                </div>
              )}

              {/* Reason Selection */}
              <div className="mb-4">
                <label className="block text-xs text-gray-500 uppercase tracking-wider mb-2">
                  Why are you reporting this?
                </label>
                <div className="space-y-2">
                  {REPORT_REASONS.map((reason) => (
                    <button
                      key={reason.value}
                      onClick={() => setSelectedReason(reason.value)}
                      className={`w-full p-3 rounded-lg text-left text-sm font-medium transition-all flex items-center gap-3 ${
                        selectedReason === reason.value
                          ? 'bg-alert-red/20 border border-alert-red text-white'
                          : 'bg-gray-900 border border-gray-800 text-gray-400 hover:border-gray-700'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        selectedReason === reason.value
                          ? 'bg-alert-red border-alert-red'
                          : 'border-gray-600'
                      }`}>
                        {selectedReason === reason.value && (
                          <i className="fas fa-check text-white text-xs"></i>
                        )}
                      </div>
                      {reason.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Additional Details */}
              <div className="mb-4">
                <label className="block text-xs text-gray-500 uppercase tracking-wider mb-2">
                  Additional details (optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell us more about what happened..."
                  className="w-full bg-black border border-gray-700 rounded-lg p-3 text-white placeholder-gray-600 resize-none h-24 focus:border-alert-red focus:outline-none text-sm"
                  maxLength={500}
                />
                <div className="text-right text-xs text-gray-600 mt-1">
                  {description.length}/500
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-4 p-3 bg-alert-red/20 border border-alert-red/30 rounded-lg">
                  <p className="text-alert-red text-sm flex items-center gap-2">
                    <i className="fas fa-exclamation-circle"></i>
                    {error}
                  </p>
                </div>
              )}

              {/* Privacy Note */}
              <div className="mb-4 p-3 bg-gray-900/50 rounded-lg">
                <p className="text-xs text-gray-500">
                  <i className="fas fa-shield-alt mr-2 text-cyan-glitch"></i>
                  Your report is confidential. The reported user won't know who reported them.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        {!submitted && (
          <div className="p-4 border-t border-gray-800 flex gap-3">
            <button
              onClick={handleClose}
              className="flex-1 bg-gray-800 text-white font-bold py-3 rounded-lg uppercase tracking-wider hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!selectedReason || isSubmitting}
              className={`flex-1 font-bold py-3 rounded-lg uppercase tracking-wider transition-colors ${
                selectedReason && !isSubmitting
                  ? 'bg-alert-red text-white hover:bg-red-600'
                  : 'bg-gray-800 text-gray-600 cursor-not-allowed'
              }`}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <i className="fas fa-spinner fa-spin"></i> Submitting...
                </span>
              ) : (
                'Submit Report'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportModal;
