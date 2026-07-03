import React from 'react';
import { motion } from 'motion/react';
import { X, MessageSquare, Sparkles, Heart, Compass, Music } from 'lucide-react';

interface NPCDialogueProps {
  npc: any;
  onClose: () => void;
  gameState: any;
  setGameState: (state: any) => void;
  addLog: (msg: string, col: string) => void;
  spawnExplosion: (col: string, count: number, style: string) => void;
}

export default function NPCDialogue({
  npc,
  onClose,
  gameState,
  setGameState,
  addLog,
  spawnExplosion,
}: NPCDialogueProps) {
  if (!gameState || !gameState.pl) return null;

  const pl = gameState.pl;
  const inv = pl.inv || {};

  // Find NPC Name and Ico
  let title = "Friendly Local";
  let subtitle = "Special Encounter";
  let intro = "Hello there, adventurer!";
  let icon = npc.ico || "🧔";

  if (npc.type === 'lost_explorer') {
    title = "Lost Explorer";
    subtitle = "Veteran Cartographer";
    intro = "Greetings, traveler! I have mapped these continuous biomes for seasons. The layout is vast, filled with hidden ruins and danger!";
  } else if (npc.type === 'elven_druid') {
    title = "Elven Druid";
    subtitle = "Keeper of the Grove";
    intro = "Blessings of the ancient spirits upon you. The leylines hum with your footsteps. How can I aid you today?";
  } else if (npc.type === 'tame_dog') {
    title = "Tame Dog";
    subtitle = "A loyal stray";
    intro = "Woof! *pant pant* The pup wag-wags its tail excitedly, looking at you with shiny, hopeful eyes.";
  } else if (npc.type === 'tavern_bard') {
    title = "Tavern Bard";
    subtitle = "Master of Ballads";
    intro = "Ah, a fresh face! I am writing the Grand Ballad of the ultimate survivor. Care for a song, or perhaps some witty banter?";
  }

  // Handle specific interactions
  const handleDirections = () => {
    const hints = [
      "The Bandit Outpost lies in sectors (2,1) and (5,3). They protect a heavy chest of gold coins and materials!",
      "Ancient Ruins contain mystical Carvings and Echoes. Analyze them to decode rare crafting formulas!",
      "Lava fields are hazardous, but Volcanic biomes contain rich deposits of Sulfur and Magma Cod.",
      "In the Frozen Tundra, look for Giant Redwoods. They have high HP but drop massive lumber and precious Amber!",
      "Celestial biomes spawn Void Crystals and Celestial Shards. Harvest them to craft elite interstellar staves!",
      "Glow Sheep graze in Enchanted Groves. They glow in the dark and can be sheared for Silk and Fiber!"
    ];
    const hint = hints[Math.floor(Math.random() * hints.length)];
    addLog(`🧭 Explorer's Log: "${hint}"`, '#38bdf8');
    spawnExplosion('#38bdf8', 12, 'spark');
    onClose();
  };

  const handleExplorerFeed = () => {
    const hasMeat = (inv.meat || 0) >= 1;
    const hasFish = (inv.raw_fish || 0) >= 1;
    const hasCookedFish = (inv.cooked_fish || 0) >= 1;

    if (!hasMeat && !hasFish && !hasCookedFish) {
      addLog("❌ You don't have any raw meat or fish to offer!", '#ef4444');
      return;
    }

    const s = { ...gameState };
    if (hasMeat) s.pl.inv.meat--;
    else if (hasFish) s.pl.inv.raw_fish--;
    else if (hasCookedFish) s.pl.inv.cooked_fish--;

    // Reward
    const roll = Math.random();
    let rewardItem = 'steel_bar';
    let rewardQty = 1;
    let rewardColor = '#94a3b8';

    if (roll < 0.4) {
      rewardItem = 'steel_bar';
      rewardQty = 1;
      rewardColor = '#818cf8';
    } else if (roll < 0.7) {
      rewardItem = 'gem';
      rewardQty = 1;
      rewardColor = '#ec4899';
    } else if (roll < 0.9) {
      rewardItem = 'void_crystal';
      rewardQty = 1;
      rewardColor = '#c084fc';
    } else {
      rewardItem = 'celestial_shard';
      rewardQty = 1;
      rewardColor = '#22d3ee';
    }

    s.pl.inv[rewardItem] = (s.pl.inv[rewardItem] || 0) + rewardQty;
    addLog(`🧭 Explorer: "Ah, scrumptious! Thank you, friend. Here is a relic I recovered on my travels: +${rewardItem.replace('_', ' ')} x${rewardQty}!"`, '#22c55e');
    spawnExplosion(rewardColor, 20, 'spell');
    setGameState(s);
    onClose();
  };

  const handleDruidWisdom = () => {
    const wisdoms = [
      "Blossom trees in Enchanted biomes yield Astral Flowers, crucial for crafting spiritual attire.",
      "Animal tracks are fresh! Finding them grants Hunting XP and maps a shining trail to nearby wild game.",
      "Cactus Fruits are sweet and restore both hunger and thirst. Essential for desert survival!",
      "Golden Maples yield Maple Syrup, an outstanding delicacy that fully rejuvenates your physical Stamina!",
      "Mithril is the strongest common metal. Mine it with a steel pickaxe to craft the ultimate weapons."
    ];
    const wisdom = wisdoms[Math.floor(Math.random() * wisdoms.length)];
    addLog(`🧝‍♀️ Druid Wisdom: "${wisdom}"`, '#a78bfa');
    spawnExplosion('#a78bfa', 12, 'spell');
    onClose();
  };

  const handleDruidHeal = () => {
    if ((inv.herb || 0) < 5) {
      addLog("❌ You need at least 5 Herbs to request a healing spell!", '#ef4444');
      return;
    }

    const s = { ...gameState };
    s.pl.inv.herb -= 5;
    s.pl.hp = s.pl.mhp;
    s.pl.mp = s.pl.mmp;

    addLog(`🧝‍♀️ Druid: "Let the light of the forest flow through you." HP and MP fully restored!`, '#10b981');
    spawnExplosion('#10b981', 30, 'spell');
    setGameState(s);
    onClose();
  };

  const handleDruidPotion = () => {
    if ((inv.berry || 0) < 10) {
      addLog("❌ You need at least 10 Berries for potion synthesis!", '#ef4444');
      return;
    }

    const s = { ...gameState };
    s.pl.inv.berry -= 10;
    s.pl.inv.heal_potion = (s.pl.inv.heal_potion || 0) + 1;

    addLog(`🧝‍♀️ Druid: "The wild berries have been purified." +1 Heal Potion crafted!`, '#22c55e');
    spawnExplosion('#38bdf8', 20, 'spark');
    setGameState(s);
    onClose();
  };

  const handlePetDog = () => {
    const s = { ...gameState };
    s.pl.sta = Math.min(100, (s.pl.sta || 100) + 30);

    addLog(`🐕 Dog: "Woof woof!" *tail wags furiously* You scratch behind his ears. He looks incredibly happy! (+30 Stamina)`, '#f472b6');
    spawnExplosion('#ec4899', 15, 'spark');
    setGameState(s);
    onClose();
  };

  const handleFeedDog = () => {
    if ((inv.meat || 0) < 1) {
      addLog("❌ You don't have any Raw Meat to feed the dog!", '#ef4444');
      return;
    }

    const s = { ...gameState };
    s.pl.inv.meat--;

    const roll = Math.random();
    let digItem = 'bone';
    let digQty = 3;
    let digMsg = "";

    if (roll < 0.4) {
      digItem = 'bone';
      digQty = 3;
      s.pl.inv.gold_coins = (s.pl.inv.gold_coins || 0) + 50;
      digMsg = `uncovered 3 bones and dug up 🪙50 Gold Coins!`;
    } else if (roll < 0.7) {
      digItem = 'flint';
      digQty = 4;
      s.pl.inv.stick = (s.pl.inv.stick || 0) + 5;
      digMsg = `found 4 Flint and dug up 5 Sticks!`;
    } else if (roll < 0.85) {
      digItem = 'stamina_ring';
      digQty = 1;
      digMsg = `unearthed a rare, shiny Stamina Ring! 💍`;
    } else {
      digItem = 'health_ring';
      digQty = 1;
      digMsg = `unearthed a legendary, glowing Vitality Ring! 💍`;
    }

    s.pl.inv[digItem] = (s.pl.inv[digItem] || 0) + digQty;
    addLog(`🐕 The dog happily devours the meat, sniffs the ground, and digs up a hidden spot... He ${digMsg}!`, '#eab308');
    spawnExplosion('#b45309', 25, 'spark'); // Dirt blast
    setGameState(s);
    onClose();
  };

  const handleBardJoke = () => {
    const jokes = [
      "Why did the zombie go to the alchemist? He wanted to improve his 'dead'-ication!",
      "Why are skeleton archers so bad at keeping secrets? Because you can see right through them!",
      "Why don't Golems ever get tired? Because they have rock-solid determination!",
      "What is a dragon's favorite food? Golden 'toast'-ed knights!"
    ];
    const joke = jokes[Math.floor(Math.random() * jokes.length)];
    addLog(`🪕 Bard: "${joke}"`, '#f43f5e');
    spawnExplosion('#f43f5e', 12, 'spark');
    onClose();
  };

  const handleBardSong = () => {
    if ((inv.gold_coins || 0) < 15) {
      addLog("❌ You don't have 15 Gold Coins to pay the bard!", '#ef4444');
      return;
    }

    const s = { ...gameState };
    s.pl.inv.gold_coins -= 15;
    s.pl.sta = 100; // Full Stamina
    s.pl.mp = Math.min(s.pl.mmp, (s.pl.mp || 100) + 25);
    s.pl.slowTicks = 0; // Cure slows

    addLog(`🪕 The Bard performs a thrilling tavern song! You feel incredibly inspired! Stamina fully restored, +25 MP, Slows cured!`, '#f43f5e');
    spawnExplosion('#ff00aa', 25, 'spell');
    setGameState(s);
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="max-w-md w-full bg-zinc-950 border border-cyan-500/30 rounded-3xl p-6 shadow-[0_0_50px_rgba(6,182,212,0.15)] text-white font-mono pointer-events-auto">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-white/10 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <span className="text-4xl filter drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]">{icon}</span>
            <div>
              <h2 className="text-lg font-bold tracking-wider text-cyan-400">{title}</h2>
              <p className="text-[10px] text-zinc-400 uppercase mt-0.5">{subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all cursor-pointer text-zinc-400 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {/* Dialog bubble */}
        <div className="relative bg-zinc-900/60 border border-white/5 p-4 rounded-2xl text-xs leading-relaxed text-zinc-300 italic mb-6">
          <div className="absolute -top-1.5 left-6 w-3 h-3 bg-zinc-900 border-l border-t border-white/5 rotate-45" />
          "{intro}"
        </div>

        {/* Options */}
        <div className="flex flex-col gap-2.5">
          {npc.type === 'lost_explorer' && (
            <>
              <button
                onClick={handleDirections}
                className="w-full py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/5 hover:border-cyan-500/40 text-left text-xs text-zinc-200 hover:text-white transition-all duration-200 flex items-center gap-2 cursor-pointer"
              >
                <Compass size={14} className="text-cyan-400" />
                <div className="flex flex-col">
                  <span className="font-bold">Ask for Directions</span>
                  <span className="text-[9px] opacity-50">Tells a randomized tip about a key landmark or biome</span>
                </div>
              </button>

              <button
                onClick={handleExplorerFeed}
                className="w-full py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/5 hover:border-emerald-500/40 text-left text-xs text-zinc-200 hover:text-white transition-all duration-200 flex items-center gap-2 cursor-pointer"
              >
                <MessageSquare size={14} className="text-emerald-400" />
                <div className="flex flex-col">
                  <span className="font-bold">Share Provisions (1 Meat or Raw Fish)</span>
                  <span className="text-[9px] opacity-50">Exchange raw meat/fish for a high-value steel bar or gem</span>
                </div>
              </button>
            </>
          )}

          {npc.type === 'elven_druid' && (
            <>
              <button
                onClick={handleDruidWisdom}
                className="w-full py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/5 hover:border-purple-500/40 text-left text-xs text-zinc-200 hover:text-white transition-all duration-200 flex items-center gap-2 cursor-pointer"
              >
                <Sparkles size={14} className="text-purple-400" />
                <div className="flex flex-col">
                  <span className="font-bold">Request Wisdom</span>
                  <span className="text-[9px] opacity-50">Learn deep forest knowledge about trees, crops, or skills</span>
                </div>
              </button>

              <button
                onClick={handleDruidHeal}
                className="w-full py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/5 hover:border-emerald-500/40 text-left text-xs text-zinc-200 hover:text-white transition-all duration-200 flex items-center gap-2 cursor-pointer"
              >
                <Heart size={14} className="text-emerald-400" />
                <div className="flex flex-col">
                  <span className="font-bold">Healing Touch (Requires 5 Herbs 🌱)</span>
                  <span className="text-[9px] opacity-50">Fully restore Health and Mana instantly</span>
                </div>
              </button>

              <button
                onClick={handleDruidPotion}
                className="w-full py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/5 hover:border-cyan-500/40 text-left text-xs text-zinc-200 hover:text-white transition-all duration-200 flex items-center gap-2 cursor-pointer"
              >
                <Sparkles size={14} className="text-cyan-400" />
                <div className="flex flex-col">
                  <span className="font-bold">Brew Health Potion (Requires 10 Berries 🫐)</span>
                  <span className="text-[9px] opacity-50">Transmute common woodland berries into a high-grade potion</span>
                </div>
              </button>
            </>
          )}

          {npc.type === 'tame_dog' && (
            <>
              <button
                onClick={handlePetDog}
                className="w-full py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/5 hover:border-rose-500/40 text-left text-xs text-zinc-200 hover:text-white transition-all duration-200 flex items-center gap-2 cursor-pointer"
              >
                <Heart size={14} className="text-rose-400" />
                <div className="flex flex-col">
                  <span className="font-bold">Pet the Dog</span>
                  <span className="text-[9px] opacity-50">Gives head scratches. Restores +30 Stamina!</span>
                </div>
              </button>

              <button
                onClick={handleFeedDog}
                className="w-full py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/5 hover:border-yellow-500/40 text-left text-xs text-zinc-200 hover:text-white transition-all duration-200 flex items-center gap-2 cursor-pointer"
              >
                <Sparkles size={14} className="text-yellow-400" />
                <div className="flex flex-col">
                  <span className="font-bold">Feed Raw Meat (1 Meat 🥩)</span>
                  <span className="text-[9px] opacity-50">Give food to have him dig up bones, gold, or a rare ring!</span>
                </div>
              </button>
            </>
          )}

          {npc.type === 'tavern_bard' && (
            <>
              <button
                onClick={handleBardJoke}
                className="w-full py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/5 hover:border-rose-500/40 text-left text-xs text-zinc-200 hover:text-white transition-all duration-200 flex items-center gap-2 cursor-pointer"
              >
                <MessageSquare size={14} className="text-rose-400" />
                <div className="flex flex-col">
                  <span className="font-bold">Listen to a Joke</span>
                  <span className="text-[9px] opacity-50">Hear a witty survivor pun from the high road</span>
                </div>
              </button>

              <button
                onClick={handleBardSong}
                className="w-full py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/5 hover:border-yellow-500/40 text-left text-xs text-zinc-200 hover:text-white transition-all duration-200 flex items-center gap-2 cursor-pointer"
              >
                <Music size={14} className="text-yellow-400" />
                <div className="flex flex-col">
                  <span className="font-bold">Inspiring Ballad (Costs 15 Gold 🪙)</span>
                  <span className="text-[9px] opacity-50">Restores full Stamina, +25 MP, and cures any slow effects</span>
                </div>
              </button>
            </>
          )}

          <button
            onClick={onClose}
            className="w-full py-2 bg-zinc-950 hover:bg-zinc-900 text-zinc-400 hover:text-white font-bold border border-white/5 text-[10px] tracking-wider rounded-xl transition-all cursor-pointer mt-2 uppercase text-center"
          >
            Leave conversation
          </button>
        </div>
      </div>
    </motion.div>
  );
}
