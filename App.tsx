import React, { useState, useEffect } from 'react';
import Onboarding from './components/Onboarding';
import Dashboard from './components/Dashboard';
import Clash from './components/Clash';
import StealMinigame from './components/StealMinigame';
import CameraProof from './components/CameraProof';
import AddFriend from './components/AddFriend';
import Profile from './components/Profile';
import { AppView, UserProfile, Friend, ActiveBet, RelationshipLevel, InGameNotification } from './types';

// Mock initial friends data with accepted status
const INITIAL_FRIENDS: Friend[] = [
  { id: 'f1', name: 'CyberMom', relationshipLevel: RelationshipLevel.CIVILIAN, relationshipDescription: "She feeds you.", status: 'offline', friendshipStatus: 'accepted', coins: 500, avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=mom' },
  { id: 'f2', name: 'GlitchBoy_99', relationshipLevel: RelationshipLevel.ROAST, relationshipDescription: "Gaming buddy who owes you money.", status: 'online', friendshipStatus: 'accepted', coins: 50, avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=boy' },
];

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.ONBOARDING);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [friends, setFriends] = useState<Friend[]>(INITIAL_FRIENDS);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [stealTarget, setStealTarget] = useState<Friend | null>(null);
  const [activeBets, setActiveBets] = useState<ActiveBet[]>([]);
  const [currentBetForProof, setCurrentBetForProof] = useState<ActiveBet | null>(null);
  const [notifications, setNotifications] = useState<InGameNotification[]>([]);

  // 1. Initialization Effect - Runs ONLY ONCE on mount
  useEffect(() => {
    const saved = localStorage.getItem('bingo_user');
    if (saved) {
      setUser(JSON.parse(saved));
      setView(AppView.DASHBOARD);
    }
    
    const savedBets = localStorage.getItem('bingo_bets');
    if (savedBets) {
        setActiveBets(JSON.parse(savedBets));
    }

    const savedFriends = localStorage.getItem('bingo_friends');
    if (savedFriends) {
        setFriends(JSON.parse(savedFriends));
    }
  }, []);

  // 2. Game Loop Effect - Runs when user is active
  useEffect(() => {
    if (!user) return;
    
    // Simulate Game Loop / Notification System
    const interval = setInterval(() => {
        const roll = Math.random();
        // 10% chance every 10s to get a notification in this demo
        if (roll < 0.1) {
            addNotification({
                id: `notif-${Date.now()}`,
                type: 'clash',
                message: "⚔️ CLASH ALERT: GlitchBoy_99 challenged your claim!",
                priority: 'high',
                timestamp: Date.now()
            });
        }
    }, 10000);

    return () => clearInterval(interval);
  }, [user]);

  const addNotification = (n: InGameNotification) => {
      setNotifications(prev => [n, ...prev]);
      // Auto dismiss after 4s
      setTimeout(() => {
          setNotifications(prev => prev.filter(x => x.id !== n.id));
      }, 4000);
  };

  const handleOnboardingComplete = (profile: UserProfile) => {
    setUser(profile);
    localStorage.setItem('bingo_user', JSON.stringify(profile));
    setView(AppView.DASHBOARD);
  };

  const handleSelectFriend = (friend: Friend) => {
    setSelectedFriend(friend);
    setView(AppView.CLASH);
  };

  const handleSteal = (friend: Friend) => {
    // In demo, allow offline steal logic mostly
    setStealTarget(friend);
    setView(AppView.STEAL);
  };

  const handleStealResult = (amount: number) => {
      if (user) {
          const updatedUser = { ...user, coins: user.coins + amount };
          setUser(updatedUser);
          localStorage.setItem('bingo_user', JSON.stringify(updatedUser));
      }
      setStealTarget(null);
      setView(AppView.DASHBOARD);
  };

  const handleBetCreated = (bet: ActiveBet) => {
      const updated = [...activeBets, bet];
      setActiveBets(updated);
      localStorage.setItem('bingo_bets', JSON.stringify(updated));
      addNotification({
          id: `bet-${Date.now()}`,
          type: 'system',
          message: "💰 Bet Locked In. Good luck, stray.",
          priority: 'normal',
          timestamp: Date.now()
      });
  };

  const handleOpenProof = (bet: ActiveBet) => {
      setCurrentBetForProof(bet);
      setView(AppView.CAMERA);
  };

  const handleProofSent = (proofUrl: string) => {
      if (currentBetForProof) {
          const updatedBets = activeBets.map(b => 
            b.id === currentBetForProof.id ? { ...b, status: 'reviewing' as const, proofUrl } : b
          );
          setActiveBets(updatedBets);
          localStorage.setItem('bingo_bets', JSON.stringify(updatedBets));
      }
      setCurrentBetForProof(null);
      setView(AppView.DASHBOARD);
      addNotification({
          id: `proof-${Date.now()}`,
          type: 'proof',
          message: "📸 Evidence Submitted to the Council.",
          priority: 'normal',
          timestamp: Date.now()
      });
  };

  const handleAddFriend = (newFriend: Friend) => {
      const updated = [...friends, newFriend];
      setFriends(updated);
      localStorage.setItem('bingo_friends', JSON.stringify(updated));
      setView(AppView.DASHBOARD);
      
      addNotification({
          id: `friend-${Date.now()}`,
          type: 'system',
          message: `📡 Invite Sent to ${newFriend.name}`,
          priority: 'normal',
          timestamp: Date.now()
      });
  };

  const handleAcceptFriend = (friend: Friend) => {
      const updated = friends.map(f => f.id === friend.id ? { ...f, friendshipStatus: 'accepted' as const } : f);
      setFriends(updated);
  };

  const handleRejectFriend = (friend: Friend) => {
      const updated = friends.filter(f => f.id !== friend.id);
      setFriends(updated);
  };

  return (
    <div className="w-screen h-screen bg-bingo-black overflow-hidden font-sans select-none relative">
      
      {/* Notification Toast Layer */}
      <div className="absolute top-0 left-0 right-0 z-[100] p-4 pointer-events-none flex flex-col items-center gap-2">
          {notifications.map(n => (
              <div key={n.id} className={`animate-in slide-in-from-top duration-300 w-full max-w-sm p-4 rounded-lg shadow-[0_0_20px_rgba(0,0,0,0.5)] border-l-4 pointer-events-auto flex items-center gap-3 backdrop-blur-md ${
                  n.priority === 'critical' ? 'bg-red-900/90 border-alert-red text-white' : 
                  n.priority === 'high' ? 'bg-gray-900/90 border-hot-pink text-white' : 
                  'bg-gray-900/90 border-acid-green text-gray-200'
              }`}>
                  <div className={`text-2xl ${n.priority === 'critical' ? 'animate-pulse' : ''}`}>
                      {n.type === 'clash' && '⚔️'}
                      {n.type === 'robbery' && '🚨'}
                      {n.type === 'proof' && '📸'}
                      {n.type === 'system' && '🤖'}
                  </div>
                  <div className="flex-1 text-sm font-bold font-mono leading-tight">
                      {n.message}
                  </div>
              </div>
          ))}
      </div>

      {view === AppView.ONBOARDING && (
        <Onboarding onComplete={handleOnboardingComplete} />
      )}

      {view === AppView.DASHBOARD && user && (
        <Dashboard 
          user={user}
          activeBets={activeBets}
          friends={friends}
          onNavigate={setView}
          onSelectFriend={handleSelectFriend}
          onSteal={handleSteal}
          onOpenProof={handleOpenProof}
          onAddFriend={() => setView(AppView.ADD_FRIEND)}
          onAcceptFriend={handleAcceptFriend}
          onRejectFriend={handleRejectFriend}
        />
      )}

      {view === AppView.ADD_FRIEND && (
          <AddFriend 
            onClose={() => setView(AppView.DASHBOARD)}
            onAdd={handleAddFriend}
          />
      )}

      {view === AppView.CLASH && selectedFriend && user && (
        <Clash 
          friend={selectedFriend}
          user={user}
          onClose={() => setView(AppView.DASHBOARD)}
          onBetCreated={handleBetCreated}
        />
      )}

      {view === AppView.CAMERA && currentBetForProof && (
          <CameraProof 
            bet={currentBetForProof}
            onClose={() => setView(AppView.DASHBOARD)}
            onSend={handleProofSent}
          />
      )}

      {view === AppView.STEAL && stealTarget && (
        <StealMinigame 
            target={stealTarget}
            onClose={() => setView(AppView.DASHBOARD)}
            onSuccess={handleStealResult}
            onFail={() => setView(AppView.DASHBOARD)}
        />
      )}

      {view === AppView.PROFILE && user && (
        <Profile 
            user={user}
            onBack={() => setView(AppView.DASHBOARD)}
        />
      )}
    </div>
  );
};

export default App;