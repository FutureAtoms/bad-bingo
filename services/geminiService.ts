import { GoogleGenAI, Type } from "@google/genai";
import { RelationshipLevel, BetScenario } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const TEXT_MODEL = 'gemini-3-pro-preview'; 
const IMAGE_MODEL = 'gemini-2.5-flash-image'; 

export const generateRiskProfile = async (answers: string[]): Promise<string> => {
  try {
    const prompt = `
      You are Bad Bingo, a grumpy, high-stakes gambling alley cat. 
      Analyze these user stats:
      Name: ${answers[0]}
      Stats (Age/Gender): ${answers[1]}
      Territory (Location): ${answers[2]}
      Vice (Addiction): ${answers[3]}
      Source of Income: ${answers[4]}
      
      Create a short, snarky, 2-sentence "Alley Risk Profile". 
      Sound like an old cat who judges humans for a living.
      Be judgmental about their vice and location.
    `;

    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: prompt,
    });

    return response.text || "SMELLS FISHY. CREDIBILITY: LOW.";
  } catch (error) {
    console.error("AI Error:", error);
    return "UNKNOWN STRAY. WATCH YOUR WHISKERS.";
  }
};

export const generateDailyBets = async (
  relationshipLevel: RelationshipLevel,
  friendName: string,
  userRiskProfile: string
): Promise<BetScenario[]> => {
  try {
    let intensityDesc = "Kitten play. Safe and boring.";
    if (relationshipLevel === RelationshipLevel.ROAST) intensityDesc = "Hiss-worthy. Embarrassing habits.";
    if (relationshipLevel === RelationshipLevel.NUCLEAR) intensityDesc = "Stray cat energy. Deep claws, high stakes.";

    const prompt = `
      You are Bad Bingo, the gambling cat. Generate 5 betting statements about ${friendName}.
      Context: ${userRiskProfile}.
      Vibe: ${intensityDesc}.
      
      The bets must be statements starting with "Bet ${friendName}..." 
      Make them sound like cat-whispered gossip or alley wagers.
      Example: "Bet ${friendName} hasn't cleaned their room", "Bet ${friendName} is faking it."
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
    console.error("AI Bet Generation Error:", error);
    return [
      { id: 'err1', text: `Bet ${friendName} is chasing lasers.`, backgroundType: 'bedroom', opponentName: friendName, stake: 50, category: 'Instincts', friendVote: true },
      { id: 'err2', text: `Bet ${friendName} is sleeping on the job.`, backgroundType: 'street', opponentName: friendName, stake: 25, category: 'Habit', friendVote: false }
    ];
  }
};

export const generateTrophyImage = async (winnerName: string, amount: number): Promise<string | null> => {
  try {
    const prompt = `A cyberpunk holographic tarot card. A fat neon cat sitting on a pile of tuna tins. 
    The text "LUCKY CAT ${winnerName}" and "${amount} TUNA" is glowing. 
    Grit, glitch art, acid green and hot pink colors.`;

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