import React, { useState, useEffect, useRef } from 'react';
import { generateRiskProfile } from '../services/geminiService';
import { UserProfile, ChatMessage } from '../types';

interface OnboardingProps {
  onComplete: (profile: UserProfile) => void;
}

const QUESTIONS = [
  "PROTOCOL INIT: KNOW YOURSELF.\nState your **Player Tag** (Name):",
  "Calibrating Odds...\nWhat are your **Stats** (Age & Gender)?",
  "Defining Territory...\nWhere is your **Base**? (Bedroom, Office, Gym, Mom's Basement)",
  "Identifying Weakness...\nWhat is your **Vice**? (Caffeine, Gacha, Validation, Naps)",
  "Financial Audit...\nWho funds your addiction? (Job, Parents, Crypto, Luck)",
  "Relationship Audit...\nWhat is your **Status**? (Single, Taken, It's Complicated, Married to the Game)",
  "Psych Analysis...\nWhat triggers your **Rage**? (Slow Wifi, Loud Chewers, Lag, Being left on read)",
  "Routine Check...\nHow do you **Waste Time**? (Doomscrolling, Party, Rotting in Bed, Gaming)",
  "Truth Serum...\nWhat is your most frequent **Lie**? ('On my way', 'I'm fine', 'Just one more game', Height)"
];

const SUGGESTIONS = [
  [], 
  ["Lvl 18 Male", "Lvl 21 Female", "Lvl 25 NB", "Lvl 30 Male", "Lvl 99 Elder"],
  ["Bedroom", "The Office", "Gym", "Streets", "Mom's House"],
  ["Coffee", "Doomscrolling", "Fast Food", "Video Games", "Validation"],
  ["9-to-5", "The 'Parents' VC", "Crypto", "Student Loans", "Hustle"],
  ["Single", "Taken", "Complicated", "Married to Work", "Situationship"],
  ["Slow Wifi", "Loud Chewers", "Being Ignored", "Losing", "People"],
  ["Doomscrolling", "Rotting in Bed", "Gaming", "Partying", "Working"],
  ["I'm on my way", "I'm fine", "Just one more game", "My Height", "I read the T&C"]
];

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [answers, setAnswers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (step === 0 && messages.length === 0) {
      setTimeout(() => {
        addMessage('ai', "BAD BINGO SYSTEM ONLINE.\nBefore you bet, I need to know if you're worth the bandwidth.");
        setTimeout(() => addMessage('ai', QUESTIONS[0]), 1000);
      }, 500);
    }
  }, [step, messages.length]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = (sender: 'ai' | 'user', text: string) => {
    setMessages(prev => [...prev, { sender, text }]);
  };

  const processAnswer = async (answerText: string) => {
    if (!answerText.trim()) return;

    addMessage('user', answerText);
    setInput('');
    
    const newAnswers = [...answers, answerText];
    setAnswers(newAnswers);

    if (step < QUESTIONS.length - 1) {
      setLoading(true);
      setTimeout(() => {
        setStep(prev => prev + 1);
        addMessage('ai', QUESTIONS[step + 1]);
        setLoading(false);
      }, 800);
    } else {
      setLoading(true);
      addMessage('ai', "PROCESSING EXTENDED DATASET...");
      
      const profileDesc = await generateRiskProfile(newAnswers);
      
      const newProfile: UserProfile = {
        id: 'user-1',
        name: newAnswers[0],
        age: newAnswers[1].split(' ')[0], 
        gender: newAnswers[1],
        coins: 100, 
        riskProfile: profileDesc,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${newAnswers[0]}&backgroundColor=b6e3f4`,
        socialDebt: 0
      };
      
      addMessage('ai', `ANALYSIS COMPLETE: ${profileDesc}`);
      setTimeout(() => {
        onComplete(newProfile);
      }, 3000);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processAnswer(input);
  };

  return (
    <div className="flex flex-col h-full bg-bingo-black p-4 font-mono">
      <div className="flex-1 overflow-y-auto mb-4 space-y-4">
        <div className="text-center mb-8 opacity-50">
          <i className="fas fa-cat text-4xl text-acid-green animate-pulse"></i>
          <h1 className="text-xl font-bold tracking-widest mt-2 uppercase text-acid-green">Know Yourself</h1>
        </div>
        
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-3 rounded-lg border border-opacity-50 whitespace-pre-wrap ${
              msg.sender === 'user' 
                ? 'bg-bingo-dark border-hot-pink text-hot-pink rounded-tr-none' 
                : 'bg-bingo-dark border-acid-green text-acid-green rounded-tl-none shadow-[0_0_10px_rgba(204,255,0,0.1)]'
            }`}>
              <span dangerouslySetInnerHTML={{ __html: msg.text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') }} />
            </div>
          </div>
        ))}
        {loading && <div className="text-acid-green animate-pulse text-xs uppercase tracking-widest">Bad Bingo is judging you...</div>}
        <div ref={chatEndRef} />
      </div>

      {!loading && SUGGESTIONS[step] && SUGGESTIONS[step].length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 justify-end">
          {SUGGESTIONS[step].map((s, i) => (
            <button
              key={i}
              onClick={() => processAnswer(s)}
              className="px-3 py-1 bg-gray-900 border border-cyan-glitch/50 text-cyan-glitch text-xs rounded hover:bg-cyan-glitch hover:text-black transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Answer protocol..."
          className="flex-1 bg-bingo-dark border border-gray-700 text-white p-3 rounded focus:outline-none focus:border-acid-green uppercase text-sm"
          autoFocus
        />
        <button type="submit" className="bg-acid-green text-black font-bold p-3 rounded hover:bg-white transition-colors">
          <i className="fas fa-paper-plane"></i>
        </button>
      </form>
    </div>
  );
};

export default Onboarding;