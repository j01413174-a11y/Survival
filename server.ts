import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json({ limit: "10mb" }));
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

// --- Procedural Fallbacks when Gemini API is Busy (e.g. 503), Unavailable, or Missing Key ---

function getProceduralGuidance(gameState: any) {
  const day = gameState?.day || 1;
  const lvl = gameState?.lvl || 1;
  const hp = gameState?.hp || 100;

  const advices = [
    `The shadows grow longer on Day ${day}. Seek shelter before the wave of doom breaches your defenses.`,
    `A resonance of gold hums beneath the Celestial Plain... Mine the deposits to trade with the NFT Exchange.`,
    `The elements whisper of a coming storm. Gather wood and stone to build secure fortifications.`,
    `Your level ${lvl} essence is strong, but a dark shadow hovers. Keep your healing pots ready.`,
    `The local wildlife acts strangely. A swarm may be preparing to strike in the coming waves.`,
    `Magic flows through the ley lines. Use your spellbook to reveal unseen deposits or summon a resource bounty.`,
    `As your Health stands at ${hp}%, remember that a Healing Sanctuary spell can mend the deepest of wounds.`
  ];

  const events = [
    { event: "A meteor shower of iron ore", type: "meteor" },
    { event: "A sudden swarm of glowing golden rabbits", type: "swarm" },
    { event: "A violent atmospheric mana storm", type: "storm" },
    { event: "The planetary blessing of fast recovery", type: "blessing" },
    { event: "A crawling eclipse of the void", type: "curse" }
  ];

  const selectedAdvice = advices[Math.floor(Math.random() * advices.length)];
  const selectedEvent = events[Math.floor(Math.random() * events.length)];

  return {
    message: selectedAdvice + " (Guided by the Inner Oracle)",
    event: selectedEvent.event,
    eventType: selectedEvent.type
  };
}

function getProceduralWorldEvent(gameState: any) {
  const plLvl = gameState?.pl?.lvl || gameState?.lvl || 1;

  const events = [
    {
      title: "Sol-4 Iron Meteor Shower",
      narrative: "A cascade of burning metal enters the upper atmosphere, raining blazing iron deposits onto the plains!",
      durationSeconds: 45,
      effect: {
        type: "meteor",
        description: "+20% speed but small debris fire hazard.",
        statModifiers: {
          speedBoost: 1.2,
          dmgBoost: 1.0,
          manaRegen: 0,
          healthDrain: 0.2,
          hungerDrain: 0.1,
          thirstDrain: 0.1
        },
        spawnResource: "iron_ore"
      },
      choices: [
        {
          id: "meteor_choice_1",
          text: "Channel the Asteroid Core",
          requirement: plLvl >= 3 ? "None" : "Requires Level 3",
          isMet: plLvl >= 3,
          outcomeDescription: "You channel the raw cosmic heat of the falling rocks, materializing cosmic crystals at the cost of some burns.",
          reward: {
            item: "crystal",
            qty: 3,
            xp: 50,
            hpChange: -15,
            huChange: -10,
            thChange: -10
          }
        },
        {
          id: "meteor_choice_2",
          text: "Gather fallen fragments",
          requirement: "None",
          isMet: true,
          outcomeDescription: "You play it safe, gathering pieces of wood to insulate against heat while collecting iron chunks.",
          reward: {
            item: "iron_bar",
            qty: 1,
            xp: 15,
            hpChange: 0,
            huChange: 0,
            thChange: 0
          }
        }
      ]
    },
    {
      title: "Blistering Solar Flare",
      narrative: "A blazing pulse of extreme cosmic radiation envelopes the biome, causing rapid dehydration and stamina depletion!",
      durationSeconds: 50,
      effect: {
        type: "heatwave",
        description: "+15% run speed, but -1.0 Thirst/sec and -0.2 Health/sec.",
        statModifiers: {
          speedBoost: 1.15,
          dmgBoost: 1.0,
          manaRegen: 0,
          healthDrain: 0.2,
          hungerDrain: 0.0,
          thirstDrain: 1.0
        },
        spawnResource: "sulfur"
      },
      choices: [
        {
          id: "heat_choice_1",
          text: "Guzzle Water Reserve",
          requirement: "None",
          isMet: true,
          outcomeDescription: "You immediately hydrate yourself using pristine local dew, stabilizing your energy.",
          reward: {
            item: "none",
            qty: 0,
            xp: 25,
            hpChange: 5,
            huChange: 0,
            thChange: 60
          }
        },
        {
          id: "heat_choice_2",
          text: "Endure and Harvest Crystals",
          requirement: "None",
          isMet: true,
          outcomeDescription: "You ignore the heat, pushing through severe dry throat to chisel out heat-resistant energy crystals.",
          reward: {
            item: "crystal",
            qty: 2,
            xp: 50,
            hpChange: -10,
            huChange: -15,
            thChange: -40
          }
        }
      ]
    },
    {
      title: "Wandering Feast Caravan",
      narrative: "A warm and inviting caravan of celestial merchant chefs arrives, setting up a majestic banquet of cosmic delicacies!",
      durationSeconds: 40,
      effect: {
        type: "blessing",
        description: "Rejuvenating environment: +2.0 Hunger recovery/sec and +2.0 Thirst recovery/sec.",
        statModifiers: {
          speedBoost: 1.0,
          dmgBoost: 1.0,
          manaRegen: 1.0,
          healthDrain: -0.5, // heals!
          hungerDrain: -2.0, // restores hunger!
          thirstDrain: -2.0  // restores thirst!
        },
        spawnResource: "none"
      },
      choices: [
        {
          id: "merchant_choice_1",
          text: "Partake in the Grand Feast",
          requirement: "None",
          isMet: true,
          outcomeDescription: "You sit at the grand mahogany table, feasting on rich roasted celestial beasts and drinking pristine nectar! Your body and soul are completely replenished.",
          reward: {
            item: "cooked_meat",
            qty: 2,
            xp: 40,
            hpChange: 50,
            huChange: 100,
            thChange: 100
          }
        },
        {
          id: "merchant_choice_2",
          text: "Trade with the Spice Merchants",
          requirement: "None",
          isMet: true,
          outcomeDescription: "You trade gold coins to buy a stock of rare nourishing provisions for the harsh journey ahead.",
          reward: {
            item: "celestial_fish",
            qty: 1,
            xp: 30,
            hpChange: 10,
            huChange: 40,
            thChange: 40
          }
        }
      ]
    },
    {
      title: "Twilight Void Eclipse",
      narrative: "A pitch-black moon blocks out the local suns, unleashing dark energies that weaken monsters but drain the life of the living.",
      durationSeconds: 60,
      effect: {
        type: "void_eclipse",
        description: "-20% speed, but +50% weapon damage as dark cosmic energy infuses your weapon.",
        statModifiers: {
          speedBoost: 0.8,
          dmgBoost: 1.5,
          manaRegen: 1.0,
          healthDrain: 0.5,
          hungerDrain: 0.2,
          thirstDrain: 0.3
        },
        spawnResource: "void_crystal"
      },
      choices: [
        {
          id: "void_choice_1",
          text: "Absorb the Twilight Energy",
          requirement: plLvl >= 5 ? "None" : "Requires Level 5",
          isMet: plLvl >= 5,
          outcomeDescription: "You embrace the shadow. It burns your life force but rewards you with a pure void crystal.",
          reward: {
            item: "void_crystal",
            qty: 1,
            xp: 80,
            hpChange: -30,
            huChange: -15,
            thChange: -15
          }
        },
        {
          id: "void_choice_2",
          text: "Offer Sacrificial Shards",
          requirement: "None",
          isMet: true,
          outcomeDescription: "You burn small ritual magic essences to purify your immediate surroundings, calming the shadows.",
          reward: {
            item: "magic_essence",
            qty: 2,
            xp: 30,
            hpChange: 15,
            huChange: 20,
            thChange: 20
          }
        }
      ]
    },
    {
      title: "Aetherial Mana Storm",
      narrative: "Glowing aurora waves wash over the sector, overloading the local ley-lines and offering limitless spell power!",
      durationSeconds: 50,
      effect: {
        type: "mana_storm",
        description: "+3.0 Mana Regen, +15% run speed.",
        statModifiers: {
          speedBoost: 1.15,
          dmgBoost: 1.0,
          manaRegen: 3.0,
          healthDrain: 0,
          hungerDrain: 0.1,
          thirstDrain: 0.1
        },
        spawnResource: "crystal"
      },
      choices: [
        {
          id: "mana_choice_1",
          text: "Siphon the Ley Lines",
          requirement: "None",
          isMet: true,
          outcomeDescription: "You weave an energy siphon, draining the air's latent power into raw mana crystals.",
          reward: {
            item: "mana_crystal",
            qty: 2,
            xp: 40,
            hpChange: 0,
            huChange: -5,
            thChange: -10
          }
        },
        {
          id: "mana_choice_2",
          text: "Fortify Core Mana",
          requirement: "None",
          isMet: true,
          outcomeDescription: "You channel the raw magical winds directly to heal your soul and solidify essence.",
          reward: {
            item: "magic_essence",
            qty: 3,
            xp: 25,
            hpChange: 20,
            huChange: 10,
            thChange: 10
          }
        }
      ]
    }
  ];

  const selectedEvent = events[Math.floor(Math.random() * events.length)];
  return {
    ...selectedEvent,
    title: selectedEvent.title + " 🌟"
  };
}

function getProceduralSpellResult(spellName: string, gameState: any) {
  const currentBiomeName = gameState?.currentBiome?.n || "Forest";
  const plX = gameState?.pl?.x ? Math.floor(gameState.pl.x / 32) : 40;
  const plY = gameState?.pl?.y ? Math.floor(gameState.pl.y / 32) : 40;

  if (spellName === "Reveal Map") {
    const scoutedNodes = [
      { type: "void_crystal", tx: plX + 4, ty: plY - 3, description: "A deep pulsing purple crystal node detected nearby." },
      { type: "gold", tx: plX - 5, ty: plY + 5, description: "A soft glittering gold deposit shining through the dirt." },
      { type: "mithril", tx: plX + 7, ty: plY + 2, description: "A high-frequency silver-blue vein whispering in the ground." }
    ];
    return {
      success: true,
      message: "The cosmic leylines resonate! The local coordinates of rare deposits have been scryed and marked on your map. (Procedural scrying)",
      scoutedNodes
    };
  }

  if (spellName === "Resource Bounty") {
    const spawnDrops = [];
    const lowerBiome = currentBiomeName.toLowerCase();
    if (lowerBiome.includes("desert")) {
      spawnDrops.push({ item: "copper_ore", qty: 3, dx: -2, dy: 1 });
      spawnDrops.push({ item: "gold_ore", qty: 2, dx: 1, dy: -2 });
    } else if (lowerBiome.includes("frozen") || lowerBiome.includes("tundra")) {
      spawnDrops.push({ item: "iron_ore", qty: 3, dx: -1, dy: -1 });
      spawnDrops.push({ item: "crystal", qty: 2, dx: 2, dy: 1 });
    } else if (lowerBiome.includes("celestial")) {
      spawnDrops.push({ item: "magic_essence", qty: 2, dx: 0, dy: 2 });
      spawnDrops.push({ item: "void_crystal", qty: 1, dx: -2, dy: -2 });
      spawnDrops.push({ item: "crystal", qty: 2, dx: 1, dy: 1 });
    } else {
      spawnDrops.push({ item: "wood", qty: 4, dx: -1, dy: 1 });
      spawnDrops.push({ item: "copper_ore", qty: 2, dx: 2, dy: -1 });
      spawnDrops.push({ item: "berry", qty: 3, dx: 0, dy: -2 });
    }
    return {
      success: true,
      message: `Bounty of the ${currentBiomeName}! Raw elemental particles condense and drop directly from the sky. (Procedural condensation)`,
      spawnDrops
    };
  }

  if (spellName === "Healing Sanctuary") {
    return {
      success: true,
      message: "A restorative circle of stellar rejuvenation envelopes you, healing your wounds and boosting your movement speed. (Procedural restore)",
      restoration: {
        healHP: 50,
        foodBonus: 20,
        buff: {
          name: "Restorative Sanctuary",
          speedMultiplier: 1.25,
          defenseBonus: 5,
          durationSeconds: 45
        }
      }
    };
  }

  if (spellName === "Flame Burst") {
    return {
      success: true,
      message: "A roaring ring of elemental fire expands from your fingertips, burning and blasting back all nearby monsters! (Procedural blast)",
      damage: 75
    };
  }

  if (spellName === "Tectonic Rift") {
    return {
      success: true,
      message: "The ground splits as intense magnetic rifts shatter nearby rock veins and uproot nearby trees, yielding pristine materials! (Procedural gathering)",
      harvestRange: 150
    };
  }

  // Default: Heal
  return {
    success: true,
    message: "A warm, radiant mending spell closes your physical wounds and restores vitality. (Procedural mending)",
    restoration: {
      healHP: 40,
      foodBonus: 0
    }
  };
}

// Robust helper to query Gemini with retry and fallback models
async function callGeminiWithFallback(params: { contents: any; config: any }) {
  const modelsToTry = [
    "gemini-3.5-flash",
    "gemini-flash-latest",
    "gemini-3.1-flash-lite"
  ];

  let lastError = null;
  for (const modelName of modelsToTry) {
    try {
      console.log(`Attempting Gemini API request with model: ${modelName}`);
      const response = await ai.models.generateContent({
        model: modelName,
        contents: params.contents,
        config: params.config
      });
      if (response && response.text) {
        return response;
      }
    } catch (e: any) {
      lastError = e;
      console.log(`Gemini model ${modelName} was busy or rate-limited. Trying another model...`);
    }
  }
  throw lastError || new Error("All fallback models were busy.");
}

// API endpoint for Oracle guidance
app.post("/api/gemini/guidance", async (req, res) => {
  const { gameState } = req.body;
  if (!gameState) {
    return res.status(400).json({ error: "Missing gameState" });
  }

  try {
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not set on the server. Falling back to procedural guidance.");
      return res.json(getProceduralGuidance(gameState));
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

    const response = await callGeminiWithFallback({
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
    console.warn("Oracle API (handled fallback):", error.message || error);
    // Graceful procedural fallback to never fail the user's game experience
    return res.json(getProceduralGuidance(gameState));
  }
});

// API endpoint for periodic World Events
app.post("/api/gemini/world-event", async (req, res) => {
  const { gameState } = req.body;

  try {
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not set on the server. Falling back to procedural world event.");
      return res.json(getProceduralWorldEvent(gameState));
    }

    const prompt = `
      You are the "Planetary Overmind" in a magical fantasy survival RPG.
      Create a dynamic, engaging random narrative world event or cosmic challenge for the player based on the current situation:
      - Day: ${gameState?.day || 1}
      - Wave: ${gameState?.waveNum || 0}
      - Map Location: ${gameState?.mapName || "Celestial Plain"}
      - Level: ${gameState?.pl?.lvl || 1}
      - Health: ${gameState?.pl?.hp || 100}/${gameState?.pl?.mhp || 100}
      - Hunger: ${gameState?.pl?.hu || 100}%
      - Thirst: ${gameState?.pl?.th || 100}%
      - Inventory: ${JSON.stringify(gameState?.pl?.inv || {})}

      Generate a creative narrative challenge or world change. It can be a storm, heatwave, blizzard, merchant caravan arrival, cosmic eclipse, or mystical blessing.
      CRITICAL REQUIREMENT: The event or the choices MUST modify or affect the player's health, hunger, or thirst levels.
      For example:
      - A solar heatwave might cause rapid Thirst depletion (positive thirstDrain) or damage (healthDrain).
      - A celestial merchant arrival might offer nourishing food/potions (rewarding huChange or thChange).
      - A wild sandstorm might cause physical distress, reducing Health (healthDrain) and Hunger.
      
      Provide a title, an exciting narrative explanation, a duration in seconds, stat modifiers, resources that might fall from the sky, and two choices/decisions the player can make!
      Return the response in JSON format.
    `;

    const response = await callGeminiWithFallback({
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
                    healthDrain: { type: Type.NUMBER, description: "Flat health drain per second, positive drains, negative restores. Default 0." },
                    hungerDrain: { type: Type.NUMBER, description: "Flat hunger drain per second, positive drains hunger, negative restores. Default 0." },
                    thirstDrain: { type: Type.NUMBER, description: "Flat thirst drain per second, positive drains thirst, negative restores. Default 0." }
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
                      hpChange: { type: Type.INTEGER, description: "e.g. -20 for damage or +30 for heal" },
                      huChange: { type: Type.INTEGER, description: "e.g. -20 for hunger drain or +35 for food, default 0" },
                      thChange: { type: Type.INTEGER, description: "e.g. -25 for thirst drain or +40 for water, default 0" }
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
    console.warn("World Event API (handled fallback):", error.message || error);
    // Graceful procedural fallback
    return res.json(getProceduralWorldEvent(gameState));
  }
});

// API endpoint for Spellcasting
app.post("/api/gemini/cast-spell", async (req, res) => {
  const { spellName, gameState } = req.body;
  if (!spellName || !gameState) {
    return res.status(400).json({ error: "Missing spellName or gameState" });
  }

  try {
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not set on the server. Falling back to procedural spell casting.");
      return res.json(getProceduralSpellResult(spellName, gameState));
    }

    const currentBiomeName = gameState.currentBiome?.n || "Unknown Biome";
    const plLvl = gameState.pl?.lvl || 1;
    const plX = gameState.pl?.x ? Math.floor(gameState.pl.x / 32) : 40;
    const plY = gameState.pl?.y ? Math.floor(gameState.pl.y / 32) : 40;

    const prompt = `
      You are the "Weaver of Magic" in a cosmic fantasy survival RPG.
      The player has just cast the magic spell: "${spellName}".
      
      Here is the current situation of the player:
      - Current Biome: ${currentBiomeName}
      - Coordinate Tile: (${plX}, ${plY})
      - Player Level: ${plLvl}
      - Inventory: ${JSON.stringify(gameState.pl?.inv || {})}
      
      Interpret the spell's effect and return a JSON response with high-value mechanical actions and immersive lore.
      
      Depending on the spell name, craft specific rewards:
      
      1. For "Reveal Map":
         The spell acts as a scrying oracle. Highlight 4 to 6 locations of extremely rare ore nodes or plants in the player's vicinity (e.g. within 15 tiles of X:${plX}, Y:${plY}).
         Return an array of "scoutedNodes" with item type, coordinates (randomized but realistic tile offsets, e.g. within -15 to +15 of the player's current tile), and brief reason.
         Provide a beautiful astral revelation message describing how the universe reveals its secrets to the player.
         
      2. For "Resource Bounty":
         The spell pulls raw resources out of the astral clouds, condensation of the current biome.
         Create an array of "spawnDrops" specifying items to drop on the ground near the player (e.g. within 3-6 tiles of (${plX}, ${plY})).
         - If in a Desert biome: spawn cactus_fruit, copper_ore, gold_ore, sulfur.
         - If in a Frozen/Tundra biome: spawn snowberry, iron_ore, crystal.
         - If in a Celestial biome: spawn magic_essence, void_crystal, celestial_shard, crystal.
         - If in a Volcanic/Scorched biome: spawn sulfur, coal, iron_ore, obsidian.
         - Else (Forest/Plains): spawn wood, stick, herb, berry, copper_ore.
         Provide a narrative "revelation" of how these resources materialized (e.g., "A glittering meteor of pure cosmic crystal vaporizes and showers the earth with glowing shards").
         
      3. For "Healing Sanctuary":
         Casts a restorative circle of rejuvenation.
         Return the restoration values: healHP (integer 40 to 60), foodBonus (integer 15 to 30), and stats buff details (e.g., speedMultiplier: 1.25, defenseBonus: 5, durationSeconds: 45).
         Provide a soothing, comforting message of divine wellness.

      4. For "Heal":
         Casts a direct focal mending spell.
         Return the restoration values: healHP (integer 35 to 55), foodBonus (0).
         Provide a warm, restorative, soothing description of wounds closing.

      5. For "Flame Burst":
         Unleashes a fierce circle of roaring fire, pushing back and searing all enemies nearby.
         Return a "damage" field with an integer between 60 and 90, representing the heat damage.
         Provide a dramatic description of the blazing shockwave incinerating the darkness.

      6. For "Tectonic Rift":
         Fissions the ground with localized magnetic earthquakes to instantly extract and drop ores and wood from any nearby trees, boulders, or mineral deposits.
         Return a "harvestRange" field with value 150 (representing the radius of physical disruption).
         Provide a heavy, physical description of the earth rumbling and ejecting raw resources from underground deposits.
         
      Return the response in JSON format.
    `;

    const response = await callGeminiWithFallback({
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            success: { type: Type.BOOLEAN, description: "True if spell succeeded" },
            message: { type: Type.STRING, description: "Narrative lore/description of the magical phenomenon." },
            damage: { type: Type.INTEGER, description: "Direct elemental fire damage inflicted to nearby enemies (only for Flame Burst)." },
            harvestRange: { type: Type.INTEGER, description: "The radius of geological disruption for resource gathering (only for Tectonic Rift)." },
            scoutedNodes: {
              type: Type.ARRAY,
              description: "List of rare resource nodes discovered near the player (only for Reveal Map).",
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING, description: "e.g., void_crystal, celestial, gold, mithril, crystal, gem" },
                  tx: { type: Type.INTEGER, description: "X tile coordinate" },
                  ty: { type: Type.INTEGER, description: "Y tile coordinate" },
                  description: { type: Type.STRING, description: "e.g., 'A pulsing purple void crystal deep in the dirt.'" }
                },
                required: ["type", "tx", "ty", "description"]
              }
            },
            spawnDrops: {
              type: Type.ARRAY,
              description: "Items spawned on the ground around the player (only for Resource Bounty).",
              items: {
                type: Type.OBJECT,
                properties: {
                  item: { type: Type.STRING, description: "Item key, e.g. 'magic_essence', 'gold_ore', 'crystal', 'wood', 'gem'" },
                  qty: { type: Type.INTEGER, description: "Quantity of item" },
                  dx: { type: Type.INTEGER, description: "Tile delta X relative to player (e.g. -4 to 4)" },
                  dy: { type: Type.INTEGER, description: "Tile delta Y relative to player (e.g. -4 to 4)" }
                },
                required: ["item", "qty", "dx", "dy"]
              }
            },
            restoration: {
              type: Type.OBJECT,
              description: "Healing and Rejuvenation stats (only for Healing Sanctuary).",
              properties: {
                healHP: { type: Type.INTEGER },
                foodBonus: { type: Type.INTEGER },
                buff: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    speedMultiplier: { type: Type.NUMBER },
                    defenseBonus: { type: Type.INTEGER },
                    durationSeconds: { type: Type.INTEGER }
                  },
                  required: ["name", "speedMultiplier", "defenseBonus", "durationSeconds"]
                }
              },
              required: ["healHP", "foodBonus"]
            }
          },
          required: ["success", "message"]
        }
      }
    });

    const text = response.text;
    if (text) {
      return res.json(JSON.parse(text));
    }
    throw new Error("No text returned from Gemini");
  } catch (error: any) {
    console.warn("Cast Spell API (handled fallback):", error.message || error);
    // Graceful procedural fallback
    return res.json(getProceduralSpellResult(spellName, gameState));
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
