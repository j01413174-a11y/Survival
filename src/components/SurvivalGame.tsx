import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  Shield, 
  Sword, 
  Backpack, 
  Hammer, 
  Sparkles, 
  ChevronRight, 
  X, 
  Save, 
  Zap, 
  Flame, 
  Droplets, 
  Wind,
  BrainCircuit,
  Search,
  FlaskConical,
  BookOpen,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Download,
  Upload,
  Cpu
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getOracleGuidance, generateWorldEvent } from '../services/geminiService';

// --- Constants & Types ---
const TZ = 32;
const ZW = 80;
const ZH = 80;
const ZCOLS = 5;
const ZROWS = 5; // Increased to 5x5 for more maps
const WW = ZW * ZCOLS;
const WH = ZH * ZROWS;

const TG = 0, TD = 1, TS = 2, TW = 3, TSA = 4, TSN = 5, TLV = 6, TSW = 7, TCR = 8; // TCR = Celestial Realm
const TC: Record<number, string[]> = {
  0: ['#2d5a1b', '#355f20', '#1a3310'], // Grass
  1: ['#6b4c2a', '#7a5530', '#4a331a'], // Dirt
  2: ['#555566', '#4a4a5a', '#333344'], // Stone
  3: ['#1a3d6e', '#1e4577', '#0d1f38'], // Water
  4: ['#c2a06a', '#cfab72', '#8a704a'], // Sand
  5: ['#d4eaf5', '#deeef8', '#a0c4d8'], // Snow
  6: ['#cc4400', '#dd5511', '#882200'], // Lava
  7: ['#2a4020', '#344a28', '#1a2a14'], // Swamp
  8: ['#1a0a3a', '#2a1a4a', '#4a1a8a'], // Celestial
};

// --- Game Data ---
const MAPS = [
  { id: 0, n: 'Verdant Forest', s: 1337, m: TG, f: TD, r: TS, w: TW, wf: .12, rf: .08, sky: '#87ceeb', ef: ['wolf', 'fox', 'goblin', 'bandit'], dr: { wood: .04, fiber: .02, herb: .015, berry: .012, flint: .008, stone: .02 } },
  { id: 1, n: 'Deep Forest', s: 2674, m: TG, f: TD, r: TS, w: TW, wf: .10, rf: .07, sky: '#1a3d10', ef: ['wolf', 'spider', 'skeleton', 'goblin'], dr: { wood: .04, mushroom: .016, herb: .012, venom: .008, fiber: .014, bone: .01 } },
  { id: 2, n: 'Sunlit Plains', s: 3011, m: TG, f: TD, r: TS, w: TW, wf: .05, rf: .04, sky: '#6dbadf', ef: ['fox', 'goblin', 'bandit', 'archer'], dr: { fiber: .025, herb: .018, berry: .015, flint: .01, feather: .01, honey: .01, cotton: .015 } },
  { id: 3, n: 'Sandy Desert', s: 4488, m: TSA, f: TSA, r: TS, w: TW, wf: .03, rf: .08, sky: '#f5d08a', ef: ['bandit', 'bandit_chief', 'goblin', 'orc'], dr: { bone: .02, sulfur: .016, flint: .014, gem: .005, sand: .03, stone: .02 } },
  { id: 4, n: 'Frozen Tundra', s: 5665, m: TSN, f: TS, r: TS, w: TW, wf: .06, rf: .12, sky: '#b0d4e8', ef: ['wolf', 'bear', 'skeleton', 'orc'], dr: { ice_crystal: .02, bone: .01, herb: .006, crystal: .006, wood: .012 } },
  { id: 5, n: 'Misty Swamp', s: 6821, m: TSW, f: TD, r: TS, w: TW, wf: .18, rf: .04, sky: '#4a5a3a', ef: ['zombie', 'spider', 'wraith', 'goblin'], dr: { mushroom: .022, venom: .016, fiber: .014, silk: .009, herb: .009 } },
  { id: 6, n: 'Mountain Pass', s: 7234, m: TS, f: TD, r: TS, w: TW, wf: .04, rf: .26, sky: '#7a8898', ef: ['troll', 'bear', 'orc', 'skeleton'], dr: { iron_ore: .02, crystal: .009, gem: .006, coal: .014, stone: .03, mithril_ore: .005 } },
  { id: 7, n: 'Goblin Territory', s: 8456, m: TD, f: TD, r: TS, w: TW, wf: .06, rf: .09, sky: '#7a9a6a', ef: ['goblin', 'goblin_chief', 'bandit', 'orc'], dr: { bone: .016, feather: .013, leather: .011, flint: .011, wood: .016 } },
  { id: 8, n: 'Coastal Shore', s: 9732, m: TSA, f: TSA, r: TS, w: TW, wf: .28, rf: .03, sky: '#4a9ad4', ef: ['bandit', 'skeleton', 'goblin', 'archer'], dr: { fish: .022, silk: .011, sand: .035, feather: .016, bone: .009 } },
  { id: 9, n: 'Ancient Ruins', s: 10551, m: TS, f: TS, r: TS, w: TW, wf: .03, rf: .20, sky: '#5a5060', ef: ['skeleton', 'golem', 'dark_mage', 'wraith'], dr: { crystal: .016, magic_essence: .011, bone: .022, gem: .013, stone: .022, ancient_rune: .003 } },
  { id: 10, n: 'Scorched Waste', s: 11889, m: TS, f: TS, r: TS, w: TLV, wf: .06, rf: .11, sky: '#8a4020', ef: ['troll', 'orc', 'orc_chief', 'dark_mage'], dr: { sulfur: .022, coal: .027, iron_ore: .014, ash_crystal: .006 } },
  { id: 11, n: 'Volcanic Fields', s: 12004, m: TS, f: TLV, r: TS, w: TLV, wf: .14, rf: .07, sky: '#cc4400', ef: ['troll', 'orc', 'golem', 'wraith'], dr: { sulfur: .027, coal: .031, iron_ore: .022, crystal: .006, gem: .004 } },
  { id: 12, n: 'Orc Stronghold', s: 13377, m: TD, f: TD, r: TS, w: TW, wf: .04, rf: .09, sky: '#6a5040', ef: ['orc', 'orc_chief', 'troll', 'goblin_chief'], dr: { bone: .022, leather: .016, iron_ore: .014, coal: .011, wood: .014 } },
  { id: 13, n: 'Bandit Outpost', s: 14220, m: TD, f: TS, r: TS, w: TW, wf: .04, rf: .13, sky: '#5a5060', ef: ['bandit', 'bandit_chief', 'archer', 'dark_mage'], dr: { iron_ore: .014, leather: .014, gem: .006, flint: .014, coal: .009 } },
  { id: 14, n: 'Crystal Cavern', s: 15641, m: TS, f: TS, r: TS, w: TW, wf: .04, rf: .20, sky: '#1a1a44', ef: ['wraith', 'dark_mage', 'skeleton', 'golem'], dr: { crystal: .036, magic_essence: .020, gem: .016, ice_crystal: .014 } },
  { id: 15, n: 'Haunted Graveyard', s: 16007, m: TD, f: TS, r: TS, w: TW, wf: .04, rf: .08, sky: '#1a1a22', ef: ['skeleton', 'zombie', 'wraith', 'dark_mage'], dr: { bone: .036, crystal: .011, magic_essence: .008, herb: .004, silk: .006 } },
  { id: 16, n: 'Undead Kingdom', s: 17890, m: TD, f: TS, r: TS, w: TW, wf: .06, rf: .11, sky: '#0a0a1a', ef: ['zombie', 'skeleton', 'wraith', 'dark_mage', 'golem'], dr: { bone: .040, magic_essence: .016, crystal: .011, silk: .009 } },
  { id: 17, n: 'Enchanted Grove', s: 18234, m: TG, f: TG, r: TS, w: TW, wf: .09, rf: .04, sky: '#2a1a4a', ef: ['dark_mage', 'wraith', 'goblin', 'spider'], dr: { magic_essence: .025, crystal: .016, herb: .027, silk: .016, mushroom: .011 } },
  { id: 18, n: "Dragon's Domain", s: 19555, m: TS, f: TLV, r: TS, w: TLV, wf: .11, rf: .09, sky: '#440000', ef: ['dragon', 'troll', 'orc_chief', 'dark_mage'], dr: { gem: .022, crystal: .016, magic_essence: .016, sulfur: .022, bone: .016 } },
  { id: 19, n: 'Corrupted Lands', s: 20001, m: TD, f: TD, r: TS, w: TLV, wf: .09, rf: .09, sky: '#080810', ef: ['dragon', 'dark_mage', 'wraith', 'orc_chief', 'bandit_chief'], dr: { magic_essence: .027, crystal: .022, sulfur: .016, bone: .027, gem: .011 } },
  { id: 20, n: 'Celestial Realm', s: 99999, m: TCR, f: TCR, r: TS, w: TW, wf: .05, rf: .05, sky: '#1a0a3a', ef: ['celestial_guardian', 'void_wraith', 'star_golem'], dr: { magic_essence: .05, crystal: .04, gem: .03, void_crystal: .02, celestial_shard: .01 } },
];

const ET: Record<string, any> = {
  wolf: { n: 'Wolf', ico: '🐺', hp: 30, spd: 1.8, dmg: 8, acd: 60, xp: 10, lo: { meat: .7, leather: .3 }, ran: false },
  fox: { n: 'Fox', ico: '🦊', hp: 20, spd: 2.2, dmg: 6, acd: 55, xp: 7, lo: { meat: .5, feather: .3 }, ran: false },
  bear: { n: 'Bear', ico: '🐻', hp: 90, spd: 1.1, dmg: 22, acd: 90, xp: 28, lo: { meat: .9, leather: .7 }, ran: false },
  goblin: { n: 'Goblin', ico: '👺', hp: 28, spd: 1.6, dmg: 9, acd: 60, xp: 13, lo: { bone: .4, flint: .3, leather: .2 }, ran: false },
  skeleton: { n: 'Skeleton', ico: '💀', hp: 38, spd: 1.3, dmg: 11, acd: 65, xp: 15, lo: { bone: .9, flint: .3 }, ran: false },
  zombie: { n: 'Zombie', ico: '🧟', hp: 60, spd: 0.7, dmg: 15, acd: 80, xp: 22, lo: { bone: .7, cloth: .3, venom: .1 }, ran: false },
  spider: { n: 'Spider', ico: '🕷️', hp: 32, spd: 2.0, dmg: 9, acd: 50, xp: 13, lo: { venom: .8, silk: .7 }, ran: false },
  wraith: { n: 'Wraith', ico: '👻', hp: 55, spd: 1.7, dmg: 17, acd: 60, xp: 30, lo: { magic_essence: .6, crystal: .2 }, ran: false },
  dark_mage: { n: 'Dark Mage', ico: '🧙', hp: 65, spd: 1.2, dmg: 24, acd: 75, xp: 44, lo: { magic_essence: .8, crystal: .4, gem: .1 }, ran: true },
  archer: { n: 'Archer', ico: '🏹', hp: 44, spd: 1.3, dmg: 20, acd: 60, xp: 24, lo: { feather: .8, wood: .3, iron_ore: .2 }, ran: true },
  golem: { n: 'Golem', ico: '⚙️', hp: 220, spd: 0.6, dmg: 32, acd: 110, xp: 90, lo: { iron_ore: .9, stone: .9, crystal: .3 }, ran: false, boss: 1 },
  dragon: { n: 'Dragon', ico: '🐉', hp: 450, spd: 1.4, dmg: 50, acd: 80, xp: 220, lo: { gem: .9, crystal: .8, magic_essence: .7, sulfur: .6, dragon_scale: .7 }, ran: true, boss: 1 },
  celestial_guardian: { n: 'Celestial Guardian', ico: '✨', hp: 300, spd: 1.5, dmg: 40, acd: 70, xp: 150, lo: { celestial_shard: .5, magic_essence: .8 }, ran: true },
  void_wraith: { n: 'Void Wraith', ico: '🌑', hp: 150, spd: 2.0, dmg: 35, acd: 50, xp: 100, lo: { void_crystal: .4, magic_essence: .6 }, ran: false },
  star_golem: { n: 'Star Golem', ico: '🌟', hp: 500, spd: 0.8, dmg: 60, acd: 100, xp: 300, lo: { gem: .9, crystal: .9, celestial_shard: .3 }, ran: false, boss: 1 },
};

const IT: Record<string, any> = {
  wood: { ico: '🪵', n: 'Wood', t: 'mat' },
  stone: { ico: '🪨', n: 'Stone', t: 'mat' },
  iron_ore: { ico: '⚙️', n: 'Iron Ore', t: 'mat' },
  coal: { ico: '🖤', n: 'Coal', t: 'mat' },
  fiber: { ico: '🌿', n: 'Fiber', t: 'mat' },
  flint: { ico: '🔷', n: 'Flint', t: 'mat' },
  bone: { ico: '🦴', n: 'Bone', t: 'mat' },
  leather: { ico: '🟫', n: 'Leather', t: 'mat' },
  crystal: { ico: '💎', n: 'Crystal', t: 'mat' },
  sulfur: { ico: '🟡', n: 'Sulfur', t: 'mat' },
  ice_crystal: { ico: '❄️', n: 'Ice Shard', t: 'mat' },
  herb: { ico: '🌱', n: 'Herb', t: 'mat' },
  venom: { ico: '🟢', n: 'Venom', t: 'mat' },
  feather: { ico: '🪶', n: 'Feather', t: 'mat' },
  gem: { ico: '💍', n: 'Gem', t: 'mat' },
  magic_essence: { ico: '✨', n: 'M.Essence', t: 'mat' },
  void_crystal: { ico: '🔮', n: 'Void Xtal', t: 'mat' },
  celestial_shard: { ico: '✨', n: 'Celestial Shard', t: 'mat' },
  meat: { ico: '🥩', n: 'Raw Meat', t: 'mat' },
  berry: { ico: '🫐', n: 'Berry', t: 'mat' },
  mushroom: { ico: '🍄', n: 'Mushroom', t: 'mat' },
  stick: { ico: '🥢', n: 'Stick', t: 'mat' },
  iron_bar: { ico: '🔩', n: 'Iron Bar', t: 'mat' },
  steel_bar: { ico: '🔧', n: 'Steel Bar', t: 'mat' },
  torch: { ico: '🔦', n: 'Torch', t: 'tool' },
  mana_crystal: { ico: '🧿', n: 'Mana Crystal', t: 'mat' },
  void_essence: { ico: '🌀', n: 'Void Essence', t: 'mat' },
  
   cooked_meat: { ico: '🍗', n: 'Cooked Meat', t: 'food', hu: 45, hp: 10 },
  raw_fish: { ico: '🐟', n: 'Raw Fish', t: 'food', hu: 15, hp: 5 },
  cooked_fish: { ico: '🐠', n: 'Cooked Fish', t: 'food', hu: 50, hp: 40, mp: 10 },
  celestial_fish: { ico: '🌌', n: 'Celestial Fish', t: 'food', hu: 100, hp: 100, mp: 100 },
  heal_potion: { ico: '🧪', n: 'Heal Potion', t: 'pot', hp: 58 },
  mana_potion: { ico: '💙', n: 'Mana Potion', t: 'pot', mp: 58 },
  
  leather_vest: { ico: '🧥', n: 'Leather Vest', t: 'armor', sl: 'chest', def: 5 },
  iron_chest: { ico: '🛡️', n: 'Iron Chest', t: 'armor', sl: 'chest', def: 14 },
  
  fists: { id: 'fists', n: 'Fists', ico: '✊', dmg: 5, spd: 20, rng: 44, type: 'melee', mp: 0 },
  fishing_rod: { id: 'fishing_rod', n: 'Fishing Rod', ico: '🎣', dmg: 2, spd: 40, rng: 30, type: 'melee', mp: 0 },
  stone_axe: { id: 'stone_axe', n: 'Stone Axe', ico: '🪓', dmg: 15, spd: 28, rng: 44, type: 'melee', mp: 0 },
  iron_sword: { id: 'iron_sword', n: 'Iron Sword', ico: '⚔️', dmg: 28, spd: 24, rng: 50, type: 'melee', mp: 0 },
  shortbow: { id: 'shortbow', n: 'Shortbow', ico: '🏹', dmg: 20, spd: 30, rng: 200, type: 'ranged', mp: 0 },
  fire_staff: { id: 'fire_staff', n: 'Fire Staff', ico: '🪄', dmg: 38, spd: 36, rng: 240, type: 'magic', mp: 15, fx: 'burn', col: '#ff5500' },
  ice_staff: { id: 'ice_staff', n: 'Ice Staff', ico: '❄️', dmg: 25, spd: 40, rng: 220, type: 'magic', mp: 12, fx: 'slow', col: '#00ccff' },
  void_staff: { id: 'void_staff', n: 'Void Staff', ico: '🔮', dmg: 60, spd: 50, rng: 300, type: 'magic', mp: 30, fx: 'void', col: '#9900ff' },
  heal_staff: { id: 'heal_staff', n: 'Heal Staff', ico: '🩹', dmg: 0, spd: 60, rng: 0, type: 'magic_heal', mp: 25, fx: 'heal', col: '#00ffaa' },
  
  campfire: { ico: '🔥', n: 'Campfire', t: 'struct' },
  workbench: { ico: '🪚', n: 'Workbench', t: 'struct' },
  forge: { ico: '⚒️', n: 'Forge', t: 'struct' },
  magic_altar: { ico: '🕋', n: 'Magic Altar', t: 'struct' },
};

const RC = [
  { n: 'Stick x2', out: 'stick', cnt: 2, cat: 'Materials', c: { wood: 1 } },
  { n: 'Iron Bar', out: 'iron_bar', cnt: 1, cat: 'Materials', c: { iron_ore: 2, coal: 1 }, req: 'forge' },
  { n: 'Steel Bar', out: 'steel_bar', cnt: 1, cat: 'Materials', c: { iron_bar: 2, coal: 2 }, req: 'forge' },
  { n: 'Stone Axe', out: 'stone_axe', cnt: 1, cat: 'Weapons', c: { stone: 2, stick: 1 } },
  { n: 'Iron Sword', out: 'iron_sword', cnt: 1, cat: 'Weapons', c: { iron_bar: 3, stick: 1 }, req: 'workbench' },
  { n: 'Shortbow', out: 'shortbow', cnt: 1, cat: 'Weapons', c: { wood: 3, fiber: 2 } },
  { n: 'Iron Chest', out: 'iron_chest', cnt: 1, cat: 'Armor', c: { iron_bar: 5 }, req: 'workbench' },
  { n: 'Leather Vest', out: 'leather_vest', cnt: 1, cat: 'Armor', c: { leather: 3, fiber: 2 } },
  { n: 'Magic Altar', out: 'magic_altar', cnt: 1, cat: 'Structures', c: { stone: 10, magic_essence: 5 } },
  { n: 'Mana Crystal', out: 'mana_crystal', cnt: 1, cat: 'Materials', c: { magic_essence: 3, crystal: 1 }, req: 'magic_altar' },
  { n: 'Fire Staff', out: 'fire_staff', cnt: 1, cat: 'Weapons', c: { stick: 2, crystal: 1, sulfur: 2 }, req: 'magic_altar' },
  { n: 'Ice Staff', out: 'ice_staff', cnt: 1, cat: 'Weapons', c: { stick: 2, crystal: 1, ice_crystal: 2 }, req: 'magic_altar' },
  { n: 'Heal Staff', out: 'heal_staff', cnt: 1, cat: 'Weapons', c: { stick: 2, magic_essence: 5, herb: 5 }, req: 'magic_altar' },
  { n: 'Void Staff', out: 'void_staff', cnt: 1, cat: 'Weapons', c: { stick: 2, void_crystal: 2, magic_essence: 10 }, req: 'magic_altar' },
  { n: 'Cooked Meat', out: 'cooked_meat', cnt: 1, cat: 'Food', c: { meat: 1 }, req: 'campfire' },
  { n: 'Cooked Fish', out: 'cooked_fish', cnt: 1, cat: 'Food', c: { raw_fish: 1 }, req: 'campfire' },
  { n: 'Fishing Rod', out: 'fishing_rod', cnt: 1, cat: 'Weapons', c: { wood: 4, fiber: 3 } },
  { n: 'Heal Potion', out: 'heal_potion', cnt: 1, cat: 'Potions', c: { herb: 2, crystal: 1 } },
  { n: 'Campfire', out: 'campfire', cnt: 1, cat: 'Structures', c: { wood: 3, stone: 1 } },
  { n: 'Workbench', out: 'workbench', cnt: 1, cat: 'Structures', c: { wood: 5, stone: 2 } },
  { n: 'Forge', out: 'forge', cnt: 1, cat: 'Structures', c: { stone: 6, iron_bar: 3, coal: 2 } },
];

// --- Helper Functions ---
const mkRng = (s: number) => {
  let n = s | 0;
  return () => {
    n = (n ^ (n << 13)) ^ (n >> 7) ^ (n << 17);
    return (n >>> 0) / 4294967296;
  };
};

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

const getWeaponStats = (s: any, weaponKey: string) => {
  const base = { ... (IT[weaponKey] || IT['fists']) };
  if (!s || !s.pl) return base;
  
  const mods = s.pl.weaponMods?.[weaponKey];
  if (!mods) return base;
  
  let namePrefix = mods.prefix || "";
  let nameSuffix = mods.suffix || "";
  let dmgMult = 1 + (mods.dmgBoost || 0);
  let spdMult = 1 - (mods.spdBoost || 0);
  let rngAdd = mods.rngAdd || 0;
  let mpAdd = mods.mpAdd || 0;
  let vamp = mods.vamp || 0;
  
  base.dmg = Math.round(base.dmg * dmgMult);
  base.spd = Math.max(5, Math.round(base.spd * spdMult));
  base.rng = base.rng + rngAdd;
  if (base.mp !== undefined) {
    base.mp = Math.max(0, base.mp + mpAdd);
  }
  base.n = (namePrefix + " " + base.n + " " + nameSuffix).trim();
  base.vamp = vamp;
  
  return base;
};

const rollProceduralMod = (itemKey: string) => {
  const prefixes = [
    { prefix: "Gilded", dmgBoost: 0.15, spdBoost: 0.05, vamp: 0 },
    { prefix: "Flaming", dmgBoost: 0.3, spdBoost: -0.1, col: "#ff4400" },
    { prefix: "Swift", dmgBoost: -0.05, spdBoost: 0.25 },
    { prefix: "Heavy", dmgBoost: 0.45, spdBoost: -0.15, rngAdd: -5 },
    { prefix: "Vampiric", dmgBoost: 0.1, vamp: 0.15 },
    { prefix: "Vengeful", dmgBoost: 0.2, spdBoost: 0.05 },
    { prefix: "Ethereal", dmgBoost: 0.15, mpAdd: -2 },
    { prefix: "Godly", dmgBoost: 0.35, spdBoost: 0.15, rngAdd: 10 }
  ];

  const suffixes = [
    { suffix: "of Vampirism", vamp: 0.2 },
    { suffix: "of Carnage", dmgBoost: 0.3 },
    { suffix: "of the Swift", spdBoost: 0.2 },
    { suffix: "of Light", rngAdd: 15 },
    { suffix: "of the Void", dmgBoost: 0.25, mpAdd: 1 },
    { suffix: "of Wrath", dmgBoost: 0.2, spdBoost: 0.1 }
  ];

  // 85% chance to roll a mod
  if (Math.random() > 0.85) return null;

  const pref = Math.random() < 0.7 ? prefixes[Math.floor(Math.random() * prefixes.length)] : null;
  const suff = Math.random() < 0.5 ? suffixes[Math.floor(Math.random() * suffixes.length)] : null;

  if (!pref && !suff) return null;

  const mod: any = {
    prefix: pref?.prefix || "",
    suffix: suff?.suffix || "",
    dmgBoost: (pref?.dmgBoost || 0) + (suff?.dmgBoost || 0),
    spdBoost: (pref?.spdBoost || 0) + (suff?.spdBoost || 0),
    rngAdd: (pref?.rngAdd || 0) + (suff?.rngAdd || 0),
    mpAdd: (pref?.mpAdd || 0) + (suff?.mpAdd || 0),
    vamp: (pref?.vamp || 0) + (suff?.vamp || 0)
  };

  return mod;
};

// --- Component ---
export default function SurvivalGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<any>(null);
  const [showInv, setShowInv] = useState(false);
  const [showCraft, setShowCraft] = useState(false);
  const [showSkills, setShowSkills] = useState(false);
  
  // Fishing Mini-game States
  const [isFishing, setIsFishing] = useState(false);
  const [fishingState, setFishingState] = useState<'idle' | 'waiting' | 'bite' | 'success' | 'fail'>('idle');
  const [fishingMessage, setFishingMessage] = useState('');
  const [recipes, setRecipes] = useState<any[]>(() => [
    ...RC.map(r => ({ ...r, discovered: true, craftCount: 0 })),
    { n: 'Mana Potion', out: 'mana_potion', cnt: 1, cat: 'Potions', c: { herb: 1, magic_essence: 2 }, discovered: false, craftCount: 0 },
    { n: 'Void Essence', out: 'void_essence', cnt: 1, cat: 'Materials', c: { void_crystal: 2, magic_essence: 4 }, req: 'magic_altar', discovered: false, craftCount: 0 },
    { n: 'Star Shield', out: 'iron_chest', cnt: 1, cat: 'Armor', c: { steel_bar: 3, gem: 1, celestial_shard: 1 }, req: 'workbench', discovered: false, craftCount: 0 },
  ]);
  const [craftSearch, setCraftSearch] = useState('');
  const [craftCategory, setCraftCategory] = useState('All');
  const [craftTab, setCraftTab] = useState<'blueprints' | 'lab'>('blueprints');
  const [showCraftableOnly, setShowCraftableOnly] = useState(false);
  const [labReactants, setLabReactants] = useState<{ itemKey: string; qty: number }[]>([]);
  const [labStatus, setLabStatus] = useState<{ success: boolean; msg: string } | null>(null);
  const [showOracle, setShowOracle] = useState(false);
  const [joy, setJoy] = useState<{ x: number; y: number } | null>(null);
  const [oracleData, setOracleData] = useState<any>(null);
  const [isOracleLoading, setIsOracleLoading] = useState(false);
  const [logs, setLogs] = useState<{ msg: string; col: string }[]>([]);
  const [compMode, setCompMode] = useState<'guard' | 'attack'>('guard');
  const [hotSlot, setHotSlot] = useState(0);
  const [banner, setBanner] = useState<string | null>(null);
  const [showDeathScreen, setShowDeathScreen] = useState(false);

  // --- Save / Load & Backup System States ---
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const [autosaveEnabled, setAutosaveEnabled] = useState(true);
  const autosaveEnabledRef = useRef(true);
  const [slots, setSlots] = useState<Record<string, any>>({});
  const [importString, setImportString] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  // Sync autosave ref with state
  useEffect(() => {
    autosaveEnabledRef.current = autosaveEnabled;
  }, [autosaveEnabled]);

  // --- Automation Cores States & Refs ---
  const [autoAttack, setAutoAttack] = useState(false);
  const [autoCollect, setAutoCollect] = useState(false);
  const [autoHarvest, setAutoHarvest] = useState(false);

  const autoAttackRef = useRef(false);
  const autoCollectRef = useRef(false);
  const autoHarvestRef = useRef(false);
  const pausedRef = useRef(false);

  useEffect(() => { autoAttackRef.current = autoAttack; }, [autoAttack]);
  useEffect(() => { autoCollectRef.current = autoCollect; }, [autoCollect]);
  useEffect(() => { autoHarvestRef.current = autoHarvest; }, [autoHarvest]);

  // --- World Event states ---
  const [showEventModal, setShowEventModal] = useState(false);
  const [narrativeEvent, setNarrativeEvent] = useState<any | null>(null);
  const [eventChoiceOutcome, setEventChoiceOutcome] = useState<string | null>(null);

  // Load slot metadata upon opening
  const loadSlotMetadata = useCallback(() => {
    const ids = ['1', '2', '3', 'autosave'];
    const meta: Record<string, any> = {};
    for (const id of ids) {
      const raw = localStorage.getItem(`wild_survival_save_${id}`);
      if (raw) {
        try {
          meta[id] = JSON.parse(raw);
        } catch (e) {
          meta[id] = null;
        }
      } else {
        meta[id] = null;
      }
    }
    setSlots(meta);
  }, []);

  useEffect(() => {
    loadSlotMetadata();
  }, [loadSlotMetadata]);

  // Shared loader function
  const loadGameDataStr = useCallback((jsonStr: string) => {
    try {
      const data = JSON.parse(jsonStr);
      if (!data || !data.pl) {
        addLog("Invalid save slot format!", "#f87171");
        setImportError("Error: The provided save string is corrupt or invalid.");
        return false;
      }

      const s = stateRef.current;
      if (!s) return false;

      // 1. Restore Player State
      s.pl.x = data.pl.x;
      s.pl.y = data.pl.y;
      s.pl.targetX = data.pl.targetX ?? data.pl.x;
      s.pl.targetY = data.pl.targetY ?? data.pl.y;
      s.pl.isGridMoving = false;
      s.pl.hp = data.pl.hp;
      s.pl.mhp = data.pl.mhp || 100;
      s.pl.hu = data.pl.hu ?? 100;
      s.pl.sta = data.pl.sta ?? 100;
      s.pl.mp = data.pl.mp ?? 100;
      s.pl.mmp = data.pl.mmp || 100;
      s.pl.inv = data.pl.inv;
      s.pl.equip = data.pl.equip || { head: null, chest: null, legs: null, feet: null };
      s.pl.weapon = data.pl.weapon || 'fists';
      s.pl.hotbar = data.pl.hotbar || ['torch', 'campfire', 'workbench', 'forge', 'stone_axe'];
      s.pl.spd = data.pl.spd || 3.0;
      s.pl.xp = data.pl.xp ?? 0;
      s.pl.lvl = data.pl.lvl ?? 1;
      s.pl.xpNext = data.pl.xpNext ?? 100;
      s.pl.def = data.pl.def ?? 0;
      s.pl.skills = data.pl.skills || {
        fishing: { lvl: 1, xp: 0, xpNext: 100 },
        cooking: { lvl: 1, xp: 0, xpNext: 100 },
        mining: { lvl: 1, xp: 0, xpNext: 100 },
        woodcutting: { lvl: 1, xp: 0, xpNext: 100 },
        combat: { lvl: 1, xp: 0, xpNext: 100 },
        alchemy: { lvl: 1, xp: 0, xpNext: 100 }
      };

      // 2. Restore World Objects
      s.objs = data.objs || [];

      // 3. Restore Companions safely
      s.companions = (data.companions || []).map((c: any) => ({
        ...c,
        target: null,
        cd: 0,
        scd: 0
      }));

      // 4. Restore Environment state
      s.ticks = data.ticks ?? 0;
      s.day = data.day ?? 1;
      s.dayTime = data.dayTime ?? 0.4;
      s.waveNum = data.waveNum ?? 0;
      s.waveTimer = data.waveTimer ?? 300;
      s.waveActive = data.waveActive ?? false;

      // 5. Purge transient objects
      s.enemies = [];
      s.projs = [];
      s.parts = [];

      // 6. Center camera
      s.cam.x = s.pl.x - window.innerWidth / 2;
      s.cam.y = s.pl.y - window.innerHeight / 2;

      addLog("Successfully loaded saved game progress!", "#38bdf8");
      setGameState({ ...s });
      setImportError(null);
      return true;
    } catch (err) {
      console.error(err);
      addLog("Parsing save failed!", "#f87171");
      setImportError("Error: Failed to process save string serialization.");
      return false;
    }
  }, []);

  // Save progress
  const saveGame = useCallback((slotId: string) => {
    const s = stateRef.current;
    if (!s) return;

    try {
      const saveData = {
        pl: {
          x: s.pl.x,
          y: s.pl.y,
          targetX: s.pl.targetX,
          targetY: s.pl.targetY,
          hp: s.pl.hp,
          mhp: s.pl.mhp,
          hu: s.pl.hu,
          sta: s.pl.sta,
          mp: s.pl.mp,
          mmp: s.pl.mmp,
          inv: s.pl.inv,
          equip: s.pl.equip,
          weapon: s.pl.weapon,
          hotbar: s.pl.hotbar,
          spd: s.pl.spd,
          xp: s.pl.xp,
          lvl: s.pl.lvl,
          xpNext: s.pl.xpNext,
          def: s.pl.def,
          skills: s.pl.skills
        },
        objs: s.objs,
        companions: s.companions.map((c: any) => ({
          n: c.n,
          ico: c.ico,
          hp: c.hp,
          mhp: c.mhp,
          spd: c.spd,
          dmg: c.dmg,
          x: c.x,
          y: c.y
        })),
        ticks: s.ticks,
        day: s.day,
        dayTime: s.dayTime,
        waveNum: s.waveNum,
        waveTimer: s.waveTimer,
        waveActive: s.waveActive,
        timestamp: Date.now()
      };

      localStorage.setItem(`wild_survival_save_${slotId}`, JSON.stringify(saveData));
      addLog(`Saved game in Slot ${slotId.toUpperCase()}!`, '#4df8aa');
      loadSlotMetadata();
    } catch (err) {
      console.error(err);
      addLog("Save failed!", "#f87171");
    }
  }, [loadSlotMetadata]);

  // Load progress
  const loadGame = useCallback((slotId: string) => {
    const raw = localStorage.getItem(`wild_survival_save_${slotId}`);
    if (!raw) {
      addLog(`No save data in Slot ${slotId.toUpperCase()}`, "#f87171");
      return;
    }
    const success = loadGameDataStr(raw);
    if (success) {
      setShowSaveMenu(false);
    }
  }, [loadGameDataStr]);

  // Delete save progress
  const deleteSave = useCallback((slotId: string) => {
    localStorage.removeItem(`wild_survival_save_${slotId}`);
    addLog(`Deleted Save Slot ${slotId.toUpperCase()}`, "#fca5a5");
    loadSlotMetadata();
  }, [loadSlotMetadata]);

  // Export save data as file download
  const exportSaveToFile = useCallback((slotId: string) => {
    const raw = localStorage.getItem(`wild_survival_save_${slotId}`);
    if (!raw) {
      addLog(`Nothing to export in Slot ${slotId.toUpperCase()}!`, "#f87171");
      return;
    }

    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(raw);
      const dlAnchor = document.createElement('a');
      dlAnchor.setAttribute("href", dataStr);
      dlAnchor.setAttribute("download", `wilderness_survival_save_slot_${slotId}.json`);
      document.body.appendChild(dlAnchor);
      dlAnchor.click();
      dlAnchor.remove();
      addLog("Exported save to JSON file!", "#4df8aa");
    } catch (err) {
      console.error(err);
      addLog("File export failed", "#f87171");
    }
  }, []);

  // Import save from text field
  const handleImportSaveText = useCallback(() => {
    if (!importString.trim()) {
      setImportError("Please paste a valid save string first!");
      return;
    }
    const success = loadGameDataStr(importString.trim());
    if (success) {
      setImportString('');
      setShowSaveMenu(false);
      addLog("Imported save string successfully!", "#4df8aa");
    }
  }, [importString, loadGameDataStr]);

  // Autosave handler (called inside loop)
  const autosaveGame = useCallback(() => {
    const s = stateRef.current;
    if (!s) return;

    try {
      const saveData = {
        pl: {
          x: s.pl.x,
          y: s.pl.y,
          targetX: s.pl.targetX,
          targetY: s.pl.targetY,
          hp: s.pl.hp,
          mhp: s.pl.mhp,
          hu: s.pl.hu,
          sta: s.pl.sta,
          mp: s.pl.mp,
          mmp: s.pl.mmp,
          inv: s.pl.inv,
          equip: s.pl.equip,
          weapon: s.pl.weapon,
          hotbar: s.pl.hotbar,
          spd: s.pl.spd,
          xp: s.pl.xp,
          lvl: s.pl.lvl,
          xpNext: s.pl.xpNext,
          def: s.pl.def,
          skills: s.pl.skills
        },
        objs: s.objs,
        companions: s.companions.map((c: any) => ({
          n: c.n,
          ico: c.ico,
          hp: c.hp,
          mhp: c.mhp,
          spd: c.spd,
          dmg: c.dmg,
          x: c.x,
          y: c.y
        })),
        ticks: s.ticks,
        day: s.day,
        dayTime: s.dayTime,
        waveNum: s.waveNum,
        waveTimer: s.waveTimer,
        waveActive: s.waveActive,
        timestamp: Date.now()
      };

      localStorage.setItem('wild_survival_save_autosave', JSON.stringify(saveData));
      addLog("💾 Autosaved progress", "#38bdf8");
      loadSlotMetadata();
    } catch (err) {
      console.error("Autosave failed:", err);
    }
  }, [loadSlotMetadata]);

  const stateRef = useRef<any>(null);
  const keysRef = useRef<Record<string, boolean>>({});
  const joyRef = useRef({ x: 0, y: 0, active: false });

  // Initialize Game
  useEffect(() => {
    const initGame = () => {
      const initialPl = {
        x: Math.floor(ZW / 2) * TZ + TZ / 2,
        y: Math.floor(ZH / 2) * TZ + TZ / 2,
        targetX: Math.floor(ZW / 2) * TZ + TZ / 2,
        targetY: Math.floor(ZH / 2) * TZ + TZ / 2,
        isGridMoving: false,
        hp: 100, mhp: 100, hu: 100, sta: 100, mp: 100, mmp: 100,
        inv: { wood: 10, stone: 5, fiber: 5, herb: 3, berry: 5, torch: 1 },
        equip: { head: null, chest: null, legs: null, feet: null },
        weapon: 'fists',
        hotbar: ['torch', 'campfire', 'workbench', 'forge', 'stone_axe', 'iron_sword', 'shortbow', 'fishing_rod'],
        spd: 3.0, sprint: false, atkcd: 0, gcd: 0, ifr: 0, xp: 0, lvl: 1, xpNext: 100, def: 0,
        skills: {
          fishing: { lvl: 1, xp: 0, xpNext: 100 },
          cooking: { lvl: 1, xp: 0, xpNext: 100 },
          mining: { lvl: 1, xp: 0, xpNext: 100 },
          woodcutting: { lvl: 1, xp: 0, xpNext: 100 },
          combat: { lvl: 1, xp: 0, xpNext: 100 },
          alchemy: { lvl: 1, xp: 0, xpNext: 100 }
        }
      };

      const world: number[][] = [];
      const objs: any[] = [];
      
      // Generate World
      for (let zr = 0; zr < ZROWS; zr++) {
        for (let zc = 0; zc < ZCOLS; zc++) {
          const mi = zr * ZCOLS + zc;
          const M = MAPS[mi] || MAPS[0];
          const rng = mkRng(M.s + mi * 7919);
          const ox = zc * ZW, oy = zr * ZH;

          for (let ly = 0; ly < ZH; ly++) {
            if (!world[oy + ly]) world[oy + ly] = [];
            for (let lx = 0; lx < ZW; lx++) {
              const wx = ox + lx, wy = oy + ly;
              const n = (Math.sin(wx * .37 + wy * .19 + M.s * .001) * .5 + .5) + (Math.sin(wx * .11 - wy * .29 + M.s * .001) * .35);
              world[wy][wx] = n < .18 ? M.w : n < .24 ? M.f : n > .82 ? M.r : M.m;
              
              // Objects
              if (lx > 2 && lx < ZW - 2 && ly > 2 && ly < ZH - 2) {
                if ((world[wy][wx] === M.m || world[wy][wx] === M.f) && rng() < M.wf) {
                  objs.push({ type: 'tree', tx: wx, ty: wy, hp: 3, mhp: 3 });
                } else if ((world[wy][wx] === M.m || world[wy][wx] === M.r) && rng() < M.rf) {
                  objs.push({ type: 'rock', tx: wx, ty: wy, hp: 4, mhp: 4 });
                } else {
                  for (const [k, v] of Object.entries(M.dr)) {
                    if (rng() < (v as number)) objs.push({ type: 'drop', tx: wx, ty: wy, item: k, qty: 1 + Math.floor(rng() * 2) });
                  }
                }
              }
            }
          }
        }
      }

      const newState = {
        pl: initialPl,
        world,
        objs,
        enemies: [],
        companions: [],
        projs: [],
        parts: [],
        ticks: 0,
        day: 1,
        dayTime: 0.4,
        waveNum: 0,
        waveTimer: 300,
        waveActive: false,
        cam: { x: initialPl.x - window.innerWidth / 2, y: initialPl.y - window.innerHeight / 2 }
      };

      stateRef.current = newState;
      setGameState(newState);
    };

    initGame();

    const handleKeyDown = (e: KeyboardEvent) => keysRef.current[e.key] = true;
    const handleKeyUp = (e: KeyboardEvent) => keysRef.current[e.key] = false;
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Game Loop
  useEffect(() => {
    if (!gameState) return;

    let frameId: number;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    const loop = () => {
      const s = stateRef.current;
      if (!s) return;

      if (!pausedRef.current) {
        // --- Update ---
        s.ticks++;
        s.dayTime = (s.ticks % 18000) / 18000;
        if (s.ticks % 18000 === 0) s.day++;

      // Periodic HUD state sync to React to render player bar modifications
      if (s.ticks % 15 === 0) {
        setGameState({ ...s });
      }

      // Autosave trigger every 60 seconds (3600 ticks @ 60fps)
      if (autosaveEnabledRef.current && s.ticks > 0 && s.ticks % 3600 === 0) {
        autosaveGame();
      }

      // Player Grid-Based Movement
      let dx = 0, dy = 0;
      if (keysRef.current['w'] || keysRef.current['ArrowUp'] || keysRef.current['W']) dy -= 1;
      else if (keysRef.current['s'] || keysRef.current['ArrowDown'] || keysRef.current['S']) dy += 1;
      else if (keysRef.current['a'] || keysRef.current['ArrowLeft'] || keysRef.current['A']) dx -= 1;
      else if (keysRef.current['d'] || keysRef.current['ArrowRight'] || keysRef.current['D']) dx += 1;
      
      // Virtual Joystick input
      if (joyRef.current.active && dx === 0 && dy === 0) {
        if (Math.abs(joyRef.current.x) > Math.abs(joyRef.current.y)) {
          dx = joyRef.current.x > 0 ? 1 : -1;
        } else {
          dy = joyRef.current.y > 0 ? 1 : -1;
        }
      }

      // Mana Regen
      if (s.ticks % 60 === 0 && s.pl.mp < s.pl.mmp) {
        let eventManaRegen = 0;
        if (s.activeEvent?.effect?.statModifiers?.manaRegen) {
          eventManaRegen = Math.round(s.activeEvent.effect.statModifiers.manaRegen);
        }
        s.pl.mp = Math.min(s.pl.mmp, s.pl.mp + 1 + Math.floor(s.pl.lvl / 5) + eventManaRegen);
      }

      // Grid Movement execution
      if (!s.pl.isGridMoving) {
        if (dx !== 0 || dy !== 0) {
          const currentTx = Math.floor(s.pl.x / TZ);
          const currentTy = Math.floor(s.pl.y / TZ);
          const targetTx = currentTx + dx;
          const targetTy = currentTy + dy;

          if (targetTx >= 0 && targetTx < WW && targetTy >= 0 && targetTy < WH) {
            if (s.world[targetTy][targetTx] !== TW) {
              s.pl.targetX = targetTx * TZ + TZ / 2;
              s.pl.targetY = targetTy * TZ + TZ / 2;
              s.pl.isGridMoving = true;
            }
          }
        }
      }

      let isSprinting = false;
      if (s.pl.isGridMoving && keysRef.current['Shift'] && s.pl.sta > 2) {
        isSprinting = true;
      }

      if (isSprinting) {
        s.pl.sta = Math.max(0, s.pl.sta - 0.45); // Drain stamina on sprint
      } else {
        s.pl.sta = Math.min(100, s.pl.sta + 0.25); // Passively regenerate stamina
      }

      if (s.pl.isGridMoving) {
        let eventSpeedMult = 1.0;
        if (s.activeEvent?.effect?.statModifiers?.speedBoost) {
          eventSpeedMult = s.activeEvent.effect.statModifiers.speedBoost;
        }
        const speed = s.pl.spd * (isSprinting ? 1.7 : 1) * eventSpeedMult;
        const diffX = s.pl.targetX - s.pl.x;
        const diffY = s.pl.targetY - s.pl.y;
        const d = Math.hypot(diffX, diffY);

        if (d <= speed) {
          s.pl.x = s.pl.targetX;
          s.pl.y = s.pl.targetY;
          s.pl.isGridMoving = false;

          // Step action drains hunger
          s.pl.hu = Math.max(0, s.pl.hu - 1);
          if (s.pl.hu <= 0) {
            s.pl.hp = Math.max(0, s.pl.hp - 2);
            if (s.pl.hp <= 0 && !showDeathScreen) {
              setShowDeathScreen(true);
            }
          }
        } else {
          s.pl.x += (diffX / d) * speed;
          s.pl.y += (diffY / d) * speed;
        }
      }

      // Background hunger and health starvation decay over time
      if (s.ticks % 200 === 0) {
        s.pl.hu = Math.max(0, s.pl.hu - 1);
        if (s.pl.hu <= 0) {
          s.pl.hp = Math.max(0, s.pl.hp - 1);
          if (s.pl.hp <= 0 && !showDeathScreen) {
            setShowDeathScreen(true);
          }
        }
      }

      // Camera
      s.cam.x += (s.pl.x - window.innerWidth / 2 - s.cam.x) * 0.1;
      s.cam.y += (s.pl.y - window.innerHeight / 2 - s.cam.y) * 0.1;

      // --- Combat Update ---
      if (s.pl.atkcd > 0) s.pl.atkcd--;
      if (s.pl.ifr > 0) s.pl.ifr--;

      // Enemy Spawning
      if (s.ticks % 300 === 0 && s.enemies.length < 10) {
        const mapIdx = Math.floor(s.pl.y / (ZH * TZ)) * ZCOLS + Math.floor(s.pl.x / (ZW * TZ));
        const M = MAPS[mapIdx] || MAPS[0];
        const eid = M.ef[Math.floor(Math.random() * M.ef.length)];
        const et = ET[eid];
        if (et) {
          const ang = Math.random() * Math.PI * 2;
          const dist = 400 + Math.random() * 200;
          s.enemies.push({
            x: s.pl.x + Math.cos(ang) * dist,
            y: s.pl.y + Math.sin(ang) * dist,
            hp: et.hp, mhp: et.hp, eid, spd: et.spd, dmg: et.dmg, acd: et.acd, cd: 0, ran: et.ran
          });
        }
      }

      // Enemy AI
      for (let i = s.enemies.length - 1; i >= 0; i--) {
        const e = s.enemies[i];

        // Apply Status Effects
        if (e.slowTicks > 0) {
          e.slowTicks--;
        }
        if (e.burnTicks > 0) {
          e.burnTicks--;
          if (s.ticks % 30 === 0) e.hp -= 2;
        }

        const d = dist(e, s.pl);
        if (d < 400) {
          const ang = Math.atan2(s.pl.y - e.y, s.pl.x - e.x);
          const spd = e.slowTicks > 0 ? e.spd * 0.5 : e.spd;
          if (d > 30) {
            const nx = e.x + Math.cos(ang) * spd;
            const ny = e.y + Math.sin(ang) * spd;
            const etx = Math.floor(nx / TZ);
            const ety = Math.floor(ny / TZ);
            if (etx >= 0 && etx < WW && ety >= 0 && ety < WH && s.world[ety][etx] !== TW) {
              e.x = nx;
              e.y = ny;
            }
          }
          // Attack player
          if (d < 40 && e.cd <= 0 && s.pl.ifr <= 0) {
            const dmg = Math.max(1, e.dmg - s.pl.def);
            s.pl.hp -= dmg;
            s.pl.ifr = 40;
            e.cd = e.acd;
            addLog(`Hit by ${ET[e.eid].n}! -${dmg} HP`, '#f44');
            if (s.pl.hp <= 0) {
              s.pl.hp = 0;
              setShowDeathScreen(true);
            }
          }
        }
        if (e.cd > 0) e.cd--;
      }

      // Companion AI
      for (const c of s.companions) {
        c.target = null; // Reset target indicator
        const dPl = dist(c, s.pl);
        const angPl = Math.atan2(s.pl.y - c.y, s.pl.x - c.x);
        
        // Mode thresholds (synced with React state for logic)
        const currentMode = (document.getElementById('comp-mode-btn')?.getAttribute('data-mode') || 'guard') as 'guard' | 'attack';
        const maxDistFromPl = currentMode === 'guard' ? 150 : 400;
        const searchRange = currentMode === 'guard' ? 200 : 500;

        // Search for best target
        let bestTarget = null;
        let bestScore = -1;

        for (const e of s.enemies) {
          const dEToC = dist(c, e);
          const dEToPl = dist(s.pl, e);

          if (dEToPl < searchRange || dEToC < searchRange) {
             let score = 0;
             // Distance score (closer is better)
             score += (searchRange - dEToC) * 0.5;
             // Prioritize enemies attacking player
             if (dEToPl < 60) score += 300;
             // Prioritize enemies closer to player
             score += (searchRange - dEToPl) * 0.3;

             if (score > bestScore) {
               bestScore = score;
               bestTarget = e;
             }
          }
        }

        if (bestTarget && dPl < maxDistFromPl) {
          c.target = bestTarget;
          const dTarget = dist(c, bestTarget);
          const angE = Math.atan2(bestTarget.y - c.y, bestTarget.x - c.x);
          
          // Move to target
          if (dTarget > 35) {
            let spd = c.spd;
            // Skill check: Dash
            if (c.scd <= 0 && dTarget > 60 && dTarget < 150) {
              spd *= 5; // Dash speed
              c.scd = 300; // 5s skill cooldown
              s.parts.push({ x: c.x, y: c.y, vx: 0, vy: 0, life: 20, col: '#fff', sz: 8 });
              addLog(`${c.n} used Dash Attack!`, '#fff');
            }
            c.x += Math.cos(angE) * spd;
            c.y += Math.sin(angE) * spd;
          }

          // Attack
          if (dTarget < 45 && c.cd <= 0) {
            let dmg = c.dmg;
            // Bonus damage if skill was recently used
            if (c.scd > 280) dmg *= 2; 
            
            bestTarget.hp -= dmg;
            c.cd = 40;
            if (bestTarget.hp <= 0) {
              const et = ET[bestTarget.eid];
              if (et) {
                s.pl.xp += et.xp;
                addLog(`Companion killed ${et.n}!`, '#ffd700');
                addSkillXPDirect(s, 'combat', Math.ceil(et.xp * 0.3));
              }
            }
          }
        } else {
          // No target or too far, return to player
          if (dPl > 45) {
            c.x += Math.cos(angPl) * c.spd;
            c.y += Math.sin(angPl) * c.spd;
          }
        }

        if (c.cd > 0) c.cd--;
        if (c.scd > 0) c.scd--;
      }

      // Projectiles
      for (let i = s.projs.length - 1; i >= 0; i--) {
        const p = s.projs[i];
        p.x += p.vx;
        p.y += p.vy;
        p.dist += Math.hypot(p.vx, p.vy);
        if (p.dist > p.rng) {
          s.projs.splice(i, 1);
          continue;
        }
        // Hit enemies
        for (let j = s.enemies.length - 1; j >= 0; j--) {
          const e = s.enemies[j];
          if (dist(p, e) < 20) {
            e.hp -= p.dmg;
            if (p.vamp && p.vamp > 0) {
              const heal = Math.round(p.dmg * p.vamp);
              if (heal > 0) {
                s.pl.hp = Math.min(s.pl.mhp, s.pl.hp + heal);
                addLog(`🩸 Vampirism: +${heal} HP!`, '#ff3366');
              }
            }
            if (p.fx === 'slow') e.slowTicks = 180;
            if (p.fx === 'burn') e.burnTicks = 300;
            if (p.fx === 'void') {
              // AOE damage
              for (const other of s.enemies) {
                if (dist(e, other) < 100) other.hp -= p.dmg * 0.5;
              }
            }
            s.projs.splice(i, 1);
            if (e.hp <= 0) {
              const et = ET[e.eid];
              s.pl.xp += et.xp;
              addLog(`Killed ${et.n}! +${et.xp} XP`, '#ffd700');
              addSkillXPDirect(s, 'combat', Math.ceil(et.xp * 0.5));
              s.enemies.splice(j, 1);
            }
            break;
          }
        }
      }

      // --- Active World Event Handler ---
      if (s.activeEvent) {
        s.activeEvent.ticksLeft--;
        
        if (s.activeEvent.effect?.statModifiers?.healthDrain) {
          if (s.ticks % 60 === 0) {
            s.pl.hp = Math.max(0, s.pl.hp - s.activeEvent.effect.statModifiers.healthDrain);
            if (s.pl.hp <= 0 && !showDeathScreen) {
              setShowDeathScreen(true);
            }
          }
        }

        if (s.ticks % 180 === 0 && s.activeEvent.effect?.spawnResource && s.activeEvent.effect.spawnResource !== 'none') {
          const px = Math.floor(s.pl.x / TZ);
          const py = Math.floor(s.pl.y / TZ);
          const rtx = px + Math.floor(Math.random() * 11) - 5;
          const rty = py + Math.floor(Math.random() * 11) - 5;
          if (rtx >= 0 && rtx < ZW && rty >= 0 && rty < ZH) {
            if (s.world[rty][rtx] !== TW) {
              s.objs.push({
                type: 'drop',
                tx: rtx,
                ty: rty,
                item: s.activeEvent.effect.spawnResource,
                qty: 1 + Math.floor(Math.random() * 2)
              });
              addLog(`🌠 A meteor crashed nearby!`, '#38bdf8');
            }
          }
        }

        if (s.activeEvent.ticksLeft <= 0) {
          addLog(`🌌 The world event "${s.activeEvent.title}" has subsided.`, '#38bdf8');
          s.activeEvent = null;
        }
      }

      // --- Trigger Random World Event (Periodic Gemini Challenge) ---
      if (s.ticks > 0 && s.ticks % 4200 === 0 && !s.activeEvent) {
        triggerWorldEvent();
      }

      // --- Automation Cores ---
      if (autoAttackRef.current && s.pl.atkcd <= 0) {
        const wp = getWeaponStats(s, s.pl.weapon);
        let target = null;
        let minDist = wp.rng;
        for (const e of s.enemies) {
          const d = dist(s.pl, e);
          if (d < minDist) {
            minDist = d;
            target = e;
          }
        }
        if (target) {
          handleAttack();
        }
      }

      if (autoHarvestRef.current && s.ticks % 35 === 0) {
        handleGather();
      }

      if (autoCollectRef.current && s.ticks % 10 === 0) {
        const px = Math.floor(s.pl.x / TZ);
        const py = Math.floor(s.pl.y / TZ);
        for (let i = s.objs.length - 1; i >= 0; i--) {
          const o = s.objs[i];
          if (o.type === 'drop') {
            if (Math.abs(o.tx - px) + Math.abs(o.ty - py) <= 6) {
              s.pl.inv[o.item] = (s.pl.inv[o.item] || 0) + o.qty;
              addLog(`🧲 Vacuumed item: +${IT[o.item]?.n || o.item} x${o.qty}`, '#ccffaa');
              s.objs.splice(i, 1);
            }
          }
        }
      }
      } // End of if (!pausedRef.current)

      // --- Draw ---
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      
      // Tiles
      const sx0 = Math.max(0, Math.floor(s.cam.x / TZ) - 1);
      const sy0 = Math.max(0, Math.floor(s.cam.y / TZ) - 1);
      const ex = Math.min(WW, sx0 + Math.floor(ctx.canvas.width / TZ) + 2);
      const ey = Math.min(WH, sy0 + Math.floor(ctx.canvas.height / TZ) + 2);

      for (let y = sy0; y < ey; y++) {
        for (let x = sx0; x < ex; x++) {
          const t = s.world[y][x];
          const tc = TC[t] || TC[0];
          ctx.fillStyle = (x + y) % 2 === 0 ? tc[0] : tc[1];
          ctx.fillRect(x * TZ - s.cam.x, y * TZ - s.cam.y, TZ, TZ);
          
          // Celestial Realm Glow
          if (t === TCR) {
            ctx.fillStyle = `rgba(168, 85, 247, ${0.05 + Math.sin(s.ticks * 0.05 + x + y) * 0.02})`;
            ctx.fillRect(x * TZ - s.cam.x, y * TZ - s.cam.y, TZ, TZ);
          }
        }
      }

      // Objects
      ctx.font = `${TZ - 6}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const o of s.objs) {
        const ox = o.tx * TZ + TZ / 2 - s.cam.x;
        const oy = o.ty * TZ + TZ / 2 - s.cam.y;
        if (ox < -TZ || ox > ctx.canvas.width + TZ || oy < -TZ || oy > ctx.canvas.height + TZ) continue;
        
        let ico = '?';
        if (o.type === 'tree') ico = '🌲';
        else if (o.type === 'rock') ico = '🪨';
        else if (o.type === 'drop') ico = IT[o.item]?.ico || '•';
        else if (o.type === 'magic_altar') ico = '🕋';
        else if (o.type === 'campfire') {
          ico = s.ticks % 20 < 10 ? '🔥' : '🕯️';
          // Fire glow
          const grad = ctx.createRadialGradient(ox, oy, 0, ox, oy, TZ * 2);
          grad.addColorStop(0, 'rgba(255, 165, 0, 0.2)');
          grad.addColorStop(1, 'rgba(255, 165, 0, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(ox, oy, TZ * 2, 0, Math.PI * 2);
          ctx.fill();
        }
        
        ctx.fillStyle = 'white';
        ctx.fillText(ico, ox, oy);
      }

      // Player
      ctx.font = `${TZ + 4}px serif`;
      if (s.pl.ifr > 0 && s.ticks % 10 < 5) ctx.globalAlpha = 0.5;
      ctx.fillText('🧍', s.pl.x - s.cam.x, s.pl.y - s.cam.y);
      ctx.globalAlpha = 1;

      // Enemies
      for (const e of s.enemies) {
        const ex = e.x - s.cam.x;
        const ey = e.y - s.cam.y;
        if (ex < -TZ || ex > ctx.canvas.width + TZ || ey < -TZ || ey > ctx.canvas.height + TZ) continue;
        ctx.font = `${TZ}px serif`;
        ctx.fillText(ET[e.eid].ico, ex, ey);
        // Health bar
        ctx.fillStyle = '#300';
        ctx.fillRect(ex - 15, ey - 25, 30, 4);
        ctx.fillStyle = '#f00';
        ctx.fillRect(ex - 15, ey - 25, 30 * (e.hp / e.mhp), 4);
      }

      // Companions
      for (const c of s.companions) {
        const cx = c.x - s.cam.x;
        const cy = c.y - s.cam.y;
        if (cx < -TZ || cx > ctx.canvas.width + TZ || cy < -TZ || cy > ctx.canvas.height + TZ) continue;

        // Target Indicator
        if (c.target && c.target.hp > 0) {
          ctx.strokeStyle = 'rgba(0, 255, 170, 0.2)';
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(cx, cy - 10);
          ctx.lineTo(c.target.x - s.cam.x, c.target.y - s.cam.y);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Skill Effect
        if (c.scd > 280) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cx, cy - 10, 20 + Math.sin(s.ticks * 0.5) * 5, 0, Math.PI * 2);
          ctx.stroke();
          ctx.lineWidth = 1;
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 8px monospace';
          ctx.textAlign = 'center';
          ctx.fillText("DASH!", cx, cy - 45);
        }

        ctx.font = `${TZ}px serif`;
        ctx.textAlign = 'center';
        ctx.fillText(c.ico, cx, cy);
        // Name
        ctx.font = '10px monospace';
        ctx.fillStyle = '#00ffaa';
        ctx.fillText(c.n, cx, cy - 35);
        // HP
        ctx.fillStyle = '#111';
        ctx.fillRect(cx - 15, cy - 25, 30, 4);
        ctx.fillStyle = '#00ffaa';
        ctx.fillRect(cx - 15, cy - 25, 30 * (c.hp / c.mhp), 4);
        ctx.textAlign = 'start';
      }

      // Projectiles
      for (const p of s.projs) {
        ctx.fillStyle = p.col;
        ctx.beginPath();
        ctx.arc(p.x - s.cam.x, p.y - s.cam.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Night Overlay
      const nightA = s.dayTime < 0.2 ? Math.max(0, 0.6 - (s.dayTime / 0.2) * 0.6) : s.dayTime < 0.65 ? 0 : Math.min(0.6, (s.dayTime - 0.65) / 0.15 * 0.6);
      if (nightA > 0) {
        ctx.fillStyle = `rgba(0, 0, 20, ${nightA})`;
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        
        // Light around player
        const isTorch = s.pl.hotbar[hotSlot] === 'torch' && (s.pl.inv['torch'] || 0) > 0;
        const radius = isTorch ? 500 : 350;
        const grad = ctx.createRadialGradient(s.pl.x - s.cam.x, s.pl.y - s.cam.y, 0, s.pl.x - s.cam.x, s.pl.y - s.cam.y, radius);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, `rgba(0,0,20,${nightA})`);
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(s.pl.x - s.cam.x, s.pl.y - s.cam.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }

      frameId = requestAnimationFrame(loop);
    };


    loop();
    return () => cancelAnimationFrame(frameId);
  }, [gameState]);

  const addLog = (msg: string, col: string = '#a8ff78') => {
    setLogs(prev => [{ msg, col }, ...prev].slice(0, 5));
  };

  const triggerWorldEvent = async () => {
    const s = stateRef.current;
    if (!s || s.activeEvent) return;

    pausedRef.current = true;
    addLog("🌌 A massive atmospheric disturbance has been detected...", "#f59e0b");
    
    try {
      const eventData = await generateWorldEvent(s);
      if (eventData && eventData.title) {
        if (eventData.choices) {
          eventData.choices = eventData.choices.map((c: any) => {
            let isMet = true;
            if (c.requirement && c.requirement !== "None" && c.requirement !== "none") {
              const match = c.requirement.match(/Level\s*(\d+)/i);
              if (match) {
                const reqLvl = parseInt(match[1]);
                if (s.pl.lvl < reqLvl) isMet = false;
              }
              const resMatch = c.requirement.match(/(\d+)\s*([a-zA-Z_]+)/i);
              if (resMatch) {
                const reqQty = parseInt(resMatch[1]);
                const reqItem = resMatch[2].toLowerCase().replace(/s$/, "");
                let mappedKey = reqItem;
                if (reqItem === "crystal" || reqItem === "crystals") mappedKey = "crystal";
                if (reqItem === "wood") mappedKey = "wood";
                if (reqItem === "stone") mappedKey = "stone";
                if (reqItem === "gem" || reqItem === "gems") mappedKey = "gem";
                
                if ((s.pl.inv[mappedKey] || 0) < reqQty) isMet = false;
              }
            }
            return { ...c, isMet };
          });
        }
        setNarrativeEvent(eventData);
        setEventChoiceOutcome(null);
        setShowEventModal(true);
      } else {
        pausedRef.current = false;
      }
    } catch (err) {
      console.error(err);
      pausedRef.current = false;
    }
  };

  const handleSelectEventChoice = (choice: any) => {
    const s = stateRef.current;
    if (!s || !narrativeEvent) return;

    if (choice.requirement && choice.requirement !== "None" && choice.requirement !== "none") {
      const resMatch = choice.requirement.match(/(\d+)\s*([a-zA-Z_]+)/i);
      if (resMatch) {
        const reqQty = parseInt(resMatch[1]);
        const reqItem = resMatch[2].toLowerCase().replace(/s$/, "");
        let mappedKey = reqItem;
        if (reqItem === "crystal" || reqItem === "crystals") mappedKey = "crystal";
        if (reqItem === "wood") mappedKey = "wood";
        if (reqItem === "stone") mappedKey = "stone";
        if (reqItem === "gem" || reqItem === "gems") mappedKey = "gem";

        if ((s.pl.inv[mappedKey] || 0) >= reqQty) {
          s.pl.inv[mappedKey] -= reqQty;
          addLog(`Paid ${reqQty}x ${IT[mappedKey]?.n || mappedKey} for the choice.`, '#f87171');
        }
      }
    }

    const rew = choice.reward;
    let outcomeText = choice.outcomeDescription;

    if (rew) {
      let rewardLogs = [];
      if (rew.item && rew.item !== "none" && rew.item !== "None") {
        const q = rew.qty || 1;
        s.pl.inv[rew.item] = (s.pl.inv[rew.item] || 0) + q;
        rewardLogs.push(`+${IT[rew.item]?.n || rew.item} x${q}`);
      }
      if (rew.xp && rew.xp > 0) {
        s.pl.xp += rew.xp;
        rewardLogs.push(`+${rew.xp} XP`);
        while (s.pl.xp >= s.pl.xpNext) {
          s.pl.xp -= s.pl.xpNext;
          s.pl.lvl++;
          s.pl.xpNext = Math.floor(s.pl.xpNext * 1.5);
          s.pl.mhp += 10;
          s.pl.mmp += 10;
          s.pl.hp = s.pl.mhp;
          s.pl.mp = s.pl.mmp;
          addLog(`✨ LEVEL UP! You reached level ${s.pl.lvl}!`, '#eab308');
        }
      }
      if (rew.hpChange && rew.hpChange !== 0) {
        if (rew.hpChange > 0) {
          s.pl.hp = Math.min(s.pl.mhp, s.pl.hp + rew.hpChange);
          rewardLogs.push(`+${rew.hpChange} HP`);
        } else {
          s.pl.hp = Math.max(0, s.pl.hp - Math.abs(rew.hpChange));
          rewardLogs.push(`${rew.hpChange} HP`);
          if (s.pl.hp <= 0 && !showDeathScreen) {
            setShowDeathScreen(true);
          }
        }
      }

      if (rewardLogs.length > 0) {
        outcomeText += `\n\nRewards: ${rewardLogs.join(", ")}`;
      }
    }

    setEventChoiceOutcome(outcomeText);

    s.activeEvent = {
      title: narrativeEvent.title,
      effect: narrativeEvent.effect,
      ticksLeft: (narrativeEvent.durationSeconds || 45) * 60,
    };
    
    setGameState({ ...s });
  };

  const handleAcknowledgeEvent = () => {
    const s = stateRef.current;
    setShowEventModal(false);
    setNarrativeEvent(null);
    setEventChoiceOutcome(null);
    pausedRef.current = false;
    if (s && s.activeEvent) {
      addLog(`🌌 Active World Event: "${s.activeEvent.title}" is now in effect!`, '#a855f7');
    }
  };

  const handleAttack = () => {
    const s = stateRef.current;
    if (!s || s.pl.atkcd > 0) return;

    const wp = getWeaponStats(s, s.pl.weapon);

    // Stamina verification for physical attacks
    if (wp.type === 'melee') {
      const cost = s.pl.weapon === 'fists' ? 6 : 10;
      if (s.pl.sta < cost) {
        addLog("Too exhausted to swing!", "#f87171");
        return;
      }
      s.pl.sta = Math.max(0, s.pl.sta - cost);
    } else if (wp.type === 'ranged') {
      const cost = 8;
      if (s.pl.sta < cost) {
        addLog("Too exhausted to draw bow!", "#f87171");
        return;
      }
      s.pl.sta = Math.max(0, s.pl.sta - cost);
    }

    s.pl.atkcd = wp.spd;

    let eventDmgBoost = 1.0;
    if (s.activeEvent?.effect?.statModifiers?.dmgBoost) {
      eventDmgBoost = s.activeEvent.effect.statModifiers.dmgBoost;
    }

    if (wp.type === 'melee') {
      const combatLvl = s.pl.skills?.combat?.lvl || 1;
      const finalDmg = Math.round(wp.dmg * (1 + (combatLvl - 1) * 0.05) * eventDmgBoost);
      for (let i = s.enemies.length - 1; i >= 0; i--) {
        const e = s.enemies[i];
        if (dist(s.pl, e) < wp.rng) {
          e.hp -= finalDmg;
          if (wp.vamp && wp.vamp > 0) {
            const heal = Math.round(finalDmg * wp.vamp);
            if (heal > 0) {
              s.pl.hp = Math.min(s.pl.mhp, s.pl.hp + heal);
              addLog(`🩸 Vampirism: +${heal} HP!`, '#ff3366');
            }
          }
          if (e.hp <= 0) {
            const et = ET[e.eid];
            s.pl.xp += et.xp;
            addLog(`Killed ${et.n}! +${et.xp} XP`, '#ffd700');
            addSkillXPDirect(s, 'combat', Math.ceil(et.xp * 0.5));
            s.enemies.splice(i, 1);
          } else {
            addLog(`Hit ${ET[e.eid].n} for ${finalDmg}`, '#ffaa00');
          }
        }
      }
    } else if (wp.type === 'magic_heal') {
      if (s.pl.mp < wp.mp) {
        addLog("Not enough Mana", "#f44");
        return;
      }
      s.pl.mp -= wp.mp;
      const healAmount = 30 + Math.floor(s.pl.lvl * 2);
      s.pl.hp = Math.min(s.pl.mhp, s.pl.hp + healAmount);
      addLog(`Healed for ${healAmount} HP`, '#00ffaa');
    } else {
      const alchemyLvl = s.pl.skills?.alchemy?.lvl || 1;
      const manaCost = Math.max(2, Math.round(wp.mp * (1 - (alchemyLvl - 1) * 0.03)));
      if (s.pl.mp < manaCost) { // Only magic check
        addLog("Not enough Mana", "#f44");
        return;
      }
      // Find nearest enemy for auto-aim
      let target = null;
      let minDist = wp.rng;
      for (const e of s.enemies) {
        const d = dist(s.pl, e);
        if (d < minDist) {
          minDist = d;
          target = e;
        }
      }

      if (target) {
        const ang = Math.atan2(target.y - s.pl.y, target.x - s.pl.x);
        
        // Alchemy can also decrease staff mana cost!
        const alchemyLvl = s.pl.skills?.alchemy?.lvl || 1;
        const combatLvl = s.pl.skills?.combat?.lvl || 1;
        const manaCost = Math.max(2, Math.round(wp.mp * (1 - (alchemyLvl - 1) * 0.03)));
        
        if (s.pl.mp < manaCost) {
          addLog("Not enough Mana", "#f44");
          return;
        }
        
        s.pl.mp -= manaCost;
        
        // Scale damage
        const finalDmg = Math.round(wp.dmg * (1 + (wp.type === 'ranged' ? (combatLvl - 1) * 0.05 : (alchemyLvl - 1) * 0.05)) * eventDmgBoost);
        
        // Give some Alchemy XP if magic is cast
        if (wp.type === 'magic') {
          addSkillXPDirect(s, 'alchemy', 2);
        }
        
        s.projs.push({
          x: s.pl.x, y: s.pl.y,
          vx: Math.cos(ang) * 8, vy: Math.sin(ang) * 8,
          dmg: finalDmg, rng: wp.rng, dist: 0, 
          col: wp.col || '#ffaa44',
          fx: wp.fx,
          vamp: wp.vamp
        });
      } else {
        addLog("No target in range", "#888");
      }
    }
  };

  const handleRespawn = () => {
    const s = stateRef.current;
    if (!s) return;
    s.pl.hp = s.pl.mhp;
    s.pl.hu = 100;
    s.pl.x = Math.floor(ZW / 2) * TZ + TZ / 2;
    s.pl.y = Math.floor(ZH / 2) * TZ + TZ / 2;
    s.pl.targetX = s.pl.x;
    s.pl.targetY = s.pl.y;
    s.pl.isGridMoving = false;
    s.enemies = [];
    setShowDeathScreen(false);
    addLog("Respawned at start", "#88ccff");
  };

  const handleTame = () => {
    const s = stateRef.current;
    if (!s) return;
    if ((s.pl.inv.berry || 0) < 5) {
      addLog("Need 5 Berries to tame!", "#f44");
      return;
    }

    // Capture nearest "fox" or neutral entity
    let target = null;
    let minDist = 100;
    for (let i = s.enemies.length - 1; i >= 0; i--) {
      const e = s.enemies[i];
      if (e.eid === 'fox' && dist(s.pl, e) < minDist) {
        minDist = dist(s.pl, e);
        target = { idx: i, e };
      }
    }

    if (target) {
      s.pl.inv.berry -= 5;
      const e = target.e;
      s.enemies.splice(target.idx, 1);
      s.companions.push({
        n: "Tamed Fox", 
        ico: '🦊', 
        hp: e.hp, 
        mhp: e.mhp, 
        spd: 2.5, 
        dmg: 12, 
        cd: 0,
        scd: 0, // Skill cooldown
        target: null, // Current target for indicators
        x: s.pl.x,
        y: s.pl.y
      });
      addLog("Successfully tamed a Fox!", "#00ffaa");
    } else {
      addLog("No tamable creature nearby", "#888");
    }
  };

  const handleJoyTouch = (e: React.TouchEvent) => {
    joyRef.current.active = true;
    const touch = e.touches[0];
    const base = document.getElementById('joy-base');
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const rx = touch.clientX - centerX;
    const ry = touch.clientY - centerY;
    const d = Math.hypot(rx, ry);
    const max = 40;
    const s = Math.min(1, d / max);
    const ang = Math.atan2(ry, rx);
    
    joyRef.current.x = Math.cos(ang) * s;
    joyRef.current.y = Math.sin(ang) * s;
    setJoy({ x: joyRef.current.x, y: joyRef.current.y });
  };

  const handleJoyEnd = () => {
    joyRef.current.active = false;
    joyRef.current.x = 0;
    joyRef.current.y = 0;
    setJoy(null);
  };

  const handleUse = (itemKey?: string) => {
    const s = stateRef.current;
    if (!s) return;
    
    const k = itemKey || s.pl.hotbar[hotSlot];
    const it = IT[k];
    if (!it || (s.pl.inv[k] || 0) <= 0) return;

    if (it.t === 'food' || it.t === 'pot') {
      if (it.hp) s.pl.hp = Math.min(s.pl.mhp, s.pl.hp + it.hp);
      if (it.hu) s.pl.hu = Math.min(100, (s.pl.hu || 0) + it.hu);
      if (it.mp) s.pl.mp = Math.min(s.pl.mmp, s.pl.mp + it.mp);
      s.pl.inv[k]--;
      addLog(`Used ${it.n}`, '#00ffaa');
    } else if (it.t === 'armor') {
      const old = s.pl.equip[it.sl];
      if (old) s.pl.inv[old] = (s.pl.inv[old] || 0) + 1;
      s.pl.equip[it.sl] = k;
      s.pl.inv[k]--;
      // Update def
      let d = 0;
      for (const val of Object.values(s.pl.equip)) {
        if (val) d += IT[val as string]?.def || 0;
      }
      s.pl.def = d;
      addLog(`Equipped ${it.n}`, '#55aaff');
    } else if (it.t === 'tool' || it.id) {
       s.pl.weapon = k;
       addLog(`Selected ${it.n}`, '#ffffaa');
    } else if (it.t === 'struct') {
      const px = Math.floor(s.pl.x / TZ), py = Math.floor(s.pl.y / TZ);
      // Place structure
      s.objs.push({ type: k, tx: px, ty: py, hp: 5, mhp: 5 });
      s.pl.inv[k]--;
      addLog(`Placed ${it.n}`, '#ffaa00');
    }
  };

  const addSkillXPDirect = (s: any, skill: string, amount: number) => {
    if (!s || !s.pl) return;
    if (!s.pl.skills) {
      s.pl.skills = {
        fishing: { lvl: 1, xp: 0, xpNext: 100 },
        cooking: { lvl: 1, xp: 0, xpNext: 100 },
        mining: { lvl: 1, xp: 0, xpNext: 100 },
        woodcutting: { lvl: 1, xp: 0, xpNext: 100 },
        combat: { lvl: 1, xp: 0, xpNext: 100 },
        alchemy: { lvl: 1, xp: 0, xpNext: 100 }
      };
    }
    const sk = s.pl.skills[skill];
    if (!sk) return;
    
    sk.xp += amount;
    addLog(`+${amount} ${skill.toUpperCase()} XP`, '#38bdf8');
    
    while (sk.xp >= sk.xpNext) {
      sk.xp -= sk.xpNext;
      sk.lvl++;
      sk.xpNext = Math.floor(sk.xpNext * 1.5);
      addLog(`✨ LEVEL UP! ${skill.toUpperCase()} is Level ${sk.lvl}!`, '#eab308');
    }
  };

  const gainSkillXP = (skill: string, amount: number) => {
    const s = stateRef.current;
    if (!s) return;
    addSkillXPDirect(s, skill, amount);
    setGameState({ ...s });
  };

  const handleGather = () => {
    const s = stateRef.current;
    if (!s) return;
    const px = Math.floor(s.pl.x / TZ), py = Math.floor(s.pl.y / TZ);
    
    for (let i = s.objs.length - 1; i >= 0; i--) {
      const o = s.objs[i];
      if (Math.abs(o.tx - px) + Math.abs(o.ty - py) <= 2) {
        if (o.type === 'tree') {
          if (s.pl.sta < 5) {
            addLog("Too tired to chop wood!", "#f87171");
            return;
          }
          s.pl.sta = Math.max(0, s.pl.sta - 5);
          o.hp--;
          gainSkillXP('woodcutting', 3);
          if (o.hp <= 0) {
            s.objs.splice(i, 1);
            const wcLvl = s.pl.skills?.woodcutting?.lvl || 1;
            const baseLogs = 2 + Math.floor(Math.random() * 2);
            const bonusLogs = Math.floor(Math.random() * (wcLvl * 0.5));
            const q = baseLogs + bonusLogs;
            s.pl.inv.wood = (s.pl.inv.wood || 0) + q;
            addLog(`+Wood x${q} ${bonusLogs > 0 ? `(Skill Bonus +${bonusLogs})` : ''}`, '#22c55e');

            if (Math.random() < 0.2 + (wcLvl * 0.05)) {
              const stickQty = 1 + Math.floor(Math.random() * wcLvl);
              s.pl.inv.stick = (s.pl.inv.stick || 0) + stickQty;
              addLog(`+Stick x${stickQty} (Chopping bonus!)`, '#4ade80');
            }
            if (Math.random() < 0.1 + (wcLvl * 0.02)) {
              s.pl.inv.herb = (s.pl.inv.herb || 0) + 1;
              addLog(`+Herb x1 (Hidden in branches!)`, '#4ade80');
            }
            gainSkillXP('woodcutting', 15);
          } else addLog(`Chopping... ${o.hp} left`, '#ffe88a');
          return;
        }
        if (o.type === 'rock') {
          if (s.pl.sta < 5) {
            addLog("Too tired to mine rock!", "#f87171");
            return;
          }
          s.pl.sta = Math.max(0, s.pl.sta - 5);
          o.hp--;
          gainSkillXP('mining', 3);
          if (o.hp <= 0) {
            s.objs.splice(i, 1);
            const mineLvl = s.pl.skills?.mining?.lvl || 1;
            const baseStones = 3;
            const bonusStones = Math.floor(Math.random() * (mineLvl * 0.6));
            s.pl.inv.stone = (s.pl.inv.stone || 0) + baseStones + bonusStones;
            addLog(`+Stone x${baseStones + bonusStones} ${bonusStones > 0 ? `(Skill Bonus +${bonusStones})` : ''}`, '#22c55e');

            if (Math.random() < 0.15 + (mineLvl * 0.05)) {
              const ironQty = 1 + Math.floor(Math.random() * (mineLvl / 2));
              s.pl.inv.iron_ore = (s.pl.inv.iron_ore || 0) + ironQty;
              addLog(`+Iron Ore x${ironQty}!`, '#818cf8');
            }
            if (Math.random() < 0.1 + (mineLvl * 0.04)) {
              s.pl.inv.coal = (s.pl.inv.coal || 0) + 1;
              addLog(`+Coal x1!`, '#4b5563');
            }
            if (Math.random() < 0.02 + (mineLvl * 0.01)) {
              s.pl.inv.gem = (s.pl.inv.gem || 0) + 1;
              addLog(`💎 Found a rare Gem!`, '#ec4899');
            }
            gainSkillXP('mining', 15);
          } else addLog(`Mining... ${o.hp} left`, '#ffe88a');
          return;
        }
        if (o.type === 'drop') {
          s.pl.inv[o.item] = (s.pl.inv[o.item] || 0) + o.qty;
          addLog(`+${IT[o.item]?.n || o.item} x${o.qty}`, '#ccffaa');
          s.objs.splice(i, 1);
          return;
        }
      }
    }
  };

  const handleConsultOracle = async () => {
    const s = stateRef.current;
    if (!s) return;
    
    setIsOracleLoading(true);
    setShowOracle(true);
    
    const mapName = MAPS[Math.floor(s.pl.y / (ZH * TZ)) * ZCOLS + Math.floor(s.pl.x / (ZW * TZ))]?.n || "Unknown";
    
    const data = await getOracleGuidance({
      lvl: s.pl.lvl,
      waveNum: s.waveNum,
      day: s.day,
      mapName,
      hp: s.pl.hp,
      mhp: s.pl.mhp,
      inv: s.pl.inv
    });
    
    if (data) {
      setOracleData(data);
      // Trigger event
      if (data.eventType === 'meteor') {
        addLog("A meteor shower of iron falls!", "#ffaa00");
        for (let i = 0; i < 10; i++) {
          const rx = Math.floor(s.pl.x / TZ) + (Math.random() * 10 - 5);
          const ry = Math.floor(s.pl.y / TZ) + (Math.random() * 10 - 5);
          s.objs.push({ type: 'drop', tx: Math.floor(rx), ty: Math.floor(ry), item: 'iron_ore', qty: 2 });
        }
      } else if (data.eventType === 'blessing') {
        s.pl.hp = s.pl.mhp;
        s.pl.mp = s.pl.mmp;
        addLog("The Oracle blesses you with full health!", "#00ff88");
      }
    }
    setIsOracleLoading(false);
  };

  const craft = (ri: number, qty = 1) => {
    const r = recipes[ri];
    const s = stateRef.current;
    if (!r || !s) return;

    // Check structure requirement
    if (r.req) {
      const pTileX = Math.floor(s.pl.x / TZ);
      const pTileY = Math.floor(s.pl.y / TZ);
      const isNear = s.objs.some((o: any) => o.type === r.req && Math.abs(o.tx - pTileX) <= 3 && Math.abs(o.ty - pTileY) <= 3);
      if (!isNear) {
        addLog(`Must stand near a ${IT[r.req]?.n || r.req} 🔥 to craft this!`, '#ff4444');
        return;
      }
    }

    // Check costs
    for (const [k, v] of Object.entries(r.c)) {
      if ((s.pl.inv[k] || 0) < (v as number) * qty) {
        addLog(`Need more ${IT[k]?.n || k} to craft x${qty}`, '#ff4444');
        return;
      }
    }

    // Take costs
    for (const [k, v] of Object.entries(r.c)) {
      s.pl.inv[k] -= (v as number) * qty;
    }

    // Give output with potential cooking bonus
    let actualQty = r.cnt * qty;
    if (r.cat === 'Food' || r.cat === 'Potions') {
      const cookLvl = s.pl.skills?.cooking?.lvl || 1;
      const doubleChance = Math.min(0.6, cookLvl * 0.04);
      let bonusOutputCount = 0;
      for (let cidx = 0; cidx < qty; cidx++) {
        if (Math.random() < doubleChance) {
          bonusOutputCount += r.cnt;
        }
      }
      if (bonusOutputCount > 0) {
        actualQty += bonusOutputCount;
        addLog(`👩‍🍳 Cooking Double-Yield! (+${bonusOutputCount} bonus ${IT[r.out]?.n || r.out})`, '#34d399');
      }
      addSkillXPDirect(s, 'cooking', 15 * qty);
    } else if (r.out === 'mana_crystal' || r.out === 'void_essence' || r.out.includes('staff')) {
      addSkillXPDirect(s, 'alchemy', 25 * qty);
    }

    s.pl.inv[r.out] = (s.pl.inv[r.out] || 0) + actualQty;
    addLog(`Crafted ${r.n} x${actualQty}`, '#a8ff78');

    // Roll dynamic stats/modifications for craftable weapons/tools
    const itemTemplate = IT[r.out];
    if (itemTemplate && (itemTemplate.type === 'melee' || itemTemplate.type === 'ranged' || itemTemplate.type === 'magic' || itemTemplate.t === 'tool')) {
      if (!s.pl.weaponMods) s.pl.weaponMods = {};
      const mod = rollProceduralMod(r.out);
      if (mod) {
        s.pl.weaponMods[r.out] = mod;
        const name = `${mod.prefix} ${itemTemplate.n} ${mod.suffix}`.trim();
        addLog(`✨ Procedural Forge: Crafted unique "${name}"!`, '#ffd700');
      }
    }

    // Update state
    setRecipes(prev => prev.map((rc, idx) => {
      if (idx === ri) {
        return { ...rc, craftCount: (rc.craftCount || 0) + qty, discovered: true };
      }
      return rc;
    }));

    setGameState({ ...s });
  };

  const combineMaterials = () => {
    const s = stateRef.current;
    if (!s) return;

    if (labReactants.length === 0) {
      setLabStatus({ success: false, msg: "Add materials from your inventory to start!" });
      return;
    }

    // Form reactant cost object
    const reactantCost: Record<string, number> = {};
    for (const reactant of labReactants) {
      reactantCost[reactant.itemKey] = reactant.qty;
    }

    // Check if the player actually has these in inventory
    for (const [k, v] of Object.entries(reactantCost)) {
      if ((s.pl.inv[k] || 0) < v) {
        setLabStatus({ success: false, msg: `Not enough ${IT[k]?.n || k} in inventory!` });
        return;
      }
    }

    // Find matching recipe
    let foundRecipeIdx = -1;
    let foundRecipe = null;

    for (let i = 0; i < recipes.length; i++) {
      const r = recipes[i];
      const recipeCostKeys = Object.keys(r.c);
      const reactantKeys = Object.keys(reactantCost);

      const sameKeys = recipeCostKeys.length === reactantKeys.length && 
                       recipeCostKeys.every(k => reactantKeys.includes(k));

      if (sameKeys) {
        const enoughQty = Object.entries(r.c).every(([k, v]) => reactantCost[k] >= (v as number));
        if (enoughQty) {
          foundRecipeIdx = i;
          foundRecipe = r;
          break;
        }
      }
    }

    if (foundRecipeIdx !== -1 && foundRecipe) {
      const r = foundRecipe;
      // Subtract exact costs rather than total combined reactants to be friendly
      for (const [k, v] of Object.entries(r.c)) {
        s.pl.inv[k] -= (v as number);
      }

      let structureBonus = "";
      if (r.req) {
        const pTileX = Math.floor(s.pl.x / TZ);
        const pTileY = Math.floor(s.pl.y / TZ);
        const isNear = s.objs.some((o: any) => o.type === r.req && Math.abs(o.tx - pTileX) <= 3 && Math.abs(o.ty - pTileY) <= 3);
        if (!isNear) {
          structureBonus = ` (Sparks flew, but your alchemical skill bypassed the ${IT[r.req]?.n || r.req} requirement!)`;
        }
      }

      s.pl.inv[r.out] = (s.pl.inv[r.out] || 0) + r.cnt;
      addLog(`✨ Lab success: Crafted ${r.n} x${r.cnt}!`, '#38bdf8');

      const isNew = !r.discovered;
      // Award Alchemy XP based on discovery status
      const alchemyXPGain = isNew ? 60 : 25;
      addSkillXPDirect(s, 'alchemy', alchemyXPGain);

      const alertMsg = isNew 
        ? `🎉 DISCOVERY UNLOCKED! New formula discovered: ${r.n}!${structureBonus} (+${alchemyXPGain} Alchemy XP)`
        : `🧪 Reaction successful! Formed ${r.n} x${r.cnt}.${structureBonus} (+${alchemyXPGain} Alchemy XP)`;

      setRecipes(prev => prev.map((rc, idx) => {
        if (idx === foundRecipeIdx) {
          return { ...rc, discovered: true, craftCount: (rc.craftCount || 0) + 1 };
        }
        return rc;
      }));

      setLabStatus({ success: true, msg: alertMsg });
      setLabReactants([]);
    } else {
      // Deduct exactly 1 of each reactant as ash, and return the rest to inventory
      for (const reactant of labReactants) {
        s.pl.inv[reactant.itemKey] = Math.max(0, s.pl.inv[reactant.itemKey] - 1);
      }
      
      // Learn from mistakes! Give 5 Alchemy XP
      addSkillXPDirect(s, 'alchemy', 8);
      
      addLog("The mixture fizzled. Reaction failed.", "#f87171");
      setLabStatus({ 
        success: false, 
        msg: "Reaction failed! These materials do not form any useful blueprint. Spent 1 of each to control volatile feedback. (+8 Alchemy XP for trying)" 
      });
      setLabReactants([]);
    }

    setGameState({ ...s });
  };

  const adjustReactantQty = (itemKey: string, amt: number) => {
    const s = stateRef.current;
    if (!s) return;
    const maxInv = s.pl.inv[itemKey] || 0;
    setLabReactants(prev => {
      return prev.map(p => {
        if (p.itemKey === itemKey) {
          const nq = Math.max(1, Math.min(maxInv, p.qty + amt));
          return { ...p, qty: nq };
        }
        return p;
      }).filter(p => p.qty > 0);
    });
  };

  const removeReactant = (itemKey: string) => {
    setLabReactants(prev => prev.filter(p => p.itemKey !== itemKey));
  };

  const checkStationProximity = (r: any) => {
    if (!r.req) return true;
    if (!gameState) return false;
    const pTileX = Math.floor(gameState.pl.x / TZ);
    const pTileY = Math.floor(gameState.pl.y / TZ);
    return gameState.objs.some((o: any) => o.type === r.req && Math.abs(o.tx - pTileX) <= 3 && Math.abs(o.ty - pTileY) <= 3);
  };

  const getAffordableMultiplier = (r: any) => {
    if (!gameState?.pl?.inv) return 0;
    let minMultiple = Infinity;
    for (const [ingredient, cost] of Object.entries(r.c)) {
      const held = gameState.pl.inv[ingredient] || 0;
      const craftableMultiple = Math.floor(held / (cost as number));
      if (craftableMultiple < minMultiple) {
        minMultiple = craftableMultiple;
      }
    }
    return minMultiple === Infinity ? 0 : minMultiple;
  };

  const handleStartFishing = () => {
    const s = stateRef.current;
    if (!s) return;
    
    // Check if player has rod (either in inventory or equipped/weapon selected)
    const hasRod = s.pl.inv.fishing_rod > 0 || s.pl.weapon === 'fishing_rod';
    if (!hasRod) {
      addLog("❌ You need a Fishing Rod to fish! Craft one in your Blueprints menu.", "#f87171");
      return;
    }
    
    // Check near water
    const px = Math.floor(s.pl.x / TZ);
    const py = Math.floor(s.pl.y / TZ);
    let nearWater = false;
    
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const tx = px + dx;
        const ty = py + dy;
        if (ty >= 0 && ty < s.world.length && tx >= 0 && tx < s.world[ty].length) {
          if (s.world[ty][tx] === TW) {
            nearWater = true;
            break;
          }
        }
      }
      if (nearWater) break;
    }
    
    if (!nearWater) {
      addLog("🌊 Stand near water to cast your line!", "#38bdf8");
      return;
    }
    
    if (isFishing) return;
    
    setIsFishing(true);
    setFishingState('waiting');
    setFishingMessage("Casting line... Waiting for a bite... 🐟");
    addLog("🎣 You cast your fishing line into the water...", "#38bdf8");
    
    const delay = 2000 + Math.random() * 2500;
    const timerId = window.setTimeout(() => {
      setFishingState('bite');
      setFishingMessage("❗ A BITE! QUICK, CLICK REEL IN! 🎣");
      addLog("❗ A fish is biting! Reel it in!", "#f59e0b");
      
      const level = s.pl.skills?.fishing?.lvl || 1;
      const finalWindow = Math.min(3200, 1600 + level * 100);
      
      const failTimerId = window.setTimeout(() => {
        setFishingState('fail');
        setFishingMessage("The fish swam away... 🌊 Try again!");
        addLog("🌊 The fish got away...", "#94a3b8");
        
        gainSkillXP('fishing', 4);
        
        setTimeout(() => {
          setIsFishing(false);
          setFishingState('idle');
        }, 1800);
      }, finalWindow);
      
      (window as any).fishingFailTimer = failTimerId;
    }, delay);
    
    (window as any).fishingBiteTimer = timerId;
  };

  const handleReelIn = () => {
    if (fishingState !== 'bite') return;
    
    if ((window as any).fishingFailTimer) {
      clearTimeout((window as any).fishingFailTimer);
    }
    
    const s = stateRef.current;
    if (!s) return;
    
    const flvl = s.pl.skills?.fishing?.lvl || 1;
    const rand = Math.random() + (flvl * 0.03);
    let fishType = 'raw_fish';
    let fishName = 'Raw Fish';
    let xpAward = 25;
    
    if (rand > 1.15) {
      fishType = 'celestial_fish';
      fishName = '🌌 Celestial Fish';
      xpAward = 120;
    } else if (rand > 0.82) {
      fishType = 'cooked_fish';
      fishName = '🐠 Crispy Cooked Fish';
      xpAward = 65;
    }
    
    s.pl.inv[fishType] = (s.pl.inv[fishType] || 0) + 1;
    setFishingState('success');
    setFishingMessage(`🎉 Successful Catch! Obtained ${fishName}! (+${xpAward} Fishing XP)`);
    addLog(`🎣 Caught ${fishName}!`, '#a8ff78');
    
    gainSkillXP('fishing', xpAward);
    setGameState({ ...s });
    
    setTimeout(() => {
      setIsFishing(false);
      setFishingState('idle');
    }, 2200);
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-mono text-white select-none">
      <canvas 
        ref={canvasRef} 
        width={window.innerWidth} 
        height={window.innerHeight}
        className="block"
      />

      {/* --- Fishing active mini-game overlay --- */}
      <AnimatePresence>
        {isFishing && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 z-40 w-96 max-w-[90%] bg-zinc-950/90 border-2 border-teal-500/40 p-6 rounded-2xl shadow-2xl shadow-teal-500/10 text-center font-mono"
          >
            <div className="flex justify-center mb-3">
              <span className={`text-5xl transition-all duration-300 ${fishingState === 'bite' ? 'animate-bounce scale-125' : 'animate-pulse'}`}>
                {fishingState === 'waiting' && '🌊'}
                {fishingState === 'bite' && '❗'}
                {fishingState === 'success' && '👑'}
                {fishingState === 'fail' && '💨'}
              </span>
            </div>
            <h3 className="text-teal-400 font-bold uppercase tracking-wider text-sm mb-1.5">Fishing In Progress</h3>
            <p className="text-xs text-white/80 leading-relaxed mb-6 h-8 flex items-center justify-center font-semibold text-center">
              {fishingMessage}
            </p>
            
            {fishingState === 'bite' ? (
              <motion.button 
                onClick={handleReelIn}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-full py-4 bg-gradient-to-r from-yellow-500 via-amber-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-extrabold text-sm tracking-widest uppercase rounded-xl shadow-lg shadow-amber-500/20 animate-pulse cursor-pointer border border-yellow-300"
              >
                🎣 REEL IN NOW! 🎣
              </motion.button>
            ) : (
              <button 
                onClick={() => {
                  setIsFishing(false);
                  setFishingState('idle');
                  // Clear intervals/timeouts
                  if ((window as any).fishingBiteTimer) clearTimeout((window as any).fishingBiteTimer);
                  if ((window as any).fishingFailTimer) clearTimeout((window as any).fishingFailTimer);
                  addLog("🌊 Canceled fishing.", "#94a3b8");
                }}
                className="px-4 py-2 bg-white/5 border border-white/10 hover:border-red-500/30 hover:bg-red-500/5 text-xs text-white/60 hover:text-red-400 rounded-lg cursor-pointer transition-all uppercase tracking-wider"
              >
                Cancel Cast
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- HUD --- */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start pointer-events-none z-10">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 text-xs opacity-50 text-right">HP</div>
            <div className="w-48 h-3 bg-white/10 rounded-full overflow-hidden border border-white/5">
              <motion.div 
                className="h-full bg-gradient-to-r from-red-500 to-rose-400"
                initial={{ width: '100%' }}
                animate={{ width: `${(gameState?.pl.hp / gameState?.pl.mhp) * 100}%` }}
              />
            </div>
            <div className="text-[10px] opacity-70">{Math.floor(gameState?.pl.hp || 0)}</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 text-xs opacity-50 text-right">HUN</div>
            <div className="w-48 h-3 bg-white/10 rounded-full overflow-hidden border border-white/5">
              <motion.div 
                className="h-full bg-gradient-to-r from-orange-500 to-amber-400"
                initial={{ width: '100%' }}
                animate={{ width: `${gameState?.pl.hu || 0}%` }}
              />
            </div>
            <div className="text-[10px] opacity-70">{Math.floor(gameState?.pl.hu || 0)}</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 text-xs opacity-50 text-right">STA</div>
            <div className="w-48 h-3 bg-white/10 rounded-full overflow-hidden border border-white/5">
              <motion.div 
                className="h-full bg-gradient-to-r from-blue-500 to-cyan-400"
                initial={{ width: '100%' }}
                animate={{ width: `${gameState?.pl.sta || 0}%` }}
              />
            </div>
            <div className="text-[10px] opacity-70">{Math.floor(gameState?.pl.sta || 0)}</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 text-xs opacity-50 text-right">MP</div>
            <div className="w-48 h-3 bg-white/10 rounded-full overflow-hidden border border-white/5">
              <motion.div 
                className="h-full bg-gradient-to-r from-purple-500 to-fuchsia-400"
                initial={{ width: '100%' }}
                animate={{ width: `${(gameState?.pl.mp / gameState?.pl.mmp) * 100}%` }}
              />
            </div>
            <div className="text-[10px] opacity-70">{Math.floor(gameState?.pl.mp || 0)}</div>
          </div>
        </div>

        <div className="text-right flex flex-col items-end gap-1">
          <div className="font-bold text-yellow-400 text-lg tracking-widest">DAY {gameState?.day}</div>
          <div className="text-xs text-blue-300 opacity-80">
            {MAPS[Math.floor((gameState?.pl.y || 0) / (ZH * TZ)) * ZCOLS + Math.floor((gameState?.pl.x || 0) / (ZW * TZ))]?.n || "Unknown"}
          </div>
          <div className="text-[10px] text-orange-400">WAVE {gameState?.waveNum}/300</div>
          <div className="w-32 h-1 bg-white/10 rounded-full mt-1 overflow-hidden">
            <div className="h-full bg-yellow-400" style={{ width: `${(gameState?.pl.xp / gameState?.pl.xpNext) * 100}%` }} />
          </div>

          {/* Master Action & Management Menu Bar */}
          <div className="mt-3 flex gap-1.5 sm:gap-2 pointer-events-auto">
            <button 
              onClick={() => setShowInv(true)}
              className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-zinc-900 border border-white/10 hover:border-yellow-500/50 rounded-xl text-[9px] sm:text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 sm:gap-1.5 transition-all text-white hover:text-yellow-400 hover:scale-105 active:scale-95 cursor-pointer shadow-lg"
            >
              <Backpack size={11} className="text-yellow-500" />
              <span>INV</span>
            </button>
            <button 
              onClick={() => setShowCraft(true)}
              className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-zinc-900 border border-white/10 hover:border-yellow-500/50 rounded-xl text-[9px] sm:text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 sm:gap-1.5 transition-all text-white hover:text-yellow-400 hover:scale-105 active:scale-95 cursor-pointer shadow-lg"
            >
              <Hammer size={11} className="text-yellow-500" />
              <span>CRAFT</span>
            </button>
            <button 
              onClick={() => setShowSkills(true)}
              className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-zinc-900 border border-teal-500/20 hover:border-teal-400/50 rounded-xl text-[9px] sm:text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 sm:gap-1.5 transition-all text-white hover:text-teal-300 hover:scale-105 active:scale-95 cursor-pointer shadow-lg"
            >
              <Sparkles size={11} className="text-teal-400" />
              <span>SKILLS</span>
            </button>
            <button 
              onClick={handleConsultOracle}
              className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-zinc-900 border border-purple-500/20 hover:border-purple-500/50 rounded-xl text-[9px] sm:text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 sm:gap-1.5 transition-all text-white hover:text-purple-400 hover:scale-105 active:scale-95 cursor-pointer shadow-lg"
            >
              <BrainCircuit size={11} className="text-purple-400" />
              <span>ORACLE</span>
            </button>
            <button 
              id="system-save-btn"
              onClick={() => {
                loadSlotMetadata();
                setShowSaveMenu(true);
              }}
              className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-zinc-900 border border-white/10 hover:border-yellow-500/50 rounded-xl text-[9px] sm:text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 sm:gap-1.5 transition-all text-yellow-500 hover:text-yellow-400 hover:scale-105 active:scale-95 cursor-pointer shadow-lg"
            >
              <Save size={11} className="animate-pulse text-yellow-500" />
              <span>SAVE</span>
            </button>
          </div>
        </div>
      </div>

      {/* --- Logs --- */}
      <div className="absolute top-24 left-4 flex flex-col gap-1 pointer-events-none z-10">
        <AnimatePresence>
          {logs.map((log, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="px-3 py-1 rounded bg-black/80 border-l-4 text-xs"
              style={{ borderColor: log.col }}
            >
              {log.msg}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* --- Automation Cores Control Center --- */}
      <div className="absolute top-[190px] left-4 pointer-events-auto z-10 flex flex-col gap-1.5 bg-black/80 border border-white/10 p-3 rounded-2xl backdrop-blur-md shadow-2xl max-w-xs text-white">
        <div className="flex items-center gap-1.5 mb-1 border-b border-white/10 pb-1.5">
          <Cpu size={14} className="text-cyan-400 animate-pulse" />
          <span className="text-[10px] font-bold tracking-widest uppercase text-cyan-400 font-sans">Automation Cores</span>
        </div>
        <div className="flex flex-col gap-1">
          <button
            onClick={() => setAutoAttack(prev => !prev)}
            className={`px-3 py-1.5 rounded-lg text-[9px] font-bold tracking-wider uppercase font-mono flex items-center justify-between transition-all border cursor-pointer ${
              autoAttack 
                ? 'bg-red-500/20 border-red-500/50 text-red-300 shadow-[0_0_10px_rgba(239,68,68,0.2)]' 
                : 'bg-zinc-900/60 border-white/5 text-zinc-400 hover:border-white/15'
            }`}
          >
            <span>⚔️ Combat Core</span>
            <span className={autoAttack ? 'text-red-400 animate-pulse' : 'text-zinc-500'}>
              {autoAttack ? 'ON' : 'OFF'}
            </span>
          </button>
          <button
            onClick={() => setAutoHarvest(prev => !prev)}
            className={`px-3 py-1.5 rounded-lg text-[9px] font-bold tracking-wider uppercase font-mono flex items-center justify-between transition-all border cursor-pointer ${
              autoHarvest 
                ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300 shadow-[0_0_10px_rgba(234,179,8,0.2)]' 
                : 'bg-zinc-900/60 border-white/5 text-zinc-400 hover:border-white/15'
            }`}
          >
            <span>🪵 Gathering Core</span>
            <span className={autoHarvest ? 'text-yellow-400 animate-pulse' : 'text-zinc-500'}>
              {autoHarvest ? 'ON' : 'OFF'}
            </span>
          </button>
          <button
            onClick={() => setAutoCollect(prev => !prev)}
            className={`px-3 py-1.5 rounded-lg text-[9px] font-bold tracking-wider uppercase font-mono flex items-center justify-between transition-all border cursor-pointer ${
              autoCollect 
                ? 'bg-green-500/20 border-green-500/50 text-green-300 shadow-[0_0_10px_rgba(34,197,94,0.2)]' 
                : 'bg-zinc-900/60 border-white/5 text-zinc-400 hover:border-white/15'
            }`}
          >
            <span>🧲 Vacuum Core</span>
            <span className={autoCollect ? 'text-green-400 animate-pulse' : 'text-zinc-500'}>
              {autoCollect ? 'ON' : 'OFF'}
            </span>
          </button>
        </div>
      </div>

      {/* --- Active World Event Banner --- */}
      {gameState?.activeEvent && (
        <div className="absolute top-[190px] left-1/2 -translate-x-1/2 z-10 pointer-events-none select-none">
          <div className="bg-gradient-to-r from-purple-950/90 via-black/85 to-purple-950/90 border border-purple-500/30 px-4 py-2 rounded-xl flex items-center gap-2.5 shadow-[0_0_25px_rgba(168,85,247,0.15)] animate-bounce">
            <span className="text-lg">🌌</span>
            <div className="flex flex-col">
              <span className="text-[9px] text-purple-400 font-bold uppercase tracking-widest">Active World Event</span>
              <span className="text-xs font-black text-white uppercase tracking-wider">{gameState.activeEvent.title}</span>
            </div>
            <div className="w-px h-6 bg-purple-500/20 mx-1" />
            <div className="text-[10px] text-purple-300 font-mono font-bold">
              {Math.ceil(gameState.activeEvent.ticksLeft / 60)}s left
            </div>
          </div>
        </div>
      )}

      {/* --- World Event Narrative Challenge Modal --- */}
      <AnimatePresence>
        {showEventModal && narrativeEvent && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 30 }}
              className="bg-gradient-to-b from-zinc-900 to-black border border-purple-500/30 p-6 rounded-3xl max-w-xl w-full text-white shadow-[0_0_50px_rgba(168,85,247,0.15)] flex flex-col gap-5 relative overflow-hidden"
            >
              {/* Event Cosmic Backglow Decoration */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-40 bg-purple-500/10 blur-[100px] rounded-full pointer-events-none" />

              <div className="flex items-center gap-3 border-b border-white/10 pb-3">
                <span className="text-3xl">🌌</span>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-purple-400 font-sans">Cosmic World Change Detected</span>
                  <h2 className="text-xl font-black uppercase tracking-wider text-white">{narrativeEvent.title}</h2>
                </div>
              </div>

              <div className="text-sm leading-relaxed text-zinc-300 italic font-serif">
                "{narrativeEvent.narrative}"
              </div>

              {narrativeEvent.effect && (
                <div className="bg-purple-950/25 border border-purple-500/20 rounded-xl p-3 text-xs text-purple-200 font-mono">
                  <div className="font-bold uppercase tracking-wider text-purple-300 mb-1">Atmospheric Condition:</div>
                  <div>{narrativeEvent.effect.description}</div>
                </div>
              )}

              <div className="flex flex-col gap-2.5">
                {!eventChoiceOutcome ? (
                  <>
                    <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">How do you choose to react?</div>
                    {narrativeEvent.choices?.map((choice: any, idx: number) => {
                      const disabled = !choice.isMet;
                      return (
                        <button
                          key={idx}
                          disabled={disabled}
                          onClick={() => handleSelectEventChoice(choice)}
                          className={`w-full text-left p-3.5 rounded-xl border transition-all text-xs flex flex-col gap-1 cursor-pointer ${
                            disabled 
                              ? 'bg-zinc-900/40 border-zinc-800 text-zinc-600 cursor-not-allowed opacity-50' 
                              : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-purple-400 active:scale-[0.98]'
                          }`}
                        >
                          <div className="flex items-center justify-between font-bold text-white">
                            <span>{choice.text}</span>
                            {choice.requirement && choice.requirement !== "None" && choice.requirement !== "none" && (
                              <span className={`text-[9px] px-2 py-0.5 rounded font-mono ${disabled ? 'bg-red-900/30 text-red-400' : 'bg-emerald-900/30 text-emerald-400'}`}>
                                {choice.requirement}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-zinc-400 leading-normal">{choice.description}</p>
                        </button>
                      );
                    })}
                  </>
                ) : (
                  <div className="flex flex-col gap-4 animate-fade-in">
                    <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Outcome:</div>
                    <div className="bg-black/40 border border-white/5 p-4 rounded-xl text-xs leading-relaxed text-zinc-300 whitespace-pre-wrap">
                      {eventChoiceOutcome}
                    </div>
                    <button
                      onClick={handleAcknowledgeEvent}
                      className="w-full py-3 bg-purple-600 hover:bg-purple-500 active:scale-95 text-xs font-bold tracking-widest uppercase rounded-xl transition-all shadow-[0_4px_12px_rgba(168,85,247,0.3)] cursor-pointer"
                    >
                      Acknowledge Event & Continue
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- Joystick --- */}
      <div className="absolute bottom-24 left-8 z-30 touch-none md:hidden select-none">
        <div 
          id="joy-base"
          className="w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur-sm shadow-lg"
          onTouchStart={handleJoyTouch}
          onTouchMove={handleJoyTouch}
          onTouchEnd={handleJoyEnd}
        >
          <motion.div 
            className="w-10 h-10 rounded-full bg-white/40 border border-white/50 shadow-[0_0_20px_rgba(255,255,255,0.2)] animate-pulse"
            animate={{ 
              x: joy ? joy.x * 30 : 0, 
              y: joy ? joy.y * 30 : 0 
            }}
            transition={{ type: 'spring', damping: 20, stiffness: 250 }}
          />
        </div>
      </div>

      {/* --- Controls --- */}
      {/* Bottom Center: Hotbar (Always centered at the bottom, pointer enabled) */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-auto select-none flex flex-col items-center gap-1.5">
        {gameState?.pl.hotbar[hotSlot] && (() => {
          const key = gameState.pl.hotbar[hotSlot];
          const stats = getWeaponStats(gameState, key);
          return (
            <div className="bg-black/80 border border-white/10 px-3 py-1.5 rounded-full text-xs backdrop-blur-md text-gray-300 font-mono tracking-tight flex items-center justify-center gap-2 shadow-lg max-w-sm whitespace-nowrap">
              <span className="text-base">{stats.ico || IT[key]?.ico}</span>
              <span className="font-bold text-white">{stats.n}</span>
              <span className="opacity-40">|</span>
              <span className="text-yellow-400 font-bold">Dmg: {stats.dmg}</span>
              <span className="text-cyan-400 font-bold">Spd: {stats.spd}t</span>
              {stats.vamp > 0 && (
                <>
                  <span className="opacity-40">|</span>
                  <span className="text-red-400 font-bold flex items-center gap-0.5">🩸 {Math.round(stats.vamp * 100)}% Lifesteal</span>
                </>
              )}
            </div>
          );
        })()}

        <div className="flex gap-1 bg-black/85 p-2 rounded-xl border border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.6)]">
          {gameState?.pl.hotbar.map((item: string, i: number) => (
            <button
              key={i}
              onClick={() => setHotSlot(i)}
              className={`w-12 h-12 rounded-lg flex items-center justify-center relative transition-all ${hotSlot === i ? 'bg-green-500/20 border-green-500' : 'bg-white/5 border-white/10'} hover:bg-white/10 active:scale-95 cursor-pointer border`}
            >
              <span className="text-xl">{IT[item]?.ico || '?'}</span>
              <span className="absolute bottom-1 right-1 text-[8px] text-green-400 font-bold">{gameState.pl.inv[item] || 0}</span>
              <span className="absolute top-0.5 left-1 text-[6px] opacity-30">{i + 1}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Bottom Left Actions: Desktop-Only */}
      <div className="absolute bottom-4 left-4 z-20 pointer-events-auto select-none hidden md:flex gap-2">
        <button 
          onClick={() => handleUse()}
          className="w-14 h-14 rounded-full bg-zinc-900/95 border border-white/15 flex flex-col items-center justify-center hover:bg-zinc-800 active:scale-95 transition-all shadow-lg text-white cursor-pointer"
        >
          <Zap size={20} className="text-blue-400" />
          <span className="text-[8px] mt-1 opacity-55 font-bold tracking-wider">USE</span>
        </button>
        <button 
          onClick={handleGather}
          className="w-14 h-14 rounded-full bg-zinc-900/95 border border-white/15 flex flex-col items-center justify-center hover:bg-zinc-800 active:scale-95 transition-all shadow-lg text-white cursor-pointer"
        >
          <Hammer size={20} className="text-yellow-500" />
          <span className="text-[8px] mt-1 opacity-55 font-bold tracking-wider">GATHER</span>
        </button>
        <button 
          onClick={handleAttack}
          className="w-14 h-14 rounded-full bg-red-950/20 border border-red-500/20 flex flex-col items-center justify-center hover:bg-zinc-800 active:scale-95 transition-all shadow-lg text-white cursor-pointer"
        >
          <Sword size={20} className="text-red-400" />
          <span className="text-[8px] mt-1 opacity-55 font-bold tracking-wider">ATTACK</span>
        </button>
        <button 
          onClick={handleTame}
          className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/30 flex flex-col items-center justify-center hover:bg-green-500/20 active:scale-95 transition-all shadow-lg text-white cursor-pointer"
        >
          <Sparkles size={20} className="text-green-400" />
          <span className="text-[8px] mt-1 text-green-400/85 font-bold tracking-wider">TAME</span>
        </button>
        {gameState?.companions.length > 0 && (
          <button 
            id="comp-mode-btn"
            data-mode={compMode}
            onClick={() => setCompMode(prev => prev === 'guard' ? 'attack' : 'guard')}
            className={`w-14 h-14 rounded-full flex flex-col items-center justify-center transition-all border shadow-lg text-white cursor-pointer ${compMode === 'guard' ? 'bg-blue-500/20 border-blue-500/40' : 'bg-red-500/20 border-red-500/40'}`}
          >
            {compMode === 'guard' ? <Shield size={18} className="text-blue-400" /> : <Sword size={18} className="text-red-400" />}
            <span className="text-[8px] mt-1 uppercase opacity-70 font-bold tracking-wider">{compMode}</span>
          </button>
        )}
      </div>

      {/* Bottom Right Actions: Mobile-Only cluster */}
      <div className="absolute bottom-20 right-4 z-20 pointer-events-auto select-none flex flex-col items-end gap-2 md:hidden">
        <div className="flex gap-1.5 justify-end max-w-[200px] flex-wrap">
          <button 
            onClick={() => handleUse()}
            className="w-11 h-11 rounded-full bg-zinc-900/90 border border-white/15 flex flex-col items-center justify-center hover:bg-zinc-800 active:scale-95 transition-all shadow-md text-white cursor-pointer"
          >
            <Zap size={16} className="text-blue-400" />
            <span className="text-[7px] mt-0.5 opacity-60 font-bold">USE</span>
          </button>
          <button 
            onClick={handleGather}
            className="w-11 h-11 rounded-full bg-zinc-900/90 border border-white/15 flex flex-col items-center justify-center hover:bg-zinc-800 active:scale-95 transition-all shadow-md text-white cursor-pointer"
          >
            <Hammer size={16} className="text-yellow-500" />
            <span className="text-[7px] mt-0.5 opacity-60 font-bold">GATHER</span>
          </button>
          <button 
            onClick={handleAttack}
            className="w-11 h-11 rounded-full bg-red-950/20 border border-red-500/30 flex flex-col items-center justify-center hover:bg-zinc-800 active:scale-95 transition-all shadow-md text-white cursor-pointer"
          >
            <Sword size={16} className="text-red-400" />
            <span className="text-[7px] mt-0.5 opacity-60 font-bold">ATTACK</span>
          </button>
          <button 
            onClick={handleTame}
            className="w-11 h-11 rounded-full bg-green-500/10 border border-green-500/30 flex flex-col items-center justify-center hover:bg-green-500/20 active:scale-95 transition-all shadow-md text-white cursor-pointer"
          >
            <Sparkles size={16} className="text-green-400" />
            <span className="text-[7px] mt-0.5 text-green-400 font-bold">TAME</span>
          </button>
          {gameState?.companions.length > 0 && (
            <button 
              id="comp-mode-btn-mob"
              data-mode={compMode}
              onClick={() => setCompMode(prev => prev === 'guard' ? 'attack' : 'guard')}
              className={`w-11 h-11 rounded-full flex flex-col items-center justify-center transition-all border shadow-md text-white cursor-pointer ${compMode === 'guard' ? 'bg-blue-500/25 border-blue-500/40' : 'bg-red-500/25 border-red-500/40'}`}
            >
              {compMode === 'guard' ? <Shield size={14} className="text-blue-400" /> : <Sword size={14} className="text-red-400" />}
              <span className="text-[7px] mt-0.5 uppercase opacity-85 font-bold">{compMode}</span>
            </button>
          )}
        </div>
      </div>

      {/* --- Modals --- */}
      <AnimatePresence>
        {showInv && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex flex-col"
          >
            <div className="p-6 flex justify-between items-center border-b border-white/10">
              <h2 className="text-xl font-bold tracking-widest text-green-400 flex items-center gap-2">
                <Backpack /> INVENTORY
              </h2>
              <button onClick={() => setShowInv(false)} className="p-2 hover:bg-white/10 rounded-full">
                <X />
              </button>
            </div>
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-4">
                {Object.entries(gameState?.pl.inv || {}).filter(([, v]) => (v as number) > 0).map(([k, v]) => (
                  <div 
                    key={k} 
                    onClick={() => { handleUse(k); setShowInv(false); }}
                    className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col items-center gap-2 hover:border-green-500 hover:bg-white/10 transition-all cursor-pointer group"
                  >
                    <span className="text-3xl group-hover:scale-110 transition-transform">{IT[k]?.ico || '?'}</span>
                    <span className="text-[10px] opacity-50 text-center">{IT[k]?.n || k}</span>
                    <span className="text-sm font-bold text-green-400">{v as number}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {showSkills && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 flex flex-col font-mono"
          >
            <div className="p-6 flex justify-between items-center border-b border-white/10 shrink-0">
              <h2 className="text-xl font-bold tracking-widest text-teal-400 flex items-center gap-2">
                <Sparkles className="text-teal-400" /> PLAYER SKILLS & PROGRESSION
              </h2>
              <button onClick={() => setShowSkills(false)} className="p-2 hover:bg-white/10 rounded-full cursor-pointer transition-all">
                <X />
              </button>
            </div>
            
            <div className="flex-1 p-6 overflow-y-auto max-w-5xl mx-auto w-full">
              {/* Fishing Quickcast Alert inside Skills Page */}
              <div className="mb-6 p-4 rounded-xl bg-teal-950/40 border border-teal-500/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="font-bold text-teal-300 text-sm flex items-center gap-1.5">
                    🎣 Quick Fishing casting
                  </h3>
                  <p className="text-xs opacity-60 mt-1 max-w-xl">
                    If you are equipped with a Fishing Rod and standing right at the edge of the blue Water tile, you can cast your hook into the blue deep!
                  </p>
                </div>
                <button 
                  onClick={() => { setShowSkills(false); handleStartFishing(); }}
                  className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-black font-bold rounded-xl text-xs uppercase tracking-wider active:scale-95 transition-all cursor-pointer shadow-lg"
                >
                  Cast Line 🎣
                </button>
              </div>

              {/* Skills Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  {
                    id: 'woodcutting',
                    n: 'Woodcutting',
                    ico: '🪵',
                    color: 'from-emerald-600 to-green-500',
                    border: 'border-emerald-500/30',
                    bg: 'bg-emerald-950/20',
                    desc: 'Your skill in logging trees with axes.',
                    perks: [
                      'Grants +5% log yield per level',
                      'Level 3: Enables stick bonus drop chance (+20%)',
                      'Level 10: Extra herbs can be compiled from leaves'
                    ]
                  },
                  {
                    id: 'mining',
                    n: 'Mining',
                    ico: '⛏️',
                    color: 'from-amber-600 to-yellow-500',
                    border: 'border-amber-500/30',
                    bg: 'bg-amber-950/20',
                    desc: 'Mining veins, stones, and precious ores.',
                    perks: [
                      'Grants +6% iron ore discovery yield per level',
                      'Level 5: Sieve precious Coal from normal rock shards',
                      'Level 12: Increases sparkly gem drop rates'
                    ]
                  },
                  {
                    id: 'fishing',
                    n: 'Fishing',
                    ico: '🎣',
                    color: 'from-sky-600 to-blue-500',
                    border: 'border-sky-500/30',
                    bg: 'bg-sky-950/20',
                    desc: 'Harvesting raw and cooked marine life from waters.',
                    perks: [
                      'Expands your active bite reaction window size',
                      'Level 4: Enables Gilded Fish (+65 XP, pre-cooked!)',
                      'Level 10: Can reveal celestial cosmic fishes (+120 XP)'
                    ]
                  },
                  {
                    id: 'cooking',
                    n: 'Cooking',
                    ico: '🍳',
                    color: 'from-orange-600 to-red-500',
                    border: 'border-orange-500/30',
                    bg: 'bg-orange-950/20',
                    desc: 'Preparing tasty food and high quality potions.',
                    perks: [
                      'Yields +4% chance to double craft cooked yields',
                      'Level 6: Extra meal satiety bonuses upon baking',
                      'Level 15: Brew critical potion batches'
                    ]
                  },
                  {
                    id: 'combat',
                    n: 'Combat',
                    ico: '⚔️',
                    color: 'from-red-600 to-rose-500',
                    border: 'border-red-500/30',
                    bg: 'bg-red-950/20',
                    desc: 'Melee weapon prowess and survival stats.',
                    perks: [
                      'Boosts core physical melee/ranged damage (+5% per level)',
                      'Level 5: Unleashes faster weapon swing cool-downs',
                      'Level 12: Extreme defense absorption multipliers'
                    ]
                  },
                  {
                    id: 'alchemy',
                    n: 'Alchemy',
                    ico: '🧪',
                    color: 'from-purple-600 to-indigo-500',
                    border: 'border-purple-500/30',
                    bg: 'bg-purple-950/20',
                    desc: 'Transmuting magical materials in the Alchemy laboratory.',
                    perks: [
                      'Decreases magic staff mana cast fatigue cost (-3% per level)',
                      'Boosts void and magic staff projectile hits by +5% per level',
                      'Generates larger discovery XP yields inside the alchemical laboratory'
                    ]
                  }
                ].map(sk => {
                  const data = gameState?.pl?.skills?.[sk.id] || { lvl: 1, xp: 0, xpNext: 100 };
                  const percent = Math.min(100, (data.xp / data.xpNext) * 100);
                  
                  return (
                    <div key={sk.id} className={`p-5 rounded-2xl border ${sk.border} ${sk.bg} flex flex-col justify-between`}>
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-3xl">{sk.ico}</span>
                            <div>
                              <h3 className="font-bold text-white text-base tracking-wide">{sk.n}</h3>
                              <p className="text-[10px] opacity-50 mt-0.5">{sk.desc}</p>
                            </div>
                          </div>
                          <div className="bg-white/10 px-3 py-1 rounded-full border border-white/5 font-bold text-teal-400 text-sm">
                            LVL {data.lvl}
                          </div>
                        </div>
                        
                        {/* Progress Bar */}
                        <div className="mt-4">
                          <div className="flex justify-between items-center text-[10px] opacity-70 mb-1.5">
                            <span>EXP: {data.xp} / {data.xpNext}</span>
                            <span>{Math.floor(percent)}%</span>
                          </div>
                          <div className="h-2.5 w-full bg-white/5 border border-white/10 rounded-full overflow-hidden">
                            <motion.div 
                              className={`h-full bg-gradient-to-r ${sk.color}`}
                              initial={{ width: 0 }}
                              animate={{ width: `${percent}%` }}
                              transition={{ duration: 0.5 }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Benefits Perks */}
                      <div className="mt-4 pt-3 border-t border-white/5">
                        <h4 className="text-[10px] uppercase tracking-wider font-bold opacity-40 mb-1.5">Level Perks & Bonuses:</h4>
                        <ul className="space-y-1">
                          {sk.perks.map((perk, pidx) => (
                            <li key={pidx} className="text-xs opacity-75 flex items-start gap-1">
                              <span className="text-teal-400 mt-0.5">•</span>
                              <span>{perk}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {showCraft && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 flex flex-col font-mono"
          >
            {/* Header */}
            <div className="p-4 sm:p-6 flex justify-between items-center border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <Hammer className="text-yellow-400" />
                <div>
                  <h2 className="text-lg sm:text-xl font-bold tracking-widest text-yellow-400">
                    CRAFTING & ALCHEMY
                  </h2>
                  <p className="text-[10px] opacity-40 uppercase tracking-widest hidden sm:block">
                    Construct blueprints or experiment with volatile ingredients
                  </p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setShowCraft(false);
                  setLabStatus(null);
                }} 
                className="p-2 hover:bg-white/10 rounded-full text-white/70 hover:text-white transition-all"
              >
                <X />
              </button>
            </div>

            {/* Tab Switches */}
            <div className="flex gap-4 border-b border-white/10 px-6 shrink-0 bg-yellow-500/[0.02] py-2">
              <button 
                onClick={() => setCraftTab('blueprints')}
                className={`pb-2 pt-1 text-xs sm:text-sm font-bold tracking-wider flex items-center gap-2 transition-all ${craftTab === 'blueprints' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-white/40 hover:text-white'}`}
              >
                <BookOpen size={16} /> BLUEPRINTS
              </button>
              <button 
                onClick={() => setCraftTab('lab')}
                className={`pb-2 pt-1 text-xs sm:text-sm font-bold tracking-wider flex items-center gap-2 transition-all ${craftTab === 'lab' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-white/40 hover:text-white'}`}
              >
                <FlaskConical size={16} /> TRANSMUTATION LAB
              </button>
            </div>

            {/* Content view */}
            <div className="flex-1 overflow-hidden">
              {craftTab === 'blueprints' ? (
                /* --- BLUEPRINTS TAB --- */
                <div className="h-full flex flex-col lg:flex-row gap-6 p-4 sm:p-6 overflow-hidden">
                  
                  {/* Left Main Section (Recipes & Search) */}
                  <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                    
                    {/* Search and Craftable Only Toggle Row */}
                    <div className="flex flex-col sm:flex-row gap-3 mb-4 shrink-0">
                      {/* Search Input */}
                      <div className="flex-1 relative flex items-center bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white">
                        <Search size={18} className="text-white/40 mr-2" />
                        <input 
                          type="text" 
                          placeholder="Search formulas, ingredients..."
                          value={craftSearch}
                          onChange={(e) => setCraftSearch(e.target.value)}
                          className="bg-transparent border-none outline-none text-sm w-full text-white placeholder-white/30"
                        />
                        {craftSearch && (
                          <button onClick={() => setCraftSearch('')} className="text-white/45 hover:text-white text-xs">
                            Clear
                          </button>
                        )}
                      </div>

                      {/* Craftable Only filter Button */}
                      <button
                        onClick={() => setShowCraftableOnly(prev => !prev)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold tracking-wider uppercase border transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2 shrink-0 ${showCraftableOnly ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-white/5 border-white/10 text-white/50 hover:text-white'}`}
                      >
                        <Backpack size={14} className={showCraftableOnly ? "text-green-400 animate-pulse" : "text-white/40"} />
                        <span>{showCraftableOnly ? 'CRFTR ONLY' : 'ALL BLUEPRINTS'}</span>
                        <span className="text-[9px] bg-white/10 px-1.5 py-0.5 rounded text-white font-sans">
                          {recipes.filter(rc => rc.discovered && Object.entries(rc.c).every(([k, v]) => (gameState?.pl?.inv[k] || 0) >= (v as number))).length} Can Craft
                        </span>
                      </button>
                    </div>

                    {/* Horizontal Scroll categories */}
                    <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-none shrink-0 border-b border-white/5">
                      {['All', 'Materials', 'Weapons', 'Armor', 'Structures', 'Food', 'Potions'].map((cat) => {
                        const count = recipes.filter(r => 
                          (cat === 'All' || r.cat === cat) && 
                          r.discovered &&
                          (!showCraftableOnly || Object.entries(r.c).every(([k, v]) => (gameState?.pl?.inv[k] || 0) >= (v as number)))
                        ).length;
                        const active = craftCategory === cat;
                        return (
                          <button
                            key={cat}
                            onClick={() => setCraftCategory(cat)}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap shrink-0 border ${active ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40' : 'bg-white/5 text-white/50 border-transparent hover:text-white'}`}
                          >
                            {cat} {count > 0 && `(${count})`}
                          </button>
                        );
                      })}
                    </div>

                    {/* Recipe Lists Container */}
                    <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3 pb-8">
                      {recipes
                        .map((r, i) => ({ r, i }))
                        .filter(({ r }) => {
                          if (craftCategory !== 'All' && r.cat !== craftCategory) return false;
                          
                          // Handle craftable filter
                          if (showCraftableOnly) {
                            const hasMats = Object.entries(r.c).every(([k, v]) => (gameState?.pl?.inv[k] || 0) >= (v as number));
                            if (!hasMats) return false;
                          }

                          if (craftSearch) {
                            const query = craftSearch.toLowerCase();
                            const matchesName = r.n.toLowerCase().includes(query);
                            const matchesOut = (IT[r.out]?.n || '').toLowerCase().includes(query);
                            const matchesIn = Object.keys(r.c).some(k => (IT[k]?.n || '').toLowerCase().includes(query));
                            return matchesName || matchesOut || matchesIn;
                          }
                          return true;
                        })
                        .map(({ r, i }) => {
                          const isNear = checkStationProximity(r);
                          const maxQty = getAffordableMultiplier(r);
                          const hasMats = maxQty > 0;
                          const canForge = hasMats && isNear && r.discovered;

                          return (
                            <div 
                              key={i} 
                              className={`p-3 sm:p-4 rounded-xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition-all ${canForge ? 'bg-white/5 border-white/10 hover:border-yellow-500 shadow-inner' : 'border-white/5 bg-white/[0.01] opacity-75'}`}
                            >
                              <div className="flex items-center gap-4 w-full">
                                <div className="text-3xl bg-white/5 w-14 h-14 rounded-lg flex items-center justify-center shrink-0 border border-white/10 shadow-inner">
                                  {r.discovered ? (IT[r.out]?.ico || '❓') : '❓'}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-yellow-500 text-sm sm:text-base">
                                      {r.discovered ? r.n : 'Hidden Formula'}
                                    </span>
                                    {!r.discovered && (
                                      <span className="text-[8px] sm:text-[9px] bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded-full uppercase font-sans tracking-wider">
                                        Unlock in Lab
                                      </span>
                                    )}
                                    {r.craftCount > 0 && (
                                      <span className="text-[8px] sm:text-[9px] bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 px-1.5 py-0.5 rounded-md font-sans">
                                        Crafted {r.craftCount}x
                                      </span>
                                    )}
                                    {r.discovered && maxQty > 0 && (
                                      <span className="text-[8px] sm:text-[10px] bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded font-sans uppercase font-bold animate-pulse">
                                        Can Craft {maxQty}x
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] sm:text-xs opacity-50 mt-1">
                                    {r.discovered ? `Produces: ${IT[r.out]?.n || r.out}` : 'Combine components in alchemy Transmutation Lab to unlock formula!'}
                                  </p>

                                  {/* Costs Palette */}
                                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2.5">
                                    {Object.entries(r.c).map(([k, v]) => {
                                      const held = gameState?.pl?.inv[k] || 0;
                                      const cost = v as number;
                                      const sufficient = held >= cost;
                                      return (
                                        <span 
                                          key={k} 
                                          className={`text-[10px] flex items-center gap-1 leading-none ${sufficient ? 'text-green-400 font-bold' : 'text-red-400'}`}
                                        >
                                          <span>{sufficient ? '✓' : '✗'} {held}/{cost}</span>
                                          <span>{IT[k]?.ico} {IT[k]?.n || k}</span>
                                        </span>
                                      );
                                    })}
                                  </div>

                                  {/* Proximity requirements */}
                                  {r.req && (
                                    <div className="mt-2 flex items-center gap-1.5 text-[10px]">
                                      <span className={isNear ? 'text-green-400 flex items-center gap-1 font-bold' : 'text-red-400 flex items-center gap-1'}>
                                        {isNear ? '✓ Station Near:' : '✗ Station Needed:'} {IT[r.req]?.n || r.req} {IT[r.req]?.ico}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Forge Action Buttons */}
                              <div className="w-full sm:w-auto shrink-0 flex flex-row sm:flex-col gap-2 sm:justify-end">
                                {r.discovered ? (
                                  <>
                                    <button
                                      disabled={!canForge}
                                      onClick={() => canForge && craft(i, 1)}
                                      className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold transition-all uppercase tracking-wider cursor-pointer ${canForge ? 'bg-yellow-500 hover:bg-yellow-400 text-black active:scale-95 shadow-md' : 'bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'}`}
                                    >
                                      Craft 1x
                                    </button>
                                    {maxQty > 1 && (
                                      <button
                                        disabled={!canForge}
                                        onClick={() => canForge && craft(i, maxQty)}
                                        className="flex-1 sm:flex-initial px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 hover:border-green-500/40 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 cursor-pointer"
                                        title={`Batch craft maximum possible quantity: ${maxQty}x`}
                                      >
                                        Craft Max ({maxQty}x)
                                      </button>
                                    )}
                                  </>
                                ) : (
                                  <div className="text-[10px] text-cyan-400 uppercase tracking-widest font-sans flex items-center gap-1 py-1.5 px-3 bg-cyan-500/10 rounded-lg border border-cyan-500/30">
                                    <FlaskConical size={12} /> Research Only
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* Right Sidebar Section (Dynamic Inventory & Available Crafts summary) */}
                  <div className="w-full lg:w-80 shrink-0 h-full flex flex-col gap-4 overflow-y-auto border-t lg:border-t-0 lg:border-l border-white/10 pt-4 lg:pt-0 lg:pl-6">
                    
                    {/* Panel 1: INGREDIENTS CHEATSHEET */}
                    <div className="bg-white/[0.02] border border-white/10 p-4 rounded-xl flex flex-col gap-2.5">
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-yellow-500 flex items-center gap-1">
                          <Backpack size={13} /> Active Materials
                        </span>
                        <span className="text-[9px] opacity-40 font-bold uppercase">Stored</span>
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-1 gap-2 max-h-36 lg:max-h-56 overflow-y-auto pr-1">
                        {Object.entries(gameState?.pl?.inv || {})
                          .filter(([k, qty]) => (qty as number) > 0 && IT[k]?.t === 'mat')
                          .map(([k, qty]) => (
                            <div key={k} className="flex items-center justify-between bg-zinc-900/60 p-2 rounded-xl border border-white/5">
                              <div className="flex items-center gap-1.5 truncate">
                                <span className="text-base select-none">{IT[k]?.ico || '❓'}</span>
                                <span className="text-[10px] truncate">{IT[k]?.n || k}</span>
                              </div>
                              <span className="text-xs font-bold text-green-400">{qty as number}</span>
                            </div>
                          ))}
                        {Object.entries(gameState?.pl?.inv || {}).filter(([k, qty]) => (qty as number) > 0 && IT[k]?.t === 'mat').length === 0 && (
                          <div className="text-[10px] text-white/30 italic text-center py-4">No materials in backpack. Go gather wood or mine rocks!</div>
                        )}
                      </div>
                    </div>

                    {/* Panel 2: CRAFTABLE DASHBOARD (Available recipes based on resources) */}
                    <div className="bg-white/[0.02] border border-white/10 p-4 rounded-xl flex flex-col gap-2.5 flex-1 min-h-[180px]">
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-green-400 flex items-center gap-1">
                          <Sparkles size={13} /> Ready To Forge
                        </span>
                        <span className="text-[9px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-bold uppercase">
                          {recipes.filter(rc => rc.discovered && Object.entries(rc.c).every(([k, v]) => (gameState?.pl?.inv[k] || 0) >= (v as number))).length} Ready
                        </span>
                      </div>

                      <div className="flex flex-col gap-2 max-h-[160px] lg:max-h-[300px] overflow-y-auto pr-1">
                        {recipes
                          .map((r, i) => ({ r, i, max: getAffordableMultiplier(r), near: checkStationProximity(r) }))
                          .filter(({ r, max }) => r.discovered && max > 0)
                          .map(({ r, i, max, near }) => (
                            <div 
                              key={i}
                              onClick={() => near && craft(i, 1)}
                              className={`p-2 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                                near 
                                  ? 'bg-zinc-900 border-white/10 hover:border-yellow-500 cursor-pointer' 
                                  : 'bg-black/30 border-white/5 opacity-60 cursor-not-allowed'
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span className="text-xl shrink-0 select-none">{IT[r.out]?.ico || '❓'}</span>
                                <div className="truncate">
                                  <div className="text-[10px] font-bold text-white truncate">{r.n}</div>
                                  <div className="text-[8px] text-green-400 font-bold uppercase">Can forge: {max}x</div>
                                </div>
                              </div>
                              
                              <div className="shrink-0">
                                {near ? (
                                  <button 
                                    className="px-2 py-1 bg-yellow-500 text-black text-[9px] font-bold rounded hover:bg-yellow-400 active:scale-95 transition-all uppercase leading-none"
                                    onClick={(e) => { e.stopPropagation(); craft(i, 1); }}
                                  >
                                    CRAFT
                                  </button>
                                ) : (
                                  <div className="text-[8px] text-red-400 bg-red-950/25 px-1.5 py-1 rounded font-bold uppercase" title={`Requires station: ${IT[r.req]?.n || r.req}`}>
                                    LOCKED
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}

                        {recipes.filter(rc => rc.discovered && Object.entries(rc.c).every(([k, v]) => (gameState?.pl?.inv[k] || 0) >= (v as number))).length === 0 && (
                          <div className="text-[10px] text-white/30 italic text-center py-8">
                            No craftable items ready. Collect resources to unlock formulas!
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* --- TRANSMUTATION LAB TAB --- */
                <div className="h-full flex flex-col md:flex-row p-4 sm:p-6 gap-6 overflow-y-auto">
                  
                  {/* Left Column: Mixer & Feedback */}
                  <div className="flex-1 flex flex-col gap-4 bg-white/[0.02] border border-white/10 p-4 sm:p-6 rounded-2xl">
                    <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                      <FlaskConical className="text-cyan-400 animate-pulse" />
                      <div>
                        <h3 className="font-bold text-white text-sm sm:text-base tracking-wider uppercase">
                          Alchemy Compounder Pot
                        </h3>
                        <p className="text-[9px] opacity-40 uppercase">Define ratios and transmute reactants</p>
                      </div>
                    </div>

                    {/* Fusing Crucible list */}
                    <div className="flex-1 min-h-[140px] border border-dashed border-white/15 rounded-xl p-4 flex flex-col justify-center items-center gap-3 relative overflow-y-auto bg-black/40">
                      {labReactants.length === 0 ? (
                        <div className="text-center p-4">
                          <div className="w-12 h-12 rounded-full border border-dashed border-white/20 flex items-center justify-center mx-auto mb-2 opacity-30 text-2xl">
                            🧪
                          </div>
                          <p className="text-xs text-white/40">Crucible is empty</p>
                          <p className="text-[10px] text-white/30 mt-1">Tap materials from the palette on the right to load reactants</p>
                        </div>
                      ) : (
                        <div className="w-full flex flex-col gap-2">
                          {labReactants.map((react) => {
                            const maxInventory = gameState?.pl.inv[react.itemKey] || 0;
                            return (
                              <div 
                                key={react.itemKey}
                                className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/10 text-white"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-2xl">{IT[react.itemKey]?.ico || '🍀'}</span>
                                  <div>
                                    <div className="text-xs font-bold text-cyan-300">{IT[react.itemKey]?.n || react.itemKey}</div>
                                    <div className="text-[9px] opacity-40">Available: {maxInventory}</div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <button 
                                    onClick={() => adjustReactantQty(react.itemKey, -1)}
                                    className="p-1 px-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md text-xs font-sans hover:text-cyan-400 transition-all font-bold"
                                  >
                                    -
                                  </button>
                                  <span className="text-sm font-sans font-bold text-white px-2 min-w-[20px] text-center">
                                    {react.qty}
                                  </span>
                                  <button 
                                    onClick={() => adjustReactantQty(react.itemKey, 1)}
                                    className="p-1 px-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md text-xs font-sans hover:text-cyan-400 transition-all font-bold"
                                  >
                                    +
                                  </button>
                                  <button 
                                    onClick={() => removeReactant(react.itemKey)}
                                    className="p-1.5 hover:bg-red-500/20 text-red-400/85 hover:text-red-400 rounded-md transition-all ml-1"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Transmute action */}
                    <button 
                      onClick={combineMaterials}
                      className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white py-3 rounded-xl font-bold font-mono tracking-widest text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg hover:shadow-cyan-500/20 transition-all active:scale-95"
                    >
                      <Sparkles size={16} /> TRANSMUTE
                    </button>

                    {/* Action result panel */}
                    {labStatus && (
                      <div className={`p-4 rounded-xl border text-xs leading-relaxed ${labStatus.success ? 'bg-green-500/10 border-green-500/30 text-green-400 font-sans' : 'bg-red-500/10 border-red-500/30 text-red-400 font-sans'}`}>
                        <div className="font-bold mb-1 flex items-center gap-1.5 text-xs tracking-wider uppercase font-mono">
                          {labStatus.success ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                          {labStatus.success ? 'TRANSMUTATION COMPATIBLE' : 'ALCHEMY REACTION UNSTABLE'}
                        </div>
                        <p className="opacity-95">{labStatus.msg}</p>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Ingredient Palette */}
                  <div className="flex-1 flex flex-col gap-4 bg-white/[0.02] border border-white/10 p-4 sm:p-6 rounded-2xl">
                    <div className="flex justify-between items-center border-b border-white/5 pb-3">
                      <div>
                        <h3 className="font-bold text-white text-sm sm:text-base tracking-wider uppercase flex items-center gap-1.5">
                          💼 Lab Palette
                        </h3>
                        <p className="text-[9px] opacity-40 uppercase">Raw material reactants in your pouch</p>
                      </div>
                      <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded-full text-white/50">
                        {Object.entries(gameState?.pl.inv || {}).filter(([k, v]) => (v as number) > 0 && IT[k]?.t === 'mat').length} Types
                      </span>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-1">
                      <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-3 xl:grid-cols-4 gap-2.5 pb-6">
                        {Object.entries(gameState?.pl.inv || {})
                          .filter(([k, v]) => (v as number) > 0 && IT[k]?.t === 'mat')
                          .map(([k, v]) => {
                            const isSelected = labReactants.some(p => p.itemKey === k);
                            return (
                              <div
                                key={k}
                                onClick={() => {
                                  const maxInv = gameState?.pl.inv[k] || 0;
                                  if (maxInv <= 0) return;
                                  
                                  setLabReactants(prev => {
                                    const existing = prev.find(p => p.itemKey === k);
                                    if (existing) {
                                      if (existing.qty >= maxInv) return prev;
                                      return prev.map(p => p.itemKey === k ? { ...p, qty: p.qty + 1 } : p);
                                    } else {
                                      return [...prev, { itemKey: k, qty: 1 }];
                                    }
                                  });
                                  setLabStatus(null);
                                }}
                                className={`p-3 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${isSelected ? 'bg-cyan-500/10 border-cyan-400 hover:border-cyan-300 shadow-md shadow-cyan-500/5' : 'bg-white/5 border-white/10 hover:border-white/20'}`}
                              >
                                <span className="text-3xl select-none">{IT[k]?.ico || '💎'}</span>
                                <span className="text-[10px] font-bold truncate max-w-full text-center">{IT[k]?.n || k}</span>
                                <span className="text-[9px] text-cyan-400 font-sans font-bold">Qty: {v as number}</span>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </div>

                </div>
              )}
            </div>
          </motion.div>
        )}

        {showOracle && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-purple-950/90 backdrop-blur-md flex items-center justify-center p-6"
          >
            <div className="max-w-md w-full bg-black/80 border border-purple-500/50 rounded-3xl p-8 flex flex-col items-center gap-6 shadow-[0_0_50px_rgba(168,85,247,0.3)]">
              <div className="w-20 h-20 rounded-full bg-purple-500/20 flex items-center justify-center border border-purple-500/40 animate-pulse">
                <BrainCircuit size={40} className="text-purple-400" />
              </div>
              <h2 className="text-2xl font-bold tracking-[0.3em] text-purple-400">CELESTIAL ORACLE</h2>
              
              {isOracleLoading ? (
                <div className="flex flex-col items-center gap-4 py-8">
                  <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs opacity-50 animate-pulse">Consulting the stars...</p>
                </div>
              ) : (
                <div className="flex flex-col gap-6 text-center">
                  <p className="text-lg italic text-purple-200 leading-relaxed">
                    "{oracleData?.message || "The stars are silent today..."}"
                  </p>
                  {oracleData?.event && (
                    <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-2xl">
                      <div className="text-[10px] text-purple-400 uppercase tracking-widest mb-1">World Event Triggered</div>
                      <div className="text-sm font-bold text-white">{oracleData.event}</div>
                    </div>
                  )}
                  <button 
                    onClick={() => setShowOracle(false)}
                    className="mt-4 px-8 py-3 bg-purple-500 text-white rounded-full font-bold hover:bg-purple-400 transition-all active:scale-95"
                  >
                    ACCEPT PROPHECY
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {showSaveMenu && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
          >
            <div className="max-w-4xl w-full bg-zinc-950 border border-yellow-500/30 rounded-3xl p-6 md:p-8 flex flex-col gap-6 max-h-[90vh] overflow-y-auto shadow-[0_0_50px_rgba(234,179,8,0.15)] text-white font-mono pointer-events-auto">
              <div className="flex justify-between items-center border-b border-white/10 pb-4">
                <div className="flex items-center gap-2.5">
                  <Save size={22} className="text-yellow-400" />
                  <div>
                    <h2 className="text-xl font-bold uppercase tracking-wider text-yellow-400">SURVIVAL SAVE ENGINE</h2>
                    <p className="text-[10px] opacity-50 uppercase mt-0.5">Manage progress and cloud-free local backup states</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowSaveMenu(false)}
                  className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Autosave Switcher */}
              <div className="bg-white/[0.02] border border-white/10 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider">Automated Background Save</div>
                  <p className="text-[10px] opacity-40 uppercase mt-1">Saves your survival state automatically into the Autosave Slot every 60 seconds</p>
                </div>
                <button 
                  onClick={() => setAutosaveEnabled(prev => !prev)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold tracking-wider uppercase border transition-all active:scale-95 cursor-pointer ${autosaveEnabled ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-white/5 border-white/10 text-white/50'}`}
                >
                  {autosaveEnabled ? 'AUTOSAVE: ENABLED' : 'AUTOSAVE: DISABLED'}
                </button>
              </div>

              {/* Save Slots list */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {['1', '2', '3', 'autosave'].map((slotId) => {
                  const save = slots[slotId];
                  const isAutosave = slotId === 'autosave';
                  
                  return (
                    <div 
                      key={slotId}
                      className={`p-4 rounded-2xl border flex flex-col justify-between gap-4 transition-all relative ${isAutosave ? 'bg-blue-500/5 border-blue-500/20' : save ? 'bg-zinc-900 border-white/10 hover:border-white/20' : 'bg-black/30 border-dashed border-white/10'}`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-widest text-white">
                              {isAutosave ? '⚡ Autosave Slot' : `Save Slot ${slotId}`}
                            </span>
                            {isAutosave && (
                              <span className="text-[8px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">
                                Auto
                              </span>
                            )}
                          </div>
                          
                          {save ? (
                            <div className="mt-2.5 flex flex-col gap-1 text-[10px] text-white/60">
                              <div>Day {save.day} • Level {save.pl?.lvl || 1} • {save.pl?.hp || 100} HP</div>
                              <div className="truncate max-w-[280px]">Location: <span className="text-blue-300">{MAPS[Math.floor((save.pl?.y || 0) / (ZH * TZ)) * ZCOLS + Math.floor((save.pl?.x || 0) / (ZW * TZ))]?.n || "Unknown"}</span></div>
                              <div className="text-[9px] opacity-40 uppercase mt-1">Saved: {new Date(save.timestamp).toLocaleString()}</div>
                            </div>
                          ) : (
                            <div className="mt-3.5 text-[10px] text-white/40 uppercase tracking-wider">
                              [ Empty Slot ]
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5 mt-auto">
                        {!isAutosave && (
                          <button 
                            onClick={() => saveGame(slotId)}
                            className="flex-1 py-1.5 bg-yellow-600/10 hover:bg-yellow-600/20 text-yellow-400 border border-yellow-500/10 hover:border-yellow-500/30 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 cursor-pointer"
                          >
                            {save ? 'Overwrite' : 'Save here'}
                          </button>
                        )}
                        
                        {save ? (
                          <>
                            <button 
                              onClick={() => loadGame(slotId)}
                              className="flex-1 py-1.5 bg-green-600/10 hover:bg-green-600/20 text-green-400 border border-green-500/10 hover:border-green-500/30 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 cursor-pointer"
                            >
                              Load
                            </button>
                            <button 
                              onClick={() => exportSaveToFile(slotId)}
                              title="Download backup file"
                              className="p-1.5 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 rounded-xl transition-all active:scale-95 cursor-pointer"
                            >
                              <Download size={13} />
                            </button>
                            {!isAutosave && (
                              <button 
                                onClick={() => deleteSave(slotId)}
                                title="Delete save data"
                                className="p-1.5 bg-red-950/30 hover:bg-red-950/60 text-red-400 hover:text-red-300 border border-red-900/20 hover:border-red-500/30 rounded-xl transition-all active:scale-95 cursor-pointer"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </>
                        ) : (
                          <div className="text-[9px] opacity-30 italic py-1.5 uppercase">No data loaded</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Import Section */}
              <div className="bg-white/[0.01] border border-white/5 p-5 md:p-6 rounded-2xl flex flex-col gap-4 mt-2">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-cyan-400">
                    <Upload size={13} /> Save Portability (Backup String Sync)
                  </h3>
                  <p className="text-[10px] opacity-40 uppercase mt-1">Paste a previously backed-up serialized save string here to instantly restore your adventure.</p>
                </div>

                <div className="flex flex-col gap-2">
                  <textarea 
                    value={importString}
                    onChange={(e) => {
                      setImportString(e.target.value);
                      setImportError(null);
                    }}
                    placeholder="Paste save string JSON data here..."
                    className="w-full h-16 bg-neutral-900 border border-white/10 focus:border-cyan-500/50 rounded-xl p-3 text-xs text-white placeholder-white/20 font-mono resize-none focus:outline-none"
                  />
                  {importError && (
                    <div className="text-[10px] text-red-400 bg-red-950/20 border border-red-900/30 px-3 py-1.5 rounded-lg">
                      {importError}
                    </div>
                  )}
                  <button 
                    onClick={handleImportSaveText}
                    className="self-end px-5 py-2 bg-cyan-600/10 hover:bg-cyan-600/20 text-cyan-400 border border-cyan-500/20 hover:border-cyan-500/30 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 cursor-pointer"
                  >
                    Import Save String
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- Banner --- */}
      <AnimatePresence>
        {banner && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-1/3 left-0 right-0 flex justify-center pointer-events-none z-[100]"
          >
            <div className="px-12 py-6 bg-black/80 border-y border-yellow-500/50 backdrop-blur-sm">
              <h1 className="text-4xl font-black tracking-[0.5em] text-yellow-500 drop-shadow-[0_0_20px_rgba(234,179,8,0.5)]">
                {banner}
              </h1>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- Death Screen --- */}
      <AnimatePresence>
        {showDeathScreen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-red-950/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center"
          >
            <motion.h1 
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-6xl font-black tracking-[0.5em] text-red-500 mb-8 drop-shadow-[0_0_30px_rgba(239,68,68,0.5)]"
            >
              YOU DIED
            </motion.h1>
            <p className="text-red-200/60 mb-12 max-w-xs">
              The wilderness has claimed another soul. Your journey ends here... or does it?
            </p>
            <button 
              onClick={handleRespawn}
              className="px-12 py-4 bg-red-600 text-white rounded-full font-bold text-xl hover:bg-red-500 transition-all active:scale-95 shadow-[0_0_30px_rgba(220,38,38,0.4)]"
            >
              RESPAWN
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
