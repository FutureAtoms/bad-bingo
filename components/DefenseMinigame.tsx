import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Friend, StealAttempt } from '../types';
import { defendSteal } from '../services/steals';

interface DefenseMinigameProps {
  steal: StealAttempt;
  thief: { name: string; avatarUrl: string };
  userId: string; // The defender's user ID
  onDefendSuccess: () => void;
  onDefendFail: () => void;
  onClose: () => void;
}

const DefenseMinigame: React.FC<DefenseMinigameProps> = ({
  steal,
  thief,
  userId,
  onDefendSuccess,
  onDefendFail,
  onClose,
}) => {
  const [timeRemaining, setTimeRemaining] = useState(16);
  const [tapCount, setTapCount] = useState(0);
  const [phase, setPhase] = useState<'alert' | 'defense' | 'success' | 'fail'>('alert');
  const [isShaking, setIsShaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const hasCalledService = useRef(false);

  const REQUIRED_TAPS = 25;

  // Alert phase countdown (3 seconds to understand what's happening)
  useEffect(() => {
    if (phase === 'alert') {
      const timer = setTimeout(() => setPhase('defense'), 3000);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  // Defense countdown
  useEffect(() => {
    if (phase !== 'defense') return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          // Check if defended
          if (tapCount >= REQUIRED_TAPS) {
            setPhase('success');
          } else {
            setPhase('fail');
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [phase, tapCount]);

  // Handle tap
  const handleTap = useCallback(() => {
    if (phase !== 'defense') return;

    setTapCount((prev) => {
      const newCount = prev + 1;
      if (newCount >= REQUIRED_TAPS && phase === 'defense') {
        setPhase('success');
      }
      return newCount;
    });

    // Visual feedback
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 100);

    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(30);
    }
  }, [phase]);

  // Handle result - call defendSteal service on success
  useEffect(() => {
    const handleDefenseResult = async () => {
      // Prevent multiple calls
      if (hasCalledService.current) return;
      hasCalledService.current = true;

      if (phase === 'success') {
        setIsProcessing(true);
        try {
          // Call the defendSteal service to record the successful defense
          const result = await defendSteal(steal.id, userId);
          if (result.success) {
            onDefendSuccess();
          } else {
            // Service failed but we still show success UI since they defended in time
            console.error('Failed to record defense:', result.error);
            onDefendSuccess();
          }
        } catch (err) {
          console.error('Error calling defendSteal:', err);
          // Still call success callback since they did defend in time
          onDefendSuccess();
        } finally {
          setIsProcessing(false);
        }
      } else if (phase === 'fail') {
        onDefendFail();
      }
    };

    if (phase === 'success' || phase === 'fail') {
      handleDefenseResult();
    }
  }, [phase, steal.id, userId, onDefendSuccess, onDefendFail]);

  return (
    <div className="fixed inset-0 bg-bingo-black z-50 flex flex-col overflow-hidden">
      {/* Alert Phase */}
      {phase === 'alert' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-pulse">
          <div className="w-24 h-24 bg-alert-red rounded-full flex items-center justify-center mb-6 animate-bounce">
            <i className="fas fa-exclamation text-5xl text-white"></i>
          </div>
          <h1 className="text-alert-red text-3xl font-black uppercase tracking-wider mb-4">
            YOU'RE BEING ROBBED!
          </h1>
          <div className="flex items-center gap-3 mb-4">
            <img
              src={thief.avatarUrl}
              alt={thief.name}
              className="w-16 h-16 rounded-full border-2 border-alert-red"
            />
            <div className="text-left">
              <p className="text-white font-bold">{thief.name}</p>
              <p className="text-gray-400 text-sm">is stealing your Bingo!</p>
            </div>
          </div>
          <div className="bg-alert-red/20 border border-alert-red rounded-lg p-4 mt-4">
            <p className="text-white">
              <span className="text-alert-red font-bold">{steal.potentialAmount} Bingo</span> at stake!
            </p>
            <p className="text-xs text-gray-400 mt-2">Get ready to defend...</p>
          </div>
        </div>
      )}

      {/* Defense Phase */}
      {phase === 'defense' && (
        <div className="flex-1 flex flex-col">
          {/* Timer Header */}
          <div className="bg-alert-red p-4 text-center">
            <div className="text-sm text-white/80 uppercase tracking-wider">Time Remaining</div>
            <div className="text-5xl font-black text-white font-mono">
              {timeRemaining}s
            </div>
          </div>

          {/* Progress */}
          <div className="px-6 py-4 bg-black/50">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Defense Progress</span>
              <span className="text-white font-bold">{tapCount}/{REQUIRED_TAPS}</span>
            </div>
            <div className="h-4 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-acid-green to-green-400 transition-all duration-100"
                style={{ width: `${Math.min(100, (tapCount / REQUIRED_TAPS) * 100)}%` }}
              />
            </div>
          </div>

          {/* Main tap area */}
          <div className="flex-1 flex flex-col items-center justify-center p-6">
            <p className="text-gray-400 text-sm uppercase tracking-wider mb-4">
              TAP RAPIDLY TO DEFEND!
            </p>
            <button
              onClick={handleTap}
              className={`w-48 h-48 rounded-full bg-gradient-to-br from-acid-green to-green-600 flex items-center justify-center text-8xl active:scale-95 transition-transform shadow-[0_0_50px_rgba(0,255,102,0.5)] ${
                isShaking ? 'animate-pulse' : ''
              }`}
            >
              🛡️
            </button>
            <p className="text-white text-xl font-bold mt-6">
              {tapCount} taps
            </p>
            <p className="text-gray-500 text-xs mt-2">
              {REQUIRED_TAPS - tapCount} more to defend!
            </p>
          </div>

          {/* Thief info */}
          <div className="p-4 bg-black/50 border-t border-gray-800">
            <div className="flex items-center gap-3">
              <img
                src={thief.avatarUrl}
                alt={thief.name}
                className="w-12 h-12 rounded-full border-2 border-alert-red"
              />
              <div className="flex-1">
                <p className="text-alert-red font-bold text-sm">{thief.name}</p>
                <p className="text-gray-400 text-xs">Attempting to steal {steal.potentialAmount} Bingo</p>
              </div>
              <div className="text-right">
                <p className="text-alert-red font-bold">{steal.stealPercentage}%</p>
                <p className="text-gray-500 text-xs">of your stash</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Phase */}
      {phase === 'success' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-green-900/50 to-bingo-black">
          <div className="w-32 h-32 bg-acid-green rounded-full flex items-center justify-center mb-6 animate-bounce">
            {isProcessing ? (
              <i className="fas fa-spinner fa-spin text-6xl text-black"></i>
            ) : (
              <i className="fas fa-shield-alt text-6xl text-black"></i>
            )}
          </div>
          <h1 className="text-acid-green text-3xl font-black uppercase tracking-wider mb-4">
            {isProcessing ? 'RECORDING...' : 'DEFENDED!'}
          </h1>
          <p className="text-white text-lg mb-2">
            You caught {thief.name} red-pawed!
          </p>
          <p className="text-gray-400 mb-6">
            They pay <span className="text-acid-green font-bold">{steal.potentialAmount * 2}</span> Bingo penalty!
          </p>
          <div className="bg-green-900/30 border border-acid-green rounded-lg p-4">
            <p className="text-acid-green text-sm">
              {isProcessing ? 'Saving your victory...' : 'Your Bingo is safe + you get a bonus!'}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="mt-8 bg-acid-green text-black font-bold py-4 px-8 rounded-lg uppercase tracking-wider disabled:opacity-50"
          >
            {isProcessing ? 'Please wait...' : 'Nice!'}
          </button>
        </div>
      )}

      {/* Fail Phase */}
      {phase === 'fail' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-red-900/50 to-bingo-black">
          <div className="w-32 h-32 bg-alert-red rounded-full flex items-center justify-center mb-6">
            <i className="fas fa-times text-6xl text-white"></i>
          </div>
          <h1 className="text-alert-red text-3xl font-black uppercase tracking-wider mb-4">
            ROBBED!
          </h1>
          <p className="text-white text-lg mb-2">
            {thief.name} got away with your Bingo!
          </p>
          <p className="text-gray-400 mb-6">
            You lost <span className="text-alert-red font-bold">{steal.potentialAmount}</span> Bingo
          </p>
          <div className="bg-red-900/30 border border-alert-red rounded-lg p-4">
            <p className="text-alert-red text-sm">
              Better luck next time. Stay alert! 🚨
            </p>
          </div>
          <button
            onClick={onClose}
            className="mt-8 bg-gray-700 text-white font-bold py-4 px-8 rounded-lg uppercase tracking-wider"
          >
            Dang it...
          </button>
        </div>
      )}
    </div>
  );
};

export default DefenseMinigame;
