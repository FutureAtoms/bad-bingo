import React, { useState } from 'react';

interface WalkthroughTutorialProps {
  onComplete: () => void;
}

const WalkthroughTutorial: React.FC<WalkthroughTutorialProps> = ({ onComplete }) => {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: "Welcome, stray.",
      icon: "fa-cat",
      color: "text-acid-green",
      content: (
        <div className="space-y-4">
          <p className="text-lg">You've wandered into <span className="text-acid-green font-bold">Bad Bingo's</span> den.</p>
          <p>A place where friendships are tested, bingos are won and lost, and nobody leaves without some emotional damage.</p>
          <div className="bg-black/50 p-4 rounded-lg mt-6">
            <p className="text-gray-400 text-sm italic">"I've seen a thousand strays like you. Most don't last a week. Prove me wrong."</p>
            <p className="text-right text-acid-green text-xs mt-2">- Bad Bingo</p>
          </div>
        </div>
      ),
    },
    {
      title: "Bingo is everything.",
      icon: "fa-cat",
      color: "text-acid-green",
      content: (
        <div className="space-y-4">
          <div className="text-center">
            <span className="text-6xl">🐱</span>
            <div className="text-3xl font-black text-acid-green mt-2">100 BINGOS</div>
            <p className="text-gray-400 text-sm">Your starting stash</p>
          </div>
          <p>Bingo is the currency here. You'll use it to bet against friends.</p>
          <div className="bg-black/50 p-4 rounded-lg">
            <p className="text-sm"><span className="text-acid-green">Win a bet:</span> Take their bingos</p>
            <p className="text-sm mt-1"><span className="text-alert-red">Lose a bet:</span> They take yours</p>
            <p className="text-sm mt-1"><span className="text-hot-pink">Run out:</span> Beg, Borrow, or Steal</p>
          </div>
          <p className="text-sm text-gray-400">Every bet = your bingos / 50 (minimum 2)</p>
        </div>
      ),
    },
    {
      title: "The Swipe Feed",
      icon: "fa-hand-pointer",
      color: "text-hot-pink",
      content: (
        <div className="space-y-4">
          <p>Your main battlefield. Bets appear like Tinder cards.</p>
          <div className="flex justify-around my-6">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-alert-red/20 flex items-center justify-center mx-auto">
                <i className="fas fa-times text-2xl text-alert-red"></i>
              </div>
              <div className="text-alert-red font-bold mt-2">LEFT</div>
              <div className="text-xs text-gray-500">"Won't happen"</div>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-acid-green/20 flex items-center justify-center mx-auto">
                <i className="fas fa-check text-2xl text-acid-green"></i>
              </div>
              <div className="text-acid-green font-bold mt-2">RIGHT</div>
              <div className="text-xs text-gray-500">"I'd bet on it"</div>
            </div>
          </div>
          <div className="bg-hot-pink/20 p-4 rounded-lg border border-hot-pink/30">
            <p className="text-hot-pink font-bold">CLASH!</p>
            <p className="text-sm">When you and your friend swipe opposite = bet is ON.</p>
          </div>
        </div>
      ),
    },
    {
      title: "Add your Pride",
      icon: "fa-users",
      color: "text-cyan-glitch",
      content: (
        <div className="space-y-4">
          <p>Can't bet alone. Add friends to your "pride".</p>
          <p>When adding, choose the <span className="font-bold">intensity level</span>:</p>
          <div className="space-y-3 mt-4">
            <div className="flex items-center gap-3 bg-black/50 p-3 rounded">
              <span className="text-2xl">❄️</span>
              <div>
                <span className="text-blue-400 font-bold">DECLAWED</span>
                <span className="text-xs text-gray-400 ml-2">Safe bets</span>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-black/50 p-3 rounded">
              <span className="text-2xl">🔥</span>
              <div>
                <span className="text-orange-400 font-bold">FAIR GAME</span>
                <span className="text-xs text-gray-400 ml-2">Embarrassing bets</span>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-black/50 p-3 rounded">
              <span className="text-2xl">☢️</span>
              <div>
                <span className="text-alert-red font-bold">NO MERCY</span>
                <span className="text-xs text-gray-400 ml-2">Maximum chaos</span>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Prove it or lose it.",
      icon: "fa-camera",
      color: "text-hot-pink",
      content: (
        <div className="space-y-4">
          <p>Won a bet? You need <span className="font-bold">evidence</span>.</p>
          <div className="bg-black/50 p-4 rounded-lg space-y-3">
            <div className="flex items-center gap-3">
              <i className="fas fa-camera text-acid-green"></i>
              <span className="text-sm">Photos taken IN-APP only</span>
            </div>
            <div className="flex items-center gap-3">
              <i className="fas fa-clock text-hot-pink"></i>
              <span className="text-sm">Set timer: 1h, 6h, or 12h</span>
            </div>
            <div className="flex items-center gap-3">
              <i className="fas fa-fire-alt text-alert-red"></i>
              <span className="text-sm">View-once mode (Level 3 only)</span>
            </div>
          </div>
          <p className="text-sm text-gray-400">No proof = no win. Simple as that.</p>
        </div>
      ),
    },
    {
      title: "When you're broke...",
      icon: "fa-coins",
      color: "text-alert-red",
      content: (
        <div className="space-y-4">
          <p>Out of bingos? Three options:</p>
          <div className="space-y-3">
            <div className="bg-cyan-glitch/10 p-4 rounded-lg border border-cyan-glitch/30">
              <div className="flex items-center gap-2 mb-2">
                <i className="fas fa-hands-praying text-cyan-glitch"></i>
                <span className="text-cyan-glitch font-bold">BEG</span>
              </div>
              <p className="text-sm text-gray-300">Do embarrassing tasks for bingos.</p>
            </div>
            <div className="bg-hot-pink/10 p-4 rounded-lg border border-hot-pink/30">
              <div className="flex items-center gap-2 mb-2">
                <i className="fas fa-handshake text-hot-pink"></i>
                <span className="text-hot-pink font-bold">BORROW</span>
              </div>
              <p className="text-sm text-gray-300">Take a loan. Interest compounds daily.</p>
            </div>
            <div className="bg-alert-red/10 p-4 rounded-lg border border-alert-red/30">
              <div className="flex items-center gap-2 mb-2">
                <i className="fas fa-mask text-alert-red"></i>
                <span className="text-alert-red font-bold">STEAL</span>
              </div>
              <p className="text-sm text-gray-300">Rob friends. 60 seconds. Don't get caught.</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "The Steal Game",
      icon: "fa-mask",
      color: "text-alert-red",
      content: (
        <div className="space-y-4">
          <p>The most dangerous way to get bingos.</p>
          <div className="bg-black/50 p-4 rounded-lg space-y-4">
            <div>
              <span className="text-acid-green font-bold">60 seconds</span>
              <p className="text-sm text-gray-400">to tap and steal 1-50% of their stash</p>
            </div>
            <div>
              <span className="text-hot-pink font-bold">BUT...</span>
              <p className="text-sm text-gray-400">They get a 16-second warning!</p>
            </div>
            <div className="border-t border-gray-700 pt-4">
              <span className="text-alert-red font-bold">CAUGHT?</span>
              <p className="text-sm text-gray-400">You pay DOUBLE what you tried to steal.</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 italic text-center mt-4">High risk. High reward. Classic Bad Bingo.</p>
        </div>
      ),
    },
    {
      title: "Ready to cause chaos?",
      icon: "fa-cat",
      color: "text-acid-green",
      content: (
        <div className="space-y-4 text-center">
          <span className="text-8xl">😼</span>
          <p className="text-lg">You know the rules.</p>
          <p className="text-gray-400">Time to ruin some friendships.</p>
          <div className="bg-acid-green/10 p-4 rounded-lg border border-acid-green/30 mt-6">
            <p className="text-acid-green font-bold">First mission:</p>
            <p className="text-sm text-gray-300 mt-1">Add your first friend and make your first bet.</p>
          </div>
          <p className="text-xs text-gray-500 mt-6">You can revisit these rules anytime from your profile.</p>
        </div>
      ),
    },
  ];

  const currentStep = steps[step];
  const isLastStep = step === steps.length - 1;

  return (
    <div className="h-full bg-bingo-black flex flex-col">
      {/* Progress */}
      <div className="p-4 pt-[env(safe-area-inset-top)]">
        <div className="flex gap-1">
          {steps.map((_, idx) => (
            <div
              key={idx}
              className={`h-1 flex-1 rounded-full transition-colors ${
                idx <= step ? 'bg-acid-green' : 'bg-gray-800'
              }`}
            />
          ))}
        </div>
        <div className="flex justify-between items-center mt-4">
          <span className="text-xs text-gray-500">{step + 1} / {steps.length}</span>
          {!isLastStep && (
            <button
              onClick={onComplete}
              className="text-xs text-gray-500 hover:text-white"
            >
              Skip tutorial
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col px-6 pb-6">
        <div className="text-center mb-6">
          <div className={`w-20 h-20 rounded-full ${currentStep.color.replace('text-', 'bg-')}/20 flex items-center justify-center mx-auto mb-4`}>
            <i className={`fas ${currentStep.icon} text-3xl ${currentStep.color}`}></i>
          </div>
          <h1 className="text-2xl font-black text-white">{currentStep.title}</h1>
        </div>

        <div className="flex-1 text-gray-200">
          {currentStep.content}
        </div>

        {/* Navigation */}
        <div className="flex gap-3 mt-6">
          {step > 0 && (
            <button
              onClick={() => setStep(step - 1)}
              className="flex-1 py-4 bg-gray-800 text-white font-bold rounded-lg uppercase tracking-widest"
            >
              Back
            </button>
          )}
          <button
            onClick={() => isLastStep ? onComplete() : setStep(step + 1)}
            className="flex-1 py-4 bg-acid-green text-black font-bold rounded-lg uppercase tracking-widest"
          >
            {isLastStep ? "Let's Go!" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WalkthroughTutorial;
