import React, { useEffect, useState, useRef } from 'react';
import { generateDailyBets } from '../services/geminiService';
import { BetScenario, Friend, UserProfile, ActiveBet } from '../types';

interface ClashProps {
  friend: Friend;
  user: UserProfile;
  onClose: () => void;
  onBetCreated: (bet: ActiveBet) => void;
}

const STATIC_BACKGROUNDS = {
  bedroom: 'https://images.unsplash.com/photo-1555680202-c86f0e12f086?q=80&w=800&auto=format&fit=crop', 
  gym: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=800&auto=format&fit=crop', 
  club: 'https://images.unsplash.com/photo-1566737236500-c8ac43014a67?q=80&w=800&auto=format&fit=crop', 
  street: 'https://images.unsplash.com/photo-1605218427306-635ba7467238?q=80&w=800&auto=format&fit=crop', 
  office: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=800&auto=format&fit=crop', 
  default: 'https://images.unsplash.com/photo-1515630278258-407f66498911?q=80&w=800&auto=format&fit=crop' 
};

const Clash: React.FC<ClashProps> = ({ friend, user, onClose, onBetCreated }) => {
  const [bets, setBets] = useState<BetScenario[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  
  const [dragStart, setDragStart] = useState<{x: number, y: number} | null>(null);
  const [dragDelta, setDragDelta] = useState(0);
  const [swipeResult, setSwipeResult] = useState<'left' | 'right' | null>(null);
  
  const [result, setResult] = useState<'none' | 'match' | 'boring'>('none');
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    const loadBets = async () => {
      setLoading(true);
      const generated = await generateDailyBets(friend.relationshipLevel, friend.name, user.riskProfile);
      setBets(generated);
      setLoading(false);
    };
    loadBets();

    const seen = localStorage.getItem('bingo_clash_tutorial_seen');
    if (!seen) {
      setShowTutorial(true);
    }
  }, [friend, user]);

  const dismissTutorial = () => {
    setShowTutorial(false);
    localStorage.setItem('bingo_clash_tutorial_seen', 'true');
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (result !== 'none') return;
    setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!dragStart || result !== 'none') return;
    const currentX = e.touches[0].clientX;
    const delta = currentX - dragStart.x;
    setDragDelta(delta);
  };

  const handleTouchEnd = () => {
    if (!dragStart) return;
    if (Math.abs(dragDelta) > 100) {
      handleSwipe(dragDelta > 0 ? 'right' : 'left');
    } else {
      setDragDelta(0);
    }
    setDragStart(null);
  };

  const handleSwipe = (direction: 'left' | 'right') => {
    if (result !== 'none') return; 

    setSwipeResult(direction);
    const currentBet = bets[currentIndex];
    const userVote = direction === 'right';
    const friendVote = currentBet.friendVote;
    const isBet = userVote !== friendVote;

    setTimeout(() => {
      setResult(isBet ? 'match' : 'boring');

      if (isBet) {
        onBetCreated({
          id: currentBet.id,
          betId: currentBet.id,
          scenario: currentBet.text,
          opponentId: friend.id,
          opponentName: friend.name,
          stake: currentBet.stake,
          totalPot: currentBet.stake * 2,
          status: 'pending_proof',
          isProver: userVote === true, // User voted yes = they need to prove
          proofType: currentBet.proofType,
          proofDeadline: currentBet.expiresAt,
          createdAt: new Date().toISOString(),
        });
        if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200]);
      } else {
        if (navigator.vibrate) navigator.vibrate(50);
      }
      
      setTimeout(() => {
        if (currentIndex < bets.length - 1) {
          setCurrentIndex(prev => prev + 1);
          setSwipeResult(null);
          setDragDelta(0);
          setResult('none');
        } else {
          onClose(); 
        }
      }, 1500);

    }, 200);
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-bingo-black text-acid-green">
        <i className="fas fa-cat fa-spin text-4xl mb-4"></i>
        <p className="animate-pulse tracking-widest uppercase">Digging up dirt on {friend.name}...</p>
        <p className="text-gray-600 text-xs mt-2 italic">This better be worth my time.</p>
      </div>
    );
  }

  const currentBet = bets[currentIndex];
  const rotateDeg = dragDelta * 0.1;
  const opacityNope = Math.min(Math.max(dragDelta * -0.01, 0), 1);
  const opacityLike = Math.min(Math.max(dragDelta * 0.01, 0), 1);

  let cardStyle = {
    transform: `translate(${dragDelta}px, 0px) rotate(${rotateDeg}deg)`,
    transition: dragStart ? 'none' : 'transform 0.3s ease-out'
  };

  if (swipeResult === 'left') {
    cardStyle = { transform: 'translate(-150%, 0px) rotate(-20deg)', transition: 'transform 0.4s ease-in' };
  } else if (swipeResult === 'right') {
    cardStyle = { transform: 'translate(150%, 0px) rotate(20deg)', transition: 'transform 0.4s ease-in' };
  }

  return (
    <div className="h-full relative overflow-hidden bg-black select-none">
      <div 
        className="absolute inset-0 bg-cover bg-center transition-all duration-500"
        style={{ 
          backgroundImage: `url(${STATIC_BACKGROUNDS[currentBet?.backgroundType] || STATIC_BACKGROUNDS.default})`,
          filter: 'brightness(0.3) contrast(1.2)'
        }}
      />

      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black to-transparent">
        <button onClick={onClose} className="text-white hover:text-alert-red">
          <i className="fas fa-times text-2xl"></i>
        </button>
        <div className="text-center">
          <h2 className="text-acid-green font-bold text-xl uppercase italic tracking-tighter">THE ARENA</h2>
          <p className="text-[10px] text-white uppercase">vs {friend.name} • no mercy</p>
        </div>
        <div className="w-8"></div>
      </div>

      <div 
        className="absolute inset-0 flex flex-col items-center justify-center p-6 z-20"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div 
          className="bg-black/80 border-2 border-white/50 p-6 rounded-sm shadow-[0_0_40px_rgba(204,255,0,0.15)] backdrop-blur-sm max-w-sm w-full relative"
          style={cardStyle}
        >
          <div className="absolute top-4 right-4 border-4 border-alert-red text-alert-red font-black text-4xl p-2 rounded transform rotate-12 opacity-0" style={{ opacity: opacityNope }}>NAH</div>
          <div className="absolute top-4 left-4 border-4 border-acid-green text-acid-green font-black text-4xl p-2 rounded transform -rotate-12 opacity-0" style={{ opacity: opacityLike }}>BET</div>

          <div className="text-hot-pink font-bold text-[10px] mb-2 tracking-widest uppercase flex justify-between">
            <span>{currentBet?.category}</span>
            <span>{currentBet?.stake} BINGOS 😼</span>
          </div>
          <h1 className="text-2xl font-bold text-white font-sans leading-tight mb-4 pointer-events-none italic">
            "I bet {currentBet?.text.replace("Bet ", "")}"
          </h1>
          <div className="h-1 w-full bg-gray-800 rounded">
            <div className="h-1 bg-acid-green" style={{ width: `${((currentIndex + 1) / bets.length) * 100}%` }}></div>
          </div>
        </div>
      </div>

      {showTutorial && (
        <div className="absolute inset-0 z-50 bg-black/90 flex flex-col items-center justify-center animate-in fade-in duration-300 px-8 text-center" onClick={dismissTutorial}>
           <i className="fas fa-cat text-5xl text-acid-green mb-6 animate-bounce"></i>
           <h2 className="text-2xl font-bold text-white mb-4 tracking-tighter">PAY ATTENTION, STRAY</h2>
           <div className="grid grid-cols-2 gap-8 mb-8 w-full">
               <div>
                   <div className="text-alert-red font-black text-2xl">← LEFT</div>
                   <div className="text-xs text-gray-500 uppercase">"Nah, no way"</div>
               </div>
               <div>
                   <div className="text-acid-green font-black text-2xl">RIGHT →</div>
                   <div className="text-xs text-gray-500 uppercase">"I'd bet on it"</div>
               </div>
           </div>
           <p className="text-gray-400 text-sm mb-10 italic">
             "When you and {friend.name} disagree... that's when bingos get locked in. Same answer? Boring. Move on."
           </p>
           <button onClick={dismissTutorial} className="bg-acid-green text-black font-black py-4 px-10 rounded-sm hover:scale-105 transition-transform uppercase tracking-widest text-sm">
              LET'S GET MESSY
            </button>
        </div>
      )}

      {result === 'match' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 animate-in fade-in duration-200 pointer-events-none">
            <div className="text-center transform scale-150 animate-bounce">
                <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-alert-red to-orange-500 italic">CLAWS OUT!</h1>
                <p className="text-white font-bold tracking-widest mt-2 uppercase text-xs">Someone's about to eat dirt 😼</p>
            </div>
        </div>
      )}

      {result === 'boring' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 animate-in fade-in duration-200 pointer-events-none">
             <div className="text-center">
                <i className="fas fa-wind text-6xl text-gray-700 mb-4"></i>
                <h1 className="text-4xl font-black text-gray-500 uppercase italic">*yawns*</h1>
                <p className="text-gray-600 text-xs">You both agree. How disappointingly peaceful.</p>
            </div>
        </div>
      )}
    </div>
  );
};

export default Clash;