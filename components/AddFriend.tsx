import React, { useState, useEffect, useCallback } from 'react';
import { Friend, RelationshipLevel, UserProfile } from '../types';
import { generateFriendshipProfile } from '../services/geminiService';
import {
  searchUsers,
  sendFriendRequest,
  proposeHeatLevel,
  getFriendship,
  acceptHeatLevel,
  rejectHeatLevel,
  getPendingHeatProposals,
  getHeatChangeCooldownHours,
  HeatProposal,
} from '../services/friends';
import type { DBUser, DBFriendship } from '../types/database';

interface AddFriendProps {
  user: UserProfile;
  onClose: () => void;
  onAdd: (friend: Friend) => void;
  // Optional: existing friend to manage heat level for
  existingFriend?: Friend;
  existingFriendship?: DBFriendship;
}

// "Know Your Friend" Survey Stages
enum AddStage {
  SEARCH = 'SEARCH',
  SURVEY = 'SURVEY',
  ANALYZING = 'ANALYZING',
  RESULT = 'RESULT',
  HEAT_PENDING = 'HEAT_PENDING',
  HEAT_PROPOSALS = 'HEAT_PROPOSALS', // View and manage incoming proposals
  MANAGE_HEAT = 'MANAGE_HEAT', // Manage heat for existing friend
}

// Heat level labels with descriptions
const HEAT_LEVELS = [
  {
    level: RelationshipLevel.CIVILIAN,
    numericLevel: 1,
    icon: 'fa-snowflake',
    label: 'CHILL',
    sublabel: 'Safe bets only. Keep it light.',
    color: 'text-cyan-400',
    borderColor: 'border-cyan-400',
    bgColor: 'bg-cyan-400/10',
  },
  {
    level: RelationshipLevel.ROAST,
    numericLevel: 2,
    icon: 'fa-fire-alt',
    label: 'SPICY',
    sublabel: 'Embarrassing bets unlocked.',
    color: 'text-orange-400',
    borderColor: 'border-orange-400',
    bgColor: 'bg-orange-400/10',
  },
  {
    level: RelationshipLevel.NUCLEAR,
    numericLevel: 3,
    icon: 'fa-radiation',
    label: 'SAVAGE',
    sublabel: 'Location & secret bets. No limits.',
    color: 'text-alert-red',
    borderColor: 'border-alert-red',
    bgColor: 'bg-alert-red/10',
  },
];

const AddFriend: React.FC<AddFriendProps> = ({
  user,
  onClose,
  onAdd,
  existingFriend,
  existingFriendship,
}) => {
  // Determine initial stage based on whether we're managing existing friend
  const getInitialStage = () => {
    if (existingFriend && existingFriendship) {
      return AddStage.MANAGE_HEAT;
    }
    return AddStage.SEARCH;
  };

  const [stage, setStage] = useState<AddStage>(getInitialStage());
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DBUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<DBUser | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Survey State
  const [surveyIndex, setSurveyIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);

  // Result State
  const [generatedProfile, setGeneratedProfile] = useState<{level: RelationshipLevel, description: string} | null>(null);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [selectedHeatLevel, setSelectedHeatLevel] = useState<RelationshipLevel | null>(null);

  // Heat Consent State
  const [pendingProposals, setPendingProposals] = useState<HeatProposal[]>([]);
  const [loadingProposals, setLoadingProposals] = useState(false);
  const [processingProposal, setProcessingProposal] = useState<string | null>(null);
  const [heatCooldownRemaining, setHeatCooldownRemaining] = useState<number | null>(null);
  const [proposalSuccess, setProposalSuccess] = useState<string | null>(null);
  const [proposalError, setProposalError] = useState<string | null>(null);

  // Manage heat state for existing friends
  const [managingFriendship, setManagingFriendship] = useState<DBFriendship | null>(existingFriendship || null);
  const [proposingLevel, setProposingLevel] = useState<number | null>(null);

  const SURVEY_QUESTIONS = [
    {
      q: "What's your deal with this stray?",
      options: ["They sign my paychecks", "We're unhinged together", "It's... romantic (yikes)", "Just some NPC in my life"]
    },
    {
      q: "Their most insufferable trait?",
      options: ["Pathologically late", "Lies like they breathe", "Perpetually broke", "Overshares EVERYTHING"]
    },
    {
      q: "How much dirt do you have on each other?",
      options: ["Nothing juicy", "Mildly embarrassing stuff", "Career-ending secrets"]
    },
    {
      q: "They trip and fall in public. You...",
      options: ["Rush to help (boring)", "Laugh THEN help", "Document it for blackmail", "Who? Never met them."]
    }
  ];

  // Load pending heat proposals on mount
  useEffect(() => {
    loadPendingProposals();
  }, [user.id]);

  // Calculate cooldown for existing friendship
  useEffect(() => {
    if (managingFriendship?.heat_changed_at) {
      const cooldown = getHeatChangeCooldownHours(managingFriendship.heat_changed_at);
      setHeatCooldownRemaining(cooldown);
    }
  }, [managingFriendship]);

  const loadPendingProposals = async () => {
    setLoadingProposals(true);
    const { proposals, error } = await getPendingHeatProposals(user.id);
    if (!error) {
      setPendingProposals(proposals);
    }
    setLoadingProposals(false);
  };

  // Debounced search
  const performSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    const { users, error } = await searchUsers(searchQuery, user.id);

    if (error) {
      setSearchError(error);
      setSearchResults([]);
    } else {
      setSearchResults(users);
    }

    setIsSearching(false);
  }, [user.id]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim()) {
        performSearch(query.trim());
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, performSearch]);

  const handleSelectUser = (selectedDbUser: DBUser) => {
    setSelectedUser(selectedDbUser);
    setStage(AddStage.SURVEY);
  };

  const handleAnswer = (answer: string) => {
    const newAnswers = [...answers, answer];
    setAnswers(newAnswers);

    if (surveyIndex < SURVEY_QUESTIONS.length - 1) {
      setSurveyIndex(prev => prev + 1);
    } else {
      setStage(AddStage.ANALYZING);
      runAnalysis(newAnswers);
    }
  };

  const runAnalysis = async (finalAnswers: string[]) => {
    if (!selectedUser) return;

    const result = await generateFriendshipProfile(selectedUser.name, finalAnswers);
    setGeneratedProfile(result);
    setSelectedHeatLevel(result.level); // Default to AI-suggested level
    setStage(AddStage.RESULT);
  };

  const confirmFriend = async () => {
    if (!selectedUser) return;
    const heatLevel = selectedHeatLevel || generatedProfile?.level || RelationshipLevel.CIVILIAN;

    setSendingRequest(true);

    // Send real friend request to database
    const { friendship, error } = await sendFriendRequest(user.id, selectedUser.id, answers);

    if (error) {
      alert(`Failed to send request: ${error}`);
      setSendingRequest(false);
      return;
    }

    // The heat level will be pending confirmation from the other user
    // Create local friend object for UI update
    const newFriend: Friend = {
      id: selectedUser.id,
      name: selectedUser.name,
      username: selectedUser.username,
      relationshipLevel: heatLevel,
      relationshipDescription: generatedProfile?.description || '',
      status: 'online',
      friendshipStatus: 'pending_sent',
      coins: selectedUser.coins,
      avatarUrl: selectedUser.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedUser.username}`,
      trustScore: 100,
      totalBetsAgainst: 0,
      winsAgainst: 0,
      heatConfirmed: false, // Heat needs confirmation from friend
      userProposedHeat: heatLevel,
      friendshipId: friendship?.id,
    };

    setSendingRequest(false);
    onAdd(newFriend);
  };

  const handleHeatLevelSelect = (level: RelationshipLevel) => {
    setSelectedHeatLevel(level);
  };

  // Handle accepting a heat proposal
  const handleAcceptProposal = async (proposal: HeatProposal) => {
    setProcessingProposal(proposal.friendshipId);
    setProposalError(null);

    const { success, newLevel, error } = await acceptHeatLevel(proposal.friendshipId, user.id);

    if (success) {
      setProposalSuccess(`Heat level updated to ${HEAT_LEVELS[newLevel - 1]?.label || 'Unknown'}!`);
      // Remove from list
      setPendingProposals(prev => prev.filter(p => p.friendshipId !== proposal.friendshipId));
      setTimeout(() => setProposalSuccess(null), 3000);
    } else {
      setProposalError(error || 'Failed to accept proposal');
    }

    setProcessingProposal(null);
  };

  // Handle rejecting a heat proposal
  const handleRejectProposal = async (proposal: HeatProposal) => {
    setProcessingProposal(proposal.friendshipId);
    setProposalError(null);

    const { success, error } = await rejectHeatLevel(proposal.friendshipId, user.id);

    if (success) {
      setProposalSuccess('Proposal rejected');
      // Remove from list
      setPendingProposals(prev => prev.filter(p => p.friendshipId !== proposal.friendshipId));
      setTimeout(() => setProposalSuccess(null), 3000);
    } else {
      setProposalError(error || 'Failed to reject proposal');
    }

    setProcessingProposal(null);
  };

  // Handle proposing a new heat level for existing friend
  const handleProposeHeatLevel = async (level: 1 | 2 | 3) => {
    if (!managingFriendship) return;

    setProposingLevel(level);
    setProposalError(null);

    const { success, error } = await proposeHeatLevel(managingFriendship.id, user.id, level);

    if (success) {
      setProposalSuccess(`Heat level ${HEAT_LEVELS[level - 1]?.label} proposed! Waiting for confirmation.`);
      // Refresh friendship data
      const { friendship } = await getFriendship(user.id, managingFriendship.friend_id);
      if (friendship) {
        setManagingFriendship(friendship);
      }
      setTimeout(() => setProposalSuccess(null), 3000);
    } else {
      setProposalError(error || 'Failed to propose heat level');
    }

    setProposingLevel(null);
  };

  // Format remaining cooldown time
  const formatCooldown = (hoursRemaining: number): string => {
    if (hoursRemaining < 1) {
      const minutes = Math.ceil(hoursRemaining * 60);
      return `${minutes}m`;
    }
    const hours = Math.floor(hoursRemaining);
    const minutes = Math.ceil((hoursRemaining - hours) * 60);
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  };

  // Format proposal time
  const formatProposalTime = (isoString: string): string => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const renderSearch = () => (
    <div className="flex-1 flex flex-col">
      <div className="text-center mb-6">
        <i className="fas fa-crosshairs text-5xl text-cyan-glitch mb-3 animate-pulse"></i>
        <h2 className="text-xl font-bold text-white uppercase tracking-widest">Hunt a Victim</h2>
        <p className="text-gray-500 text-xs mt-1">SEARCH BY USERNAME</p>
      </div>

      {/* Pending Proposals Badge */}
      {pendingProposals.length > 0 && (
        <button
          onClick={() => setStage(AddStage.HEAT_PROPOSALS)}
          className="mb-4 p-3 bg-yellow-900/30 border border-yellow-500/50 rounded-lg flex items-center justify-between hover:bg-yellow-900/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="relative">
              <i className="fas fa-fire text-yellow-500"></i>
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-alert-red rounded-full text-[10px] text-white flex items-center justify-center font-bold">
                {pendingProposals.length}
              </span>
            </div>
            <span className="text-yellow-500 text-sm font-bold">
              {pendingProposals.length} Heat Proposal{pendingProposals.length > 1 ? 's' : ''} Pending
            </span>
          </div>
          <i className="fas fa-chevron-right text-yellow-500"></i>
        </button>
      )}

      <div className="relative mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter username..."
          className="w-full bg-black border border-gray-700 text-white p-4 rounded-lg focus:outline-none focus:border-cyan-glitch font-mono placeholder-gray-600 pr-12"
          autoFocus
        />
        {isSearching && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <i className="fas fa-spinner fa-spin text-cyan-glitch"></i>
          </div>
        )}
      </div>

      {searchError && (
        <div className="text-alert-red text-sm mb-4 text-center">
          <i className="fas fa-exclamation-triangle mr-2"></i>
          {searchError}
        </div>
      )}

      {/* Search Results */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {searchResults.length === 0 && query.length >= 2 && !isSearching && (
          <div className="text-center text-gray-500 py-8">
            <i className="fas fa-ghost text-4xl mb-3 opacity-50"></i>
            <p className="text-sm">No strays found with that name</p>
          </div>
        )}

        {query.length < 2 && !isSearching && (
          <div className="text-center text-gray-600 py-8">
            <i className="fas fa-search text-4xl mb-3 opacity-30"></i>
            <p className="text-sm">Type at least 2 characters to search</p>
          </div>
        )}

        {searchResults.map((result) => (
          <button
            key={result.id}
            onClick={() => handleSelectUser(result)}
            className="w-full p-4 bg-bingo-dark border border-gray-800 rounded-lg flex items-center gap-4 hover:border-cyan-glitch transition-colors text-left"
          >
            <img
              src={result.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${result.username}`}
              alt={result.name}
              className="w-12 h-12 rounded-full bg-gray-800"
            />
            <div className="flex-1 min-w-0">
              <div className="text-white font-bold truncate">{result.name}</div>
              <div className="text-gray-500 text-sm font-mono">@{result.username}</div>
            </div>
            <div className="text-cyan-glitch">
              <i className="fas fa-chevron-right"></i>
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  const renderSurvey = () => (
    <div className="flex-1 flex flex-col pt-4">
      {/* Selected User Header */}
      {selectedUser && (
        <div className="flex items-center gap-3 mb-6 p-3 bg-black/50 rounded-lg border border-gray-800">
          <img
            src={selectedUser.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedUser.username}`}
            alt={selectedUser.name}
            className="w-10 h-10 rounded-full"
          />
          <div>
            <div className="text-white font-bold text-sm">{selectedUser.name}</div>
            <div className="text-gray-500 text-xs font-mono">@{selectedUser.username}</div>
          </div>
        </div>
      )}

      <div className="mb-2 text-acid-green font-mono text-xs uppercase tracking-widest">
        THE INTERROGATION ({surveyIndex + 1}/{SURVEY_QUESTIONS.length})
      </div>
      <div className="h-1 w-full bg-gray-800 rounded mb-6">
        <div className="h-1 bg-acid-green transition-all duration-300" style={{ width: `${((surveyIndex + 1) / SURVEY_QUESTIONS.length) * 100}%` }}></div>
      </div>

      <h2 className="text-lg font-bold text-white mb-6 leading-relaxed">
        {SURVEY_QUESTIONS[surveyIndex].q}
      </h2>

      <div className="space-y-3">
        {SURVEY_QUESTIONS[surveyIndex].options.map((opt, i) => (
          <button
            key={i}
            onClick={() => handleAnswer(opt)}
            className="w-full text-left p-4 bg-bingo-dark border border-gray-700 hover:border-hot-pink hover:text-hot-pink rounded-lg transition-all animate-in slide-in-from-right duration-300"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <span className="font-mono mr-2 text-gray-500">{i + 1}.</span> {opt}
          </button>
        ))}
      </div>
    </div>
  );

  const renderAnalyzing = () => (
    <div className="flex-1 flex flex-col items-center justify-center">
      <i className="fas fa-microchip text-6xl text-hot-pink animate-spin mb-6"></i>
      <h2 className="text-2xl font-bold text-white uppercase tracking-widest animate-pulse">Processing...</h2>
      <p className="text-gray-500 font-mono text-xs mt-2">CALCULATING HOW BADLY THIS WILL END</p>
      <div className="mt-8 font-mono text-acid-green text-xs text-left">
         {`> Scanning for red flags... MANY`}<br/>
         {`> Calculating betrayal probability... HIGH`}<br/>
         {`> Estimating drama potential... MAXIMUM`}<br/>
         {`> Assigning threat level...`}
      </div>
    </div>
  );

  const renderResult = () => {
    if (!generatedProfile || !selectedUser) return null;
    const { description } = generatedProfile;
    const level = selectedHeatLevel || generatedProfile.level;

    const selectedHeat = HEAT_LEVELS.find(h => h.level === level) || HEAT_LEVELS[0];

    return (
      <div className="flex-1 flex flex-col pt-6 animate-in zoom-in duration-500">
        {/* Selected User Card */}
        <div className="flex items-center gap-3 mb-6 p-3 bg-black/50 rounded-lg border border-gray-800">
          <img
            src={selectedUser.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedUser.username}`}
            alt={selectedUser.name}
            className="w-10 h-10 rounded-full"
          />
          <div>
            <div className="text-white font-bold text-sm">{selectedUser.name}</div>
            <div className="text-gray-500 text-xs font-mono">@{selectedUser.username}</div>
          </div>
        </div>

        {/* Heat Level Selector */}
        <div className="mb-6">
          <div className="text-gray-500 text-xs uppercase tracking-widest mb-3">Choose Heat Level</div>
          <div className="grid grid-cols-3 gap-2">
            {HEAT_LEVELS.map((heat) => (
              <button
                key={heat.level}
                onClick={() => handleHeatLevelSelect(heat.level)}
                className={`p-3 rounded-lg border-2 transition-all duration-200 flex flex-col items-center ${
                  selectedHeatLevel === heat.level
                    ? `${heat.borderColor} ${heat.bgColor}`
                    : 'border-gray-700 bg-black/30 hover:border-gray-500'
                }`}
              >
                <i className={`fas ${heat.icon} text-xl mb-1 ${selectedHeatLevel === heat.level ? heat.color : 'text-gray-500'}`}></i>
                <span className={`text-xs font-bold ${selectedHeatLevel === heat.level ? heat.color : 'text-gray-400'}`}>
                  {heat.label}
                </span>
              </button>
            ))}
          </div>
          <p className="text-gray-500 text-xs mt-2 text-center italic">
            {selectedHeat.sublabel}
          </p>
        </div>

        {/* Mutual Consent Notice */}
        <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2 text-yellow-500 text-xs mb-1">
            <i className="fas fa-handshake"></i>
            <span className="font-bold uppercase">Mutual Consent Required</span>
          </div>
          <p className="text-yellow-500/70 text-xs">
            {selectedUser.name} must also choose this heat level for it to be active.
            Until then, you'll both be at the lowest level either of you picks.
          </p>
        </div>

        {/* AI Generated Description */}
        <div className="bg-gray-900 border border-gray-700 p-4 rounded-lg mb-6 relative overflow-hidden">
          <i className="fas fa-quote-left absolute top-2 left-2 text-gray-800 text-3xl"></i>
          <p className="text-white font-mono text-sm relative z-10 italic text-center">
            "{description}"
          </p>
        </div>

        {/* What You Can Do */}
        <div className="bg-black/40 p-4 rounded border border-gray-800 mb-6">
          <div className="text-xs text-gray-500 uppercase mb-2">What you can do to them:</div>
          <ul className="text-sm space-y-2">
            <li className="flex items-center gap-2 text-gray-300">
              <i className="fas fa-check text-acid-green"></i>
              {level === 1 ? 'Safe, boring bets' : level === 2 ? 'Embarrassing bets' : 'Location & secret bets'}
            </li>
            <li className="flex items-center gap-2 text-gray-300">
              <i className="fas fa-check text-acid-green"></i>
              {level === 1 ? 'Basic proof' : level === 2 ? 'Video proof' : 'View-once proof (spicy)'}
            </li>
            <li className="flex items-center gap-2 text-gray-300">
              <i className="fas fa-check text-acid-green"></i>
              Rob their bingo stash anytime
            </li>
          </ul>
        </div>

        <button
          onClick={confirmFriend}
          disabled={sendingRequest}
          className="w-full bg-acid-green text-black font-black py-4 rounded hover:scale-[1.02] transition-transform shadow-[0_0_20px_rgba(204,255,0,0.4)] uppercase disabled:opacity-50 disabled:hover:scale-100"
        >
          {sendingRequest ? (
            <>
              <i className="fas fa-spinner fa-spin mr-2"></i>
              SENDING REQUEST...
            </>
          ) : (
            'SEND FRIEND REQUEST'
          )}
        </button>
      </div>
    );
  };

  const renderHeatProposals = () => (
    <div className="flex-1 flex flex-col">
      <div className="text-center mb-6">
        <i className="fas fa-fire text-5xl text-yellow-500 mb-3 animate-pulse"></i>
        <h2 className="text-xl font-bold text-white uppercase tracking-widest">Heat Proposals</h2>
        <p className="text-gray-500 text-xs mt-1">FRIENDS WANT TO CHANGE THE HEAT</p>
      </div>

      {/* Success/Error Messages */}
      {proposalSuccess && (
        <div className="mb-4 p-3 bg-green-900/30 border border-green-500/50 rounded-lg text-green-400 text-sm flex items-center gap-2">
          <i className="fas fa-check-circle"></i>
          {proposalSuccess}
        </div>
      )}

      {proposalError && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-red-400 text-sm flex items-center gap-2">
          <i className="fas fa-exclamation-circle"></i>
          {proposalError}
        </div>
      )}

      {loadingProposals ? (
        <div className="flex-1 flex items-center justify-center">
          <i className="fas fa-spinner fa-spin text-3xl text-gray-500"></i>
        </div>
      ) : pendingProposals.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
          <i className="fas fa-inbox text-5xl mb-4 opacity-30"></i>
          <p className="text-sm">No pending heat proposals</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-4">
          {pendingProposals.map((proposal) => {
            const proposedHeat = HEAT_LEVELS[proposal.proposedLevel - 1];
            const currentHeat = HEAT_LEVELS[proposal.currentLevel - 1];
            const isProcessing = processingProposal === proposal.friendshipId;
            const isIncrease = proposal.proposedLevel > proposal.currentLevel;

            return (
              <div
                key={proposal.friendshipId}
                className="p-4 bg-bingo-dark border border-gray-800 rounded-xl"
              >
                {/* Friend Info */}
                <div className="flex items-center gap-3 mb-4">
                  <img
                    src={proposal.friendAvatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${proposal.friendName}`}
                    alt={proposal.friendName}
                    className="w-12 h-12 rounded-full bg-gray-800"
                  />
                  <div className="flex-1">
                    <div className="text-white font-bold">{proposal.proposedByName}</div>
                    <div className="text-gray-500 text-xs">
                      {formatProposalTime(proposal.proposedAt)}
                    </div>
                  </div>
                </div>

                {/* Proposal Details */}
                <div className="bg-black/50 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-center gap-4">
                    <div className="text-center">
                      <div className="text-gray-500 text-xs mb-1">Current</div>
                      <div className={`${currentHeat.color}`}>
                        <i className={`fas ${currentHeat.icon} text-2xl`}></i>
                        <div className="text-xs font-bold mt-1">{currentHeat.label}</div>
                      </div>
                    </div>
                    <div className="text-gray-600">
                      <i className={`fas fa-arrow-right text-xl ${isIncrease ? 'text-orange-500' : 'text-cyan-500'}`}></i>
                    </div>
                    <div className="text-center">
                      <div className="text-gray-500 text-xs mb-1">Proposed</div>
                      <div className={`${proposedHeat.color}`}>
                        <i className={`fas ${proposedHeat.icon} text-2xl`}></i>
                        <div className="text-xs font-bold mt-1">{proposedHeat.label}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Info about what this means */}
                <p className="text-gray-500 text-xs mb-4 text-center">
                  {isIncrease
                    ? `Accepting will unlock ${proposedHeat.label.toLowerCase()} level bets between you.`
                    : `Rejecting will keep you at the lower level. Safety first.`}
                </p>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => handleRejectProposal(proposal)}
                    disabled={isProcessing}
                    className="flex-1 py-3 bg-gray-800 text-gray-400 font-bold rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <i className="fas fa-spinner fa-spin"></i>
                    ) : (
                      <>
                        <i className="fas fa-times mr-2"></i>
                        REJECT
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleAcceptProposal(proposal)}
                    disabled={isProcessing}
                    className={`flex-1 py-3 font-bold rounded-lg transition-colors disabled:opacity-50 ${proposedHeat.bgColor} ${proposedHeat.color} border ${proposedHeat.borderColor} hover:opacity-80`}
                  >
                    {isProcessing ? (
                      <i className="fas fa-spinner fa-spin"></i>
                    ) : (
                      <>
                        <i className="fas fa-check mr-2"></i>
                        ACCEPT
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button
        onClick={() => setStage(AddStage.SEARCH)}
        className="mt-4 w-full bg-gray-800 text-gray-400 font-bold py-4 rounded-lg hover:bg-gray-700 transition-colors uppercase"
      >
        <i className="fas fa-arrow-left mr-2"></i>
        Back to Search
      </button>
    </div>
  );

  const renderManageHeat = () => {
    if (!existingFriend || !managingFriendship) return null;

    const currentLevel = managingFriendship.heat_level;
    const currentHeat = HEAT_LEVELS[currentLevel - 1];
    const hasPendingProposal = managingFriendship.heat_level_proposed !== null;
    const pendingLevel = managingFriendship.heat_level_proposed;
    const proposedByMe = managingFriendship.heat_level_proposed_by === user.id;
    const isConfirmed = managingFriendship.heat_confirmed;
    const isCooldownActive = heatCooldownRemaining !== null && heatCooldownRemaining > 0;

    return (
      <div className="flex-1 flex flex-col pt-6">
        {/* Friend Header */}
        <div className="flex items-center gap-4 mb-6 p-4 bg-black/50 rounded-xl border border-gray-800">
          <img
            src={existingFriend.avatarUrl}
            alt={existingFriend.name}
            className="w-16 h-16 rounded-full bg-gray-800"
          />
          <div>
            <div className="text-white font-bold text-lg">{existingFriend.name}</div>
            <div className="text-gray-500 text-sm font-mono">@{existingFriend.username}</div>
          </div>
        </div>

        {/* Current Heat Level */}
        <div className="text-center mb-6">
          <div className="text-gray-500 text-xs uppercase tracking-widest mb-2">Current Heat Level</div>
          <div className={`inline-flex items-center gap-2 px-6 py-3 rounded-full ${currentHeat.bgColor} ${currentHeat.borderColor} border-2`}>
            <i className={`fas ${currentHeat.icon} text-2xl ${currentHeat.color}`}></i>
            <span className={`text-lg font-bold ${currentHeat.color}`}>{currentHeat.label}</span>
          </div>
          {!isConfirmed && (
            <div className="text-yellow-500 text-xs mt-2">
              <i className="fas fa-info-circle mr-1"></i>
              Not mutually confirmed - using lower preference
            </div>
          )}
        </div>

        {/* Success/Error Messages */}
        {proposalSuccess && (
          <div className="mb-4 p-3 bg-green-900/30 border border-green-500/50 rounded-lg text-green-400 text-sm flex items-center gap-2">
            <i className="fas fa-check-circle"></i>
            {proposalSuccess}
          </div>
        )}

        {proposalError && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-red-400 text-sm flex items-center gap-2">
            <i className="fas fa-exclamation-circle"></i>
            {proposalError}
          </div>
        )}

        {/* Pending Proposal */}
        {hasPendingProposal && pendingLevel && (
          <div className="mb-6 p-4 bg-yellow-900/20 border border-yellow-600/30 rounded-xl">
            <div className="flex items-center gap-2 text-yellow-500 text-sm mb-2">
              <i className="fas fa-hourglass-half animate-pulse"></i>
              <span className="font-bold">Pending Proposal</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-gray-400 text-sm">
                  {proposedByMe ? 'You proposed' : `${existingFriend.name} proposed`}:
                </span>
                <span className={`ml-2 font-bold ${HEAT_LEVELS[pendingLevel - 1]?.color}`}>
                  {HEAT_LEVELS[pendingLevel - 1]?.label}
                </span>
              </div>
              {!proposedByMe && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRejectProposal({
                      friendshipId: managingFriendship.id,
                      proposedLevel: pendingLevel as 1 | 2 | 3,
                      proposedBy: managingFriendship.heat_level_proposed_by!,
                      proposedByName: existingFriend.name,
                      proposedAt: managingFriendship.heat_level_proposed_at!,
                      currentLevel: currentLevel,
                      friendName: existingFriend.name,
                      friendId: existingFriend.id,
                      friendAvatarUrl: existingFriend.avatarUrl,
                    })}
                    className="px-3 py-1 bg-gray-800 text-gray-400 rounded text-xs hover:bg-gray-700"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleAcceptProposal({
                      friendshipId: managingFriendship.id,
                      proposedLevel: pendingLevel as 1 | 2 | 3,
                      proposedBy: managingFriendship.heat_level_proposed_by!,
                      proposedByName: existingFriend.name,
                      proposedAt: managingFriendship.heat_level_proposed_at!,
                      currentLevel: currentLevel,
                      friendName: existingFriend.name,
                      friendId: existingFriend.id,
                      friendAvatarUrl: existingFriend.avatarUrl,
                    })}
                    className={`px-3 py-1 rounded text-xs ${HEAT_LEVELS[pendingLevel - 1]?.bgColor} ${HEAT_LEVELS[pendingLevel - 1]?.color}`}
                  >
                    Accept
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Cooldown Warning */}
        {isCooldownActive && (
          <div className="mb-6 p-3 bg-red-900/20 border border-red-600/30 rounded-lg">
            <div className="flex items-center gap-2 text-red-500 text-sm">
              <i className="fas fa-clock"></i>
              <span>Heat change cooldown: {formatCooldown(heatCooldownRemaining!)} remaining</span>
            </div>
          </div>
        )}

        {/* Heat Level Selector */}
        {!hasPendingProposal && !isCooldownActive && (
          <>
            <div className="text-gray-500 text-xs uppercase tracking-widest mb-3">Propose New Heat Level</div>
            <div className="grid grid-cols-3 gap-3 mb-6">
              {HEAT_LEVELS.map((heat) => {
                const isCurrentLevel = currentLevel === heat.numericLevel && isConfirmed;
                const isProposing = proposingLevel === heat.numericLevel;

                return (
                  <button
                    key={heat.level}
                    onClick={() => handleProposeHeatLevel(heat.numericLevel as 1 | 2 | 3)}
                    disabled={isCurrentLevel || isProposing || proposingLevel !== null}
                    className={`p-4 rounded-xl border-2 transition-all duration-200 flex flex-col items-center ${
                      isCurrentLevel
                        ? `${heat.borderColor} ${heat.bgColor} opacity-50 cursor-not-allowed`
                        : `border-gray-700 bg-black/30 hover:${heat.borderColor} hover:${heat.bgColor}`
                    } disabled:opacity-50`}
                  >
                    {isProposing ? (
                      <i className="fas fa-spinner fa-spin text-2xl text-gray-400 mb-2"></i>
                    ) : (
                      <i className={`fas ${heat.icon} text-2xl mb-2 ${isCurrentLevel ? heat.color : 'text-gray-500'}`}></i>
                    )}
                    <span className={`text-sm font-bold ${isCurrentLevel ? heat.color : 'text-gray-400'}`}>
                      {heat.label}
                    </span>
                    {isCurrentLevel && (
                      <span className="text-[10px] text-gray-500 mt-1">CURRENT</span>
                    )}
                  </button>
                );
              })}
            </div>

            <p className="text-gray-500 text-xs text-center mb-6">
              <i className="fas fa-info-circle mr-1"></i>
              Your friend must accept for the change to take effect.
              The lower preference is always used until both agree.
            </p>
          </>
        )}

        {/* What Each Level Unlocks */}
        <div className="bg-black/40 rounded-xl border border-gray-800 p-4 mb-6">
          <div className="text-gray-500 text-xs uppercase tracking-widest mb-3">What Each Level Unlocks</div>
          <div className="space-y-3">
            {HEAT_LEVELS.map((heat) => (
              <div
                key={heat.level}
                className={`flex items-center gap-3 p-2 rounded-lg ${currentLevel === heat.numericLevel ? heat.bgColor : ''}`}
              >
                <i className={`fas ${heat.icon} ${heat.color}`}></i>
                <div>
                  <div className={`text-sm font-bold ${heat.color}`}>{heat.label}</div>
                  <div className="text-gray-500 text-xs">{heat.sublabel}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full bg-gray-800 text-gray-400 font-bold py-4 rounded-lg hover:bg-gray-700 transition-colors uppercase"
        >
          Close
        </button>
      </div>
    );
  };

  return (
    <div className="h-full bg-bingo-black flex flex-col p-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
        <i className="fas fa-network-wired text-9xl text-hot-pink"></i>
      </div>

      <div className="flex justify-between items-center z-10 mb-4">
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <i className="fas fa-times text-xl"></i>
        </button>
        <div className="text-[10px] font-mono text-gray-600 uppercase">
          {stage === AddStage.MANAGE_HEAT ? 'Protocol: HEAT_MANAGEMENT' :
           stage === AddStage.HEAT_PROPOSALS ? 'Protocol: HEAT_PROPOSALS' :
           'Protocol: ADD_FRIEND'}
        </div>
        <div className="w-4"></div>
      </div>

      {stage === AddStage.SEARCH && renderSearch()}
      {stage === AddStage.SURVEY && renderSurvey()}
      {stage === AddStage.ANALYZING && renderAnalyzing()}
      {stage === AddStage.RESULT && renderResult()}
      {stage === AddStage.HEAT_PROPOSALS && renderHeatProposals()}
      {stage === AddStage.MANAGE_HEAT && renderManageHeat()}
    </div>
  );
};

export default AddFriend;
