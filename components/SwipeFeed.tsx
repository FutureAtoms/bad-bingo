import React, { useEffect, useState, useCallback, useRef } from 'react';
import { BetScenario, Friend, UserProfile, ActiveBet, AppView } from '../types';
import { calculateStake } from '../services/economy';
import { generateBetsForFriend, swipeBet, getBetById, SwipeMatchType } from '../services/bets';
import { triggerMatchEffect, triggerSwipeEffect, playSound, triggerHaptic, createSparkParticles, Particle } from '../services/effects';
import { supabase } from '../services/supabase';
import type { DBClash } from '../types/database';

interface SwipeFeedProps {
  user: UserProfile;
  friends: Friend[];
  onNavigate: (view: AppView) => void;
  onBetCreated: (bet: ActiveBet) => void;
  unreadNotifications?: number;
  onReportBet?: (betId: string, betText: string, opponentId: string) => void;
}

const STATIC_BACKGROUNDS: Record<string, string> = {
  bedroom: 'https://images.unsplash.com/photo-1555680202-c86f0e12f086?q=80&w=800&auto=format&fit=crop',
  gym: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=800&auto=format&fit=crop',
  club: 'https://images.unsplash.com/photo-1566737236500-c8ac43014a67?q=80&w=800&auto=format&fit=crop',
  street: 'https://images.unsplash.com/photo-1605218427306-635ba7467238?q=80&w=800&auto=format&fit=crop',
  office: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=800&auto=format&fit=crop',
  default: 'https://images.unsplash.com/photo-1515630278258-407f66498911?q=80&w=800&auto=format&fit=crop'
};

interface BetCard {
  id: string;
  dbBetId: string; // Database ID for the bet
  text: string;
  category: string;
  backgroundType: string;
  stake: number;
  friend: Friend;
  // Note: friendVote is intentionally NOT included here
  // The friend's vote comes from the database via swipeBet(), not simulated locally
}

const SwipeFeed: React.FC<SwipeFeedProps> = ({ user, friends, onNavigate, onBetCreated, unreadNotifications = 0, onReportBet }) => {
  const [cards, setCards] = useState<BetCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Sniffing out trouble...");

  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragDelta, setDragDelta] = useState(0);
  const [swipeResult, setSwipeResult] = useState<'left' | 'right' | null>(null);
  // Result states:
  // 'none' - no result yet (user hasn't swiped)
  // 'match' - clash created (user and friend have opposite swipes)
  // 'waiting' - user swiped but friend hasn't swiped yet
  // 'hairball' - both users swiped the same way (no clash)
  const [result, setResult] = useState<'none' | 'match' | 'waiting' | 'hairball'>('none');
  const [showTutorial, setShowTutorial] = useState(false);
  const [showEmptyState, setShowEmptyState] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Track clashes we've already handled locally to prevent duplicate notifications
  // This prevents showing a notification when we created the clash via our own swipe
  const processedClashesRef = useRef<Set<string>>(new Set());

  // Particle animation loop
  useEffect(() => {
    if (particles.length === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    let animationId: number;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      setParticles(prev => {
        const updated = prev.map(p => ({
          ...p,
          x: p.x + p.vx,
          y: p.y + p.vy,
          vy: p.vy + 0.2, // gravity
          life: p.life - 0.02
        })).filter(p => p.life > 0);

        // Draw particles
        updated.forEach(p => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
          ctx.fillStyle = p.color + Math.floor(p.life * 255).toString(16).padStart(2, '0');
          ctx.fill();

          // Add glow effect
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 10;
        });

        return updated;
      });

      if (particles.length > 0) {
        animationId = requestAnimationFrame(animate);
      }
    };

    animationId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationId);
  }, [particles.length]);

  // Loading messages rotation
  useEffect(() => {
    if (!loading) return;
    const messages = [
      "Sniffing out trouble...",
      "Digging through everyone's dirty laundry...",
      "Finding reasons to judge your friends...",
      "Calculating optimal chaos levels...",
      "Bad Bingo is scheming...",
    ];
    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % messages.length;
      setLoadingMessage(messages[idx]);
    }, 2000);
    return () => clearInterval(interval);
  }, [loading]);

  // Load bets from all friends
  useEffect(() => {
    const loadAllBets = async () => {
      const activeFriends = friends.filter(f => f.friendshipStatus === 'accepted');

      if (activeFriends.length === 0) {
        setLoading(false);
        setShowEmptyState(true);
        return;
      }

      setLoading(true);
      const allCards: BetCard[] = [];

      // Generate bets for each friend using the database-backed service
      for (const friend of activeFriends.slice(0, 3)) { // Limit to 3 friends for performance
        try {
          const { bets, error } = await generateBetsForFriend(
            user.id,
            friend.id,
            friend.name,
            friend.relationshipLevel as 1 | 2 | 3,
            user.riskProfile,
            user.coins
          );

          if (error) {
            console.error(`Failed to generate bets for ${friend.name}:`, error);
            continue;
          }

          // Map DB bets to BetCard format
          // CRITICAL FIX (Task 1.2): Removed Math.random() friend vote simulation
          // Friend's vote is determined via database when both users swipe
          // The swipeBet() function checks if both participants have swiped
          // and creates a clash only when they have opposite swipes
          const friendCards: BetCard[] = bets.map(bet => ({
            id: bet.id,
            dbBetId: bet.id,
            text: bet.text,
            category: bet.category || 'general',
            backgroundType: bet.background_type || 'default',
            stake: bet.base_stake,
            friend,
          }));
          allCards.push(...friendCards);
        } catch (err) {
          console.error(`Failed to generate bets for ${friend.name}:`, err);
        }
      }

      // Shuffle the cards
      const shuffled = allCards.sort(() => Math.random() - 0.5);
      setCards(shuffled);
      setLoading(false);

      // Show tutorial if first time
      const seen = localStorage.getItem('bingo_swipe_tutorial_seen');
      if (!seen && shuffled.length > 0) {
        setShowTutorial(true);
      }
    };

    loadAllBets();
  }, [friends, user]);

  // Realtime subscription for clash formation
  // This handles the case where the user swipes first, and the friend swipes later (creating a clash)
  // The subscription listens for new clashes where the current user is a participant
  useEffect(() => {
    if (!user?.id) return;

    const clashChannel = supabase
      .channel(`clashes:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bb_clashes',
        },
        async (payload) => {
          const clash = payload.new as DBClash;

          // Check if user is part of this clash
          if (clash.user1_id !== user.id && clash.user2_id !== user.id) {
            return; // Not our clash
          }

          // Check if we already processed this clash locally (via our own swipe)
          if (processedClashesRef.current.has(clash.id)) {
            return; // Already handled when we created it
          }

          // Mark as processed to prevent duplicate notifications
          processedClashesRef.current.add(clash.id);

          // Find the friend's info from the clash
          const opponentId = clash.user1_id === user.id ? clash.user2_id : clash.user1_id;
          const friend = friends.find(f => f.id === opponentId);

          // Get bet details for the scenario text
          let scenarioText = 'Unknown bet';
          try {
            const { bet } = await getBetById(clash.bet_id);
            if (bet) {
              scenarioText = bet.text;
            }
          } catch (err) {
            console.error('Failed to fetch bet details for clash:', err);
          }

          // Trigger match effects - friend just swiped and created a clash!
          triggerMatchEffect();

          // Create spark particles at center of screen
          const centerX = window.innerWidth / 2;
          const centerY = window.innerHeight / 2;
          const newParticles = createSparkParticles(centerX, centerY, 40, ['#CCFF00', '#FF0099', '#00FFFF', '#FF6600']);
          setParticles(newParticles);

          // Determine if user is the prover
          // The prover is whoever said "yes" to the bet
          const userSwipe = clash.user1_id === user.id ? clash.user1_swipe : clash.user2_swipe;
          const isProver = clash.prover_id === user.id;

          // Notify parent about the created clash
          onBetCreated({
            id: clash.id,
            betId: clash.bet_id,
            scenario: scenarioText,
            opponentId: opponentId,
            opponentName: friend?.name || 'Unknown',
            stake: clash.user1_id === user.id ? clash.user1_stake : clash.user2_stake,
            totalPot: clash.total_pot,
            status: clash.status,
            isProver: isProver,
            proofDeadline: clash.proof_deadline || undefined,
            createdAt: clash.created_at,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(clashChannel);
    };
  }, [user?.id, friends, onBetCreated]);

  const dismissTutorial = () => {
    setShowTutorial(false);
    localStorage.setItem('bingo_swipe_tutorial_seen', 'true');
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

  // Mouse events for desktop testing
  const handleMouseDown = (e: React.MouseEvent) => {
    if (result !== 'none') return;
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragStart || result !== 'none') return;
    const delta = e.clientX - dragStart.x;
    setDragDelta(delta);
  };

  const handleMouseUp = () => {
    if (!dragStart) return;
    if (Math.abs(dragDelta) > 100) {
      handleSwipe(dragDelta > 0 ? 'right' : 'left');
    } else {
      setDragDelta(0);
    }
    setDragStart(null);
  };

  const handleSwipe = useCallback(async (direction: 'left' | 'right') => {
    if (result !== 'none' || currentIndex >= cards.length) return;

    // Trigger swipe effect immediately
    triggerSwipeEffect(direction);

    setSwipeResult(direction);
    const currentCard = cards[currentIndex];
    const swipeVote = direction === 'right' ? 'yes' : 'no';

    // CRITICAL FIX (Task 1.2): Record swipe in database via swipeBet service
    // The swipeBet function:
    // 1. Records the user's swipe in bb_bet_participants
    // 2. Checks if the other participant has swiped
    // 3. Creates a clash in bb_clashes if opposite swipes detected
    // 4. Returns { clashCreated: true, clashId, matchType } if clash was created
    // matchType can be: 'clash' (opposite swipes), 'hairball' (same swipes), 'pending' (waiting)
    const { success, clashCreated, clashId, matchType, error } = await swipeBet(
      currentCard.dbBetId,
      user.id,
      swipeVote,
      currentCard.stake
    );

    if (error) {
      console.error('Failed to record swipe:', error);
    }

    setTimeout(() => {
      // Determine the result based on the swipeBet response matchType
      // 'clash': Both users swiped with opposite votes -> CLASH!
      // 'hairball': Both users swiped the same way -> boring agreement
      // 'pending': Friend hasn't swiped yet
      if (matchType === 'clash') {
        // Mark this clash as processed so the realtime subscription doesn't duplicate
        if (clashId) {
          processedClashesRef.current.add(clashId);
        }

        setResult('match');
        // Trigger match effects - sound, vibration
        triggerMatchEffect();

        // Create spark particles at center of screen
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        const newParticles = createSparkParticles(centerX, centerY, 40, ['#CCFF00', '#FF0099', '#00FFFF', '#FF6600']);
        setParticles(newParticles);

        // Notify parent about the created bet/clash
        onBetCreated({
          id: clashId || currentCard.dbBetId,
          betId: currentCard.dbBetId,
          scenario: currentCard.text,
          opponentId: currentCard.friend.id,
          opponentName: currentCard.friend.name,
          stake: currentCard.stake,
          totalPot: currentCard.stake * 2,
          status: 'pending_proof',
          isProver: swipeVote === 'yes',
          createdAt: new Date().toISOString(),
        });
      } else if (matchType === 'hairball') {
        // Both users swiped the same way - boring agreement, no clash
        setResult('hairball');
        triggerHaptic('medium');
      } else {
        // Pending - friend hasn't swiped yet
        // Show waiting state (swipe recorded, waiting for friend's response)
        setResult('waiting');
        triggerHaptic('light');
      }

      setTimeout(() => {
        if (currentIndex < cards.length - 1) {
          setCurrentIndex(prev => prev + 1);
          setSwipeResult(null);
          setDragDelta(0);
          setResult('none');
        } else {
          // No more cards - show refresh prompt
          setShowEmptyState(true);
        }
      }, 1500);
    }, 200);
  }, [result, currentIndex, cards, onBetCreated, user.id]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (loading || showTutorial || showEmptyState) return;
      if (e.key === 'ArrowLeft') handleSwipe('left');
      if (e.key === 'ArrowRight') handleSwipe('right');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSwipe, loading, showTutorial, showEmptyState]);

  // Loading state
  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-bingo-black text-acid-green">
        <i className="fas fa-cat fa-spin text-5xl mb-4"></i>
        <p className="animate-pulse tracking-widest uppercase text-sm">{loadingMessage}</p>
        <p className="text-gray-600 text-xs mt-2 italic">This better be worth my time.</p>
      </div>
    );
  }

  // Empty state - no friends or no more cards
  if (showEmptyState || cards.length === 0) {
    return (
      <div className="h-full flex flex-col bg-bingo-black">
        {/* Header */}
        <div className="p-4 flex justify-between items-center border-b border-gray-800">
          <div className="flex items-center gap-2">
            <span className="text-2xl">😼</span>
            <span className="text-acid-green font-bold uppercase tracking-widest text-sm">The Feed</span>
          </div>
          <button
            onClick={() => onNavigate(AppView.PROFILE)}
            className="w-10 h-10 rounded-full overflow-hidden border-2 border-gray-700"
          >
            <img src={user.avatarUrl} alt="Profile" className="w-full h-full object-cover" />
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <i className="fas fa-wind text-6xl text-gray-700 mb-6"></i>
          <h2 className="text-2xl font-bold text-white mb-2">
            {friends.filter(f => f.friendshipStatus === 'accepted').length === 0
              ? "No Pride. No Drama."
              : "All caught up, stray."}
          </h2>
          <p className="text-gray-500 mb-8">
            {friends.filter(f => f.friendshipStatus === 'accepted').length === 0
              ? "Recruit some victims first. Can't gamble alone... well, you could. But it's sadder."
              : "You've swiped through all the available chaos. Check back later for more ways to ruin friendships."}
          </p>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            {friends.filter(f => f.friendshipStatus === 'accepted').length === 0 ? (
              <button
                onClick={() => onNavigate(AppView.ADD_FRIEND)}
                className="bg-acid-green text-black font-bold py-4 px-6 rounded-lg uppercase tracking-widest"
              >
                <i className="fas fa-plus mr-2"></i> Recruit Victims
              </button>
            ) : (
              <button
                onClick={() => window.location.reload()}
                className="bg-acid-green text-black font-bold py-4 px-6 rounded-lg uppercase tracking-widest"
              >
                <i className="fas fa-sync mr-2"></i> Refresh Feed
              </button>
            )}
            <button
              onClick={() => onNavigate(AppView.DASHBOARD)}
              className="bg-gray-800 text-white font-bold py-4 px-6 rounded-lg uppercase tracking-widest"
            >
              View Your Pride
            </button>
          </div>
        </div>

        {/* Bottom Nav */}
        <BottomNav user={user} onNavigate={onNavigate} activeView={AppView.SWIPE_FEED} unreadNotifications={unreadNotifications} />
      </div>
    );
  }

  const currentCard = cards[currentIndex];
  const rotateDeg = dragDelta * 0.1;
  const opacityNope = Math.min(Math.max(dragDelta * -0.01, 0), 1);
  const opacityLike = Math.min(Math.max(dragDelta * 0.01, 0), 1);

  let cardStyle: React.CSSProperties = {
    transform: `translate(${dragDelta}px, 0px) rotate(${rotateDeg}deg)`,
    transition: dragStart ? 'none' : 'transform 0.3s ease-out',
  };

  if (swipeResult === 'left') {
    cardStyle = { transform: 'translate(-150%, 0px) rotate(-20deg)', transition: 'transform 0.4s ease-in' };
  } else if (swipeResult === 'right') {
    cardStyle = { transform: 'translate(150%, 0px) rotate(20deg)', transition: 'transform 0.4s ease-in' };
  }

  return (
    <div className="h-full flex flex-col relative overflow-hidden bg-black select-none">
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-all duration-500"
        style={{
          backgroundImage: `url(${STATIC_BACKGROUNDS[currentCard?.backgroundType] || STATIC_BACKGROUNDS.default})`,
          filter: 'brightness(0.25) contrast(1.2)',
        }}
      />

      {/* Header */}
      <div className="relative z-10 p-4 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-2">
          <span className="text-2xl">😼</span>
          <div>
            <span className="text-acid-green font-bold uppercase tracking-widest text-sm">The Arena</span>
            <div className="text-[10px] text-gray-400">
              {currentIndex + 1} / {cards.length} rounds
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-gray-400">Your Stash</div>
            <div className="text-acid-green font-bold">{user.coins} 😼</div>
          </div>
          <button
            onClick={() => onNavigate(AppView.PROFILE)}
            className="w-10 h-10 rounded-full overflow-hidden border-2 border-acid-green/50"
          >
            <img src={user.avatarUrl} alt="Profile" className="w-full h-full object-cover" />
          </button>
        </div>
      </div>

      {/* Swipe Card Area */}
      <div
        className="flex-1 relative z-20 flex flex-col items-center justify-center p-6"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* The Card */}
        <div
          className="bg-black/85 border-2 border-white/40 p-6 rounded-lg shadow-[0_0_50px_rgba(204,255,0,0.2)] backdrop-blur-md max-w-sm w-full relative"
          style={cardStyle}
        >
          {/* Swipe Indicators */}
          <div
            className="absolute top-4 right-4 border-4 border-alert-red text-alert-red font-black text-3xl p-2 rounded transform rotate-12"
            style={{ opacity: opacityNope }}
          >
            NAH
          </div>
          <div
            className="absolute top-4 left-4 border-4 border-acid-green text-acid-green font-black text-3xl p-2 rounded transform -rotate-12"
            style={{ opacity: opacityLike }}
          >
            BET!
          </div>

          {/* Report Button */}
          {onReportBet && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onReportBet(currentCard.dbBetId, currentCard.text, currentCard.friend.id);
              }}
              className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center text-gray-600 hover:text-alert-red transition-colors rounded-full hover:bg-white/10 z-10"
              title="Report this bet"
            >
              <i className="fas fa-flag text-xs"></i>
            </button>
          )}

          {/* Opponent Info */}
          <div className="flex items-center gap-3 mb-4 border-b border-gray-800 pb-3">
            <img
              src={currentCard.friend.avatarUrl}
              alt={currentCard.friend.name}
              className="w-12 h-12 rounded-full border-2 border-hot-pink"
            />
            <div>
              <div className="text-hot-pink font-bold text-sm">vs {currentCard.friend.name}</div>
              <div className="text-[10px] text-gray-500 uppercase">
                {currentCard.friend.relationshipLevel === 1 && '🔥 Chill'}
                {currentCard.friend.relationshipLevel === 2 && '🔥🔥 Spicy'}
                {currentCard.friend.relationshipLevel === 3 && '🔥🔥🔥 Savage'}
              </div>
            </div>
            <div className="ml-auto text-right">
              <div className="text-xs text-gray-400">{currentCard.category}</div>
              <div className="text-acid-green font-bold">{currentCard.stake} 😼</div>
            </div>
          </div>

          {/* The Bet Statement */}
          <h1 className="text-xl font-bold text-white leading-tight mb-4 italic">
            "{currentCard.text.replace(/^Bet\s+/i, '')}"
          </h1>

          {/* Progress */}
          <div className="h-1 w-full bg-gray-800 rounded mt-4">
            <div
              className="h-1 bg-acid-green rounded transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / cards.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Swipe Hints */}
        <div className="flex justify-between w-full max-w-sm mt-6 px-4">
          <button
            onClick={() => handleSwipe('left')}
            className="flex flex-col items-center text-alert-red opacity-60 hover:opacity-100 transition-opacity"
          >
            <i className="fas fa-times text-3xl mb-1"></i>
            <span className="text-[10px] uppercase">Nope</span>
          </button>
          <button
            onClick={() => handleSwipe('right')}
            className="flex flex-col items-center text-acid-green opacity-60 hover:opacity-100 transition-opacity"
          >
            <i className="fas fa-check text-3xl mb-1"></i>
            <span className="text-[10px] uppercase">Bet On It</span>
          </button>
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNav user={user} onNavigate={onNavigate} activeView={AppView.SWIPE_FEED} unreadNotifications={unreadNotifications} />

      {/* Tutorial Overlay */}
      {showTutorial && (
        <div
          className="absolute inset-0 z-50 bg-black/95 flex flex-col items-center justify-center animate-in fade-in duration-300 px-8 text-center"
          onClick={dismissTutorial}
        >
          <i className="fas fa-cat text-6xl text-acid-green mb-6 animate-bounce"></i>
          <h2 className="text-2xl font-bold text-white mb-4 tracking-tighter uppercase">Listen up, stray</h2>
          <div className="grid grid-cols-2 gap-8 mb-8 w-full max-w-sm">
            <div>
              <div className="text-alert-red font-black text-3xl">← LEFT</div>
              <div className="text-xs text-gray-500 uppercase mt-1">"Nah, won't happen"</div>
            </div>
            <div>
              <div className="text-acid-green font-black text-3xl">RIGHT →</div>
              <div className="text-xs text-gray-500 uppercase mt-1">"Yeah, I'd bet on it"</div>
            </div>
          </div>
          <p className="text-gray-400 text-sm mb-8 italic max-w-xs">
            "When you and your friend disagree... bingos get locked. Same answer? Boring. Move on."
          </p>
          <button
            onClick={dismissTutorial}
            className="bg-acid-green text-black font-black py-4 px-10 rounded-lg hover:scale-105 transition-transform uppercase tracking-widest text-sm"
          >
            Let's Get Messy
          </button>
        </div>
      )}

      {/* Particle Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-[60] pointer-events-none"
        style={{ width: '100%', height: '100%' }}
      />

      {/* Match Result Overlay */}
      {result === 'match' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/85 animate-in fade-in duration-200 pointer-events-none">
          <div className="text-center animate-bounce">
            <div className="text-6xl mb-4">⚔️</div>
            <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-hot-pink via-orange-500 to-acid-green italic animate-pulse drop-shadow-[0_0_30px_rgba(255,0,153,0.8)]">
              CLAWS OUT!
            </h1>
            <p className="text-white font-bold tracking-widest mt-3 uppercase text-xs">
              {currentCard.stake} bingos locked! Someone's eating dirt 😼
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <span className="text-2xl animate-ping">✨</span>
              <span className="text-2xl animate-ping delay-100">💥</span>
              <span className="text-2xl animate-ping delay-200">⚡</span>
            </div>
          </div>
        </div>
      )}

      {/* Waiting for Friend Result Overlay */}
      {result === 'waiting' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 animate-in fade-in duration-200 pointer-events-none">
          <div className="text-center px-8">
            <i className="fas fa-clock text-5xl text-cyan-glitch mb-4 animate-pulse"></i>
            <h1 className="text-2xl font-black text-white uppercase italic">Swipe Recorded</h1>
            <p className="text-gray-400 text-sm mt-2">
              Waiting for <span className="text-hot-pink font-bold">{cards[currentIndex]?.friend.name}</span> to swipe...
            </p>
            <p className="text-gray-600 text-xs mt-1">You'll get notified if they disagree!</p>
          </div>
        </div>
      )}

      {/* Hairball Result Overlay (both swiped same way - no clash) */}
      {result === 'hairball' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 animate-in fade-in duration-200 pointer-events-none">
          <div className="text-center">
            <i className="fas fa-wind text-5xl text-gray-600 mb-4"></i>
            <h1 className="text-3xl font-black text-gray-500 uppercase italic">*yawns*</h1>
            <p className="text-gray-600 text-xs">You both agree. How disappointingly civil.</p>
          </div>
        </div>
      )}
    </div>
  );
};

// Bottom Navigation Component
interface BottomNavProps {
  user: UserProfile;
  onNavigate: (view: AppView) => void;
  activeView: AppView;
  unreadNotifications?: number;
}

const BottomNav: React.FC<BottomNavProps> = ({ user, onNavigate, activeView, unreadNotifications = 0 }) => {
  return (
    <div className="relative z-30 bg-bingo-dark/95 border-t border-gray-800 py-2 px-4 backdrop-blur-sm">
      <div className="flex justify-around items-center">
        <NavButton
          icon="fas fa-fire"
          label="Arena"
          active={activeView === AppView.SWIPE_FEED}
          onClick={() => onNavigate(AppView.SWIPE_FEED)}
        />
        <NavButton
          icon="fas fa-users"
          label="Pride"
          active={activeView === AppView.DASHBOARD}
          onClick={() => onNavigate(AppView.DASHBOARD)}
        />
        <NavButton
          icon="fas fa-bell"
          label="Alerts"
          active={activeView === AppView.NOTIFICATIONS}
          onClick={() => onNavigate(AppView.NOTIFICATIONS)}
          badge={unreadNotifications > 0 ? String(unreadNotifications > 9 ? '9+' : unreadNotifications) : undefined}
        />
        <NavButton
          icon="fas fa-wallet"
          label="Stash"
          active={activeView === AppView.WALLET}
          onClick={() => onNavigate(AppView.WALLET)}
          badge={user.socialDebt > 0 ? '!' : undefined}
        />
        <NavButton
          icon="fas fa-cat"
          label="You"
          active={activeView === AppView.PROFILE}
          onClick={() => onNavigate(AppView.PROFILE)}
        />
      </div>
    </div>
  );
};

interface NavButtonProps {
  icon: string;
  label: string;
  active?: boolean;
  onClick: () => void;
  highlight?: boolean;
  badge?: string;
}

const NavButton: React.FC<NavButtonProps> = ({ icon, label, active, onClick, highlight, badge }) => {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center py-2 px-3 rounded-lg transition-all relative ${
        active
          ? 'text-acid-green'
          : highlight
          ? 'text-hot-pink'
          : 'text-gray-500 hover:text-gray-300'
      }`}
    >
      <i className={`${icon} text-xl mb-1`}></i>
      <span className="text-[10px] uppercase tracking-wider">{label}</span>
      {badge && (
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-alert-red rounded-full flex items-center justify-center text-[8px] text-white font-bold">
          {badge}
        </span>
      )}
    </button>
  );
};

export default SwipeFeed;
