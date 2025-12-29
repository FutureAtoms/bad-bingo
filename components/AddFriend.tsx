import React, { useState } from 'react';
import { Friend, RelationshipLevel } from '../types';

interface AddFriendProps {
  onClose: () => void;
  onAdd: (friend: Friend) => void;
}

const AddFriend: React.FC<AddFriendProps> = ({ onClose, onAdd }) => {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<Friend | null>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setSearching(true);
    setResult(null);

    // Mock search delay
    setTimeout(() => {
      setSearching(false);
      // Mock result generation
      setResult({
        id: `new-${Date.now()}`,
        name: query,
        relationshipLevel: RelationshipLevel.CIVILIAN, // Default to civilian
        status: 'online',
        friendshipStatus: 'pending_sent', // Needs approval
        coins: 100,
        avatarUrl: `https://picsum.photos/seed/${query}/100`
      });
    }, 1500);
  };

  const handleAddClick = () => {
    if (result) {
      onAdd(result);
    }
  };

  return (
    <div className="h-full bg-bingo-black flex flex-col p-4 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
        <i className="fas fa-satellite-dish text-9xl text-cyan-glitch"></i>
      </div>

      <div className="flex justify-between items-center mb-8 z-10">
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <i className="fas fa-arrow-left text-xl"></i>
        </button>
        <h2 className="text-cyan-glitch font-bold text-xl tracking-widest uppercase">FIND STRAY</h2>
        <div className="w-6"></div>
      </div>

      <div className="flex-1 z-10">
        <form onSubmit={handleSearch} className="mb-8">
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ENTER NAME..."
              className="w-full bg-black border border-gray-700 text-white p-4 rounded-lg focus:outline-none focus:border-cyan-glitch font-mono uppercase placeholder-gray-600"
              autoFocus
            />
            <button 
              type="submit"
              className="absolute right-2 top-2 bottom-2 bg-gray-900 text-cyan-glitch px-4 rounded border border-gray-700 hover:border-cyan-glitch transition-all"
            >
              <i className="fas fa-search"></i>
            </button>
          </div>
        </form>

        {searching && (
          <div className="text-center py-12">
            <div className="inline-block relative w-16 h-16 mb-4">
              <div className="absolute inset-0 border-4 border-gray-800 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-cyan-glitch border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="text-cyan-glitch animate-pulse font-mono text-sm">SNIFFING FOR MATCHES...</p>
          </div>
        )}

        {result && !searching && (
          <div className="bg-bingo-dark border border-cyan-glitch p-6 rounded-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-4 mb-6">
              <img src={result.avatarUrl} alt={result.name} className="w-16 h-16 rounded-full border-2 border-white" />
              <div>
                <h3 className="text-xl font-bold text-white">{result.name}</h3>
                <p className="text-gray-400 text-xs uppercase">Status: <span className="text-acid-green">Active</span></p>
                <p className="text-gray-400 text-xs uppercase">Risk Level: <span className="text-alert-red">Unknown</span></p>
              </div>
            </div>

            <div className="mb-6">
              <label className="text-xs text-gray-500 block mb-2 uppercase">Set Initial Bet Level</label>
              <div className="grid grid-cols-3 gap-2">
                <button 
                  type="button"
                  onClick={() => setResult({...result, relationshipLevel: RelationshipLevel.CIVILIAN})}
                  className={`p-2 rounded border text-xs font-bold transition-all ${result.relationshipLevel === RelationshipLevel.CIVILIAN ? 'bg-blue-900/50 border-blue-400 text-blue-400' : 'bg-black border-gray-800 text-gray-600'}`}
                >
                  CIVILIAN
                </button>
                <button 
                  type="button"
                  onClick={() => setResult({...result, relationshipLevel: RelationshipLevel.ROAST})}
                  className={`p-2 rounded border text-xs font-bold transition-all ${result.relationshipLevel === RelationshipLevel.ROAST ? 'bg-orange-900/50 border-orange-400 text-orange-400' : 'bg-black border-gray-800 text-gray-600'}`}
                >
                  ROAST
                </button>
                <button 
                  type="button"
                  onClick={() => setResult({...result, relationshipLevel: RelationshipLevel.NUCLEAR})}
                  className={`p-2 rounded border text-xs font-bold transition-all ${result.relationshipLevel === RelationshipLevel.NUCLEAR ? 'bg-red-900/50 border-alert-red text-alert-red' : 'bg-black border-gray-800 text-gray-600'}`}
                >
                  NUCLEAR
                </button>
              </div>
            </div>

            <button 
              onClick={handleAddClick}
              className="w-full bg-cyan-glitch text-black font-bold py-4 rounded-lg hover:bg-white hover:scale-[1.02] transition-all shadow-[0_0_15px_rgba(0,255,255,0.3)]"
            >
              SEND INVITE
            </button>
          </div>
        )}

        {!searching && !result && !query && (
           <div className="text-center py-12 opacity-30">
               <i className="fas fa-user-plus text-6xl mb-4 text-gray-600"></i>
               <p className="text-sm font-mono">SEARCH FOR NEW STRAYS</p>
           </div>
        )}
      </div>
    </div>
  );
};

export default AddFriend;