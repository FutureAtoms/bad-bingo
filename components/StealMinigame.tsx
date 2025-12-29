import React, { useState, useEffect } from 'react';
import { Friend } from '../types';
import { generateTrophyImage } from '../services/geminiService';

interface StealProps {
  target: Friend;
  onClose: () => void;
  onSuccess: (amount: number) => void;
  onFail: () => void;
}

const StealMinigame: React.FC<StealProps> = ({ target, onClose, onSuccess, onFail }) => {
  const [timeLeft, setTimeLeft] = useState(10); 
  const [progress, setProgress] = useState(0);
  const [clicks, setClicks] = useState(0);
  const [gameState, setGameState] = useState<'playing' | 'won' | 'lost'>('playing');
  const [trophyUrl, setTrophyUrl] = useState<string | null>(null);

  const REQUIRED_CLICKS = 35; 

  useEffect(() => {
    if (gameState !== 'playing') return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 0.1) {
          clearInterval(timer);
          setGameState('lost');
          onFail();
          return 0;
        }
        return prev - 0.1;
      });
    }, 100);

    return () => clearInterval(timer);
  }, [gameState, onFail]);

  useEffect(() => {
    const checkWin = async () => {
        if (clicks >= REQUIRED_CLICKS && gameState === 'playing') {
            setGameState('won');
            const stolenAmount = Math.floor(target.coins * 0.12);
            const img = await generateTrophyImage("YOU", stolenAmount);
            setTrophyUrl(img);
        }
    };
    checkWin();
  }, [clicks, gameState, target.coins]);

  const handleClick = () => {
    if (gameState !== 'playing') return;
    setClicks(prev => prev + 1);
    setProgress((clicks + 1) / REQUIRED_CLICKS * 100);
    if (navigator.vibrate) navigator.vibrate(40);
  };

  const handleClaim = () => {
     onSuccess(Math.floor(target.coins * 0.12));
  };

  return (
    <div className="absolute inset-0 bg-black/98 z-50 flex flex-col items-center justify-center p-6 text-center">
      
      {gameState === 'playing' && (
        <>
          <h2 className="text-acid-green text-3xl font-black mb-1 animate-pulse italic">RAIDING THE TREAT JAR...</h2>
          <p className="text-gray-500 mb-8 uppercase text-[10px] tracking-widest">Sneaking past {target.name}'s whiskers</p>
          
          <div className="text-7xl font-mono text-white mb-8 italic">
            {timeLeft.toFixed(1)}s
          </div>

          <div className="w-full max-w-xs bg-gray-900 h-2 rounded-full mb-12 overflow-hidden border border-gray-800">
            <div 
              className="bg-hot-pink h-full transition-all duration-100 ease-linear shadow-[0_0_10px_#ff0099]"
              style={{ width: `${Math.min(progress, 100)}%` }}
            ></div>
          </div>

          <button 
            onPointerDown={handleClick}
            className="w-40 h-40 rounded-full border-4 border-acid-green flex items-center justify-center active:scale-95 active:bg-acid-green/10 transition-transform touch-none select-none shadow-[0_0_30px_rgba(204,255,0,0.2)]"
          >
            <i className="fas fa-paw text-6xl text-acid-green"></i>
          </button>
          <p className="mt-6 text-[10px] text-gray-500 uppercase tracking-widest">TAP FAST OR GET THE SPRAY BOTTLE</p>
        </>
      )}

      {gameState === 'lost' && (
        <div className="animate-in fade-in zoom-in duration-300">
            <i className="fas fa-shower text-6xl text-cyan-glitch mb-6 animate-bounce"></i>
            <h2 className="text-4xl font-bold text-white mb-4 tracking-tighter">SPRAYED!</h2>
            <p className="text-cyan-glitch/80 mb-10 italic">"Wet fur and no tuna. You failed the raid."</p>
            <button onClick={onClose} className="bg-white text-black px-10 py-3 font-black rounded-sm uppercase text-sm">
                Slink Away
            </button>
        </div>
      )}

      {gameState === 'won' && (
        <div className="animate-in fade-in zoom-in duration-400">
            <h2 className="text-5xl font-black text-acid-green mb-2 italic">PURR-FECT!</h2>
            <p className="text-white mb-8 font-mono">You swiped {Math.floor(target.coins * 0.12)} TUNA 😼</p>
            
            {trophyUrl ? (
                <div className="mb-8 relative mx-auto inline-block">
                    <img src={trophyUrl} alt="Trophy" className="w-64 h-64 object-cover rounded border-2 border-acid-green shadow-[0_0_40px_rgba(204,255,0,0.4)]" />
                    <div className="absolute top-2 right-2 text-[8px] bg-black/90 px-1 text-acid-green font-mono uppercase">Master Thief NFT</div>
                </div>
            ) : (
                <div className="w-64 h-64 bg-gray-900 rounded flex items-center justify-center mb-8 border border-dashed border-gray-700 mx-auto">
                     <span className="text-[10px] text-gray-600 animate-pulse">MINTING TUNA TROPHY...</span>
                </div>
            )}

            <button onClick={handleClaim} className="w-full bg-acid-green text-black px-8 py-4 font-black rounded-sm text-lg hover:scale-105 transition-transform uppercase tracking-widest">
                CLAIM THE LOOT
            </button>
        </div>
      )}
    </div>
  );
};

export default StealMinigame;