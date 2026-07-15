export function sanitizeGameState(gameState: any) {
  if (!gameState) return null;
  
  // Strip out huge procedural arrays like "world", "objs", "enemies", etc.
  // which are not used by the backend APIs, keeping payload size extremely small.
  return {
    lvl: gameState.lvl || (gameState.pl?.lvl) || 1,
    waveNum: gameState.waveNum || 0,
    day: gameState.day || 1,
    hp: gameState.hp || (gameState.pl?.hp) || 100,
    mhp: gameState.mhp || (gameState.pl?.mhp) || 100,
    inv: gameState.inv || (gameState.pl?.inv) || {},
    mapName: gameState.mapName || "Celestial Plain",
    currentBiome: gameState.currentBiome ? { n: gameState.currentBiome.n } : null,
    pl: gameState.pl ? {
      lvl: gameState.pl.lvl || 1,
      hp: gameState.pl.hp || 100,
      mhp: gameState.pl.mhp || 100,
      inv: gameState.pl.inv || {},
      x: gameState.pl.x || 0,
      y: gameState.pl.y || 0,
    } : null,
  };
}

// --- Client-side Procedural Fallbacks (for robust offline/glitch-free play) ---

export function getProceduralGuidance(gameState: any) {
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

export function getProceduralWorldEvent(gameState: any) {
  const plLvl = gameState?.pl?.lvl || gameState?.lvl || 1;

  const events = [
    {
      title: "Sol-4 Iron Meteor Shower 🌟",
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
      title: "Blistering Solar Flare 🌟",
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
      title: "Wandering Feast Caravan 🌟",
      narrative: "A warm and inviting caravan of celestial merchant chefs arrives, setting up a majestic banquet of cosmic delicacies!",
      durationSeconds: 40,
      effect: {
        type: "blessing",
        description: "Rejuvenating environment: +2.0 Hunger recovery/sec and +2.0 Thirst recovery/sec.",
        statModifiers: {
          speedBoost: 1.0,
          dmgBoost: 1.0,
          manaRegen: 1.0,
          healthDrain: -0.5,
          hungerDrain: -2.0,
          thirstDrain: -2.0
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
      title: "Twilight Void Eclipse 🌟",
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
      title: "Aetherial Mana Storm 🌟",
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
  return selectedEvent;
}

export function getProceduralSpellResult(spellName: string, gameState: any) {
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

// --- Client-side API calls with robust procedural fallbacks ---

export async function getOracleGuidance(gameState: any) {
  try {
    const sanitizedState = sanitizeGameState(gameState);
    const response = await fetch("/api/gemini/guidance", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ gameState: sanitizedState }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.warn("Client getOracleGuidance Error (falling back to procedural):", error);
    const fallback = getProceduralGuidance(gameState);
    return {
      message: fallback.message + " (The cosmic connection was faint, but you hear a whisper...)",
      event: fallback.event,
      eventType: fallback.eventType
    };
  }
}

export async function generateWorldEvent(gameState: any) {
  try {
    const sanitizedState = sanitizeGameState(gameState);
    const response = await fetch("/api/gemini/world-event", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ gameState: sanitizedState }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.warn("Client generateWorldEvent Error (falling back to procedural):", error);
    return getProceduralWorldEvent(gameState);
  }
}

export async function castSpell(spellName: string, gameState: any) {
  try {
    const sanitizedState = sanitizeGameState(gameState);
    const response = await fetch("/api/gemini/cast-spell", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ spellName, gameState: sanitizedState }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.warn("Client castSpell Error (falling back to procedural):", error);
    return getProceduralSpellResult(spellName, gameState);
  }
}
