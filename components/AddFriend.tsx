import React, { useState } from 'react';
import { Friend, RelationshipLevel } from '../types';
import { generateFriendshipProfile } from '../services/geminiService';

interface AddFriendProps {
  onClose: () => void;
  onAdd: (friend: Friend) => void;
}

// "Know Your Friend" Survey Stages
enum AddStage {
  SEARCH = 'SEARCH',
  SURVEY = 'SURVEY',
  ANALYZING = 'ANALYZING',
  RESULT = 'RESULT'
}

const AddFriend: React.FC<AddFriendProps> = ({ onClose, onAdd }) => {
  const [stage, setStage] = useState<AddStage>(AddStage.SEARCH);
  const [query, setQuery] = useState('');
  const [friendName, setFriendName] = useState('');
  
  // Survey State
  const [surveyIndex, setSurveyIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  
  // Result State
  const [generatedProfile, setGeneratedProfile] = useState<{level: RelationshipLevel, description: string} | null>(null);

  const SURVEY_QUESTIONS = [
    {
      q: "Who is this stray to you?",
      options: ["The Boss (Work)", "The Bestie (Toxic)", "The Partner (Nuclear)", "Just an NPC (Civilian)"]
    },
    {
      q: "What is their Toxic Trait?",
      options: ["Chronic Lateness", "Compulsive Lying", "Being Broke", "Oversharing"]
    },
    {
      q: "Dirt Level (How many secrets do you have?)",
      options: ["None (Clean)", "Some (Dusty)", "Career Ending (Filthy)"]
    },
    {
      q: "If they trip in public, you...",
      options: ["Help immediately", "Laugh first, help later", "Take a picture", "Pretend I don't know them"]
    }
  ];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setFriendName(query);
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
    const result = await generateFriendshipProfile(friendName, finalAnswers);
    setGeneratedProfile(result);
    setStage(AddStage.RESULT);
  };

  const confirmFriend = () => {
    if (!generatedProfile) return;
    
    const newFriend: Friend = {
      id: `friend-${Date.now()}`,
      name: friendName,
      relationshipLevel: generatedProfile.level,
      relationshipDescription: generatedProfile.description,
      status: 'online', // Simulating they are active
      friendshipStatus: 'pending_sent',
      coins: 100,
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${friendName}`
    };
    onAdd(newFriend);
  };

  const renderSearch = () => (
    <div className="flex-1 flex flex-col justify-center">
      <div className="text-center mb-8">
         <i className="fas fa-search text-6xl text-cyan-glitch mb-4 animate-pulse"></i>
         <h2 className="text-2xl font-bold text-white uppercase tracking-widest">Find Stray</h2>
         <p className="text-gray-500 text-xs mt-2">SEARCH DATABASE FOR PLAYER TAG</p>
      </div>
      
      <form onSubmit={handleSearch} className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ENTER NAME..."
          className="w-full bg-black border border-gray-700 text-white p-4 rounded-lg focus:outline-none focus:border-cyan-glitch font-mono uppercase placeholder-gray-600 text-center text-xl"
          autoFocus
        />
        <button 
          type="submit"
          className="w-full mt-4 bg-gray-900 text-cyan-glitch font-bold py-4 rounded border border-cyan-glitch/30 hover:bg-cyan-glitch hover:text-black transition-all"
        >
          INITIATE PROTOCOL
        </button>
      </form>
    </div>
  );

  const renderSurvey = () => (
    <div className="flex-1 flex flex-col pt-10">
      <div className="mb-2 text-acid-green font-mono text-xs uppercase tracking-widest">
        KNOW YOUR FRIEND PROTOCOL ({surveyIndex + 1}/{SURVEY_QUESTIONS.length})
      </div>
      <div className="h-1 w-full bg-gray-800 rounded mb-8">
        <div className="h-1 bg-acid-green transition-all duration-300" style={{ width: `${((surveyIndex + 1) / SURVEY_QUESTIONS.length) * 100}%` }}></div>
      </div>

      <h2 className="text-xl font-bold text-white mb-8 leading-relaxed">
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
      <p className="text-gray-500 font-mono text-xs mt-2">BAD BINGO IS JUDGING YOUR FRIENDSHIP</p>
      <div className="mt-8 font-mono text-acid-green text-xs">
         {`> Analyzing toxic traits... OK`}<br/>
         {`> Calculating betrayal probability... HIGH`}<br/>
         {`> Setting heat levels...`}
      </div>
    </div>
  );

  const renderResult = () => {
    if (!generatedProfile) return null;
    const { level, description } = generatedProfile;

    let icon = "fa-user";
    let color = "text-blue-400";
    let label = "CIVILIAN";
    
    if (level === RelationshipLevel.ROAST) {
        icon = "fa-fire";
        color = "text-orange-400";
        label = "ROAST";
    } else if (level === RelationshipLevel.NUCLEAR) {
        icon = "fa-biohazard";
        color = "text-alert-red";
        label = "NUCLEAR";
    }

    return (
      <div className="flex-1 flex flex-col pt-10 animate-in zoom-in duration-500">
         <div className="text-center mb-6">
            <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full border-4 ${color.replace('text', 'border')} mb-4 bg-black/50 shadow-[0_0_30px_currentColor]`}>
                <i className={`fas ${icon} text-4xl ${color}`}></i>
            </div>
            <h2 className={`text-3xl font-black ${color} tracking-tighter uppercase`}>{label} LEVEL</h2>
         </div>

         <div className="bg-gray-900 border border-gray-700 p-6 rounded-lg mb-8 relative overflow-hidden">
            <i className="fas fa-quote-left absolute top-2 left-2 text-gray-800 text-4xl"></i>
            <p className="text-white font-mono text-sm relative z-10 italic text-center">
              "{description}"
            </p>
         </div>

         <div className="bg-black/40 p-4 rounded border border-gray-800 mb-8">
            <div className="text-xs text-gray-500 uppercase mb-2">Security Clearance Granted:</div>
            <ul className="text-sm space-y-2">
                <li className="flex items-center gap-2 text-gray-300"><i className="fas fa-check text-acid-green"></i> 
                    {level === 1 ? 'Basic Bets' : level === 2 ? 'Embarrassing Bets' : 'Location & Secrets Bets'}
                </li>
                <li className="flex items-center gap-2 text-gray-300"><i className="fas fa-check text-acid-green"></i> 
                    {level === 1 ? 'Standard Proof' : level === 2 ? 'Video Proof Allowed' : 'View Once Proofs'}
                </li>
            </ul>
         </div>

         <button 
           onClick={confirmFriend}
           className="w-full bg-acid-green text-black font-black py-4 rounded hover:scale-[1.02] transition-transform shadow-[0_0_20px_rgba(204,255,0,0.4)] uppercase"
         >
           Send Invite
         </button>
      </div>
    );
  };

  return (
    <div className="h-full bg-bingo-black flex flex-col p-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
        <i className="fas fa-network-wired text-9xl text-hot-pink"></i>
      </div>

      <div className="flex justify-between items-center z-10">
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <i className="fas fa-times text-xl"></i>
        </button>
        <div className="text-[10px] font-mono text-gray-600 uppercase">Protocol: ADD_FRIEND</div>
        <div className="w-4"></div>
      </div>

      {stage === AddStage.SEARCH && renderSearch()}
      {stage === AddStage.SURVEY && renderSurvey()}
      {stage === AddStage.ANALYZING && renderAnalyzing()}
      {stage === AddStage.RESULT && renderResult()}
    </div>
  );
};

export default AddFriend;