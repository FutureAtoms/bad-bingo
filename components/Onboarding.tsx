import React, { useState, useEffect, useRef } from 'react';
import { generateRiskProfile } from '../services/geminiService';
import { UserProfile, ChatMessage } from '../types';

interface OnboardingProps {
  onComplete: (profile: UserProfile) => void;
}

const QUESTIONS = [
  "I can't just call you 'Stray'. What is your **Name**?",
  "For the records... What are your **Stats** (Age & Gender)?",
  "Where is your **Territory**? (Bedroom, Office, Gym, Street)",
  "What is your **Vice**? (What are you addicted to?)",
  "Who fills your bowl? **Source of Income**:"
];

const SUGGESTIONS = [
  [], 
  ["18 Male", "21 Female", "25 NB", "30 Male", "99 Cyber-Cat"],
  ["Bedroom", "Office Cube", "Gym", "The Streets", "Mom's House"],
  ["Coffee", "Video Games", "TikTok", "Fast Food", "Naps"],
  ["9-to-5 Job", "Parents", "Crypto", "Student Loans", "Hustling"]
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
        addMessage('ai', "Bad Bingo is online. Let's see if you're worth the tuna.");
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
      addMessage('ai', "Sniffing your data...");
      
      const profileDesc = await generateRiskProfile(newAnswers);
      
      const newProfile: UserProfile = {
        id: 'user-1',
        name: newAnswers[0],
        age: newAnswers[1].split(' ')[0], 
        gender: newAnswers[1],
        coins: 100, 
        riskProfile: profileDesc,
        avatarUrl: 'https://picsum.photos/200',
        socialDebt: 0
      };
      
      addMessage('ai', `PROFILE COMPLETE: ${profileDesc}`);
      setTimeout(() => {
        onComplete(newProfile);
      }, 2500);
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
          <h1 className="text-xl font-bold tracking-widest mt-2">THE SNIFF TEST</h1>
        </div>
        
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-3 rounded-lg border border-opacity-50 ${
              msg.sender === 'user' 
                ? 'bg-bingo-dark border-hot-pink text-hot-pink rounded-tr-none' 
                : 'bg-bingo-dark border-acid-green text-acid-green rounded-tl-none'
            }`}>
              <span dangerouslySetInnerHTML={{ __html: msg.text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') }} />
            </div>
          </div>
        ))}
        {loading && <div className="text-acid-green animate-pulse">Bad Bingo is judging you...</div>}
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
          placeholder="Type here..."
          className="flex-1 bg-bingo-dark border border-gray-700 text-white p-3 rounded focus:outline-none focus:border-acid-green"
          autoFocus
        />
        <button type="submit" className="bg-acid-green text-black font-bold p-3 rounded hover:bg-white transition-colors">
          ENTER
        </button>
      </form>
    </div>
  );
};

export default Onboarding;