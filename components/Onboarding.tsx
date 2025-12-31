import React, { useState, useEffect, useRef } from 'react';
import { generateRiskProfile, generateFirstImpression } from '../services/geminiService';
import { UserProfile, ChatMessage } from '../types';

interface OnboardingProps {
  onComplete: (profile: UserProfile) => void;
}

// Extended questions for comprehensive profile building
const QUESTIONS = [
  "Alright stray, what do they call you in the alley?\nDon't make something up. I'll know.",
  "Age and gender. I need to calculate your odds of making terrible decisions.\n...They're high. I can already tell.",
  "Where do you rot when you're not losing bets?\nBedroom? Office? Your mom's basement? No judgment. Okay, some judgment.",
  "What's your poison? Every gambler has a weakness.\nCaffeine addiction? Doomscrolling? Desperate need for validation? ...All three?",
  "Who's bankrolling your bad decisions?\nJob? Parents? Crypto gains you definitely lied about?",
  "Relationship status. And before you say 'it's complicated'...\n...it's always complicated. You're not special.",
  "What makes you absolutely UNHINGED?\nSlow wifi? Loud chewers? Being left on read? I need to know your buttons.",
  "How do you waste the precious hours of your finite existence?\nDoomscrolling counts. Rotting in bed counts. Be honest.",
  "Final question: What's your most frequent lie?\n'On my way' when you haven't left? 'I'm fine' when you're not?\nI've heard them all, kitten.",
  // NEW: Extended profile questions
  "Now let's get personal. Where do you pretend to be productive?\nWork, school, or professional couch potato?",
  "Speaking of school... did you survive the education system?\nWhat's your academic damage?",
  "Got any fur babies or human siblings?\nI need to know who else you're competing with for attention.",
  "Where does your chaos unfold?\nWhat city/location should I know about?",
];

const SUGGESTIONS = [
  [],
  ["Baby (18)", "Barely Legal (21)", "Quarter-Life Crisis (25)", "Denial (30)", "Fossil (99)"],
  ["The Bedroom Dungeon", "Corporate Prison", "Gym Rat Cage", "Touch Grass", "Mom's Basement"],
  ["Caffeine IV Drip", "Phone Addiction", "Emotional Eating", "Gaming Rot", "Attention Seeking"],
  ["Wage Slave", "Bank of Mom & Dad", "Fake Crypto Bro", "Drowning in Debt", "Trust Fund"],
  ["Tragically Single", "Taken (for now)", "It's a Mess", "Married to Cope", "Situationship Hell"],
  ["Slow Wifi Rage", "Mouth Breathers", "Left on Read", "L's in General", "Humanity"],
  ["Phone Zombie", "Bed Rot Champion", "Gaming Goblin", "Delusional Socialite", "Workaholic Cope"],
  ["'omw' (still in bed)", "'I'm fine' (I'm not)", "'Just one more' (lies)", "My actual height", "'I read it' (I didn't)"],
  // NEW: Suggestions for extended questions
  ["Corporate Slave", "Student Suffering", "Freelance (Unemployed)", "Entrepreneur (Broke)", "Professional Viber"],
  ["High School Survivor", "College Dropout", "Degree Haver", "Still in School", "School of Life"],
  ["Dog Parent", "Cat Servant", "No Pets (Boring)", "Fish (Barely)", "1 Sibling", "2+ Siblings", "Only Child"],
  ["Big City Chaos", "Suburban Void", "Small Town Drama", "Middle of Nowhere", "Skip This"],
];

// Map question index to profile field
const QUESTION_FIELDS = [
  'name',           // 0
  'ageGender',      // 1
  'location_habit', // 2 - where they hang out (daily_routine)
  'vices',          // 3
  'income',         // 4
  'relationship',   // 5
  'triggers',       // 6
  'hobbies',        // 7
  'lies',           // 8
  'work',           // 9 - NEW
  'school',         // 10 - NEW
  'petsAndSiblings',// 11 - NEW
  'city',           // 12 - NEW
];

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [answers, setAnswers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [waitingForContinue, setWaitingForContinue] = useState(false);
  const [generatedProfile, setGeneratedProfile] = useState<UserProfile | null>(null);
  const [analysisText, setAnalysisText] = useState<string>('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (step === 0 && messages.length === 0) {
      setTimeout(() => {
        addMessage('ai', "Oh look, another stray wandered into my casino.\nI'm Bad Bingo. I run this place. And you... you look like you make poor life choices.\n\nLet's find out exactly how poor.");
        setTimeout(() => addMessage('ai', QUESTIONS[0]), 1500);
      }, 500);
    }
  }, [step, messages.length]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = (sender: 'ai' | 'user', text: string) => {
    setMessages(prev => [...prev, { sender, text }]);
  };

  // Parse pets and siblings from combined answer
  const parsePetsAndSiblings = (answer: string): { hasPets: boolean; petType: string | null; siblingCount: number } => {
    const lower = answer.toLowerCase();
    let hasPets = false;
    let petType: string | null = null;
    let siblingCount = 0;

    if (lower.includes('dog')) {
      hasPets = true;
      petType = 'dog';
    } else if (lower.includes('cat')) {
      hasPets = true;
      petType = 'cat';
    } else if (lower.includes('fish')) {
      hasPets = true;
      petType = 'fish';
    } else if (lower.includes('pet')) {
      hasPets = true;
      petType = 'other';
    }

    if (lower.includes('only child')) {
      siblingCount = 0;
    } else if (lower.includes('2+') || lower.includes('siblings')) {
      siblingCount = 2;
    } else if (lower.includes('1 sibling')) {
      siblingCount = 1;
    }

    return { hasPets, petType, siblingCount };
  };

  // Handle continuing after analysis is shown - complete onboarding
  const handleContinue = () => {
    setWaitingForContinue(false);
    if (generatedProfile) {
      onComplete(generatedProfile);
    }
  };

  const processAnswer = async (answerText: string) => {
    if (!answerText.trim()) return;

    addMessage('user', answerText);
    setInput('');

    const newAnswers = [...answers, answerText];
    setAnswers(newAnswers);

    if (step < QUESTIONS.length - 1) {
      setLoading(true);

      // Add transition messages for new sections
      if (step === 8) {
        // Transitioning to extended profile questions
        setTimeout(() => {
          addMessage('ai', "Not bad. But I need MORE data to properly judge you.\nLet's dig deeper into your sad little life...");
          setTimeout(() => {
            setStep(prev => prev + 1);
            addMessage('ai', QUESTIONS[step + 1]);
            setLoading(false);
          }, 1200);
        }, 800);
      } else {
        setTimeout(() => {
          setStep(prev => prev + 1);
          addMessage('ai', QUESTIONS[step + 1]);
          setLoading(false);
        }, 800);
      }
    } else {
      // LAST QUESTION - Generate analysis and wait for user to continue
      setLoading(true);
      addMessage('ai', "Interesting... very interesting.\n\n*licks paw judgmentally*\n\nLet me calculate your exact level of delusion...");

      const profileDesc = await generateRiskProfile(newAnswers);

      // Parse extended profile data
      const petsAndSiblings = parsePetsAndSiblings(newAnswers[11] || '');
      const cityAnswer = newAnswers[12] || '';
      const workAnswer = newAnswers[9] || '';
      const schoolAnswer = newAnswers[10] || '';

      // Determine city from answer
      let city = '';
      if (cityAnswer.toLowerCase().includes('skip')) {
        city = '';
      } else if (cityAnswer.toLowerCase().includes('big city')) {
        city = 'Big City';
      } else if (cityAnswer.toLowerCase().includes('suburban')) {
        city = 'Suburbs';
      } else if (cityAnswer.toLowerCase().includes('small town')) {
        city = 'Small Town';
      } else if (cityAnswer.toLowerCase().includes('nowhere')) {
        city = 'Rural';
      } else {
        city = cityAnswer;
      }

      // Determine work from answer
      let work = '';
      if (workAnswer.toLowerCase().includes('corporate') || workAnswer.toLowerCase().includes('slave')) {
        work = 'Corporate';
      } else if (workAnswer.toLowerCase().includes('student')) {
        work = 'Student';
      } else if (workAnswer.toLowerCase().includes('freelance') || workAnswer.toLowerCase().includes('unemployed')) {
        work = 'Freelance';
      } else if (workAnswer.toLowerCase().includes('entrepreneur') || workAnswer.toLowerCase().includes('broke')) {
        work = 'Entrepreneur';
      } else if (workAnswer.toLowerCase().includes('viber')) {
        work = 'Unemployed';
      } else {
        work = workAnswer;
      }

      // Determine school from answer
      let schools: string[] = [];
      if (schoolAnswer.toLowerCase().includes('high school')) {
        schools = ['High School'];
      } else if (schoolAnswer.toLowerCase().includes('dropout')) {
        schools = ['College (Incomplete)'];
      } else if (schoolAnswer.toLowerCase().includes('degree') || schoolAnswer.toLowerCase().includes('haver')) {
        schools = ['College Graduate'];
      } else if (schoolAnswer.toLowerCase().includes('still in')) {
        schools = ['Currently Enrolled'];
      } else if (schoolAnswer.toLowerCase().includes('life')) {
        schools = ['School of Hard Knocks'];
      } else if (schoolAnswer) {
        schools = [schoolAnswer];
      }

      const newProfile: UserProfile = {
        id: 'user-1',
        name: newAnswers[0],
        username: newAnswers[0].toLowerCase().replace(/[^a-z0-9]/g, ''),
        age: parseInt(newAnswers[1].split(' ')[0]) || 18,
        gender: newAnswers[1],
        coins: 1000,
        riskProfile: profileDesc,
        bio: profileDesc, // Save the risk profile as the user's bio
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${newAnswers[0]}&backgroundColor=b6e3f4`,
        socialDebt: 0,
        // Stats
        totalWins: 0,
        totalClashes: 0,
        winStreak: 0,
        bestWinStreak: 0,
        stealSuccessful: 0,
        stealsDefended: 0,
        timesRobbed: 0,
        // Settings
        pushEnabled: false,
        soundEnabled: true,
        hapticsEnabled: true,
        // Trust
        trustScore: 100,
        isVerified: false,
        loginStreak: 1,
        // Extended profile data (will be saved via updateProfile)
        work,
        schools,
        hasPets: petsAndSiblings.hasPets,
        petType: petsAndSiblings.petType,
        siblingCount: petsAndSiblings.siblingCount,
        city,
        // Store raw answers for additional context
        vices: [newAnswers[3]],
        triggers: [newAnswers[6]],
        commonLies: [newAnswers[8]],
        relationshipStatus: newAnswers[5],
        dailyRoutine: newAnswers[7],
      };

      // Store the profile and analysis, then wait for user to continue
      setGeneratedProfile(newProfile);
      setAnalysisText(profileDesc);
      addMessage('ai', `I've seen enough.\n\n**YOUR ANALYSIS:**\n\n${profileDesc}\n\nHere's 1000 bingos to start. Most strays lose it within a day.\nProve me wrong. Or don't. I get paid either way.`);
      setLoading(false);
      setWaitingForContinue(true);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processAnswer(input);
  };

  // Progress indicator
  const progress = ((step + 1) / QUESTIONS.length) * 100;

  return (
    <div className="flex flex-col h-full bg-bingo-black p-4 font-mono">
      {/* Progress bar */}
      <div className="mb-4">
        <div className="h-1 w-full bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-acid-green transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-gray-600 uppercase tracking-wider">
            {step < 9 ? 'Basic Info' : 'Extended Profile'}
          </span>
          <span className="text-[10px] text-gray-600">
            {step + 1}/{QUESTIONS.length}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto mb-4 space-y-4">
        <div className="text-center mb-8 opacity-50">
          <i className="fas fa-cat text-4xl text-acid-green animate-pulse"></i>
          <h1 className="text-xl font-bold tracking-widest mt-2 uppercase text-acid-green">The Interrogation</h1>
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
        {loading && <div className="text-acid-green animate-pulse text-xs uppercase tracking-widest">*judges you silently*</div>}
        <div ref={chatEndRef} />
      </div>

      {/* Continue button after analysis is complete */}
      {waitingForContinue && (
        <div className="mb-4">
          {/* Analysis Summary Card */}
          {analysisText && (
            <div className="bg-gray-900 border-2 border-acid-green/50 rounded-xl p-4 mb-4 shadow-[0_0_20px_rgba(204,255,0,0.1)]">
              <div className="flex items-center gap-2 mb-3">
                <i className="fas fa-cat text-acid-green"></i>
                <span className="text-acid-green font-mono text-xs uppercase tracking-widest">Your Profile Analysis</span>
              </div>
              <p className="text-white text-sm leading-relaxed italic">"{analysisText}"</p>
              <div className="mt-3 pt-3 border-t border-gray-700 flex items-center justify-between">
                <span className="text-gray-500 text-xs">Starting Balance</span>
                <span className="text-acid-green font-bold">1000 Bingos</span>
              </div>
            </div>
          )}
          <button
            onClick={handleContinue}
            className="w-full py-4 bg-acid-green text-black font-bold rounded-lg uppercase tracking-widest hover:bg-white transition-colors flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(204,255,0,0.3)]"
          >
            <span>Enter the Alley</span>
            <i className="fas fa-door-open"></i>
          </button>
          <p className="text-center text-gray-500 text-xs mt-2 italic">This analysis will be saved to your profile</p>
        </div>
      )}

      {!loading && !waitingForContinue && SUGGESTIONS[step] && SUGGESTIONS[step].length > 0 && (
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

      {!waitingForContinue && (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Confess here..."
            className="flex-1 bg-bingo-dark border border-gray-700 text-white p-3 rounded focus:outline-none focus:border-acid-green uppercase text-sm"
            autoFocus
          />
          <button type="submit" className="bg-acid-green text-black font-bold p-3 rounded hover:bg-white transition-colors">
            <i className="fas fa-paper-plane"></i>
          </button>
        </form>
      )}
    </div>
  );
};

export default Onboarding;
