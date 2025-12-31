import React, { useState } from 'react';

interface RulesProps {
  onClose: () => void;
}

const Rules: React.FC<RulesProps> = ({ onClose }) => {
  const [activeSection, setActiveSection] = useState<string>('basics');

  const sections = [
    { id: 'basics', icon: 'fa-cat', label: 'Basics' },
    { id: 'swipe', icon: 'fa-hand-pointer', label: 'Swipe' },
    { id: 'friends', icon: 'fa-users', label: 'Friends' },
    { id: 'bbs', icon: 'fa-coins', label: 'BBS' },
    { id: 'proof', icon: 'fa-camera', label: 'Proof' },
  ];

  return (
    <div className="h-full bg-bingo-black flex flex-col">
      {/* Header */}
      <div className="pt-[env(safe-area-inset-top)] bg-black/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="p-4 flex justify-between items-center">
          <button
            onClick={onClose}
            className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-white active:text-acid-green transition-colors -ml-2 rounded-full"
          >
            <i className="fas fa-arrow-left text-2xl"></i>
          </button>
          <div className="text-acid-green font-mono text-sm tracking-widest uppercase">House Rules</div>
          <div className="w-12"></div>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="flex overflow-x-auto gap-2 px-4 py-3 border-b border-gray-800">
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-all ${
              activeSection === section.id
                ? 'bg-acid-green text-black font-bold'
                : 'bg-gray-800 text-gray-400'
            }`}
          >
            <i className={`fas ${section.icon} text-sm`}></i>
            <span className="text-xs uppercase">{section.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeSection === 'basics' && <BasicsSection />}
        {activeSection === 'swipe' && <SwipeSection />}
        {activeSection === 'friends' && <FriendsSection />}
        {activeSection === 'bbs' && <BBSSection />}
        {activeSection === 'proof' && <ProofSection />}
      </div>
    </div>
  );
};

const BasicsSection: React.FC = () => (
  <div className="space-y-6">
    <div className="text-center mb-8">
      <span className="text-6xl">😼</span>
      <h2 className="text-2xl font-black text-white mt-4">Welcome to Bad Bingo</h2>
      <p className="text-gray-400 text-sm mt-2">The social betting game for degenerates</p>
    </div>

    <RuleCard
      icon="fa-coins"
      title="Bingo is Currency"
      color="text-acid-green"
    >
      <p>Everyone starts with <span className="text-acid-green font-bold">100 bingos</span>.</p>
      <p className="mt-2">You earn more bingos by:</p>
      <ul className="mt-2 space-y-1 text-sm">
        <li>- Winning bets against friends</li>
        <li>- Daily login bonuses (streaks = more bingos)</li>
        <li>- Successfully stealing from friends</li>
        <li>- Begging (do embarrassing tasks)</li>
      </ul>
    </RuleCard>

    <RuleCard
      icon="fa-fire"
      title="The Goal"
      color="text-hot-pink"
    >
      <p>Bet on predictions about your friends. When you disagree, bingos get locked in.</p>
      <p className="mt-2">Prove you were right with photo/video evidence.</p>
      <p className="mt-2">Winner takes all. Loser... well, that's their problem.</p>
    </RuleCard>

    <RuleCard
      icon="fa-calculator"
      title="Default Bet Amount"
      color="text-cyan-glitch"
    >
      <p>Every bet stakes <span className="font-bold">your bingos / 50</span> by default.</p>
      <p className="mt-2">If you have 100 bingos, you bet 2 bingos minimum.</p>
      <p className="mt-2">You can always bet more (up to your entire stash).</p>
    </RuleCard>
  </div>
);

const SwipeSection: React.FC = () => (
  <div className="space-y-6">
    <div className="text-center mb-8">
      <div className="text-6xl">👆</div>
      <h2 className="text-2xl font-black text-white mt-4">The Swipe Feed</h2>
      <p className="text-gray-400 text-sm mt-2">Tinder for bets</p>
    </div>

    <RuleCard
      icon="fa-arrows-left-right"
      title="How to Swipe"
      color="text-acid-green"
    >
      <div className="flex justify-around my-4">
        <div className="text-center">
          <div className="text-alert-red font-black text-2xl">← LEFT</div>
          <div className="text-xs text-gray-500">"Nah, won't happen"</div>
        </div>
        <div className="text-center">
          <div className="text-acid-green font-black text-2xl">RIGHT →</div>
          <div className="text-xs text-gray-500">"Yeah, I'd bet on it"</div>
        </div>
      </div>
    </RuleCard>

    <RuleCard
      icon="fa-bolt"
      title="When Bets Lock"
      color="text-hot-pink"
    >
      <p>Both you AND your friend swipe on the same bet.</p>
      <p className="mt-2 text-acid-green font-bold">If you disagree = CLASH!</p>
      <p className="text-sm text-gray-400">Bingos get locked. One of you has to prove it.</p>
      <p className="mt-2 text-gray-500">If you agree = boring. Move on.</p>
    </RuleCard>

    <RuleCard
      icon="fa-bell"
      title="Daily Bets"
      color="text-cyan-glitch"
    >
      <p>Every day, <span className="font-bold">5 random bets</span> are generated for each friend.</p>
      <p className="mt-2">Bets are personalized based on:</p>
      <ul className="mt-2 space-y-1 text-sm">
        <li>- Your profile info (age, job, pets, etc.)</li>
        <li>- Your friend's intensity level</li>
        <li>- Your risk profile</li>
      </ul>
    </RuleCard>

    <RuleCard
      icon="fa-plus"
      title="Create Your Own"
      color="text-acid-green"
    >
      <p>Make custom bets about your friends!</p>
      <p className="mt-2 text-sm text-gray-400">Send to one friend, a group, or everyone in your pride.</p>
      <p className="mt-2 text-sm text-gray-400">Coming soon...</p>
    </RuleCard>
  </div>
);

const FriendsSection: React.FC = () => (
  <div className="space-y-6">
    <div className="text-center mb-8">
      <div className="text-6xl">👥</div>
      <h2 className="text-2xl font-black text-white mt-4">Your Pride</h2>
      <p className="text-gray-400 text-sm mt-2">Friends with consequences</p>
    </div>

    <RuleCard
      icon="fa-user-plus"
      title="Adding Friends"
      color="text-cyan-glitch"
    >
      <p>When you add someone, we ask about your relationship.</p>
      <p className="mt-2 text-sm text-gray-400">This determines the intensity of bets you can make.</p>
    </RuleCard>

    <div className="space-y-3">
      <h3 className="text-sm text-gray-500 uppercase tracking-widest">Intensity Levels</h3>

      <div className="bg-bingo-dark p-4 rounded-lg border border-blue-400/30">
        <div className="flex items-center gap-3">
          <span className="text-2xl">❄️</span>
          <div>
            <div className="text-blue-400 font-bold">DECLAWED (Level 1)</div>
            <div className="text-xs text-gray-400">Coworkers, acquaintances, mom</div>
          </div>
        </div>
        <p className="text-sm text-gray-300 mt-3">Safe bets only. Nothing embarrassing.</p>
        <p className="text-xs text-gray-500 mt-1">"I bet you'll be late to the meeting"</p>
      </div>

      <div className="bg-bingo-dark p-4 rounded-lg border border-orange-400/30">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🔥</span>
          <div>
            <div className="text-orange-400 font-bold">FAIR GAME (Level 2)</div>
            <div className="text-xs text-gray-400">Close friends, siblings</div>
          </div>
        </div>
        <p className="text-sm text-gray-300 mt-3">Embarrassing bets unlocked. Video proof allowed.</p>
        <p className="text-xs text-gray-500 mt-1">"I bet you can't go a day without checking Instagram"</p>
      </div>

      <div className="bg-bingo-dark p-4 rounded-lg border border-alert-red/30">
        <div className="flex items-center gap-3">
          <span className="text-2xl">☢️</span>
          <div>
            <div className="text-alert-red font-bold">NO MERCY (Level 3)</div>
            <div className="text-xs text-gray-400">Best friends, partners, ride-or-dies</div>
          </div>
        </div>
        <p className="text-sm text-gray-300 mt-3">Location bets. Secret bets. View-once proof. Maximum chaos.</p>
        <p className="text-xs text-gray-500 mt-1">"I bet you're not wearing pants right now"</p>
      </div>
    </div>
  </div>
);

const BBSSection: React.FC = () => (
  <div className="space-y-6">
    <div className="text-center mb-8">
      <div className="text-6xl">💰</div>
      <h2 className="text-2xl font-black text-white mt-4">Beg, Borrow, Steal</h2>
      <p className="text-gray-400 text-sm mt-2">When you're broke but desperate</p>
    </div>

    <RuleCard
      icon="fa-hands-praying"
      title="BEG"
      color="text-cyan-glitch"
    >
      <p>Out of bingos? Grovel for it.</p>
      <p className="mt-2">Your friend sets an <span className="font-bold">embarrassing task</span>.</p>
      <p className="mt-2 text-sm text-gray-400">Complete it (with proof) to earn bingos.</p>
      <p className="mt-2 text-xs text-gray-500 italic">"Send a voice message singing happy birthday to me"</p>
    </RuleCard>

    <RuleCard
      icon="fa-handshake"
      title="BORROW"
      color="text-hot-pink"
    >
      <p>Take a loan from a friend. With <span className="text-alert-red font-bold">interest</span>.</p>
      <div className="mt-3 bg-black/50 p-3 rounded text-sm">
        <p>Interest compounds daily at the same time.</p>
        <p className="mt-2 text-alert-red">If interest exceeds principal = they take EVERYTHING you have.</p>
      </div>
      <p className="mt-3 text-xs text-gray-500">Debt is just future you's problem, right?</p>
    </RuleCard>

    <RuleCard
      icon="fa-mask"
      title="STEAL"
      color="text-alert-red"
    >
      <p>Rob your friends' bingo stash!</p>

      <div className="mt-4 space-y-3">
        <div className="bg-black/50 p-3 rounded">
          <div className="text-xs text-gray-500 uppercase">Step 1</div>
          <p className="text-sm">Random notification: "Steal window open!"</p>
        </div>

        <div className="bg-black/50 p-3 rounded">
          <div className="text-xs text-gray-500 uppercase">Step 2</div>
          <p className="text-sm">You get <span className="text-acid-green font-bold">60 seconds</span> to tap-spam and steal.</p>
          <p className="text-xs text-gray-400 mt-1">Steal 1-50% of their stash based on luck.</p>
        </div>

        <div className="bg-black/50 p-3 rounded border border-alert-red/30">
          <div className="text-xs text-alert-red uppercase">BUT...</div>
          <p className="text-sm">Your target gets a <span className="text-hot-pink font-bold">16-second warning</span>!</p>
          <p className="text-xs text-gray-400 mt-1">If they tap "BLOCK" in time, you get CAUGHT.</p>
        </div>

        <div className="bg-alert-red/20 p-3 rounded border border-alert-red">
          <div className="text-alert-red font-bold">CAUGHT = DOUBLE PENALTY</div>
          <p className="text-sm text-gray-300 mt-1">You lose 2x whatever you tried to steal.</p>
        </div>
      </div>
    </RuleCard>
  </div>
);

const ProofSection: React.FC = () => (
  <div className="space-y-6">
    <div className="text-center mb-8">
      <div className="text-6xl">📸</div>
      <h2 className="text-2xl font-black text-white mt-4">Proof System</h2>
      <p className="text-gray-400 text-sm mt-2">No proof = no win</p>
    </div>

    <RuleCard
      icon="fa-camera"
      title="Native Camera Only"
      color="text-acid-green"
    >
      <p>All proof must be captured <span className="font-bold">in-app</span>.</p>
      <p className="mt-2 text-sm text-gray-400">No gallery uploads. No screenshots. Just real-time evidence.</p>
    </RuleCard>

    <RuleCard
      icon="fa-clock"
      title="Proof Timer"
      color="text-hot-pink"
    >
      <p>You set how long proof stays visible:</p>
      <div className="flex gap-3 mt-3">
        <span className="bg-gray-800 px-3 py-1 rounded text-sm">1 hour</span>
        <span className="bg-gray-800 px-3 py-1 rounded text-sm">6 hours</span>
        <span className="bg-gray-800 px-3 py-1 rounded text-sm">12 hours</span>
      </div>
      <p className="mt-3 text-sm text-gray-400">After they view it + timer expires = gone forever.</p>
    </RuleCard>

    <RuleCard
      icon="fa-fire-alt"
      title="View Once (Level 3 only)"
      color="text-alert-red"
    >
      <p>For NO MERCY friends only.</p>
      <p className="mt-2 text-sm text-gray-400">Proof disappears after ONE view. No replays. No screenshots.</p>
      <p className="mt-2 text-xs text-gray-500 italic">Perfect for spicy bets.</p>
    </RuleCard>

    <RuleCard
      icon="fa-gavel"
      title="Disputes"
      color="text-cyan-glitch"
    >
      <p>Can't prove it with a photo? Both parties vote.</p>
      <p className="mt-2 text-sm text-gray-400">If you both disagree on who won, the bet is voided.</p>
      <p className="mt-2 text-sm text-gray-400">Bingos return to both players.</p>
    </RuleCard>
  </div>
);

interface RuleCardProps {
  icon: string;
  title: string;
  color: string;
  children: React.ReactNode;
}

const RuleCard: React.FC<RuleCardProps> = ({ icon, title, color, children }) => (
  <div className="bg-bingo-dark p-4 rounded-lg border border-gray-800">
    <div className="flex items-center gap-3 mb-3">
      <i className={`fas ${icon} ${color} text-xl`}></i>
      <h3 className="font-bold text-white">{title}</h3>
    </div>
    <div className="text-sm text-gray-300">{children}</div>
  </div>
);

export default Rules;
