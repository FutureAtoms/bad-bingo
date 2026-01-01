import React, { useState, useEffect } from 'react';
import { Friend, UserProfile, ActiveBet } from '../types';
import { playSound, triggerHaptic } from '../services/effects';
import {
  createBetForFriend,
  createBetForGroup,
  createBetForAllFriends,
  MultiplayerBetConfig,
} from '../services/multiplayerBets';
// Content moderation disabled - all bets allowed

interface ChallengeFriendProps {
  user: UserProfile;
  friend?: Friend; // Single friend if pre-selected
  friends?: Friend[]; // All friends for selection
  onClose: () => void;
  onChallenge: (bet: ActiveBet) => void;
}

export interface ChallengeData {
  id: string;
  challengerId: string;
  challengerName: string;
  targetId: string;
  targetName: string;
  betText: string;
  stake: number;
  expiresAt: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'same_vote';
  challengerVote: boolean; // true = yes it will happen
  targetVote?: boolean;
  createdAt: string;
}

type TargetMode = 'single' | 'group' | 'all';

type Step = 'select_mode' | 'select_friend' | 'write_bet' | 'set_stake' | 'confirm';

const ChallengeFriend: React.FC<ChallengeFriendProps> = ({ user, friend, friends = [], onClose, onChallenge }) => {
  // Determine initial step based on whether friend is pre-selected
  const [step, setStep] = useState<Step>(friend ? 'write_bet' : 'select_mode');
  const [targetMode, setTargetMode] = useState<TargetMode>(friend ? 'single' : 'single');
  const [selectedFriends, setSelectedFriends] = useState<Friend[]>(friend ? [friend] : []);
  const [betText, setBetText] = useState('');
  const [stake, setStake] = useState(Math.max(2, Math.floor(user.coins / 50)));
  const [expiryHours, setExpiryHours] = useState(4);
  const [myVote, setMyVote] = useState<boolean | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeFriends = friends.filter(f => f.friendshipStatus === 'accepted');
  const minStake = Math.max(2, Math.floor(user.coins / 50));
  const maxStake = user.coins;

  // Helper to get first selected friend (for display)
  const selectedFriend = selectedFriends[0] || null;

  const handleSelectMode = (mode: TargetMode) => {
    setTargetMode(mode);
    triggerHaptic('light');
    if (mode === 'all') {
      setSelectedFriends(activeFriends);
      setStep('write_bet');
    } else {
      setStep('select_friend');
    }
  };

  const handleSelectFriend = (friendToSelect: Friend) => {
    if (targetMode === 'single') {
      setSelectedFriends([friendToSelect]);
      triggerHaptic('light');
      setStep('write_bet');
    } else {
      // Group mode - toggle selection
      const isSelected = selectedFriends.some(f => f.id === friendToSelect.id);
      if (isSelected) {
        setSelectedFriends(selectedFriends.filter(f => f.id !== friendToSelect.id));
      } else {
        setSelectedFriends([...selectedFriends, friendToSelect]);
      }
      triggerHaptic('light');
    }
  };

  const handleGroupSelectionDone = () => {
    if (selectedFriends.length === 0) return;
    triggerHaptic('medium');
    setStep('write_bet');
  };

  const handleBetSubmit = async () => {
    if (!betText.trim() || betText.length < 10) return;

    // Content moderation disabled - all bets allowed
    triggerHaptic('medium');
    setStep('set_stake');
  };

  const handleStakeConfirm = () => {
    if (myVote === null) return;
    triggerHaptic('medium');
    setStep('confirm');
  };

  const handleSendChallenge = async () => {
    if (selectedFriends.length === 0 || !betText || myVote === null) return;

    setSending(true);
    setError(null);
    triggerHaptic('heavy');
    playSound('challenge');

    try {
      const betConfig: MultiplayerBetConfig = {
        text: betText,
        stakeAmount: stake,
        expiresInHours: expiryHours,
        proofType: 'photo',
        backgroundType: 'default',
      };

      let result;

      if (targetMode === 'all') {
        result = await createBetForAllFriends(user.id, betConfig);
      } else if (targetMode === 'group' || selectedFriends.length > 1) {
        result = await createBetForGroup(
          user.id,
          selectedFriends.map(f => f.id),
          betConfig
        );
      } else {
        result = await createBetForFriend(user.id, selectedFriends[0].id, betConfig);
      }

      if (result.error) {
        setError(result.error);
        setSending(false);
        return;
      }

      if (result.bet) {
        // Convert to ActiveBet format
        const activeBet: ActiveBet = {
          id: result.bet.id,
          betId: result.bet.id,
          scenario: betText,
          opponentId: selectedFriends[0].id,
          opponentName: selectedFriends.length === 1
            ? selectedFriends[0].name
            : `${selectedFriends.length} friends`,
          stake: stake,
          totalPot: stake * (selectedFriends.length + 1),
          status: 'pending_proof',
          isProver: myVote === true,
          createdAt: new Date().toISOString(),
        };

        onChallenge(activeBet);
      }
    } catch (err) {
      setError((err as Error).message);
      setSending(false);
    }
  };

  const betSuggestions = selectedFriend ? [
    `${selectedFriend.name} is lying about something right now`,
    `${selectedFriend.name} will cancel plans this week`,
    `${selectedFriend.name} hasn't showered today`,
    `${selectedFriend.name} is wearing something embarrassing`,
    `${selectedFriend.name} will be late to their next thing`,
    `${selectedFriend.name} has food in their fridge that's expired`,
  ] : [];

  const handleBack = () => {
    if (step === 'select_mode' || (friend && step === 'write_bet')) {
      onClose();
    } else if (step === 'select_friend') {
      setStep('select_mode');
    } else if (step === 'write_bet') {
      if (targetMode === 'all') {
        setStep('select_mode');
      } else {
        setStep('select_friend');
      }
    } else if (step === 'set_stake') {
      setStep('write_bet');
    } else if (step === 'confirm') {
      setStep('set_stake');
    }
  };

  const getStepIndex = () => {
    const steps = friend
      ? ['write_bet', 'set_stake', 'confirm']
      : ['select_mode', 'select_friend', 'write_bet', 'set_stake', 'confirm'];
    return steps.indexOf(step);
  };

  const totalSteps = friend ? 3 : 5;

  return (
    <div className="h-full bg-bingo-black flex flex-col">
      {/* Header */}
      <div className="pt-[env(safe-area-inset-top)] bg-black/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="p-4 flex items-center gap-3 border-b border-gray-800">
          <button
            onClick={handleBack}
            className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-white active:text-acid-green transition-colors -ml-2 rounded-full active:bg-white/10"
          >
            <i className={`fas ${(step === 'select_mode' || (friend && step === 'write_bet')) ? 'fa-times' : 'fa-arrow-left'} text-2xl`}></i>
          </button>
          <div className="flex-1">
            <h1 className="text-hot-pink font-bold uppercase tracking-widest">
              {targetMode === 'all' ? 'Challenge Everyone' : targetMode === 'group' ? 'Group Challenge' : 'Challenge'}
            </h1>
            <p className="text-xs text-gray-500">
              {step === 'select_mode' && 'Choose challenge type'}
              {step === 'select_friend' && (targetMode === 'group' ? 'Select your victims' : 'Pick your victim')}
              {step === 'write_bet' && 'Write your bet'}
              {step === 'set_stake' && 'Set the stakes'}
              {step === 'confirm' && 'Ready to send'}
            </p>
          </div>
          {/* Progress dots */}
          <div className="flex gap-1">
            {Array.from({ length: totalSteps }, (_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full ${
                  getStepIndex() >= i ? 'bg-hot-pink' : 'bg-gray-700'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-alert-red/20 border border-alert-red p-3 mx-4 mt-4 rounded-lg flex items-center gap-2">
          <i className="fas fa-exclamation-circle text-alert-red"></i>
          <span className="text-sm text-white">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-gray-400">
            <i className="fas fa-times"></i>
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">

        {/* Step 0: Select Mode */}
        {step === 'select_mode' && (
          <div className="space-y-4">
            <p className="text-gray-400 text-sm mb-6">How do you want to challenge?</p>

            {/* Single Friend */}
            <button
              onClick={() => handleSelectMode('single')}
              className="w-full bg-bingo-dark p-5 rounded-lg border border-gray-800 hover:border-hot-pink active:scale-[0.98] transition-all flex items-center gap-4"
            >
              <div className="w-14 h-14 bg-gradient-to-br from-hot-pink to-purple-600 rounded-full flex items-center justify-center">
                <i className="fas fa-user text-white text-xl"></i>
              </div>
              <div className="flex-1 text-left">
                <div className="text-white font-bold">1v1 Challenge</div>
                <div className="text-xs text-gray-500">Call out a single friend</div>
              </div>
              <i className="fas fa-chevron-right text-gray-600"></i>
            </button>

            {/* Group */}
            <button
              onClick={() => handleSelectMode('group')}
              disabled={activeFriends.length < 2}
              className={`w-full bg-bingo-dark p-5 rounded-lg border border-gray-800 hover:border-cyan-glitch active:scale-[0.98] transition-all flex items-center gap-4 ${
                activeFriends.length < 2 ? 'opacity-50' : ''
              }`}
            >
              <div className="w-14 h-14 bg-gradient-to-br from-cyan-glitch to-blue-600 rounded-full flex items-center justify-center">
                <i className="fas fa-users text-white text-xl"></i>
              </div>
              <div className="flex-1 text-left">
                <div className="text-white font-bold">Group Challenge</div>
                <div className="text-xs text-gray-500">
                  {activeFriends.length < 2
                    ? 'Need at least 2 friends'
                    : 'Pick multiple victims'}
                </div>
              </div>
              <i className="fas fa-chevron-right text-gray-600"></i>
            </button>

            {/* All Friends */}
            <button
              onClick={() => handleSelectMode('all')}
              disabled={activeFriends.length === 0}
              className={`w-full bg-bingo-dark p-5 rounded-lg border border-gray-800 hover:border-acid-green active:scale-[0.98] transition-all flex items-center gap-4 ${
                activeFriends.length === 0 ? 'opacity-50' : ''
              }`}
            >
              <div className="w-14 h-14 bg-gradient-to-br from-acid-green to-yellow-500 rounded-full flex items-center justify-center">
                <i className="fas fa-globe text-black text-xl"></i>
              </div>
              <div className="flex-1 text-left">
                <div className="text-white font-bold">Challenge Everyone</div>
                <div className="text-xs text-gray-500">
                  {activeFriends.length === 0
                    ? 'Add some friends first'
                    : `Call out all ${activeFriends.length} friends at once`}
                </div>
              </div>
              <i className="fas fa-chevron-right text-gray-600"></i>
            </button>

            {activeFriends.length === 0 && (
              <div className="text-center py-8">
                <i className="fas fa-user-friends text-4xl text-gray-700 mb-4"></i>
                <p className="text-gray-500 text-sm">You need friends to challenge!</p>
              </div>
            )}
          </div>
        )}

        {/* Step 1: Select Friend(s) */}
        {step === 'select_friend' && (
          <div className="space-y-3">
            <p className="text-gray-400 text-sm mb-4">
              {targetMode === 'group'
                ? `Select your victims (${selectedFriends.length} selected)`
                : 'Who deserves to be called out?'}
            </p>
            {activeFriends.length === 0 ? (
              <div className="text-center py-12">
                <i className="fas fa-user-slash text-4xl text-gray-700 mb-4"></i>
                <p className="text-gray-500">No friends to challenge. Recruit some first.</p>
              </div>
            ) : (
              <>
                {activeFriends.map(f => {
                  const isSelected = selectedFriends.some(sf => sf.id === f.id);
                  return (
                    <button
                      key={f.id}
                      onClick={() => handleSelectFriend(f)}
                      className={`w-full bg-bingo-dark p-4 rounded-lg border transition-all flex items-center gap-4 ${
                        isSelected
                          ? 'border-acid-green bg-acid-green/10'
                          : 'border-gray-800 hover:border-hot-pink'
                      } active:scale-[0.98]`}
                    >
                      {targetMode === 'group' && (
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                          isSelected ? 'bg-acid-green border-acid-green' : 'border-gray-600'
                        }`}>
                          {isSelected && <i className="fas fa-check text-black text-xs"></i>}
                        </div>
                      )}
                      <img src={f.avatarUrl} alt={f.name} className={`w-14 h-14 rounded-full border-2 ${
                        isSelected ? 'border-acid-green' : 'border-gray-700'
                      }`} />
                      <div className="flex-1 text-left">
                        <div className="text-white font-bold">{f.name}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-2">
                          {f.relationshipLevel === 1 && <span className="text-cyan-400">🔥 Chill</span>}
                          {f.relationshipLevel === 2 && <span className="text-orange-400">🔥🔥 Spicy</span>}
                          {f.relationshipLevel === 3 && <span className="text-alert-red">🔥🔥🔥 Savage</span>}
                        </div>
                      </div>
                      {targetMode === 'single' && <i className="fas fa-chevron-right text-gray-600"></i>}
                    </button>
                  );
                })}

                {/* Group selection confirmation button */}
                {targetMode === 'group' && (
                  <button
                    onClick={handleGroupSelectionDone}
                    disabled={selectedFriends.length === 0}
                    className={`w-full py-4 rounded-lg font-bold uppercase tracking-widest mt-4 ${
                      selectedFriends.length > 0
                        ? 'bg-hot-pink text-white'
                        : 'bg-gray-800 text-gray-600'
                    }`}
                  >
                    Continue with {selectedFriends.length} Friend{selectedFriends.length !== 1 ? 's' : ''}
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Step 2: Write Bet */}
        {step === 'write_bet' && selectedFriends.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              {/* Show avatars based on number of friends */}
              {selectedFriends.length === 1 ? (
                <img src={selectedFriends[0].avatarUrl} className="w-12 h-12 rounded-full border-2 border-hot-pink" />
              ) : (
                <div className="flex -space-x-3">
                  {selectedFriends.slice(0, 3).map((f, i) => (
                    <img
                      key={f.id}
                      src={f.avatarUrl}
                      className="w-10 h-10 rounded-full border-2 border-bingo-dark"
                      style={{ zIndex: 3 - i }}
                    />
                  ))}
                  {selectedFriends.length > 3 && (
                    <div className="w-10 h-10 rounded-full bg-gray-800 border-2 border-bingo-dark flex items-center justify-center text-xs text-white font-bold">
                      +{selectedFriends.length - 3}
                    </div>
                  )}
                </div>
              )}
              <div>
                <div className="text-white font-bold">
                  {selectedFriends.length === 1
                    ? `vs ${selectedFriends[0].name}`
                    : targetMode === 'all'
                      ? `vs All ${selectedFriends.length} Friends`
                      : `vs ${selectedFriends.length} Friends`}
                </div>
                <div className="text-xs text-gray-500">Write something they have to prove or disprove</div>
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 uppercase tracking-widest mb-2 block">Your Bet</label>
              <textarea
                value={betText}
                onChange={(e) => setBetText(e.target.value)}
                placeholder={`${selectedFriend.name} is...`}
                className="w-full bg-black border border-gray-700 rounded-lg p-4 text-white placeholder-gray-600 focus:border-hot-pink focus:outline-none min-h-[120px] resize-none"
                maxLength={150}
              />
              <div className="text-right text-xs text-gray-600 mt-1">{betText.length}/150</div>
            </div>

            {/* Suggestions */}
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-widest mb-2 block">Quick Ideas</label>
              <div className="flex flex-wrap gap-2">
                {betSuggestions.slice(0, 4).map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => setBetText(suggestion)}
                    className="text-xs bg-gray-800 text-gray-300 px-3 py-2 rounded-full hover:bg-gray-700 active:scale-95"
                  >
                    {suggestion.substring(0, 40)}...
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleBetSubmit}
              disabled={betText.length < 10}
              className={`w-full py-4 rounded-lg font-bold uppercase tracking-widest ${
                betText.length >= 10
                  ? 'bg-hot-pink text-white'
                  : 'bg-gray-800 text-gray-600'
              }`}
            >
              Next: Set Stakes
            </button>
          </div>
        )}

        {/* Step 3: Set Stake */}
        {step === 'set_stake' && selectedFriends.length > 0 && (
          <div className="space-y-6">
            <div className="bg-gray-900 p-4 rounded-lg border border-gray-800 mb-6">
              <div className="text-xs text-gray-500 uppercase mb-1">Your Challenge</div>
              <div className="text-white font-bold">"{betText}"</div>
            </div>

            {/* Stake */}
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-widest mb-2 block">Stake Amount</label>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setStake(Math.max(minStake, stake - 5))}
                  className="w-12 h-12 bg-gray-800 rounded-lg text-white text-xl"
                >
                  -
                </button>
                <div className="flex-1 text-center">
                  <div className="text-4xl font-black text-acid-green">{stake}</div>
                  <div className="text-xs text-gray-500">bingos each</div>
                </div>
                <button
                  onClick={() => setStake(Math.min(maxStake, stake + 5))}
                  className="w-12 h-12 bg-gray-800 rounded-lg text-white text-xl"
                >
                  +
                </button>
              </div>
              <input
                type="range"
                min={minStake}
                max={maxStake}
                value={stake}
                onChange={(e) => setStake(Number(e.target.value))}
                className="w-full mt-4 accent-acid-green"
              />
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>{minStake} min</span>
                <span>{maxStake} max</span>
              </div>
            </div>

            {/* Expiry */}
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-widest mb-2 block">Response Deadline</label>
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 4, 12].map(hours => (
                  <button
                    key={hours}
                    onClick={() => setExpiryHours(hours)}
                    className={`py-3 rounded-lg font-bold ${
                      expiryHours === hours
                        ? 'bg-hot-pink text-white'
                        : 'bg-gray-800 text-gray-400'
                    }`}
                  >
                    {hours}h
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-600 mt-2 text-center">
                If they don't respond in {expiryHours} hours, they auto-lose.
              </p>
            </div>

            {/* Your Vote */}
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-widest mb-2 block">Your Vote</label>
              <p className="text-xs text-gray-400 mb-3">Do you think this will happen?</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setMyVote(true)}
                  className={`py-4 rounded-lg font-bold flex items-center justify-center gap-2 ${
                    myVote === true
                      ? 'bg-acid-green text-black'
                      : 'bg-gray-800 text-gray-400 border border-gray-700'
                  }`}
                >
                  <i className="fas fa-check"></i> YES
                </button>
                <button
                  onClick={() => setMyVote(false)}
                  className={`py-4 rounded-lg font-bold flex items-center justify-center gap-2 ${
                    myVote === false
                      ? 'bg-alert-red text-white'
                      : 'bg-gray-800 text-gray-400 border border-gray-700'
                  }`}
                >
                  <i className="fas fa-times"></i> NO
                </button>
              </div>
            </div>

            <button
              onClick={handleStakeConfirm}
              disabled={myVote === null}
              className={`w-full py-4 rounded-lg font-bold uppercase tracking-widest ${
                myVote !== null
                  ? 'bg-hot-pink text-white'
                  : 'bg-gray-800 text-gray-600'
              }`}
            >
              Review Challenge
            </button>
          </div>
        )}

        {/* Step 4: Confirm */}
        {step === 'confirm' && selectedFriends.length > 0 && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <i className="fas fa-bolt text-5xl text-hot-pink mb-4 animate-pulse"></i>
              <h2 className="text-2xl font-black text-white">
                {selectedFriends.length === 1 ? 'Ready to Throw Down?' : 'Ready to Challenge Everyone?'}
              </h2>
            </div>

            <div className="bg-gray-900 p-6 rounded-lg border border-hot-pink/30 space-y-4">
              <div className="flex items-center gap-4">
                <img src={user.avatarUrl} className="w-10 h-10 rounded-full" />
                <div className="text-xs text-gray-500">VS</div>
                {selectedFriends.length === 1 ? (
                  <img src={selectedFriends[0].avatarUrl} className="w-10 h-10 rounded-full" />
                ) : (
                  <div className="flex -space-x-2">
                    {selectedFriends.slice(0, 3).map((f, i) => (
                      <img
                        key={f.id}
                        src={f.avatarUrl}
                        className="w-10 h-10 rounded-full border-2 border-gray-900"
                        style={{ zIndex: 3 - i }}
                      />
                    ))}
                    {selectedFriends.length > 3 && (
                      <div className="w-10 h-10 rounded-full bg-gray-800 border-2 border-gray-900 flex items-center justify-center text-xs text-white font-bold">
                        +{selectedFriends.length - 3}
                      </div>
                    )}
                  </div>
                )}
                <div className="flex-1 text-right">
                  <div className="text-acid-green font-bold">
                    {stake} x {selectedFriends.length + 1}
                  </div>
                  <div className="text-xs text-gray-500">
                    {stake * (selectedFriends.length + 1)} total pot
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-800 pt-4">
                <div className="text-xs text-gray-500 uppercase mb-1">The Bet</div>
                <div className="text-white font-bold">"{betText}"</div>
              </div>

              {selectedFriends.length > 1 && (
                <div className="border-t border-gray-800 pt-4">
                  <div className="text-xs text-gray-500 uppercase mb-2">Challenging</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedFriends.map(f => (
                      <span key={f.id} className="text-xs bg-gray-800 text-white px-2 py-1 rounded-full">
                        {f.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 border-t border-gray-800 pt-4">
                <div>
                  <div className="text-xs text-gray-500">Your Vote</div>
                  <div className={`font-bold ${myVote ? 'text-acid-green' : 'text-alert-red'}`}>
                    {myVote ? 'YES' : 'NO'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Expires In</div>
                  <div className="text-white font-bold">{expiryHours} hours</div>
                </div>
              </div>
            </div>

            <div className="bg-black/50 p-4 rounded-lg border border-gray-800">
              <div className="flex items-start gap-3">
                <i className="fas fa-info-circle text-cyan-glitch mt-0.5"></i>
                <div className="text-xs text-gray-400">
                  {selectedFriends.length === 1 ? (
                    <>
                      <p><span className="text-white">Same vote?</span> Bet is nullified. No one wins.</p>
                      <p className="mt-1"><span className="text-white">No response?</span> {selectedFriends[0].name} auto-loses after {expiryHours}h.</p>
                      <p className="mt-1"><span className="text-white">Different votes?</span> It's a clash! Prove who's right.</p>
                    </>
                  ) : (
                    <>
                      <p><span className="text-white">Notifications sent!</span> All {selectedFriends.length} friends will be notified instantly.</p>
                      <p className="mt-1"><span className="text-white">No response?</span> Non-responders auto-lose after {expiryHours}h.</p>
                      <p className="mt-1"><span className="text-white">Different votes?</span> Clashes with each opposing voter!</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={handleSendChallenge}
              disabled={sending}
              className="w-full py-4 bg-gradient-to-r from-hot-pink to-orange-500 text-white font-black rounded-lg uppercase tracking-widest text-lg shadow-[0_0_30px_rgba(255,0,153,0.4)] active:scale-[0.98] transition-transform disabled:opacity-50"
            >
              {sending ? (
                <span className="flex items-center justify-center gap-2">
                  <i className="fas fa-spinner fa-spin"></i> Sending...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <i className="fas fa-bolt"></i> SEND CHALLENGE
                </span>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChallengeFriend;
