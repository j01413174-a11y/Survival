import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function getOracleGuidance(gameState: any) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `
        You are the "Celestial Oracle" in a survival RPG game. 
        The player is currently at:
        - Level: ${gameState.lvl}
        - Wave: ${gameState.waveNum}
        - Day: ${gameState.day}
        - Current Map: ${gameState.mapName}
        - Health: ${gameState.hp}/${gameState.mhp}
        - Inventory: ${JSON.stringify(gameState.inv)}

        Provide a short, cryptic, but helpful piece of advice or a "prophecy" (max 2 sentences). 
        Also, suggest a "World Event" that should happen (e.g., "A meteor shower of iron", "A swarm of golden rabbits", "A sudden mana storm").
        Return the response in JSON format:
        {
          "message": "The message to the player",
          "event": "A short description of the event",
          "eventType": "one of: meteor, swarm, storm, blessing, curse"
        }
      `,
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text;
    if (text) {
      return JSON.parse(text);
    }
    return null;
  } catch (error) {
    console.error("Gemini Error:", error);
    return null;
  }
}
