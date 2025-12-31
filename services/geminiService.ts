import { GoogleGenAI, Type } from "@google/genai";
import { RelationshipLevel, BetScenario } from '../types';

// Vite uses import.meta.env for environment variables
const GEMINI_API_KEY = typeof import.meta !== 'undefined'
  ? (import.meta.env?.VITE_GEMINI_API_KEY || import.meta.env?.GEMINI_API_KEY)
  : (process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY);

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY || '' });

const TEXT_MODEL = 'gemini-3-pro-preview'; 
const IMAGE_MODEL = 'gemini-2.5-flash-image'; 

/**
 * Generate a quick first impression/judgment based on the user's name.
 * This is shown after the first question to make the AI feel more interactive.
 */
export const generateFirstImpression = async (name: string): Promise<string> => {
  try {
    const prompt = `
      You are Bad Bingo, a grumpy, sarcastic, world-weary cyberpunk gambling cat.
      A new stray just told you their name is "${name}".

      Give a SHORT (1-2 sentences max) snarky first impression based ONLY on their name.
      Be judgmental but playful. Use cat/gambling metaphors.

      Examples of good responses:
      - "Ah, ${name}. Sounds like someone who peaked in middle school. Let's see if I'm right."
      - "${name}? That's the name of someone who definitely has unread texts. I can smell the avoidance."
      - "Ooh, ${name}. Fancy. Bet you still can't parallel park though."

      Keep it under 30 words. Output PLAIN TEXT only. Be savage but not mean.
    `;

    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: prompt,
    });

    return response.text || `${name}? Sounds like trouble. I like it.`;
  } catch (error) {
    console.error("First impression AI Error:", error);
    // Fallback responses
    const fallbacks = [
      `${name}? Hmm. I've seen that name in the losers bracket before. Let's see if you're different.`,
      `Ah, ${name}. Sounds like someone who makes questionable life choices. Perfect for this place.`,
      `${name}... I've heard worse. Barely. Let's continue before I change my mind.`,
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
};

export const generateRiskProfile = async (answers: string[]): Promise<string> => {
  try {
    const prompt = `
      You are Bad Bingo, a grumpy, sarcastic, cyberpunk gambling cat AI. 
      The user just completed the "Know Yourself" survey. Analyze them.
      
      User Data:
      Name: ${answers[0]}
      Stats: ${answers[1]}
      Territory: ${answers[2]}
      Vice: ${answers[3]}
      Income: ${answers[4]}
      Relationship: ${answers[5] || 'Unknown'}
      Triggers: ${answers[6] || 'None'}
      Habits: ${answers[7] || 'Existing'}
      Common Lie: ${answers[8] || 'I never lie'}
      
      Generate a "Risk Profile" paragraph.
      First part: A concise summary of their traits (e.g. "Single caffeine addict who rots in bed and lies about time").
      Second part: A biting, sarcastic roast of their lifestyle using gambling/cat metaphors.
      Output PLAIN TEXT only.
    `;

    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: prompt,
    });

    return response.text || "SMELLS LIKE KIBBLE. CREDIBILITY: ZERO.";
  } catch (error) {
    console.error("AI Error:", error);
    return "UNKNOWN STRAY. PROBABLY OWES ME MONEY.";
  }
};

export const generateFriendshipProfile = async (
  targetName: string, 
  surveyAnswers: string[]
): Promise<{ level: RelationshipLevel; description: string }> => {
  try {
    const prompt = `
      You are Bad Bingo. A user is adding a friend named ${targetName} and completed the "Know Your Friend" interrogation.
      
      Survey Data:
      1. Relationship Type: ${surveyAnswers[0]}
      2. Their Toxic Trait: ${surveyAnswers[1]}
      3. Dirt Level (Secrets): ${surveyAnswers[2]}
      4. If they trip, you would: ${surveyAnswers[3]}

      Determine the Relationship Intensity (Heat Level):
      1 = CIVILIAN (Safe, boring, work/family)
      2 = ROAST (Friends, acceptable bullying)
      3 = NUCLEAR (Deep history, lovers, rivals, dangerous secrets)

      Also provide a 1-sentence sarcastic description of this dynamic.
    `;

    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            level: { type: Type.INTEGER, description: "1, 2, or 3" },
            description: { type: Type.STRING, description: "Sarcastic summary" }
          },
          required: ["level", "description"]
        }
      }
    });

    const jsonStr = response.text;
    if (!jsonStr) throw new Error("No data");
    const parsed = JSON.parse(jsonStr);
    
    return {
      level: parsed.level as RelationshipLevel,
      description: parsed.description
    };

  } catch (error) {
    console.error("Friend AI Error", error);
    return { level: 2, description: "Generic stray cat energy." };
  }
};

export const generateDailyBets = async (
  relationshipLevel: RelationshipLevel,
  friendName: string,
  userRiskProfile: string
): Promise<BetScenario[]> => {
  try {
    let intensityDesc = "";
    let examples = "";

    if (relationshipLevel === RelationshipLevel.CIVILIAN) {
      intensityDesc = "SAFE/CIVILIAN - Keep it light. Work appropriate. Nothing embarrassing.";
      examples = `
        GOOD EXAMPLES:
        - "${friendName} will be late to something today"
        - "${friendName} hasn't made their bed yet"
        - "${friendName} will check their phone within 5 minutes"
        - "${friendName} is wearing mismatched socks right now"
        - "${friendName} forgot to reply to a text from yesterday"
        - "${friendName} will say 'I'm tired' before noon"
        - "${friendName} is currently procrastinating on something important"
      `;
    } else if (relationshipLevel === RelationshipLevel.ROAST) {
      intensityDesc = "ROAST/FAIR GAME - Embarrassing but not cruel. Call out bad habits, messy behavior, questionable choices.";
      examples = `
        GOOD EXAMPLES:
        - "${friendName} has dirty dishes in their sink right now"
        - "${friendName} is wearing the same outfit they wore yesterday"
        - "${friendName} hasn't exercised in over a week"
        - "${friendName} will cancel plans this weekend"
        - "${friendName} has unread emails older than a month"
        - "${friendName} is lying about being 'on their way'"
        - "${friendName} ate something questionable for breakfast"
        - "${friendName} has clothes on their floor right now"
        - "${friendName} is doom-scrolling instead of sleeping"
        - "${friendName} will order takeout instead of cooking tonight"
      `;
    } else {
      intensityDesc = "NUCLEAR/NO MERCY - Spicy, personal, location-based, secrets, relationship drama. Maximum chaos.";
      examples = `
        GOOD EXAMPLES:
        - "${friendName} isn't where they say they are right now"
        - "${friendName} has stalked an ex's profile this week"
        - "${friendName} has a screenshot they shouldn't have"
        - "${friendName} lied about why they couldn't hang out"
        - "${friendName} is currently not wearing pants"
        - "${friendName} drunk-texted someone they shouldn't have"
        - "${friendName} has an embarrassing search in their history"
        - "${friendName} slept through their alarm today"
        - "${friendName} is thinking about someone they shouldn't"
        - "${friendName} said 'I love you' to the wrong person once"
      `;
    }

    const prompt = `
      You are Bad Bingo, a savage, sarcastic gambling cat who creates betting scenarios between friends.

      Generate 5 UNIQUE betting scenarios about ${friendName}.

      USER CONTEXT (who is betting against ${friendName}): ${userRiskProfile}
      INTENSITY LEVEL: ${intensityDesc}

      ${examples}

      RULES:
      1. Each bet must be a SPECIFIC, VERIFIABLE statement (can be proven with a photo/video/confession)
      2. Make them FUNNY and RELATABLE - things friends actually tease each other about
      3. Mix timeframes: "right now", "today", "this week", "recently"
      4. Reference common situations: morning routines, work/school, social media, relationships, bad habits
      5. Use the user's context to create ironic bets (if user is messy, bet about friend being messy)
      6. Each bet should feel like something a real friend would say
      7. DO NOT be generic - make each bet specific and interesting
      8. Stakes should be 10-50 for safe bets, 30-80 for roast bets, 50-100 for nuclear bets

      BAD EXAMPLES (too generic, avoid these):
      - "${friendName} is lazy" (not specific)
      - "${friendName} exists" (boring)
      - "${friendName} will do something" (vague)
    `;

    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING, description: "The specific bet statement about the friend" },
              backgroundType: { type: Type.STRING, enum: ['bedroom', 'gym', 'club', 'street', 'office'] },
              category: { type: Type.STRING, description: "Category like: Habits, Lifestyle, Social, Romance, Work, Chaos" },
              stake: { type: Type.NUMBER, description: "Bingo amount based on intensity" },
              proofType: { type: Type.STRING, enum: ['photo', 'video', 'screenshot', 'confession'], description: "How to prove it" }
            },
            required: ["text", "backgroundType", "stake", "category", "proofType"]
          }
        }
      }
    });

    const jsonStr = response.text;
    if (!jsonStr) throw new Error("No data returned");

    const parsed = JSON.parse(jsonStr);

    return parsed.map((item: any, index: number) => ({
      id: `gen-${Date.now()}-${index}`,
      text: item.text,
      backgroundType: item.backgroundType || 'default',
      opponentName: friendName,
      stake: item.stake || 25,
      category: item.category || 'General',
      proofType: item.proofType || 'photo',
      friendVote: false, // Placeholder - actual clash detection happens server-side in swipeBet()
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      heatLevelRequired: relationshipLevel
    }));

  } catch (error) {
    console.error("Bet generation error:", error);
    // Better fallback bets
    const fallbackBets = [
      { text: `${friendName} is procrastinating on something right now`, category: 'Habits', stake: 20, bg: 'bedroom' },
      { text: `${friendName} has at least 3 unread notifications`, category: 'Social', stake: 15, bg: 'office' },
      { text: `${friendName} will check social media in the next 10 minutes`, category: 'Lifestyle', stake: 25, bg: 'bedroom' },
      { text: `${friendName} is wearing something comfortable but questionable`, category: 'Style', stake: 20, bg: 'bedroom' },
      { text: `${friendName} hasn't drunk enough water today`, category: 'Health', stake: 15, bg: 'office' }
    ];

    return fallbackBets.map((bet, index) => ({
      id: `fallback-${Date.now()}-${index}`,
      text: bet.text,
      backgroundType: bet.bg,
      opponentName: friendName,
      stake: bet.stake,
      category: bet.category,
      proofType: 'photo' as const,
      friendVote: false, // Placeholder - actual clash detection happens server-side in swipeBet()
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      heatLevelRequired: relationshipLevel
    }));
  }
};

export const generateTrophyImage = async (winnerName: string, amount: number): Promise<string | null> => {
  try {
    const prompt = `A cyberpunk tarot card. Neon cat (Bad Bingo) holding a bag of bingos.
    Text: "WINNER ${winnerName}" and "${amount}".
    Glitch art style, dark background, hot pink and acid green.`;

    const response = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: prompt,
    });

    if (response.candidates && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }
    return null;
  } catch (error) {
    return null;
  }
};

export interface ContentModerationResult {
  allowed: boolean;
  reason: string | null;
}

/**
 * Enhanced moderation result with safety levels for bet content
 */
export interface ModerationResult {
  approved: boolean;
  reason?: string;
  safetyLevel: 'safe' | 'mild' | 'moderate' | 'severe';
  suggestedHeatLevel?: 1 | 2 | 3;
}

// Pattern-based fallback moderation when AI is unavailable
const SEVERE_PATTERNS = [
  // Sexual content
  /\b(nude|naked|sex|porn|pornograph|xxx|nsfw|orgasm|genital|breast|penis|vagina|buttocks|anus)\b/i,
  // Violence
  /\b(murder|kill|killing|assault|stab|shoot|shooting|bomb|terrorist|terrorism|execute|execution)\b/i,
  // Self-harm
  /\b(suicide|suicidal|self.?harm|cut myself|end my life|kill myself)\b/i,
  // Illegal drugs
  /\b(cocaine|heroin|meth|methamphetamine|fentanyl|drug deal|illegal drug)\b/i,
  // Weapons used threateningly
  /\b(gun|knife|weapon|firearm).*\b(use|threat|hurt|harm|attack)\b/i,
  /\b(threat|hurt|harm|attack).*\b(gun|knife|weapon|firearm)\b/i,
  // Hate speech indicators
  /\b(n[i1]gg[ae]r|f[a4]gg[o0]t|k[i1]ke|sp[i1]c|ch[i1]nk|r[e3]t[a4]rd)\b/i,
  // Doxxing/privacy
  /\b(dox|doxx|address is|phone number is|ssn|social security)\b/i,
  // Child safety
  /\b(child|minor|kid|underage).*\b(sex|nude|naked|inappropriate)\b/i,
  /\b(sex|nude|naked|inappropriate).*\b(child|minor|kid|underage)\b/i,
];

const MODERATE_PATTERNS = [
  // Personal insults
  /\b(idiot|stupid|dumb|dumbass|moron|loser|pathetic|worthless|trash|garbage)\b/i,
  // Body shaming
  /\b(fat|fatty|obese|ugly|hideous|disgusting|gross)\b/i,
  // Aggressive language
  /\b(hate you|hate them|hate her|hate him|screw you|f\*ck you|fck you)\b/i,
  // Alcohol/party references
  /\b(wasted|hammered|blackout|drunk as|get wasted|get hammered)\b/i,
  // Relationship drama
  /\b(cheating|cheat on|affair|homewrecker|slut|whore)\b/i,
];

const MILD_PATTERNS = [
  // Light teasing
  /\b(weird|lazy|boring|slow|annoying|forgetful|clumsy|messy)\b/i,
  // Minor habits
  /\b(procrastinat|late again|oversleep|overslept|snooze|snoring)\b/i,
  // Light embarrassment
  /\b(awkward|embarrassing|cringe|fail|trip|stumble)\b/i,
];

/**
 * Pattern-based fallback moderation when Gemini AI is unavailable
 */
const moderateWithPatterns = (
  betText: string,
  currentHeatLevel: 1 | 2 | 3
): ModerationResult => {
  const text = betText.toLowerCase();

  // Check severe patterns - always blocked regardless of heat level
  for (const pattern of SEVERE_PATTERNS) {
    if (pattern.test(text)) {
      return {
        approved: false,
        reason: 'Content contains prohibited material (explicit, violent, or illegal content)',
        safetyLevel: 'severe',
      };
    }
  }

  // Check moderate patterns - blocked at low heat levels
  for (const pattern of MODERATE_PATTERNS) {
    if (pattern.test(text)) {
      if (currentHeatLevel < 3) {
        return {
          approved: false,
          reason: 'Content requires higher relationship heat level (NUCLEAR)',
          safetyLevel: 'moderate',
          suggestedHeatLevel: 3,
        };
      }
      return {
        approved: true,
        safetyLevel: 'moderate',
        suggestedHeatLevel: 3,
      };
    }
  }

  // Check mild patterns - allowed at ROAST level and above
  for (const pattern of MILD_PATTERNS) {
    if (pattern.test(text)) {
      if (currentHeatLevel < 2) {
        return {
          approved: false,
          reason: 'Content requires higher relationship heat level (ROAST or NUCLEAR)',
          safetyLevel: 'mild',
          suggestedHeatLevel: 2,
        };
      }
      return {
        approved: true,
        safetyLevel: 'mild',
        suggestedHeatLevel: 2,
      };
    }
  }

  // No patterns matched - content is safe
  return {
    approved: true,
    safetyLevel: 'safe',
    suggestedHeatLevel: 1,
  };
};

/**
 * Moderates custom bet content using Gemini AI with fallback to pattern matching.
 *
 * Safety Levels:
 * - 'safe': Appropriate for all heat levels (CIVILIAN, ROAST, NUCLEAR)
 * - 'mild': Light teasing, requires ROAST (2) or higher
 * - 'moderate': Personal insults/body shaming, requires NUCLEAR (3)
 * - 'severe': Always blocked (sexual, violent, illegal, hate speech)
 *
 * @param betText - The custom bet text to moderate
 * @param currentHeatLevel - The relationship heat level (1=CIVILIAN, 2=ROAST, 3=NUCLEAR)
 * @returns ModerationResult with approval status, reason, safety level, and suggested heat
 */
export const moderateBetContent = async (
  betText: string,
  currentHeatLevel: 1 | 2 | 3
): Promise<ModerationResult> => {
  // Quick validation for empty or very short text
  if (!betText || betText.trim().length < 3) {
    return {
      approved: false,
      reason: 'Bet text is too short (minimum 3 characters)',
      safetyLevel: 'safe',
    };
  }

  // Length limit check
  if (betText.length > 500) {
    return {
      approved: false,
      reason: 'Bet text is too long (maximum 500 characters)',
      safetyLevel: 'safe',
    };
  }

  // If no API key, use pattern-based fallback
  if (!GEMINI_API_KEY) {
    console.warn('No Gemini API key - using pattern-based moderation fallback');
    return moderateWithPatterns(betText, currentHeatLevel);
  }

  try {
    const prompt = `
      You are a content moderator for Bad Bingo, a social betting app where friends make playful bets about each other's behavior.

      Analyze the following user-submitted bet text and classify its safety level.

      HEAT LEVELS EXPLANATION:
      - Heat 1 (CIVILIAN): Safe, work-appropriate, family-friendly bets
      - Heat 2 (ROAST): Friendly teasing, mild embarrassment, calling out bad habits
      - Heat 3 (NUCLEAR): Spicy personal bets, relationship drama, deep secrets

      The user's current relationship heat level with their friend is: ${currentHeatLevel}

      SAFETY CLASSIFICATION RULES:

      SAFE (appropriate for Heat 1+):
      - Predictions about daily habits (being late, checking phone, procrastinating)
      - Food/drink choices, clothing, routines
      - Social media behavior
      - Work/school performance

      MILD (requires Heat 2+):
      - Light teasing about personality traits (lazy, weird, forgetful)
      - Minor embarrassing predictions (tripping, typos, awkward moments)
      - Calling out messy habits or procrastination

      MODERATE (requires Heat 3 only):
      - Personal insults (idiot, loser, pathetic - but not slurs)
      - Body-related comments (that aren't slurs or extreme)
      - Relationship drama (exes, crushes, dating life)
      - Party/drinking behavior
      - Secrets and confessions

      SEVERE (ALWAYS BLOCKED - no heat level allows this):
      - Sexually explicit content (nudity, sex acts, genitalia)
      - Violence or threats (murder, assault, weapons used threateningly)
      - Illegal activities (drug dealing, serious crimes)
      - Hate speech or slurs (racial, homophobic, etc.)
      - Self-harm or suicide references
      - Content involving minors inappropriately
      - Doxxing or privacy violations
      - Terrorist content

      User-submitted bet text: "${betText.substring(0, 500)}"
      Current heat level: ${currentHeatLevel}
    `;

    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            safetyLevel: {
              type: Type.STRING,
              enum: ['safe', 'mild', 'moderate', 'severe'],
              description: "The safety classification of the content"
            },
            reason: {
              type: Type.STRING,
              description: "Explanation for the safety level classification",
              nullable: true
            },
            suggestedHeatLevel: {
              type: Type.INTEGER,
              description: "Minimum heat level required (1, 2, or 3)",
              nullable: true
            }
          },
          required: ["safetyLevel"]
        }
      }
    });

    const jsonStr = response.text;
    if (!jsonStr) {
      console.warn('Empty response from moderation API - using fallback');
      return moderateWithPatterns(betText, currentHeatLevel);
    }

    const parsed = JSON.parse(jsonStr);
    const safetyLevel = parsed.safetyLevel as 'safe' | 'mild' | 'moderate' | 'severe';
    const suggestedHeatLevel = parsed.suggestedHeatLevel as 1 | 2 | 3 | undefined;

    // Determine if content is approved based on safety level and current heat
    let approved = false;
    let reason: string | undefined = parsed.reason || undefined;

    switch (safetyLevel) {
      case 'safe':
        approved = true;
        break;
      case 'mild':
        approved = currentHeatLevel >= 2;
        if (!approved) {
          reason = reason || 'This bet requires at least ROAST heat level (2) with your friend';
        }
        break;
      case 'moderate':
        approved = currentHeatLevel >= 3;
        if (!approved) {
          reason = reason || 'This bet requires NUCLEAR heat level (3) with your friend';
        }
        break;
      case 'severe':
        approved = false;
        reason = reason || 'This content is not allowed (contains explicit, violent, or prohibited material)';
        break;
    }

    return {
      approved,
      reason,
      safetyLevel,
      suggestedHeatLevel: suggestedHeatLevel || (safetyLevel === 'safe' ? 1 : safetyLevel === 'mild' ? 2 : 3),
    };

  } catch (error) {
    console.error('AI moderation error, using pattern fallback:', error);
    // On API error, use pattern-based fallback
    return moderateWithPatterns(betText, currentHeatLevel);
  }
};

/**
 * Legacy moderation function - kept for backward compatibility.
 * Consider using moderateBetContent() for more detailed results.
 *
 * @deprecated Use moderateBetContent() instead for new implementations
 */
export const moderateContent = async (text: string): Promise<ContentModerationResult> => {
  // Quick validation for empty text
  if (!text || text.trim().length < 3) {
    return { allowed: false, reason: 'Content is too short' };
  }

  // Use the new moderation function with heat level 2 (ROAST) as default
  const result = await moderateBetContent(text, 2);

  return {
    allowed: result.approved,
    reason: result.reason || null,
  };
};