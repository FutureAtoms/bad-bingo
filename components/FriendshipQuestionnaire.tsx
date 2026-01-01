import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, Friend } from '../types';
import { FRIENDSHIP_QUESTIONS, submitFriendshipQuestionnaire, QUESTIONNAIRE_REWARD } from '../services/friends';

interface FriendshipQuestionnaireProps {
  user: UserProfile;
  friend: Friend;
  friendshipId: string;
  onComplete: (rewardClaimed: boolean) => void;
  onClose: () => void;
}

const FriendshipQuestionnaire: React.FC<FriendshipQuestionnaireProps> = ({
  user,
  friend,
  friendshipId,
  onComplete,
  onClose,
}) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReward, setShowReward] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentQuestion, answers]);

  useEffect(() => {
    // Focus input on mount and after each question
    inputRef.current?.focus();
  }, [currentQuestion]);

  const handleAnswer = async () => {
    if (!input.trim()) return;
    setError(null);

    const newAnswers = [...answers, input.trim()];
    setAnswers(newAnswers);
    setInput('');

    if (currentQuestion < FRIENDSHIP_QUESTIONS.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    } else {
      // All questions answered - submit
      setIsSubmitting(true);
      try {
        const result = await submitFriendshipQuestionnaire(friendshipId, user.id, newAnswers);
        setIsSubmitting(false);

        if (result.success) {
          if (result.rewardClaimed) {
            setShowReward(true);
            setTimeout(() => {
              onComplete(true);
            }, 3000);
          } else {
            // Show waiting message briefly before completing
            setTimeout(() => {
              onComplete(false);
            }, 1500);
          }
        } else {
          setError(result.error || 'Failed to submit questionnaire');
        }
      } catch (err) {
        setIsSubmitting(false);
        setError('An unexpected error occurred');
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAnswer();
    }
  };

  const progress = ((currentQuestion + 1) / FRIENDSHIP_QUESTIONS.length) * 100;

  // Reward animation screen
  if (showReward) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
        <div className="text-center animate-pulse">
          <div className="text-6xl mb-4">🎉</div>
          <div className="text-4xl font-black text-green-400 mb-2">+{QUESTIONNAIRE_REWARD.toLocaleString()} BINGOS!</div>
          <div className="text-white text-lg">You both completed the questionnaire!</div>
          <div className="text-gray-500 mt-4">Building friendship chaos...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
      {/* Header with safe area padding */}
      <div className="pt-[env(safe-area-inset-top)] border-b border-gray-800 bg-black">
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={onClose}
              className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-white active:text-acid-green transition-colors -ml-2 rounded-full active:bg-white/10"
              aria-label="Close questionnaire"
            >
              <i className="fas fa-times text-2xl"></i>
            </button>
            <div className="flex items-center gap-2">
              <img
                src={friend.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.username}`}
                alt={friend.name}
                className="w-8 h-8 rounded-full border-2 border-green-400"
              />
              <span className="text-white font-bold">{friend.name}</span>
            </div>
            <div className="text-green-400 text-xs font-mono bg-gray-800 px-2 py-1 rounded">
              {currentQuestion + 1}/{FRIENDSHIP_QUESTIONS.length}
            </div>
          </div>
          {/* Progress bar */}
          <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-400 transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Header info */}
        <div className="text-center mb-6">
          <div className="text-pink-500 text-xs uppercase tracking-widest mb-2 font-bold">
            Friendship Interrogation
          </div>
          <div className="text-gray-500 text-sm">
            Complete this to earn {QUESTIONNAIRE_REWARD.toLocaleString()} bingos each!
          </div>
        </div>

        {/* Previous Q&A pairs */}
        {answers.map((answer, idx) => (
          <React.Fragment key={idx}>
            {/* Question bubble */}
            <div className="flex justify-start">
              <div className="max-w-[85%] p-3 rounded-lg border border-green-400 bg-gray-800 text-green-400 rounded-tl-none text-sm">
                {FRIENDSHIP_QUESTIONS[idx]}
              </div>
            </div>
            {/* Answer bubble */}
            <div className="flex justify-end">
              <div className="max-w-[85%] p-3 rounded-lg border border-pink-500 bg-gray-800 text-pink-400 rounded-tr-none text-sm">
                {answer}
              </div>
            </div>
          </React.Fragment>
        ))}

        {/* Current Question */}
        {currentQuestion < FRIENDSHIP_QUESTIONS.length && !isSubmitting && (
          <div className="flex justify-start">
            <div className="max-w-[85%] p-3 rounded-lg border border-green-400 bg-gray-800 text-green-400 rounded-tl-none animate-pulse text-sm">
              {FRIENDSHIP_QUESTIONS[currentQuestion]}
            </div>
          </div>
        )}

        {/* Submitting state */}
        {isSubmitting && (
          <div className="text-center text-gray-500 py-4">
            <svg className="animate-spin h-6 w-6 mx-auto mb-2 text-green-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Processing your answers...
          </div>
        )}

        {/* Completion message when waiting for friend */}
        {answers.length === FRIENDSHIP_QUESTIONS.length && !isSubmitting && !showReward && (
          <div className="text-center py-4">
            <div className="text-green-400 text-lg font-bold mb-2">Interrogation Complete!</div>
            <div className="text-gray-400 text-sm">
              Waiting for {friend.name} to complete theirs...
            </div>
            <div className="text-gray-500 text-xs mt-2">
              You'll both get {QUESTIONNAIRE_REWARD.toLocaleString()} bingos when they finish!
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="text-center text-red-500 py-2 text-sm">
            {error}
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-gray-800 bg-black">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Spill the tea..."
            disabled={isSubmitting || answers.length === FRIENDSHIP_QUESTIONS.length}
            className="flex-1 bg-gray-800 border border-gray-700 text-white p-3 rounded-lg focus:outline-none focus:border-green-400 text-sm placeholder-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
            autoComplete="off"
          />
          <button
            onClick={handleAnswer}
            disabled={!input.trim() || isSubmitting || answers.length === FRIENDSHIP_QUESTIONS.length}
            className="bg-green-400 text-black font-bold px-4 rounded-lg hover:bg-green-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Send answer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        {/* Character hint */}
        {input.length > 0 && input.length < 5 && (
          <div className="text-gray-500 text-xs mt-1 text-right">
            Keep going...
          </div>
        )}
      </div>
    </div>
  );
};

export default FriendshipQuestionnaire;
