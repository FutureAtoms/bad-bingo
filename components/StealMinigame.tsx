import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Friend, UserProfile } from '../types';
import { generateTrophyImage } from '../services/geminiService';
import { triggerHaptic, triggerWinEffect, triggerLoseEffect, playSound } from '../services/effects';
import { initiateSteal, completeSteal } from '../services/steals';
import { supabase, db } from '../services/supabase';
import type { DBSteal } from '../types/database';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface StealProps {
  user: UserProfile;
  target: Friend;
  onClose: () => void;
  onSuccess: (amount: number) => void;
  onFail: (penalty?: number) => void;
}

type GameState = 'countdown' | 'initializing' | 'playing' | 'defense_warning' | 'won' | 'caught' | 'timeout' | 'error';

const StealMinigame: React.FC<StealProps> = ({ user, target, onClose, onSuccess, onFail }) => {
  const [gameState, setGameState] = useState<GameState>('initializing');
  const [countdownValue, setCountdownValue] = useState(3);
  const [timeLeft, setTimeLeft] = useState(60); // 60 seconds to steal
  const [progress, setProgress] = useState(0);
  const [clicks, setClicks] = useState(0);
  const [trophyUrl, setTrophyUrl] = useState<string | null>(null);
  const [defenseTimer, setDefenseTimer] = useState(16); // 16 second defense window
  const [showDefenseWarning, setShowDefenseWarning] = useState(false);
  const [stolenPercentage, setStokenPercentage] = useState(0);
  const [stealRecord, setStealRecord] = useState<DBSteal | null>(null);
  const [potentialAmount, setPotentialAmount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Realtime subscription for defense updates
  const subscriptionRef = useRef<RealtimeChannel | null>(null);

  // Initialize steal attempt in database and set up realtime defense subscription
  useEffect(() => {
    const initSteal = async () => {
      const result = await initiateSteal(user.id, target.id);

      if (result.error) {
        setErrorMessage(result.error);
        setGameState('error');
        return;
      }

      if (result.steal) {
        setStealRecord(result.steal);
        setPotentialAmount(result.potentialAmount);
        setGameState('countdown');

        // Set up realtime subscription to monitor for target's defense
        // This replaces the simulated Math.random() defense check
        const channel = supabase
          .channel(`steal-defense-${result.steal.id}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'bb_steals',
              filter: `id=eq.${result.steal.id}`,
            },
            (payload) => {
              const updatedSteal = payload.new as DBSteal;

              // If target successfully defended, trigger caught state
              if (updatedSteal.was_defended) {
                triggerLoseEffect();
                playSound('lose', 0.6);
                setGameState('caught');
              }
            }
          )
          .subscribe();

        subscriptionRef.current = channel;

        // Send push notification to target about the steal attempt
        // This allows them to defend in real-time
        // Using 'db' (untyped) because notification types aren't fully inferred
        await db.from('bb_notifications').insert({
          user_id: target.id,
          type: 'steal',
          title: '🚨 HEIST ALERT!',
          message: `${user.name} is trying to steal your bingos! Quick, defend your stash!`,
          priority: 'critical',
          reference_type: 'steal',
          reference_id: result.steal.id,
        });
      }
    };

    initSteal();

    // Cleanup subscription on unmount
    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
    };
  }, [user.id, user.name, target.id]);

  // Calculate potential steal amount based on DB record
  const calculateStealAmount = useCallback(() => {
    return potentialAmount;
  }, [potentialAmount]);

  const REQUIRED_CLICKS = 50; // Need 50 clicks to complete heist

  // Countdown before game starts
  useEffect(() => {
    if (gameState !== 'countdown') return;

    const timer = setInterval(() => {
      setCountdownValue(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setGameState('playing');

          // If target was online when steal started, show defense warning
          // This is based on actual target online status, not random
          if (stealRecord?.target_was_online && stealRecord?.defense_window_end) {
            // Show defense warning immediately for online targets
            setShowDefenseWarning(true);
            setGameState('defense_warning');
          }

          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState, stealRecord]);

  // Main game timer
  useEffect(() => {
    if (gameState !== 'playing' && gameState !== 'defense_warning') return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 0.1) {
          clearInterval(timer);
          setGameState('timeout');
          return 0;
        }
        return prev - 0.1;
      });
    }, 100);

    return () => clearInterval(timer);
  }, [gameState]);

  // Defense countdown (16 seconds for target to block)
  // The actual catch is now determined by realtime subscription, not random
  useEffect(() => {
    if (!showDefenseWarning) return;

    // Play warning sound and vibration when defense starts
    playSound('challenge', 0.6);
    triggerHaptic('warning');

    const timer = setInterval(() => {
      setDefenseTimer(prev => {
        if (prev <= 0.1) {
          clearInterval(timer);
          // Defense window expired without target defending
          // The catch is now based on actual realtime defense via subscription
          // If we reach here and gameState is still defense_warning,
          // target didn't defend in time - steal can continue
          setShowDefenseWarning(false);

          // Only transition back to playing if we're still in defense_warning
          // (not caught via realtime subscription)
          if (gameState === 'defense_warning') {
            setGameState('playing');
          }
          return 0;
        }
        return prev - 0.1;
      });
    }, 100);

    return () => clearInterval(timer);
  }, [showDefenseWarning, gameState]);

  // Check for win condition
  useEffect(() => {
    const checkWin = async () => {
      if (clicks >= REQUIRED_CLICKS && (gameState === 'playing' || gameState === 'defense_warning')) {
        const percent = Math.min(1 + Math.floor(clicks / 5), 50);
        setStokenPercentage(percent);
        setGameState('won');
        // Play win celebration
        playSound('win', 0.7);
        triggerHaptic('success');
        const amount = calculateStealAmount();
        const img = await generateTrophyImage("YOU", amount);
        setTrophyUrl(img);
      }
    };
    checkWin();
  }, [clicks, gameState, calculateStealAmount]);

  const handleClick = () => {
    if (gameState !== 'playing' && gameState !== 'defense_warning') return;
    setClicks(prev => prev + 1);
    setProgress((clicks + 1) / REQUIRED_CLICKS * 100);
    triggerHaptic('light');
    playSound('tap', 0.3);
  };

  const handleClaim = async () => {
    if (!stealRecord) return;

    triggerWinEffect();

    // Complete the steal in DB
    const result = await completeSteal(stealRecord.id, true);

    if (result.success) {
      onSuccess(result.stolenAmount);
    } else {
      // Fallback to local amount if DB fails
      onSuccess(potentialAmount);
    }
  };

  const handleCaughtPenalty = async () => {
    if (!stealRecord) return;

    triggerLoseEffect();

    // Complete the steal as failed in DB (penalty applied there)
    await completeSteal(stealRecord.id, false);

    // Lose double what you tried to steal
    const penalty = potentialAmount * 2;
    onFail(penalty);
  };

  const handleTimeout = async () => {
    if (!stealRecord) return;

    triggerHaptic('error');
    playSound('lose', 0.5);

    // Complete the steal as failed
    await completeSteal(stealRecord.id, false);

    onFail();
  };

  const handleError = () => {
    onClose();
  };

  // Initializing screen
  if (gameState === 'initializing') {
    return (
      <div className="absolute inset-0 bg-black z-50 flex flex-col items-center justify-center">
        <i className="fas fa-spinner fa-spin text-5xl text-acid-green mb-4"></i>
        <p className="text-gray-500 text-sm uppercase tracking-widest">Scoping the target...</p>
      </div>
    );
  }

  // Error screen
  if (gameState === 'error') {
    return (
      <div className="absolute inset-0 bg-black z-50 flex flex-col items-center justify-center p-6">
        <i className="fas fa-exclamation-triangle text-5xl text-alert-red mb-4"></i>
        <h2 className="text-xl font-bold text-white mb-2">Heist Aborted!</h2>
        <p className="text-gray-400 text-sm text-center mb-6">{errorMessage || 'Something went wrong'}</p>
        <button
          onClick={handleError}
          className="bg-gray-800 text-white px-8 py-3 rounded-lg font-bold uppercase"
        >
          Back to Safety
        </button>
      </div>
    );
  }

  // Countdown screen
  if (gameState === 'countdown') {
    return (
      <div className="absolute inset-0 bg-black z-50 flex flex-col items-center justify-center">
        <div className="text-8xl font-black text-acid-green animate-pulse">{countdownValue}</div>
        <p className="text-gray-500 text-sm mt-4 uppercase tracking-widest">Initiating heist...</p>
        {stealRecord && (
          <p className="text-acid-green text-xs mt-2">Potential loot: {potentialAmount} bingos ({stealRecord.steal_percentage}%)</p>
        )}
      </div>
    );
  }

  return (
    <div className="absolute inset-0 bg-black/98 z-50 flex flex-col items-center justify-center p-6 text-center">

      {/* Defense Warning Overlay */}
      {showDefenseWarning && (
        <div className="absolute inset-0 bg-alert-red/20 z-60 flex items-center justify-center animate-pulse pointer-events-none">
          <div className="bg-black/90 p-6 rounded-lg border-2 border-alert-red">
            <i className="fas fa-exclamation-triangle text-4xl text-alert-red mb-3 animate-bounce"></i>
            <div className="text-alert-red font-black text-xl uppercase">Target Alert!</div>
            <div className="text-white text-sm mt-2">{target.name} might check their phone!</div>
            <div className="text-3xl font-mono text-alert-red mt-2">{defenseTimer.toFixed(1)}s</div>
            <div className="text-xs text-gray-400 mt-2">Keep tapping to finish before they see!</div>
          </div>
        </div>
      )}

      {(gameState === 'playing' || gameState === 'defense_warning') && (
        <>
          <h2 className="text-acid-green text-3xl font-black mb-1 animate-pulse italic">PAWS IN THE COOKIE JAR</h2>
          <p className="text-gray-500 mb-4 uppercase text-[10px] tracking-widest">robbing {target.name} blind... tap faster!</p>

          <div className="flex items-center gap-4 mb-6">
            <div className="text-center">
              <div className="text-4xl font-mono text-white">{timeLeft.toFixed(1)}s</div>
              <div className="text-[10px] text-gray-500">TIME LEFT</div>
            </div>
            <div className="h-12 w-px bg-gray-800"></div>
            <div className="text-center">
              <div className="text-4xl font-mono text-acid-green">{Math.min(Math.floor(1 + clicks / 5), 50)}%</div>
              <div className="text-[10px] text-gray-500">POTENTIAL LOOT</div>
            </div>
          </div>

          <div className="w-full max-w-xs bg-gray-900 h-3 rounded-full mb-8 overflow-hidden border border-gray-800">
            <div
              className={`h-full transition-all duration-100 ease-linear ${showDefenseWarning ? 'bg-alert-red shadow-[0_0_10px_#ff3366]' : 'bg-hot-pink shadow-[0_0_10px_#ff0099]'}`}
              style={{ width: `${Math.min(progress, 100)}%` }}
            ></div>
          </div>

          <button
            onPointerDown={handleClick}
            className={`w-44 h-44 rounded-full border-4 flex items-center justify-center active:scale-90 transition-transform touch-none select-none ${
              showDefenseWarning
                ? 'border-alert-red active:bg-alert-red/10 shadow-[0_0_30px_rgba(255,51,102,0.4)]'
                : 'border-acid-green active:bg-acid-green/10 shadow-[0_0_30px_rgba(204,255,0,0.2)]'
            }`}
          >
            <i className={`fas fa-paw text-6xl ${showDefenseWarning ? 'text-alert-red' : 'text-acid-green'}`}></i>
          </button>

          <div className="mt-6 flex items-center gap-2">
            <span className="text-2xl font-mono text-gray-400">{clicks}</span>
            <span className="text-xs text-gray-600">/ {REQUIRED_CLICKS} taps</span>
          </div>
          <p className="mt-2 text-[10px] text-gray-500 uppercase tracking-widest">TAP LIKE YOUR RENT DEPENDS ON IT</p>
        </>
      )}

      {gameState === 'timeout' && (
        <div className="animate-in fade-in zoom-in duration-300">
          <i className="fas fa-clock text-6xl text-gray-600 mb-6"></i>
          <h2 className="text-4xl font-bold text-white mb-4 tracking-tighter">TIME'S UP!</h2>
          <p className="text-gray-400 mb-4 italic">"Too slow. The cookie jar is empty."</p>
          <p className="text-gray-600 text-xs mb-10">You managed {clicks} taps but needed {REQUIRED_CLICKS}. Pathetic.</p>
          <button onClick={handleTimeout} className="bg-white text-black px-10 py-3 font-black rounded-sm uppercase text-sm">
            Walk Away Empty-Pawed
          </button>
        </div>
      )}

      {gameState === 'caught' && (
        <div className="animate-in fade-in zoom-in duration-300">
          <i className="fas fa-hand-paper text-6xl text-alert-red mb-6 animate-bounce"></i>
          <h2 className="text-4xl font-bold text-alert-red mb-4 tracking-tighter uppercase">CAUGHT!</h2>
          <p className="text-white mb-2 italic">"{target.name} caught you red-pawed!"</p>
          <div className="bg-alert-red/20 p-4 rounded-lg border border-alert-red my-6">
            <p className="text-alert-red font-bold text-lg">PENALTY: DOUBLE DAMAGES</p>
            <p className="text-white text-2xl font-mono mt-2">-{calculateStealAmount() * 2} BINGO</p>
            <p className="text-xs text-gray-400 mt-2">You tried to steal {calculateStealAmount()} Bingo, now you owe double.</p>
          </div>
          <p className="text-gray-600 text-xs mb-8 italic">"Crime doesn't pay. Well, not for you anyway."</p>
          <button onClick={handleCaughtPenalty} className="bg-alert-red text-white px-10 py-3 font-black rounded-sm uppercase text-sm">
            Pay The Price
          </button>
        </div>
      )}

      {gameState === 'won' && (
        <div className="animate-in fade-in zoom-in duration-400">
          <h2 className="text-5xl font-black text-acid-green mb-2 italic">CLEAN HEIST!</h2>
          <p className="text-white mb-2 font-mono">You robbed {calculateStealAmount()} BINGO from {target.name}!</p>
          <p className="text-gray-400 text-sm mb-2">({stolenPercentage}% of their stash)</p>
          <p className="text-gray-500 text-xs mb-8 italic">Their loss. Literally.</p>

          {trophyUrl ? (
            <div className="mb-8 relative mx-auto inline-block">
              <img src={trophyUrl} alt="Trophy" className="w-64 h-64 object-cover rounded border-2 border-acid-green shadow-[0_0_40px_rgba(204,255,0,0.4)]" />
              <div className="absolute top-2 right-2 text-[8px] bg-black/90 px-1 text-acid-green font-mono uppercase">Certified Menace</div>
            </div>
          ) : (
            <div className="w-64 h-64 bg-gray-900 rounded flex items-center justify-center mb-8 border border-dashed border-gray-700 mx-auto">
              <span className="text-[10px] text-gray-600 animate-pulse">Generating your criminal record...</span>
            </div>
          )}

          <button onClick={handleClaim} className="w-full bg-acid-green text-black px-8 py-4 font-black rounded-sm text-lg hover:scale-105 transition-transform uppercase tracking-widest">
            POCKET THE GOODS
          </button>
        </div>
      )}
    </div>
  );
};

export default StealMinigame;
