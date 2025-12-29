import { GoogleGenAI, Type } from "@google/genai";
import { RelationshipLevel, BetScenario } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const TEXT_MODEL = 'gemini-3-pro-preview'; 
const IMAGE_MODEL = 'gemini-2.5-flash-image'; 

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
    let intensityDesc = "Safe Bets. Did they drink water? Are they alive?";
    if (relationshipLevel === RelationshipLevel.ROAST) intensityDesc = "Roast Bets. Bad habits, messy rooms, bad outfits.";
    if (relationshipLevel === RelationshipLevel.NUCLEAR) intensityDesc = "Nuclear Bets. Deep secrets, location checks, 'prove you aren't lying'.";

    const prompt = `
      You are Bad Bingo. Generate 5 betting statements about ${friendName}.
      Context on User (The one betting): ${userRiskProfile}.
      Intensity Level: ${intensityDesc}.
      
      Use the User's context to make the bets relatable or ironic (e.g. if User is messy, bet if Friend is messy).
      The bets must be statements starting with "Bet ${friendName}..." 
      Make them sarcastic and specific.
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
              text: { type: Type.STRING, description: "The bet text" },
              backgroundType: { type: Type.STRING, enum: ['bedroom', 'gym', 'club', 'street', 'office'] },
              category: { type: Type.STRING },
              stake: { type: Type.NUMBER, description: "Tuna amount between 10 and 100" }
            },
            required: ["text", "backgroundType", "stake", "category"]
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
      backgroundType: item.backgroundType,
      opponentName: friendName,
      stake: item.stake,
      category: item.category,
      friendVote: Math.random() < 0.5 
    }));

  } catch (error) {
    return [
      { id: 'err1', text: `Bet ${friendName} is ignoring you.`, backgroundType: 'bedroom', opponentName: friendName, stake: 50, category: 'Ghosting', friendVote: true },
      { id: 'err2', text: `Bet ${friendName} is doomed.`, backgroundType: 'street', opponentName: friendName, stake: 25, category: 'Fate', friendVote: false }
    ];
  }
};

export const generateTrophyImage = async (winnerName: string, amount: number): Promise<string | null> => {
  try {
    const prompt = `A cyberpunk tarot card. Neon cat (Bad Bingo) holding a bag of tuna. 
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