import React, { useState } from 'react';
import { UserProfile, Friend, RelationshipLevel, ActiveBet, AppView } from '../types';
import ReportModal, { ReportType } from './ReportModal';

interface DashboardProps {
  user: UserProfile;
  activeBets: ActiveBet[];
  friends: Friend[];
  onNavigate: (view: any) => void;
  onSelectFriend: (friend: Friend) => void;
  onSteal: (friend: Friend) => void;
  onChallenge?: (friend: Friend) => void;
  onOpenProof: (bet: ActiveBet) => void;
  onAddFriend: () => void;
  onAcceptFriend: (friend: Friend) => void;
  onRejectFriend: (friend: Friend) => void;
}

const Dashboard: React.FC<DashboardProps> = ({
    user, activeBets, friends, onNavigate, onSelectFriend, onSteal, onChallenge, onOpenProof, onAddFriend, onAcceptFriend, onRejectFriend
}) => {
  // Report modal state
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<{
    type: ReportType;
    id: string;
    userId?: string;
    context?: string;
  } | null>(null);

  const handleReportBet = (bet: ActiveBet) => {
    setReportTarget({
      type: 'bet',
      id: bet.betId,
      userId: bet.opponentId,
      context: bet.scenario,
    });
    setReportModalOpen(true);
  };

  const handleReportUser = (friend: Friend) => {
    setReportTarget({
      type: 'user',
      id: friend.id,
      userId: friend.id,
      context: friend.name,
    });
    setReportModalOpen(true);
  };

  const incomingRequests = friends.filter(f => f.friendshipStatus === 'pending_received');
  const activeFriends = friends.filter(f => f.friendshipStatus === 'accepted');
  const pendingSent = friends.filter(f => f.friendshipStatus === 'pending_sent');

  return (
    <div className="h-full bg-bingo-black flex flex-col">
      {/* Header with back button */}
      <div className="pt-[env(safe-area-inset-top)] bg-black/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="p-4 flex items-center gap-3 border-b border-gray-800">
          <button
            onClick={() => onNavigate(AppView.SWIPE_FEED)}
            className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-white active:text-acid-green transition-colors -ml-2 rounded-full active:bg-white/10"
          >
            <i className="fas fa-arrow-left text-2xl"></i>
          </button>
          <div className="flex-1">
            <h1 className="text-acid-green font-bold uppercase tracking-widest">Your Pride</h1>
            <p className="text-xs text-gray-500">Friends & Network</p>
          </div>
          <div className="text-right">
            <div className="text-acid-green font-bold">{user.coins} 😼</div>
            <div className="text-[10px] text-gray-500 uppercase">Bingo</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
      {/* Bingo Stash Header (Clickable Profile) */}
      <div
        onClick={() => onNavigate(AppView.PROFILE)}
        className="mb-6 p-6 bg-gradient-to-r from-bingo-dark to-black border border-acid-green rounded-xl relative overflow-hidden shadow-[0_0_15px_rgba(204,255,0,0.1)] cursor-pointer active:scale-[0.98] transition-transform group"
      >
        <div className="absolute top-0 right-0 p-2 opacity-20 text-6xl group-hover:opacity-30 transition-opacity">
          <i className="fas fa-wallet"></i>
        </div>
        <div className="flex justify-between items-start">
            <div>
                <h2 className="text-sm text-gray-400 uppercase tracking-widest">Your Bingo Stash</h2>
                <div className="text-4xl font-bold text-white mt-1 flex items-baseline gap-2">
                {user.coins} <span className="text-xl text-acid-green">😼</span>
                </div>
            </div>
            <div className="bg-gray-800/50 p-1 rounded-full border border-white/10">
                 <img src={user.avatarUrl} className="w-8 h-8 rounded-full" />
            </div>
        </div>
        <p className="text-xs text-hot-pink mt-2">Next Feeding: When I feel like it</p>
        <div className="mt-4 text-xs font-mono text-gray-500 border-t border-gray-800 pt-2 flex justify-between items-center">
          <span className="truncate max-w-[200px]">ID: {user.name} | {user.riskProfile}</span>
          <i className="fas fa-chevron-right text-[10px] opacity-50"></i>
        </div>
      </div>

      {/* Friend Requests */}
      {incomingRequests.length > 0 && (
          <div className="mb-8 animate-in slide-in-from-top duration-500">
             <div className="bg-gray-900/80 border border-cyan-glitch/50 p-4 rounded-xl shadow-[0_0_15px_rgba(0,255,255,0.15)]">
                 <h3 className="text-cyan-glitch font-bold text-sm tracking-widest mb-3 flex items-center gap-2 animate-pulse">
                     <i className="fas fa-envelope"></i> STRAYS WANT IN
                 </h3>
                 <div className="space-y-3">
                     {incomingRequests.map(req => (
                         <div key={req.id} className="flex items-center justify-between bg-black p-3 rounded border border-gray-800">
                             <div className="flex items-center gap-3">
                                 <img src={req.avatarUrl} className="w-10 h-10 rounded-full border border-gray-600" />
                                 <div>
                                     <div className="font-bold text-white text-sm">{req.name}</div>
                                     <div className="text-[10px] text-gray-400">Vibe: {req.relationshipLevel === 3 ? '🔥🔥🔥 Savage' : req.relationshipLevel === 2 ? '🔥🔥 Spicy' : '🔥 Chill'}</div>
                                 </div>
                             </div>
                             <div className="flex gap-2">
                                 <button onClick={(e) => { e.stopPropagation(); onRejectFriend(req); }} className="w-8 h-8 flex items-center justify-center rounded bg-gray-800 text-gray-500 hover:text-alert-red transition-colors"><i className="fas fa-times"></i></button>
                                 <button onClick={(e) => { e.stopPropagation(); onAcceptFriend(req); }} className="w-8 h-8 flex items-center justify-center rounded bg-acid-green text-black hover:bg-white transition-colors"><i className="fas fa-check"></i></button>
                             </div>
                         </div>
                     ))}
                 </div>
             </div>
          </div>
      )}

      {/* Active Bets */}
      {activeBets.length > 0 && (
          <div className="mb-8">
              <h3 className="text-lg font-bold mb-4 text-hot-pink flex items-center gap-2">
                <i className="fas fa-fire"></i> YOUR PENDING DOOM
              </h3>
              <div className="flex overflow-x-auto gap-4 pb-2">
                {activeBets.map(bet => (
                    <div key={bet.id} className="min-w-[200px] bg-gray-900 border border-hot-pink rounded-lg p-3 relative flex-shrink-0">
                        {/* Report button */}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleReportBet(bet); }}
                          className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center text-gray-600 hover:text-alert-red transition-colors rounded-full hover:bg-white/10"
                          title="Report this bet"
                        >
                          <i className="fas fa-flag text-xs"></i>
                        </button>
                        <div className="text-xs text-hot-pink font-bold mb-1 pr-6">VS {bet.opponentName}</div>
                        <div className="text-sm font-bold text-white mb-2 leading-tight">"{bet.scenario}"</div>
                        <div className="text-xs text-gray-400 mb-3">Stake: {bet.stake} 😼</div>

                        {bet.status === 'pending_proof' ? (
                            <button
                                onClick={() => onOpenProof(bet)}
                                className="w-full bg-hot-pink text-white text-xs font-bold py-2 rounded animate-bounce"
                            >
                                <i className="fas fa-camera mr-1"></i> PROVE IT OR LOSE IT
                            </button>
                        ) : (
                            <div className="w-full bg-gray-700 text-gray-300 text-xs font-bold py-2 rounded text-center">
                                <i className="fas fa-gavel mr-1"></i> THE COUNCIL DELIBERATES...
                            </div>
                        )}
                    </div>
                ))}
              </div>
          </div>
      )}

      {/* Challenge Button - Quick Access */}
      {onChallenge && activeFriends.length > 0 && (
        <button
          onClick={() => onNavigate(AppView.CREATE_BET)}
          className="w-full mb-4 p-4 bg-gradient-to-r from-hot-pink/20 to-acid-green/20 border-2 border-acid-green rounded-xl flex items-center gap-4 hover:from-hot-pink/30 hover:to-acid-green/30 transition-all active:scale-[0.98]"
        >
          <div className="w-12 h-12 rounded-full bg-acid-green flex items-center justify-center shadow-[0_0_20px_rgba(204,255,0,0.5)]">
            <i className="fas fa-bolt text-xl text-black"></i>
          </div>
          <div className="flex-1 text-left">
            <span className="block font-bold text-white uppercase tracking-wider">Challenge a Friend</span>
            <span className="block text-xs text-gray-400">Create your own bet • Real-time notification</span>
          </div>
          <i className="fas fa-chevron-right text-acid-green"></i>
        </button>
      )}

      {/* Beg Borrow Steal Grid */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <button
          onClick={() => onNavigate(AppView.BEG)}
          className="p-4 bg-bingo-dark border border-cyan-glitch/30 rounded-lg flex flex-col items-center justify-center hover:border-cyan-glitch transition-all active:scale-[0.98]"
        >
          <i className="fas fa-hands-praying mb-2 text-xl text-cyan-glitch"></i>
          <span className="font-bold text-xs uppercase text-cyan-glitch">BEG</span>
          <span className="text-[8px] text-gray-500 mt-1">Do embarrassing stuff</span>
        </button>
        <button
          onClick={() => onNavigate(AppView.BORROW)}
          className="p-4 bg-bingo-dark border border-hot-pink/30 rounded-lg flex flex-col items-center justify-center hover:border-hot-pink transition-all active:scale-[0.98]"
        >
          <i className="fas fa-handshake mb-2 text-xl text-hot-pink"></i>
          <span className="font-bold text-xs uppercase text-hot-pink">BORROW</span>
          <span className="text-[8px] text-gray-500 mt-1">With interest 📈</span>
        </button>
        <button
          onClick={() => onNavigate(AppView.STEAL)}
          disabled={activeFriends.length === 0}
          className={`p-4 bg-bingo-dark border border-alert-red/30 rounded-lg flex flex-col items-center justify-center hover:border-alert-red transition-all ${activeFriends.length === 0 ? 'opacity-50' : ''}`}
        >
          <i className="fas fa-mask mb-2 text-xl text-alert-red"></i>
          <span className="font-bold text-xs uppercase text-alert-red">STEAL</span>
          <span className="text-[8px] text-gray-500 mt-1">Rob your friends</span>
        </button>
      </div>

      {/* Recruit Button */}
      <button 
        onClick={onAddFriend}
        className="w-full mb-8 bg-gray-900 hover:bg-cyan-glitch/10 border-2 border-dashed border-cyan-glitch/50 hover:border-cyan-glitch text-cyan-glitch p-5 rounded-xl flex items-center justify-center gap-4 transition-all group shadow-[0_0_10px_rgba(0,0,0,0.5)]"
      >
        <span className="w-10 h-10 rounded-full bg-cyan-glitch text-black flex items-center justify-center text-lg shadow-[0_0_10px_rgba(0,255,255,0.5)] group-hover:scale-110 transition-transform">
          <i className="fas fa-plus"></i>
        </span>
        <div className="text-left">
            <span className="block font-bold tracking-widest text-sm">RECRUIT ANOTHER VICTIM</span>
            <span className="block text-[10px] text-gray-400 group-hover:text-cyan-glitch/80">MISERY LOVES COMPANY</span>
        </div>
      </button>

      {/* The Pride List */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-cyan-glitch flex items-center gap-2">
          <i className="fas fa-cat"></i> YOUR PRIDE OF DEGENERATES
        </h3>
      </div>
      
      <div className="space-y-3 pb-20">
        {friends.length === 0 && (
          <div className="text-center p-8 bg-bingo-dark/50 rounded-lg border border-dashed border-gray-700">
             <p className="text-gray-500 text-sm">No pride. No friends. Just you and your poor life choices.</p>
             <p className="text-gray-600 text-xs mt-2 italic">Tragic, honestly.</p>
          </div>
        )}

        {activeFriends.map(friend => (
            <div key={friend.id} className="bg-bingo-dark p-3 rounded-lg border border-gray-800 flex flex-col gap-2 relative">
              {/* Report user button */}
              <button
                onClick={(e) => { e.stopPropagation(); handleReportUser(friend); }}
                className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center text-gray-600 hover:text-alert-red transition-colors rounded-full hover:bg-white/10"
                title="Report this user"
              >
                <i className="fas fa-flag text-xs"></i>
              </button>
              <div className="flex items-center justify-between pr-6">
                <div className="flex items-center gap-3">
                    <div className="relative">
                    <img src={friend.avatarUrl} alt={friend.name} className="w-10 h-10 rounded-full border border-gray-600 grayscale hover:grayscale-0 transition-all" />
                    <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-black ${friend.status === 'online' ? 'bg-acid-green' : 'bg-gray-500'}`}></div>
                    </div>
                    <div>
                    <div className="font-bold text-sm">{friend.name}</div>
                    <div className="text-[10px] text-gray-500 uppercase flex items-center gap-1">
                        {friend.relationshipLevel === 1 && <span className="text-cyan-400">🔥 Chill</span>}
                        {friend.relationshipLevel === 2 && <span className="text-orange-400">🔥🔥 Spicy</span>}
                        {friend.relationshipLevel === 3 && <span className="text-alert-red animate-pulse">🔥🔥🔥 Savage</span>}
                    </div>
                    </div>
                </div>

                <div className="flex gap-2">
                    <button
                    onClick={() => onSelectFriend(friend)}
                    className="bg-gray-800 hover:bg-gray-700 text-cyan-glitch px-3 py-1 rounded text-xs font-bold border border-cyan-glitch border-opacity-30"
                    >
                    THROW DOWN
                    </button>
                    <button
                    onClick={() => onSteal(friend)}
                    className="bg-gray-800 hover:bg-red-900/50 text-alert-red px-3 py-1 rounded text-xs font-bold border border-alert-red border-opacity-30"
                    >
                    ROB 'EM
                    </button>
                </div>
              </div>
              {/* Vibe Description */}
              <div className="text-[10px] text-gray-500 italic border-t border-gray-800 pt-2 mt-1">
                  "{friend.relationshipDescription || 'Another stray with questionable judgment.'}"
              </div>
            </div>
        ))}

        {pendingSent.length > 0 && (
            <div className="pt-4 border-t border-gray-800 mt-4">
                <h4 className="text-xs text-gray-500 uppercase tracking-widest mb-2">Awaiting Their Doom</h4>
                {pendingSent.map(friend => (
                    <div key={friend.id} className="bg-black/50 p-3 rounded-lg border border-gray-800 flex items-center justify-between opacity-60">
                         <div className="flex items-center gap-3">
                             <img src={friend.avatarUrl} className="w-8 h-8 rounded-full grayscale" />
                             <div className="font-mono text-xs text-gray-400">{friend.name}</div>
                         </div>
                         <div className="text-[10px] text-gray-600 italic">deciding their fate...</div>
                    </div>
                ))}
            </div>
        )}
      </div>
      </div>

      {/* Report Modal */}
      {reportTarget && (
        <ReportModal
          isOpen={reportModalOpen}
          onClose={() => {
            setReportModalOpen(false);
            setReportTarget(null);
          }}
          reporterId={user.id}
          reportType={reportTarget.type}
          reportedId={reportTarget.id}
          reportedUserId={reportTarget.userId}
          contextInfo={reportTarget.context}
        />
      )}
    </div>
  );
};

export default Dashboard;