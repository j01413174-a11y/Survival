import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Lock, 
  Check, 
  Sparkles, 
  Flame, 
  Shield, 
  Cpu, 
  Droplets, 
  Zap, 
  Compass, 
  Hammer, 
  Award, 
  Activity,
  AlertCircle
} from 'lucide-react';
import { IT } from './SurvivalGame';

interface ResearchTreeProps {
  onClose: () => void;
  gameState: any;
  setGameState: (state: any) => void;
  addLog: (msg: string, col: string) => void;
  spawnExplosion: (col: string, count: number, style: string) => void;
  setRecipes: React.Dispatch<React.SetStateAction<any[]>>;
}

export interface TechNode {
  id: string;
  name: string;
  desc: string;
  icon: string; // Emoji
  tier: 1 | 2 | 3;
  costs: Record<string, number>;
  xpCost: number;
  prereqs: string[];
  unlocksDesc: string;
  unlocksRecipes: string[];
  statBonuses?: {
    mhp?: number;
    mmp?: number;
    spd?: number;
    def?: number;
  };
}

export const RESEARCH_TECHS: TechNode[] = [
  // --- TIER 1: BASIC SURVIVAL & DECENTRALIZATION ---
  {
    id: 't1_agriculture',
    name: 'Hydrological Engineering',
    desc: 'Master the storage, routing, and pumping of pristine river waters.',
    icon: '💧',
    tier: 1,
    costs: { wood: 15, stone: 10, fiber: 10 },
    xpCost: 20,
    prereqs: [],
    unlocksDesc: 'Unlocks Water Pump, Water Reservoir, and Water Pipe recipes.',
    unlocksRecipes: ['water_pump', 'water_reservoir', 'water_pipe']
  },
  {
    id: 't1_hunting',
    name: 'Hunting Innovations',
    desc: 'Pioneer advanced stalking techniques, string recurving, and back-strapping.',
    icon: '🏹',
    tier: 1,
    costs: { leather: 10, fiber: 15, stick: 10 },
    xpCost: 20,
    prereqs: [],
    unlocksDesc: 'Unlocks Recurve Bow and Leather Backpack blueprints.',
    unlocksRecipes: ['recurve_bow', 'leather_backpack']
  },
  {
    id: 't1_masonry',
    name: 'Masonry Foundations',
    desc: 'Harness structural binding and heavy clay mixing for durable defensive buffers.',
    icon: '🧱',
    tier: 1,
    costs: { stone: 20, clay: 15, fiber: 10 },
    xpCost: 25,
    prereqs: [],
    unlocksDesc: 'Unlocks Stone Wall building structure blueprint.',
    unlocksRecipes: ['stone_wall'],
    statBonuses: { def: 2 }
  },

  // --- TIER 2: METALLURGY & AUTOMATION SYSTEMS ---
  {
    id: 't2_smelting',
    name: 'Industrial Smelting',
    desc: 'Unlocks high-efficiency furnace fuel configurations to forge resilient steel alloys.',
    icon: '🔥',
    tier: 2,
    costs: { iron_bar: 8, coal: 15, clay: 10 },
    xpCost: 50,
    prereqs: ['t1_agriculture'],
    unlocksDesc: 'Unlocks Steel Bar refinery and secure Iron Chest storage.',
    unlocksRecipes: ['steel_bar', 'iron_chest']
  },
  {
    id: 't2_ballistics',
    name: 'Precision Ballistics',
    desc: 'Combine black powder chambers and heavy brass cartridges for mechanical projectile weaponry.',
    icon: '🔫',
    tier: 2,
    costs: { steel_bar: 5, sulfur: 10, wood: 20 },
    xpCost: 65,
    prereqs: ['t1_hunting'],
    unlocksDesc: 'Unlocks Hunting Rifle and heavy-duty Military Backpack recipes.',
    unlocksRecipes: ['hunting_rifle', 'military_backpack'],
    statBonuses: { mhp: 15 }
  },
  {
    id: 't2_defense',
    name: 'Defensive Fortifications',
    desc: 'Design automated sentinel hardware and lethal perimeter traps.',
    icon: '🛡️',
    tier: 2,
    costs: { iron_bar: 12, steel_bar: 3, stone: 30 },
    xpCost: 60,
    prereqs: ['t1_masonry'],
    unlocksDesc: 'Unlocks Sentry Turret and Spike Trap structure blueprints.',
    unlocksRecipes: ['sentry_turret', 'spike_trap_crafted'],
    statBonuses: { def: 3 }
  },

  // --- TIER 3: ANCIENT & COSMIC INFRASTRUCTURE ---
  {
    id: 't3_alchemy',
    name: 'Arcane Infrastructure',
    desc: 'Erect massive crystal focal lenses to harness ambient leyline energy.',
    icon: '🔮',
    tier: 3,
    costs: { magic_essence: 15, crystal: 10, stone: 40 },
    xpCost: 120,
    prereqs: ['t2_smelting'],
    unlocksDesc: 'Unlocks Magic Altar, Mana Crystal synthesis, and Mana Well structure blueprints.',
    unlocksRecipes: ['magic_altar', 'mana_crystal', 'mana_well'],
    statBonuses: { mmp: 25 }
  },
  {
    id: 't3_elemental',
    name: 'Elemental Attunement',
    desc: 'Imbue basic wooden shafts with raw, elemental spellfire and glacial sub-zero energies.',
    icon: '⚡',
    tier: 3,
    costs: { magic_essence: 20, crystal: 12, sulfur: 15, ice_crystal: 5 },
    xpCost: 140,
    prereqs: ['t3_alchemy'],
    unlocksDesc: 'Unlocks Fire Staff, Ice Staff, and Heal Staff magical weapons.',
    unlocksRecipes: ['fire_staff', 'ice_staff', 'heal_staff'],
    statBonuses: { mmp: 15, mhp: 10 }
  },
  {
    id: 't3_cosmic',
    name: 'Celestial Ascendance',
    desc: 'Break down the barriers of spacetime. Forge stellar relics and reality-bending elixirs.',
    icon: '🌌',
    tier: 3,
    costs: { celestial_shard: 4, void_crystal: 6, magic_essence: 30 },
    xpCost: 200,
    prereqs: ['t3_alchemy'],
    unlocksDesc: 'Unlocks Philosopher\'s Stone, Immortality Elixir, Cosmic Staff, and Void Staff.',
    unlocksRecipes: ['philosophers_stone', 'immortality_elixir', 'cosmic_staff', 'void_staff'],
    statBonuses: { spd: 0.4, mhp: 20, mmp: 20 }
  }
];

export default function ResearchTree({
  onClose,
  gameState,
  setGameState,
  addLog,
  spawnExplosion,
  setRecipes,
}: ResearchTreeProps) {
  const [selectedTech, setSelectedTech] = useState<TechNode | null>(RESEARCH_TECHS[0]);
  const [activeTierTab, setActiveTierTab] = useState<1 | 2 | 3>(1);

  if (!gameState || !gameState.pl) return null;

  const pl = gameState.pl;
  const inv = pl.inv || {};
  const unlockedTechs: string[] = pl.unlockedTechs || [];
  const playerXP = pl.xp || 0;

  // Gather current material counts
  const checkHasMaterials = (tech: TechNode) => {
    return Object.entries(tech.costs).every(([itemId, qty]) => (inv[itemId] || 0) >= qty);
  };

  const checkHasXPCost = (tech: TechNode) => {
    return playerXP >= tech.xpCost;
  };

  const checkPrereqsMet = (tech: TechNode) => {
    return tech.prereqs.every((id) => unlockedTechs.includes(id));
  };

  const handleResearch = (tech: TechNode) => {
    if (unlockedTechs.includes(tech.id)) return;

    if (!checkPrereqsMet(tech)) {
      addLog(`❌ Prerequisite technologies must be unlocked first!`, '#ef4444');
      return;
    }

    if (!checkHasMaterials(tech)) {
      addLog(`❌ Missing required resources for this research breakthrough!`, '#ef4444');
      return;
    }

    if (!checkHasXPCost(tech)) {
      addLog(`❌ Insufficient Experience Points (XP)! You need ${tech.xpCost} XP to decode this.`, '#ef4444');
      return;
    }

    const s = { ...gameState };

    // Deduct materials
    Object.entries(tech.costs).forEach(([itemId, qty]) => {
      s.pl.inv[itemId] -= qty;
    });

    // Deduct XP
    s.pl.xp -= tech.xpCost;

    // Add to unlocked technologies
    if (!s.pl.unlockedTechs) {
      s.pl.unlockedTechs = [];
    }
    s.pl.unlockedTechs.push(tech.id);

    // Apply stat bonuses immediately
    if (tech.statBonuses) {
      if (tech.statBonuses.mhp) {
        s.pl.mhp += tech.statBonuses.mhp;
        s.pl.hp += tech.statBonuses.mhp; // Heal for the bonus amount too
      }
      if (tech.statBonuses.mmp) {
        s.pl.mmp += tech.statBonuses.mmp;
        s.pl.mp += tech.statBonuses.mmp;
      }
      if (tech.statBonuses.spd) {
        s.pl.spd = Number((s.pl.spd + tech.statBonuses.spd).toFixed(2));
      }
      if (tech.statBonuses.def) {
        s.pl.def = (s.pl.def || 0) + tech.statBonuses.def;
      }
    }

    // Unlock crafting recipes reactively in the top-level state
    setRecipes((prevRecipes) => {
      return prevRecipes.map((r) => {
        if (tech.unlocksRecipes.includes(r.out)) {
          return { ...r, discovered: true };
        }
        return r;
      });
    });

    // Feed logs & graphics
    addLog(`✨ RESEARCH BREAKTHROUGH: "${tech.name}" unlocked successfully!`, '#06b6d4');
    spawnExplosion('#06b6d4', 35, 'spell');
    setGameState(s);

    // Keep the same node selected to update state
    setSelectedTech({ ...tech });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/95 flex flex-col font-mono text-white"
    >
      {/* Top Header */}
      <div className="p-6 flex justify-between items-center border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-400">
            <Cpu size={24} className="animate-spin-slow text-cyan-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-widest text-cyan-400">TECHNOLOGY RESEARCH STATION</h2>
            <p className="text-[10px] text-zinc-400 uppercase tracking-widest mt-0.5">Unlocks Advanced Structures, Modern Infrastructure, & Arcane Weaponry</p>
          </div>
        </div>
        <button 
          onClick={onClose} 
          className="p-2 hover:bg-white/10 rounded-full cursor-pointer transition-all border border-white/5 hover:border-white/20"
        >
          <X size={20} />
        </button>
      </div>

      {/* Main Content Layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden max-w-7xl w-full mx-auto p-4 sm:p-6 gap-6">
        
        {/* LEFT COLUMN: TECHNOLOGY TREE */}
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          
          {/* Active Player Status HUD */}
          <div className="bg-zinc-950 border border-white/5 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">🎓</span>
              <div>
                <span className="text-[10px] uppercase text-zinc-500 block">Available Knowledge Base</span>
                <span className="text-xs font-bold text-cyan-400">LVL {pl.lvl} Explorer</span>
              </div>
            </div>

            <div className="flex items-center gap-6">
              {/* Experience Points */}
              <div className="bg-zinc-900/60 border border-white/5 rounded-xl px-4 py-2 flex items-center gap-2">
                <Sparkles size={16} className="text-yellow-400" />
                <div>
                  <span className="text-[9px] uppercase text-zinc-500 block">Durable XP</span>
                  <span className="text-xs font-bold text-yellow-400 font-mono">{playerXP} XP</span>
                </div>
              </div>

              {/* Unlocked tech count */}
              <div className="bg-zinc-900/60 border border-white/5 rounded-xl px-4 py-2 flex items-center gap-2">
                <Award size={16} className="text-cyan-400" />
                <div>
                  <span className="text-[9px] uppercase text-zinc-500 block">Completed Techs</span>
                  <span className="text-xs font-bold text-cyan-400 font-mono">
                    {unlockedTechs.length} <span className="opacity-40">/ {RESEARCH_TECHS.length}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Tier Tabs Selector */}
          <div className="flex items-center gap-2 bg-zinc-900/60 border border-white/5 p-1 rounded-xl shrink-0">
            {[1, 2, 3].map((tier) => (
              <button
                key={tier}
                onClick={() => setActiveTierTab(tier as 1 | 2 | 3)}
                className={`flex-1 py-2.5 text-[10px] font-black tracking-widest rounded-lg uppercase transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  activeTierTab === tier 
                    ? 'bg-cyan-600 text-white font-extrabold shadow-md shadow-cyan-950' 
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                }`}
              >
                <span>TIER {tier}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-black/30 text-zinc-300">
                  {RESEARCH_TECHS.filter(t => t.tier === tier).length} Node(s)
                </span>
              </button>
            ))}
          </div>

          {/* Grid list of Technology Nodes */}
          <div className="flex-1 overflow-y-auto pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {RESEARCH_TECHS.filter((tech) => tech.tier === activeTierTab).map((tech) => {
                const isUnlocked = unlockedTechs.includes(tech.id);
                const isPrereqsMet = checkPrereqsMet(tech);
                const hasMaterials = checkHasMaterials(tech);
                const hasXP = checkHasXPCost(tech);
                const isSelected = selectedTech?.id === tech.id;

                let statusColor = "border-zinc-800 text-zinc-400 bg-zinc-950/40";
                if (isUnlocked) {
                  statusColor = "border-emerald-500/40 text-emerald-300 bg-emerald-950/10 shadow-[0_0_15px_rgba(16,185,129,0.08)]";
                } else if (isPrereqsMet) {
                  if (hasMaterials && hasXP) {
                    statusColor = "border-cyan-500 text-cyan-300 bg-cyan-950/10 shadow-[0_0_15px_rgba(6,182,212,0.12)] animate-pulse-slow";
                  } else {
                    statusColor = "border-yellow-500/40 text-yellow-300 bg-yellow-950/5";
                  }
                }

                return (
                  <motion.button
                    key={tech.id}
                    onClick={() => setSelectedTech(tech)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`p-4 rounded-2xl border text-left flex flex-col justify-between gap-3 transition-all cursor-pointer relative ${statusColor} ${
                      isSelected ? 'ring-2 ring-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.2)]' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-3xl filter drop-shadow-[0_0_5px_rgba(255,255,255,0.15)]">{tech.icon}</span>
                      <div className="flex gap-1">
                        {isUnlocked ? (
                          <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 uppercase tracking-wider">
                            <Check size={8} /> Unlocked
                          </span>
                        ) : !isPrereqsMet ? (
                          <span className="text-[9px] bg-zinc-800 text-zinc-500 border border-zinc-700/50 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 uppercase tracking-wider">
                            <Lock size={8} /> Locked
                          </span>
                        ) : (
                          <span className="text-[9px] bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 uppercase tracking-wider">
                            Available
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider line-clamp-1">{tech.name}</h3>
                      <p className="text-[10px] text-zinc-400 mt-1 line-clamp-2 leading-relaxed font-sans">{tech.desc}</p>
                    </div>

                    <div className="border-t border-white/5 pt-2 flex justify-between items-center text-[9px] uppercase tracking-wider text-zinc-500">
                      <span>XP: <b className="font-mono text-zinc-300 font-bold">{tech.xpCost}</b></span>
                      <span>{Object.keys(tech.costs).length} Mats</span>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: DETAIL PANEL */}
        <div className="w-full lg:w-96 shrink-0 bg-zinc-950 border border-white/10 rounded-3xl p-5 flex flex-col justify-between gap-4 overflow-y-auto">
          {selectedTech ? (
            <div className="flex flex-col gap-4 h-full justify-between">
              <div>
                {/* Tech Node Title & Icon */}
                <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                  <span className="text-4xl">{selectedTech.icon}</span>
                  <div>
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">TIER {selectedTech.tier} NODE</span>
                    <h3 className="text-sm font-black text-cyan-400 uppercase tracking-wider">{selectedTech.name}</h3>
                  </div>
                </div>

                {/* Tech Description */}
                <div className="mt-2.5">
                  <p className="text-xs leading-relaxed text-zinc-300 italic">
                    "{selectedTech.desc}"
                  </p>
                </div>

                {/* Prerequisite check */}
                {selectedTech.prereqs.length > 0 && (
                  <div className="mt-3.5 bg-zinc-900/60 border border-white/5 p-3 rounded-xl">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center gap-1">
                      <Compass size={11} className="text-zinc-500" /> Prerequisite Technologies
                    </h4>
                    {selectedTech.prereqs.map((preId) => {
                      const preTech = RESEARCH_TECHS.find(t => t.id === preId);
                      const met = unlockedTechs.includes(preId);
                      return (
                        <div key={preId} className="flex items-center justify-between text-xs mt-1">
                          <span className="text-[11px] text-zinc-300 font-sans">{preTech?.name || preId}</span>
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            met ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                          }`}>
                            {met ? '✓ Complete' : '✗ Required'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Stat Bonuses */}
                {selectedTech.statBonuses && (
                  <div className="mt-3.5 bg-emerald-950/10 border border-emerald-500/10 p-3 rounded-xl text-emerald-300">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-1.5 flex items-center gap-1">
                      <Activity size={11} className="text-emerald-400" /> Direct Explorer Augmentations
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      {selectedTech.statBonuses.mhp && (
                        <div className="bg-black/30 border border-emerald-500/15 p-1.5 rounded-lg flex flex-col">
                          <span className="text-[9px] opacity-60">Max Health</span>
                          <span className="font-extrabold font-mono">+{selectedTech.statBonuses.mhp} HP</span>
                        </div>
                      )}
                      {selectedTech.statBonuses.mmp && (
                        <div className="bg-black/30 border border-emerald-500/15 p-1.5 rounded-lg flex flex-col">
                          <span className="text-[9px] opacity-60">Max Mana</span>
                          <span className="font-extrabold font-mono">+{selectedTech.statBonuses.mmp} MP</span>
                        </div>
                      )}
                      {selectedTech.statBonuses.spd && (
                        <div className="bg-black/30 border border-emerald-500/15 p-1.5 rounded-lg flex flex-col">
                          <span className="text-[9px] opacity-60">Move Speed</span>
                          <span className="font-extrabold font-mono">+{Math.round(selectedTech.statBonuses.spd * 100)}%</span>
                        </div>
                      )}
                      {selectedTech.statBonuses.def && (
                        <div className="bg-black/30 border border-emerald-500/15 p-1.5 rounded-lg flex flex-col">
                          <span className="text-[9px] opacity-60">Durable Armor</span>
                          <span className="font-extrabold font-mono">+{selectedTech.statBonuses.def} Defense</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Unlock specifics */}
                <div className="mt-4">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 mb-2 flex items-center gap-1.5">
                    <Award size={11} /> Unlocked Blueprints
                  </h4>
                  <div className="bg-zinc-900 p-3 rounded-xl border border-cyan-500/10 text-xs text-zinc-300 font-sans leading-relaxed">
                    {selectedTech.unlocksDesc}
                    
                    {/* Visual list of items unlocked */}
                    <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-white/5">
                      {selectedTech.unlocksRecipes.map((itemId) => {
                        const item = IT[itemId];
                        return (
                          <div key={itemId} className="flex items-center gap-1 bg-black/40 border border-white/5 rounded-lg px-2 py-1 text-[10px] font-mono text-zinc-300">
                            <span>{item?.ico || '📦'}</span>
                            <span className="truncate max-w-[80px] font-sans">{item?.n || itemId}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Cost / Requirements */}
                <div className="mt-4 border-t border-white/5 pt-3">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-2">Research Costs</h4>
                  
                  <div className="flex flex-col gap-2">
                    {/* XP Cost */}
                    <div className="flex items-center justify-between text-xs bg-zinc-900 p-2 rounded-xl">
                      <div className="flex items-center gap-1.5">
                        <Sparkles size={13} className="text-yellow-400" />
                        <span className="font-sans text-[11px]">Experience Points (XP)</span>
                      </div>
                      <span className={`font-mono text-xs font-bold ${checkHasXPCost(selectedTech) ? 'text-yellow-400' : 'text-red-400'}`}>
                        {playerXP}/{selectedTech.xpCost} XP
                      </span>
                    </div>

                    {/* Material Costs */}
                    {Object.entries(selectedTech.costs).map(([itemId, qty]) => {
                      const item = IT[itemId];
                      const currentQty = inv[itemId] || 0;
                      const enough = currentQty >= qty;
                      return (
                        <div key={itemId} className="flex items-center justify-between text-xs bg-zinc-900 p-2 rounded-xl">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">{item?.ico || '❓'}</span>
                            <span className="font-sans text-[11px] truncate max-w-[120px]">{item?.n || itemId}</span>
                          </div>
                          <span className={`font-mono text-xs font-bold ${enough ? 'text-emerald-400' : 'text-red-400'}`}>
                            {currentQty}/{qty}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Research Action Button */}
              <div className="mt-4 pt-3 border-t border-white/5">
                {unlockedTechs.includes(selectedTech.id) ? (
                  <div className="w-full py-3 bg-emerald-950/20 border border-emerald-500/20 rounded-2xl flex items-center justify-center gap-2 text-emerald-400 text-xs font-extrabold uppercase tracking-widest select-none">
                    <Check size={14} /> Completed Research
                  </div>
                ) : (
                  <button
                    onClick={() => handleResearch(selectedTech)}
                    disabled={!checkPrereqsMet(selectedTech) || !checkHasMaterials(selectedTech) || !checkHasXPCost(selectedTech)}
                    className={`w-full py-3.5 rounded-2xl border text-xs font-extrabold uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      checkPrereqsMet(selectedTech) && checkHasMaterials(selectedTech) && checkHasXPCost(selectedTech)
                        ? 'bg-cyan-500 border-cyan-400 text-zinc-950 hover:bg-cyan-400 active:scale-[0.98] shadow-lg hover:shadow-cyan-500/20'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-500 cursor-not-allowed'
                    }`}
                  >
                    <span>Initiate Research</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-2">
              <AlertCircle size={32} className="opacity-30" />
              <p className="text-xs">Select a research node from the tree to examine blueprint breakthroughs.</p>
            </div>
          )}
        </div>

      </div>
    </motion.div>
  );
}
