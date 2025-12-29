import React from 'react';
import { UserProfile, Friend, RelationshipLevel, ActiveBet, AppView } from '../types';

interface DashboardProps {
  user: UserProfile;
  activeBets: ActiveBet[];
  friends: Friend[];
  onNavigate: (view: any) => void;
  onSelectFriend: (friend: Friend) => void;
  onSteal: (friend: Friend) => void;
  onOpenProof: (bet: ActiveBet) => void;
  onAddFriend: () => void;
  onAcceptFriend: (friend: Friend) => void;
  onRejectFriend: (friend: Friend) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
    user, activeBets, friends, onNavigate, onSelectFriend, onSteal, onOpenProof, onAddFriend, onAcceptFriend, onRejectFriend 
}) => {
  
  const incomingRequests = friends.filter(f => f.friendshipStatus === 'pending_received');
  const activeFriends = friends.filter(f => f.friendshipStatus === 'accepted');
  const pendingSent = friends.filter(f => f.friendshipStatus === 'pending_sent');

  return (
    <div className="h-full bg-bingo-black text-gray-200 p-4 overflow-y-auto">
      {/* Tuna Stash Header (Clickable Profile) */}
      <div 
        onClick={() => onNavigate(AppView.PROFILE)}
        className="mb-6 p-6 bg-gradient-to-r from-bingo-dark to-black border border-acid-green rounded-xl relative overflow-hidden shadow-[0_0_15px_rgba(204,255,0,0.1)] cursor-pointer active:scale-[0.98] transition-transform group"
      >
        <div className="absolute top-0 right-0 p-2 opacity-20 text-6xl group-hover:opacity-30 transition-opacity">
          <i className="fas fa-wallet"></i>
        </div>
        <div className="flex justify-between items-start">
            <div>
                <h2 className="text-sm text-gray-400 uppercase tracking-widest">Tuna Stash (Balance)</h2>
                <div className="text-4xl font-bold text-white mt-1 flex items-baseline gap-2">
                {user.coins} <span className="text-xl text-acid-green">😼</span>
                </div>
            </div>
            <div className="bg-gray-800/50 p-1 rounded-full border border-white/10">
                 <img src={user.avatarUrl} className="w-8 h-8 rounded-full" />
            </div>
        </div>
        <p className="text-xs text-hot-pink mt-2">Next Drop: Monday</p>
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
                     <i className="fas fa-envelope"></i> FRIEND REQUESTS
                 </h3>
                 <div className="space-y-3">
                     {incomingRequests.map(req => (
                         <div key={req.id} className="flex items-center justify-between bg-black p-3 rounded border border-gray-800">
                             <div className="flex items-center gap-3">
                                 <img src={req.avatarUrl} className="w-10 h-10 rounded-full border border-gray-600" />
                                 <div>
                                     <div className="font-bold text-white text-sm">{req.name}</div>
                                     <div className="text-[10px] text-gray-400">Vibe: {req.relationshipLevel === 3 ? 'NUCLEAR' : req.relationshipLevel === 2 ? 'ROAST' : 'CIVILIAN'}</div>
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
                <i className="fas fa-fire"></i> ACTIVE BETS
              </h3>
              <div className="flex overflow-x-auto gap-4 pb-2">
                {activeBets.map(bet => (
                    <div key={bet.id} className="min-w-[200px] bg-gray-900 border border-hot-pink rounded-lg p-3 relative flex-shrink-0">
                        <div className="text-xs text-hot-pink font-bold mb-1">VS {bet.opponentName}</div>
                        <div className="text-sm font-bold text-white mb-2 leading-tight">"{bet.scenario}"</div>
                        <div className="text-xs text-gray-400 mb-3">Stake: {bet.stake} 😼</div>
                        
                        {bet.status === 'pending_proof' ? (
                            <button 
                                onClick={() => onOpenProof(bet)}
                                className="w-full bg-hot-pink text-white text-xs font-bold py-2 rounded animate-bounce"
                            >
                                <i className="fas fa-camera mr-1"></i> SEND PROOF
                            </button>
                        ) : (
                            <div className="w-full bg-gray-700 text-gray-300 text-xs font-bold py-2 rounded text-center">
                                <i className="fas fa-gavel mr-1"></i> JUDGING...
                            </div>
                        )}
                    </div>
                ))}
              </div>
          </div>
      )}

      {/* Action Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <button 
          onClick={() => alert("Begging for tuna is beneath you.")}
          className="p-4 bg-bingo-dark border border-gray-700 rounded-lg flex flex-col items-center justify-center hover:border-white transition-all opacity-50"
        >
          <i className="fas fa-hand-holding-heart mb-2 text-xl"></i>
          <span className="font-bold text-xs uppercase">BEG</span>
        </button>
         <button 
          className="p-4 bg-bingo-dark border border-gray-700 rounded-lg flex flex-col items-center justify-center hover:border-white transition-all opacity-50"
        >
          <i className="fas fa-coins mb-2 text-xl"></i>
          <span className="font-bold text-xs uppercase">LOAN</span>
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
            <span className="block font-bold tracking-widest text-sm">RECRUIT STRAY</span>
            <span className="block text-[10px] text-gray-400 group-hover:text-cyan-glitch/80">EXPAND YOUR PRIDE</span>
        </div>
      </button>

      {/* The Pride List */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-cyan-glitch flex items-center gap-2">
          <i className="fas fa-cat"></i> THE PRIDE (FRIENDS)
        </h3>
      </div>
      
      <div className="space-y-3 pb-20">
        {friends.length === 0 && (
          <div className="text-center p-8 bg-bingo-dark/50 rounded-lg border border-dashed border-gray-700">
             <p className="text-gray-500 text-sm">You are a lone wolf... err, cat.</p>
          </div>
        )}

        {activeFriends.map(friend => (
            <div key={friend.id} className="bg-bingo-dark p-3 rounded-lg border border-gray-800 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="relative">
                    <img src={friend.avatarUrl} alt={friend.name} className="w-10 h-10 rounded-full border border-gray-600 grayscale hover:grayscale-0 transition-all" />
                    <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-black ${friend.status === 'online' ? 'bg-acid-green' : 'bg-gray-500'}`}></div>
                    </div>
                    <div>
                    <div className="font-bold text-sm">{friend.name}</div>
                    <div className="text-[10px] text-gray-500 uppercase flex items-center gap-1">
                        {friend.relationshipLevel === 1 && <span className="text-blue-400">Civilian</span>}
                        {friend.relationshipLevel === 2 && <span className="text-orange-400">Roast</span>}
                        {friend.relationshipLevel === 3 && <span className="text-alert-red animate-pulse">Nuclear</span>}
                    </div>
                    </div>
                </div>
                
                <div className="flex gap-2">
                    <button 
                    onClick={() => onSelectFriend(friend)}
                    className="bg-gray-800 hover:bg-gray-700 text-cyan-glitch px-3 py-1 rounded text-xs font-bold border border-cyan-glitch border-opacity-30"
                    >
                    CLAW-OFF
                    </button>
                    <button 
                    onClick={() => onSteal(friend)}
                    className="bg-gray-800 hover:bg-red-900/50 text-alert-red px-3 py-1 rounded text-xs font-bold border border-alert-red border-opacity-30"
                    >
                    STEAL
                    </button>
                </div>
              </div>
              {/* Vibe Description */}
              <div className="text-[10px] text-gray-500 italic border-t border-gray-800 pt-2 mt-1">
                  "{friend.relationshipDescription || 'Just a random stray.'}"
              </div>
            </div>
        ))}

        {pendingSent.length > 0 && (
            <div className="pt-4 border-t border-gray-800 mt-4">
                <h4 className="text-xs text-gray-500 uppercase tracking-widest mb-2">Pending Invites</h4>
                {pendingSent.map(friend => (
                    <div key={friend.id} className="bg-black/50 p-3 rounded-lg border border-gray-800 flex items-center justify-between opacity-60">
                         <div className="flex items-center gap-3">
                             <img src={friend.avatarUrl} className="w-8 h-8 rounded-full grayscale" />
                             <div className="font-mono text-xs text-gray-400">{friend.name}</div>
                         </div>
                         <div className="text-[10px] text-gray-600 italic">WAITING...</div>
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;