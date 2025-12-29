import React, { useState, useEffect } from 'react';
import Onboarding from './components/Onboarding';
import Dashboard from './components/Dashboard';
import Clash from './components/Clash';
import StealMinigame from './components/StealMinigame';
import CameraProof from './components/CameraProof';
import AddFriend from './components/AddFriend';
import { AppView, UserProfile, Friend, ActiveBet, RelationshipLevel } from './types';

// Mock initial friends data with accepted status
const INITIAL_FRIENDS: Friend[] = [
  { id: 'f1', name: 'CyberMom', relationshipLevel: RelationshipLevel.CIVILIAN, status: 'offline', friendshipStatus: 'accepted', coins: 500, avatarUrl: 'https://picsum.photos/seed/mom/100' },
  { id: 'f2', name: 'GlitchBoy_99', relationshipLevel: RelationshipLevel.ROAST, status: 'online', friendshipStatus: 'accepted', coins: 50, avatarUrl: 'https://picsum.photos/seed/boy/100' },
  { id: 'f3', name: 'Ex_Machina', relationshipLevel: RelationshipLevel.NUCLEAR, status: 'offline', friendshipStatus: 'accepted', coins: 1200, avatarUrl: 'https://picsum.photos/seed/ex/100' },
];

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.ONBOARDING);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [friends, setFriends] = useState<Friend[]>(INITIAL_FRIENDS);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [stealTarget, setStealTarget] = useState<Friend | null>(null);
  const [activeBets, setActiveBets] = useState<ActiveBet[]>([]);
  const [currentBetForProof, setCurrentBetForProof] = useState<ActiveBet | null>(null);

  // Load persistence and simulate events
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
    } else {
        // DEMO: Simulate incoming request after 5s if no saved friends
        setTimeout(() => {
            const incomingRequest: Friend = {
                id: 'incoming-1',
                name: 'Anonymous_V',
                relationshipLevel: RelationshipLevel.ROAST,
                status: 'online',
                friendshipStatus: 'pending_received',
                coins: 666,
                avatarUrl: 'https://picsum.photos/seed/hacker/100'
            };
            setFriends(prev => {
                // Avoid dupes
                if (prev.find(f => f.id === incomingRequest.id)) return prev;
                const updated = [incomingRequest, ...prev];
                localStorage.setItem('bingo_friends', JSON.stringify(updated));
                return updated;
            });
        }, 5000);
    }
  }, []);

  const saveBets = (bets: ActiveBet[]) => {
      setActiveBets(bets);
      localStorage.setItem('bingo_bets', JSON.stringify(bets));
  };

  const saveFriends = (newFriends: Friend[]) => {
      setFriends(newFriends);
      localStorage.setItem('bingo_friends', JSON.stringify(newFriends));
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
    if (friend.status === 'online') {
        alert("LIVE PVP ROBBERY NOT IMPLEMENTED IN DEMO (Requires WebSockets). Try an offline friend.");
        return;
    }
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
      saveBets([...activeBets, bet]);
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
          saveBets(updatedBets);
      }
      setCurrentBetForProof(null);
      setView(AppView.DASHBOARD);
  };

  const handleAddFriend = (newFriend: Friend) => {
      const updated = [...friends, newFriend];
      saveFriends(updated);
      setView(AppView.DASHBOARD);

      // DEMO: Simulate the other user accepting the request after 8 seconds
      setTimeout(() => {
        setFriends(prev => {
           const mapped = prev.map(f => {
               if (f.id === newFriend.id && f.friendshipStatus === 'pending_sent') {
                   return { ...f, friendshipStatus: 'accepted' as const };
               }
               return f;
           });
           localStorage.setItem('bingo_friends', JSON.stringify(mapped));
           // Optional: Trigger a notification state here if we had one
           return mapped;
        });
      }, 8000);
  };

  const handleAcceptFriend = (friend: Friend) => {
      const updated = friends.map(f => f.id === friend.id ? { ...f, friendshipStatus: 'accepted' as const } : f);
      saveFriends(updated);
  };

  const handleRejectFriend = (friend: Friend) => {
      const updated = friends.filter(f => f.id !== friend.id);
      saveFriends(updated);
  };

  return (
    <div className="w-screen h-screen bg-bingo-black overflow-hidden font-sans select-none">
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
    </div>
  );
};

export default App;