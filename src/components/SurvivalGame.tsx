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
  Cpu,
  Globe,
  Shuffle,
  Cloud,
  CloudUpload,
  CloudDownload,
  LogIn,
  LogOut,
  RefreshCw,
  UserCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getOracleGuidance, generateWorldEvent, castSpell } from '../services/geminiService';
import { auth, googleProvider, db, handleFirestoreError, testConnection, OperationType } from '../services/firebase';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, setDoc, getDoc, getDocs, deleteDoc, collection, query } from 'firebase/firestore';

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
  { id: 0, n: 'Verdant Forest', s: 1337, m: TG, f: TD, r: TS, w: TW, wf: .12, rf: .08, sky: '#87ceeb', ef: ['wolf', 'fox', 'goblin', 'bandit', 'deer', 'pheasant'], dr: { wood: .04, fiber: .02, herb: .015, berry: .012, flint: .008, stone: .02 } },
  { id: 1, n: 'Deep Forest', s: 2674, m: TG, f: TD, r: TS, w: TW, wf: .10, rf: .07, sky: '#1a3d10', ef: ['wolf', 'spider', 'skeleton', 'goblin', 'boar', 'alpha_wolf'], dr: { wood: .04, mushroom: .016, herb: .012, venom: .008, fiber: .014, bone: .01 } },
  { id: 2, n: 'Sunlit Plains', s: 3011, m: TG, f: TD, r: TS, w: TW, wf: .05, rf: .04, sky: '#6dbadf', ef: ['fox', 'goblin', 'bandit', 'archer', 'deer', 'pheasant', 'boar'], dr: { fiber: .025, herb: .018, berry: .015, flint: .01, feather: .01, honey: .01, cotton: .015 } },
  { id: 3, n: 'Sandy Desert', s: 4488, m: TSA, f: TSA, r: TS, w: TW, wf: .03, rf: .08, sky: '#f5d08a', ef: ['bandit', 'bandit_chief', 'goblin', 'orc'], dr: { bone: .02, sulfur: .016, flint: .014, gem: .005, sand: .03, stone: .02 } },
  { id: 4, n: 'Frozen Tundra', s: 5665, m: TSN, f: TS, r: TS, w: TW, wf: .06, rf: .12, sky: '#b0d4e8', ef: ['wolf', 'bear', 'skeleton', 'orc', 'alpha_wolf'], dr: { ice_crystal: .02, bone: .01, herb: .006, crystal: .006, wood: .012 } },
  { id: 5, n: 'Misty Swamp', s: 6821, m: TSW, f: TD, r: TS, w: TW, wf: .18, rf: .04, sky: '#4a5a3a', ef: ['zombie', 'spider', 'wraith', 'goblin', 'boar'], dr: { mushroom: .022, venom: .016, fiber: .014, silk: .009, herb: .009 } },
  { id: 6, n: 'Mountain Pass', s: 7234, m: TS, f: TD, r: TS, w: TW, wf: .04, rf: .26, sky: '#7a8898', ef: ['troll', 'bear', 'orc', 'skeleton', 'deer', 'alpha_wolf'], dr: { iron_ore: .02, crystal: .009, gem: .006, coal: .014, stone: .03, mithril_ore: .005 } },
  { id: 7, n: 'Goblin Territory', s: 8456, m: TD, f: TD, r: TS, w: TW, wf: .06, rf: .09, sky: '#7a9a6a', ef: ['goblin', 'goblin_chief', 'bandit', 'orc', 'boar', 'deer'], dr: { bone: .016, feather: .013, leather: .011, flint: .011, wood: .016 } },
  { id: 8, n: 'Coastal Shore', s: 9732, m: TSA, f: TSA, r: TS, w: TW, wf: .28, rf: .03, sky: '#4a9ad4', ef: ['bandit', 'skeleton', 'goblin', 'archer', 'pheasant', 'deer'], dr: { fish: .022, silk: .011, sand: .035, feather: .016, bone: .009 } },
  { id: 9, n: 'Ancient Ruins', s: 10551, m: TS, f: TS, r: TS, w: TW, wf: .03, rf: .20, sky: '#5a5060', ef: ['skeleton', 'golem', 'dark_mage', 'wraith'], dr: { crystal: .016, magic_essence: .011, bone: .022, gem: .013, stone: .022, ancient_rune: .003 } },
  { id: 10, n: 'Scorched Waste', s: 11889, m: TS, f: TS, r: TS, w: TLV, wf: .06, rf: .11, sky: '#8a4020', ef: ['troll', 'orc', 'orc_chief', 'dark_mage'], dr: { sulfur: .022, coal: .027, iron_ore: .014, ash_crystal: .006 } },
  { id: 11, n: 'Volcanic Fields', s: 12004, m: TS, f: TLV, r: TS, w: TLV, wf: .14, rf: .07, sky: '#cc4400', ef: ['troll', 'orc', 'golem', 'wraith'], dr: { sulfur: .027, coal: .031, iron_ore: .022, crystal: .006, gem: .004 } },
  { id: 12, n: 'Orc Stronghold', s: 13377, m: TD, f: TD, r: TS, w: TW, wf: .04, rf: .09, sky: '#6a5040', ef: ['orc', 'orc_chief', 'troll', 'goblin_chief', 'boar'], dr: { bone: .022, leather: .016, iron_ore: .014, coal: .011, wood: .014 } },
  { id: 13, n: 'Bandit Outpost', s: 14220, m: TD, f: TS, r: TS, w: TW, wf: .04, rf: .13, sky: '#5a5060', ef: ['bandit', 'bandit_chief', 'archer', 'dark_mage'], dr: { iron_ore: .014, leather: .014, gem: .006, flint: .014, coal: .009 } },
  { id: 14, n: 'Crystal Cavern', s: 15641, m: TS, f: TS, r: TS, w: TW, wf: .04, rf: .20, sky: '#1a1a44', ef: ['wraith', 'dark_mage', 'skeleton', 'golem'], dr: { crystal: .036, magic_essence: .020, gem: .016, ice_crystal: .014 } },
  { id: 15, n: 'Haunted Graveyard', s: 16007, m: TD, f: TS, r: TS, w: TW, wf: .04, rf: .08, sky: '#1a1a22', ef: ['skeleton', 'zombie', 'wraith', 'dark_mage'], dr: { bone: .036, crystal: .011, magic_essence: .008, herb: .004, silk: .006 } },
  { id: 16, n: 'Undead Kingdom', s: 17890, m: TD, f: TS, r: TS, w: TW, wf: .06, rf: .11, sky: '#0a0a1a', ef: ['zombie', 'skeleton', 'wraith', 'dark_mage', 'golem'], dr: { bone: .040, magic_essence: .016, crystal: .011, silk: .009 } },
  { id: 17, n: 'Enchanted Grove', s: 18234, m: TG, f: TG, r: TS, w: TW, wf: .09, rf: .04, sky: '#2a1a4a', ef: ['dark_mage', 'wraith', 'goblin', 'spider', 'deer', 'pheasant'], dr: { magic_essence: .025, crystal: .016, herb: .027, silk: .016, mushroom: .011 } },
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

  // --- Wild game huntable animals ---
  deer: { n: 'Wild Deer', ico: '🦌', hp: 25, spd: 2.2, dmg: 0, acd: 100, xp: 12, lo: { meat: 1.0, leather: .6 }, ran: false },
  boar: { n: 'Wild Boar', ico: '🐗', hp: 45, spd: 1.4, dmg: 14, acd: 70, xp: 18, lo: { meat: 1.0, leather: .8 }, ran: false },
  pheasant: { n: 'Wild Pheasant', ico: '🦃', hp: 12, spd: 1.8, dmg: 0, acd: 100, xp: 8, lo: { meat: .6, feather: 1.0 }, ran: false },
  alpha_wolf: { n: 'Alpha Wolf', ico: '🐺', hp: 130, spd: 2.1, dmg: 24, acd: 50, xp: 55, lo: { meat: 2.0, leather: 1.5, alpha_pelt: 1.0 }, ran: false, boss: 1 },
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
  
  copper_ore: { ico: '🪙', n: 'Copper Ore', t: 'mat' },
  gold_ore: { ico: '💛', n: 'Gold Ore', t: 'mat' },
  mithril_ore: { ico: '🪐', n: 'Mithril Ore', t: 'mat' },
  clay: { ico: '🧱', n: 'Clay', t: 'mat' },
  cactus_fruit: { ico: '🌵', n: 'Cactus Fruit', t: 'food', hu: 20, hp: 8 },
  snowberry: { ico: '❄️', n: 'Snowberry', t: 'food', hu: 15, hp: 12 },
  astral_flower: { ico: '🌸', n: 'Astral Flower', t: 'mat' },
  copper_bar: { ico: '🟫', n: 'Copper Bar', t: 'mat' },
  gold_bar: { ico: '⭐', n: 'Gold Bar', t: 'mat' },
  mithril_bar: { ico: '💠', n: 'Mithril Bar', t: 'mat' },

  leather_vest: { ico: '🧥', n: 'Leather Vest', t: 'armor', sl: 'chest', def: 5 },
  iron_chest: { ico: '🛡️', n: 'Iron Chest', t: 'armor', sl: 'chest', def: 14 },
  copper_chest: { ico: '🧥', n: 'Copper Plate', t: 'armor', sl: 'chest', def: 8 },
  gold_chest: { ico: '👑', n: 'Gold Plate', t: 'armor', sl: 'chest', def: 11 },
  mithril_chest: { ico: '🛡️', n: 'Mithril Plate', t: 'armor', sl: 'chest', def: 24 },
  
  fists: { id: 'fists', n: 'Fists', ico: '✊', dmg: 5, spd: 20, rng: 44, type: 'melee', mp: 0 },
  fishing_rod: { id: 'fishing_rod', n: 'Fishing Rod', ico: '🎣', dmg: 2, spd: 40, rng: 30, type: 'melee', mp: 0 },
  stone_axe: { id: 'stone_axe', n: 'Stone Axe', ico: '🪓', dmg: 15, spd: 28, rng: 44, type: 'melee', mp: 0 },
  iron_sword: { id: 'iron_sword', n: 'Iron Sword', ico: '⚔️', dmg: 28, spd: 24, rng: 50, type: 'melee', mp: 0 },
  copper_sword: { id: 'copper_sword', n: 'Copper Sword', ico: '🗡️', dmg: 16, spd: 26, rng: 46, type: 'melee', mp: 0 },
  gold_sword: { id: 'gold_sword', n: 'Gold Sword', ico: '⚔️', dmg: 22, spd: 22, rng: 48, type: 'melee', mp: 0 },
  mithril_sword: { id: 'mithril_sword', n: 'Mithril Sword', ico: '⚔️', dmg: 48, spd: 18, rng: 54, type: 'melee', mp: 0 },
  shortbow: { id: 'shortbow', n: 'Shortbow', ico: '🏹', dmg: 20, spd: 30, rng: 200, type: 'ranged', mp: 0 },
  fire_staff: { id: 'fire_staff', n: 'Fire Staff', ico: '🪄', dmg: 38, spd: 36, rng: 240, type: 'magic', mp: 15, fx: 'burn', col: '#ff5500' },
  ice_staff: { id: 'ice_staff', n: 'Ice Staff', ico: '❄️', dmg: 25, spd: 40, rng: 220, type: 'magic', mp: 12, fx: 'slow', col: '#00ccff' },
  void_staff: { id: 'void_staff', n: 'Void Staff', ico: '🔮', dmg: 60, spd: 50, rng: 300, type: 'magic', mp: 30, fx: 'void', col: '#9900ff' },
  heal_staff: { id: 'heal_staff', n: 'Heal Staff', ico: '🩹', dmg: 0, spd: 60, rng: 0, type: 'magic_heal', mp: 25, fx: 'heal', col: '#00ffaa' },
  storm_staff: { id: 'storm_staff', n: 'Storm Staff', ico: '⚡', dmg: 45, spd: 32, rng: 280, type: 'magic', mp: 20, fx: 'lightning', col: '#00ffff' },
  earth_staff: { id: 'earth_staff', n: 'Earth Staff', ico: '⛰️', dmg: 55, spd: 45, rng: 200, type: 'magic', mp: 25, fx: 'earthquake', col: '#e28743' },
  cosmic_staff: { id: 'cosmic_staff', n: 'Cosmic Staff', ico: '🌠', dmg: 75, spd: 50, rng: 350, type: 'magic', mp: 40, fx: 'starfall', col: '#ff33ff' },
  mithril_staff: { id: 'mithril_staff', n: 'Mithril Staff', ico: '🪄', dmg: 75, spd: 40, rng: 310, type: 'magic', mp: 22, fx: 'starfall', col: '#00ffff' },
  
  campfire: { ico: '🔥', n: 'Campfire', t: 'struct' },
  workbench: { ico: '🪚', n: 'Workbench', t: 'struct' },
  forge: { ico: '⚒️', n: 'Forge', t: 'struct' },
  magic_altar: { ico: '🕋', n: 'Magic Altar', t: 'struct' },

  // --- Hunted/Fishing Hotspot additions ---
  magma_cod: { ico: '🌋', n: 'Magma Cod', t: 'food', hu: 20, hp: 8, mp: 5 },
  obsidian_fin: { ico: '🖤', n: 'Obsidian Fin', t: 'food', hu: 35, hp: 20, mp: 10 },
  legendary_salmon: { ico: '👑', n: 'Legendary Salmon', t: 'food', hu: 40, hp: 30, mp: 15 },
  cooked_magma_cod: { ico: '🔥', n: 'Cooked Magma Cod', t: 'food', hu: 60, hp: 35, mp: 20 },
  cooked_obsidian_fin: { ico: '🖤', n: 'Cooked Obsidian Fin', t: 'food', hu: 80, hp: 60, mp: 40 },
  cooked_legendary_salmon: { ico: '👑', n: 'Cooked Legendary Salmon', t: 'food', hu: 95, hp: 80, mp: 60 },
  alpha_pelt: { ico: '🐺', n: 'Alpha Wolf Pelt', t: 'mat' },
  boar_tusk: { ico: '🐗', n: 'Boar Tusk', t: 'mat' },
  recurve_bow: { id: 'recurve_bow', n: 'Recurve Bow', ico: '🏹', dmg: 38, spd: 25, rng: 240, type: 'ranged', mp: 0 },
  beastmaster_armor: { ico: '🧥', n: 'Beastmaster Armor', t: 'armor', sl: 'chest', def: 12 },

  // --- Head, Legs, Feet & Ring Equipment ---
  leather_cap: { ico: '🪖', n: 'Leather Cap', t: 'armor', sl: 'head', def: 2 },
  iron_helmet: { ico: '🪖', n: 'Iron Helmet', t: 'armor', sl: 'head', def: 6 },
  mithril_helmet: { ico: '🪖', n: 'Mithril Helmet', t: 'armor', sl: 'head', def: 12 },

  leather_trousers: { ico: '👖', n: 'Leather Pants', t: 'armor', sl: 'legs', def: 3 },
  iron_greaves: { ico: '👖', n: 'Iron Greaves', t: 'armor', sl: 'legs', def: 8 },
  mithril_greaves: { ico: '👖', n: 'Mithril Greaves', t: 'armor', sl: 'legs', def: 16 },

  leather_boots: { ico: '🥾', n: 'Leather Boots', t: 'armor', sl: 'feet', def: 2, spdBonus: 0.2 },
  iron_boots: { ico: '🥾', n: 'Iron Boots', t: 'armor', sl: 'feet', def: 5, spdBonus: 0.1 },
  mithril_boots: { ico: '🥾', n: 'Mithril Boots', t: 'armor', sl: 'feet', def: 9, spdBonus: 0.4 },

  health_ring: { ico: '💍', n: 'Vitality Ring', t: 'armor', sl: 'ring', def: 1, hpBonus: 20 },
  stamina_ring: { ico: '💍', n: 'Stamina Ring', t: 'armor', sl: 'ring', def: 0, spdBonus: 0.3 },
  mana_ring: { ico: '💍', n: 'Arcane Ring', t: 'armor', sl: 'ring', def: 1, mpBonus: 30 },
};

const RC = [
  { n: 'Cooked Magma Cod', out: 'cooked_magma_cod', cnt: 1, cat: 'Food', c: { magma_cod: 1 }, req: 'campfire' },
  { n: 'Cooked Obsidian Fin', out: 'cooked_obsidian_fin', cnt: 1, cat: 'Food', c: { obsidian_fin: 1 }, req: 'campfire' },
  { n: 'Cooked Legendary Salmon', out: 'cooked_legendary_salmon', cnt: 1, cat: 'Food', c: { legendary_salmon: 1 }, req: 'campfire' },
  { n: 'Recurve Bow', out: 'recurve_bow', cnt: 1, cat: 'Weapons', c: { wood: 6, fiber: 5, boar_tusk: 2 }, req: 'workbench' },
  { n: 'Beastmaster Armor', out: 'beastmaster_armor', cnt: 1, cat: 'Armor', c: { leather: 5, alpha_pelt: 1 }, req: 'workbench' },

  // --- New Armor & Accessory Recipes ---
  { n: 'Leather Cap', out: 'leather_cap', cnt: 1, cat: 'Armor', c: { leather: 2 }, req: 'workbench' },
  { n: 'Iron Helmet', out: 'iron_helmet', cnt: 1, cat: 'Armor', c: { iron_bar: 3 }, req: 'workbench' },
  { n: 'Mithril Helmet', out: 'mithril_helmet', cnt: 1, cat: 'Armor', c: { mithril_bar: 4 }, req: 'workbench' },
  { n: 'Leather Pants', out: 'leather_trousers', cnt: 1, cat: 'Armor', c: { leather: 3, fiber: 2 }, req: 'workbench' },
  { n: 'Iron Greaves', out: 'iron_greaves', cnt: 1, cat: 'Armor', c: { iron_bar: 4 }, req: 'workbench' },
  { n: 'Mithril Greaves', out: 'mithril_greaves', cnt: 1, cat: 'Armor', c: { mithril_bar: 5 }, req: 'workbench' },
  { n: 'Leather Boots', out: 'leather_boots', cnt: 1, cat: 'Armor', c: { leather: 2, fiber: 1 }, req: 'workbench' },
  { n: 'Iron Boots', out: 'iron_boots', cnt: 1, cat: 'Armor', c: { iron_bar: 2 }, req: 'workbench' },
  { n: 'Mithril Boots', out: 'mithril_boots', cnt: 1, cat: 'Armor', c: { mithril_bar: 3 }, req: 'workbench' },
  { n: 'Vitality Ring', out: 'health_ring', cnt: 1, cat: 'Armor', c: { gold_bar: 2, crystal: 1 }, req: 'magic_altar' },
  { n: 'Stamina Ring', out: 'stamina_ring', cnt: 1, cat: 'Armor', c: { gold_bar: 2, feather: 2 }, req: 'magic_altar' },
  { n: 'Arcane Ring', out: 'mana_ring', cnt: 1, cat: 'Armor', c: { gold_bar: 2, mana_crystal: 1 }, req: 'magic_altar' },

  { n: 'Stick x2', out: 'stick', cnt: 2, cat: 'Materials', c: { wood: 1 } },
  { n: 'Iron Bar', out: 'iron_bar', cnt: 1, cat: 'Materials', c: { iron_ore: 2, coal: 1 }, req: 'forge' },
  { n: 'Steel Bar', out: 'steel_bar', cnt: 1, cat: 'Materials', c: { iron_bar: 2, coal: 2 }, req: 'forge' },
  { n: 'Copper Bar', out: 'copper_bar', cnt: 1, cat: 'Materials', c: { copper_ore: 2, coal: 1 }, req: 'forge' },
  { n: 'Gold Bar', out: 'gold_bar', cnt: 1, cat: 'Materials', c: { gold_ore: 2, coal: 1 }, req: 'forge' },
  { n: 'Mithril Bar', out: 'mithril_bar', cnt: 1, cat: 'Materials', c: { mithril_ore: 3, coal: 2 }, req: 'forge' },
  { n: 'Stone Axe', out: 'stone_axe', cnt: 1, cat: 'Weapons', c: { stone: 2, stick: 1 } },
  { n: 'Iron Sword', out: 'iron_sword', cnt: 1, cat: 'Weapons', c: { iron_bar: 3, stick: 1 }, req: 'workbench' },
  { n: 'Copper Sword', out: 'copper_sword', cnt: 1, cat: 'Weapons', c: { copper_bar: 3, stick: 1 }, req: 'workbench' },
  { n: 'Gold Sword', out: 'gold_sword', cnt: 1, cat: 'Weapons', c: { gold_bar: 3, stick: 1 }, req: 'workbench' },
  { n: 'Mithril Sword', out: 'mithril_sword', cnt: 1, cat: 'Weapons', c: { mithril_bar: 4, stick: 1 }, req: 'workbench' },
  { n: 'Shortbow', out: 'shortbow', cnt: 1, cat: 'Weapons', c: { wood: 3, fiber: 2 } },
  { n: 'Iron Chest', out: 'iron_chest', cnt: 1, cat: 'Armor', c: { iron_bar: 5 }, req: 'workbench' },
  { n: 'Copper Chestplate', out: 'copper_chest', cnt: 1, cat: 'Armor', c: { copper_bar: 5 }, req: 'workbench' },
  { n: 'Gold Chestplate', out: 'gold_chest', cnt: 1, cat: 'Armor', c: { gold_bar: 5 }, req: 'workbench' },
  { n: 'Mithril Chestplate', out: 'mithril_chest', cnt: 1, cat: 'Armor', c: { mithril_bar: 6 }, req: 'workbench' },
  { n: 'Leather Vest', out: 'leather_vest', cnt: 1, cat: 'Armor', c: { leather: 3, fiber: 2 } },
  { n: 'Magic Altar', out: 'magic_altar', cnt: 1, cat: 'Structures', c: { stone: 10, magic_essence: 5 } },
  { n: 'Mana Crystal', out: 'mana_crystal', cnt: 1, cat: 'Materials', c: { magic_essence: 3, crystal: 1 }, req: 'magic_altar' },
  { n: 'Fire Staff', out: 'fire_staff', cnt: 1, cat: 'Weapons', c: { stick: 2, crystal: 1, sulfur: 2 }, req: 'magic_altar' },
  { n: 'Ice Staff', out: 'ice_staff', cnt: 1, cat: 'Weapons', c: { stick: 2, crystal: 1, ice_crystal: 2 }, req: 'magic_altar' },
  { n: 'Heal Staff', out: 'heal_staff', cnt: 1, cat: 'Weapons', c: { stick: 2, magic_essence: 5, herb: 5 }, req: 'magic_altar' },
  { n: 'Void Staff', out: 'void_staff', cnt: 1, cat: 'Weapons', c: { stick: 2, void_crystal: 2, magic_essence: 10 }, req: 'magic_altar' },
  { n: 'Storm Staff', out: 'storm_staff', cnt: 1, cat: 'Weapons', c: { stick: 2, crystal: 3, magic_essence: 8 }, req: 'magic_altar' },
  { n: 'Earth Staff', out: 'earth_staff', cnt: 1, cat: 'Weapons', c: { stick: 2, stone: 10, magic_essence: 8 }, req: 'magic_altar' },
  { n: 'Cosmic Staff', out: 'cosmic_staff', cnt: 1, cat: 'Weapons', c: { stick: 2, void_crystal: 3, magic_essence: 15 }, req: 'magic_altar' },
  { n: 'Mithril Staff', out: 'mithril_staff', cnt: 1, cat: 'Weapons', c: { stick: 2, mithril_bar: 3, magic_essence: 12 }, req: 'magic_altar' },
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

const getProceduralBiomeForZone = (zc: number, zr: number, seed: number) => {
  if (zc === 0 && zr === 0) {
    return MAPS[0]; // Starting zone (0, 0): Verdant Forest (always safe)
  }
  // Simple robust seed-based hash function
  const h = Math.sin(zc * 17.13 + zr * 53.97 + seed * 0.19) * 43758.5453;
  const rand = h - Math.floor(h);
  
  // Choose index from 0 to MAPS.length - 1
  const idx = Math.floor(rand * MAPS.length);
  return MAPS[idx];
};

const getProceduralNoise = (x: number, y: number, seed: number) => {
  // Octave 1: Low frequency, high amplitude (main continent shape)
  const n1 = Math.sin(x * 0.02 + y * 0.015 + seed * 0.005) * 0.5 + 0.5;
  // Octave 2: Medium frequency (local hills and valleys)
  const n2 = Math.sin(x * 0.08 - y * 0.06 + seed * 0.013) * 0.25 + 0.25;
  // Octave 3: High frequency (detail texture)
  const n3 = Math.sin(x * 0.25 + y * 0.22 - seed * 0.021) * 0.12 + 0.12;
  
  return (n1 * 0.5 + n2 * 0.3 + n3 * 0.2);
};

const getProceduralTile = (wx: number, wy: number, M: any, seed: number) => {
  const n = getProceduralNoise(wx, wy, seed + M.s);
  
  if (n < 0.18) return M.w; // Water or Lava
  if (n < 0.25) return M.f; // Flat sand/dirt/coast
  if (n > 0.78) return M.r; // High rocky ridges
  return M.m; // Main biome ground
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

const spawnExplosion = (s: any, x: number, y: number, col: string, count: number = 10, type: string = 'pixel') => {
  if (!s || !s.parts) return;
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const spd = 1 + Math.random() * 4;
    s.parts.push({
      x,
      y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      life: 15 + Math.floor(Math.random() * 15),
      maxLife: 30,
      col,
      sz: 1.5 + Math.random() * 3,
      type
    });
  }
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
  const [invCategory, setInvCategory] = useState<'all' | 'weapon' | 'armor' | 'food' | 'mat'>('all');
  const [selectedInvItem, setSelectedInvItem] = useState<string | null>(null);
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

  // Collapse/Hide states for Left Panels to prevent screen clutter
  const [isStatusCollapsed, setIsStatusCollapsed] = useState(false);
  const [isEquipCollapsed, setIsEquipCollapsed] = useState(true); // default to true to keep screen clean!
  const [isAutoCollapsed, setIsAutoCollapsed] = useState(true); // default to true to keep screen clean!

  // --- Save / Load & Backup System States ---
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const [autosaveEnabled, setAutosaveEnabled] = useState(true);
  const autosaveEnabledRef = useRef(true);
  const [slots, setSlots] = useState<Record<string, any>>({});
  const [importString, setImportString] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  // --- Firebase Auth & Cloud Sync States ---
  const [user, setUser] = useState<any>(null);
  const [cloudSlots, setCloudSlots] = useState<Record<string, any>>({});
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);

  // Sync autosave ref with state
  useEffect(() => {
    autosaveEnabledRef.current = autosaveEnabled;
  }, [autosaveEnabled]);

  // --- Automation Cores States & Refs ---
  const [autoAttack, setAutoAttack] = useState(false);
  const [autoCollect, setAutoCollect] = useState(false);
  const [autoHarvest, setAutoHarvest] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);

  const autoAttackRef = useRef(false);
  const autoCollectRef = useRef(false);
  const autoHarvestRef = useRef(false);
  const autoPlayRef = useRef(false);
  const pausedRef = useRef(false);

  useEffect(() => { autoAttackRef.current = autoAttack; }, [autoAttack]);
  useEffect(() => { autoCollectRef.current = autoCollect; }, [autoCollect]);
  useEffect(() => { autoHarvestRef.current = autoHarvest; }, [autoHarvest]);
  useEffect(() => { autoPlayRef.current = autoPlay; }, [autoPlay]);

  // --- World Seed & Menu States ---
  const [showWorldMenu, setShowWorldMenu] = useState(false);
  const [worldSeed, setWorldSeed] = useState<number>(1337);
  const worldSeedRef = useRef(1337);
  useEffect(() => { worldSeedRef.current = worldSeed; }, [worldSeed]);

  // --- Auto-Craft Core States ---
  const [autoCraftState, setAutoCraftState] = useState(false);
  const autoCraftStateRef = useRef(false);
  useEffect(() => { autoCraftStateRef.current = autoCraftState; }, [autoCraftState]);

  // --- Collapsible Panel States ---
  const [isStatsCollapsed, setIsStatsCollapsed] = useState(false);
  const [isEquipmentCollapsed, setIsEquipmentCollapsed] = useState(false);
  const [isAutomationCollapsed, setIsAutomationCollapsed] = useState(false);

  const [autoCraftList, setAutoCraftList] = useState<Record<string, boolean>>({});
  const autoCraftListRef = useRef<Record<string, boolean>>({});
  useEffect(() => { autoCraftListRef.current = autoCraftList; }, [autoCraftList]);

  // --- World Event states ---
  const [showEventModal, setShowEventModal] = useState(false);
  const [narrativeEvent, setNarrativeEvent] = useState<any | null>(null);
  const [eventChoiceOutcome, setEventChoiceOutcome] = useState<string | null>(null);

  // --- Magic Spellbook States ---
  const [showSpellbook, setShowSpellbook] = useState(false);
  const [isCasting, setIsCasting] = useState(false);
  const [spellResult, setSpellResult] = useState<any>(null);
  const [fishingHotspotTx, setFishingHotspotTx] = useState<number | null>(null);
  const [fishingHotspotTy, setFishingHotspotTy] = useState<number | null>(null);

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
      s.pl.equip = { head: null, chest: null, legs: null, feet: null, ring: null, ...(data.pl.equip || {}) };
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
        alchemy: { lvl: 1, xp: 0, xpNext: 100 },
        hunting: { lvl: 1, xp: 0, xpNext: 100 }
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

  // --- Firebase Auth & Cloud Sync Callbacks ---
  const fetchCloudSaves = useCallback(async (userId: string) => {
    try {
      setIsCloudSyncing(true);
      const savesRef = collection(db, "users", userId, "saves");
      const querySnapshot = await getDocs(savesRef);
      const cloudData: Record<string, any> = {};
      querySnapshot.forEach((doc) => {
        try {
          const data = doc.data();
          if (data && data.saveData) {
            cloudData[doc.id] = JSON.parse(data.saveData);
          }
        } catch (e) {
          console.error("Failed to parse cloud save", doc.id, e);
        }
      });
      setCloudSlots(cloudData);
    } catch (err) {
      console.error("Failed to fetch cloud saves:", err);
      addLog("Failed to fetch cloud saves", "#f87171");
    } finally {
      setIsCloudSyncing(false);
    }
  }, []);

  useEffect(() => {
    testConnection();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        addLog(`Welcome back, ${currentUser.displayName || 'Survivor'}!`, '#60a5fa');
        // Ensure user document exists/updates in Firestore
        const userDocRef = doc(db, "users", currentUser.uid);
        setDoc(userDocRef, {
          uid: currentUser.uid,
          email: currentUser.email || "",
          displayName: currentUser.displayName || "Survivor",
          createdAt: new Date().toISOString()
        }, { merge: true }).catch(err => {
          console.error("Failed to sync user to Firestore", err);
        });

        fetchCloudSaves(currentUser.uid);
      } else {
        setCloudSlots({});
      }
    });
    return () => unsubscribe();
  }, [fetchCloudSaves]);

  const backupToCloud = useCallback(async (slotId: string) => {
    if (!auth.currentUser) {
      addLog("Please sign in to backup to cloud!", "#fbbf24");
      return;
    }

    const localSave = localStorage.getItem(`wild_survival_save_${slotId}`);
    if (!localSave) {
      addLog(`No local data in Slot ${slotId.toUpperCase()} to backup!`, "#f87171");
      return;
    }

    try {
      setIsCloudSyncing(true);
      const saveDocRef = doc(db, "users", auth.currentUser.uid, "saves", slotId);
      await setDoc(saveDocRef, {
        userId: auth.currentUser.uid,
        slotId: slotId,
        saveData: localSave,
        updatedAt: new Date().toISOString()
      });
      addLog(`Cloud backup successful for Slot ${slotId.toUpperCase()}!`, '#10b981');
      await fetchCloudSaves(auth.currentUser.uid);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${auth.currentUser.uid}/saves/${slotId}`);
      addLog("Cloud backup failed!", "#f87171");
    } finally {
      setIsCloudSyncing(false);
    }
  }, [fetchCloudSaves]);

  const restoreFromCloud = useCallback(async (slotId: string) => {
    if (!auth.currentUser) {
      addLog("Please sign in to restore from cloud!", "#fbbf24");
      return;
    }

    try {
      setIsCloudSyncing(true);
      const saveDocRef = doc(db, "users", auth.currentUser.uid, "saves", slotId);
      const docSnap = await getDoc(saveDocRef);
      if (!docSnap.exists()) {
        addLog(`No cloud backup found for Slot ${slotId.toUpperCase()}!`, "#f87171");
        return;
      }

      const cloudSaveStr = docSnap.data().saveData;
      const success = loadGameDataStr(cloudSaveStr);
      if (success) {
        localStorage.setItem(`wild_survival_save_${slotId}`, cloudSaveStr);
        loadSlotMetadata();
        addLog(`Restored Slot ${slotId.toUpperCase()} from cloud!`, '#34d399');
        setShowSaveMenu(false);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `users/${auth.currentUser.uid}/saves/${slotId}`);
      addLog("Cloud restore failed!", "#f87171");
    } finally {
      setIsCloudSyncing(false);
    }
  }, [loadGameDataStr, loadSlotMetadata]);

  const deleteCloudSave = useCallback(async (slotId: string) => {
    if (!auth.currentUser) return;
    try {
      setIsCloudSyncing(true);
      const saveDocRef = doc(db, "users", auth.currentUser.uid, "saves", slotId);
      await deleteDoc(saveDocRef);
      addLog(`Deleted Cloud Backup for Slot ${slotId.toUpperCase()}`, "#fca5a5");
      await fetchCloudSaves(auth.currentUser.uid);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${auth.currentUser.uid}/saves/${slotId}`);
      addLog("Failed to delete cloud backup!", "#f87171");
    } finally {
      setIsCloudSyncing(false);
    }
  }, [fetchCloudSaves]);

  const handleSignIn = async () => {
    try {
      setIsCloudSyncing(true);
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("Sign in failed:", err);
      addLog("Sign in failed!", "#f87171");
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setIsCloudSyncing(true);
      await signOut(auth);
      addLog("Signed out successfully", "#fca5a5");
    } catch (err) {
      console.error("Sign out failed:", err);
    } finally {
      setIsCloudSyncing(false);
    }
  };

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
      if (auth.currentUser) {
        backupToCloud('autosave');
      }
    } catch (err) {
      console.error("Autosave failed:", err);
    }
  }, [loadSlotMetadata, backupToCloud]);

  const stateRef = useRef<any>(null);
  const keysRef = useRef<Record<string, boolean>>({});
  const joyRef = useRef({ x: 0, y: 0, active: false });

  // Initialize Game Function
  const initGame = useCallback(() => {
    const initialPl = {
      x: Math.floor(ZW / 2) * TZ + TZ / 2,
      y: Math.floor(ZH / 2) * TZ + TZ / 2,
      targetX: Math.floor(ZW / 2) * TZ + TZ / 2,
      targetY: Math.floor(ZH / 2) * TZ + TZ / 2,
      isGridMoving: false,
      hp: 100, mhp: 100, hu: 100, sta: 100, mp: 100, mmp: 100,
      inv: {
        wood: 25, stone: 15, fiber: 15, herb: 8, berry: 10, torch: 2,
        stone_axe: 1, shortbow: 1, raw_meat: 5, cooked_meat: 3
      },
      equip: {
        head: 'leather_cap',
        chest: 'leather_vest',
        legs: 'leather_trousers',
        feet: 'leather_boots',
        ring: null
      },
      weapon: 'fists',
      hotbar: ['torch', 'campfire', 'workbench', 'forge', 'stone_axe', 'iron_sword', 'shortbow', 'fishing_rod'],
      spd: 3.2, sprint: false, atkcd: 0, gcd: 0, ifr: 0, xp: 0, lvl: 1, xpNext: 100, def: 12,
      skills: {
        fishing: { lvl: 1, xp: 0, xpNext: 100 },
        cooking: { lvl: 1, xp: 0, xpNext: 100 },
        mining: { lvl: 1, xp: 0, xpNext: 100 },
        woodcutting: { lvl: 1, xp: 0, xpNext: 100 },
        combat: { lvl: 1, xp: 0, xpNext: 100 },
        alchemy: { lvl: 1, xp: 0, xpNext: 100 },
        hunting: { lvl: 1, xp: 0, xpNext: 100 }
      }
    };

    const world: number[][] = [];
    const objs: any[] = [];
    
    const currentSeed = worldSeedRef.current;
    const zoneMaps: any[] = [];
    for (let zr = 0; zr < ZROWS; zr++) {
      for (let zc = 0; zc < ZCOLS; zc++) {
        zoneMaps.push(getProceduralBiomeForZone(zc, zr, currentSeed));
      }
    }

    // Generate World
    for (let zr = 0; zr < ZROWS; zr++) {
      for (let zc = 0; zc < ZCOLS; zc++) {
        const mi = zr * ZCOLS + zc;
        const M = zoneMaps[mi];
        const rng = mkRng(M.s + mi * 7919 + currentSeed);
        const ox = zc * ZW, oy = zr * ZH;

        for (let ly = 0; ly < ZH; ly++) {
          if (!world[oy + ly]) world[oy + ly] = [];
          for (let lx = 0; lx < ZW; lx++) {
            const wx = ox + lx, wy = oy + ly;
            world[wy][wx] = getProceduralTile(wx, wy, M, currentSeed);
            
            // Objects Placement
            if (lx > 2 && lx < ZW - 2 && ly > 2 && ly < ZH - 2) {
              const randVal = rng();
              const tileType = world[wy][wx];
              
              if (tileType === M.m || tileType === M.f) {
                // Spawn Trees based on Biome (4.5x Spawn Rate)
                if (randVal < M.wf * 4.5) {
                  let treeIco = '🌲';
                  let treeHp = 3;
                  let treeSubtype = 'oak';
                  
                  if (M.n.includes('Desert')) {
                    treeIco = '🌵';
                    treeSubtype = 'cactus';
                    treeHp = 2;
                  } else if (M.n.includes('Frozen') || M.n.includes('Tundra')) {
                    treeIco = '❄️';
                    treeSubtype = 'snowpine';
                    treeHp = 4;
                  } else if (M.n.includes('Swamp')) {
                    treeIco = '🌴';
                    treeSubtype = 'willow';
                    treeHp = 3;
                  } else if (M.n.includes('Scorched') || M.n.includes('Volcanic')) {
                    treeIco = '🪵';
                    treeSubtype = 'dead';
                    treeHp = 2;
                  } else if (M.n.includes('Enchanted')) {
                    treeIco = '🌸';
                    treeSubtype = 'blossom';
                    treeHp = 4;
                  } else if (M.n.includes('Celestial')) {
                    treeIco = '🌌';
                    treeSubtype = 'cosmic';
                    treeHp = 5;
                  } else {
                    treeIco = '🌳';
                    treeSubtype = 'birch';
                  }
                  
                  objs.push({ type: 'tree', tx: wx, ty: wy, hp: treeHp, mhp: treeHp, ico: treeIco, subtype: treeSubtype });
                }
              } else if (tileType === M.r || (tileType === M.m && randVal < M.rf * 2.0)) {
                // Spawn Rocks/Ores on high ridges (4.5x rate) or occasionally on main ground (2.0x rate)
                const isRidge = tileType === M.r;
                const spawnLimit = isRidge ? M.rf * 4.5 : M.rf * 2.0;
                
                if (randVal < spawnLimit) {
                  let rockIco = '🪨';
                  let rockHp = 4;
                  let rockSubtype = 'stone';
                  const oreRand = rng();
                  
                  // Rare chance for a magic Mana Crystal node to grow on Leylines
                  const isMagicBiome = M.n.includes('Crystal Cavern') || M.n.includes('Enchanted Grove') || M.n.includes('Celestial') || M.n.includes('Ancient Ruins');
                  const manaCrystalChance = isMagicBiome ? 0.15 : 0.04;
                  
                  if (rng() < manaCrystalChance) {
                    rockIco = '🧿';
                    rockSubtype = 'mana_crystal';
                    rockHp = 5;
                  } else if (M.n.includes('Celestial')) {
                    if (oreRand < 0.4) {
                      rockIco = '🔮';
                      rockSubtype = 'void_crystal';
                      rockHp = 6;
                    } else if (oreRand < 0.8) {
                      rockIco = '💎';
                      rockSubtype = 'crystal';
                      rockHp = 5;
                    } else {
                      rockIco = '✨';
                      rockSubtype = 'celestial';
                      rockHp = 8;
                    }
                  } else if (M.n.includes('Mountain') || M.n.includes('Ruins')) {
                    if (oreRand < 0.2) {
                      rockIco = '🪐';
                      rockSubtype = 'mithril';
                      rockHp = 8;
                    } else if (oreRand < 0.5) {
                      rockIco = '⚙️';
                      rockSubtype = 'iron';
                      rockHp = 5;
                    } else if (oreRand < 0.7) {
                      rockIco = '🪙';
                      rockSubtype = 'copper';
                      rockHp = 4;
                    } else if (oreRand < 0.9) {
                      rockIco = '🖤';
                      rockSubtype = 'coal';
                      rockHp = 4;
                    }
                  } else if (M.n.includes('Desert') || M.n.includes('Coastal')) {
                    if (oreRand < 0.3) {
                      rockIco = '💛';
                      rockSubtype = 'gold';
                      rockHp = 6;
                    } else if (oreRand < 0.6) {
                      rockIco = '🪙';
                      rockSubtype = 'copper';
                      rockHp = 4;
                    } else if (oreRand < 0.8) {
                      rockIco = '🟡';
                      rockSubtype = 'sulfur';
                      rockHp = 3;
                    }
                  } else if (M.n.includes('Volcanic') || M.n.includes('Scorched')) {
                    if (oreRand < 0.4) {
                      rockIco = '🟡';
                      rockSubtype = 'sulfur';
                      rockHp = 3;
                    } else if (oreRand < 0.8) {
                      rockIco = '🖤';
                      rockSubtype = 'coal';
                      rockHp = 4;
                    } else {
                      rockIco = '⚙️';
                      rockSubtype = 'iron';
                      rockHp = 5;
                    }
                  } else {
                    // Forest/Plains standard rock
                    if (oreRand < 0.2) {
                      rockIco = '🪙';
                      rockSubtype = 'copper';
                      rockHp = 4;
                    } else if (oreRand < 0.4) {
                      rockIco = '⚙️';
                      rockSubtype = 'iron';
                      rockHp = 5;
                    } else if (oreRand < 0.5) {
                      rockIco = '🖤';
                      rockSubtype = 'coal';
                      rockHp = 4;
                    }
                  }
                  
                  objs.push({ type: 'rock', tx: wx, ty: wy, hp: rockHp, mhp: rockHp, ico: rockIco, subtype: rockSubtype });
                }
              } else {
                // If it is a water or lava tile, spawn a Fishing Hotspot instead of land debris!
                if (tileType === TW || tileType === TLV) {
                  if (rng() < 0.045) { // 4.5% chance per water/lava tile
                    objs.push({
                      type: 'fishing_hotspot',
                      tx: wx,
                      ty: wy,
                      hp: 3 + Math.floor(rng() * 4), // 3 to 6 catches before depletion
                      ico: tileType === TLV ? '🌋' : '🐟',
                      subtype: tileType === TLV ? 'lava' : 'ocean'
                    });
                  }
                } else {
                  // Standard ground drops (3x Spawn Rate)
                  for (const [k, v] of Object.entries(M.dr)) {
                    if (rng() < (v as number) * 3.0) {
                      objs.push({ type: 'drop', tx: wx, ty: wy, item: k, qty: 1 + Math.floor(rng() * 2) });
                    }
                  }
                  // Occasionally spawn tracking clues / footprints on land
                  if (rng() < 0.02) {
                    objs.push({
                      type: 'animal_track',
                      tx: wx,
                      ty: wy,
                      hp: 1,
                      ico: '🐾',
                      subtype: 'track'
                    });
                  }
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
      cam: { x: initialPl.x - window.innerWidth / 2, y: initialPl.y - window.innerHeight / 2 },
      zoneMaps,
      worldSeed: currentSeed
    };

    stateRef.current = newState;
    setGameState(newState);
  }, []);

  // Initialize Game on Mount
  useEffect(() => {
    initGame();

    const handleKeyDown = (e: KeyboardEvent) => keysRef.current[e.key] = true;
    const handleKeyUp = (e: KeyboardEvent) => keysRef.current[e.key] = false;
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [initGame]);

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

        // Tick active magic spell durations
        if (s.activeSpells) {
          if (s.activeSpells.revealMapTimer > 0) {
            s.activeSpells.revealMapTimer--;
            if (s.activeSpells.revealMapTimer === 0) {
              s.activeScoutedNodes = [];
              addLog("🔮 The scrying ward fades... Scouted nodes have disappeared from your radar.", "#f472b6");
            }
          }
          if (s.activeSpells.healingSanctuaryTimer > 0) {
            s.activeSpells.healingSanctuaryTimer--;
            // Rejuvenate HP every second (60 ticks)
            if (s.activeSpells.healingSanctuaryTimer % 60 === 0 && s.pl.hp < s.pl.mhp) {
              s.pl.hp = Math.min(s.pl.mhp, s.pl.hp + 2);
              spawnExplosion(s, s.pl.x, s.pl.y, '#ec4899', 3, 'spark');
            }
            if (s.activeSpells.healingSanctuaryTimer === 0) {
              addLog("💖 The Healing Sanctuary aura fades.", "#f472b6");
            }
          }
        }

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

      // Neural Autoplay Intelligence Core
      if (autoPlayRef.current && dx === 0 && dy === 0 && !joyRef.current.active) {
        // Auto-healing if health is critical
        if (s.pl.hp < s.pl.mhp * 0.45) {
          const healItems = ['heal_potion', 'cooked_fish', 'celestial_fish', 'cooked_meat', 'berry', 'mushroom'];
          const availableHeal = healItems.find(item => s.pl.inv[item] > 0);
          if (availableHeal) {
            const itDef = IT[availableHeal];
            if (itDef.t === 'pot' || itDef.t === 'food') {
              if (itDef.hp) {
                s.pl.hp = Math.min(s.pl.mhp, s.pl.hp + itDef.hp);
                s.pl.inv[availableHeal]--;
                addLog(`🤖 Autoplay used ${itDef.n} (+${itDef.hp} HP)`, '#10b981');
                spawnExplosion(s, s.pl.x, s.pl.y, '#10b981', 15, 'spark');
              }
            }
          }
        }

        // Auto mana restore
        if (s.pl.mp < 20 && s.pl.inv['mana_potion'] > 0) {
          s.pl.mp = Math.min(s.pl.mmp, s.pl.mp + 50);
          s.pl.inv['mana_potion']--;
          addLog(`🤖 Autoplay used Mana Potion!`, '#06b6d4');
          spawnExplosion(s, s.pl.x, s.pl.y, '#06b6d4', 15, 'spark');
        }

        const px = Math.floor(s.pl.x / TZ);
        const py = Math.floor(s.pl.y / TZ);

        // Scan for nearest hostile targets
        let nearestEnemy: any = null;
        let minEnemyDist = Infinity;
        for (const e of s.enemies) {
          const d = dist(s.pl, e);
          if (d < minEnemyDist) {
            minEnemyDist = d;
            nearestEnemy = e;
          }
        }

        // Scan for nearest drops, resources
        let nearestNode: any = null;
        let minNodeDist = Infinity;
        for (const o of s.objs) {
          if (o.type === 'drop' || o.type === 'tree' || o.type === 'rock') {
            const d = Math.abs(o.tx - px) + Math.abs(o.ty - py);
            if (d < minNodeDist) {
              minNodeDist = d;
              nearestNode = o;
            }
          }
        }

        if (nearestEnemy && minEnemyDist < 350) {
          // Switch to best weapon in hotbar
          const weaponTier = ['void_staff', 'cosmic_staff', 'storm_staff', 'fire_staff', 'ice_staff', 'iron_sword', 'shortbow'];
          const bestWeapons = weaponTier.filter(w => s.pl.inv[w] > 0 || s.pl.hotbar.includes(w));
          if (bestWeapons.length > 0) {
            const bestW = bestWeapons[0];
            if (s.pl.weapon !== bestW) {
              s.pl.weapon = bestW;
            }
          }

          const wp = getWeaponStats(s, s.pl.weapon);
          const enemyTx = Math.floor(nearestEnemy.x / TZ);
          const enemyTy = Math.floor(nearestEnemy.y / TZ);

          if ((wp.type === 'magic' || wp.type === 'ranged') && minEnemyDist < wp.rng) {
            if (minEnemyDist < 80) {
              // Too close, kite backwards!
              if (px < enemyTx) dx = -1;
              else if (px > enemyTx) dx = 1;
              if (py < enemyTy) dy = -1;
              else if (py > enemyTy) dy = 1;
            } else {
              // Keep shooting/casting!
            }
          } else {
            // Chase down target
            if (px < enemyTx) dx = 1;
            else if (px > enemyTx) dx = -1;
            if (py < enemyTy) dy = 1;
            else if (py > enemyTy) dy = -1;
          }
        } else if (nearestNode) {
          const ntx = nearestNode.tx;
          const nty = nearestNode.ty;

          if (px < ntx) dx = 1;
          else if (px > ntx) dx = -1;
          if (py < nty) dy = 1;
          else if (py > nty) dy = -1;

          // If adjacent, handle auto chop/mine
          if (Math.abs(ntx - px) + Math.abs(nty - py) <= 2) {
            if (nearestNode.type === 'tree' || nearestNode.type === 'rock') {
              // Ensure we use axe if chopping
              if (nearestNode.type === 'tree' && s.pl.inv['stone_axe'] && s.pl.weapon !== 'stone_axe') {
                s.pl.weapon = 'stone_axe';
              }
              if (s.ticks % 25 === 0) {
                handleGather();
              }
            }
          }
        } else {
          // Passive wandering
          if (s.ticks % 100 === 0) {
            const dirs = [{x: 1, y: 0}, {x: -1, y: 0}, {x: 0, y: 1}, {x: 0, y: -1}];
            const rDir = dirs[Math.floor(Math.random() * dirs.length)];
            dx = rDir.x;
            dy = rDir.y;
          }
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
        if (s.activeSpells?.healingSanctuaryTimer > 0) {
          eventSpeedMult *= 1.25;
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
        if (e.flashTicks && e.flashTicks > 0) {
          e.flashTicks--;
        }

        const d = dist(e, s.pl);
        const spd = e.slowTicks > 0 ? e.spd * 0.5 : e.spd;

        let shouldChase = true;
        let shouldFlee = false;

        if (e.eid === 'deer' || e.eid === 'pheasant') {
          shouldChase = false;
          if (d < 180) {
            shouldFlee = true;
          }
        } else if (e.eid === 'boar') {
          // Boar is neutral, only chases if provoked (damaged)
          if (e.hp >= e.mhp) {
            shouldChase = false;
          }
        }

        if (shouldFlee) {
          // Run AWAY from player
          const ang = Math.atan2(e.y - s.pl.y, e.x - s.pl.x);
          const nx = e.x + Math.cos(ang) * (spd * 1.3); // Sprint away!
          const ny = e.y + Math.sin(ang) * (spd * 1.3);
          const etx = Math.floor(nx / TZ);
          const ety = Math.floor(ny / TZ);
          if (etx >= 0 && etx < WW && ety >= 0 && ety < WH && s.world[ety][etx] !== TW) {
            e.x = nx;
            e.y = ny;
          }
          if (s.ticks % 10 === 0) {
            s.parts.push({
              x: e.x, y: e.y + 4,
              vx: -Math.cos(ang) * 0.5, vy: -Math.sin(ang) * 0.5,
              life: 6, maxLife: 12, col: 'rgba(255,255,255,0.4)', sz: 1.5
            });
          }
        } else if (shouldChase && d < 400) {
          const ang = Math.atan2(s.pl.y - e.y, s.pl.x - e.x);
          if (d > 30) {
            const nx = e.x + Math.cos(ang) * spd;
            const ny = e.y + Math.sin(ang) * spd;
            const etx = Math.floor(nx / TZ);
            const ety = Math.floor(ny / TZ);
            if (etx >= 0 && etx < WW && ety >= 0 && ety < WH && s.world[ety][etx] !== TW) {
              e.x = nx;
              e.y = ny;
            }

            // Spawn gentle walk puff trails
            if (s.ticks % 20 === 0) {
              s.parts.push({
                x: e.x + (Math.random() - 0.5) * 8,
                y: e.y + 4,
                vx: -Math.cos(ang) * 0.3 + (Math.random() - 0.5) * 0.2,
                vy: -Math.sin(ang) * 0.3 + (Math.random() - 0.5) * 0.2,
                life: 8 + Math.floor(Math.random() * 8),
                maxLife: 16,
                col: s.world[ety]?.[etx] === TLV ? '#ff5500' : 'rgba(255, 255, 255, 0.2)',
                sz: 1 + Math.random() * 2
              });
            }
          }
        } else {
          // Idle wandering for passive/neutral animals or enemies far away
          if (!e.wanderAng) e.wanderAng = Math.random() * Math.PI * 2;
          if (s.ticks % 180 === 0) e.wanderAng = Math.random() * Math.PI * 2;
          
          const isMoving = (s.ticks % 300) < 180;
          if (isMoving) {
            const nx = e.x + Math.cos(e.wanderAng) * (spd * 0.4);
            const ny = e.y + Math.sin(e.wanderAng) * (spd * 0.4);
            const etx = Math.floor(nx / TZ);
            const ety = Math.floor(ny / TZ);
            if (etx >= 0 && etx < WW && ety >= 0 && ety < WH && s.world[ety][etx] !== TW && s.world[ety][etx] !== TLV) {
              e.x = nx;
              e.y = ny;
            }
          }
        }
          // Attack player
          if (d < 40 && e.cd <= 0 && s.pl.ifr <= 0) {
            let finalDef = s.pl.def;
            if (s.activeSpells?.healingSanctuaryTimer > 0) {
              finalDef += 5;
            }
            const dmg = Math.max(1, e.dmg - finalDef);
            s.pl.hp -= dmg;
            s.pl.ifr = 40;
            e.cd = e.acd;
            addLog(`Hit by ${ET[e.eid].n}! -${dmg} HP`, '#f44');
            if (s.pl.hp <= 0) {
              s.pl.hp = 0;
              setShowDeathScreen(true);
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

        // Spawn beautiful trailing particles
        if (s.ticks % 2 === 0) {
          s.parts.push({
            x: p.x + (Math.random() - 0.5) * 6,
            y: p.y + (Math.random() - 0.5) * 6,
            vx: -p.vx * 0.15 + (Math.random() - 0.5) * 0.8,
            vy: -p.vy * 0.15 + (Math.random() - 0.5) * 0.8,
            life: 8 + Math.floor(Math.random() * 8),
            maxLife: 16,
            col: p.col || '#ffaa44',
            sz: p.sz ? p.sz * 0.4 : 1.8
          });
        }

        if (p.dist > p.rng) {
          s.projs.splice(i, 1);
          continue;
        }
        // Hit enemies
        for (let j = s.enemies.length - 1; j >= 0; j--) {
          const e = s.enemies[j];
          if (dist(p, e) < 22) {
            e.hp -= p.dmg;
            e.flashTicks = 12; // Trigger red damage glow!

            if (p.vamp && p.vamp > 0) {
              const heal = Math.round(p.dmg * p.vamp);
              if (heal > 0) {
                s.pl.hp = Math.min(s.pl.mhp, s.pl.hp + heal);
                addLog(`🩸 Vampirism: +${heal} HP!`, '#ff3366');
              }
            }

            // Elemental Hit Reactions & Custom Magic
            if (p.fx === 'slow') {
              e.slowTicks = 180;
              spawnExplosion(s, p.x, p.y, '#00e5ff', 12, 'spark');
              spawnExplosion(s, p.x, p.y, '#ffffff', 6, 'pixel');
            } else if (p.fx === 'burn') {
              e.burnTicks = 300;
              spawnExplosion(s, p.x, p.y, '#ff4500', 14, 'pixel');
              spawnExplosion(s, p.x, p.y, '#ffea00', 8, 'spark');
            } else if (p.fx === 'void') {
              // Gravitational purple explosion
              spawnExplosion(s, p.x, p.y, '#7f00ff', 18, 'ring');
              spawnExplosion(s, p.x, p.y, '#d500f9', 10, 'spark');
              for (const other of s.enemies) {
                if (dist(e, other) < 100) {
                  other.hp -= p.dmg * 0.5;
                  other.flashTicks = 10;
                  spawnExplosion(s, other.x, other.y, '#7f00ff', 4, 'pixel');
                }
              }
            } else if (p.fx === 'lightning') {
              // Electric Sparks
              spawnExplosion(s, p.x, p.y, '#00ffff', 15, 'spark');
              // Chain to an adjacent enemy
              const chainTargets = s.enemies.filter((other: any) => other !== e && dist(e, other) < 130);
              if (chainTargets.length > 0) {
                const targetEnemy = chainTargets[Math.floor(Math.random() * chainTargets.length)];
                targetEnemy.hp -= Math.round(p.dmg * 0.7);
                targetEnemy.flashTicks = 12;
                spawnExplosion(s, targetEnemy.x, targetEnemy.y, '#00ffff', 8, 'spark');
                // Create spectacular lightning bolt bridge particles
                for (let k = 0; k <= 12; k++) {
                  const t = k / 12;
                  const lx = e.x + (targetEnemy.x - e.x) * t + (Math.random() - 0.5) * 8;
                  const ly = e.y + (targetEnemy.y - e.y) * t + (Math.random() - 0.5) * 8;
                  s.parts.push({ x: lx, y: ly, vx: 0, vy: 0, life: 12, maxLife: 12, col: '#00ffff', sz: 2 });
                }
                addLog("⚡ Chain Lightning: Cascaded to secondary target!", '#00ffff');
              }
            } else if (p.fx === 'earthquake') {
              // Shockwave ring and screen shake vibe
              spawnExplosion(s, p.x, p.y, '#e28743', 14, 'pixel');
              s.parts.push({
                x: p.x, y: p.y, vx: 0, vy: 0,
                life: 18, maxLife: 18,
                col: 'rgba(226, 135, 67, 0.4)',
                sz: 1.5, type: 'ring'
              });
              // Stun and damage surrounding enemies
              for (const other of s.enemies) {
                if (dist(e, other) < 90) {
                  other.hp -= Math.round(p.dmg * 0.4);
                  other.slowTicks = 140; // Heavy slowness / stun
                  other.flashTicks = 8;
                }
              }
            } else if (p.fx === 'starfall') {
              // Cosmic purple/pink shower
              spawnExplosion(s, p.x, p.y, '#ff00ff', 22, 'spark');
              spawnExplosion(s, p.x, p.y, '#00ffff', 12, 'pixel');
              // Stars shower from heaven
              for (let k = 0; k < 3; k++) {
                const rx = p.x + (Math.random() - 0.5) * 80;
                const ry = p.y - 120 - Math.random() * 40;
                s.projs.push({
                  x: rx, y: ry,
                  vx: (p.x - rx) / 18 + (Math.random() - 0.5) * 1.5,
                  vy: (p.y - ry) / 18,
                  dmg: Math.round(p.dmg * 0.45), rng: 160, dist: 0,
                  col: '#ff00ff', fx: 'none', vamp: 0, sz: 3
                });
              }
            } else {
              // Default impact particles
              spawnExplosion(s, p.x, p.y, p.col || '#ffd700', 8, 'pixel');
            }

            s.projs.splice(i, 1);
            if (e.hp <= 0) {
              handleEnemyKilled(s, e);
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

      if (autoCraftStateRef.current && s.ticks % 45 === 0) {
        const pTileX = Math.floor(s.pl.x / TZ);
        const pTileY = Math.floor(s.pl.y / TZ);
        
        for (let i = 0; i < recipes.length; i++) {
          const r = recipes[i];
          if (!autoCraftListRef.current[r.out]) continue;
          
          // Check structure requirement
          let isNear = true;
          if (r.req) {
            isNear = s.objs.some((o: any) => o.type === r.req && Math.abs(o.tx - pTileX) <= 3 && Math.abs(o.ty - pTileY) <= 3);
          }
          if (!isNear) continue;
          
          // Check costs
          let hasResources = true;
          for (const [k, v] of Object.entries(r.c)) {
            if ((s.pl.inv[k] || 0) < (v as number)) {
              hasResources = false;
              break;
            }
          }
          if (!hasResources) continue;
          
          // Craft!
          craft(i, 1);
          break; // Process one craft per tick check to keep performance lean
        }
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

      // Update Particles
      for (let i = s.parts.length - 1; i >= 0; i--) {
        const pt = s.parts[i];
        pt.x += pt.vx || 0;
        pt.y += pt.vy || 0;
        pt.life--;
        if (pt.life <= 0) {
          s.parts.splice(i, 1);
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
        else if (o.type === 'fishing_hotspot') {
          ico = o.ico;
          // Bubbling ripple effect
          const rippleRadius = (TZ * 0.5) + Math.abs(Math.sin(s.ticks * 0.05)) * (TZ * 0.4);
          ctx.save();
          ctx.strokeStyle = o.subtype === 'lava' ? 'rgba(239, 68, 68, 0.6)' : 'rgba(56, 189, 248, 0.6)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(ox, oy, rippleRadius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        } else if (o.type === 'animal_track') {
          ico = o.ico;
          // Soft tracking sense indicator glow
          const glowRad = (TZ * 0.4) + Math.abs(Math.sin(s.ticks * 0.07)) * (TZ * 0.2);
          ctx.save();
          ctx.strokeStyle = 'rgba(236, 72, 153, 0.5)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(ox, oy, glowRad, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        } else if (o.type === 'campfire') {
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

      // Draw Scouted Nodes on Radar (Reveal Map active)
      if (s.activeScoutedNodes && s.activeScoutedNodes.length > 0) {
        for (const sn of s.activeScoutedNodes) {
          const sx = sn.tx * TZ + TZ / 2 - s.cam.x;
          const sy = sn.ty * TZ + TZ / 2 - s.cam.y;
          
          if (sx < -TZ || sx > ctx.canvas.width + TZ || sy < -TZ || sy > ctx.canvas.height + TZ) continue;

          // Drawing pulse wave
          const size = TZ * 0.75 + Math.sin(s.ticks * 0.12) * 6;
          ctx.save();
          ctx.strokeStyle = '#d946ef';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(sx, sy, size, 0, Math.PI * 2);
          ctx.stroke();

          // Draw neon scrying circle
          ctx.strokeStyle = 'rgba(217, 70, 239, 0.4)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(sx, sy, TZ * 1.5, 0, Math.PI * 2);
          ctx.stroke();

          // Inner pin-point
          ctx.fillStyle = '#f43f5e';
          ctx.beginPath();
          ctx.arc(sx, sy, 4, 0, Math.PI * 2);
          ctx.fill();

          // Label
          ctx.font = 'bold 9px monospace';
          ctx.fillStyle = '#fdf2f8';
          ctx.textAlign = 'center';
          ctx.fillText(IT[sn.type]?.ico || '📍', sx, sy - 14);
          ctx.fillText(IT[sn.type]?.n || sn.type, sx, sy + 18);
          ctx.restore();
        }
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

        // Beautiful Bobbing and Squish-Stretch Animations
        const bob = Math.sin(s.ticks * 0.12 + e.id * 1.5) * 4;
        const squishX = 1 + Math.sin(s.ticks * 0.16 + e.id) * 0.06;
        const squishY = 1 - Math.sin(s.ticks * 0.16 + e.id) * 0.06;

        ctx.save();
        ctx.translate(ex, ey + bob);
        ctx.scale(squishX, squishY);

        // Flash red glow when hit!
        if (e.flashTicks && e.flashTicks > 0) {
          ctx.shadowColor = '#ff3333';
          ctx.shadowBlur = 18;
          ctx.fillStyle = 'rgba(255, 51, 51, 0.4)';
          ctx.beginPath();
          ctx.arc(0, -TZ/3, TZ/2, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.font = `${TZ}px serif`;
        ctx.textAlign = 'center';
        ctx.fillText(ET[e.eid].ico, 0, 0);
        ctx.restore();

        // Health bar
        ctx.fillStyle = '#1e1e24';
        ctx.fillRect(ex - 15, ey - 25 + bob, 30, 4);
        ctx.fillStyle = '#ff4757';
        ctx.fillRect(ex - 15, ey - 25 + bob, 30 * (e.hp / e.mhp), 4);

        // Render Active Status Effects above head
        let statusStr = '';
        if (e.slowTicks > 0) statusStr += '🧊';
        if (e.burnTicks > 0) statusStr += '🔥';
        if (statusStr) {
          ctx.font = '11px serif';
          ctx.textAlign = 'center';
          ctx.fillText(statusStr, ex, ey - 32 + bob);
        }
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
        ctx.fillStyle = p.col || '#ffaa44';
        ctx.shadowColor = p.col || '#ffaa44';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(p.x - s.cam.x, p.y - s.cam.y, p.sz || 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0; // Reset
      }

      // Draw Beautiful Visual Particles
      for (const pt of s.parts) {
        const px = pt.x - s.cam.x;
        const py = pt.y - s.cam.y;
        if (px < -40 || px > ctx.canvas.width + 40 || py < -40 || py > ctx.canvas.height + 40) continue;
        
        ctx.save();
        ctx.fillStyle = pt.col || '#fff';
        ctx.globalAlpha = Math.max(0, Math.min(1, pt.life / (pt.maxLife || 30)));
        
        ctx.beginPath();
        if (pt.type === 'ring') {
          ctx.strokeStyle = pt.col || '#fff';
          ctx.lineWidth = pt.sz || 2;
          ctx.arc(px, py, (pt.maxLife - pt.life) * 2.2, 0, Math.PI * 2);
          ctx.stroke();
        } else if (pt.type === 'spark') {
          // Cross-shaped magic stars
          const r = pt.sz || 3;
          ctx.moveTo(px - r * 1.5, py);
          ctx.lineTo(px + r * 1.5, py);
          ctx.moveTo(px, py - r * 1.5);
          ctx.lineTo(px, py + r * 1.5);
          ctx.strokeStyle = pt.col || '#fff';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else {
          // Standard pixel/circle debris
          ctx.arc(px, py, pt.sz || 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
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
          e.flashTicks = 10;
          spawnExplosion(s, e.x, e.y, '#f53b57', 12, 'pixel'); // Spectacular hit blood splash!
          if (wp.vamp && wp.vamp > 0) {
            const heal = Math.round(finalDmg * wp.vamp);
            if (heal > 0) {
              s.pl.hp = Math.min(s.pl.mhp, s.pl.hp + heal);
              addLog(`🩸 Vampirism: +${heal} HP!`, '#ff3366');
            }
          }
          if (e.hp <= 0) {
            handleEnemyKilled(s, e);
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

    if (it.t === 'food' || it.t === 'pot' || k === 'mana_crystal') {
      if (k === 'mana_crystal') {
        s.pl.mp = Math.min(s.pl.mmp, s.pl.mp + 40);
        s.pl.inv[k]--;
        addLog(`Used Mana Crystal: restored 40 MP 🔮`, '#c084fc');
      } else {
        if (it.hp) s.pl.hp = Math.min(s.pl.mhp, s.pl.hp + it.hp);
        if (it.hu) s.pl.hu = Math.min(100, (s.pl.hu || 0) + it.hu);
        if (it.mp) s.pl.mp = Math.min(s.pl.mmp, s.pl.mp + it.mp);
        s.pl.inv[k]--;
        addLog(`Used ${it.n}`, '#00ffaa');
      }
    } else if (it.t === 'armor') {
      const slot = it.sl || 'chest';
      
      // Revert previous item in slot if exists
      const oldKey = s.pl.equip[slot];
      if (oldKey) {
        const oldItem = IT[oldKey];
        if (oldItem) {
          s.pl.inv[oldKey] = (s.pl.inv[oldKey] || 0) + 1;
          if (oldItem.def) s.pl.def = Math.max(0, (s.pl.def || 0) - oldItem.def);
          if (oldItem.hpBonus) {
            s.pl.mhp = Math.max(10, s.pl.mhp - oldItem.hpBonus);
            s.pl.hp = Math.min(s.pl.mhp, s.pl.hp);
          }
          if (oldItem.mpBonus) {
            s.pl.mmp = Math.max(10, s.pl.mmp - oldItem.mpBonus);
            s.pl.mp = Math.min(s.pl.mmp, s.pl.mp);
          }
          if (oldItem.spdBonus) {
            s.pl.spd = Math.max(1.0, s.pl.spd - oldItem.spdBonus);
          }
        }
      }
      
      // Equip new item
      s.pl.equip[slot] = k;
      s.pl.inv[k]--;
      
      // Apply new item's stat modifiers
      if (it.def) s.pl.def = (s.pl.def || 0) + it.def;
      if (it.hpBonus) {
        s.pl.mhp += it.hpBonus;
        s.pl.hp = Math.min(s.pl.mhp, s.pl.hp + it.hpBonus);
      }
      if (it.mpBonus) {
        s.pl.mmp += it.mpBonus;
        s.pl.mp = Math.min(s.pl.mmp, s.pl.mp + it.mpBonus);
      }
      if (it.spdBonus) {
        s.pl.spd += it.spdBonus;
      }
      
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
    
    // Refresh React state instantly
    setGameState({ ...s });
  };

  const handleUnequip = (slot: string) => {
    const s = stateRef.current;
    if (!s || !s.pl || !s.pl.equip) return;
    const oldKey = s.pl.equip[slot];
    if (!oldKey) return;

    const oldItem = IT[oldKey];
    if (oldItem) {
      // Return to inventory
      s.pl.inv[oldKey] = (s.pl.inv[oldKey] || 0) + 1;
      
      // Revert stat modifiers
      if (oldItem.def) s.pl.def = Math.max(0, (s.pl.def || 0) - oldItem.def);
      if (oldItem.hpBonus) {
        s.pl.mhp = Math.max(10, s.pl.mhp - oldItem.hpBonus);
        s.pl.hp = Math.min(s.pl.mhp, s.pl.hp);
      }
      if (oldItem.mpBonus) {
        s.pl.mmp = Math.max(10, s.pl.mmp - oldItem.mpBonus);
        s.pl.mp = Math.min(s.pl.mmp, s.pl.mp);
      }
      if (oldItem.spdBonus) {
        s.pl.spd = Math.max(1.0, s.pl.spd - oldItem.spdBonus);
      }
      
      addLog(`Unequipped ${oldItem.n}`, '#94a3b8');
    }
    
    s.pl.equip[slot] = null;
    setGameState({ ...s });
  };

  const assignToHotbar = (itemKey: string, index: number) => {
    const s = stateRef.current;
    if (!s || !s.pl) return;
    s.pl.hotbar[index] = itemKey;
    setGameState({ ...s });
    addLog(`Assigned ${IT[itemKey]?.n || itemKey} to Hotbar Slot ${index + 1}`, '#10b981');
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
        alchemy: { lvl: 1, xp: 0, xpNext: 100 },
        hunting: { lvl: 1, xp: 0, xpNext: 100 }
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

  const handleEnemyKilled = (s: any, e: any) => {
    const et = ET[e.eid];
    if (!et) return;

    // 1. Give character general XP
    s.pl.xp += et.xp;
    addLog(`Killed ${et.n}! +${et.xp} XP`, '#ffd700');

    // 2. Give Combat XP
    addSkillXPDirect(s, 'combat', Math.ceil(et.xp * 0.5));

    // 3. Check if huntable
    const huntableList = ['wolf', 'fox', 'bear', 'deer', 'boar', 'pheasant', 'alpha_wolf'];
    const isHuntable = huntableList.includes(e.eid);
    const huntingLvl = s.pl.skills?.hunting?.lvl || 1;
    
    let yieldMult = 1.0;
    if (isHuntable) {
      // 8% yield bonus per level
      yieldMult = 1.0 + (huntingLvl - 1) * 0.08;
      // Award Hunting XP
      const huntXP = et.xp;
      addSkillXPDirect(s, 'hunting', huntXP);
    }

    // 4. Loot Drop Calculation
    if (et.lo) {
      const etx = Math.floor(e.x / TZ);
      const ety = Math.floor(e.y / TZ);

      Object.entries(et.lo).forEach(([itemKey, chance]: [string, any]) => {
        // Roll for drop chance (scale chance by 5% per hunting level for huntable targets)
        const modifiedChance = isHuntable ? chance * (1 + (huntingLvl - 1) * 0.05) : chance;
        if (Math.random() <= modifiedChance) {
          let qty = 1;
          if (isHuntable && (itemKey === 'meat' || itemKey === 'leather' || itemKey === 'feather')) {
            qty = Math.max(1, Math.round((1 + Math.random() * 1) * yieldMult));
          } else {
            // Chance for extra rare drops at higher hunting levels
            if (isHuntable && Math.random() < (huntingLvl - 1) * 0.03) {
              qty++;
            }
          }

          if (etx >= 0 && etx < WW && ety >= 0 && ety < WH) {
            s.objs.push({
              type: 'drop',
              tx: etx,
              ty: ety,
              item: itemKey,
              qty: qty
            });
            // Little burst of stars
            spawnExplosion(s, e.x, e.y, '#ffd700', 4, 'spark');
          }
        }
      });
    }
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

            // Biome-specific custom tree drops
            if (o.subtype === 'cactus') {
              if (Math.random() < 0.6) {
                const qty = 1 + Math.floor(Math.random() * 2);
                s.pl.inv.cactus_fruit = (s.pl.inv.cactus_fruit || 0) + qty;
                addLog(`+Cactus Fruit x${qty}! 🌵`, '#eab308');
              }
            } else if (o.subtype === 'snowpine') {
              if (Math.random() < 0.6) {
                const qty = 1 + Math.floor(Math.random() * 2);
                s.pl.inv.snowberry = (s.pl.inv.snowberry || 0) + qty;
                addLog(`+Snowberry x${qty}! ❄️`, '#38bdf8');
              }
            } else if (o.subtype === 'blossom') {
              if (Math.random() < 0.6) {
                s.pl.inv.astral_flower = (s.pl.inv.astral_flower || 0) + 1;
                addLog(`+Astral Flower x1! 🌸`, '#f472b6');
              }
            } else if (o.subtype === 'cosmic') {
              if (Math.random() < 0.4) {
                s.pl.inv.void_crystal = (s.pl.inv.void_crystal || 0) + 1;
                addLog(`+Void Crystal x1! 🔮`, '#a855f7');
              }
              if (Math.random() < 0.5) {
                const qty = 1 + Math.floor(Math.random() * 2);
                s.pl.inv.magic_essence = (s.pl.inv.magic_essence || 0) + qty;
                addLog(`+Magic Essence x${qty}! ✨`, '#22d3ee');
              }
            }

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
          } else addLog(`Chopping ${o.subtype || 'tree'}... ${o.hp} left`, '#ffe88a');
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

            // Biome-specific custom rock drops
            if (o.subtype === 'copper') {
              const qty = 1 + Math.floor(Math.random() * 2) + Math.floor(mineLvl * 0.3);
              s.pl.inv.copper_ore = (s.pl.inv.copper_ore || 0) + qty;
              addLog(`+Copper Ore x${qty}! 🪙`, '#fb923c');
            } else if (o.subtype === 'iron') {
              const qty = 1 + Math.floor(Math.random() * 2) + Math.floor(mineLvl * 0.3);
              s.pl.inv.iron_ore = (s.pl.inv.iron_ore || 0) + qty;
              addLog(`+Iron Ore x${qty}! ⚙️`, '#818cf8');
            } else if (o.subtype === 'coal') {
              const qty = 1 + Math.floor(Math.random() * 2) + Math.floor(mineLvl * 0.3);
              s.pl.inv.coal = (s.pl.inv.coal || 0) + qty;
              addLog(`+Coal x${qty}! 🖤`, '#4b5563');
            } else if (o.subtype === 'gold') {
              const qty = 1 + Math.floor(Math.random() * 2) + Math.floor(mineLvl * 0.2);
              s.pl.inv.gold_ore = (s.pl.inv.gold_ore || 0) + qty;
              addLog(`+Gold Ore x${qty}! ⭐`, '#facc15');
            } else if (o.subtype === 'mithril') {
              const qty = 1 + Math.floor(Math.random() * 1) + Math.floor(mineLvl * 0.15);
              s.pl.inv.mithril_ore = (s.pl.inv.mithril_ore || 0) + qty;
              addLog(`+Mithril Ore x${qty}! 🪐`, '#22d3ee');
            } else if (o.subtype === 'sulfur') {
              const qty = 1 + Math.floor(Math.random() * 2) + Math.floor(mineLvl * 0.2);
              s.pl.inv.sulfur = (s.pl.inv.sulfur || 0) + qty;
              addLog(`+Sulfur x${qty}! 🟡`, '#facc15');
            } else if (o.subtype === 'mana_crystal') {
              const qty = 1 + Math.floor(Math.random() * 2);
              s.pl.inv.mana_crystal = (s.pl.inv.mana_crystal || 0) + qty;
              addLog(`+Mana Crystal x${qty}! 🧿`, '#a78bfa');
            } else if (o.subtype === 'crystal') {
              const qty = 1 + Math.floor(Math.random() * 2);
              s.pl.inv.crystal = (s.pl.inv.crystal || 0) + qty;
              addLog(`+Crystal x${qty}! 💎`, '#38bdf8');
              if (Math.random() < 0.4) {
                s.pl.inv.mana_crystal = (s.pl.inv.mana_crystal || 0) + 1;
                addLog(`+Mana Crystal x1! 🧿`, '#a78bfa');
              }
            } else if (o.subtype === 'void_crystal') {
              const qty = 1 + Math.floor(Math.random() * 1);
              s.pl.inv.void_crystal = (s.pl.inv.void_crystal || 0) + qty;
              addLog(`+Void Crystal x${qty}! 🔮`, '#c084fc');
              if (Math.random() < 0.5) {
                s.pl.inv.mana_crystal = (s.pl.inv.mana_crystal || 0) + 1;
                addLog(`+Mana Crystal x1! 🧿`, '#a78bfa');
              }
            } else if (o.subtype === 'celestial') {
              s.pl.inv.celestial_shard = (s.pl.inv.celestial_shard || 0) + 1;
              addLog(`+Celestial Shard x1! ✨`, '#67e8f9');
              if (Math.random() < 0.3) {
                s.pl.inv.gem = (s.pl.inv.gem || 0) + 1;
                addLog(`💎 Stellar Gem discovered!`, '#ec4899');
              }
            } else {
              // Standard Rock drops
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
            }

            gainSkillXP('mining', 15);
          } else addLog(`Mining ${o.subtype || 'rock'}... ${o.hp} left`, '#ffe88a');
          return;
        }
        if (o.type === 'animal_track') {
          s.objs.splice(i, 1);
          const huntLvl = s.pl.skills?.hunting?.lvl || 1;
          const xp = 15 + huntLvl * 2;

          const trackerMessages = [
            "🐾 Fresh tracks! A wild deer was sprinting south-west through the brush.",
            "🐾 Large, deep claw marks. An old forest bear was searching for honey nearby.",
            "🐾 Narrow claw marks. A quick wild pheasant was scratching for seeds.",
            "🐾 Heavy, wallowing indentations. A sturdy boar passed by here recently."
          ];
          const msg = trackerMessages[Math.floor(Math.random() * trackerMessages.length)];
          addLog(msg, '#f472b6');
          addSkillXPDirect(s, 'hunting', xp);

          // Spark particle effect at track location
          spawnExplosion(s, o.tx * TZ + TZ / 2, o.ty * TZ + TZ / 2, '#f472b6', 10, 'spark');

          // Highlight nearby wild animals (if any) with a glowing particle trail!
          let foundCount = 0;
          for (const e of s.enemies) {
            if (dist(s.pl, e) < 500) {
              const et = ET[e.eid];
              if (et && ['deer', 'boar', 'pheasant', 'wolf', 'fox', 'bear'].includes(e.eid)) {
                foundCount++;
                const steps = 15;
                for (let k = 0; k < steps; k++) {
                  const ratio = k / steps;
                  s.parts.push({
                    x: s.pl.x + (e.x - s.pl.x) * ratio,
                    y: s.pl.y + (e.y - s.pl.y) * ratio,
                    vx: (Math.random() - 0.5) * 0.2,
                    vy: (Math.random() - 0.5) * 0.2,
                    life: 20 + k,
                    maxLife: 40,
                    col: '#ec4899',
                    sz: 1.2
                  });
                }
              }
            }
          }
          if (foundCount > 0) {
            addLog(`🔍 Tracking Senses: Located ${foundCount} wild animal signature(s) nearby!`, '#ec4899');
          }
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

  const handleCastSpell = async (spellName: string, manaCost: number, paymentType: 'mp' | 'crystals' = 'mp') => {
    const s = stateRef.current;
    if (!s) return;

    const crystalCost = spellName === "Heal" ? 1 : spellName === "Reveal Map" ? 2 : spellName === "Healing Sanctuary" ? 2 : 3;

    if (paymentType === 'crystals') {
      const currentCrystals = s.pl.inv.mana_crystal || 0;
      if (currentCrystals < crystalCost) {
        addLog(`❌ You need ${crystalCost} Mana Crystal(s) to cast this spell!`, "#ef4444");
        return;
      }
      s.pl.inv.mana_crystal -= crystalCost;
      setGameState({ ...s });
      addLog(`✨ Channelling spell: "${spellName}" (${crystalCost} Mana Crystal(s) spent)...`, "#c084fc");
    } else {
      if (s.pl.mp < manaCost) {
        addLog("❌ You do not have enough Mana to cast this spell!", "#ef4444");
        return;
      }
      // Spend Mana immediately
      s.pl.mp -= manaCost;
      setGameState({ ...s });
      addLog(`✨ Channelling spell: "${spellName}" (${manaCost} MP spent)...`, "#c084fc");
    }

    setIsCasting(true);
    setSpellResult(null);

    // Get current biome name
    const zc = Math.floor((s.pl.x / TZ) / ZW);
    const zr = Math.floor((s.pl.y / TZ) / ZH);
    const currentBiome = getProceduralBiomeForZone(zc, zr, s.worldSeed);
    const mapName = currentBiome?.n || "Unknown Region";

    // Call Gemini API to cast the spell
    const result = await castSpell(spellName, {
      pl: {
        lvl: s.pl.lvl,
        x: s.pl.x,
        y: s.pl.y,
        inv: s.pl.inv
      },
      currentBiome: currentBiome,
      mapName
    });

    setIsCasting(false);

    if (result && result.success !== false) {
      setSpellResult(result);
      addLog(`✨ Spell Success: ${spellName}!`, "#c084fc");

      // Initialize active spells object if not present
      s.activeSpells = s.activeSpells || { revealMapTimer: 0, healingSanctuaryTimer: 0 };

      // Apply mechanical effects
      if (spellName === "Reveal Map") {
        // Unlocks active sensory scrying
        s.activeSpells.revealMapTimer = 7200; // 2 minutes @ 60fps
        s.activeScoutedNodes = result.scoutedNodes || [];

        // Log the coordinates of scouted nodes
        if (result.scoutedNodes && result.scoutedNodes.length > 0) {
          result.scoutedNodes.forEach((node: any) => {
            const itemDef = IT[node.type];
            addLog(`📍 Radar detected: ${itemDef?.n || node.type} at Tile (${node.tx}, ${node.ty})`, "#38bdf8");
          });
        }
      } else if (spellName === "Heal") {
        const heal = result.restoration?.healHP || 40;
        s.pl.hp = Math.min(s.pl.mhp, s.pl.hp + heal);
        spawnExplosion(s, s.pl.x, s.pl.y, "#22c55e", 20, "spark");
        addLog(`💚 Casted Heal Spell! Restored ${heal} HP.`, "#22c55e");
      } else if (spellName === "Resource Bounty") {
        // Spawn drops around the player
        if (result.spawnDrops && result.spawnDrops.length > 0) {
          result.spawnDrops.forEach((drop: any) => {
            const px = Math.floor(s.pl.x / TZ);
            const py = Math.floor(s.pl.y / TZ);
            const tx = px + drop.dx;
            const ty = py + drop.dy;
            if (tx >= 0 && tx < WW && ty >= 0 && ty < WH) {
              if (s.world[ty][tx] !== TW) {
                s.objs.push({
                  type: 'drop',
                  tx: tx,
                  ty: ty,
                  item: drop.item,
                  qty: drop.qty
                });
                // Spawn small particle explosion
                spawnExplosion(s, tx * TZ + TZ/2, ty * TZ + TZ/2, "#38bdf8", 5, "spark");
              }
            }
          });
          addLog("✨ Ground is showered with cosmic resource drops!", "#ccffaa");
        }
      } else if (spellName === "Healing Sanctuary") {
        // Restore health and hunger
        const heal = result.restoration?.healHP || 50;
        const food = result.restoration?.foodBonus || 20;
        s.pl.hp = Math.min(s.pl.mhp, s.pl.hp + heal);
        s.pl.hu = Math.min(100, s.pl.hu + food);

        // Apply active stat mender buff
        s.activeSpells.healingSanctuaryTimer = 2700; // 45 seconds @ 60fps

        spawnExplosion(s, s.pl.x, s.pl.y, "#ec4899", 25, "spark");
        addLog(`💖 Rejuvenated (+${heal} HP, +${food}% Satiety)`, "#f43f5e");
      }

      setGameState({ ...s });
    } else {
      // Refund resources if spell failed completely
      if (paymentType === 'crystals') {
        s.pl.inv.mana_crystal = (s.pl.inv.mana_crystal || 0) + crystalCost;
      } else {
        s.pl.mp = Math.min(s.pl.mmp, s.pl.mp + manaCost);
      }
      setGameState({ ...s });
      addLog(`❌ Spell Casting Failed: ${result?.message || "Leyline disruption."}. Resources refunded.`, "#ef4444");
    }
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
    let lavaWater = false;
    
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const tx = px + dx;
        const ty = py + dy;
        if (ty >= 0 && ty < s.world.length && tx >= 0 && tx < s.world[ty].length) {
          if (s.world[ty][tx] === TW || s.world[ty][tx] === TLV) {
            nearWater = true;
            if (s.world[ty][tx] === TLV) {
              lavaWater = true;
            }
            break;
          }
        }
      }
      if (nearWater) break;
    }
    
    if (!nearWater) {
      addLog("🌊 Stand near water or lava to cast your line!", "#38bdf8");
      return;
    }
    
    if (isFishing) return;

    // Search for a nearby fishing hotspot
    let activeHotspot: any = null;
    for (const o of s.objs) {
      if (o.type === 'fishing_hotspot' && Math.abs(o.tx - px) + Math.abs(o.ty - py) <= 3) {
        activeHotspot = o;
        break;
      }
    }

    setIsFishing(true);
    setFishingState('waiting');

    let delay = 2000 + Math.random() * 2500;
    if (activeHotspot) {
      setFishingHotspotTx(activeHotspot.tx);
      setFishingHotspotTy(activeHotspot.ty);
      delay = activeHotspot.subtype === 'lava' ? (700 + Math.random() * 600) : (900 + Math.random() * 800);
      addLog(`✨ Spot-on! Casting directly into a bubbling ${activeHotspot.subtype === 'lava' ? 'Magma Vortex' : 'School of Fish'}!`, '#10b981');
      setFishingMessage(`Casting into hotspot! Fish biting rapidly... 🎏`);
    } else {
      setFishingHotspotTx(null);
      setFishingHotspotTy(null);
      setFishingMessage("Casting line... Waiting for a bite... 🐟");
      addLog(lavaWater ? "🌋 You cast your line into the boiling magma..." : "🎣 You cast your fishing line into the water...", "#38bdf8");
    }
    
    const timerId = window.setTimeout(() => {
      setFishingState('bite');
      setFishingMessage("❗ A BITE! QUICK, CLICK REEL IN! 🎣");
      addLog("❗ A fish is biting! Reel it in!", "#f59e0b");
      
      const level = s.pl.skills?.fishing?.lvl || 1;
      const finalWindow = Math.min(3200, 1600 + level * 100 + (activeHotspot ? 600 : 0)); // hotspot yields a wider, easier catch window!
      
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
    let fishType = 'raw_fish';
    let fishName = 'Raw Fish';
    let xpAward = 25;

    // Check if cast was inside a hotspot
    let hotspotObj: any = null;
    let hotspotIndex = -1;
    if (fishingHotspotTx !== null && fishingHotspotTy !== null) {
      hotspotIndex = s.objs.findIndex((o: any) => o.type === 'fishing_hotspot' && o.tx === fishingHotspotTx && o.ty === fishingHotspotTy);
      if (hotspotIndex !== -1) {
        hotspotObj = s.objs[hotspotIndex];
      }
    }

    if (hotspotObj) {
      // Hotspot catch! Much better loot tables!
      const rand = Math.random() + (flvl * 0.05);
      
      if (hotspotObj.subtype === 'lava') {
        // Lava hotspot drops magma cod or obsidian fin!
        if (rand > 0.8) {
          fishType = 'obsidian_fin';
          fishName = '🖤 Obsidian Fin';
          xpAward = 90;
        } else {
          fishType = 'magma_cod';
          fishName = '🌋 Magma Cod';
          xpAward = 50;
        }
      } else {
        // Ocean hotspot drops legendary salmon, celestial fish, or raw fish!
        if (rand > 0.95) {
          fishType = 'legendary_salmon';
          fishName = '👑 Legendary Salmon';
          xpAward = 150;
        } else if (rand > 0.7) {
          fishType = 'celestial_fish';
          fishName = '🌌 Celestial Fish';
          xpAward = 120;
        } else {
          fishType = 'cooked_fish';
          fishName = '🐠 Crispy Cooked Fish';
          xpAward = 65;
        }
      }

      // Decrement hotspot charges (depletion mechanic)
      hotspotObj.hp--;
      if (hotspotObj.hp <= 0) {
        s.objs.splice(hotspotIndex, 1);
        addLog("🎏 The Fishing Hotspot has been depleted!", "#f87171");
      } else {
        addLog(`🎏 Hotspot Active: ${hotspotObj.hp} catches remaining.`, '#6ee7b7');
      }
      
      // Spawn happy water splashes
      spawnExplosion(s, hotspotObj.tx * TZ + TZ / 2, hotspotObj.ty * TZ + TZ / 2, hotspotObj.subtype === 'lava' ? '#ff4500' : '#38bdf8', 12, 'spark');
    } else {
      // Standard catch
      const rand = Math.random() + (flvl * 0.03);
      if (rand > 1.15) {
        fishType = 'celestial_fish';
        fishName = '🌌 Celestial Fish';
        xpAward = 120;
      } else if (rand > 0.82) {
        fishType = 'cooked_fish';
        fishName = '🐠 Crispy Cooked Fish';
        xpAward = 65;
      }
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
      setFishingHotspotTx(null);
      setFishingHotspotTy(null);
    }, 2200);
  };

  const getFilteredItems = () => {
    if (!gameState || !gameState.pl || !gameState.pl.inv) return [];
    const allItems = Object.entries(gameState.pl.inv).filter(([, v]) => (v as number) > 0);
    
    if (invCategory === 'all') return allItems;
    
    return allItems.filter(([k]) => {
      const it = IT[k];
      if (!it) return false;
      
      if (invCategory === 'weapon') {
        return it.t === 'tool' || !!it.id;
      }
      if (invCategory === 'armor') {
        return it.t === 'armor';
      }
      if (invCategory === 'food') {
        return it.t === 'food' || it.t === 'pot' || k === 'mana_crystal';
      }
      if (invCategory === 'mat') {
        return it.t === 'mat' && k !== 'mana_crystal';
      }
      return true;
    });
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
        <div className="flex flex-col gap-2 max-h-[85vh] overflow-y-auto pr-2 scrollbar-none pointer-events-none select-none">
          
          {/* Detailed, RPG-Style Survival Status Panel */}
          {isStatusCollapsed ? (
            <div className="flex items-center justify-between p-2.5 bg-zinc-950/85 border border-white/10 rounded-2xl backdrop-blur-md shadow-lg pointer-events-auto w-[250px] select-none font-mono">
              <span className="text-[10px] font-bold text-yellow-400 uppercase tracking-wider flex items-center gap-1">👑 Status (LVL {gameState?.pl.lvl || 1})</span>
              <button 
                onClick={() => setIsStatusCollapsed(false)} 
                className="px-2 py-0.5 bg-zinc-900 border border-white/10 hover:border-yellow-500/50 hover:bg-zinc-800 text-[9px] rounded-lg text-white font-bold cursor-pointer transition-all active:scale-95"
              >
                ▲ SHOW
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 p-3.5 bg-zinc-950/85 border border-white/10 rounded-2xl backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.5)] pointer-events-auto min-w-[250px] select-none">
              {/* Avatar / Level Indicator */}
              <div className="flex items-center gap-2 border-b border-white/10 pb-2 mb-0.5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-500 to-amber-300 flex items-center justify-center text-xs font-black text-black shadow-inner shadow-black/20 animate-pulse">
                  👑
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold tracking-wider text-yellow-400 uppercase font-sans">Survival Core</span>
                  <span className="text-xs font-extrabold text-white font-mono">LVL {gameState?.pl.lvl || 1}</span>
                </div>
                <div className="ml-auto text-[9px] text-zinc-400 font-mono">
                  XP: {gameState?.pl.xp || 0} / {gameState?.pl.xpNext || 100}
                </div>
                <button 
                  onClick={() => setIsStatusCollapsed(true)} 
                  className="px-1.5 py-0.5 bg-zinc-900 border border-white/10 hover:border-red-500/30 text-[9px] rounded-lg text-zinc-400 hover:text-white cursor-pointer transition-all active:scale-95"
                  title="Collapse Panel"
                >
                  ▼ HIDE
                </button>
              </div>
              
              {/* Health (HP) */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center text-[10px] font-bold font-mono">
                  <span className="text-rose-400 flex items-center gap-1">❤️ HP</span>
                  <span className="text-rose-200">{Math.floor(gameState?.pl.hp || 0)} / {gameState?.pl.mhp || 100}</span>
                </div>
                <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden border border-white/5 p-0.5 shadow-inner">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-red-600 to-rose-400 rounded-full"
                    initial={{ width: '100%' }}
                    animate={{ width: `${Math.max(0, Math.min(100, ((gameState?.pl.hp || 0) / (gameState?.pl.mhp || 100)) * 100))}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>

              {/* Hunger (HUN) */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center text-[10px] font-bold font-mono">
                  <span className="text-amber-400 flex items-center gap-1">🍗 HUNGER</span>
                  <span className={`${(gameState?.pl.hu || 0) < 30 ? 'text-red-400 animate-pulse font-black' : 'text-amber-200'}`}>{Math.floor(gameState?.pl.hu || 0)}%</span>
                </div>
                <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden border border-white/5 p-0.5 shadow-inner">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-orange-500 to-yellow-400 rounded-full"
                    initial={{ width: '100%' }}
                    animate={{ width: `${Math.max(0, Math.min(100, gameState?.pl.hu || 0))}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>

              {/* Stamina (STA) */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center text-[10px] font-bold font-mono">
                  <span className="text-cyan-400 flex items-center gap-1">⚡ STAMINA</span>
                  <span className="text-cyan-200">{Math.floor(gameState?.pl.sta || 0)}%</span>
                </div>
                <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden border border-white/5 p-0.5 shadow-inner">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full"
                    initial={{ width: '100%' }}
                    animate={{ width: `${Math.max(0, Math.min(100, gameState?.pl.sta || 0))}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>

              {/* Mana (MP) */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center text-[10px] font-bold font-mono">
                  <span className="text-purple-400 flex items-center gap-1">🔮 MANA</span>
                  <span className="text-purple-200">{Math.floor(gameState?.pl.mp || 0)} / {gameState?.pl.mmp || 100}</span>
                </div>
                <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden border border-white/5 p-0.5 shadow-inner">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-purple-600 to-fuchsia-400 rounded-full"
                    initial={{ width: '100%' }}
                    animate={{ width: `${Math.max(0, Math.min(100, ((gameState?.pl.mp || 0) / (gameState?.pl.mmp || 100)) * 100))}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* RPG-Style Equipment & Gear Panel */}
          {isEquipCollapsed ? (
            <div className="flex items-center justify-between p-2.5 bg-zinc-950/85 border border-white/10 rounded-2xl backdrop-blur-md shadow-lg pointer-events-auto w-[250px] select-none font-mono">
              <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1">🛡️ Gear (DEF: {gameState?.pl.def || 0})</span>
              <button 
                onClick={() => setIsEquipCollapsed(false)} 
                className="px-2 py-0.5 bg-zinc-900 border border-white/10 hover:border-cyan-500/50 hover:bg-zinc-800 text-[9px] rounded-lg text-white font-bold cursor-pointer transition-all active:scale-95"
              >
                ▲ SHOW
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 p-3 bg-zinc-950/85 border border-white/10 rounded-2xl backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.5)] pointer-events-auto min-w-[250px] select-none font-mono">
              <div className="flex items-center gap-1.5 border-b border-white/10 pb-2 mb-0.5 justify-between">
                <span className="text-[10px] font-bold tracking-wider text-cyan-400 uppercase flex items-center gap-1">
                  🛡️ Equipment & Gear
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded font-bold uppercase">
                    DEF: {gameState?.pl.def || 0}
                  </span>
                  <button 
                    onClick={() => setIsEquipCollapsed(true)} 
                    className="px-1.5 py-0.5 bg-zinc-900 border border-white/10 hover:border-red-500/30 text-[9px] rounded-lg text-zinc-400 hover:text-white cursor-pointer transition-all active:scale-95"
                    title="Collapse Panel"
                  >
                    ▼ HIDE
                  </button>
                </div>
              </div>
              
              <div className="flex flex-col gap-1">
                {[
                  { slot: 'head', n: 'Head', ico: '🪖' },
                  { slot: 'chest', n: 'Chest', ico: '👕' },
                  { slot: 'legs', n: 'Legs', ico: '👖' },
                  { slot: 'feet', n: 'Feet', ico: '🥾' },
                  { slot: 'ring', n: 'Ring', ico: '💍' },
                ].map(({ slot, n, ico }) => {
                  const itemKey = gameState?.pl.equip?.[slot];
                  const item = itemKey ? IT[itemKey] : null;
                  return (
                    <div 
                      key={slot} 
                      className={`flex items-center justify-between p-1.5 rounded-xl border text-xs transition-all ${
                        item 
                          ? 'bg-zinc-900/90 border-cyan-500/30 shadow-[0_0_8px_rgba(6,182,212,0.15)]' 
                          : 'bg-white/[0.01] border-white/5 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base" title={n}>{item ? item.ico : ico}</span>
                        <div className="flex flex-col">
                          <span className="text-[8px] opacity-40 uppercase tracking-widest leading-none">{n}</span>
                          <span className={`text-[9px] font-bold truncate max-w-[120px] ${item ? 'text-white' : 'text-zinc-500'}`}>
                            {item ? item.n : '[ Empty Slot ]'}
                          </span>
                        </div>
                      </div>
                      {item ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[9px] text-cyan-400 font-bold whitespace-nowrap">
                            {item.def ? `+${item.def} DEF ` : ''}
                            {item.hpBonus ? `+${item.hpBonus} HP ` : ''}
                            {item.mpBonus ? `+${item.mpBonus} MP ` : ''}
                            {item.spdBonus ? `+${Math.round(item.spdBonus * 100)}% SPD ` : ''}
                          </span>
                          <button 
                            onClick={() => handleUnequip(slot)}
                            className="p-1 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded cursor-pointer transition-all active:scale-90"
                            title="Click to Unequip"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[9px] text-zinc-600 italic">None</span>
                      )}
                    </div>
                  );
                })}
              </div>
              
              <p className="text-[8px] text-zinc-500 leading-tight text-center mt-1">
                💡 Click armor pieces in your <span className="text-yellow-500 font-bold">INV</span> to equip them!
              </p>
            </div>
          )}

          {/* Automation Cores Control Center */}
          {isAutoCollapsed ? (
            <div className="flex items-center justify-between p-2.5 bg-zinc-950/85 border border-white/10 rounded-2xl backdrop-blur-md shadow-lg pointer-events-auto w-[250px] select-none font-mono">
              <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wider flex items-center gap-1">🤖 Automation ({(autoAttack ? 1:0)+(autoHarvest ? 1:0)+(autoCollect ? 1:0)+(autoCraftState ? 1:0)}/4 CORES)</span>
              <button 
                onClick={() => setIsAutoCollapsed(false)} 
                className="px-2 py-0.5 bg-zinc-900 border border-white/10 hover:border-teal-500/50 hover:bg-zinc-800 text-[9px] rounded-lg text-white font-bold cursor-pointer transition-all active:scale-95"
              >
                ▲ SHOW
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 p-3.5 bg-zinc-950/85 border border-white/10 rounded-2xl backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.5)] pointer-events-auto min-w-[250px] select-none text-white font-mono">
              <div className="flex items-center gap-1.5 border-b border-white/10 pb-2 justify-between">
                <span className="text-[10px] font-bold tracking-widest uppercase text-teal-400 flex items-center gap-1">
                  🤖 Automation Cores
                </span>
                <button 
                  onClick={() => setIsAutoCollapsed(true)} 
                  className="px-1.5 py-0.5 bg-zinc-900 border border-white/10 hover:border-red-500/30 text-[9px] rounded-lg text-zinc-400 hover:text-white cursor-pointer transition-all active:scale-95"
                  title="Collapse Panel"
                >
                  ▼ HIDE
                </button>
              </div>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => setAutoAttack(prev => !prev)}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-bold tracking-wider uppercase flex items-center justify-between transition-all border cursor-pointer ${
                    autoAttack 
                      ? 'bg-red-500/20 border-red-500/50 text-red-300 shadow-[0_0_10px_rgba(239,68,68,0.2)]' 
                      : 'bg-zinc-900/60 border-white/5 text-zinc-400 hover:border-white/15'
                  }`}
                >
                  <span>⚔️ Combat Core</span>
                  <span className={autoAttack ? 'text-red-400 animate-pulse font-black' : 'text-zinc-500'}>
                    {autoAttack ? 'ON' : 'OFF'}
                  </span>
                </button>
                <button
                  onClick={() => setAutoHarvest(prev => !prev)}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-bold tracking-wider uppercase flex items-center justify-between transition-all border cursor-pointer ${
                    autoHarvest 
                      ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300 shadow-[0_0_10px_rgba(234,179,8,0.2)]' 
                      : 'bg-zinc-900/60 border-white/5 text-zinc-400 hover:border-white/15'
                  }`}
                >
                  <span>🪵 Gathering Core</span>
                  <span className={autoHarvest ? 'text-yellow-400 animate-pulse font-black' : 'text-zinc-500'}>
                    {autoHarvest ? 'ON' : 'OFF'}
                  </span>
                </button>
                <button
                  onClick={() => setAutoCollect(prev => !prev)}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-bold tracking-wider uppercase flex items-center justify-between transition-all border cursor-pointer ${
                    autoCollect 
                      ? 'bg-green-500/20 border-green-500/50 text-green-300 shadow-[0_0_10px_rgba(34,197,94,0.2)]' 
                      : 'bg-zinc-900/60 border-white/5 text-zinc-400 hover:border-white/15'
                  }`}
                >
                  <span>🧲 Vacuum Core</span>
                  <span className={autoCollect ? 'text-green-400 animate-pulse font-black' : 'text-zinc-500'}>
                    {autoCollect ? 'ON' : 'OFF'}
                  </span>
                </button>
                <button
                  onClick={() => setAutoCraftState(prev => !prev)}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-bold tracking-wider uppercase flex items-center justify-between transition-all border cursor-pointer ${
                    autoCraftState 
                      ? 'bg-orange-500/20 border-orange-500/50 text-orange-300 shadow-[0_0_10px_rgba(249,115,22,0.2)]' 
                      : 'bg-zinc-900/60 border-white/5 text-zinc-400 hover:border-white/15'
                  }`}
                >
                  <span>🛠️ Auto-Craft Core</span>
                  <span className={autoCraftState ? 'text-orange-400 animate-pulse font-black' : 'text-zinc-500'}>
                    {autoCraftState ? 'ON' : 'OFF'}
                  </span>
                </button>
                <button
                  onClick={() => {
                    setAutoPlay(prev => {
                      const newVal = !prev;
                      if (newVal) {
                        setAutoAttack(true);
                        setAutoHarvest(true);
                        setAutoCollect(true);
                        setAutoCraftState(true);
                        addLog("🧠 Neural Autoplay Core Online: Full Autonomous Survival Active!", "#22d3ee");
                      } else {
                        addLog("🧠 Neural Autoplay Core Offline", "#a1a1aa");
                      }
                      return newVal;
                    });
                  }}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-bold tracking-wider uppercase flex items-center justify-between transition-all border cursor-pointer ${
                    autoPlay 
                      ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.2)]' 
                      : 'bg-zinc-900/60 border-white/5 text-zinc-400 hover:border-white/15'
                  }`}
                >
                  <span className="flex items-center gap-1">🤖 Neural Autoplay</span>
                  <span className={autoPlay ? 'text-cyan-400 animate-pulse font-black' : 'text-zinc-500'}>
                    {autoPlay ? 'ON' : 'OFF'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Crisis Alerts Overlay */}
          {gameState?.pl.hu < 30 && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-1.5 p-2.5 bg-red-950/80 border border-red-500/40 rounded-xl backdrop-blur-sm pointer-events-auto shadow-lg max-w-[250px]"
            >
              <div className="flex items-center gap-1.5 text-[10px] font-black text-red-400 uppercase tracking-wider font-mono">
                <AlertCircle size={12} className="animate-bounce" />
                <span>Starving! Eat Food:</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {['cooked_meat', 'cooked_fish', 'celestial_fish', 'berry', 'mushroom'].map(foodKey => {
                  const count = gameState?.pl.inv[foodKey] || 0;
                  if (count > 0) {
                    return (
                      <button
                        key={foodKey}
                        onClick={() => {
                          handleUse(foodKey);
                          setGameState({ ...stateRef.current });
                        }}
                        className="px-2 py-1 bg-red-600/30 hover:bg-red-600/60 text-white rounded-lg text-[9px] font-bold flex items-center gap-1 border border-white/5 active:scale-95 transition-all cursor-pointer"
                      >
                        <span>{IT[foodKey]?.ico}</span>
                        <span>x{count}</span>
                      </button>
                    );
                  }
                  return null;
                })}
                {!['cooked_meat', 'cooked_fish', 'celestial_fish', 'berry', 'mushroom'].some(f => (gameState?.pl.inv[f] || 0) > 0) && (
                  <span className="text-[9px] text-red-300 italic">No food in inventory!</span>
                )}
              </div>
            </motion.div>
          )}

          {gameState?.pl.hp < gameState?.pl.mhp * 0.4 && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-1.5 p-2.5 bg-rose-950/80 border border-rose-500/40 rounded-xl backdrop-blur-sm pointer-events-auto shadow-lg max-w-[250px]"
            >
              <div className="flex items-center gap-1.5 text-[10px] font-black text-rose-400 uppercase tracking-wider font-mono">
                <AlertCircle size={12} className="animate-pulse" />
                <span>Low HP! Heal Potion:</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {['heal_potion'].map(potKey => {
                  const count = gameState?.pl.inv[potKey] || 0;
                  if (count > 0) {
                    return (
                      <button
                        key={potKey}
                        onClick={() => {
                          handleUse(potKey);
                          setGameState({ ...stateRef.current });
                        }}
                        className="px-2 py-1 bg-rose-600/30 hover:bg-rose-600/60 text-white rounded-lg text-[9px] font-bold flex items-center gap-1 border border-white/5 active:scale-95 transition-all cursor-pointer"
                      >
                        <span>{IT[potKey]?.ico}</span>
                        <span>Drink (x{count})</span>
                      </button>
                    );
                  }
                  return null;
                })}
                {(gameState?.pl.inv['heal_potion'] || 0) === 0 && (
                  <span className="text-[9px] text-rose-300 italic">No health potions!</span>
                )}
              </div>
            </motion.div>
          )}
        </div>

        {/* Floating Resource Monitor Overlay (Centered at top) */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 p-2 bg-zinc-950/80 border border-white/10 rounded-2xl backdrop-blur-md shadow-2xl pointer-events-auto select-none z-10 max-w-[90vw] overflow-x-auto scrollbar-none">
          {[
            { key: 'wood', ico: '🪵', col: 'border-amber-700/20 text-amber-100 bg-amber-950/10' },
            { key: 'stone', ico: '🪨', col: 'border-zinc-500/20 text-zinc-100 bg-zinc-800/10' },
            { key: 'fiber', ico: '🌿', col: 'border-emerald-600/20 text-emerald-100 bg-emerald-950/10' },
            { key: 'iron_ore', ico: '⚙️', col: 'border-cyan-600/20 text-cyan-100 bg-cyan-950/10' },
            { key: 'coal', ico: '🖤', col: 'border-slate-800/20 text-slate-100 bg-slate-900/15' },
            { key: 'crystal', ico: '💎', col: 'border-sky-500/20 text-sky-100 bg-sky-950/10' },
            { key: 'magic_essence', ico: '✨', col: 'border-purple-500/20 text-purple-100 bg-purple-950/10' },
            { key: 'void_crystal', ico: '🔮', col: 'border-fuchsia-600/20 text-fuchsia-100 bg-fuchsia-950/10' }
          ].map(res => {
            const qty = gameState?.pl.inv[res.key] || 0;
            const active = qty > 0;
            return (
              <div 
                key={res.key}
                className={`flex items-center gap-1 px-2 py-1 rounded-xl border transition-all text-xs font-mono font-bold ${res.col} ${active ? 'opacity-100 scale-100 shadow-[0_0_8px_rgba(255,255,255,0.05)]' : 'opacity-25 scale-95'}`}
                title={`${IT[res.key]?.n || res.key}: ${qty}`}
              >
                <span>{res.ico}</span>
                <span>{qty}</span>
              </div>
            );
          })}
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
              onClick={() => { setShowInv(true); setSelectedInvItem(null); setInvCategory('all'); }}
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
              onClick={() => setShowSpellbook(true)}
              className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-zinc-900 border border-fuchsia-500/20 hover:border-fuchsia-500/50 rounded-xl text-[9px] sm:text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 sm:gap-1.5 transition-all text-white hover:text-fuchsia-400 hover:scale-105 active:scale-95 cursor-pointer shadow-lg"
            >
              <BookOpen size={11} className="text-fuchsia-400" />
              <span>SPELLS</span>
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
            <button 
              onClick={() => setShowWorldMenu(true)}
              className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-zinc-900 border border-emerald-500/20 hover:border-emerald-400/50 rounded-xl text-[9px] sm:text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 sm:gap-1.5 transition-all text-white hover:text-emerald-300 hover:scale-105 active:scale-95 cursor-pointer shadow-lg"
            >
              <Globe size={11} className="text-emerald-400" />
              <span>WORLD</span>
            </button>
          </div>
        </div>
      </div>

      {/* --- Logs --- */}
      <div className="absolute top-24 left-[276px] flex flex-col gap-1 pointer-events-none z-10 max-w-sm">
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

      {/* --- Active Spell Buffs Indicator --- */}
      {((gameState?.activeSpells?.revealMapTimer > 0) || (gameState?.activeSpells?.healingSanctuaryTimer > 0)) && (
        <div className="absolute top-[250px] left-1/2 -translate-x-1/2 z-10 pointer-events-auto flex gap-2">
          {gameState.activeSpells.revealMapTimer > 0 && (
            <div className="bg-gradient-to-r from-fuchsia-950/90 to-black/80 border border-fuchsia-500/30 px-3 py-1.5 rounded-full flex items-center gap-2 shadow-[0_0_15px_rgba(217,70,239,0.15)]">
              <span className="text-xs animate-pulse">🔮</span>
              <span className="text-[10px] text-fuchsia-300 font-bold uppercase tracking-wide">Astral Scrying</span>
              <span className="text-[10px] text-fuchsia-400 font-mono font-bold">
                {Math.ceil(gameState.activeSpells.revealMapTimer / 60)}s
              </span>
            </div>
          )}
          {gameState.activeSpells.healingSanctuaryTimer > 0 && (
            <div className="bg-gradient-to-r from-pink-950/90 to-black/80 border border-pink-500/30 px-3 py-1.5 rounded-full flex items-center gap-2 shadow-[0_0_15px_rgba(236,72,153,0.15)]">
              <span className="text-xs animate-pulse">💖</span>
              <span className="text-[10px] text-pink-300 font-bold uppercase tracking-wide">Sanctuary</span>
              <span className="text-[10px] text-pink-400 font-mono font-bold">
                {Math.ceil(gameState.activeSpells.healingSanctuaryTimer / 60)}s
              </span>
            </div>
          )}
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
            className="fixed inset-0 z-50 bg-black/95 flex flex-col"
          >
            <div className="p-4 sm:p-6 flex justify-between items-center border-b border-white/10 shrink-0">
              <h2 className="text-xl font-bold tracking-widest text-green-400 flex items-center gap-2">
                <Backpack className="text-green-400 animate-pulse" /> PLAYER INVENTORY & EQUIPMENT
              </h2>
              <button onClick={() => setShowInv(false)} className="p-2 hover:bg-white/10 rounded-full cursor-pointer transition-all active:scale-95 text-zinc-400 hover:text-white">
                <X />
              </button>
            </div>
            
            <div className="flex-1 overflow-hidden flex flex-col md:flex-row p-4 sm:p-6 gap-6 font-mono">
              {/* Column 1: Character Stats & Equipped Gear */}
              <div className="w-full md:w-1/4 flex flex-col gap-4 overflow-y-auto bg-zinc-950/60 border border-white/10 rounded-2xl p-4 shrink-0">
                <h3 className="text-xs font-bold tracking-widest text-cyan-400 uppercase border-b border-white/10 pb-2 flex items-center gap-1">
                  🛡️ CHARACTER & GEAR
                </h3>
                
                {/* Equipment slots */}
                <div className="flex flex-col gap-1.5">
                  {[
                    { slot: 'head', n: 'Head', ico: '🪖' },
                    { slot: 'chest', n: 'Chest', ico: '👕' },
                    { slot: 'legs', n: 'Legs', ico: '👖' },
                    { slot: 'feet', n: 'Feet', ico: '🥾' },
                    { slot: 'ring', n: 'Ring', ico: '💍' },
                  ].map(({ slot, n, ico }) => {
                    const itemKey = gameState?.pl.equip?.[slot];
                    const item = itemKey ? IT[itemKey] : null;
                    return (
                      <div 
                        key={slot} 
                        className={`flex items-center justify-between p-2 rounded-xl border text-xs transition-all ${
                          item 
                            ? 'bg-cyan-950/20 border-cyan-500/30 shadow-[0_0_8px_rgba(6,182,212,0.1)]' 
                            : 'bg-white/[0.01] border-white/5 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xl" title={n}>{item ? item.ico : ico}</span>
                          <div className="flex flex-col">
                            <span className="text-[8px] opacity-40 uppercase tracking-widest leading-none">{n}</span>
                            <span className={`text-[10px] font-bold truncate max-w-[100px] ${item ? 'text-white' : 'text-zinc-500'}`}>
                              {item ? item.n : '[ Empty Slot ]'}
                            </span>
                          </div>
                        </div>
                        {item && (
                          <button 
                            onClick={() => handleUnequip(slot)}
                            className="p-1 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded cursor-pointer transition-all active:scale-90"
                            title="Unequip Slot"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {/* Active Weapon Slot */}
                  {(() => {
                    const wKey = gameState?.pl.weapon;
                    const wItem = wKey && wKey !== 'fists' ? IT[wKey] : null;
                    return (
                      <div 
                        className={`flex items-center justify-between p-2 rounded-xl border text-xs transition-all ${
                          wItem 
                            ? 'bg-yellow-950/20 border-yellow-500/30 shadow-[0_0_8px_rgba(234,179,8,0.1)]' 
                            : 'bg-white/[0.01] border-white/5 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xl">⚔️</span>
                          <div className="flex flex-col">
                            <span className="text-[8px] opacity-40 uppercase tracking-widest leading-none">Active Weapon</span>
                            <span className={`text-[10px] font-bold truncate max-w-[100px] ${wItem ? 'text-white' : 'text-zinc-500'}`}>
                              {wItem ? wItem.n : 'Fists ✊'}
                            </span>
                          </div>
                        </div>
                        {wItem && (
                          <button 
                            onClick={() => {
                              const s = stateRef.current;
                              if (s && s.pl) {
                                s.pl.weapon = 'fists';
                                setGameState({ ...s });
                                addLog(`Unequipped weapon`, '#94a3b8');
                              }
                            }}
                            className="p-1 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded cursor-pointer transition-all active:scale-90"
                            title="Unequip Weapon"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* RPG Attributes list */}
                <div className="mt-2 bg-white/[0.02] border border-white/5 rounded-xl p-3 flex flex-col gap-1.5 text-[10px]">
                  <div className="flex justify-between items-center">
                    <span className="opacity-50">👑 Level</span>
                    <span className="font-bold text-yellow-400">LVL {gameState?.pl.lvl || 1}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="opacity-50">📈 Experience</span>
                    <span className="font-bold text-zinc-300">{gameState?.pl.xp || 0} / {gameState?.pl.xpNext || 100}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="opacity-50">❤️ HP Status</span>
                    <span className="font-bold text-rose-400">{Math.floor(gameState?.pl.hp || 0)} / {gameState?.pl.mhp || 100}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="opacity-50">🛡️ Defense (DEF)</span>
                    <span className="font-bold text-cyan-400">{gameState?.pl.def || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="opacity-50">🏃‍♂️ Speed Rating</span>
                    <span className="font-bold text-green-400">{(gameState?.pl.spd || 3.0).toFixed(1)}</span>
                  </div>
                </div>
              </div>

              {/* Column 2: Backpack (Grid and Tabs) */}
              <div className="flex-1 flex flex-col gap-4 overflow-hidden bg-zinc-950/40 border border-white/10 rounded-2xl p-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-white/10 pb-3">
                  <h3 className="text-xs font-bold tracking-widest text-green-400 uppercase flex items-center gap-1">
                    🎒 BACKPACK ITEMS
                  </h3>
                  
                  {/* Tabs */}
                  <div className="flex flex-wrap gap-1">
                    {[
                      { id: 'all', n: '🎒 All' },
                      { id: 'weapon', n: '⚔️ Gear' },
                      { id: 'armor', n: '🛡️ Armor' },
                      { id: 'food', n: '🧪 Consumables' },
                      { id: 'mat', n: '🪵 Materials' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setInvCategory(tab.id as any)}
                        className={`px-2 py-1 text-[9px] font-bold rounded-lg transition-all cursor-pointer ${
                          invCategory === tab.id 
                            ? 'bg-green-500 text-black font-black shadow-md' 
                            : 'bg-white/5 text-zinc-400 border border-white/5 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {tab.n}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Items Grid */}
                <div className="flex-1 overflow-y-auto pr-1">
                  {(() => {
                    const filtered = getFilteredItems();
                    if (filtered.length === 0) {
                      return (
                        <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500 text-xs">
                          <Backpack size={32} className="opacity-20 mb-2" />
                          <p>No items found in this category.</p>
                        </div>
                      );
                    }
                    return (
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                        {filtered.map(([k, v]) => {
                          const isSelected = selectedInvItem === k;
                          const eqSlot = Object.keys(gameState?.pl.equip || {}).find(slot => gameState?.pl.equip[slot] === k);
                          const isEqWeapon = gameState?.pl.weapon === k;
                          const isCurrentlyEquipped = eqSlot || isEqWeapon;
                          
                          return (
                            <div 
                              key={k} 
                              onClick={() => setSelectedInvItem(k)}
                              className={`relative bg-white/[0.02] border rounded-xl p-3 flex flex-col items-center gap-1.5 transition-all cursor-pointer group hover:bg-white/[0.05] ${
                                isSelected 
                                  ? 'border-green-400 bg-green-500/10 shadow-[0_0_12px_rgba(34,197,94,0.15)] scale-[1.02]' 
                                  : 'border-white/5'
                              }`}
                            >
                              <span className="text-3xl group-hover:scale-110 transition-transform">{IT[k]?.ico || '?'}</span>
                              <span className="text-[9px] opacity-70 text-center truncate w-full">{IT[k]?.n || k}</span>
                              
                              <div className="flex justify-between items-center w-full px-1">
                                <span className="text-xs font-extrabold text-green-400">x{v as number}</span>
                                {isCurrentlyEquipped && (
                                  <span className="text-[7px] font-extrabold bg-green-500 text-black px-1 rounded uppercase tracking-tighter leading-normal shrink-0">
                                    EQ
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Column 3: Selected Item Details Panel */}
              <div className="w-full md:w-1/3 xl:w-1/4 flex flex-col bg-zinc-950/60 border border-white/10 rounded-2xl p-4 overflow-y-auto shrink-0 animate-fadeIn">
                <h3 className="text-xs font-bold tracking-widest text-yellow-500 uppercase border-b border-white/10 pb-2 flex items-center gap-1 mb-4">
                  ✨ ITEM DETAILS
                </h3>

                {selectedInvItem && IT[selectedInvItem] ? (() => {
                  const it = IT[selectedInvItem];
                  const qty = gameState?.pl.inv[selectedInvItem] || 0;
                  
                  const eqSlot = Object.keys(gameState?.pl.equip || {}).find(slot => gameState?.pl.equip[slot] === selectedInvItem);
                  const isEqWeapon = gameState?.pl.weapon === selectedInvItem;
                  const isCurrentlyEquipped = eqSlot || isEqWeapon;

                  return (
                    <div className="flex flex-col gap-4 text-left">
                      {/* Logo and Name header */}
                      <div className="flex items-center gap-3 bg-white/[0.02] border border-white/5 p-3 rounded-xl">
                        <span className="text-4xl bg-white/5 p-2 rounded-xl border border-white/5">{it.ico}</span>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-black text-white truncate">{it.n}</span>
                          <span className="text-[8px] tracking-wider text-zinc-400 uppercase mt-0.5 leading-none">
                            {it.t === 'armor' ? `🛡️ Body Armor (${it.sl})` : 
                             it.t === 'tool' || it.id ? '⚔️ Weapon / Tool' :
                             it.t === 'food' || it.t === 'pot' || selectedInvItem === 'mana_crystal' ? '🧪 Consumable' : '🪵 Crafting Material'}
                          </span>
                        </div>
                      </div>

                      {/* Item Stats info box */}
                      <div className="bg-white/[0.01] border border-white/5 rounded-xl p-3 flex flex-col gap-2">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="opacity-50">Backpack Quantity:</span>
                          <span className="font-bold text-green-400">{qty}</span>
                        </div>

                        {/* Weapon specific stats */}
                        {(it.id || it.t === 'tool') && (
                          <div className="flex flex-col gap-1 text-[10px] border-t border-white/5 pt-2 mt-1">
                            <div className="flex justify-between">
                              <span className="opacity-50">Base Damage:</span>
                              <span className="font-bold text-yellow-400">{it.dmg || 0} DMG</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="opacity-50">Base Attack Speed:</span>
                              <span className="font-bold text-cyan-400">{it.spd || 0} ticks</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="opacity-50">Range:</span>
                              <span className="font-bold text-zinc-300">{it.rng || 0}px</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="opacity-50">Attack Type:</span>
                              <span className="font-bold uppercase text-purple-400">{it.type || 'melee'}</span>
                            </div>
                          </div>
                        )}

                        {/* Armor specific stats */}
                        {it.t === 'armor' && (
                          <div className="flex flex-col gap-1 text-[10px] border-t border-white/5 pt-2 mt-1">
                            <div className="flex justify-between">
                              <span className="opacity-50">Defense Rating:</span>
                              <span className="font-bold text-cyan-400">+{it.def || 0} DEF</span>
                            </div>
                            {it.hpBonus && (
                              <div className="flex justify-between">
                                <span className="opacity-50">Max HP Bonus:</span>
                                <span className="font-bold text-rose-400">+{it.hpBonus} HP</span>
                              </div>
                            )}
                            {it.mpBonus && (
                              <div className="flex justify-between">
                                <span className="opacity-50">Max MP Bonus:</span>
                                <span className="font-bold text-purple-400">+{it.mpBonus} MP</span>
                              </div>
                            )}
                            {it.spdBonus && (
                              <div className="flex justify-between">
                                <span className="opacity-50">Speed Bonus:</span>
                                <span className="font-bold text-green-400">+{Math.round(it.spdBonus * 100)}% SPD</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Consumable specific stats */}
                        {(it.t === 'food' || it.t === 'pot' || selectedInvItem === 'mana_crystal') && (
                          <div className="flex flex-col gap-1 text-[10px] border-t border-white/5 pt-2 mt-1">
                            {it.hu && (
                              <div className="flex justify-between">
                                <span className="opacity-50">Hunger Recovered:</span>
                                <span className="font-bold text-amber-400">+{it.hu}%</span>
                              </div>
                            )}
                            {it.hp && (
                              <div className="flex justify-between">
                                <span className="opacity-50">HP Restored:</span>
                                <span className="font-bold text-rose-400">+{it.hp} HP</span>
                              </div>
                            )}
                            {it.mp && (
                              <div className="flex justify-between">
                                <span className="opacity-50">Mana Restored:</span>
                                <span className="font-bold text-purple-400">+{it.mp} MP</span>
                              </div>
                            )}
                            {selectedInvItem === 'mana_crystal' && (
                              <div className="flex justify-between">
                                <span className="opacity-50">Mana Restored:</span>
                                <span className="font-bold text-purple-400">+40 MP</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Equip/Use/Unequip Primary Actions CTA */}
                      <div className="flex flex-col gap-2 mt-2">
                        {isCurrentlyEquipped ? (
                          <button
                            onClick={() => {
                              if (eqSlot) {
                                handleUnequip(eqSlot);
                              } else {
                                // Unequip weapon
                                const s = stateRef.current;
                                if (s && s.pl) {
                                  s.pl.weapon = 'fists';
                                  setGameState({ ...s });
                                  addLog(`Unequipped weapon`, '#94a3b8');
                                }
                              }
                            }}
                            className="w-full py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-xl text-xs font-bold uppercase transition-all active:scale-[0.98] cursor-pointer text-center"
                          >
                            ❌ Unequip Item
                          </button>
                        ) : (
                          (it.t === 'armor' || it.id || it.t === 'tool' || it.t === 'food' || it.t === 'pot' || selectedInvItem === 'mana_crystal') && (
                            <button
                              onClick={() => {
                                handleUse(selectedInvItem);
                              }}
                              className="w-full py-2.5 bg-green-500 hover:bg-green-400 text-black rounded-xl text-xs font-black uppercase transition-all active:scale-[0.98] cursor-pointer text-center shadow-lg shadow-green-500/10"
                            >
                              {it.t === 'armor' ? '🛡️ Equip Armor' : 
                               it.id || it.t === 'tool' ? '⚔️ Equip Weapon' : '🧪 Consume / Use'}
                            </button>
                          )
                        )}
                      </div>

                      {/* Hotbar assign submenu (for anything except material) */}
                      {selectedInvItem && selectedInvItem !== 'fists' && (
                        <div className="flex flex-col gap-2 border-t border-white/5 pt-4 mt-2">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                            Assign to Hotbar Slot:
                          </span>
                          <div className="grid grid-cols-4 gap-1">
                            {gameState?.pl.hotbar.map((slotItem: string, idx: number) => (
                              <button
                                key={idx}
                                onClick={() => assignToHotbar(selectedInvItem, idx)}
                                className={`h-8 rounded-lg flex flex-col items-center justify-center text-[9px] font-mono border transition-all active:scale-95 cursor-pointer ${
                                  slotItem === selectedInvItem 
                                    ? 'bg-green-500/20 border-green-500 text-green-300 font-bold' 
                                    : 'bg-white/5 border-white/5 text-zinc-400 hover:border-white/10 hover:text-white'
                                }`}
                              >
                                <span className="text-xs leading-none">{IT[slotItem]?.ico || '❌'}</span>
                                <span className="text-[7px] opacity-40 leading-none">{idx + 1}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })() : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-4 text-zinc-500 text-[10px] leading-relaxed">
                    <Sparkles size={24} className="opacity-20 mb-2 animate-pulse" />
                    <p>Select any weapon, shield, magic ring, potion, or item inside your backpack grid to equip, use, or hotkey it!</p>
                  </div>
                )}
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
                  },
                  {
                    id: 'hunting',
                    n: 'Hunting & Tracking',
                    ico: '🏹',
                    color: 'from-pink-600 to-rose-400',
                    border: 'border-pink-500/30',
                    bg: 'bg-pink-950/20',
                    desc: 'Tracking footprints, discovering fishing hotspots, and hunting wild game.',
                    perks: [
                      'Grants +8% item yield bonus on wild animals per level',
                      'Grants +5% roll chance multiplier on rare loot items per level',
                      'Level 3: Enables crafting Recurve Bow and Beastmaster Armor',
                      'Level 5: Track clues to reveal nearby hidden wild animal positions'
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
                                    <button
                                      onClick={() => {
                                        setAutoCraftList(prev => {
                                          const next = { ...prev };
                                          next[r.out] = !next[r.out];
                                          return next;
                                        });
                                      }}
                                      className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border cursor-pointer ${
                                        autoCraftList[r.out]
                                          ? 'bg-orange-500/20 border-orange-500/50 text-orange-400 shadow-[0_0_8px_rgba(249,115,22,0.15)] hover:bg-orange-500/30 font-bold'
                                          : 'bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 hover:text-white'
                                      }`}
                                    >
                                      {autoCraftList[r.out] ? '✓ Auto ON' : '➕ Queue Auto'}
                                    </button>
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

              {/* Firebase Authentication & Cloud Sync Banner */}
              <div className="bg-white/[0.02] border border-white/10 p-5 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-full bg-yellow-500/10 text-yellow-500">
                    <Cloud size={24} />
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                      Cloud Save Sync {isCloudSyncing && <RefreshCw size={12} className="animate-spin text-yellow-400" />}
                    </div>
                    {user ? (
                      <div className="text-[10px] text-white/70 uppercase mt-1 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block animate-pulse"></span>
                        Logged in as <span className="text-yellow-400 font-bold">{user.displayName || user.email}</span>
                      </div>
                    ) : (
                      <p className="text-[10px] opacity-40 uppercase mt-1">Sign in to backup your survival saves to secure cloud storage and sync them across devices</p>
                    )}
                  </div>
                </div>
                <div>
                  {user ? (
                    <button 
                      onClick={handleSignOut}
                      className="px-4 py-2 bg-red-950/20 hover:bg-red-950/40 text-red-400 border border-red-900/30 hover:border-red-500/30 rounded-xl text-xs font-bold tracking-wider uppercase transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                    >
                      <LogOut size={13} /> Sign Out
                    </button>
                  ) : (
                    <button 
                      onClick={handleSignIn}
                      className="px-4 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-500/20 hover:border-yellow-500/40 rounded-xl text-xs font-bold tracking-wider uppercase transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                    >
                      <LogIn size={13} /> Sign in with Google
                    </button>
                  )}
                </div>
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
                  const cloudSave = cloudSlots[slotId];
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

                          {/* Cloud Backup Status */}
                          {user && (
                            <div className="mt-4 pt-3 border-t border-white/5 flex flex-col gap-1 text-[10px]">
                              <div className="flex items-center gap-1.5 font-bold tracking-wider text-[9px] uppercase text-yellow-400">
                                <Cloud size={11} /> Cloud State
                              </div>
                              {cloudSave ? (
                                <>
                                  <div className="text-white/60">Day {cloudSave.day} • Level {cloudSave.pl?.lvl || 1} • {cloudSave.pl?.hp || 100} HP</div>
                                  <div className="text-[9px] opacity-40 uppercase mt-0.5">Cloud Backed: {new Date(cloudSave.timestamp).toLocaleString()}</div>
                                </>
                              ) : (
                                <div className="text-white/30 uppercase text-[9px] mt-0.5">[ No Cloud Backup ]</div>
                              )}
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

                      {/* Cloud Control Buttons */}
                      {user && (
                        <div className="flex gap-2 pt-2 border-t border-white/5 mt-1">
                          {save && (
                            <button
                              onClick={() => backupToCloud(slotId)}
                              title="Backup local save to Cloud"
                              className="flex-1 py-1 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-500/10 hover:border-yellow-500/30 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1"
                            >
                              <CloudUpload size={11} /> Backup
                            </button>
                          )}
                          {cloudSave && (
                            <>
                              <button
                                onClick={() => restoreFromCloud(slotId)}
                                title="Restore from Cloud to local slot and load"
                                className="flex-1 py-1 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/10 hover:border-green-500/30 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1"
                              >
                                <CloudDownload size={11} /> Restore
                              </button>
                              <button
                                onClick={() => deleteCloudSave(slotId)}
                                title="Delete cloud backup"
                                className="p-1.5 bg-red-950/30 hover:bg-red-950/60 text-red-400 hover:text-red-300 border border-red-900/20 hover:border-red-500/30 rounded-lg transition-all active:scale-95 cursor-pointer flex items-center justify-center"
                              >
                                <Trash2 size={11} />
                              </button>
                            </>
                          )}
                        </div>
                      )}
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

        {showWorldMenu && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
          >
            <div className="max-w-4xl w-full bg-zinc-950 border border-emerald-500/30 rounded-3xl p-6 md:p-8 flex flex-col gap-6 max-h-[90vh] overflow-y-auto shadow-[0_0_50px_rgba(16,185,129,0.15)] text-white font-mono pointer-events-auto">
              <div className="flex justify-between items-center border-b border-white/10 pb-4">
                <div className="flex items-center gap-2.5">
                  <Globe size={22} className="text-emerald-400" />
                  <div>
                    <h2 className="text-xl font-bold uppercase tracking-wider text-emerald-400 font-mono">WORLD GENERATOR PLATFORM</h2>
                    <p className="text-[10px] opacity-50 uppercase mt-0.5">Procedural Multi-Biome Noise Grid & Seed Orchestrator</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowWorldMenu(false)}
                  className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* World Seed Controls */}
              <div className="bg-white/[0.02] border border-white/10 p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex-1">
                  <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">Custom Generation Seed</div>
                  <p className="text-[10px] opacity-40 uppercase mt-1">Changing the seed completely restructures the layout, biome map, and resource nodes</p>
                  
                  {/* Input and Reroll Row */}
                  <div className="flex items-center gap-3 mt-3 w-full max-w-md">
                    <input 
                      type="number"
                      value={worldSeed}
                      onChange={(e) => setWorldSeed(parseInt(e.target.value) || 0)}
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-emerald-300 font-bold focus:border-emerald-500/50 focus:outline-none"
                    />
                    <button
                      onClick={() => {
                        const newSeed = Math.floor(Math.random() * 1000000);
                        setWorldSeed(newSeed);
                        addLog(`🎲 Rolled seed: ${newSeed}`, '#34d399');
                      }}
                      className="px-4 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                    >
                      <Shuffle size={14} />
                      <span>REROLL SEED</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-2 shrink-0 w-full md:w-auto">
                  <button
                    onClick={() => {
                      initGame();
                      setShowWorldMenu(false);
                      addLog(`🌍 Rebuilt world using Seed: ${worldSeedRef.current}`, '#34d399');
                    }}
                    className="w-full md:w-auto px-6 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer text-center"
                  >
                    REGENERATE WORLD GRID
                  </button>
                </div>
              </div>

              {/* Grid map Preview / Biome Layout overview */}
              <div className="flex flex-col gap-3">
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">Procedural Zone Layout for Seed: {worldSeed}</div>
                <p className="text-[10px] opacity-40 uppercase">The map is a {ZCOLS}x{ZROWS} cluster of continuous biomes. Below is the mapped layout:</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3.5 mt-2">
                  {Array.from({ length: ZROWS }).map((_, zr) => {
                    return Array.from({ length: ZCOLS }).map((_, zc) => {
                      const M = getProceduralBiomeForZone(zc, zr, worldSeed);
                      const isStart = zc === 0 && zr === 0;
                      return (
                        <div 
                          key={`${zc}-${zr}`}
                          className={`p-3 rounded-xl border flex flex-col justify-between transition-all relative ${
                            isStart 
                              ? 'bg-emerald-500/15 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)]' 
                              : 'bg-white/[0.02] border-white/5 hover:border-white/15'
                          }`}
                        >
                          {isStart && (
                            <span className="absolute top-1 right-1 text-[7px] bg-emerald-500 text-black px-1 rounded font-sans font-bold uppercase">
                              START
                            </span>
                          )}
                          <div>
                            <div className="text-[10px] text-zinc-500 font-mono">Zone ({zc}, {zr})</div>
                            <div className="text-xs font-extrabold text-white mt-1 flex items-center gap-1.5">
                              <span>{M.n.split(' ').map((word: string) => word[0]).join('')}</span>
                              <span className="text-lg">{M.n.includes('Desert') ? '🏜️' : M.n.includes('Forest') ? '🌲' : M.n.includes('Frozen') ? '❄️' : M.n.includes('Scorched') ? '🌋' : M.n.includes('Celestial') ? '🌌' : '🌾'}</span>
                            </div>
                            <div className="text-[9px] text-zinc-400 mt-1 truncate">{M.n}</div>
                          </div>
                          
                          <div className="mt-2 pt-2 border-t border-white/5 flex flex-wrap gap-1 text-[8px] opacity-60">
                            {Object.keys(M.dr).slice(0, 3).map(k => (
                              <span key={k} className="bg-white/5 px-1 rounded">
                                {IT[k]?.ico || '📦'}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    });
                  })}
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

        {showSpellbook && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
          >
            <div className="max-w-3xl w-full bg-zinc-950 border border-fuchsia-500/30 rounded-3xl p-6 md:p-8 flex flex-col gap-6 max-h-[95vh] overflow-y-auto shadow-[0_0_50px_rgba(217,70,239,0.15)] text-white pointer-events-auto">
              <div className="flex justify-between items-center border-b border-white/10 pb-4">
                <div className="flex items-center gap-2.5">
                  <BookOpen size={22} className="text-fuchsia-400" />
                  <div>
                    <h2 className="text-xl font-bold uppercase tracking-wider text-fuchsia-400 font-mono">ASTRAL SPELLBOOK</h2>
                    <p className="text-[10px] opacity-50 uppercase mt-0.5">Weave ambient mana fields via Gemini's cosmic intelligence</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setShowSpellbook(false);
                    setSpellResult(null);
                  }}
                  className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Mana & Mana Crystal reserves monitor */}
              <div className="bg-white/[0.02] border border-white/10 p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-5">
                <div className="flex-1">
                  <div className="text-xs font-bold uppercase tracking-wider text-fuchsia-400 flex items-center gap-1">
                    <Zap size={14} /> Arcane Leyline Reserves
                  </div>
                  <p className="text-[10px] opacity-45 uppercase mt-1 leading-relaxed">
                    Spells require active mental focus (Mana) or condensed magical reagents (<span className="text-fuchsia-400 font-bold">Mana Crystals</span>) harvested or crafted from raw elements.
                  </p>
                </div>
                
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full md:w-auto shrink-0 font-mono">
                  {/* Mana Bar */}
                  <div className="w-full sm:w-40 md:w-44">
                    <div className="flex justify-between items-center text-[9px] font-bold mb-1 text-fuchsia-300">
                      <span>🪄 MANA</span>
                      <span>{gameState?.pl.mp} / {gameState?.pl.mmp}</span>
                    </div>
                    <div className="w-full h-2.5 bg-zinc-900 border border-white/5 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-fuchsia-600 to-indigo-500 transition-all duration-300" 
                        style={{ width: `${Math.max(0, Math.min(100, ((gameState?.pl.mp || 0) / (gameState?.pl.mmp || 100)) * 100))}%` }}
                      />
                    </div>
                  </div>

                  {/* Mana Crystal Count */}
                  <div className="flex items-center gap-2 bg-zinc-900/80 border border-fuchsia-500/20 px-3 py-1.5 rounded-xl shrink-0">
                    <span className="text-xl">🧿</span>
                    <div className="flex flex-col">
                      <span className="text-[8px] opacity-40 uppercase leading-none">Mana Crystals</span>
                      <span className="text-xs font-black text-fuchsia-400 leading-normal">
                        {gameState?.pl.inv.mana_crystal || 0} Collected
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {isCasting ? (
                /* Casting Animation Card */
                <div className="bg-white/[0.01] border border-white/5 p-12 rounded-2xl flex flex-col items-center justify-center gap-6 min-h-[250px]">
                  <div className="relative w-16 h-16">
                    <div className="absolute inset-0 border-4 border-fuchsia-500/20 rounded-full" />
                    <div className="absolute inset-0 border-4 border-t-fuchsia-500 border-l-indigo-400 rounded-full animate-spin" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-fuchsia-400 animate-pulse">CHANNELLING COSMIC LEYLINES...</h3>
                    <p className="text-[10px] opacity-50 uppercase mt-2">Bending gravity and condensing planetary materials with Gemini-3.5-flash</p>
                  </div>
                </div>
              ) : spellResult ? (
                /* Spell outcome results card */
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-fuchsia-950/20 border border-fuchsia-500/30 p-6 rounded-2xl flex flex-col gap-4"
                >
                  <div className="flex items-center gap-2 border-b border-fuchsia-500/20 pb-2">
                    <Sparkles className="text-fuchsia-400 animate-pulse" size={18} />
                    <span className="text-xs font-bold text-fuchsia-300 uppercase tracking-widest">SPELL MANIFESTATION SUCCESSFUL</span>
                  </div>
                  <p className="text-xs leading-relaxed italic text-fuchsia-100/90 font-sans">
                    "{spellResult.message}"
                  </p>
                  <div className="bg-black/40 border border-white/5 p-3 rounded-xl">
                    <div className="text-[10px] font-bold text-fuchsia-400 uppercase tracking-wider mb-2">Mechanical outcomes</div>
                    <ul className="text-[10px] space-y-1 text-zinc-300 font-mono">
                      {spellResult.scoutedNodes && spellResult.scoutedNodes.length > 0 && (
                        <li>📍 Scouted {spellResult.scoutedNodes.length} ultra-rare mineral deposits and plotted onto your overlay map.</li>
                      )}
                      {spellResult.spawnDrops && spellResult.spawnDrops.length > 0 && (
                        <li>⭐ Materialized {spellResult.spawnDrops.reduce((acc: number, item: any) => acc + item.qty, 0)} raw elements onto the surrounding coordinates.</li>
                      )}
                      {spellResult.restoration && (
                        <>
                          <li>💖 Restored {spellResult.restoration.healHP} HP and {spellResult.restoration.foodBonus}% Satiety.</li>
                          {spellResult.restoration.buff && (
                            <li>🛡️ Activated "Healing Sanctuary" Aura (+25% movement speed, +5 defense).</li>
                          )}
                        </>
                      )}
                    </ul>
                  </div>
                  <button 
                    onClick={() => setSpellResult(null)}
                    className="mt-2 py-2 bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 font-mono font-bold text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer text-center"
                  >
                    DISMISS & CONTINUE
                  </button>
                </motion.div>
              ) : (
                /* Grid list of magic spells */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    {
                      name: "Heal",
                      cost: 25,
                      crystalCost: 1,
                      ico: "💚",
                      tag: "RESTORATION",
                      desc: "Instantly channels pure stellar light to mend bleeding and injuries. Restores 40 Health."
                    },
                    {
                      name: "Reveal Map",
                      cost: 40,
                      crystalCost: 2,
                      ico: "🔮",
                      tag: "SCRYING & RADAR",
                      desc: "Scans the ambient leylines to highlight 4-6 of the rarest mineral veins and flora nodes in your area on your radar for 2 minutes."
                    },
                    {
                      name: "Resource Bounty",
                      cost: 65,
                      crystalCost: 3,
                      ico: "⭐",
                      tag: "CONDENSATION",
                      desc: "Condenses raw biome-specific elements directly from the clouds, showering the nearby ground with materials."
                    },
                    {
                      name: "Healing Sanctuary",
                      cost: 50,
                      crystalCost: 2,
                      ico: "💖",
                      tag: "REJUVENATION",
                      desc: "Spins a protective sphere of healing winds. Restores 40-60 HP, restores Satiety, and activates speed and defense buffs."
                    }
                  ].map(spell => {
                    const canAffordMP = (gameState?.pl.mp || 0) >= spell.cost;
                    const canAffordCrystals = (gameState?.pl.inv.mana_crystal || 0) >= spell.crystalCost;
                    return (
                      <div 
                        key={spell.name}
                        className="bg-white/[0.01] border border-white/5 p-4 rounded-2xl flex flex-col justify-between gap-4 hover:border-fuchsia-500/20 hover:bg-white/[0.02] transition-all"
                      >
                        <div className="flex flex-col gap-2">
                          <div className="flex justify-between items-start">
                            <span className="text-2xl">{spell.ico}</span>
                            <span className="text-[8px] bg-fuchsia-500/10 text-fuchsia-400 font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">{spell.tag}</span>
                          </div>
                          <div className="text-xs font-bold text-white uppercase tracking-wider">{spell.name}</div>
                          <p className="text-[10px] opacity-50 uppercase tracking-tight leading-normal font-sans">{spell.desc}</p>
                        </div>
                        <div className="border-t border-white/5 pt-3 mt-1 flex flex-col gap-2">
                          <div className="flex justify-between items-center text-[9px] font-mono opacity-50 uppercase">
                            <span>Cost options:</span>
                            <span>{spell.cost} MP / {spell.crystalCost} Crystal</span>
                          </div>
                          <div className="flex gap-2">
                            <button 
                              disabled={!canAffordMP}
                              onClick={() => handleCastSpell(spell.name, spell.cost, 'mp')}
                              className={`flex-1 py-1.5 px-2 font-mono text-[9px] font-bold uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1 ${
                                canAffordMP 
                                  ? 'bg-fuchsia-600/15 hover:bg-fuchsia-600 border border-fuchsia-500/40 text-fuchsia-100 hover:text-white hover:shadow-md cursor-pointer' 
                                  : 'bg-zinc-900 text-zinc-600 border border-zinc-800/10 cursor-not-allowed'
                              }`}
                            >
                              ⚡ Cast (MP)
                            </button>
                            <button 
                              disabled={!canAffordCrystals}
                              onClick={() => handleCastSpell(spell.name, spell.cost, 'crystals')}
                              className={`flex-1 py-1.5 px-2 font-mono text-[9px] font-bold uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1 ${
                                canAffordCrystals 
                                  ? 'bg-purple-600 hover:bg-purple-500 border border-purple-400/40 text-white shadow-md cursor-pointer' 
                                  : 'bg-zinc-900 text-zinc-600 border border-zinc-800/10 cursor-not-allowed'
                              }`}
                            >
                              🧿 Cast (Crystal)
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}

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
