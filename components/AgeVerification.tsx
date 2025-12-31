import React, { useState } from 'react';

interface AgeVerificationProps {
  onVerified: () => void;
}

const AgeVerification: React.FC<AgeVerificationProps> = ({ onVerified }) => {
  const [showUnderageMessage, setShowUnderageMessage] = useState(false);

  const handleConfirmAdult = () => {
    localStorage.setItem('bingo_age_verified', 'true');
    onVerified();
  };

  const handleConfirmUnderage = () => {
    setShowUnderageMessage(true);
  };

  if (showUnderageMessage) {
    return (
      <div className="h-full flex flex-col bg-bingo-black overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, #ff0000 10px, #ff0000 11px)`,
          }} />
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-8 relative z-10">
          <div className="text-center max-w-sm">
            <div className="text-6xl mb-6">
              <i className="fas fa-ban text-alert-red"></i>
            </div>
            <h1 className="text-3xl font-black text-alert-red uppercase tracking-tight mb-4">
              ACCESS DENIED
            </h1>
            <p className="text-gray-400 text-sm leading-relaxed mb-6">
              Bad Bingo is for adults only (18+).
              <br />
              <br />
              Come back when you've leveled up in life.
              <br />
              Until then, go do your homework.
            </p>
            <div className="text-6xl mb-4 opacity-50">
              <i className="fas fa-cat"></i>
            </div>
            <p className="text-gray-600 text-xs italic">
              "Not today, kitten."
              <br />
              - Bad Bingo
            </p>
          </div>
        </div>

        {/* Bottom decoration */}
        <div className="h-1 bg-alert-red" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-bingo-black overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, #ccff00 10px, #ccff00 11px)`,
        }} />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-8 relative z-10">
        {/* Warning Icon */}
        <div className="mb-8 text-center">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-hot-pink to-alert-red flex items-center justify-center mb-4 mx-auto shadow-[0_0_40px_rgba(255,0,153,0.4)]">
            <i className="fas fa-exclamation-triangle text-4xl text-white"></i>
          </div>
          <h1 className="text-3xl font-black text-white uppercase tracking-tight">
            AGE VERIFICATION
          </h1>
          <p className="text-gray-500 text-sm mt-2 italic">
            "This ain't Club Penguin."
          </p>
        </div>

        {/* Warning Box */}
        <div className="mb-8 p-6 bg-gray-900/80 border border-hot-pink/30 rounded-xl max-w-sm">
          <div className="flex items-start gap-3 mb-4">
            <i className="fas fa-shield-alt text-hot-pink text-xl mt-0.5"></i>
            <div>
              <h2 className="text-white font-bold text-lg">18+ Only</h2>
              <p className="text-gray-400 text-sm mt-1">
                Bad Bingo contains mature themes, social betting mechanics, and adult humor.
                This app is designed for adults who want to have fun with their friends.
              </p>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-4 mt-4">
            <p className="text-xs text-gray-500">
              <i className="fas fa-info-circle mr-2"></i>
              No real money is involved. This is a social game with virtual currency only.
            </p>
          </div>
        </div>

        {/* The Question */}
        <div className="text-center mb-6">
          <p className="text-white text-lg font-bold">
            Are you 18 years or older?
          </p>
        </div>

        {/* Buttons */}
        <div className="w-full max-w-sm space-y-3">
          <button
            onClick={handleConfirmAdult}
            className="w-full bg-acid-green text-black font-black py-4 px-6 rounded-xl uppercase tracking-wider text-lg shadow-[0_0_20px_rgba(204,255,0,0.3)] hover:bg-acid-green/90 active:scale-[0.98] transition-all"
          >
            <i className="fas fa-check mr-2"></i>
            Yes, I'm 18+
          </button>
          <button
            onClick={handleConfirmUnderage}
            className="w-full bg-gray-800 text-gray-400 font-bold py-4 px-6 rounded-xl uppercase tracking-wider hover:bg-gray-700 active:scale-[0.98] transition-all"
          >
            <i className="fas fa-times mr-2"></i>
            No, I'm Under 18
          </button>
        </div>

        {/* Cat mascot */}
        <div className="mt-10 text-center">
          <div className="text-5xl mb-2">
            <span className="inline-block animate-bounce">
              <i className="fas fa-cat text-acid-green"></i>
            </span>
          </div>
          <p className="text-gray-600 text-xs">
            Bad Bingo is watching...
          </p>
        </div>
      </div>

      {/* Bottom decoration */}
      <div className="h-1 bg-gradient-to-r from-acid-green via-hot-pink to-cyan-glitch" />
    </div>
  );
};

export default AgeVerification;
