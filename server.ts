import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());
const PORT = 3000;

// Initialize Google GenAI on the server
const apiKey = process.env.GEMINI_API_KEY || "";
const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// API endpoint for Oracle guidance
app.post("/api/gemini/guidance", async (req, res) => {
  try {
    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is not set on the server.",
        message: "Celestial skies remain silent... Check Secrets settings.",
        eventType: "silence"
      });
    }

    const { gameState } = req.body;
    if (!gameState) {
      return res.status(400).json({ error: "Missing gameState" });
    }

    const prompt = `
      You are the "Celestial Oracle" in a survival RPG game.
      The player is currently at:
      - Level: ${gameState.lvl || 1}
      - Wave: ${gameState.waveNum || 0}
      - Day: ${gameState.day || 1}
      - Health: ${gameState.hp || 100}/${gameState.mhp || 100}
      - Inventory: ${JSON.stringify(gameState.inv || {})}

      Provide a short, cryptic, but helpful piece of advice or a "prophecy" (max 2 sentences).
      Also, suggest a "World Event" that should happen (e.g., "A meteor shower of iron", "A swarm of golden rabbits", "A sudden mana storm").
      Return the response in JSON format.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            message: { type: Type.STRING, description: "Crypetic advice to the player." },
            event: { type: Type.STRING, description: "A short title or desc of the world event suggested." },
            eventType: { type: Type.STRING, description: "One of: meteor, swarm, storm, blessing, curse" }
          },
          required: ["message", "event", "eventType"]
        }
      }
    });

    const text = response.text;
    if (text) {
      return res.json(JSON.parse(text));
    }
    throw new Error("No text returned from Gemini");
  } catch (error: any) {
    console.error("Oracle API Error:", error);
    return res.status(500).json({
      error: error.message || "Failed to generate guidance",
      message: "An echoing cosmic vibration interrupts your query... Try again later.",
      eventType: "error"
    });
  }
});

// API endpoint for periodic World Events
app.post("/api/gemini/world-event", async (req, res) => {
  try {
    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is not set on the server.",
        title: "Stellar Static",
        narrative: "The planetary energy waves are calm for now. Keep gathering resources!",
        effect: {
          type: "none",
          description: "No passive changes are currently active.",
          statModifiers: {}
        }
      });
    }

    const { gameState } = req.body;
    const prompt = `
      You are the "Planetary Overmind" in a magical fantasy survival RPG.
      Create a dynamic, engaging random narrative world event or cosmic challenge for the player based on the current situation:
      - Day: ${gameState?.day || 1}
      - Wave: ${gameState?.waveNum || 0}
      - Map Location: ${gameState?.mapName || "Celestial Plain"}
      - Level: ${gameState?.pl?.lvl || 1}
      - Health: ${gameState?.pl?.hp || 100}/${gameState?.pl?.mhp || 100}
      - Inventory: ${JSON.stringify(gameState?.pl?.inv || {})}

      Generate a creative narrative challenge or world change. It can be a storm, meteor rain, magical eclipse, alien monster invasion, ancient spirit encounter, or a blessing.
      Provide a title, an exciting narrative explanation, a duration in seconds, stat modifiers, resources that might fall from the sky, and two choices/decisions the player can make!
      Return the response in JSON format.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "The title of the random cosmic event." },
            narrative: { type: Type.STRING, description: "A captivating 1-2 sentence description of the event's story." },
            durationSeconds: { type: Type.INTEGER, description: "Duration of the passive effects in seconds (e.g. 45 or 60)." },
            effect: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING, description: "One of: meteor, mana_storm, void_eclipse, blessing, swarm, heatwave, ice_age" },
                description: { type: Type.STRING, description: "A summary of the mechanical effects (e.g., '+50% speed, -10 HP regen')." },
                statModifiers: {
                  type: Type.OBJECT,
                  properties: {
                    speedBoost: { type: Type.NUMBER, description: "Speed multiplier, default 1.0" },
                    dmgBoost: { type: Type.NUMBER, description: "Damage multiplier, default 1.0" },
                    manaRegen: { type: Type.NUMBER, description: "Flat mana regen bonus per tick, e.g. 0.5" },
                    healthDrain: { type: Type.NUMBER, description: "Flat health drain per second, e.g. 1" }
                  }
                },
                spawnResource: { type: Type.STRING, description: "Optional resource key to spawn as meteors (e.g., 'iron_ore', 'crystal', 'void_crystal', 'gem', 'sulfur', 'none')" }
              },
              required: ["type", "description", "statModifiers"]
            },
            choices: {
              type: Type.ARRAY,
              description: "Two distinct choices/challenges presented to the player during this event.",
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  text: { type: Type.STRING, description: "Short description of the option (e.g., 'Channel the mana storm', 'Take shelter')." },
                  requirement: { type: Type.STRING, description: "Optional requirement text (e.g., 'Requires Level 5', 'Requires 5 Crystals', 'None')." },
                  isMet: { type: Type.BOOLEAN, description: "Leave true as default, client will parse requirements." },
                  outcomeDescription: { type: Type.STRING, description: "Narrative outcome of this action." },
                  reward: {
                    type: Type.OBJECT,
                    properties: {
                      item: { type: Type.STRING, description: "Item key rewarded, e.g. 'magic_essence', 'crystal', 'heal_potion', 'none'" },
                      qty: { type: Type.INTEGER },
                      xp: { type: Type.INTEGER },
                      hpChange: { type: Type.INTEGER, description: "e.g. -20 for damage or +30 for heal" }
                    }
                  }
                },
                required: ["id", "text", "outcomeDescription", "reward"]
              }
            }
          },
          required: ["title", "narrative", "durationSeconds", "effect", "choices"]
        }
      }
    });

    const text = response.text;
    if (text) {
      return res.json(JSON.parse(text));
    }
    throw new Error("No text returned from Gemini");
  } catch (error: any) {
    console.error("World Event API Error:", error);
    return res.status(500).json({
      error: error.message || "Failed to generate world event",
      title: "Cosmic Whispers",
      narrative: "A quiet harmonic hum fills the air, calming the native creatures.",
      effect: {
        type: "none",
        description: "Standard planetary status.",
        statModifiers: {}
      }
    });
  }
});

// Serve Vite-managed app
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
