import React from 'react';
import { UserProfile } from '../types';

interface ProfileProps {
  user: UserProfile;
  onBack: () => void;
}

const Profile: React.FC<ProfileProps> = ({ user, onBack }) => {
  // Mock stats for display
  const stats = {
    wins: 12,
    losses: 8,
    steals: 3,
    robbed: 1,
    reputation: 'CHAOTIC NEUTRAL'
  };

  // Mock badges
  const badges = [
    { icon: 'fa-radiation', label: 'NUCLEAR', color: 'text-alert-red' },
    { icon: 'fa-cat', label: 'STRAY', color: 'text-acid-green' },
    { icon: 'fa-camera', label: 'SNITCH', color: 'text-gray-500' }
  ];

  // Mock history
  const history = [
    { id: 1, text: 'Bet GlitchBoy_99 is wearing black', result: 'WIN', amount: '+50' },
    { id: 2, text: 'Bet CyberMom cooked dinner', result: 'LOSS', amount: '-20' },
    { id: 3, text: 'Steal from GlitchBoy_99', result: 'SUCCESS', amount: '+12' },
  ];

  return (
    <div className="h-full bg-bingo-black flex flex-col relative overflow-hidden animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="p-4 z-10 flex justify-between items-center bg-black/50 backdrop-blur-sm sticky top-0">
            <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors">
                <i className="fas fa-arrow-left text-xl"></i>
            </button>
            <div className="text-acid-green font-mono text-xs tracking-[0.2em] uppercase">Identity Card</div>
            <div className="w-6"></div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 pt-2">
            {/* ID Card Look */}
            <div className="bg-gray-900 border-2 border-white/10 rounded-xl p-6 relative overflow-hidden mb-6 shadow-[0_0_30px_rgba(0,0,0,0.5)] group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                     <i className="fas fa-fingerprint text-9xl text-white"></i>
                </div>
                
                <div className="flex flex-col items-center relative z-10">
                    <div className="w-24 h-24 rounded-full border-2 border-acid-green p-1 mb-4 shadow-[0_0_15px_rgba(204,255,0,0.3)]">
                        <img src={user.avatarUrl} alt="Avatar" className="w-full h-full rounded-full bg-gray-800 object-cover" />
                    </div>
                    <h1 className="text-2xl font-black text-white uppercase tracking-tighter">{user.name}</h1>
                    <div className="text-xs font-mono text-hot-pink bg-hot-pink/10 px-3 py-1 rounded mt-2 border border-hot-pink/30">
                        LVL 1 • {stats.reputation}
                    </div>
                </div>

                <div className="mt-6 pt-6 border-t border-dashed border-gray-700">
                    <p className="text-gray-400 text-xs font-mono italic text-center">
                        "{user.riskProfile}"
                    </p>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-bingo-dark p-4 rounded border border-gray-800 flex flex-col items-center hover:border-acid-green transition-colors">
                    <div className="text-acid-green text-2xl font-black">{stats.wins}</div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wide">Clashes Won</div>
                </div>
                <div className="bg-bingo-dark p-4 rounded border border-gray-800 flex flex-col items-center hover:border-alert-red transition-colors">
                    <div className="text-alert-red text-2xl font-black">{stats.losses}</div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wide">Clashes Lost</div>
                </div>
                 <div className="bg-bingo-dark p-4 rounded border border-gray-800 flex flex-col items-center hover:border-cyan-glitch transition-colors">
                    <div className="text-cyan-glitch text-2xl font-black">{stats.steals}</div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wide">Raids</div>
                </div>
                 <div className="bg-bingo-dark p-4 rounded border border-gray-800 flex flex-col items-center hover:border-white transition-colors">
                    <div className="text-white text-2xl font-black">{user.coins}</div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wide">Net Worth</div>
                </div>
            </div>

            {/* Badges */}
            <div className="mb-8">
                <h3 className="text-gray-500 text-xs uppercase tracking-widest mb-3 pl-1">Badges & Shame</h3>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                    {badges.map((b, i) => (
                        <div key={i} className="flex-shrink-0 bg-black border border-gray-800 px-4 py-3 rounded flex flex-col items-center min-w-[80px]">
                            <i className={`fas ${b.icon} text-xl mb-2 ${b.color}`}></i>
                            <span className="text-[10px] font-bold text-gray-400">{b.label}</span>
                        </div>
                    ))}
                    <div className="flex-shrink-0 bg-black/30 border border-gray-800 border-dashed px-4 py-3 rounded flex flex-col items-center min-w-[80px] justify-center opacity-50">
                        <i className="fas fa-lock text-gray-600 mb-1"></i>
                        <span className="text-[10px] text-gray-600">LOCKED</span>
                    </div>
                </div>
            </div>

            {/* History */}
            <div className="pb-8">
                 <h3 className="text-gray-500 text-xs uppercase tracking-widest mb-3 pl-1">Recent Activity</h3>
                 <div className="space-y-2">
                    {history.map(h => (
                        <div key={h.id} className="bg-bingo-dark/50 p-3 rounded flex justify-between items-center border-l-2 border-gray-700 hover:border-acid-green transition-colors">
                            <div>
                                <div className="text-xs text-white font-bold">{h.text}</div>
                                <div className={`text-[10px] font-mono mt-1 ${h.result === 'WIN' ? 'text-acid-green' : 'text-gray-500'}`}>{h.result}</div>
                            </div>
                            <div className={`font-mono text-sm font-bold ${h.amount.startsWith('+') ? 'text-acid-green' : 'text-alert-red'}`}>
                                {h.amount}
                            </div>
                        </div>
                    ))}
                 </div>
            </div>
        </div>
    </div>
  );
};

export default Profile;