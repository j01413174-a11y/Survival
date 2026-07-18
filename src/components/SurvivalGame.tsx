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
  Sliders, 
  Zap, 
  Flame, 
  Droplets, 
  Wind,
  BrainCircuit,
  Search,
  FlaskConical,
  BookOpen,
  Book,
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
  UserCheck,
  Compass,
  MapPin
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getOracleGuidance, generateWorldEvent, castSpell } from '../services/geminiService';
import { auth, googleProvider, db, handleFirestoreError, testConnection, OperationType, getUserInventoryFromFirestore } from '../services/firebase';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, setDoc, getDoc, getDocs, deleteDoc, collection, query } from 'firebase/firestore';
import Shop from './Shop';
import TownShop from './TownShop';
import NPCDialogue from './NPCDialogue';
import ResearchTree, { RESEARCH_TECHS } from './ResearchTree';
import TerrainGenerator from './TerrainGenerator';
import { musicEngine } from '../services/audioService';
import { Music, Play, Pause, Volume2, VolumeX } from 'lucide-react';

// --- Constants & Types ---
const TZ = 32;
const ZW = 80;
const ZH = 80;
const ZCOLS = 8;
const ZROWS = 8; // Expanded to a vast 8x8 grid (64 distinct continuous maps/biomes!)
const WW = ZW * ZCOLS;
const WH = ZH * ZROWS;

const TG = 0, TD = 1, TS = 2, TW = 3, TSA = 4, TSN = 5, TLV = 6, TSW = 7, TCR = 8; // TCR = Celestial Realm
const TC: Record<number, string[]> = {
  0: ['#1c4013', '#254e1b', '#0f290b'], // Rich Grass
  1: ['#553a1f', '#644528', '#382512'], // Dark Soil
  2: ['#444452', '#3a3a46', '#262631'], // Obsidian Stone
  3: ['#102c5c', '#15366d', '#081734'], // Deep Water
  4: ['#b08d56', '#be9b62', '#7b5f35'], // Dunes Sand
  5: ['#cbe3f0', '#d8ebf7', '#93b6cd'], // Crisp Snow
  6: ['#a63300', '#bd3c00', '#6b1c00'], // Molten Lava
  7: ['#1f3316', '#294020', '#101c0b'], // Murky Swamp
  8: ['#11052c', '#1d0c3e', '#320d6d'], // Astral Void
};

export interface LoreEntry {
  id: string;
  title: string;
  type: 'journal' | 'carving' | 'echo';
  biome: string;
  text: string;
  hint: string;
  rewardItem?: string;
  rewardQty?: number;
  xpBonus?: number;
  xpSkill?: 'mining' | 'woodcutting' | 'combat' | 'alchemy' | 'hunting';
}

export const LORE_ENTRIES: LoreEntry[] = [
  {
    id: 'journal_1',
    title: 'Worn Expedition Journal - Page 12',
    type: 'journal',
    biome: 'Verdant Forest',
    text: 'I woke up here with nothing but the clothes on my back. The forest seems peaceful, but the ley-lines hum with ancient, hidden energy. There is a magical Altar of some sort further to the east.',
    hint: 'Hint: Search the eastern sectors for Ancient Ruins to build a Magic Altar.',
    rewardItem: 'bread',
    rewardQty: 2,
    xpBonus: 50
  },
  {
    id: 'journal_2',
    title: 'Scraps of a Traveler\'s Diary',
    type: 'journal',
    biome: 'Deep Forest',
    text: 'Day 14: The monsters are relentless at night. I built a Campfire, and they seemed to hesitate before entering its radiant aura. Campfires are more than just cooking tools; they are wards against the dark.',
    hint: 'Hint: Keep campfires lit during waves or nighttime to stay warm and secure.',
    rewardItem: 'torch',
    rewardQty: 1,
    xpBonus: 60
  },
  {
    id: 'carving_1',
    title: 'Glowing Glyphs on Mountain Stone',
    type: 'carving',
    biome: 'Mountain Pass',
    text: 'THE EARTH SPEAKS. BENEATH THE COLD PEAKS LIES MITHRIL—THE METAL OF COGNITIVE LIGHT. SECURE AN IRON SWORD OR BETTER TO BREACH THE HARDEST RIDGE VEINS.',
    hint: 'Hint: Use high-tier tools to mine rare ores like Mithril and Void Crystals.',
    rewardItem: 'iron_ore',
    rewardQty: 3,
    xpSkill: 'mining',
    xpBonus: 80
  },
  {
    id: 'carving_2',
    title: 'Faded Runes on Desert Obelisk',
    type: 'carving',
    biome: 'Sandy Desert',
    text: 'SOULS DUSTED IN SAND. THE SOLAR HEAT DRAINS THE VITAL WATER FAST. IN THESE SCORCHED LANDS, SULFUR ROCKS BURN AND COAL SWELLS.',
    hint: 'Hint: Drink water or eat fruits to maintain hydration in hot biomes.',
    rewardItem: 'sulfur',
    rewardQty: 2,
    xpSkill: 'mining',
    xpBonus: 80
  },
  {
    id: 'echo_1',
    title: 'Spectral Memory - Echo of the Knight',
    type: 'echo',
    biome: 'Haunted Graveyard',
    text: 'I fell defending the fortress... The undead... they fear the light of the sun, but are driven mad by the dark mages of the Graveyard. If you find my chestplate, wear it with honor.',
    hint: 'Hint: Equip armor to increase defense and lower damage taken from wraiths.',
    rewardItem: 'iron_sword',
    rewardQty: 1,
    xpSkill: 'combat',
    xpBonus: 100
  },
  {
    id: 'echo_2',
    title: 'Astral Echo - Voice of the Elder Mage',
    type: 'echo',
    biome: 'Enchanted Grove',
    text: 'The Celestial Realm is where the leylines are strongest. But beware, the Star Golem guards the portal... Cast spell "Reveal Map" to view hidden resources in any sector.',
    hint: 'Hint: Cast spells from the Spells tab using Mana and Mana Crystals.',
    rewardItem: 'mana_crystal',
    rewardQty: 2,
    xpSkill: 'alchemy',
    xpBonus: 120
  },
  {
    id: 'journal_3',
    title: 'Torn Log of a Ranger',
    type: 'journal',
    biome: 'Sunlit Plains',
    text: 'Day 22: Wild animals leave tracks marked with paws 🐾. Follow them to hunt game. Deer are cowardly, but Boars will attack if cornered. Alpha wolves rule the tundra.',
    hint: 'Hint: Gather paw tracks to locate animals and gain Hunting skill XP.',
    rewardItem: 'arrow',
    rewardQty: 5,
    xpSkill: 'hunting',
    xpBonus: 70
  },
  {
    id: 'carving_3',
    title: 'Ancient Druid Inscription',
    type: 'carving',
    biome: 'Misty Swamp',
    text: 'WE BURIED THE SEEDS OF MAGIC UNDER THE ENCHANTED TREES. SHROOMS IN THE SWAMP GROW VIGOROUSLY UNDER THE HEAVY RAIN, RESISTING THE VENOMOUS WRATH.',
    hint: 'Hint: Mushrooms are high-vitality food sources, but watch out for poisonous swamp spiders.',
    rewardItem: 'mushroom',
    rewardQty: 3,
    xpSkill: 'woodcutting',
    xpBonus: 90
  },
  {
    id: 'echo_3',
    title: 'Cosmic Resonance - Echo of the Void',
    type: 'echo',
    biome: 'Celestial Realm',
    text: 'We are the shadows of the stars... The Void and the Celestial are two sides of the same fabric. Combine them to craft the ultimate Harbinger Staff.',
    hint: 'Hint: Celestial Shards and Void Crystals are combined at the Magic Altar.',
    rewardItem: 'crystal',
    rewardQty: 3,
    xpSkill: 'alchemy',
    xpBonus: 150
  },
  {
    id: 'journal_4',
    title: 'Frozen Journal of the Lost Hunter',
    type: 'journal',
    biome: 'Frozen Tundra',
    text: 'The cold... it seeps into my bones. Only a warm Campfire can protect me from the freezing blizzard. I hid my stash of gems under the snowy rocks to the north.',
    hint: 'Hint: Build a campfire and stand near it to avoid HP loss during freezing cold blizzard weather.',
    rewardItem: 'gem',
    rewardQty: 1,
    xpSkill: 'hunting',
    xpBonus: 100
  },
  {
    id: 'carving_4',
    title: 'Molten Slab Glyphs',
    type: 'carving',
    biome: 'Volcanic Fields',
    text: 'FIRE SHALL REBUILD THE WORLD. THE DRAGON SLEEPS IN THE VOLCANIC FIELDS, COVERED IN SCALES SHIELDED AGAINST ALL MAGIC. USE RANGED WEAPONS TO SNIPE FROM BEYOND ITS BREATH.',
    hint: 'Hint: Ranged attacks keep you safe from a Dragon\'s massive melee strikes.',
    rewardItem: 'coal',
    rewardQty: 5,
    xpSkill: 'combat',
    xpBonus: 150
  }
];

// --- LZW Compression & Safe Storage Utilities ---
function lzw_encode(s: string): string {
  if (!s) return "";
  const dict = new Map<string, number>();
  const out: number[] = [];
  let phrase = s.charAt(0);
  let code = 256;
  for (let i = 1; i < s.length; i++) {
    const currChar = s.charAt(i);
    if (dict.has(phrase + currChar)) {
      phrase += currChar;
    } else {
      out.push(phrase.length > 1 ? dict.get(phrase)! : phrase.charCodeAt(0));
      dict.set(phrase + currChar, code);
      code++;
      phrase = currChar;
    }
  }
  out.push(phrase.length > 1 ? dict.get(phrase)! : phrase.charCodeAt(0));
  return out.map(x => String.fromCharCode(x)).join("");
}

function lzw_decode(s: string): string {
  if (!s) return "";
  const dict = new Map<number, string>();
  let currChar = s.charAt(0);
  let oldPhrase = currChar;
  const out = [currChar];
  let code = 256;
  let phrase;
  for (let i = 1; i < s.length; i++) {
    const currCode = s.charCodeAt(i);
    if (currCode < 256) {
      phrase = s.charAt(i);
    } else {
      phrase = dict.has(currCode) ? dict.get(currCode)! : (oldPhrase + currChar);
    }
    out.push(phrase);
    currChar = phrase.charAt(0);
    dict.set(code, oldPhrase + currChar);
    code++;
    oldPhrase = phrase;
  }
  return out.join("");
}

function safeSetItem(key: string, value: string): void {
  try {
    const compressed = value.startsWith("lz:") ? value : "lz:" + lzw_encode(value);
    localStorage.setItem(key, compressed);
  } catch (err) {
    console.error("Failed to set item in localStorage", err);
  }
}

function safeGetItem(key: string): string | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  if (raw.startsWith("lz:")) {
    try {
      return lzw_decode(raw.substring(3));
    } catch (err) {
      console.error("Failed to decode LZW-compressed save data", err);
      return null;
    }
  }
  return raw;
}

// --- Efficient Object Serialization & Compression for saving space ---
function compressObjs(objs: any[]): any[] {
  if (!objs) return [];
  return objs.map((o) => {
    if (!o) return null;
    if (o.type === 'tree') {
      return [0, o.tx, o.ty, o.hp, o.mhp, o.ico, o.subtype];
    }
    if (o.type === 'rock') {
      return [1, o.tx, o.ty, o.hp, o.mhp, o.ico, o.subtype];
    }
    if (o.type === 'drop') {
      return [2, o.tx, o.ty, o.item, o.qty];
    }
    if (o.type === 'fishing_hotspot') {
      return [3, o.tx, o.ty, o.hp, o.ico, o.subtype];
    }
    if (o.type === 'animal_track') {
      return [4, o.tx, o.ty, o.hp, o.ico, o.subtype];
    }
    // General case
    const arr: any[] = [5, o.type, o.tx, o.ty, o.hp, o.mhp, o.ico, o.subtype, o.item, o.qty];
    while (arr.length > 0 && arr[arr.length - 1] === undefined) {
      arr.pop();
    }
    return arr;
  }).filter(Boolean);
}

function decompressObjs(compressed: any[]): any[] {
  if (!compressed) return [];
  return compressed.map((arr) => {
    if (!Array.isArray(arr)) return arr; // Fallback for legacy save format support
    const kind = arr[0];
    if (kind === 0) {
      return { type: 'tree', tx: arr[1], ty: arr[2], hp: arr[3], mhp: arr[4], ico: arr[5], subtype: arr[6] };
    }
    if (kind === 1) {
      return { type: 'rock', tx: arr[1], ty: arr[2], hp: arr[3], mhp: arr[4], ico: arr[5], subtype: arr[6] };
    }
    if (kind === 2) {
      return { type: 'drop', tx: arr[1], ty: arr[2], item: arr[3], qty: arr[4] };
    }
    if (kind === 3) {
      return { type: 'fishing_hotspot', tx: arr[1], ty: arr[2], hp: arr[3], ico: arr[4], subtype: arr[5] };
    }
    if (kind === 4) {
      return { type: 'animal_track', tx: arr[1], ty: arr[2], hp: arr[3], ico: arr[4], subtype: arr[5] };
    }
    if (kind === 5) {
      return {
        type: arr[1],
        tx: arr[2],
        ty: arr[3],
        hp: arr[4] ?? undefined,
        mhp: arr[5] ?? undefined,
        ico: arr[6] ?? undefined,
        subtype: arr[7] ?? undefined,
        item: arr[8] ?? undefined,
        qty: arr[9] ?? undefined
      };
    }
    return arr;
  });
}


// --- Game Data ---
const MAPS = [
  { id: 0, n: 'Verdant Forest', s: 1337, m: TG, f: TD, r: TS, w: TW, wf: .12, rf: .08, sky: '#87ceeb', ef: ['wolf', 'fox', 'goblin', 'bandit', 'deer', 'pheasant', 'rabbit'], dr: { wood: .04, fiber: .02, herb: .015, berry: .012, flint: .008, stone: .02 } },
  { id: 1, n: 'Deep Forest', s: 2674, m: TG, f: TD, r: TS, w: TW, wf: .10, rf: .07, sky: '#1a3d10', ef: ['wolf', 'spider', 'skeleton', 'goblin', 'boar', 'alpha_wolf', 'viper'], dr: { wood: .04, mushroom: .016, herb: .012, venom: .008, fiber: .014, bone: .01 } },
  { id: 2, n: 'Sunlit Plains', s: 3011, m: TG, f: TD, r: TS, w: TW, wf: .05, rf: .04, sky: '#6dbadf', ef: ['fox', 'goblin', 'bandit', 'archer', 'deer', 'pheasant', 'boar', 'rabbit'], dr: { fiber: .025, herb: .018, berry: .015, flint: .01, feather: .01, honey: .01, cotton: .015 } },
  { id: 3, n: 'Sandy Desert', s: 4488, m: TSA, f: TSA, r: TS, w: TW, wf: .03, rf: .08, sky: '#f5d08a', ef: ['bandit', 'bandit_chief', 'goblin', 'orc', 'viper'], dr: { bone: .02, sulfur: .016, flint: .014, gem: .005, sand: .03, stone: .02 } },
  { id: 4, n: 'Frozen Tundra', s: 5665, m: TSN, f: TS, r: TS, w: TW, wf: .06, rf: .12, sky: '#b0d4e8', ef: ['wolf', 'bear', 'skeleton', 'orc', 'alpha_wolf'], dr: { ice_crystal: .02, bone: .01, herb: .006, crystal: .006, wood: .012 } },
  { id: 5, n: 'Misty Swamp', s: 6821, m: TSW, f: TD, r: TS, w: TW, wf: .18, rf: .04, sky: '#4a5a3a', ef: ['zombie', 'spider', 'wraith', 'goblin', 'boar', 'viper'], dr: { mushroom: .022, venom: .016, fiber: .014, silk: .009, herb: .009 } },
  { id: 6, n: 'Mountain Pass', s: 7234, m: TS, f: TD, r: TS, w: TW, wf: .04, rf: .26, sky: '#7a8898', ef: ['troll', 'bear', 'orc', 'skeleton', 'deer', 'alpha_wolf'], dr: { iron_ore: .02, crystal: .009, gem: .006, coal: .014, stone: .03, mithril_ore: .005 } },
  { id: 7, n: 'Goblin Territory', s: 8456, m: TD, f: TD, r: TS, w: TW, wf: .06, rf: .09, sky: '#7a9a6a', ef: ['goblin', 'goblin_chief', 'bandit', 'orc', 'boar', 'deer'], dr: { bone: .016, feather: .013, leather: .011, flint: .011, wood: .016 } },
  { id: 8, n: 'Coastal Shore', s: 9732, m: TSA, f: TSA, r: TS, w: TW, wf: .28, rf: .03, sky: '#4a9ad4', ef: ['bandit', 'skeleton', 'goblin', 'archer', 'pheasant', 'deer'], dr: { fish: .022, silk: .011, sand: .035, feather: .016, bone: .009 } },
  { id: 9, n: 'Ancient Ruins', s: 10551, m: TS, f: TS, r: TS, w: TW, wf: .03, rf: .20, sky: '#5a5060', ef: ['skeleton', 'golem', 'dark_mage', 'wraith'], dr: { crystal: .016, magic_essence: .011, bone: .022, gem: .013, stone: .022, ancient_rune: .003 } },
  { id: 10, n: 'Scorched Waste', s: 11889, m: TS, f: TS, r: TS, w: TLV, wf: .06, rf: .11, sky: '#8a4020', ef: ['troll', 'orc', 'orc_chief', 'dark_mage'], dr: { sulfur: .022, coal: .027, iron_ore: .014, ash_crystal: .006 } },
  { id: 11, n: 'Volcanic Fields', s: 12004, m: TS, f: TLV, r: TS, w: TLV, wf: .14, rf: .07, sky: '#cc4400', ef: ['troll', 'orc', 'golem', 'wraith', 'firedrake'], dr: { sulfur: .027, coal: .031, iron_ore: .022, crystal: .006, gem: .004 } },
  { id: 12, n: 'Orc Stronghold', s: 13377, m: TD, f: TD, r: TS, w: TW, wf: .04, rf: .09, sky: '#6a5040', ef: ['orc', 'orc_chief', 'troll', 'goblin_chief', 'boar'], dr: { bone: .022, leather: .016, iron_ore: .014, coal: .011, wood: .014 } },
  { id: 13, n: 'Bandit Outpost', s: 14220, m: TD, f: TS, r: TS, w: TW, wf: .04, rf: .13, sky: '#5a5060', ef: ['bandit', 'bandit_chief', 'archer', 'dark_mage'], dr: { iron_ore: .014, leather: .014, gem: .006, flint: .014, coal: .009 } },
  { id: 14, n: 'Crystal Cavern', s: 15641, m: TS, f: TS, r: TS, w: TW, wf: .04, rf: .20, sky: '#1a1a44', ef: ['wraith', 'dark_mage', 'skeleton', 'golem'], dr: { crystal: .036, magic_essence: .020, gem: .016, ice_crystal: .014 } },
  { id: 15, n: 'Haunted Graveyard', s: 16007, m: TD, f: TS, r: TS, w: TW, wf: .04, rf: .08, sky: '#1a1a22', ef: ['skeleton', 'zombie', 'wraith', 'dark_mage'], dr: { bone: .036, crystal: .011, magic_essence: .008, herb: .004, silk: .006 } },
  { id: 16, n: 'Undead Kingdom', s: 17890, m: TD, f: TS, r: TS, w: TW, wf: .06, rf: .11, sky: '#0a0a1a', ef: ['zombie', 'skeleton', 'wraith', 'dark_mage', 'golem'], dr: { bone: .040, magic_essence: .016, crystal: .011, silk: .009 } },
  { id: 17, n: 'Enchanted Grove', s: 18234, m: TG, f: TG, r: TS, w: TW, wf: .09, rf: .04, sky: '#2a1a4a', ef: ['dark_mage', 'wraith', 'goblin', 'spider', 'deer', 'pheasant', 'glowsheep'], dr: { magic_essence: .025, crystal: .016, herb: .027, silk: .016, mushroom: .011 } },
  { id: 18, n: "Dragon's Domain", s: 19555, m: TS, f: TLV, r: TS, w: TLV, wf: .11, rf: .09, sky: '#440000', ef: ['dragon', 'troll', 'orc_chief', 'dark_mage'], dr: { gem: .022, crystal: .016, magic_essence: .016, sulfur: .022, bone: .016 } },
  { id: 19, n: 'Corrupted Lands', s: 20001, m: TD, f: TD, r: TS, w: TLV, wf: .09, rf: .09, sky: '#080810', ef: ['dragon', 'dark_mage', 'wraith', 'orc_chief', 'bandit_chief'], dr: { magic_essence: .027, crystal: .022, sulfur: .016, bone: .027, gem: .011 } },
  { id: 20, n: 'Celestial Realm', s: 99999, m: TCR, f: TCR, r: TS, w: TW, wf: .05, rf: .05, sky: '#1a0a3a', ef: ['celestial_guardian', 'void_wraith', 'star_golem'], dr: { magic_essence: .05, crystal: .04, gem: .03, void_crystal: .02, celestial_shard: .01 } },
  { id: 21, n: 'Neon Cyber-Grid', s: 30101, m: TCR, f: TS, r: TS, w: TW, wf: .04, rf: .06, sky: '#000011', ef: ['star_golem', 'void_wraith', 'golem'], dr: { void_crystal: .025, crystal: .03, gem: .02, magic_essence: .035 } },
  { id: 22, n: 'Fungal Caverns', s: 40202, m: TSW, f: TD, r: TS, w: TW, wf: .15, rf: .10, sky: '#1a0d1a', ef: ['spider', 'zombie', 'wraith'], dr: { mushroom: .04, venom: .02, herb: .018, crystal: .015 } },
  { id: 23, n: 'Deep Trench', s: 50303, m: TW, f: TW, r: TS, w: TW, wf: .40, rf: .02, sky: '#001122', ef: ['spider', 'wraith', 'dark_mage'], dr: { fish: .05, bone: .02, magic_essence: .015 } },
  { id: 24, n: 'Steampunk Ruins', s: 60404, m: TS, f: TD, r: TS, w: TW, wf: .05, rf: .15, sky: '#221a11', ef: ['golem', 'bandit', 'archer', 'bandit_chief'], dr: { iron_ore: .035, coal: .025, stone: .04, copper_ore: .03 } },
  { id: 25, n: 'Prismatic Oasis', s: 70505, m: TSA, f: TG, r: TS, w: TW, wf: .12, rf: .04, sky: '#33ffaa', ef: ['celestial_guardian', 'fox', 'deer'], dr: { gem: .035, astral_flower: .03, magic_essence: .03, gold_ore: .025 } },
  { id: 26, n: 'Obsidian Spire', s: 80606, m: TLV, f: TS, r: TS, w: TLV, wf: .08, rf: .18, sky: '#110500', ef: ['troll', 'golem', 'dragon'], dr: { sulfur: .04, coal: .035, iron_ore: .025, crystal: .02 } },
  { id: 27, n: 'Void Rift', s: 90707, m: TCR, f: TCR, r: TS, w: TLV, wf: .05, rf: .05, sky: '#050011', ef: ['void_wraith', 'star_golem', 'dragon'], dr: { void_crystal: .04, magic_essence: .04, celestial_shard: .02 } },
  { id: 28, n: 'Atlantis Ruins', s: 10808, m: TW, f: TS, r: TS, w: TW, wf: .30, rf: .10, sky: '#0a2a3a', ef: ['skeleton', 'golem', 'wraith'], dr: { ancient_rune: .015, magic_essence: .02, crystal: .025, stone: .03 } },
  { id: 29, n: 'Sakura Garden', s: 11909, m: TG, f: TG, r: TS, w: TW, wf: .10, rf: .05, sky: '#ffcccc', ef: ['fox', 'deer', 'pheasant', 'dark_mage', 'rabbit'], dr: { astral_flower: .04, herb: .03, wood: .03, fiber: .025 } },
  { id: 30, n: 'Sky Archipelago', s: 121010, m: TCR, f: TG, r: TS, w: TW, wf: .05, rf: .05, sky: '#88ccff', ef: ['celestial_guardian', 'void_wraith', 'star_golem'], dr: { celestial_shard: .03, magic_essence: .03, gem: .025, crystal: .025 } },
  { id: 31, n: 'Aether Chrono-Rift', s: 131313, m: TCR, f: TCR, r: TS, w: TW, wf: .06, rf: .05, sky: '#0d001a', ef: ['chrono_guardian', 'rift_specter', 'star_golem', 'chrono_overlord'], dr: { temporal_shard: .06, void_crystal: .04, celestial_shard: .03, ancient_rune: .015 } }
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
  
  bandit: { n: 'Bandit Thief', ico: '🥷', hp: 45, spd: 1.6, dmg: 10, acd: 60, xp: 14, lo: { gold_coins: .8, wood: .2 }, ran: false },
  bandit_chief: { n: 'Bandit Chief', ico: '👺', hp: 160, spd: 1.2, dmg: 24, acd: 70, xp: 60, lo: { gold_coins: 1.0, gem: .2, iron_ore: .5 }, ran: false, boss: 1 },
  troll: { n: 'Cave Troll', ico: '👹', hp: 180, spd: 0.8, dmg: 35, acd: 90, xp: 80, lo: { stone: .9, coal: .4, gold_ore: .3 }, ran: false, boss: 1 },
  orc: { n: 'Orc Warrior', ico: '🧌', hp: 80, spd: 1.2, dmg: 16, acd: 75, xp: 35, lo: { leather: .6, iron_ore: .3 }, ran: false },
  orc_chief: { n: 'Orc Warlord', ico: '👑', hp: 250, spd: 0.9, dmg: 40, acd: 85, xp: 120, lo: { gem: .4, gold_ore: .5, iron_ore: .8 }, ran: false, boss: 1 },
  goblin_chief: { n: 'Goblin King', ico: '👑', hp: 140, spd: 1.5, dmg: 20, acd: 60, xp: 50, lo: { gold_coins: 1.0, flint: .8 }, ran: false, boss: 1 },

  // --- Wild game huntable animals ---
  deer: { n: 'Wild Deer', ico: '🦌', hp: 25, spd: 2.2, dmg: 0, acd: 100, xp: 12, lo: { meat: 1.0, leather: .6 }, ran: false },
  boar: { n: 'Wild Boar', ico: '🐗', hp: 45, spd: 1.4, dmg: 14, acd: 70, xp: 18, lo: { meat: 1.0, leather: .8 }, ran: false },
  pheasant: { n: 'Wild Pheasant', ico: '🦃', hp: 12, spd: 1.8, dmg: 0, acd: 100, xp: 8, lo: { meat: .6, feather: 1.0 }, ran: false },
  alpha_wolf: { n: 'Alpha Wolf', ico: '🐺', hp: 130, spd: 2.1, dmg: 24, acd: 50, xp: 55, lo: { meat: 2.0, leather: 1.5, alpha_pelt: 1.0 }, ran: false, boss: 1 },
  rabbit: { n: 'Wild Rabbit', ico: '🐇', hp: 10, spd: 2.5, dmg: 0, acd: 100, xp: 5, lo: { meat: .8, leather: .2 }, ran: false },
  glowsheep: { n: 'Glow Sheep', ico: '🐑', hp: 40, spd: 1.0, dmg: 0, acd: 100, xp: 15, lo: { fiber: 2, silk: 1 }, ran: false },
  viper: { n: 'Poisonous Viper', ico: '🐍', hp: 25, spd: 1.6, dmg: 12, acd: 45, xp: 18, lo: { venom: 1.0, leather: .4 }, ran: false },
  firedrake: { n: 'Fire Drake', ico: '🦎', hp: 120, spd: 1.3, dmg: 26, acd: 70, xp: 45, lo: { sulfur: .8, crystal: .5, magic_essence: .3 }, ran: true, boss: 1 },
  chrono_guardian: { n: 'Chrono Guardian', ico: '🤖', hp: 400, spd: 1.4, dmg: 45, acd: 65, xp: 200, lo: { temporal_shard: .6, celestial_shard: .3 }, ran: true },
  rift_specter: { n: 'Rift Specter', ico: '🌀', hp: 200, spd: 1.9, dmg: 35, acd: 55, xp: 120, lo: { void_crystal: .5, magic_essence: .5 }, ran: false },
  chrono_overlord: { n: 'Chrono Overlord', ico: '⏳', hp: 900, spd: 1.0, dmg: 70, acd: 90, xp: 600, lo: { temporal_shard: 1.0, celestial_shard: 1.0, ancient_rune: .8 }, ran: true, boss: 1 },
};

// --- Procedural Theme Definitions based on Biomes ---
const THEMES = [
  {
    id: 'medieval',
    name: 'Medieval Kingdom',
    prefixes: ['Crusader', 'Templar', 'Paladin', 'Gilded', 'Monarch', 'Chivalry', 'Dreadknight', 'Kingsguard', 'Baronial', 'Excalibur', 'Feudal', 'Lancelot', 'Royal', 'Sovereign', 'Valorous'],
    suffixes: ['Honor', 'Valor', 'Justice', 'Chivalry', 'Sovereignty', 'the Crown', 'the Citadel', 'the Keep', 'the Realm', 'the Throne', 'Fealty', 'Lords', 'Kingdom', 'Camelot', 'Gilead'],
    weapons: [
      { n: 'Broadsword', ico: '⚔️', type: 'melee', dmg: 28, spd: 22, rng: 54 },
      { n: 'Halberd', ico: '🪓', type: 'melee', dmg: 34, spd: 28, rng: 64 },
      { n: 'Crossbow', ico: '🏹', type: 'ranged', dmg: 29, spd: 35, rng: 230 },
      { n: 'Lance', ico: '🔱', type: 'melee', dmg: 36, spd: 30, rng: 70 },
    ],
    armors: [
      { n: 'Greathelm', ico: '🪖', sl: 'head', def: 6, hpBonus: 10 },
      { n: 'Gilded Chestplate', ico: '🛡️', sl: 'chest', def: 15 },
      { n: 'Steel Greaves', ico: '👖', sl: 'legs', def: 10 },
      { n: 'Iron Sabatons', ico: '🥾', sl: 'feet', def: 6, spdBonus: 0.15 },
      { n: 'Signet Ring', ico: '💍', sl: 'ring', def: 1, hpBonus: 15, mpBonus: 10 }
    ],
    desc: 'Forged in the Royal Foundries of Camelot. It bears the crest of the High King and shines with chivalrous honor.'
  },
  {
    id: 'forest',
    name: 'Verdant Forest',
    prefixes: ['Elven', 'Mossclad', 'Oakheart', 'Sylvan', 'Dryad', 'Elderwood', 'Greenwood', 'Sprout', 'Briar', 'Verdant', 'Moonlit', 'Ranger', 'Bramblewood', 'Wildgrove', 'Thornheart'],
    suffixes: ['the Woods', 'the Druids', 'the Rangers', 'the Boughs', 'the Glade', 'Moss', 'Vines', 'Bark', 'Oak', 'Faeries', 'Sylvan Whispers', 'Deepwood', 'Verdant Canopy', 'the Grove'],
    weapons: [
      { n: 'Longbow', ico: '🏹', type: 'ranged', dmg: 24, spd: 24, rng: 260 },
      { n: 'Druidic Staff', ico: '🪄', type: 'magic', dmg: 34, spd: 38, rng: 280, mp: 10, fx: 'poison', col: '#22c55e' },
      { n: 'Leaf Dagger', ico: '🗡️', type: 'melee', dmg: 22, spd: 18, rng: 48 },
    ],
    armors: [
      { n: 'Leafy Crown', ico: '👑', sl: 'head', def: 4, hpBonus: 16 },
      { n: 'Ranger Tunic', ico: '🧥', sl: 'chest', def: 10, spdBonus: 0.2 },
      { n: 'Bark Greaves', ico: '👖', sl: 'legs', def: 7 },
      { n: 'Sylvan Boots', ico: '🥾', sl: 'feet', def: 4, spdBonus: 0.3 },
      { n: 'Emerald Band', ico: '💍', sl: 'ring', def: 1, hpBonus: 20 }
    ],
    desc: 'Grown from the roots of the ancient World Tree. It hums with the wild magic of the woodland sprites.'
  },
  {
    id: 'tundra',
    name: 'Frozen Tundra',
    prefixes: ['Viking', 'Glacial', 'Iceborn', 'Boreal', 'Winter', 'Rime', 'Blizzard', 'Permafrost', 'Avalanche', 'Polar', 'Yeti', 'Aurora', 'Fjord', 'Frostbite', 'Norse'],
    suffixes: ['the North', 'the Glacier', 'the Fjord', 'Blizzards', 'the Yeti', 'the Frost Giant', 'Aurora Borealis', 'Ice Runes', 'Permafrost', 'Rime', 'Winter Frost', 'the Ice King'],
    weapons: [
      { n: 'Battleaxe', ico: '🪓', type: 'melee', dmg: 34, spd: 28, rng: 56 },
      { n: 'Frost Staff', ico: '🪄', type: 'magic', dmg: 36, spd: 40, rng: 270, mp: 15, fx: 'slow', col: '#38bdf8' },
      { n: 'Glacial Harpoon', ico: '🔱', type: 'melee', dmg: 32, spd: 26, rng: 65 }
    ],
    armors: [
      { n: 'Fur Helm', ico: '🪖', sl: 'head', def: 5, hpBonus: 18 },
      { n: 'Heavy Fur Coat', ico: '🧥', sl: 'chest', def: 13, spdBonus: -0.05 },
      { n: 'Insulated Pants', ico: '👖', sl: 'legs', def: 9 },
      { n: 'Icebound Boots', ico: '🥾', sl: 'feet', def: 5, spdBonus: 0.1 },
      { n: 'Glacier Ring', ico: '💍', sl: 'ring', def: 2, mpBonus: 20 }
    ],
    desc: 'Molded from eternal black ice from the tallest frozen peaks. The air crackles with freezing mist around it.'
  },
  {
    id: 'desert',
    name: 'Sandy Desert',
    prefixes: ['Bedouin', 'Mirage', 'Sultan', 'Scarab', 'Oasis', 'Dune', 'Sandstorm', 'Pharaoh', 'Anubis', 'Ra', 'Nomad', 'Dust', 'Desert', 'Kamil', 'Sahara'],
    suffixes: ['the Desert', 'the Pyramids', 'the Oasis', 'the Sultan', 'the Sphinx', 'the Sandstorm', 'Mirages', 'Anubis', 'the Sun God', 'Scarabs', 'Dunes', 'the Sands'],
    weapons: [
      { n: 'Scimitar', ico: '🗡️', type: 'melee', dmg: 28, spd: 18, rng: 50 },
      { n: 'Sand Scepter', ico: '🪄', type: 'magic', dmg: 38, spd: 42, rng: 290, mp: 18, fx: 'blind', col: '#eab308' },
      { n: 'Nomad Bow', ico: '🏹', type: 'ranged', dmg: 25, spd: 22, rng: 250 }
    ],
    armors: [
      { n: 'Golden Turban', ico: '👑', sl: 'head', def: 4, mpBonus: 20 },
      { n: 'Nomadic Cloak', ico: '🧥', sl: 'chest', def: 9, spdBonus: 0.25 },
      { n: 'Light Pantaloons', ico: '👖', sl: 'legs', def: 7 },
      { n: 'Mirage Sandals', ico: '🥾', sl: 'feet', def: 3, spdBonus: 0.35 },
      { n: 'Scarab Band', ico: '💍', sl: 'ring', def: 1, hpBonus: 15, mpBonus: 15 }
    ],
    desc: 'Forged in the hidden forge of an oasis under a blazing sky. It carries the warmth of the sands.'
  },
  {
    id: 'swamp',
    name: 'Misty Swamp',
    prefixes: ['Mire', 'Bog', 'Plague', 'Venom', 'Witchcraft', 'Fungal', 'Rot', 'Mud', 'Serpent', 'Hydra', 'Voodoo', 'Malaria', 'Spore', 'Damp', 'Mossy'],
    suffixes: ['the Bog', 'the Witch', 'the Leech', 'the Serpent', 'the Plague', 'Spore Cloud', 'Rotting Mud', 'Ooze', 'the Hydra', 'Hexes', 'Voodoo', 'the Mire'],
    weapons: [
      { n: 'Venom Dagger', ico: '🗡️', type: 'melee', dmg: 24, spd: 15, rng: 45 },
      { n: 'Plague Staff', ico: '🪄', type: 'magic', dmg: 42, spd: 48, rng: 310, mp: 25, fx: 'poison', col: '#a855f7' },
      { n: 'Spore Bow', ico: '🏹', type: 'ranged', dmg: 27, spd: 30, rng: 210 }
    ],
    armors: [
      { n: 'Plague Mask', ico: '🪖', sl: 'head', def: 5, mpBonus: 25 },
      { n: 'Swamp Jerkin', ico: '🧥', sl: 'chest', def: 11, hpBonus: 10 },
      { n: 'Bog Greaves', ico: '👖', sl: 'legs', def: 8 },
      { n: 'Wading Boots', ico: '🥾', sl: 'feet', def: 4, spdBonus: 0.15 },
      { n: 'Viper Band', ico: '💍', sl: 'ring', def: 1, hpBonus: 10, mpBonus: 25 }
    ],
    desc: 'Coated in a layer of glowing swamp toxins and moss. Its power derives from the dark witch of the fen.'
  },
  {
    id: 'volcanic',
    name: 'Volcanic Waste',
    prefixes: ['Obsidian', 'Magma', 'Infernal', 'Cinder', 'Embers', 'Eruption', 'Ashen', 'Sulfur', 'Lava', 'Pyroclastic', 'Salamander', 'Hellfire', 'Basalt', 'Blaze', 'Phoenix'],
    suffixes: ['the Forge', 'the Volcano', 'Lava', 'Infernal Fire', 'Hellfire', 'Magma Core', 'Sulfur', 'the Phoenix', 'Embers', 'Eruptions', 'Ashen Skies', 'the Salamander'],
    weapons: [
      { n: 'Magma Greatsword', ico: '⚔️', type: 'melee', dmg: 38, spd: 34, rng: 58 },
      { n: 'Phoenix Wand', ico: '🪄', type: 'magic', dmg: 44, spd: 46, rng: 300, mp: 22, fx: 'burn', col: '#ef4444' },
      { n: 'Ashen Longbow', ico: '🏹', type: 'ranged', dmg: 29, spd: 26, rng: 250 }
    ],
    armors: [
      { n: 'Lava Crown', ico: '👑', sl: 'head', def: 6, hpBonus: 25 },
      { n: 'Obsidian Plate', ico: '🛡️', sl: 'chest', def: 18, spdBonus: -0.1 },
      { n: 'Basalt Greaves', ico: '👖', sl: 'legs', def: 12 },
      { n: 'Magma Treads', ico: '🥾', sl: 'feet', def: 6, spdBonus: 0.2 },
      { n: 'Cinder Ring', ico: '💍', sl: 'ring', def: 2, hpBonus: 30 }
    ],
    desc: 'Submerged in volcanic rivers for a century. The molten core keeps radiating intense blazing energy.'
  },
  {
    id: 'mountain',
    name: 'Mountain Pass',
    prefixes: ['Dwarven', 'Runic', 'Stoneheart', 'Mithril', 'Boulder', 'Cavern', 'Ironclad', 'Echo', 'Crest', 'Peak', 'Mine', 'Summit', 'Gravel', 'Avalanche', 'Rock'],
    suffixes: ['the Mountain', 'the Caverns', 'the Deep Mines', 'Runes', 'the Anvil', 'the Peak', 'Boulders', 'Stonehearts', 'Dwarven Lords', 'the Mine', 'Echoes', 'Glacier Heights'],
    weapons: [
      { n: 'Warhammer', ico: '🔨', type: 'melee', dmg: 36, spd: 32, rng: 52 },
      { n: 'Mithril Pick', ico: '⛏️', type: 'melee', dmg: 28, spd: 16, rng: 50 },
      { n: 'Runic Staff', ico: '🪄', type: 'magic', dmg: 40, spd: 44, rng: 280, mp: 20, fx: 'shield', col: '#a855f7' }
    ],
    armors: [
      { n: 'Mithril Helm', ico: '🪖', sl: 'head', def: 7, hpBonus: 15 },
      { n: 'Runic Breastplate', ico: '🛡️', sl: 'chest', def: 16 },
      { n: 'Mithril Leggings', ico: '👖', sl: 'legs', def: 11 },
      { n: 'Steel Toe Boots', ico: '🥾', sl: 'feet', def: 7, spdBonus: 0.1 },
      { n: 'Deep Mine Ring', ico: '💍', sl: 'ring', def: 3, hpBonus: 20 }
    ],
    desc: 'Mined from the pristine veins of the highest mountain passes. Highly polished, sturdy, and nearly indestructible.'
  },
  {
    id: 'celestial',
    name: 'Celestial Realm',
    prefixes: ['Astral', 'Celestial', 'Cosmic', 'Solar', 'Lunar', 'Stardust', 'Nebula', 'Zenith', 'Void', 'Galaxy', 'Supernova', 'Orion', 'Eternity', 'Starfall', 'Horizon'],
    suffixes: ['the Stars', 'the Cosmos', 'the Void', 'Stardust', 'Nebulas', 'Eternity', 'the Galaxies', 'the Sun', 'the Moon', 'Zeniths', 'the Astral Void', 'Space'],
    weapons: [
      { n: 'Star-Scepter', ico: '🪄', type: 'magic', dmg: 48, spd: 48, rng: 330, mp: 30, fx: 'void', col: '#3b82f6' },
      { n: 'Solar Glaive', ico: '⚔️', type: 'melee', dmg: 42, spd: 28, rng: 62 },
      { n: 'Lunar Bow', ico: '🏹', type: 'ranged', dmg: 35, spd: 24, rng: 290 }
    ],
    armors: [
      { n: 'Stardust Diadem', ico: '👑', sl: 'head', def: 6, mpBonus: 35 },
      { n: 'Celestial Raiment', ico: '🧥', sl: 'chest', def: 13, spdBonus: 0.3 },
      { n: 'Nebula Trousers', ico: '👖', sl: 'legs', def: 10 },
      { n: 'Astral Slippers', ico: '🥾', sl: 'feet', def: 5, spdBonus: 0.4 },
      { n: 'Cosmic Loop', ico: '💍', sl: 'ring', def: 2, hpBonus: 25, mpBonus: 25 }
    ],
    desc: 'Beaming with cosmic radiation and celestial light from the higher dimensions. Highly treasured and mythical.'
  }
];

// --- Procedural NFT Item Generator (10,000 unique weapons & armor) ---
export function getNFTItem(tokenId: number): any {
  // A simple deterministic hash function from seed
  const hash = (seed: number) => {
    let x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };

  const r1 = hash(tokenId * 17);
  const r2 = hash(tokenId * 31);
  const r3 = hash(tokenId * 79);
  const r4 = hash(tokenId * 103);
  const r5 = hash(tokenId * 137);
  const r6 = hash(tokenId * 257);

  // Rarity distribution:
  // Mythic: top 0.5%
  // Legendary: next 2.5%
  // Epic: next 7%
  // Rare: next 15%
  // Uncommon: next 25%
  // Common: rest 50%
  const rarityRoll = r1;
  let rarity: 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary' | 'Mythic' = 'Common';
  let rarityColor = '#94a3b8'; // zinc
  let statMult = 1.0;

  if (rarityRoll < 0.005) {
    rarity = 'Mythic';
    rarityColor = '#ef4444'; // Red
    statMult = 3.0;
  } else if (rarityRoll < 0.03) {
    rarity = 'Legendary';
    rarityColor = '#f97316'; // Orange
    statMult = 2.2;
  } else if (rarityRoll < 0.10) {
    rarity = 'Epic';
    rarityColor = '#a855f7'; // Purple
    statMult = 1.7;
  } else if (rarityRoll < 0.25) {
    rarity = 'Rare';
    rarityColor = '#3b82f6'; // Blue
    statMult = 1.35;
  } else if (rarityRoll < 0.50) {
    rarity = 'Uncommon';
    rarityColor = '#10b981'; // Green
    statMult = 1.15;
  }

  // Pick deterministic theme from THEMES (medieval/biomes)
  const theme = THEMES[Math.floor(r3 * THEMES.length)];

  // Categories: Weapons or Armors
  const category = r2 < 0.45 ? 'weapon' : 'armor';

  const prefix = theme.prefixes[Math.floor(r4 * theme.prefixes.length)];
  const suffix = theme.suffixes[Math.floor(r5 * theme.suffixes.length)];

  let item: any = {
    id: `nft_${tokenId}`,
    tokenId,
    rarity,
    rarityColor,
    isNFT: true,
    themeId: theme.id,
    themeName: theme.name,
    desc: `${theme.desc} (Theme: ${theme.name} | Rarity: ${rarity})`
  };

  if (category === 'weapon') {
    const base = theme.weapons[Math.floor(r6 * theme.weapons.length)];
    item.n = `${prefix} ${base.n} of ${suffix} #${tokenId}`;
    item.ico = base.ico;
    item.t = 'weapon';
    item.type = base.type;
    item.dmg = Math.round(base.dmg * statMult);
    item.spd = Math.round(base.spd);
    item.rng = base.rng;
    if (base.mp !== undefined) {
      item.mp = base.mp;
      item.fx = base.fx;
      item.col = base.col;
    }
  } else {
    const base = theme.armors[Math.floor(r6 * theme.armors.length)];
    item.n = `${prefix} ${base.n} of ${suffix} #${tokenId}`;
    item.ico = base.ico;
    item.t = 'armor';
    item.sl = base.sl;
    item.def = Math.round(base.def * statMult);
    if (base.hpBonus) item.hpBonus = Math.round(base.hpBonus * statMult);
    if (base.mpBonus) item.mpBonus = Math.round(base.mpBonus * statMult);
    if (base.spdBonus) item.spdBonus = Number((base.spdBonus * statMult).toFixed(2));
  }

  // Price calculation in gold_coins
  const priceRanges: Record<string, [number, number]> = {
    Common: [60, 120],
    Uncommon: [180, 300],
    Rare: [500, 1000],
    Epic: [1800, 3500],
    Legendary: [6000, 12000],
    Mythic: [25000, 55000],
  };
  const range = priceRanges[rarity];
  const offset = hash(tokenId * 199);
  item.price = Math.round(range[0] + offset * (range[1] - range[0]));

  return item;
}

// --- Procedural NFT/Collectible Artwork Component ---
export function NFTCollectibleArt({ item }: { item: any }) {
  const isNFT = !!item.isNFT;
  const tokenId = item.tokenId !== undefined ? item.tokenId : (() => {
    // Deterministic tokenId from item.id or item.n
    const str = item.id || item.n || "";
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (h << 5) - h + str.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h) % 10000;
  })();

  const rarity = item.rarity || 'Common';
  
  // Custom color lookup for regular items
  const getColorForItem = (it: any) => {
    if (it.rarityColor) return it.rarityColor;
    const id = (it.id || "").toLowerCase();
    if (id.includes("wood")) return "#b45309";
    if (id.includes("stone")) return "#64748b";
    if (id.includes("iron")) return "#94a3b8";
    if (id.includes("coal")) return "#18181b";
    if (id.includes("fiber")) return "#10b981";
    if (id.includes("flint")) return "#14b8a6";
    if (id.includes("gold_ore") || id.includes("goldbar")) return "#fbbf24";
    if (id.includes("coin") || id.includes("gold_coins")) return "#eab308";
    if (id.includes("meat_cooked")) return "#ea580c";
    if (id.includes("meat")) return "#ef4444";
    if (id.includes("leather")) return "#d97706";
    if (id.includes("feather")) return "#38bdf8";
    if (id.includes("bone")) return "#e4e4e7";
    if (id.includes("sulfur")) return "#ca8a04";
    if (id.includes("crystal") || id.includes("mana_crystal")) return "#3b82f6";
    if (id.includes("gem")) return "#ec4899";
    if (id.includes("magic_essence") || id.includes("essence")) return "#6366f1";
    if (id.includes("apple")) return "#dc2626";
    if (id.includes("cloth")) return "#a1a1aa";
    if (id.includes("venom")) return "#22c55e";
    if (id.includes("silk")) return "#e4e4e7";
    if (id.includes("potion") || id.includes("pot")) return "#ec4899";
    if (id.includes("sword") || id.includes("blade") || id.includes("katana") || id.includes("axe") || id.includes("pickaxe")) return "#3b82f6";
    if (id.includes("crown") || id.includes("ring")) return "#fbbf24";
    if (id.includes("shield") || id.includes("plate") || id.includes("greaves")) return "#94a3b8";
    return "#475569";
  };

  const rarityColor = getColorForItem(item);
  const ico = item.ico || '❓';
  const t = item.t || 'mat';

  // Deterministic values for generative visuals from tokenId
  const seedHash = (mult: number) => {
    let val = Math.sin(tokenId * mult) * 10000;
    return val - Math.floor(val);
  };

  const ringCount = 2 + Math.floor(seedHash(13.7) * 3); // 2 to 4 rings
  const particleCount = 6 + Math.floor(seedHash(43.1) * 8); // 6 to 13 particles
  const patternType = seedHash(7.9) < 0.33 ? 'circles' : seedHash(7.9) < 0.66 ? 'diamonds' : 'cross';
  const rotationAngle = Math.round(seedHash(51.2) * 360);
  
  // Generating particles
  const particles = Array.from({ length: particleCount }).map((_, i) => {
    const angle = (i / particleCount) * Math.PI * 2 + seedHash(i * 3.1) * 0.5;
    const distance = 25 + seedHash(i * 7.4) * 35; // distance from center
    const size = 1.5 + seedHash(i * 11.9) * 3;
    const x = 50 + Math.cos(angle) * distance;
    const y = 50 + Math.sin(angle) * distance;
    const opacity = 0.3 + seedHash(i * 19.3) * 0.6;
    return { x, y, size, opacity };
  });

  // Generative background mesh
  const gridLines = 5 + Math.floor(seedHash(29.1) * 6);

  return (
    <div className="relative w-full aspect-square rounded-xl bg-zinc-950/90 overflow-hidden border border-white/10 flex items-center justify-center group/art select-none shadow-2xl mb-1">
      {/* Background glow base */}
      <div 
        className="absolute inset-0 opacity-20 filter blur-xl transition-all duration-700 group-hover/art:opacity-35"
        style={{
          background: `radial-gradient(circle, ${rarityColor} 0%, rgba(9,9,11,0) 75%)`
        }}
      />
      
      {/* Neon border glow based on rarity */}
      <div 
        className="absolute inset-x-0 bottom-0 h-[2px] opacity-70"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${rarityColor} 50%, transparent 100%)`
        }}
      />

      {/* SVG Procedural Generative Canvas */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100">
        <defs>
          <radialGradient id={`glowGrad-${tokenId}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={rarityColor} stopOpacity="0.45" />
            <stop offset="100%" stopColor="#09090b" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Generative Tech-Grid / Circuit Mesh */}
        <g opacity="0.1" stroke={rarityColor} strokeWidth="0.25">
          {Array.from({ length: gridLines }).map((_, idx) => {
            const spacing = 100 / (gridLines - 1);
            const coord = idx * spacing;
            return (
              <g key={idx}>
                <line x1={coord} y1="0" x2={coord} y2="100" />
                <line x1="0" y1={coord} x2="100" y2={coord} />
              </g>
            );
          })}
        </g>

        {/* Central Ambient Glow */}
        <circle cx="50" cy="50" r="38" fill={`url(#glowGrad-${tokenId})`} />

        {/* Orbit Rings (Tech / Magical Circles) */}
        {Array.from({ length: ringCount }).map((_, i) => {
          const r = 16 + i * 8;
          const strokeDash = i % 2 === 0 ? "4, 4" : "12, 4, 1, 4";
          return (
            <circle
              key={i}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={rarityColor}
              strokeWidth={0.25 + (i === 0 ? 0.15 : 0)}
              strokeOpacity={0.15 + (1 - i / ringCount) * 0.35}
              strokeDasharray={strokeDash}
              transform={`rotate(${rotationAngle + (i % 2 === 0 ? 1 : -1) * (tokenId % 360)}, 50, 50)`}
              className="origin-center"
              style={{
                transformOrigin: '50px 50px',
              }}
            />
          );
        })}

        {/* Generative Corner Borders */}
        <g stroke={rarityColor} strokeWidth="0.5" strokeOpacity="0.4" fill="none">
          <path d="M 6,12 L 6,6 L 12,6" />
          <path d="M 94,12 L 94,6 L 88,6" />
          <path d="M 6,88 L 6,94 L 12,94" />
          <path d="M 94,88 L 94,94 L 88,94" />
        </g>

        {/* Procedural Pattern Nodes in background */}
        <g opacity="0.2" stroke={rarityColor} strokeWidth="0.35" fill="none">
          {patternType === 'circles' && (
            <>
              <circle cx="15" cy="15" r="2" />
              <circle cx="85" cy="15" r="2" />
              <circle cx="15" cy="85" r="2" />
              <circle cx="85" cy="85" r="2" />
            </>
          )}
          {patternType === 'diamonds' && (
            <>
              <polygon points="15,13 17,15 15,17 13,15" />
              <polygon points="85,13 87,15 85,17 83,15" />
              <polygon points="15,83 17,85 15,87 13,85" />
              <polygon points="85,83 87,85 85,87 83,85" />
            </>
          )}
          {patternType === 'cross' && (
            <>
              <path d="M12,15 H18 M15,12 V18" />
              <path d="M82,15 H88 M85,12 V18" />
              <path d="M12,85 H18 M15,82 V88" />
              <path d="M82,85 H88 M85,82 V88" />
            </>
          )}
        </g>

        {/* Dynamic floating particles */}
        {particles.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={p.size}
            fill={rarityColor}
            opacity={p.opacity}
          />
        ))}
      </svg>

      {/* Main Asset Emoji Showcase with heavy stylization */}
      <div className="relative z-10 select-none transform transition-all duration-500 group-hover/art:scale-115 group-hover/art:rotate-6 flex flex-col items-center">
        {/* Soft shadow duplicate underneath */}
        <span 
          className="text-5xl sm:text-6xl absolute blur-md opacity-30 select-none pointer-events-none translate-y-1"
          style={{ color: rarityColor }}
        >
          {ico}
        </span>
        
        {/* Primary sharp emoji */}
        <span className="text-5xl sm:text-6xl drop-shadow-[0_0_15px_rgba(255,255,255,0.15)]">
          {ico}
        </span>
      </div>

      {/* Floating Hologram Stats Ribbon */}
      <div 
        className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[7px] font-mono tracking-widest text-white/50 border border-white/5 bg-black/80 uppercase scale-90"
      >
        {isNFT ? `MINT #${tokenId}` : `SERIAL #${tokenId}`}
      </div>

      <div 
        className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded text-[7px] font-mono tracking-widest text-white/50 border border-white/5 bg-black/80 uppercase scale-90"
        style={{ color: rarityColor, borderColor: `${rarityColor}22` }}
      >
        {isNFT ? (rarity) : (
          t === 'armor' ? 'ARMOR' : 
          t === 'tool' || item.id ? 'WEAPON' :
          t === 'food' || t === 'pot' ? 'CONSUMABLE' : 'RESOURCE'
        )}
      </div>
    </div>
  );
}

const baseIT: Record<string, any> = {
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
  temporal_shard: { ico: '⏳', n: 'Temporal Shard', t: 'mat' },
  meat: { ico: '🥩', n: 'Raw Meat', t: 'mat' },
  berry: { ico: '🫐', n: 'Berry', t: 'mat' },
  mushroom: { ico: '🍄', n: 'Mushroom', t: 'mat' },
  stick: { ico: '🥢', n: 'Stick', t: 'mat' },
  iron_bar: { ico: '🔩', n: 'Iron Bar', t: 'mat' },
  steel_bar: { ico: '🔧', n: 'Steel Bar', t: 'mat' },
  torch: { ico: '🔦', n: 'Torch', t: 'tool' },
  mana_crystal: { ico: '🧿', n: 'Mana Crystal', t: 'mat' },
  void_essence: { ico: '🌀', n: 'Void Essence', t: 'mat' },
  silk: { ico: '🕸️', n: 'Silk', t: 'mat' },
  dragon_scale: { ico: '🛡️', n: 'Dragon Scale', t: 'mat' },
  
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
  gold_coins: { ico: '🪙', n: 'Gold Coins', t: 'currency' },
  maple_syrup: { ico: '🍁', n: 'Maple Syrup', t: 'food', hu: 15, hp: 10 },
  apple: { ico: '🍎', n: 'Apple', t: 'food', hu: 15, hp: 5 },
  amber: { ico: '🟡', n: 'Amber', t: 'mat' },
  glowing_spore: { ico: '🍄', n: 'Glowing Spore', t: 'mat' },
  shadow_bark: { ico: '🎋', n: 'Shadow Bark', t: 'mat' },

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
  chrono_scepter: { id: 'chrono_scepter', n: 'Chrono Scepter', ico: '⏳', dmg: 95, spd: 40, rng: 320, type: 'magic', mp: 32, fx: 'time_slow', col: '#fbbf24' },
  mithril_staff: { id: 'mithril_staff', n: 'Mithril Staff', ico: '🪄', dmg: 75, spd: 40, rng: 310, type: 'magic', mp: 22, fx: 'starfall', col: '#00ffff' },
  
  campfire: { ico: '🔥', n: 'Campfire', t: 'struct' },
  workbench: { ico: '🪚', n: 'Workbench', t: 'struct' },
  forge: { ico: '⚒️', n: 'Forge', t: 'struct' },
  magic_altar: { ico: '🕋', n: 'Magic Altar', t: 'struct' },
  shelter: { ico: '⛺', n: 'Shelter', t: 'struct' },
  stone_wall: { ico: '🧱', n: 'Stone Wall', t: 'struct' },
  spike_trap_crafted: { ico: '⚙️', n: 'Spike Trap', t: 'struct' },
  mana_well: { ico: '🔲', n: 'Mana Well', t: 'struct' },
  sentry_turret: { ico: '🗼', n: 'Sentry Turret', t: 'struct' },
  
  // --- Modern Survival & Water/Food Infrastructure Expansion ---
  canteen_empty: { id: 'canteen_empty', n: 'Empty Canteen', ico: '🥤', t: 'pot', desc: 'Used to store clean water.' },
  canteen_full: { id: 'canteen_full', n: 'Full Canteen', ico: '🥤', t: 'pot', hp: 0, mp: 0, desc: 'A canteen filled with refreshing water. Fully hydrates you on use.', th: 100 },
  leather_backpack: { ico: '🎒', n: 'Leather Backpack', t: 'armor', sl: 'back', def: 1, spdBonus: 0.15, desc: 'Increases moving speed and storage capacity.' },
  military_backpack: { ico: '🎒', n: 'Military Backpack', t: 'armor', sl: 'back', def: 4, spdBonus: 0.35, desc: 'Heavy duty tactical gear. Boosts defense and speed.' },
  hunting_rifle: { id: 'hunting_rifle', n: 'Hunting Rifle', ico: '🔫', dmg: 72, spd: 45, rng: 350, type: 'ranged', mp: 0, desc: 'A long range firearms rifle. High precision damage.' },
  supply_crate: { ico: '📦', n: 'Supply Crate', t: 'struct', desc: 'Placed container. Click adjacent to store your supplies.' },
  water_reservoir: { ico: '🛢️', n: 'Water Reservoir', t: 'struct', desc: 'Stores pure drinking water. Click adjacent to hydrate and fill canteens.' },
  water_pump: { ico: '⛽', n: 'Water Pump', t: 'struct', desc: 'Extracts deep water. Place on land. Click adjacent to quench thirst.' },
  water_pipe: { ico: '🚰', n: 'Water Pipe', t: 'struct', desc: 'Distributes water from pump. Click adjacent to drink.' },
  watch_tower: { ico: '🗼', n: 'Watch Tower', t: 'struct', desc: 'A high sentry guard tower. Automatically snipes nearby hostiles.' },
  settler_shelter: { ico: '🛖', n: 'Settler Shelter', t: 'struct', desc: 'A rustic cabin. Attracts village settlers and earns +2 gold coins every 10s.' },
  town_house: { ico: '🏡', n: 'Town House', t: 'struct', desc: 'A comfortable family residence. Attracts workers and residents. Earns +6 Gold Coins passively.' },
  town_workshop: { ico: '🏭', n: 'Town Workshop', t: 'struct', desc: 'An advanced industrial workshop. Automatically crafts and yields +1 Iron Bar passively.' },
  storage_depot: { ico: '🏬', n: 'Storage Depot', t: 'struct', desc: 'A massive logistics depot. Automatically gathers +2 Wood, +2 Stone, and +2 Fiber passively.' },
  merchant_stall: { ico: '🏪', n: 'Merchant Stall', t: 'struct', desc: 'A market stall. Attracts a merchant companion who earns +5 gold coins every 10s.' },
  guard_post: { ico: '🛡️', n: 'Guard Post', t: 'struct', desc: 'A fortified command post. Spawns a resilient village Guard companion.' },
  farm_plot: { ico: '🌾', n: 'Farm Plot', t: 'struct', desc: 'An irrigated garden patch. Automatically harvests +1 Berry every 10s.' },

  stone_pickaxe: { id: 'stone_pickaxe', n: 'Stone Pickaxe', ico: '⛏️', dmg: 12, spd: 30, rng: 44, type: 'melee', mp: 0 },
  copper_pickaxe: { id: 'copper_pickaxe', n: 'Copper Pickaxe', ico: '⛏️', dmg: 16, spd: 28, rng: 44, type: 'melee', mp: 0 },
  iron_pickaxe: { id: 'iron_pickaxe', n: 'Iron Pickaxe', ico: '⛏️', dmg: 22, spd: 26, rng: 44, type: 'melee', mp: 0 },
  gold_pickaxe: { id: 'gold_pickaxe', n: 'Gold Pickaxe', ico: '⛏️', dmg: 28, spd: 24, rng: 44, type: 'melee', mp: 0 },
  mithril_pickaxe: { id: 'mithril_pickaxe', n: 'Mithril Pickaxe', ico: '⛏️', dmg: 38, spd: 20, rng: 44, type: 'melee', mp: 0 },
  copper_axe: { id: 'copper_axe', n: 'Copper Axe', ico: '🪓', dmg: 16, spd: 26, rng: 44, type: 'melee', mp: 0 },
  iron_axe: { id: 'iron_axe', n: 'Iron Axe', ico: '🪓', dmg: 22, spd: 24, rng: 44, type: 'melee', mp: 0 },
  gold_axe: { id: 'gold_axe', n: 'Gold Axe', ico: '🪓', dmg: 28, spd: 22, rng: 44, type: 'melee', mp: 0 },
  mithril_axe: { id: 'mithril_axe', n: 'Mithril Axe', ico: '🪓', dmg: 38, spd: 18, rng: 44, type: 'melee', mp: 0 },
  wood_club: { id: 'wood_club', n: 'Wooden Club', ico: '🪵', dmg: 10, spd: 32, rng: 42, type: 'melee', mp: 0 },

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

  dragon_scale_chest: { ico: '🛡️', n: 'Dragon Chest', t: 'armor', sl: 'chest', def: 35 },
  dragon_scale_helmet: { ico: '🪖', n: 'Dragon Helmet', t: 'armor', sl: 'head', def: 18 },
  dragon_scale_greaves: { ico: '👖', n: 'Dragon Greaves', t: 'armor', sl: 'legs', def: 24 },
  dragon_scale_boots: { ico: '🥾', n: 'Dragon Boots', t: 'armor', sl: 'feet', def: 14, spdBonus: 0.5 },

  celestial_blade: { id: 'celestial_blade', n: 'Celestial Blade', ico: '⚔️', dmg: 75, spd: 15, rng: 65, type: 'melee', mp: 0 },
  void_reaver_bow: { id: 'void_reaver_bow', n: 'Void Reaver Bow', ico: '🏹', dmg: 65, spd: 18, rng: 320, type: 'ranged', mp: 0 },
  harbinger_staff: { id: 'harbinger_staff', n: 'Harbinger Staff', ico: '🪄', dmg: 95, spd: 42, rng: 380, type: 'magic', mp: 35, fx: 'void', col: '#ff00aa' },

  // --- Alchemy Transmutation Lab Exclusives ---
  star_shield: { ico: '🛡️', n: 'Star Shield', t: 'armor', sl: 'chest', def: 28, hpBonus: 25 },
  aether_pickaxe: { id: 'aether_pickaxe', n: 'Aether Pickaxe', ico: '⛏️', dmg: 55, spd: 15, rng: 60, type: 'melee', mp: 0 },
  sunfire_aegis: { ico: '🔥', n: 'Sunfire Aegis', t: 'armor', sl: 'chest', def: 32, hpBonus: 40 },
  chrono_watch: { ico: '⏰', n: 'Chrono Watch', t: 'armor', sl: 'ring', def: 2, spdBonus: 0.6, mpBonus: 20 },
  philosophers_stone: { ico: '🧪', n: "Philosopher's Stone", t: 'pot' },
  immortality_elixir: { ico: '🌌', n: 'Immortality Elixir', t: 'pot' },

  // --- Adventurers Guild Expansion items ---
  guild_token: { ico: '🪙', n: 'Guild Token', t: 'mat' },
  phoenix_feather: { ico: '🔥', n: 'Phoenix Feather', t: 'pot' },
  scroll_meteor: { ico: '☄️', n: 'Scroll of Meteor', t: 'pot' },
  aegis_plate: { ico: '🛡️', n: 'Aegis Plate Armor', t: 'armor', sl: 'chest', def: 40, hpBonus: 80 },
};

export const IT = new Proxy(baseIT, {
  get(target, prop) {
    if (typeof prop === 'string' && prop.startsWith('nft_')) {
      if (!(prop in target)) {
        const tokenId = parseInt(prop.replace('nft_', ''), 10);
        if (!isNaN(tokenId) && tokenId >= 1) {
          target[prop] = getNFTItem(tokenId);
        }
      }
    }
    return target[prop as string];
  },
  has(target, prop) {
    if (typeof prop === 'string' && prop.startsWith('nft_')) {
      return true;
    }
    return prop in target;
  }
});

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
  { n: 'Shelter', out: 'shelter', cnt: 1, cat: 'Structures', c: { wood: 10, stone: 5, fiber: 8 } },
  { n: 'Stone Wall', out: 'stone_wall', cnt: 1, cat: 'Structures', c: { stone: 4 }, reqBld: 1 },
  { n: 'Spike Trap', out: 'spike_trap_crafted', cnt: 1, cat: 'Structures', c: { wood: 4, stone: 2, iron_bar: 1 }, req: 'workbench', reqBld: 2 },
  { n: 'Mana Well', out: 'mana_well', cnt: 1, cat: 'Structures', c: { stone: 8, magic_essence: 3 }, req: 'magic_altar', reqBld: 4 },
  { n: 'Sentry Turret', out: 'sentry_turret', cnt: 1, cat: 'Structures', c: { wood: 10, iron_bar: 5, magic_essence: 2 }, req: 'workbench', reqBld: 6 },

  // --- Modern Survival & Water/Food Infrastructure Recipes ---
  { n: 'Empty Canteen', out: 'canteen_empty', cnt: 1, cat: 'Potions', c: { leather: 3, wood: 1 }, req: 'workbench' },
  { n: 'Leather Backpack', out: 'leather_backpack', cnt: 1, cat: 'Armor', c: { leather: 5, fiber: 5 }, req: 'workbench' },
  { n: 'Military Backpack', out: 'military_backpack', cnt: 1, cat: 'Armor', c: { leather: 8, steel_bar: 3 }, req: 'workbench' },
  { n: 'Hunting Rifle', out: 'hunting_rifle', cnt: 1, cat: 'Weapons', c: { wood: 5, iron_bar: 8, sulfur: 4, coal: 2 }, req: 'workbench' },
  { n: 'Supply Crate', out: 'supply_crate', cnt: 1, cat: 'Structures', c: { wood: 8, iron_bar: 1 }, req: 'workbench' },
  { n: 'Water Reservoir', out: 'water_reservoir', cnt: 1, cat: 'Structures', c: { iron_bar: 4, stone: 8 }, req: 'workbench' },
  { n: 'Water Pump', out: 'water_pump', cnt: 1, cat: 'Structures', c: { iron_bar: 6, stone: 10, wood: 4 }, req: 'workbench' },
  { n: 'Water Pipe', out: 'water_pipe', cnt: 1, cat: 'Structures', c: { iron_bar: 2 }, req: 'workbench' },
  { n: 'Watch Tower', out: 'watch_tower', cnt: 1, cat: 'Structures', c: { wood: 12, iron_bar: 6, fiber: 8 }, req: 'workbench' },
  { n: 'Settler Shelter', out: 'settler_shelter', cnt: 1, cat: 'Structures', c: { wood: 15, stone: 10, fiber: 10 }, req: 'workbench' },
  { n: 'Town House', out: 'town_house', cnt: 1, cat: 'Structures', c: { wood: 30, stone: 20, fiber: 15, gold_coins: 100 }, req: 'workbench' },
  { n: 'Town Workshop', out: 'town_workshop', cnt: 1, cat: 'Structures', c: { stone: 35, iron_bar: 8, wood: 20 }, req: 'workbench' },
  { n: 'Storage Depot', out: 'storage_depot', cnt: 1, cat: 'Structures', c: { wood: 40, stone: 30, iron_bar: 4 }, req: 'workbench' },
  { n: 'Merchant Stall', out: 'merchant_stall', cnt: 1, cat: 'Structures', c: { wood: 20, fiber: 15, gold_coins: 150 }, req: 'workbench' },
  { n: 'Guard Post', out: 'guard_post', cnt: 1, cat: 'Structures', c: { stone: 20, iron_bar: 5, wood: 10 }, req: 'workbench' },
  { n: 'Farm Plot', out: 'farm_plot', cnt: 1, cat: 'Structures', c: { wood: 8, fiber: 12, berry: 5 }, req: 'workbench' },

  { n: 'Stone Pickaxe', out: 'stone_pickaxe', cnt: 1, cat: 'Weapons', c: { stone: 3, stick: 2 } },
  { n: 'Wooden Club', out: 'wood_club', cnt: 1, cat: 'Weapons', c: { wood: 3 } },
  { n: 'Copper Pickaxe', out: 'copper_pickaxe', cnt: 1, cat: 'Weapons', c: { copper_bar: 3, stick: 2 }, req: 'forge' },
  { n: 'Iron Pickaxe', out: 'iron_pickaxe', cnt: 1, cat: 'Weapons', c: { iron_bar: 3, stick: 2 }, req: 'forge' },
  { n: 'Gold Pickaxe', out: 'gold_pickaxe', cnt: 1, cat: 'Weapons', c: { gold_bar: 3, stick: 2 }, req: 'forge' },
  { n: 'Mithril Pickaxe', out: 'mithril_pickaxe', cnt: 1, cat: 'Weapons', c: { mithril_bar: 3, stick: 2 }, req: 'forge' },
  { n: 'Copper Axe', out: 'copper_axe', cnt: 1, cat: 'Weapons', c: { copper_bar: 2, stick: 1 }, req: 'forge' },
  { n: 'Iron Axe', out: 'iron_axe', cnt: 1, cat: 'Weapons', c: { iron_bar: 2, stick: 1 }, req: 'forge' },
  { n: 'Gold Axe', out: 'gold_axe', cnt: 1, cat: 'Weapons', c: { gold_bar: 2, stick: 1 }, req: 'forge' },
  { n: 'Mithril Axe', out: 'mithril_axe', cnt: 1, cat: 'Weapons', c: { mithril_bar: 2, stick: 1 }, req: 'forge' },

  // --- High-tier Equipment from Dangerous Biomes ---
  { n: 'Dragon Chestplate', out: 'dragon_scale_chest', cnt: 1, cat: 'Armor', c: { dragon_scale: 6, mithril_bar: 3 }, req: 'forge' },
  { n: 'Dragon Helmet', out: 'dragon_scale_helmet', cnt: 1, cat: 'Armor', c: { dragon_scale: 4, mithril_bar: 2 }, req: 'forge' },
  { n: 'Dragon Greaves', out: 'dragon_scale_greaves', cnt: 1, cat: 'Armor', c: { dragon_scale: 5, mithril_bar: 3 }, req: 'forge' },
  { n: 'Dragon Boots', out: 'dragon_scale_boots', cnt: 1, cat: 'Armor', c: { dragon_scale: 3, mithril_bar: 2 }, req: 'forge' },
  { n: 'Celestial Blade', out: 'celestial_blade', cnt: 1, cat: 'Weapons', c: { celestial_shard: 5, mithril_bar: 4, magic_essence: 10 }, req: 'magic_altar' },
  { n: 'Void Reaver Bow', out: 'void_reaver_bow', cnt: 1, cat: 'Weapons', c: { void_crystal: 5, silk: 6 }, req: 'magic_altar' },
  { n: 'Harbinger Staff', out: 'harbinger_staff', cnt: 1, cat: 'Weapons', c: { void_crystal: 6, celestial_shard: 3, magic_essence: 15 }, req: 'magic_altar' },
  { n: 'Chrono Scepter', out: 'chrono_scepter', cnt: 1, cat: 'Weapons', c: { temporal_shard: 5, celestial_shard: 3, magic_essence: 12 }, req: 'magic_altar' },
];

// --- Adventurers Guild Quests Definition ---
const GUILD_QUESTS = [
  { id: 'wood_novice', n: '🪓 Timber Collector', d: 'Deliver 30 wood to help fortify the guild gate.', targetType: 'wood', targetCount: 30, rewardTokens: 15, rewardItems: { gold_coins: 100, cooked_meat: 5 } },
  { id: 'ore_novice', n: '⛏️ Iron Prospector', d: 'Secure 15 iron ore for crafting new tools.', targetType: 'iron_ore', targetCount: 15, rewardTokens: 20, rewardItems: { gold_coins: 150, coal: 10 } },
  { id: 'golem_slayer', n: '⚙️ Golem Destroyer', d: 'Eliminate a Cave Golem boss causing earthquakes.', targetType: 'golem', targetCount: 1, isBoss: true, rewardTokens: 40, rewardItems: { gold_coins: 300, crystal: 5 } },
  { id: 'dragon_hunter', n: '🐉 Dragon Conqueror', d: 'Vanquish the ancient Fire Dragon of the deep.', targetType: 'dragon', targetCount: 1, isBoss: true, rewardTokens: 100, rewardItems: { gold_coins: 1000, gem: 10, magic_essence: 5 } },
  { id: 'herbs_gatherer', n: '🌿 Alchemist Botanist', d: 'Deliver 15 wild herbs to brew healing elixirs.', targetType: 'herb', targetCount: 15, rewardTokens: 15, rewardItems: { gold_coins: 120, elixir: 2 } },
  { id: 'monsters_novice', n: '🛡️ Goblin Skirmish', d: 'Cleanse the nearby zones of 5 goblin scouts.', targetType: 'goblin', targetCount: 5, rewardTokens: 25, rewardItems: { gold_coins: 200, fiber: 20 } },
  { id: 'troll_slayer', n: '👹 Troll Menace', d: 'Defeat 1 Cave Troll in the mountains.', targetType: 'troll', targetCount: 1, isBoss: true, rewardTokens: 45, rewardItems: { gold_coins: 400, gold_ore: 5 } },
  { id: 'wolves_hunt', n: '🐺 Wolf Den Cleanse', d: 'Defeat the Alpha Wolf and secure its alpha pelt.', targetType: 'alpha_wolf', targetCount: 1, isBoss: true, rewardTokens: 35, rewardItems: { gold_coins: 250, leather: 10 } },
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

const getDynamicBiomeAt = (wx: number, wy: number, seed: number, zoneMaps: any[]) => {
  if (!zoneMaps || zoneMaps.length === 0) return MAPS[0];
  
  // Find the exact floating-point zone coordinates
  const fzc = wx / ZW;
  const fzr = wy / ZH;
  
  // Base zone
  const zc = Math.max(0, Math.min(ZCOLS - 1, Math.floor(fzc)));
  const zr = Math.max(0, Math.min(ZROWS - 1, Math.floor(fzr)));
  const baseIdx = zr * ZCOLS + zc;
  const baseM = zoneMaps[baseIdx] || MAPS[0];
  
  // Calculate relative distance to center of current zone
  const dx = fzc - (zc + 0.5); // distance to center of current zone column (-0.5 to 0.5)
  const dy = fzr - (zr + 0.5); // distance to center of current zone row (-0.5 to 0.5)
  
  // If we are near the borders, we have a chance to pick the neighbor's biome instead
  // This creates a smooth organic pixelated blending of biomes!
  let targetM = baseM;
  
  // Simple seed-based pseudo-random number for this tile
  const h = Math.sin(wx * 12.9898 + wy * 78.233 + seed) * 43758.5453;
  const rand = h - Math.floor(h);
  
  // Transition width (e.g., 0.20 of a zone, which is 16 tiles)
  const transitionWidth = 0.20;
  
  let neighborX = zc;
  let neighborY = zr;
  let blendX = 0;
  let blendY = 0;
  
  if (dx > 0.5 - transitionWidth && zc < ZCOLS - 1) {
    neighborX = zc + 1;
    blendX = (dx - (0.5 - transitionWidth)) / transitionWidth; // 0 to 1
  } else if (dx < -0.5 + transitionWidth && zc > 0) {
    neighborX = zc - 1;
    blendX = (-dx - (0.5 - transitionWidth)) / transitionWidth; // 0 to 1
  }
  
  if (dy > 0.5 - transitionWidth && zr < ZROWS - 1) {
    neighborY = zr + 1;
    blendY = (dy - (0.5 - transitionWidth)) / transitionWidth; // 0 to 1
  } else if (dy < -0.5 + transitionWidth && zr > 0) {
    neighborY = zr - 1;
    blendY = (-dy - (0.5 - transitionWidth)) / transitionWidth; // 0 to 1
  }
  
  // Pick which neighbor to blend with based on our random value
  if (blendX > 0 && rand < blendX * 0.5) {
    const idx = zr * ZCOLS + neighborX;
    targetM = zoneMaps[idx] || baseM;
  } else if (blendY > 0 && rand < blendY * 0.5) {
    const idx = neighborY * ZCOLS + zc;
    targetM = zoneMaps[idx] || baseM;
  }
  
  return targetM;
};

const getProceduralNoise = (x: number, y: number, seed: number, freqScale: number = 1.0) => {
  const fs = freqScale;
  // Octave 1: Low frequency, high amplitude (main continent shape)
  const n1 = Math.sin(x * 0.02 * fs + y * 0.015 * fs + seed * 0.005) * 0.5 + 0.5;
  // Octave 2: Medium frequency (local hills and valleys)
  const n2 = Math.sin(x * 0.08 * fs - y * 0.06 * fs + seed * 0.013) * 0.25 + 0.25;
  // Octave 3: High frequency (detail texture)
  const n3 = Math.sin(x * 0.25 * fs + y * 0.22 * fs - seed * 0.021) * 0.12 + 0.12;
  
  return (n1 * 0.5 + n2 * 0.3 + n3 * 0.2);
};

const getProceduralTile = (wx: number, wy: number, M: any, seed: number, config?: any) => {
  const fs = config?.frequencyScale ?? 1.0;
  const wl = config?.waterLevel ?? 0.18;
  const cl = config?.coastLevel ?? 0.25;
  const ml = config?.mountainLevel ?? 0.78;
  
  const n = getProceduralNoise(wx, wy, seed + M.s, fs);
  
  if (n < wl) return M.w; // Water or Lava
  if (n < cl) return M.f; // Flat sand/dirt/coast
  if (n > ml) return M.r; // High rocky ridges
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
  const mouseTileRef = useRef<{ tx: number; ty: number } | null>(null);
  const [gameState, setGameState] = useState<any>(null);
  const [gameZoom, setGameZoom] = useState<number>(0.85); // default to a comfortable, spacious zoom level!
  const gameZoomRef = useRef<number>(0.85);
  const [isHUDHidden, setIsHUDHidden] = useState(false);

  useEffect(() => {
    gameZoomRef.current = gameZoom;
  }, [gameZoom]);

  const [showInv, setShowInv] = useState(false);
  const [showNFTMarket, setShowNFTMarket] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [nftSearchToken, setNftSearchToken] = useState<string>('');
  const [nftRarityFilter, setNftRarityFilter] = useState<string>('All');
  const [nftTypeFilter, setNftTypeFilter] = useState<string>('All');
  const [nftPage, setNftPage] = useState<number>(0);
  const [invCategory, setInvCategory] = useState<'all' | 'weapon' | 'armor' | 'food' | 'mat' | 'nft'>('all');
  const [selectedInvItem, setSelectedInvItem] = useState<string | null>(null);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [showCraft, setShowCraft] = useState(false);
  const [showTownShop, setShowTownShop] = useState(false);
  const [activeCrateIndex, setActiveCrateIndex] = useState<number | null>(null);
  const [activeNPC, setActiveNPC] = useState<any | null>(null);
  const [townShopType, setTownShopType] = useState<'general' | 'blacksmith' | 'alchemist'>('general');
  const [showRecipeBook, setShowRecipeBook] = useState(false);
  const [showResearch, setShowResearch] = useState(false);
  const [recipeSearch, setRecipeSearch] = useState('');
  const [recipeFilter, setRecipeFilter] = useState('All');
  const [showSkills, setShowSkills] = useState(false);
  const [showTownHub, setShowTownHub] = useState(false);
  const [showCharCustomizer, setShowCharCustomizer] = useState(false);
  const [customTownName, setCustomTownName] = useState('Camp Horizon');
  const [showQuests, setShowQuests] = useState(false);
  const [showMasteries, setShowMasteries] = useState(false);
  const [guildTab, setGuildTab] = useState<'quests' | 'store'>('quests');

  // --- Dynamic Survival Stat Tracking States ---
  const lastStats = useRef({ hp: 100, hu: 100, th: 100, mp: 100 });
  const [statChanges, setStatChanges] = useState<{ id: string; type: 'hp' | 'hu' | 'th' | 'mp'; delta: number }[]>([]);
  const [flashHp, setFlashHp] = useState(false);
  const [flashHu, setFlashHu] = useState(false);
  const [flashTh, setFlashTh] = useState(false);
  const [flashMp, setFlashMp] = useState(false);
  
  // Music & Synthesizer States
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [musicVolume, setMusicVolume] = useState(0.25);
  const [musicTrack, setMusicTrack] = useState<'ethereal' | 'verdant' | 'cosmic'>('ethereal');
  const [showMusicMenu, setShowMusicMenu] = useState(false);

  useEffect(() => {
    musicEngine.setVolume(musicVolume);
  }, [musicVolume]);

  useEffect(() => {
    if (isMusicPlaying) {
      musicEngine.play(musicTrack);
    } else {
      musicEngine.pause();
    }
  }, [isMusicPlaying, musicTrack]);

  // Track Survival Stats Changes (Health, Hunger, Thirst, Mana)
  useEffect(() => {
    if (!gameState || !gameState.pl) return;
    const currentHp = Math.round(gameState.pl.hp || 0);
    const currentHu = Math.round(gameState.pl.hu ?? 100);
    const currentTh = Math.round(gameState.pl.th ?? 100);
    const currentMp = Math.round(gameState.pl.mp ?? 100);

    const prev = lastStats.current;
    if (prev.hp !== currentHp || prev.hu !== currentHu || prev.th !== currentTh || prev.mp !== currentMp) {
      const hpDiff = currentHp - prev.hp;
      const huDiff = currentHu - prev.hu;
      const thDiff = currentTh - prev.th;
      const mpDiff = currentMp - prev.mp;

      const now = Date.now();
      const newChanges: { id: string; type: 'hp' | 'hu' | 'th' | 'mp'; delta: number }[] = [];

      if (Math.abs(hpDiff) >= 1) {
        setFlashHp(true);
        setTimeout(() => setFlashHp(false), 300);
        newChanges.push({ id: `hp-${now}-${Math.random()}`, type: 'hp', delta: hpDiff });
      }
      if (Math.abs(huDiff) >= 1) {
        setFlashHu(true);
        setTimeout(() => setFlashHu(false), 300);
        newChanges.push({ id: `hu-${now}-${Math.random()}`, type: 'hu', delta: huDiff });
      }
      if (Math.abs(thDiff) >= 1) {
        setFlashTh(true);
        setTimeout(() => setFlashTh(false), 300);
        newChanges.push({ id: `th-${now}-${Math.random()}`, type: 'th', delta: thDiff });
      }
      if (Math.abs(mpDiff) >= 1) {
        setFlashMp(true);
        setTimeout(() => setFlashMp(false), 300);
        newChanges.push({ id: `mp-${now}-${Math.random()}`, type: 'mp', delta: mpDiff });
      }

      if (newChanges.length > 0) {
        setStatChanges(prevList => [...prevList, ...newChanges].slice(-8));
      }

      lastStats.current = { hp: currentHp, hu: currentHu, th: currentTh, mp: currentMp };
    }
  }, [gameState]);

  // Periodic cleanup of old stat changes
  useEffect(() => {
    if (statChanges.length === 0) return;
    const interval = setInterval(() => {
      setStatChanges(prev => prev.filter(item => {
        const timestamp = parseInt(item.id.split('-')[1]);
        return Date.now() - timestamp < 1500;
      }));
    }, 500);
    return () => clearInterval(interval);
  }, [statChanges]);

  // --- Auto-Equip Best Weapons and Armor System ---
  const lastInvRef = useRef<Record<string, number>>({});
  const justManualUnequippedRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    if (!gameState || !gameState.pl || !gameState.pl.inv) return;
    
    const s = stateRef.current;
    if (!s || !s.pl) return;
    
    const currentInv = gameState.pl.inv;
    const prevInv = lastInvRef.current;
    
    let receivedNewItem = false;
    const itemsToCheck: string[] = [];

    for (const k of Object.keys(currentInv)) {
      const currentQty = currentInv[k] || 0;
      const prevQty = prevInv[k] || 0;
      
      if (currentQty > prevQty) {
        // Quantity increased! Check if this was a manual unequip
        if (justManualUnequippedRef.current[k]) {
          // Clear manual unequip flag and skip
          justManualUnequippedRef.current[k] = false;
        } else {
          receivedNewItem = true;
          itemsToCheck.push(k);
        }
      }
    }

    // Save current inventory as previous for the next tick
    lastInvRef.current = { ...currentInv };

    if (!receivedNewItem || itemsToCheck.length === 0) return;

    // Check if any of the newly received items is a better weapon or armor
    let stateChanged = false;

    // Helper to evaluate weapon/armor scores
    const getWeaponDmgValue = (itemKey: string | null) => {
      if (!itemKey) return 0;
      const it = IT[itemKey];
      return it?.dmg || 0;
    };

    const getArmorScore = (itemKey: string | null) => {
      if (!itemKey) return -1;
      const it = IT[itemKey];
      if (!it) return -1;
      const def = it.def || 0;
      const hpBonus = it.hpBonus || 0;
      const mpBonus = it.mpBonus || 0;
      const spdBonus = it.spdBonus || 0;
      return def * 10 + hpBonus * 0.5 + mpBonus * 0.3 + spdBonus * 20;
    };

    for (const k of itemsToCheck) {
      const it = IT[k];
      if (!it) continue;

      // 1. Check if it's a weapon/tool and better than current weapon
      const isWeapon = it.t === 'tool' || it.t === 'weapon' || (!!it.id && it.t !== 'armor');
      if (isWeapon) {
        const currentWeaponKey = s.pl.weapon || 'fists';
        const currentDmg = getWeaponDmgValue(currentWeaponKey);
        const newDmg = it.dmg || 0;
        
        if (newDmg > currentDmg) {
          s.pl.weapon = k;
          addLog(`🛡️ [Auto-Equip] Equipped stronger weapon: ${it.n} (Dmg: ${newDmg})`, '#38bdf8');
          stateChanged = true;
        }
      }

      // 2. Check if it's armor and better than current armor in its slot
      if (it.t === 'armor') {
        const slot = it.sl || 'chest';
        const currentEquippedKey = s.pl.equip[slot];
        const currentScore = getArmorScore(currentEquippedKey);
        const newScore = getArmorScore(k);

        if (newScore > currentScore) {
          // Revert current equipped stats if exists
          if (currentEquippedKey) {
            const oldItem = IT[currentEquippedKey];
            if (oldItem) {
              s.pl.inv[currentEquippedKey] = (s.pl.inv[currentEquippedKey] || 0) + 1;
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

          // Apply new item stats
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

          addLog(`🛡️ [Auto-Equip] Equipped stronger ${slot}: ${it.n} (Def: ${it.def || 0})`, '#38bdf8');
          stateChanged = true;
        }
      }
    }

    if (stateChanged) {
      // Sync lastInvRef before updating gameState to avoid immediate re-checks of stats
      lastInvRef.current = { ...s.pl.inv };
      setGameState({ ...s });
    }
  }, [gameState]);
  
  // Fishing Mini-game States
  const [isFishing, setIsFishing] = useState(false);
  const [fishingState, setFishingState] = useState<'idle' | 'waiting' | 'bite' | 'success' | 'fail'>('idle');
  const [fishingMessage, setFishingMessage] = useState('');
  const [recipes, setRecipes] = useState<any[]>(() => {
    const techOutputs = new Set<string>();
    RESEARCH_TECHS.forEach(t => t.unlocksRecipes.forEach(o => techOutputs.add(o)));

    return [
      ...RC.map(r => ({ ...r, discovered: !techOutputs.has(r.out), craftCount: 0 })),
      { n: 'Mana Potion', out: 'mana_potion', cnt: 1, cat: 'Potions', c: { herb: 1, magic_essence: 2 }, discovered: false, craftCount: 0 },
      { n: 'Void Essence', out: 'void_essence', cnt: 1, cat: 'Materials', c: { void_crystal: 2, magic_essence: 4 }, req: 'magic_altar', discovered: false, craftCount: 0 },
      { n: 'Star Shield', out: 'star_shield', cnt: 1, cat: 'Armor', c: { steel_bar: 3, gem: 1, celestial_shard: 1 }, req: 'workbench', discovered: false, craftCount: 0 },
      
      // --- Magical Lab Discoveries (Undiscovered by default) ---
      { n: 'Aether Pickaxe', out: 'aether_pickaxe', cnt: 1, cat: 'Weapons', c: { stick: 2, celestial_shard: 2, void_crystal: 1 }, req: 'magic_altar', discovered: false, craftCount: 0 },
      { n: 'Sunfire Aegis', out: 'sunfire_aegis', cnt: 1, cat: 'Armor', c: { dragon_scale: 2, sulfur: 3, gem: 1 }, req: 'magic_altar', discovered: false, craftCount: 0 },
      { n: 'Chrono Watch', out: 'chrono_watch', cnt: 1, cat: 'Armor', c: { gold_bar: 2, crystal: 2, magic_essence: 5 }, req: 'magic_altar', discovered: false, craftCount: 0 },
      { n: "Philosopher's Stone", out: 'philosophers_stone', cnt: 1, cat: 'Potions', c: { magic_essence: 8, crystal: 5, void_crystal: 2 }, req: 'magic_altar', discovered: false, craftCount: 0 },
      { n: 'Immortality Elixir', out: 'immortality_elixir', cnt: 1, cat: 'Potions', c: { herb: 8, magic_essence: 10, celestial_shard: 1 }, req: 'magic_altar', discovered: false, craftCount: 0 },
    ];
  });
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
  const [logs, setLogs] = useState<{ id: string; msg: string; col: string }[]>([]);
  const [compMode, setCompMode] = useState<'guard' | 'attack'>('guard');
  const [hotSlot, setHotSlot] = useState(0);
  const [draggedOverSlot, setDraggedOverSlot] = useState<number | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [showDeathScreen, setShowDeathScreen] = useState(false);

  // Collapse/Hide states for Left Panels to prevent screen clutter
  const [isStatusCollapsed, setIsStatusCollapsed] = useState(true);
  const [isEquipCollapsed, setIsEquipCollapsed] = useState(true); // default to true to keep screen clean!
  const [isAutoCollapsed, setIsAutoCollapsed] = useState(true); // default to true so it is highly hidden by default!
  const [isMenuBarCollapsed, setIsMenuBarCollapsed] = useState(true); // default to true to make the menu highly hidden!

  // --- Minimap States & Refs ---
  const [minimapMode, setMinimapMode] = useState<'local' | 'world'>('local');
  const [minimapZoom, setMinimapZoom] = useState<number>(1.2);
  const [isMinimapCollapsed, setIsMinimapCollapsed] = useState<boolean>(true);
  const [showMinimapLegend, setShowMinimapLegend] = useState<boolean>(false);
  const minimapCanvasRef = useRef<HTMLCanvasElement>(null);

  // Interactive state
  const [minimapPanX, setMinimapPanX] = useState<number>(0);
  const [minimapPanY, setMinimapPanY] = useState<number>(0);
  const [minimapWaypoint, setMinimapWaypoint] = useState<{ tx: number; ty: number } | null>(null);
  const [minimapHoverPos, setMinimapHoverPos] = useState<{ tx: number; ty: number; canvasX: number; canvasY: number } | null>(null);

  const minimapModeRef = useRef<'local' | 'world'>('local');
  const minimapZoomRef = useRef<number>(1.2);
  const isMinimapCollapsedRef = useRef<boolean>(true);
  
  const minimapPanXRef = useRef<number>(0);
  const minimapPanYRef = useRef<number>(0);
  const minimapWaypointRef = useRef<{ tx: number; ty: number } | null>(null);
  const minimapHoverPosRef = useRef<{ tx: number; ty: number; canvasX: number; canvasY: number } | null>(null);

  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDraggingRef = useRef<boolean>(false);
  const dragMovedRef = useRef<boolean>(false);

  useEffect(() => { minimapModeRef.current = minimapMode; }, [minimapMode]);
  useEffect(() => { minimapZoomRef.current = minimapZoom; }, [minimapZoom]);
  useEffect(() => { isMinimapCollapsedRef.current = isMinimapCollapsed; }, [isMinimapCollapsed]);
  useEffect(() => { minimapPanXRef.current = minimapPanX; }, [minimapPanX]);
  useEffect(() => { minimapPanYRef.current = minimapPanY; }, [minimapPanY]);
  useEffect(() => { minimapWaypointRef.current = minimapWaypoint; }, [minimapWaypoint]);
  useEffect(() => { minimapHoverPosRef.current = minimapHoverPos; }, [minimapHoverPos]);

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
  const [activeLore, setActiveLore] = useState<any | null>(null);

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

  // --- Procedural Generation Parameters ---
  const [genWaterLevel, setGenWaterLevel] = useState(0.18);
  const [genCoastLevel, setGenCoastLevel] = useState(0.25);
  const [genMountainLevel, setGenMountainLevel] = useState(0.78);
  const [genTreeDensity, setGenTreeDensity] = useState(1.0);
  const [genOreDensity, setGenOreDensity] = useState(1.0);
  const [genFreqScale, setGenFreqScale] = useState(1.0);
  const [selectedWorldPreset, setSelectedWorldPreset] = useState('standard');

  const genConfigRef = useRef({
    waterLevel: 0.18,
    coastLevel: 0.25,
    mountainLevel: 0.78,
    treeDensity: 1.0,
    oreDensity: 1.0,
    frequencyScale: 1.0
  });

  useEffect(() => {
    genConfigRef.current = {
      waterLevel: genWaterLevel,
      coastLevel: genCoastLevel,
      mountainLevel: genMountainLevel,
      treeDensity: genTreeDensity,
      oreDensity: genOreDensity,
      frequencyScale: genFreqScale
    };
  }, [genWaterLevel, genCoastLevel, genMountainLevel, genTreeDensity, genOreDensity, genFreqScale]);

  const applyWorldPreset = (presetId: string) => {
    setSelectedWorldPreset(presetId);
    if (presetId === 'standard') {
      setGenWaterLevel(0.18);
      setGenCoastLevel(0.25);
      setGenMountainLevel(0.78);
      setGenTreeDensity(1.0);
      setGenOreDensity(1.0);
      setGenFreqScale(1.0);
    } else if (presetId === 'archipelago') {
      setGenWaterLevel(0.42);
      setGenCoastLevel(0.48);
      setGenMountainLevel(0.85);
      setGenTreeDensity(1.2);
      setGenOreDensity(0.8);
      setGenFreqScale(1.4);
    } else if (presetId === 'desolate') {
      setGenWaterLevel(0.04);
      setGenCoastLevel(0.08);
      setGenMountainLevel(0.70);
      setGenTreeDensity(0.3);
      setGenOreDensity(1.4);
      setGenFreqScale(0.75);
    } else if (presetId === 'rainforest') {
      setGenWaterLevel(0.24);
      setGenCoastLevel(0.32);
      setGenMountainLevel(0.82);
      setGenTreeDensity(2.2);
      setGenOreDensity(0.7);
      setGenFreqScale(0.85);
    } else if (presetId === 'highlands') {
      setGenWaterLevel(0.10);
      setGenCoastLevel(0.16);
      setGenMountainLevel(0.60);
      setGenTreeDensity(0.7);
      setGenOreDensity(1.8);
      setGenFreqScale(1.2);
    } else if (presetId === 'swamp') {
      setGenWaterLevel(0.28);
      setGenCoastLevel(0.42);
      setGenMountainLevel(0.86);
      setGenTreeDensity(1.6);
      setGenOreDensity(0.6);
      setGenFreqScale(1.1);
    }
  };

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

  const recipesRef = useRef<any[]>([]);
  useEffect(() => { recipesRef.current = recipes; }, [recipes]);

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
      const raw = safeGetItem(`wild_survival_save_${id}`);
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
      let activeStr = jsonStr;
      if (jsonStr && jsonStr.startsWith("lz:")) {
        activeStr = lzw_decode(jsonStr.substring(3));
      }
      const data = JSON.parse(activeStr);
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
      s.pl.th = data.pl.th ?? 100;
      s.pl.sta = data.pl.sta ?? 100;
      s.pl.mp = data.pl.mp ?? 100;
      s.pl.mmp = data.pl.mmp || 100;
      s.pl.inv = data.pl.inv;
      s.pl.equip = { head: null, chest: null, legs: null, feet: null, ring: null, back: null, ...(data.pl.equip || {}) };
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
        hunting: { lvl: 1, xp: 0, xpNext: 100 },
        smithing: { lvl: 1, xp: 0, xpNext: 100 },
        farming: { lvl: 1, xp: 0, xpNext: 100 },
        building: { lvl: 1, xp: 0, xpNext: 100 }
      };
      if (!s.pl.skills.building) {
        s.pl.skills.building = { lvl: 1, xp: 0, xpNext: 100 };
      }
      s.pl.discoveredChunks = data.pl.discoveredChunks || {};
      s.pl.guildTokens = data.pl.guildTokens ?? 0;
      s.pl.activeQuests = data.pl.activeQuests || {};
      s.pl.activeQuestsProgress = data.pl.activeQuestsProgress || {};
      s.pl.ico = data.pl.ico || '🧍';
      s.pl.class = data.pl.class || 'Survivor';
      s.pl.charName = data.pl.charName || 'Hero';
      s.pl.townName = data.pl.townName || 'Camp Horizon';
      s.pl.townLvl = data.pl.townLvl || 1;
      s.pl.masteries = data.pl.masteries || {
        adrenaline: 0,
        double_harvest: 0,
        lucky_miner: 0,
        toughened_hide: 0,
        vampiric_strikes: 0,
        sages_wisdom: 0
      };
      
      const loadedTechs = data.pl.unlockedTechs || [];
      s.pl.unlockedTechs = loadedTechs;

      setRecipes(prevRecipes => {
        return prevRecipes.map(r => {
          const techThatUnlocksThis = RESEARCH_TECHS.find(t => t.unlocksRecipes.includes(r.out));
          if (techThatUnlocksThis) {
            return { ...r, discovered: loadedTechs.includes(techThatUnlocksThis.id) };
          }
          return r;
        });
      });

      // 2. Restore World Objects
      s.objs = decompressObjs(data.objs) || [];

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
      s.weather = data.weather || {
        type: 'clear',
        timer: 4500,
        label: 'Clear Skies',
        icon: '☀️',
        threat: 'None',
        desc: 'Perfect survival conditions. Standard movement and regeneration.'
      };

      // Restore seed and config
      s.worldSeed = data.worldSeed ?? 1337;
      setWorldSeed(s.worldSeed);
      if (data.genConfig) {
        setGenWaterLevel(data.genConfig.waterLevel ?? 0.18);
        setGenCoastLevel(data.genConfig.coastLevel ?? 0.25);
        setGenMountainLevel(data.genConfig.mountainLevel ?? 0.78);
        setGenTreeDensity(data.genConfig.treeDensity ?? 1.0);
        setGenOreDensity(data.genConfig.oreDensity ?? 1.0);
        setGenFreqScale(data.genConfig.frequencyScale ?? 1.0);
        genConfigRef.current = {
          waterLevel: data.genConfig.waterLevel ?? 0.18,
          coastLevel: data.genConfig.coastLevel ?? 0.25,
          mountainLevel: data.genConfig.mountainLevel ?? 0.78,
          treeDensity: data.genConfig.treeDensity ?? 1.0,
          oreDensity: data.genConfig.oreDensity ?? 1.0,
          frequencyScale: data.genConfig.frequencyScale ?? 1.0
        };
      }

      // Re-generate zoneMaps
      const restoredZoneMaps: any[] = [];
      for (let zr = 0; zr < ZROWS; zr++) {
        for (let zc = 0; zc < ZCOLS; zc++) {
          restoredZoneMaps.push(getProceduralBiomeForZone(zc, zr, s.worldSeed));
        }
      }
      s.zoneMaps = restoredZoneMaps;

      // Handle Cave vs Surface Restore
      s.inCave = data.inCave || false;
      if (s.inCave && data.surfacePlCoords) {
        // Build surface zoneMaps and surfaceWorld procedural tiles for safety when exiting the cave
        const surfaceZoneMaps: any[] = [];
        for (let zr = 0; zr < ZROWS; zr++) {
          for (let zc = 0; zc < ZCOLS; zc++) {
            surfaceZoneMaps.push(getProceduralBiomeForZone(zc, zr, s.worldSeed));
          }
        }
        const surfaceWorld: number[][] = [];
        for (let zr = 0; zr < ZROWS; zr++) {
          for (let zc = 0; zc < ZCOLS; zc++) {
            const mi = zr * ZCOLS + zc;
            const M = surfaceZoneMaps[mi];
            const ox = zc * ZW, oy = zr * ZH;
            const isTownZone = (zc === 1 && zr === 0) || (zc === 4 && zr === 4) || (zc === 2 && zr === 6) || (zc === 7 && zr === 2);
            const isBanditZone = (zc === 2 && zr === 1) || (zc === 5 && zr === 3) || (zc === 6 && zr === 5);

            for (let ly = 0; ly < ZH; ly++) {
              if (!surfaceWorld[oy + ly]) surfaceWorld[oy + ly] = [];
              for (let lx = 0; lx < ZW; lx++) {
                const wx = ox + lx, wy = oy + ly;
                const tileM = getDynamicBiomeAt(wx, wy, s.worldSeed, surfaceZoneMaps);
                if (isTownZone && lx >= 34 && lx <= 46 && ly >= 34 && ly <= 46) {
                  surfaceWorld[wy][wx] = TS;
                } else if (isBanditZone && lx >= 37 && lx <= 43 && ly >= 37 && ly <= 43) {
                  surfaceWorld[wy][wx] = TD;
                } else {
                  surfaceWorld[wy][wx] = getProceduralTile(wx, wy, tileM, s.worldSeed, genConfigRef.current);
                }
              }
            }
          }
        }

        s.surfacePlCoords = {
          x: data.surfacePlCoords.x,
          y: data.surfacePlCoords.y,
          world: surfaceWorld,
          objs: decompressObjs(data.surfacePlCoords.objs) || [],
          enemies: [],
          zoneMaps: surfaceZoneMaps,
          lastZc: data.surfacePlCoords.lastZc,
          lastZr: data.surfacePlCoords.lastZr
        };

        // Reconstruct the procedurally skinned Cave world tile grid
        const surfaceBiome = getProceduralBiomeForZone(s.surfacePlCoords.lastZc, s.surfacePlCoords.lastZr, s.worldSeed);
        const bName = surfaceBiome?.n || 'Verdant Forest';
        const isIceCave = bName.includes('Frozen') || bName.includes('Tundra');
        const isFireCave = bName.includes('Volcanic') || bName.includes('Scorched') || bName.includes('Dragon');

        const caveWorld: number[][] = [];
        const borderWallTile = isFireCave ? TLV : TW;
        const floorTile = isIceCave ? TSN : TS;

        for (let y = 0; y < WH; y++) {
          caveWorld[y] = [];
          for (let x = 0; x < WW; x++) {
            caveWorld[y][x] = borderWallTile;
          }
        }
        for (let y = 5; y < WH - 5; y++) {
          for (let x = 5; x < WW - 5; x++) {
            caveWorld[y][x] = floorTile;
          }
        }
        s.world = caveWorld;
      } else {
        s.inCave = false;
        s.surfacePlCoords = null;

        // Re-generate surface World tile grid
        const newWorldGrid: number[][] = [];
        for (let zr = 0; zr < ZROWS; zr++) {
          for (let zc = 0; zc < ZCOLS; zc++) {
            const mi = zr * ZCOLS + zc;
            const M = s.zoneMaps[mi];
            const ox = zc * ZW, oy = zr * ZH;
            const isTownZone = (zc === 1 && zr === 0) || (zc === 4 && zr === 4) || (zc === 2 && zr === 6) || (zc === 7 && zr === 2);
            const isBanditZone = (zc === 2 && zr === 1) || (zc === 5 && zr === 3) || (zc === 6 && zr === 5);

            for (let ly = 0; ly < ZH; ly++) {
              if (!newWorldGrid[oy + ly]) newWorldGrid[oy + ly] = [];
              for (let lx = 0; lx < ZW; lx++) {
                const wx = ox + lx, wy = oy + ly;
                const tileM = getDynamicBiomeAt(wx, wy, s.worldSeed, s.zoneMaps);
                
                // Town plaza paved stone floor
                if (isTownZone && lx >= 34 && lx <= 46 && ly >= 34 && ly <= 46) {
                  newWorldGrid[wy][wx] = TS; // Stone
                } else if (isBanditZone && lx >= 37 && lx <= 43 && ly >= 37 && ly <= 43) {
                  newWorldGrid[wy][wx] = TD; // Dirt floor
                } else {
                  newWorldGrid[wy][wx] = getProceduralTile(wx, wy, tileM, s.worldSeed, genConfigRef.current);
                }
              }
            }
          }
        }
        s.world = newWorldGrid;
      }

      // 5. Purge transient objects
      s.enemies = [];
      s.projs = [];
      s.parts = [];

      // 6. Center camera
      const initZoom = gameZoomRef.current;
      s.cam.x = s.pl.x - (window.innerWidth / initZoom) / 2;
      s.cam.y = s.pl.y - (window.innerHeight / initZoom) / 2;

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
          th: s.pl.th || 100,
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
          skills: s.pl.skills,
          discoveredChunks: s.pl.discoveredChunks || {},
          guildTokens: s.pl.guildTokens || 0,
          activeQuests: s.pl.activeQuests || {},
          activeQuestsProgress: s.pl.activeQuestsProgress || {},
          masteries: s.pl.masteries || { adrenaline: 0, double_harvest: 0, lucky_miner: 0, toughened_hide: 0, vampiric_strikes: 0, sages_wisdom: 0 },
          unlockedTechs: s.pl.unlockedTechs || []
        },
        objs: compressObjs(s.objs),
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
        weather: s.weather || {
          type: 'clear',
          timer: 4500,
          label: 'Clear Skies',
          icon: '☀️',
          threat: 'None',
          desc: 'Perfect survival conditions. Standard movement and regeneration.'
        },
        worldSeed: s.worldSeed || 1337,
        genConfig: genConfigRef.current,
        inCave: s.inCave || false,
        surfacePlCoords: s.inCave ? {
          x: s.surfacePlCoords?.x ?? 0,
          y: s.surfacePlCoords?.y ?? 0,
          objs: compressObjs(s.surfacePlCoords?.objs || []),
          lastZc: s.surfacePlCoords?.lastZc ?? 0,
          lastZr: s.surfacePlCoords?.lastZr ?? 0
        } : null,
        timestamp: Date.now()
      };

      safeSetItem(`wild_survival_save_${slotId}`, JSON.stringify(saveData));
      addLog(`Saved game in Slot ${slotId.toUpperCase()}!`, '#4df8aa');
      loadSlotMetadata();
    } catch (err) {
      console.error(err);
      addLog("Save failed!", "#f87171");
    }
  }, [loadSlotMetadata]);

  // Load progress
  const loadGame = useCallback((slotId: string) => {
    const raw = safeGetItem(`wild_survival_save_${slotId}`);
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
            let activeStr = data.saveData;
            if (activeStr && activeStr.startsWith("lz:")) {
              activeStr = lzw_decode(activeStr.substring(3));
            }
            cloudData[doc.id] = JSON.parse(activeStr);
          }
        } catch (e) {
          console.error("Failed to parse cloud save", doc.id, e);
        }
      });
      setCloudSlots(cloudData);
    } catch (err) {
      console.error("Failed to fetch cloud saves:", err);
      addLog("Failed to fetch cloud saves", "#f87171");
      handleFirestoreError(err, OperationType.LIST, `users/${userId}/saves`);
    } finally {
      setIsCloudSyncing(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        addLog(`Welcome back, ${currentUser.displayName || 'Survivor'}!`, '#60a5fa');
        // Ensure user document exists/updates in Firestore using robust creation/update check
        const userDocRef = doc(db, "users", currentUser.uid);
        getDoc(userDocRef).then((docSnap) => {
          if (!docSnap.exists()) {
            // Document does not exist: perform clean creation
            setDoc(userDocRef, {
              uid: currentUser.uid,
              email: currentUser.email || "",
              displayName: currentUser.displayName || "Survivor",
              createdAt: new Date().toISOString()
            }).catch(err => {
              console.error("Failed to sync user to Firestore (create):", err);
              handleFirestoreError(err, OperationType.CREATE, `users/${currentUser?.uid}`);
            });
          } else {
            // Document exists: update only if displayName changed
            const existingData = docSnap.data();
            if (existingData && existingData.displayName !== currentUser.displayName) {
              setDoc(userDocRef, {
                displayName: currentUser.displayName || "Survivor"
              }, { merge: true }).catch(err => {
                console.error("Failed to sync user to Firestore (update):", err);
                handleFirestoreError(err, OperationType.UPDATE, `users/${currentUser?.uid}`);
              });
            }
          }
        }).catch(err => {
          console.error("Failed to get user profile on sync:", err);
          handleFirestoreError(err, OperationType.GET, `users/${currentUser?.uid}`);
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
  
  const handleSyncCloudInventory = async () => {
    if (!auth.currentUser) {
      addLog("Please sign in to sync cloud inventory!", "#fbbf24");
      return;
    }
    try {
      setIsCloudSyncing(true);
      const cloudInv = await getUserInventoryFromFirestore(auth.currentUser.uid);
      if (cloudInv) {
        const s = stateRef.current;
        if (s && s.pl) {
          // Merge items
          s.pl.inv = { ...s.pl.inv, ...cloudInv };
          setGameState({ ...s });
          addLog("📦 Cloud inventory synced and merged successfully! Check your tabs.", "#10b981");
        }
      } else {
        addLog("No cloud inventory data found on autosave slot.", "#fbbf24");
      }
    } catch (err) {
      addLog("Failed to sync cloud inventory!", "#f87171");
    } finally {
      setIsCloudSyncing(false);
    }
  };

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
    const raw = safeGetItem(`wild_survival_save_${slotId}`);
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
          th: s.pl.th || 100,
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
          skills: s.pl.skills,
          discoveredChunks: s.pl.discoveredChunks || {},
          guildTokens: s.pl.guildTokens || 0,
          activeQuests: s.pl.activeQuests || {},
          activeQuestsProgress: s.pl.activeQuestsProgress || {},
          masteries: s.pl.masteries || { adrenaline: 0, double_harvest: 0, lucky_miner: 0, toughened_hide: 0, vampiric_strikes: 0, sages_wisdom: 0 },
          unlockedTechs: s.pl.unlockedTechs || []
        },
        objs: compressObjs(s.objs),
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
        weather: s.weather || {
          type: 'clear',
          timer: 4500,
          label: 'Clear Skies',
          icon: '☀️',
          threat: 'None',
          desc: 'Perfect survival conditions. Standard movement and regeneration.'
        },
        worldSeed: s.worldSeed || 1337,
        genConfig: genConfigRef.current,
        inCave: s.inCave || false,
        surfacePlCoords: s.inCave ? {
          x: s.surfacePlCoords?.x ?? 0,
          y: s.surfacePlCoords?.y ?? 0,
          objs: compressObjs(s.surfacePlCoords?.objs || []),
          lastZc: s.surfacePlCoords?.lastZc ?? 0,
          lastZr: s.surfacePlCoords?.lastZr ?? 0
        } : null,
        timestamp: Date.now()
      };

      safeSetItem('wild_survival_save_autosave', JSON.stringify(saveData));
      addLog("💾 Autosaved progress", "#38bdf8");
      loadSlotMetadata();
      if (auth.currentUser) {
        backupToCloud('autosave');
      }
    } catch (err) {
      console.error("Autosave failed:", err);
    }
  }, [loadSlotMetadata, backupToCloud]);

  const enterCave = (s: any, caveType: string) => {
    // 1. Save surface state
    s.surfacePlCoords = {
      x: s.pl.x,
      y: s.pl.y,
      world: s.world,
      objs: s.objs,
      enemies: s.enemies,
      zoneMaps: s.zoneMaps,
      lastZc: s.lastZc,
      lastZr: s.lastZr
    };
    s.inCave = true;

    // Determine surface biome of entry to procedurally skin the cave!
    const surfaceBiome = getProceduralBiomeForZone(s.lastZc, s.lastZr, s.worldSeed);
    const bName = surfaceBiome?.n || 'Verdant Forest';
    
    let isIceCave = bName.includes('Frozen') || bName.includes('Tundra');
    let isFireCave = bName.includes('Volcanic') || bName.includes('Scorched') || bName.includes('Dragon');

    const caveWorld: number[][] = [];
    const borderWallTile = isFireCave ? TLV : TW; // lava walls for fire caves, dark water for others
    const floorTile = isIceCave ? TSN : TS; // snow floors for ice caves, stone for others

    for (let y = 0; y < WH; y++) {
      caveWorld[y] = [];
      for (let x = 0; x < WW; x++) {
        caveWorld[y][x] = borderWallTile;
      }
    }
    
    // Carve a 50x50 playable cave area from (300, 300) to (350, 350)
    const startX = 300, startY = 300, caveSize = 50;
    for (let y = startY; y < startY + caveSize; y++) {
      for (let x = startX; x < startX + caveSize; x++) {
        const isWall = x === startX || x === startX + caveSize - 1 || y === startY || y === startY + caveSize - 1 || (x % 5 === 0 && y % 5 === 0);
        caveWorld[y][x] = isWall ? borderWallTile : floorTile;
      }
    }
    
    const caveObjs: any[] = [];
    const caveEnemies: any[] = [];
    
    // Place ladder exit right at (startX + 25, startY + 25)
    const lcx = startX + 25, lcy = startY + 25;
    caveWorld[lcy][lcx] = floorTile; // clear wall
    caveObjs.push({ type: 'cave_exit', tx: lcx, ty: lcy, ico: '🪜', hp: 999 });
    
    // Place treasure chests, traps, and crystals randomly inside carved cavern!
    const caveRng = mkRng(Math.random() * 99999);
    for (let k = 0; k < 30; k++) {
      const tx = startX + 2 + Math.floor(caveRng() * (caveSize - 4));
      const ty = startY + 2 + Math.floor(caveRng() * (caveSize - 4));
      if (Math.abs(tx - lcx) < 3 && Math.abs(ty - lcy) < 3) continue;
      
      const randVal = caveRng();
      if (randVal < 0.4) {
        // Place glowing crystal node
        let sub = 'crystal';
        let ico = '💎';
        if (isFireCave) {
          sub = caveRng() < 0.5 ? 'sulfur' : 'gold';
          ico = sub === 'sulfur' ? '🟡' : '💛';
        } else if (isIceCave) {
          sub = caveRng() < 0.5 ? 'crystal' : 'mana_crystal';
          ico = sub === 'crystal' ? '❄️' : '🧿';
        } else {
          sub = caveRng() < 0.35 ? 'void_crystal' : caveRng() < 0.7 ? 'crystal' : 'mana_crystal';
          ico = sub === 'void_crystal' ? '🔮' : sub === 'crystal' ? '💎' : '🧿';
        }
        caveObjs.push({ type: 'rock', tx, ty, hp: 4, mhp: 4, ico, subtype: sub });
      } else if (randVal < 0.7) {
        // Place Spike Trap!
        caveObjs.push({ type: 'spike_trap', tx, ty, ico: isFireCave ? '🌋' : isIceCave ? '❄️' : '⚙️', hp: 999, triggered: false });
      } else if (randVal < 0.85) {
        // Place Cave Treasure Chest!
        caveObjs.push({ type: 'cave_treasure', tx, ty, ico: '👑', hp: 1 });
      }
    }
    
    // Spawn Cave Monsters!
    for (let k = 0; k < 10; k++) {
      const ex = startX + 5 + Math.floor(caveRng() * (caveSize - 10));
      const ey = startY + 5 + Math.floor(caveRng() * (caveSize - 10));
      if (Math.abs(ex - lcx) < 5 && Math.abs(ey - lcy) < 5) continue;
      
      let monsterTypes = ['spider', 'skeleton', 'wraith'];
      if (isFireCave) {
        monsterTypes = ['troll', 'dark_mage', 'firedrake'];
      } else if (isIceCave) {
        monsterTypes = ['wolf', 'bear', 'wraith'];
      }

      const eid = monsterTypes[Math.floor(caveRng() * monsterTypes.length)];
      const et = ET[eid];
      if (et) {
        caveEnemies.push({
          id: Math.random(),
          x: ex * TZ + TZ/2,
          y: ey * TZ + TZ/2,
          hp: et.hp * (isFireCave ? 1.5 : 1.2),
          mhp: et.hp * (isFireCave ? 1.5 : 1.2),
          eid,
          spd: et.spd * 0.95,
          dmg: et.dmg * 1.15,
          acd: et.acd,
          cd: 0,
          ran: et.ran,
          spawnZc: 0,
          spawnZr: 0,
          isCaveEnemy: true
        });
      }
    }
    
    // Replace active states
    s.world = caveWorld;
    s.objs = caveObjs;
    s.enemies = caveEnemies;
    
    s.pl.x = lcx * TZ + TZ/2;
    s.pl.y = lcy * TZ + TZ/2;
    s.pl.targetX = s.pl.x;
    s.pl.targetY = s.pl.y;
    s.pl.isGridMoving = false;
    
    s.lastZc = 0;
    s.lastZr = 0;
    
    let caveTitle = 'Forgotten Cave';
    let skyBg = '#08060a';
    if (isFireCave) {
      caveTitle = 'Volcanic Fire Core';
      skyBg = '#270800';
      addLog("🌋 Entered the Volcanic Fire Core! Watch out for molten lava flows and volcanic beasts!", "#ef4444");
    } else if (isIceCave) {
      caveTitle = 'Frozen Glacial Cavern';
      skyBg = '#05111c';
      addLog("❄️ Entered the Frozen Glacial Cavern! Watch out for frostbite and icy paths!", "#38bdf8");
    } else {
      addLog("🦇 Entered Forgotten Cave! Look out for spike traps and hidden treasures!", "#a855f7");
    }

    s.zoneMaps = [{ n: caveTitle, s: 1234, sky: skyBg, ef: isFireCave ? ['troll', 'dark_mage'] : isIceCave ? ['wolf', 'bear'] : ['spider', 'skeleton', 'wraith'], dr: {} }];
    spawnExplosion(s, s.pl.x, s.pl.y, isFireCave ? '#f97316' : isIceCave ? '#38bdf8' : '#a855f7', 15, 'ring');
    setGameState({ ...s });
  };

  const exitCave = (s: any) => {
    if (!s.surfacePlCoords) return;
    
    // Restore surface state
    s.world = s.surfacePlCoords.world;
    s.objs = s.surfacePlCoords.objs;
    s.enemies = s.surfacePlCoords.enemies;
    s.zoneMaps = s.surfacePlCoords.zoneMaps;
    s.lastZc = s.surfacePlCoords.lastZc;
    s.lastZr = s.surfacePlCoords.lastZr;
    
    s.pl.x = s.surfacePlCoords.x;
    s.pl.y = s.surfacePlCoords.y;
    s.pl.targetX = s.pl.x;
    s.pl.targetY = s.pl.y;
    s.pl.isGridMoving = false;
    
    s.inCave = false;
    s.surfacePlCoords = null;
    
    addLog("🌞 Returned to the surface realms!", "#38bdf8");
    spawnExplosion(s, s.pl.x, s.pl.y, '#38bdf8', 12, 'spark');
    setGameState({ ...s });
  };

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
      hp: 100, mhp: 100, hu: 100, th: 100, sta: 100, mp: 100, mmp: 100,
      ico: '🧍', class: 'Survivor', charName: 'Hero', townName: 'Camp Horizon', townLvl: 1,
      inv: {
        wood: 25, stone: 15, fiber: 15, herb: 8, berry: 10, torch: 2,
        stone_axe: 1, shortbow: 1, raw_meat: 5, cooked_meat: 3, gold_coins: 1000
      },
      equip: {
        head: 'leather_cap',
        chest: 'leather_vest',
        legs: 'leather_trousers',
        feet: 'leather_boots',
        ring: null,
        back: null
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
        hunting: { lvl: 1, xp: 0, xpNext: 100 },
        smithing: { lvl: 1, xp: 0, xpNext: 100 },
        farming: { lvl: 1, xp: 0, xpNext: 100 },
        building: { lvl: 1, xp: 0, xpNext: 100 }
      },
      discoveredChunks: {},
      guildTokens: 0,
      activeQuests: {},
      activeQuestsProgress: {},
      masteries: {
        adrenaline: 0,
        double_harvest: 0,
        lucky_miner: 0,
        toughened_hide: 0,
        vampiric_strikes: 0,
        sages_wisdom: 0
      }
    };

    const world: number[][] = [];
    const objs: any[] = [];
    const initialEnemies: any[] = [];
    
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
        let spawnedNPCInZone = false;

        const isTownZone = (zc === 1 && zr === 0) || (zc === 4 && zr === 4) || (zc === 2 && zr === 6) || (zc === 7 && zr === 2);
        const isBanditZone = (zc === 2 && zr === 1) || (zc === 5 && zr === 3) || (zc === 6 && zr === 5);
        const isCaveZone = (zc === 0 && zr === 1) || (zc === 3 && zr === 3) || (zc === 5 && zr === 4) || (zc === 1 && zr === 5) || (zc === 6 && zr === 2) || (zc === 4 && zr === 7);

        for (let ly = 0; ly < ZH; ly++) {
          if (!world[oy + ly]) world[oy + ly] = [];
          for (let lx = 0; lx < ZW; lx++) {
            const wx = ox + lx, wy = oy + ly;
            const tileM = getDynamicBiomeAt(wx, wy, currentSeed, zoneMaps);
            
            // Town plaza paved stone floor
            if (isTownZone && lx >= 34 && lx <= 46 && ly >= 34 && ly <= 46) {
              world[wy][wx] = TS; // Stone
            } else if (isBanditZone && lx >= 37 && lx <= 43 && ly >= 37 && ly <= 43) {
              world[wy][wx] = TD; // Dirt floor
            } else {
              world[wy][wx] = getProceduralTile(wx, wy, tileM, currentSeed, genConfigRef.current);
            }
            
            const inTownPlaza = isTownZone && lx >= 32 && lx <= 48 && ly >= 32 && ly <= 48;
            const inBanditCamp = isBanditZone && lx >= 35 && lx <= 45 && ly >= 35 && ly <= 45;

            // Objects Placement
            if (lx > 2 && lx < ZW - 2 && ly > 2 && ly < ZH - 2 && !inTownPlaza && !inBanditCamp) {
              const randVal = rng();
              const tileType = world[wy][wx];
              
              // Procedural friendly NPC Spawning (At most 1 per zone, rare chance on main ground)
              if (!spawnedNPCInZone && (tileType === tileM.m || tileType === tileM.f) && lx > 6 && lx < ZW - 6 && ly > 6 && ly < ZH - 6) {
                if (randVal < 0.0003) {
                  let npcType = 'tame_dog';
                  let npcIco = '🐕';
                  
                  const allowed = ['tame_dog', 'lost_explorer'];
                  if (tileM.n.includes('Enchanted') || tileM.n.includes('Forest')) {
                    allowed.push('elven_druid');
                  }
                  
                  const chosenIdx = Math.floor(rng() * allowed.length);
                  npcType = allowed[chosenIdx];
                  
                  if (npcType === 'tame_dog') npcIco = '🐕';
                  else if (npcType === 'lost_explorer') npcIco = '🧭';
                  else if (npcType === 'elven_druid') npcIco = '🧝‍♀️';
                  
                  objs.push({ type: npcType, tx: wx, ty: wy, hp: 999, mhp: 999, ico: npcIco });
                  spawnedNPCInZone = true;
                }
              }
              
              if (tileType === tileM.m || tileType === tileM.f) {
                // Spawn Trees based on Biome (4.5x Spawn Rate)
                if (randVal < tileM.wf * 4.5 * (genConfigRef.current.treeDensity ?? 1.0)) {
                  let treeIco = '🌲';
                  let treeHp = 3;
                  let treeSubtype = 'oak';
                  const subRand = rng();
                  
                  if (tileM.n.includes('Desert')) {
                    treeIco = '🌵';
                    treeSubtype = 'cactus';
                    treeHp = 2;
                  } else if (tileM.n.includes('Frozen') || tileM.n.includes('Tundra')) {
                    if (subRand < 0.3) {
                      treeIco = '🌲';
                      treeSubtype = 'redwood';
                      treeHp = 8;
                    } else {
                      treeIco = '❄️';
                      treeSubtype = 'snowpine';
                      treeHp = 4;
                    }
                  } else if (tileM.n.includes('Swamp')) {
                    if (subRand < 0.3) {
                      treeIco = '🎋';
                      treeSubtype = 'shadowwood';
                      treeHp = 4;
                    } else {
                      treeIco = '🌴';
                      treeSubtype = 'willow';
                      treeHp = 3;
                    }
                  } else if (tileM.n.includes('Scorched') || tileM.n.includes('Volcanic')) {
                    treeIco = '🪵';
                    treeSubtype = 'dead';
                    treeHp = 2;
                  } else if (tileM.n.includes('Enchanted')) {
                    if (subRand < 0.35) {
                      treeIco = '🍄';
                      treeSubtype = 'glowshroom';
                      treeHp = 3;
                    } else {
                      treeIco = '🌸';
                      treeSubtype = 'blossom';
                      treeHp = 4;
                    }
                  } else if (tileM.n.includes('Celestial')) {
                    if (subRand < 0.3) {
                      treeIco = '🎋';
                      treeSubtype = 'shadowwood';
                      treeHp = 4;
                    } else {
                      treeIco = '🌌';
                      treeSubtype = 'cosmic';
                      treeHp = 5;
                    }
                  } else {
                    // Forest, Plains, etc.
                    if (subRand < 0.15) {
                      treeIco = '🍁';
                      treeSubtype = 'maple';
                      treeHp = 4;
                    } else if (subRand < 0.3) {
                      treeIco = '🍎';
                      treeSubtype = 'apple';
                      treeHp = 3;
                    } else if (subRand < 0.7) {
                      treeIco = '🌳';
                      treeSubtype = 'birch';
                      treeHp = 3;
                    } else {
                      treeIco = '🌲';
                      treeSubtype = 'oak';
                      treeHp = 3;
                    }
                  }
                  
                  objs.push({ type: 'tree', tx: wx, ty: wy, hp: treeHp, mhp: treeHp, ico: treeIco, subtype: treeSubtype });
                }
              } else if (tileType === tileM.r || (tileType === tileM.m && randVal < tileM.rf * 2.0)) {
                // Spawn Rocks/Ores on high ridges (4.5x rate) or occasionally on main ground (2.0x rate)
                const isRidge = tileType === tileM.r;
                const spawnLimit = (isRidge ? tileM.rf * 4.5 : tileM.rf * 2.0) * (genConfigRef.current.oreDensity ?? 1.0);
                
                if (randVal < spawnLimit) {
                  let rockIco = '🪨';
                  let rockHp = 4;
                  let rockSubtype = 'stone';
                  const oreRand = rng();
                  
                  // Rare chance for a magic Mana Crystal node to grow on Leylines
                  const isMagicBiome = tileM.n.includes('Crystal Cavern') || tileM.n.includes('Enchanted Grove') || tileM.n.includes('Celestial') || tileM.n.includes('Ancient Ruins');
                  const manaCrystalChance = isMagicBiome ? 0.15 : 0.04;
                  
                  if (rng() < manaCrystalChance) {
                    rockIco = '🧿';
                    rockSubtype = 'mana_crystal';
                    rockHp = 5;
                  } else if (tileM.n.includes('Celestial')) {
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
                  } else {
                    // Unified rich, map-wide ore generation so that all raw items for crafting are available for the entire map
                    if (oreRand < 0.08) {
                      rockIco = '🪐';
                      rockSubtype = 'mithril';
                      rockHp = 8;
                    } else if (oreRand < 0.16) {
                      rockIco = '✨';
                      rockSubtype = 'celestial';
                      rockHp = 8;
                    } else if (oreRand < 0.24) {
                      rockIco = '🔮';
                      rockSubtype = 'void_crystal';
                      rockHp = 6;
                    } else if (oreRand < 0.35) {
                      rockIco = '💛';
                      rockSubtype = 'gold';
                      rockHp = 6;
                    } else if (oreRand < 0.46) {
                      rockIco = '💎';
                      rockSubtype = 'crystal';
                      rockHp = 5;
                    } else if (oreRand < 0.56) {
                      rockIco = '🟡';
                      rockSubtype = 'sulfur';
                      rockHp = 3;
                    } else if (oreRand < 0.70) {
                      rockIco = '⚙️';
                      rockSubtype = 'iron';
                      rockHp = 5;
                    } else if (oreRand < 0.84) {
                      rockIco = '🪙';
                      rockSubtype = 'copper';
                      rockHp = 4;
                    } else if (oreRand < 0.94) {
                      rockIco = '🖤';
                      rockSubtype = 'coal';
                      rockHp = 4;
                    } else {
                      rockIco = '🪨';
                      rockSubtype = 'stone';
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
                  for (const [k, v] of Object.entries(tileM.dr)) {
                    if (rng() < (v as number) * 3.0) {
                      objs.push({ type: 'drop', tx: wx, ty: wy, item: k, qty: 1 + Math.floor(rng() * 2) });
                    }
                  }
                  // Universal map-wide raw crafting material drops (small chance) so all crafting resources are available map-wide
                  const universalDrops = ['wood', 'fiber', 'stone', 'iron_ore', 'copper_ore', 'gold_ore', 'mithril_ore', 'coal', 'sulfur', 'crystal', 'magic_essence', 'dragon_scale', 'alpha_pelt', 'leather', 'silk', 'bone', 'venom', 'mushroom', 'herb'];
                  universalDrops.forEach(item => {
                    if (rng() < 0.003) { // 0.3% chance per tile per item to ensure a healthy but balanced scatter of items
                      objs.push({ type: 'drop', tx: wx, ty: wy, item, qty: 1 + Math.floor(rng() * 2) });
                    }
                  });
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

        // Deterministic Lore Node per Zone (spawned in landable positions)
        const loreRng = mkRng(M.s + mi * 12345 + currentSeed + 888);
        const loreLx = 15 + Math.floor(loreRng() * (ZW - 30));
        const loreLy = 15 + Math.floor(loreRng() * (ZH - 30));
        const loreWx = ox + loreLx;
        const loreWy = oy + loreLy;

        // Force ground to be land (not water/lava) to allow reaching it
        world[loreWy][loreWx] = M.m;

        // Find matching lore entry for this biome, or random fallback
        let matchingLore = LORE_ENTRIES.find(le => le.biome === M.n);
        if (!matchingLore) {
          matchingLore = LORE_ENTRIES[mi % LORE_ENTRIES.length];
        }

        let loreIco = '📓';
        if (matchingLore.type === 'carving') loreIco = '🗿';
        else if (matchingLore.type === 'echo') loreIco = '🌀';

        // Add the lore node
        objs.push({
          type: 'lore_node',
          tx: loreWx,
          ty: loreWy,
          ico: loreIco,
          subtype: matchingLore.type,
          loreId: matchingLore.id,
          hp: 1,
          mhp: 1
        });

        if (isTownZone) {
          const cx = ox + 40;
          const cy = oy + 40;
          objs.push({ type: 'fountain', tx: cx, ty: cy, hp: 999, mhp: 999, ico: '⛲' });
          objs.push({ type: 'town_merchant', tx: cx - 2, ty: cy, hp: 999, mhp: 999, ico: '🧔' });
          objs.push({ type: 'blacksmith_merchant', tx: cx + 2, ty: cy, hp: 999, mhp: 999, ico: '⚒️' });
          objs.push({ type: 'alchemist_merchant', tx: cx, ty: cy - 2, hp: 999, mhp: 999, ico: '🧙‍♂️' });
          objs.push({ type: 'town_house', tx: cx - 5, ty: cy - 5, ico: '🏛️', hp: 999 });
          objs.push({ type: 'town_house', tx: cx + 5, ty: cy - 5, ico: '🏠', hp: 999 });
          objs.push({ type: 'town_house', tx: cx - 5, ty: cy + 5, ico: '🏡', hp: 999 });
          objs.push({ type: 'town_house', tx: cx + 5, ty: cy + 5, ico: '🏰', hp: 999 });
          objs.push({ type: 'tavern_bard', tx: cx, ty: cy + 2, hp: 999, mhp: 999, ico: '🪕' });
          objs.push({ type: 'resource_trader', tx: cx - 2, ty: cy + 2, hp: 999, mhp: 999, ico: '🤝' });
        }

        if (isBanditZone) {
          const cx = ox + 40;
          const cy = oy + 40;
          objs.push({ type: 'camp_fire', tx: cx, ty: cy, hp: 999, mhp: 999, ico: '🔥' });
          objs.push({ type: 'camp_tent', tx: cx - 3, ty: cy - 3, hp: 999, mhp: 999, ico: '⛺' });
          objs.push({ type: 'camp_tent', tx: cx + 3, ty: cy - 3, hp: 999, mhp: 999, ico: '⛺' });
          objs.push({ type: 'bandit_chest', tx: cx, ty: cy + 3, hp: 1, mhp: 1, ico: '📦' });

          const guards = ['bandit', 'archer', 'bandit_chief'];
          guards.forEach((eid, idx) => {
            const et = ET[eid];
            if (et) {
              initialEnemies.push({
                id: Math.random() + idx,
                x: (cx + (idx === 0 ? -2 : idx === 1 ? 2 : 0)) * TZ + TZ/2,
                y: (cy + (idx === 2 ? 2 : -2)) * TZ + TZ/2,
                hp: et.hp,
                mhp: et.hp,
                eid,
                spd: et.spd,
                dmg: et.dmg,
                acd: et.acd,
                cd: 0,
                ran: et.ran,
                spawnZc: zc,
                spawnZr: zr,
                isCaveEnemy: false
              });
            }
          });
        }

        if (isCaveZone) {
          objs.push({ type: 'cave_entrance', tx: ox + 30, ty: oy + 30, hp: 999, mhp: 999, ico: '🕳️' });
        }
      }
    }

    // Spawn a basic starting hut for shelter at (40, 37) (above player's spawn at 40,40)
    const startTx = 40;
    const startTy = 37;
    // Clear any existing procedural obstacle on the path/location
    for (let i = objs.length - 1; i >= 0; i--) {
      const o = objs[i];
      if (o.tx >= 38 && o.tx <= 42 && o.ty >= 36 && o.ty <= 41) {
        objs.splice(i, 1);
      }
    }
    // Push the basic hut
    objs.push({
      type: 'settler_shelter',
      tx: startTx,
      ty: startTy,
      hp: 150,
      mhp: 150,
      ico: '🛖',
      n: 'Basic Starting Hut',
      owner: 'player'
    });

    const newState = {
      pl: initialPl,
      world,
      objs,
      enemies: initialEnemies,
      companions: [],
      projs: [],
      parts: [],
      ticks: 0,
      day: 1,
      dayTime: 0.4,
      waveNum: 0,
      waveTimer: 300,
      waveActive: false,
      weather: {
        type: 'clear',
        timer: 4500,
        label: 'Clear Skies',
        icon: '☀️',
        threat: 'None',
        desc: 'Perfect survival conditions. Standard movement and regeneration.'
      },
      cam: { x: initialPl.x - (window.innerWidth / gameZoomRef.current) / 2, y: initialPl.y - (window.innerHeight / gameZoomRef.current) / 2 },
      camShake: 0,
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

  // Persistent Hotbar Keybindings: 1-8 for swapping and binding items
  useEffect(() => {
    const handleHotbarHotkeys = (e: KeyboardEvent) => {
      // Prevent running hotkeys if typing in inputs or textarea
      const target = e.target as HTMLElement;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') {
        return;
      }

      // Check if key is 1-8
      if (e.key >= '1' && e.key <= '8') {
        const slotIdx = parseInt(e.key, 10) - 1;

        // BINDING MECHANISM:
        // If inventory modal is open, allow binding the hovered or selected item to this slot
        if (showInv) {
          const itemToBind = hoveredItem || selectedInvItem;
          if (itemToBind && itemToBind !== 'fists') {
            e.preventDefault();
            assignToHotbar(itemToBind, slotIdx);
            return;
          }
        }

        // SWAPPING/EQUIPPING MECHANISM:
        // Select slot or use the item in it
        e.preventDefault();
        handleHotbarClick(slotIdx);
      }

      // Toggle HUD visibility
      if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        setIsHUDHidden(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleHotbarHotkeys);
    return () => {
      window.removeEventListener('keydown', handleHotbarHotkeys);
    };
  }, [showInv, hoveredItem, selectedInvItem, hotSlot, gameState]);

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

    const discoverMapAroundPlayer = (s: any) => {
      if (!s || !s.pl) return;
      const tx = Math.floor(s.pl.x / TZ);
      const ty = Math.floor(s.pl.y / TZ);
      const cx = Math.floor(tx / 10);
      const cy = Math.floor(ty / 10);
      
      if (!s.pl.discoveredChunks) {
        s.pl.discoveredChunks = {};
      }
      
      let changed = false;
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const ncx = cx + dx;
          const ncy = cy + dy;
          if (ncx >= 0 && ncx < 40 && ncy >= 0 && ncy < 40) {
            const key = `${ncx}_${ncy}`;
            if (!s.pl.discoveredChunks[key]) {
              s.pl.discoveredChunks[key] = true;
              changed = true;
            }
          }
        }
      }
      return changed;
    };

    const drawMinimap = (s: any) => {
      const canvas = minimapCanvasRef.current;
      if (!canvas) return;
      const mctx = canvas.getContext('2d');
      if (!mctx) return;

      mctx.clearRect(0, 0, canvas.width, canvas.height);

      const isWorldMode = minimapModeRef.current === 'world';
      const zoom = minimapZoomRef.current;

      const ptx = Math.floor(s.pl.x / TZ);
      const pty = Math.floor(s.pl.y / TZ);

      if (isWorldMode) {
        const chunkCount = 40;
        const cellSize = canvas.width / chunkCount;
        const revealAll = s.activeSpells?.revealMapTimer > 0;

        for (let cy = 0; cy < chunkCount; cy++) {
          for (let cx = 0; cx < chunkCount; cx++) {
            // Check chunk discovery (each chunk is 16x16 tiles)
            const chunkX = Math.floor((cx / chunkCount) * (WW / 10));
            const chunkY = Math.floor((cy / chunkCount) * (WH / 10));
            const isDiscovered = revealAll || (s.pl.discoveredChunks && s.pl.discoveredChunks[`${chunkX}_${chunkY}`]);
            
            const ty = Math.floor((cy / chunkCount) * WH);
            const tx = Math.floor((cx / chunkCount) * WW);
            const tile = s.world[ty]?.[tx] ?? 0;
            const tc = TC[tile] || TC[0];

            if (isDiscovered) {
              mctx.fillStyle = tc[0];
            } else {
              mctx.fillStyle = tc[2]; // Render beautiful biome dark fog of war!
            }
            mctx.fillRect(cx * cellSize, cy * cellSize, cellSize + 0.5, cellSize + 0.5);

            if (cx % 8 === 0 || cy % 8 === 0) {
              mctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
              if (cx % 8 === 0) mctx.fillRect(cx * cellSize, cy * cellSize, 1, cellSize);
              if (cy % 8 === 0) mctx.fillRect(cx * cellSize, cy * cellSize, cellSize, 1);
            }
          }
        }

        // Highlight the player's active zone
        const currentZoneC = Math.floor(ptx / ZW);
        const currentZoneR = Math.floor(pty / ZH);
        mctx.strokeStyle = 'rgba(34, 211, 238, 0.4)';
        mctx.lineWidth = 1.5;
        mctx.strokeRect(currentZoneC * 8 * cellSize, currentZoneR * 8 * cellSize, 8 * cellSize, 8 * cellSize);

        // Player icon on world minimap
        const px = (s.pl.x / (WW * TZ)) * canvas.width;
        const py = (s.pl.y / (WH * TZ)) * canvas.height;

        const pulse = 1 + Math.sin(s.ticks * 0.1) * 0.3;
        mctx.fillStyle = 'rgba(34, 197, 94, 0.3)';
        mctx.beginPath();
        mctx.arc(px, py, 6 * pulse, 0, Math.PI * 2);
        mctx.fill();

        mctx.fillStyle = '#22c55e';
        mctx.beginPath();
        mctx.arc(px, py, 3, 0, Math.PI * 2);
        mctx.fill();
        mctx.strokeStyle = '#ffffff';
        mctx.lineWidth = 0.75;
        mctx.stroke();

        // Draw Waypoint on World minimap if active
        if (minimapWaypointRef.current) {
          const wp = minimapWaypointRef.current;
          const wpx = (wp.tx / WW) * canvas.width;
          const wpy = (wp.ty / WH) * canvas.height;
          const wpPulse = 1 + Math.sin(s.ticks * 0.15) * 0.4;

          mctx.fillStyle = 'rgba(34, 211, 238, 0.4)';
          mctx.beginPath();
          mctx.arc(wpx, wpy, 6 * wpPulse, 0, Math.PI * 2);
          mctx.fill();

          mctx.fillStyle = '#22d3ee';
          mctx.beginPath();
          mctx.arc(wpx, wpy, 2.5, 0, Math.PI * 2);
          mctx.fill();
          mctx.strokeStyle = '#ffffff';
          mctx.lineWidth = 0.75;
          mctx.stroke();
        }

        // Draw Cave Entrances on World Minimap Scan
        const caveZones = [
          { zc: 0, zr: 1 },
          { zc: 3, zr: 3 },
          { zc: 5, zr: 4 },
          { zc: 1, zr: 5 },
          { zc: 6, zr: 2 },
          { zc: 4, zr: 7 },
        ];
        for (const cz of caveZones) {
          const etx = cz.zc * ZW + 30;
          const ety = cz.zr * ZH + 30;
          const cx = (etx / WW) * canvas.width;
          const cy = (ety / WH) * canvas.height;
          
          const cpulse = 1 + Math.sin(s.ticks * 0.15 + cz.zc) * 0.4;
          mctx.fillStyle = 'rgba(236, 72, 153, 0.4)';
          mctx.beginPath();
          mctx.arc(cx, cy, 3 * cpulse, 0, Math.PI * 2);
          mctx.fill();
          
          mctx.fillStyle = '#ec4899';
          mctx.beginPath();
          mctx.arc(cx, cy, 1.5, 0, Math.PI * 2);
          mctx.fill();
        }

        // Draw Shelters on World Minimap Scan
        for (const o of s.objs) {
          if (o.type === 'shelter' || o.type === 'settler_shelter') {
            const sx = (o.tx / WW) * canvas.width;
            const sy = (o.ty / WH) * canvas.height;

            const spulse = 1 + Math.sin(s.ticks * 0.1) * 0.3;
            mctx.fillStyle = 'rgba(234, 179, 8, 0.4)';
            mctx.beginPath();
            mctx.arc(sx, sy, 5 * spulse, 0, Math.PI * 2);
            mctx.fill();

            mctx.fillStyle = '#eab308';
            mctx.beginPath();
            mctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
            mctx.fill();
            mctx.strokeStyle = '#ffffff';
            mctx.lineWidth = 0.75;
            mctx.stroke();
          }
        }

      } else {
        const range = Math.round(18 / zoom);
        const size = range * 2 + 1;
        const tileSize = canvas.width / size;
        const revealAll = s.activeSpells?.revealMapTimer > 0;

        for (let dy = -range; dy <= range; dy++) {
          for (let dx = -range; dx <= range; dx++) {
            const tx = ptx + dx;
            const ty = pty + dy;

            const cx = Math.floor(tx / 10);
            const cy = Math.floor(ty / 10);

            const canvasX = (dx + range) * tileSize;
            const canvasY = (dy + range) * tileSize;

            if (tx >= 0 && tx < WW && ty >= 0 && ty < WH) {
              const isDiscovered = revealAll || (s.pl.discoveredChunks && s.pl.discoveredChunks[`${cx}_${cy}`]);
              const tile = s.world[ty][tx];
              const tc = TC[tile] || TC[0];

              if (isDiscovered) {
                mctx.fillStyle = tc[0];
              } else {
                mctx.fillStyle = tc[2]; // Procedural map layout dark fog of war!
              }
              mctx.fillRect(canvasX, canvasY, tileSize + 0.5, tileSize + 0.5);
            } else {
              mctx.fillStyle = '#020408';
              mctx.fillRect(canvasX, canvasY, tileSize + 0.5, tileSize + 0.5);
            }
          }
        }

        // Draw Objects on Local Minimap
        for (const o of s.objs) {
          const dx = o.tx - ptx;
          const dy = o.ty - pty;
          if (Math.abs(dx) <= range && Math.abs(dy) <= range) {
            const canvasX = (dx + range) * tileSize + tileSize / 2;
            const canvasY = (dy + range) * tileSize + tileSize / 2;

            if (o.type === 'shelter' || o.type === 'settler_shelter') {
              const spulse = 1 + Math.sin(s.ticks * 0.1) * 0.3;
              mctx.fillStyle = 'rgba(234, 179, 8, 0.4)';
              mctx.beginPath();
              mctx.arc(canvasX, canvasY, 6 * spulse, 0, Math.PI * 2);
              mctx.fill();

              mctx.fillStyle = '#eab308';
              mctx.beginPath();
              mctx.arc(canvasX, canvasY, 3.5, 0, Math.PI * 2);
              mctx.fill();
              mctx.strokeStyle = '#ffffff';
              mctx.lineWidth = 1;
              mctx.stroke();
            } else if (o.type === 'campfire' || o.type === 'workbench' || o.type === 'forge' || o.type === 'magic_altar') {
              mctx.fillStyle = '#f97316';
              mctx.beginPath();
              mctx.arc(canvasX, canvasY, 2.5, 0, Math.PI * 2);
              mctx.fill();
            } else if (o.type === 'rock') {
              let rockCol = '#94a3b8';
              if (o.subtype === 'copper') rockCol = '#f97316';
              else if (o.subtype === 'iron') rockCol = '#818cf8';
              else if (o.subtype === 'coal') rockCol = '#4b5563';
              else if (o.subtype === 'gold') rockCol = '#facc15';
              else if (o.subtype === 'mithril') rockCol = '#22d3ee';
              else if (o.subtype === 'sulfur') rockCol = '#fbbf24';
              else if (o.subtype === 'mana_crystal') rockCol = '#c084fc';
              else if (o.subtype === 'void_crystal' || o.subtype === 'crystal') rockCol = '#ec4899';
              else if (o.subtype === 'celestial') rockCol = '#38bdf8';
              
              mctx.fillStyle = rockCol;
              mctx.beginPath();
              mctx.arc(canvasX, canvasY, 2, 0, Math.PI * 2);
              mctx.fill();
              
              mctx.strokeStyle = '#000000';
              mctx.lineWidth = 0.35;
              mctx.stroke();
            } else if (o.type === 'tree') {
              let treeCol = '#15803d';
              if (o.subtype === 'cactus') treeCol = '#a3e635';
              else if (o.subtype === 'snowpine') treeCol = '#93c5fd';
              else if (o.subtype === 'blossom') treeCol = '#f472b6';
              else if (o.subtype === 'cosmic') treeCol = '#a855f7';
              
              mctx.fillStyle = treeCol;
              mctx.beginPath();
              mctx.arc(canvasX, canvasY, 2, 0, Math.PI * 2);
              mctx.fill();
              
              mctx.strokeStyle = '#000000';
              mctx.lineWidth = 0.35;
              mctx.stroke();
            } else if (o.type === 'drop') {
              let dropCol = '#f1f5f9';
              if (o.item === 'wood' || o.item === 'stick') dropCol = '#b45309';
              else if (o.item === 'stone' || o.item === 'flint') dropCol = '#6b7280';
              else if (o.item === 'fiber' || o.item === 'cotton') dropCol = '#10b981';
              else if (o.item === 'berry' || o.item === 'snowberry') dropCol = '#c084fc';
              else if (o.item === 'mushroom') dropCol = '#f472b6';
              else if (o.item === 'herb') dropCol = '#34d399';
              else if (o.item === 'coal') dropCol = '#374151';
              else if (o.item?.includes('ore')) dropCol = '#f97316';
              
              mctx.fillStyle = dropCol;
              mctx.beginPath();
              mctx.arc(canvasX, canvasY, 1.3, 0, Math.PI * 2);
              mctx.fill();
              
              mctx.strokeStyle = '#000000';
              mctx.lineWidth = 0.3;
              mctx.stroke();
            } else if (o.type === 'portal') {
              const p = 1 + Math.sin(s.ticks * 0.15) * 0.4;
              mctx.fillStyle = 'rgba(168, 85, 247, 0.4)';
              mctx.beginPath();
              mctx.arc(canvasX, canvasY, 4 * p, 0, Math.PI * 2);
              mctx.fill();
              mctx.fillStyle = '#a855f7';
              mctx.beginPath();
              mctx.arc(canvasX, canvasY, 2, 0, Math.PI * 2);
              mctx.fill();
            } else if (o.type === 'cave_entrance') {
              const p = 1 + Math.sin(s.ticks * 0.1) * 0.4;
              mctx.fillStyle = 'rgba(236, 72, 153, 0.4)';
              mctx.beginPath();
              mctx.arc(canvasX, canvasY, 5 * p, 0, Math.PI * 2);
              mctx.fill();
              mctx.fillStyle = '#ec4899';
              mctx.beginPath();
              mctx.arc(canvasX, canvasY, 3, 0, Math.PI * 2);
              mctx.fill();
            } else if (o.type === 'cave_exit') {
              mctx.fillStyle = '#10b981';
              mctx.beginPath();
              mctx.arc(canvasX, canvasY, 3, 0, Math.PI * 2);
              mctx.fill();
            }
          }
        }

        // Draw enemies
        if (s.enemies) {
          for (const e of s.enemies) {
            const etx = Math.floor(e.x / TZ);
            const ety = Math.floor(e.y / TZ);
            const dx = etx - ptx;
            const dy = ety - pty;
            if (Math.abs(dx) <= range && Math.abs(dy) <= range) {
              const canvasX = (dx + range) * tileSize + tileSize / 2;
              const canvasY = (dy + range) * tileSize + tileSize / 2;
              
              mctx.fillStyle = '#ef4444';
              mctx.beginPath();
              mctx.arc(canvasX, canvasY, 2.5, 0, Math.PI * 2);
              mctx.fill();
              if (e.hp > 150) {
                mctx.strokeStyle = '#eab308';
                mctx.lineWidth = 1;
                mctx.stroke();
              }
            }
          }
        }

        // Center Player Marker
        const centerX = range * tileSize + tileSize / 2;
        const centerY = range * tileSize + tileSize / 2;

        const pulse = 1 + Math.sin(s.ticks * 0.1) * 0.3;
        mctx.fillStyle = 'rgba(34, 197, 94, 0.3)';
        mctx.beginPath();
        mctx.arc(centerX, centerY, 7 * pulse, 0, Math.PI * 2);
        mctx.fill();

        mctx.fillStyle = '#22c55e';
        mctx.beginPath();
        mctx.arc(centerX, centerY, 3.5, 0, Math.PI * 2);
        mctx.fill();
        mctx.strokeStyle = '#ffffff';
        mctx.lineWidth = 1;
        mctx.stroke();

        // Draw Waypoint if active in local mode
        if (minimapWaypointRef.current) {
          const wp = minimapWaypointRef.current;
          const dx = wp.tx - ptx;
          const dy = wp.ty - pty;
          if (Math.abs(dx) <= range && Math.abs(dy) <= range) {
            const canvasX = (dx + range) * tileSize + tileSize / 2;
            const canvasY = (dy + range) * tileSize + tileSize / 2;
            const wpPulse = 1 + Math.sin(s.ticks * 0.15) * 0.4;

            mctx.fillStyle = 'rgba(34, 211, 238, 0.4)';
            mctx.beginPath();
            mctx.arc(canvasX, canvasY, 6 * wpPulse, 0, Math.PI * 2);
            mctx.fill();

            mctx.fillStyle = '#22d3ee';
            mctx.beginPath();
            mctx.arc(canvasX, canvasY, 3, 0, Math.PI * 2);
            mctx.fill();
            mctx.strokeStyle = '#ffffff';
            mctx.lineWidth = 1;
            mctx.stroke();
          }
        }
      }

      // Draw Scope Crosshair Rings
      mctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      mctx.lineWidth = 0.5;
      mctx.beginPath();
      mctx.moveTo(canvas.width / 2, 0);
      mctx.lineTo(canvas.width / 2, canvas.height);
      mctx.moveTo(0, canvas.height / 2);
      mctx.lineTo(canvas.width, canvas.height / 2);
      mctx.stroke();

      mctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      mctx.lineWidth = 1;
      mctx.beginPath();
      mctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 3, 0, Math.PI * 2);
      mctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2 - 2, 0, Math.PI * 2);
      mctx.stroke();
    };

    const loop = () => {
      const s = stateRef.current;
      if (!s) return;

      if (!pausedRef.current) {
        for (let tickCycle = 0; tickCycle < 3; tickCycle++) {
          // --- Update ---
          s.ticks++;

          // --- Update Weather ---
          if (!s.weather) {
            s.weather = {
              type: 'clear',
              timer: 4500,
              label: 'Clear Skies',
              icon: '☀️',
              threat: 'None',
              desc: 'Perfect survival conditions. Standard movement and regeneration.'
            };
          }
          const wt = s.weather.type || 'clear';
          s.weather.timer--;

          // Periodically check if the player moved to an incompatible biome
          if (s.ticks % 120 === 0) {
            const bName = getBiomeAtPlayer(s);
            if (!isWeatherCompatible(s.weather.type, bName)) {
              const nextWeather = getWeatherForBiome(bName);
              s.weather = {
                ...nextWeather,
                timer: 5000 + Math.floor(Math.random() * 3000)
              };
              addLog(`☁️ Climate Shift! Weather became: ${s.weather.label} ${s.weather.icon}`, '#60a5fa');
              spawnExplosion(s, s.pl.x, s.pl.y, '#60a5fa', 10, 'spark');
            }
          }

          if (s.weather.timer <= 0) {
            const bName = getBiomeAtPlayer(s);
            const nextWeather = getWeatherForBiome(bName);
            s.weather = {
              ...nextWeather,
              timer: 5000 + Math.floor(Math.random() * 3000)
            };
            addLog(`☁️ Weather shifting to: ${s.weather.label} ${s.weather.icon}`, '#60a5fa');
            spawnExplosion(s, s.pl.x, s.pl.y, '#60a5fa', 10, 'spark');
          }

          // Update Chrono/Aether Weather Effects in tick cycle
          if (wt === 'aether_gale') {
            if (s.weather.windAngle === undefined) {
              s.weather.windAngle = Math.random() * Math.PI * 2;
            }
            // Slowly fluctuate the wind angle
            s.weather.windAngle += Math.sin(s.ticks * 0.002) * 0.02;
            
            // Periodically spawn beautiful wind particles blowing in the direction of the wind
            if (s.ticks % 3 === 0) {
              const spawnAngle = s.weather.windAngle + Math.PI; // blow from opposite side
              const borderDist = 400;
              s.parts.push({
                x: s.pl.x + Math.cos(spawnAngle + (Math.random() * 0.8 - 0.4)) * borderDist,
                y: s.pl.y + Math.sin(spawnAngle + (Math.random() * 0.8 - 0.4)) * borderDist,
                vx: Math.cos(s.weather.windAngle) * 6.5,
                vy: Math.sin(s.weather.windAngle) * 6.5,
                life: 60,
                col: '#a78bfa',
                sz: 1.5 + Math.random() * 2
              });
            }
          }
          
          if (wt === 'grav_rift') {
            // Gravity well logic
            if (!s.weather.gravityWell || s.weather.gravityWellTimer <= 0) {
              const angle = Math.random() * Math.PI * 2;
              const dist = 140 + Math.random() * 150;
              s.weather.gravityWell = {
                x: s.pl.x + Math.cos(angle) * dist,
                y: s.pl.y + Math.sin(angle) * dist,
                radius: 150,
                pullForce: 1.4,
                damageRadius: 35,
                ticks: 0,
              };
              s.weather.gravityWellTimer = 360; // 6 seconds duration
              addLog("🌀 An unstable Gravitational Rift has opened nearby!", "#c084fc");
            }
            
            s.weather.gravityWellTimer--;
            const well = s.weather.gravityWell;
            if (well) {
              well.ticks++;
              // Draw swirling spiral particles inside the gravity well
              if (s.ticks % 2 === 0) {
                const pAng = Math.random() * Math.PI * 2;
                const pDist = well.radius * (0.2 + Math.random() * 0.8);
                s.parts.push({
                  x: well.x + Math.cos(pAng) * pDist,
                  y: well.y + Math.sin(pAng) * pDist,
                  vx: -Math.cos(pAng) * 2.2 + Math.sin(pAng) * 1.5, // spiraling velocity
                  vy: -Math.sin(pAng) * 2.2 - Math.cos(pAng) * 1.5,
                  life: 35,
                  col: '#d8b4fe',
                  sz: 2.5
                });
              }

              // Pull player
              const dPl = Math.hypot(s.pl.x - well.x, s.pl.y - well.y);
              if (dPl < well.radius) {
                const pullAng = Math.atan2(well.y - s.pl.y, well.x - s.pl.x);
                const pullAmount = (1 - dPl / well.radius) * well.pullForce;
                s.pl.x += Math.cos(pullAng) * pullAmount;
                s.pl.y += Math.sin(pullAng) * pullAmount;
                
                if (dPl < well.damageRadius) {
                  if (s.ticks % 30 === 0) {
                    s.pl.hp = Math.max(0, s.pl.hp - 3);
                    s.pl.mp = Math.max(0, s.pl.mp - 4);
                    addLog("⚠️ Crushed by High Gravity! -3 HP, -4 Mana", "#a78bfa");
                    spawnExplosion(s, s.pl.x, s.pl.y, '#c084fc', 8, 'spark');
                  }
                }
              }

              // Pull enemies
              for (const e of s.enemies) {
                const dE = Math.hypot(e.x - well.x, e.y - well.y);
                if (dE < well.radius) {
                  const pullAng = Math.atan2(well.y - e.y, well.x - e.x);
                  const pullAmount = (1 - dE / well.radius) * well.pullForce * 1.2;
                  e.x += Math.cos(pullAng) * pullAmount;
                  e.y += Math.sin(pullAng) * pullAmount;

                  if (dE < well.damageRadius && s.ticks % 30 === 0) {
                    e.hp -= 8;
                    spawnExplosion(s, e.x, e.y, '#c084fc', 6, 'spark');
                  }
                }
              }
            }
          } else {
            s.weather.gravityWell = null;
          }

          // Random lightning strike in storms (approx. 0.15% chance per tick = once per ~11 seconds)
          if (wt === 'storm' && Math.random() < 0.0015) {
            triggerLightningStrike(s);
          }

          // Update lightning flash ticks & strikes
          if (s.lightningFlash && s.lightningFlash > 0) {
            s.lightningFlash--;
          }
          if (s.lightningStrike) {
            s.lightningStrike.duration--;
            if (s.lightningStrike.duration <= 0) {
              s.lightningStrike = null;
            }
          }

        s.dayTime = (s.ticks % 18000) / 18000;
        if (s.ticks % 18000 === 0) s.day++;

        if (s.ticks % 10 === 0) {
          discoverMapAroundPlayer(s);
        }

        // Tick Wave System
        if (s.ticks % 60 === 0) {
          if (s.waveTimer > 0) {
            s.waveTimer--;
          } else {
            // Wave transition!
            if (!s.waveActive) {
              s.waveActive = true;
              s.waveNum = (s.waveNum || 0) + 1;
              // Active wave lasts 60 seconds plus 5 seconds per wave level
              s.waveTimer = 60 + Math.min(60, s.waveNum * 5);
              addLog(`🚨 WAVE ${s.waveNum} HAS STARTED! Monsters are attacking from all sides!`, '#ef4444');
              spawnExplosion(s, s.pl.x, s.pl.y, '#ef4444', 15, 'spark');
              
              // Spawn initial wave horde
              const zoneC = Math.floor(s.pl.x / (ZW * TZ));
              const zoneR = Math.floor(s.pl.y / (ZH * TZ));
              const M = s.zoneMaps?.[zoneR * ZCOLS + zoneC] || MAPS[0];
              const spawnCount = 4 + Math.min(8, Math.floor(s.waveNum * 0.5));
              for (let i = 0; i < spawnCount; i++) {
                const eid = M.ef?.[Math.floor(Math.random() * (M.ef?.length || 1))] || "wolf";
                const et = ET[eid];
                if (et) {
                  const angle = Math.random() * Math.PI * 2;
                  const distance = 300 + Math.random() * 150;
                  const sx = Math.max(0, Math.min(WW * TZ - 1, s.pl.x + Math.cos(angle) * distance));
                  const sy = Math.max(0, Math.min(WH * TZ - 1, s.pl.y + Math.sin(angle) * distance));
                  s.enemies.push({
                    id: Math.random(),
                    x: sx,
                    y: sy,
                    hp: et.hp * (1 + s.waveNum * 0.1),
                    mhp: et.hp * (1 + s.waveNum * 0.1),
                    eid,
                    spd: et.spd * 1.1,
                    dmg: Math.round(et.dmg * (1 + s.waveNum * 0.05)),
                    acd: et.acd,
                    cd: 0,
                    ran: et.ran,
                    spawnZc: Math.floor(sx / (ZW * TZ)),
                    spawnZr: Math.floor(sy / (ZH * TZ)),
                    isWaveEnemy: true
                  });
                }
              }
            } else {
              s.waveActive = false;
              s.waveTimer = 180; // 3 minutes peace time
              const goldReward = 50 + s.waveNum * 25;
              const xpReward = 120 + s.waveNum * 60;
              s.pl.gold = (s.pl.gold || 0) + goldReward;
              s.pl.xp = (s.pl.xp || 0) + xpReward;
              
              // Level up checks
              if (s.pl.xp >= s.pl.xpNext) {
                s.pl.xp -= s.pl.xpNext;
                s.pl.lvl++;
                s.pl.xpNext = Math.round(s.pl.xpNext * 1.5);
                s.pl.mhp += 15;
                s.pl.hp = s.pl.mhp;
                s.pl.mmp += 10;
                s.pl.mp = s.pl.mmp;
                addLog(`🎉 LEVEL UP! Reached Level ${s.pl.lvl}!`, "#10b981");
              }
              addLog(`🏆 WAVE ${s.waveNum} SURVIVED! Gained +${goldReward} Gold & +${xpReward} XP!`, '#10b981');
              spawnExplosion(s, s.pl.x, s.pl.y, '#10b981', 12, 'heal');
              
              // Remove leftover wave-marked enemies
              s.enemies = s.enemies.filter((e: any) => !e.isWaveEnemy);
            }
          }
        }

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
      if (s.ticks % 45 === 0) {
        setGameState({ ...s });
      }

      // Autosave trigger every 60 seconds (3600 ticks @ 60fps)
      if (autosaveEnabledRef.current && s.ticks > 0 && s.ticks % 3600 === 0) {
        autosaveGame();
      }

      const isTileBlocked = (stateObj: any, tx: number, ty: number) => {
        if (ty < 0 || ty >= WH || tx < 0 || tx >= WW) return true;
        if (stateObj.world[ty][tx] === TW) return true;
        return stateObj.objs.some((obj: any) => obj.tx === tx && obj.ty === ty && obj.type === 'stone_wall');
      };

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

      // Reset touch pathing on manual keyboard or joystick input
      if (dx !== 0 || dy !== 0) {
        s.pl.touchTarget = null;
      }

      // Touch navigation auto-walk logic
      if (dx === 0 && dy === 0 && s.pl.touchTarget) {
        const currentTx = Math.floor(s.pl.x / TZ);
        const currentTy = Math.floor(s.pl.y / TZ);
        const ttx = s.pl.touchTarget.tx;
        const tty = s.pl.touchTarget.ty;

        // Verify action distance/proximity
        let reachedActionProximity = false;
        const act = s.pl.touchTarget.action;

        if (act) {
          if (act.type === 'attack') {
            // Find target enemy
            const targetEnemy = s.enemies.find((e: any) => e.id === act.targetId);
            if (!targetEnemy || targetEnemy.hp <= 0) {
              s.pl.touchTarget = null; // target died/vanished
            } else {
              // Update target coords to follow enemy
              s.pl.touchTarget.tx = Math.floor(targetEnemy.x / TZ);
              s.pl.touchTarget.ty = Math.floor(targetEnemy.y / TZ);
              const pxDist = dist(s.pl, targetEnemy);
              const wp = getWeaponStats(s, s.pl.weapon);
              if (pxDist <= wp.rng) {
                reachedActionProximity = true;
              }
            }
          } else if (act.type === 'gather_or_interact') {
            const distTiles = Math.abs(ttx - currentTx) + Math.abs(tty - currentTy);
            if (distTiles <= 4) {
              reachedActionProximity = true;
            }
          }
        }

        if (currentTx === ttx && currentTy === tty) {
          reachedActionProximity = true;
        }

        if (reachedActionProximity) {
          s.pl.touchTarget = null;
          if (act) {
            if (act.type === 'attack') {
              handleAttack();
            } else if (act.type === 'gather_or_interact') {
              executeInteractAtTile(act.tx, act.ty);
            }
          }
        } else if (s.pl.touchTarget) {
          // Move towards target tile
          const diffX = ttx - currentTx;
          const diffY = tty - currentTy;
          
          let stepDx = 0;
          let stepDy = 0;

          if (Math.abs(diffX) >= Math.abs(diffY)) {
            stepDx = Math.sign(diffX);
            // Check if walkable
            const nextTx = currentTx + stepDx;
            const nextTy = currentTy;
            if (nextTx >= 0 && nextTx < WW && nextTy >= 0 && nextTy < WH && !isTileBlocked(s, nextTx, nextTy)) {
              dx = stepDx;
              dy = 0;
            } else {
              // Try Y
              stepDy = Math.sign(diffY);
              const altTx = currentTx;
              const altTy = currentTy + stepDy;
              if (altTx >= 0 && altTx < WW && altTy >= 0 && altTy < WH && !isTileBlocked(s, altTx, altTy)) {
                dx = 0;
                dy = stepDy;
              } else {
                // Blocked entirely
                s.pl.touchTarget = null;
              }
            }
          } else {
            stepDy = Math.sign(diffY);
            const nextTx = currentTx;
            const nextTy = currentTy + stepDy;
            if (nextTx >= 0 && nextTx < WW && nextTy >= 0 && nextTy < WH && !isTileBlocked(s, nextTx, nextTy)) {
              dx = 0;
              dy = stepDy;
            } else {
              // Try X
              stepDx = Math.sign(diffX);
              const altTx = currentTx + stepDx;
              const altTy = currentTy;
              if (altTx >= 0 && altTx < WW && altTy >= 0 && altTy < WH && !isTileBlocked(s, altTx, altTy)) {
                dx = stepDx;
                dy = 0;
              } else {
                // Blocked entirely
                s.pl.touchTarget = null;
              }
            }
          }
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
            if (!isTileBlocked(s, targetTx, targetTy)) {
              s.pl.targetX = targetTx * TZ + TZ / 2;
              s.pl.targetY = targetTy * TZ + TZ / 2;
              s.pl.isGridMoving = true;
            }
          }
        }
      }

      let isSprinting = false;
      if (s.pl.isGridMoving && keysRef.current['Shift'] && (s.pl.sta || 100) > 10) {
        isSprinting = true;
      }

      // Weather influence on depletions and health
      let weatherHuMod = 0;
      let weatherThMod = 0;
      let weatherHpDrain = 0;
      let weatherStaDrain = 0;

      if (wt === 'rain') {
        // Rain quenches thirst naturally!
        weatherThMod = -0.12; 
      } else if (wt === 'storm') {
        weatherThMod = -0.05;
        weatherStaDrain = 0.2; 
      } else if (wt === 'blizzard') {
        // Freezing blizzard cold decreases health and stamina faster
        const nearWarmth = isNearStructure('campfire') || isNearStructure('camp_fire') || isNearStructure('shelter') || isNearStructure('water_reservoir') || isNearStructure('water_pump');
        if (!nearWarmth) {
          weatherHpDrain = 1.5; 
          weatherStaDrain = 0.8; 
        }
      } else if (wt === 'sandstorm') {
        weatherThMod = 0.35; 
        weatherStaDrain = 0.5;
        s.pl.slowTicks = Math.max(s.pl.slowTicks || 0, 10); 
      } else if (wt === 'acid_rain') {
        const isArmored = s.pl.equip?.head && s.pl.equip?.chest && s.pl.equip?.legs && s.pl.equip?.feet;
        const isSheltered = isNearStructure('shelter');
        if (!isSheltered) {
          weatherHpDrain = isArmored ? 0.3 : 1.0;
        }
      } else if (wt === 'heatwave') {
        weatherThMod = 0.45; 
      }

      // Handle stamina consumption and regeneration
      const nearShelter = isNearStructure('shelter');
      if (isSprinting) {
        s.pl.sta = Math.max(0, (s.pl.sta || 100) - (0.5 + weatherStaDrain));
      } else {
        const staRegen = nearShelter ? 1.5 : Math.max(0.05, 0.3 - weatherStaDrain); 
        s.pl.sta = Math.min(100, (s.pl.sta || 100) + staRegen);
      }

      // Handle hunger and thirst depletion (once per game second / 60 ticks)
      if (s.ticks % 60 === 0) {
        // Slowly deplete hunger (0.15 per second normally, 0.03 if near shelter)
        const huDepletion = nearShelter ? 0.03 : (0.15 + weatherHuMod);
        s.pl.hu = Math.max(0, (s.pl.hu ?? 100) - huDepletion);
        
        // Slowly deplete thirst (0.22 per second normally, 0.05 if near shelter, 0.45 if sprinting)
        const thDepletion = isSprinting ? (0.45 + weatherThMod) : (nearShelter ? 0.05 : (0.22 + weatherThMod));
        s.pl.th = Math.max(0, (s.pl.th ?? 100) - thDepletion);

        // If rain is falling, player naturally drinks rainwater!
        if (wt === 'rain' && s.pl.th < 100) {
          s.pl.th = Math.min(100, s.pl.th + 1.2);
        }

        // Apply weather health damage
        if (weatherHpDrain > 0) {
          s.pl.hp = Math.max(0, s.pl.hp - weatherHpDrain);
          
          if (s.ticks % 180 === 0) {
            if (wt === 'blizzard') {
              addLog("🥶 Freezing Blizzard! Stand near a Campfire 🔥 or find a Shelter!", "#ef4444");
              spawnExplosion(s, s.pl.x, s.pl.y, '#38bdf8', 4, 'spark');
            } else if (wt === 'acid_rain') {
              addLog("⚠️ Acid rain is corroding your skin! Armor absorbs some of it, but shelter is recommended!", "#f43f5e");
              spawnExplosion(s, s.pl.x, s.pl.y, '#a3e635', 4, 'spark');
            }
          }
        }

        // Shelter healing & resting effects
        if (nearShelter) {
          s.pl.hp = Math.min(s.pl.mhp, s.pl.hp + 2);
          if (s.pl.mp !== undefined && s.pl.mmp !== undefined) {
            s.pl.mp = Math.min(s.pl.mmp, s.pl.mp + 2);
          }
          if (s.ticks % 300 === 0) {
            addLog("🏠 Resting in Shelter: Health, Mana, and Stamina are rapidly restoring! Stats depletion reduced.", '#38bdf8');
            spawnExplosion(s, s.pl.x, s.pl.y, '#38bdf8', 6, 'spark');
          }
        }

        // Apply starvation or dehydration damage if stats are fully depleted
        let dotDamage = 0;
        let isStarving = (s.pl.hu <= 0);
        let isDehydrated = (s.pl.th <= 0);

        if (isStarving) dotDamage += 1;
        if (isDehydrated) dotDamage += 2;

        if (dotDamage > 0) {
          s.pl.hp = Math.max(0, s.pl.hp - dotDamage);
          
          // Log warnings periodically (every 10 seconds / 600 ticks)
          if (s.ticks % 600 === 0) {
            if (isStarving && isDehydrated) {
              addLog("⚠️ Starving & Dehydrated! Health is rapidly declining! Eat food and drink water! 🍖💧", '#ef4444');
            } else if (isStarving) {
              addLog("⚠️ Starving! Eat food to restore hunger! 🍖", '#f59e0b');
            } else if (isDehydrated) {
              addLog("⚠️ Dehydrated! Drink water or consume juicy fruits/potions! 💧", '#38bdf8');
            }
          }
        }
      }

      if (s.pl.slowTicks && s.pl.slowTicks > 0) {
        s.pl.slowTicks--;
      }

      if (s.pl.isGridMoving) {
        let eventSpeedMult = 1.0;
        if (s.activeEvent?.effect?.statModifiers?.speedBoost) {
          eventSpeedMult = s.activeEvent.effect.statModifiers.speedBoost;
        }
        if (s.activeSpells?.healingSanctuaryTimer > 0) {
          eventSpeedMult *= 1.25;
        }
        let adrenalineMult = 1.0;
        const hpPercent = s.pl.hp / s.pl.mhp;
        if (hpPercent < 0.40) {
          const lvl = s.pl.masteries?.adrenaline || 0;
          if (lvl > 0) {
            adrenalineMult += lvl * 0.10;
          }
        }
        const slowMult = (s.pl.slowTicks && s.pl.slowTicks > 0) ? 0.45 : 1.0;
        const diffX = s.pl.targetX - s.pl.x;
        const diffY = s.pl.targetY - s.pl.y;
        
        let windMultiplier = 1.0;
        if (wt === 'aether_gale' && s.weather && s.weather.windAngle !== undefined) {
          const moveAngle = Math.atan2(diffY, diffX);
          const dot = Math.cos(moveAngle - s.weather.windAngle);
          windMultiplier += dot * 0.35; // +35% boost or -35% slow depending on wind alignment!
        }
        if (wt === 'chrono_mist') {
          windMultiplier *= 0.80; // 20% slow in stasis mist
        }
        
        const speed = s.pl.spd * (isSprinting ? 1.7 : 1) * eventSpeedMult * slowMult * adrenalineMult * windMultiplier;
        const d = Math.hypot(diffX, diffY);

        if (d <= speed) {
          s.pl.x = s.pl.targetX;
          s.pl.y = s.pl.targetY;
          s.pl.isGridMoving = false;

          // Check if stepped on a trap!
          const px = Math.floor(s.pl.x / TZ);
          const py = Math.floor(s.pl.y / TZ);
          for (const o of s.objs) {
            if (o.type === 'spike_trap' && !o.triggered && o.tx === px && o.ty === py) {
              o.triggered = true;
              o.ico = '💥';
              const dmg = 15;
              s.pl.hp = Math.max(0, s.pl.hp - dmg);
              s.pl.slowTicks = 120; // 2 seconds slow
              addLog(`⚠️ OUCH! Stepped on a Spike Trap! -${dmg} HP! (Slowed)`, '#ef4444');
              spawnExplosion(s, s.pl.x, s.pl.y, '#ef4444', 15, 'spark');
            }
          }
        } else {
          s.pl.x += (diffX / d) * speed;
          s.pl.y += (diffY / d) * speed;
        }
      }

      // Track explored sectors and unlock hidden recipes
      const currentZc = Math.floor(s.pl.x / (ZW * TZ));
      const currentZr = Math.floor(s.pl.y / (ZH * TZ));
      if (s.lastZc === undefined) {
        s.lastZc = currentZc;
        s.lastZr = currentZr;
        s.exploredSectors = s.exploredSectors || [`${currentZc},${currentZr}`];
      } else if (currentZc !== s.lastZc || currentZr !== s.lastZr) {
        s.lastZc = currentZc;
        s.lastZr = currentZr;
        s.exploredSectors = s.exploredSectors || [];
        const sectorKey = `${currentZc},${currentZr}`;
        if (!s.exploredSectors.includes(sectorKey)) {
          s.exploredSectors.push(sectorKey);
          const mapIdx = currentZr * ZCOLS + currentZc;
          const M = s.zoneMaps?.[mapIdx] || MAPS[mapIdx] || MAPS[0];
          addLog(`🌍 Explored new sector: ${M?.n || "Unknown Biome"}!`, '#10b981');
          
          // Trigger recipe unlock through world exploration!
          const currentRecipes = recipesRef.current.length > 0 ? recipesRef.current : recipes;
          const lockedRecipes = currentRecipes.filter((r: any) => !r.discovered);
          if (lockedRecipes.length > 0) {
            const randomRecipe = lockedRecipes[Math.floor(Math.random() * lockedRecipes.length)];
            randomRecipe.discovered = true;
            setRecipes([...currentRecipes]);
            addLog(`📖 DISCOVERY UNLOCKED: "${randomRecipe.n}" recipe revealed from exploration!`, '#eab308');
            spawnExplosion(s, s.pl.x, s.pl.y, '#eab308', 12, 'spark');
          }
        }
      }

      // Camera (accounting for game zoom factor)
      const curZoom = gameZoomRef.current;
      const targetCamX = s.pl.x - (window.innerWidth / curZoom) / 2;
      const targetCamY = s.pl.y - (window.innerHeight / curZoom) / 2;
      s.cam.x += (targetCamX - s.cam.x) * 0.1;
      s.cam.y += (targetCamY - s.cam.y) * 0.1;

      // --- Combat Update ---
      if (s.pl.atkcd > 0) s.pl.atkcd--;
      if (s.pl.ifr > 0) s.pl.ifr--;

      // Enemy Spawning
      const spawnInterval = s.waveActive ? 50 : 150;
      const maxEnemies = s.waveActive ? 35 : 24;
      if (s.ticks % spawnInterval === 0 && s.enemies.length < maxEnemies) {
        const mapIdx = Math.floor(s.pl.y / (ZH * TZ)) * ZCOLS + Math.floor(s.pl.x / (ZW * TZ));
        const M = s.zoneMaps?.[mapIdx] || MAPS[mapIdx] || MAPS[0];
        const eid = M.ef[Math.floor(Math.random() * M.ef.length)];
        const et = ET[eid];
        if (et) {
          const ang = Math.random() * Math.PI * 2;
          const dist = 400 + Math.random() * 200;
          const spawnX = Math.max(0, Math.min(WW * TZ - 1, s.pl.x + Math.cos(ang) * dist));
          const spawnY = Math.max(0, Math.min(WH * TZ - 1, s.pl.y + Math.sin(ang) * dist));
          const spawnZc = Math.floor(spawnX / (ZW * TZ));
          const spawnZr = Math.floor(spawnY / (ZH * TZ));
          s.enemies.push({
            id: Math.random(),
            x: spawnX,
            y: spawnY,
            hp: s.waveActive ? et.hp * (1 + (s.waveNum || 1) * 0.1) : et.hp,
            mhp: s.waveActive ? et.hp * (1 + (s.waveNum || 1) * 0.1) : et.hp,
            eid,
            spd: s.waveActive ? et.spd * 1.1 : et.spd,
            dmg: s.waveActive ? Math.round(et.dmg * (1 + (s.waveNum || 1) * 0.05)) : et.dmg,
            acd: et.acd,
            cd: 0,
            ran: et.ran,
            spawnZc,
            spawnZr,
            isWaveEnemy: s.waveActive
          });
        }
      }

      // Enemy AI
      for (let i = s.enemies.length - 1; i >= 0; i--) {
        const e = s.enemies[i];

        // Ensure spawn biome boundaries are initialized
        if (e.spawnZc === undefined || e.spawnZr === undefined) {
          e.spawnZc = Math.max(0, Math.min(ZCOLS - 1, Math.floor(e.x / (ZW * TZ))));
          e.spawnZr = Math.max(0, Math.min(ZROWS - 1, Math.floor(e.y / (ZH * TZ))));
        }

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

        // Despawn if too far off-screen to recycle enemies around the active player zone
        if (d > 1400) {
          s.enemies.splice(i, 1);
          continue;
        }

        let spd = e.slowTicks > 0 ? e.spd * 0.5 : e.spd;
        if (wt === 'chrono_mist') {
          spd *= 0.75; // 25% slower
        } else if (wt === 'aether_gale' && s.weather && s.weather.windAngle !== undefined) {
          const enemyMoveAng = (e.eid === 'deer' || e.eid === 'pheasant' || (e.eid === 'boar' && e.hp >= e.mhp)) ? Math.atan2(e.y - s.pl.y, e.x - s.pl.x) : Math.atan2(s.pl.y - e.y, s.pl.x - e.x);
          const dot = Math.cos(enemyMoveAng - s.weather.windAngle);
          spd *= (1.0 + dot * 0.3); // up to +30% boost or -30% slow
        }

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

        const playerZc = Math.max(0, Math.min(ZCOLS - 1, Math.floor(s.pl.x / (ZW * TZ))));
        const playerZr = Math.max(0, Math.min(ZROWS - 1, Math.floor(s.pl.y / (ZH * TZ))));
        const isPlayerInSameBiome = e.spawnZc === playerZc && e.spawnZr === playerZr;

        // Custom aggro ranges: higher for boss/elite/chief types, standard for standard hostiles
        let aggroRange = (e.eid === 'dragon' || e.eid === 'celestial_guardian' || e.eid === 'orc_chief' || e.eid === 'goblin_chief' || e.eid === 'bandit_chief' || e.eid === 'chrono_overlord') ? 320 : 240;
        if (wt === 'chrono_mist') {
          aggroRange *= 0.55; // 45% reduction in enemy vision range!
        }
        const isPlayerWithinRange = d < aggroRange;
        const isProvoked = e.hp < e.mhp;

        // Enemy actively aggros only if player is inside the same biome and is close or the enemy is provoked
        const isAggroedHostile = shouldChase && isPlayerInSameBiome && (isPlayerWithinRange || isProvoked);
        e.isAggro = isAggroedHostile;

        // Helper to check valid tile moves restricted within the spawned biome boundaries
        const minTileX = e.spawnZc * ZW;
        const maxTileX = (e.spawnZc + 1) * ZW - 1;
        const minTileY = e.spawnZr * ZH;
        const maxTileY = (e.spawnZr + 1) * ZH - 1;

        const canMoveTo = (tx: number, ty: number, allowLava: boolean = true) => {
          if (tx < minTileX || tx > maxTileX || ty < minTileY || ty > maxTileY) return false;
          if (tx < 0 || tx >= WW || ty < 0 || ty >= WH) return false;
          const t = s.world[ty][tx];
          if (t === TW) return false; // Water is impassable
          if (!allowLava && t === TLV) return false; // Lava impassable for general idle wandering
          return true;
        };

        if (shouldFlee) {
          // Run AWAY from player
          const ang = Math.atan2(e.y - s.pl.y, e.x - s.pl.x);
          const nx = e.x + Math.cos(ang) * (spd * 1.3); // Sprint away!
          const ny = e.y + Math.sin(ang) * (spd * 1.3);
          const etx = Math.floor(nx / TZ);
          const ety = Math.floor(ny / TZ);
          if (canMoveTo(etx, ety, true)) {
            e.x = nx;
            e.y = ny;
          } else {
            // Slider / wall-sliding check so they slide along boundaries smoothly
            for (let offset = 0.5; offset <= 2.0; offset += 0.5) {
              const leftAng = ang + offset;
              const lx = e.x + Math.cos(leftAng) * (spd * 1.3);
              const ly = e.y + Math.sin(leftAng) * (spd * 1.3);
              if (canMoveTo(Math.floor(lx / TZ), Math.floor(ly / TZ), true)) {
                e.x = lx;
                e.y = ly;
                break;
              }
              const rightAng = ang - offset;
              const rx = e.x + Math.cos(rightAng) * (spd * 1.3);
              const ry = e.y + Math.sin(rightAng) * (spd * 1.3);
              if (canMoveTo(Math.floor(rx / TZ), Math.floor(ry / TZ), true)) {
                e.x = rx;
                e.y = ry;
                break;
              }
            }
          }
          if (s.ticks % 10 === 0) {
            s.parts.push({
              x: e.x, y: e.y + 4,
              vx: -Math.cos(ang) * 0.5, vy: -Math.sin(ang) * 0.5,
              life: 6, maxLife: 12, col: 'rgba(255,255,255,0.4)', sz: 1.5
            });
          }
        } else if (isAggroedHostile) {
          const ang = Math.atan2(s.pl.y - e.y, s.pl.x - e.x);
          if (d > 30) {
            const nx = e.x + Math.cos(ang) * (spd * 1.15); // Aggro sprint boost
            const ny = e.y + Math.sin(ang) * (spd * 1.15);
            const etx = Math.floor(nx / TZ);
            const ety = Math.floor(ny / TZ);
            if (canMoveTo(etx, ety, true)) {
              e.x = nx;
              e.y = ny;
            } else {
              // Sliding along biome limits or obstacles
              for (let offset = 0.5; offset <= 1.5; offset += 0.5) {
                const leftAng = ang + offset;
                const lx = e.x + Math.cos(leftAng) * spd;
                const ly = e.y + Math.sin(leftAng) * spd;
                if (canMoveTo(Math.floor(lx / TZ), Math.floor(ly / TZ), true)) {
                  e.x = lx;
                  e.y = ly;
                  break;
                }
                const rightAng = ang - offset;
                const rx = e.x + Math.cos(rightAng) * spd;
                const ry = e.y + Math.sin(rightAng) * spd;
                if (canMoveTo(Math.floor(rx / TZ), Math.floor(ry / TZ), true)) {
                  e.x = rx;
                  e.y = ry;
                  break;
                }
              }
            }

            // Spawn aggressive dust/smoke puffs
            if (s.ticks % 20 === 0) {
              s.parts.push({
                x: e.x + (Math.random() - 0.5) * 8,
                y: e.y + 4,
                vx: -Math.cos(ang) * 0.3 + (Math.random() - 0.5) * 0.2,
                vy: -Math.sin(ang) * 0.3 + (Math.random() - 0.5) * 0.2,
                life: 8 + Math.floor(Math.random() * 8),
                maxLife: 16,
                col: s.world[ety]?.[etx] === TLV ? '#ff5500' : 'rgba(239, 68, 68, 0.4)',
                sz: 1.2 + Math.random() * 2
              });
            }
          }
        } else {
          // Idle wandering inside biome limits
          if (!e.wanderAng) e.wanderAng = Math.random() * Math.PI * 2;
          
          if (!e.wanderTimer) e.wanderTimer = 60 + Math.floor(Math.random() * 120);
          e.wanderTimer--;

          if (e.wanderTimer <= 0) {
            e.wanderAng = Math.random() * Math.PI * 2;
            e.wanderTimer = 80 + Math.floor(Math.random() * 140);
            e.isWanderingPause = Math.random() < 0.45; // 45% chance to pause/sniff/graze
          }

          if (!e.isWanderingPause) {
            const nx = e.x + Math.cos(e.wanderAng) * (spd * 0.45);
            const ny = e.y + Math.sin(e.wanderAng) * (spd * 0.45);
            const etx = Math.floor(nx / TZ);
            const ety = Math.floor(ny / TZ);
            if (canMoveTo(etx, ety, false)) { // restrict general wandering from entering lava
              e.x = nx;
              e.y = ny;
            } else {
              // Immediately pick a new direction when bouncing off bounds/obstacle
              e.wanderAng = Math.random() * Math.PI * 2;
              e.wanderTimer = 30 + Math.floor(Math.random() * 60);
            }
          }
        }

        // Attack player
        if (d < 40 && e.cd <= 0 && s.pl.ifr <= 0) {
          let finalDef = s.pl.def;
          if (s.activeSpells?.healingSanctuaryTimer > 0) {
            finalDef += 5;
          }
          let dmg = Math.max(1, e.dmg - finalDef);
          const hideLvl = s.pl.masteries?.toughened_hide || 0;
          if (hideLvl > 0) {
            dmg = Math.max(1, dmg - hideLvl);
          }
          s.pl.hp -= dmg;
          s.camShake = (s.camShake || 0) + 12;
          s.pl.ifr = 40;
          e.cd = e.acd;
          addLog(`Hit by ${ET[e.eid].n}! -${dmg} HP`, '#f44');
          if (s.pl.hp <= 0) {
            s.pl.hp = 0;
            if (checkPlayerDeath(s)) {
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

        // Special Companion Roles
        if (c.role === 'hunter' && bestTarget && c.cd <= 0) {
          const ox = c.x;
          const oy = c.y;
          const ang = Math.atan2(bestTarget.y - oy, bestTarget.x - ox);
          s.projs.push({
            x: ox, y: oy,
            vx: Math.cos(ang) * 12, vy: Math.sin(ang) * 12,
            dmg: c.dmg, rng: 300, dist: 0,
            col: '#f59e0b', fx: 'slow', isArrow: true, sz: 5
          });
          c.cd = 50; // attack cooldown
          s.parts.push({ x: ox, y: oy, vx: 0, vy: 0, life: 10, col: '#f59e0b', sz: 6 });
        }
        
        if (c.role === 'gatherer' && s.ticks % 250 === 0) {
          const items = ['wood', 'stone', 'fiber', 'flint'];
          const gathered = items[Math.floor(Math.random() * items.length)];
          s.pl.inv[gathered] = (s.pl.inv[gathered] || 0) + 1;
          addLog(`🧑‍🌾 ${c.n} gathered 1x ${IT[gathered]?.n || gathered}!`, '#34d399');
          s.parts.push({ x: c.x, y: c.y, vx: 0, vy: -1, life: 15, col: '#34d399', sz: 6 });
        }

        if (c.role === 'alchemist' && s.pl.hp < s.pl.mhp * 0.6 && c.scd <= 0) {
          s.pl.hp = Math.min(s.pl.mhp, s.pl.hp + 20);
          c.scd = 300; // 10 second heal cooldown
          addLog(`🧙‍♀️ ${c.n} healed you for +20 HP!`, '#f43f5e');
          s.parts.push({ x: s.pl.x, y: s.pl.y, vx: 0, vy: 0, life: 20, col: '#f43f5e', sz: 8 });
        }

        if (c.cd > 0) c.cd--;
        if (c.scd > 0) c.scd--;
      }

      // --- Placed Structure Updates (Sentry Turrets & Watch Towers Sentry Attack) ---
      if (s.ticks % 35 === 0) {
        for (const o of s.objs) {
          if (o.type === 'sentry_turret') {
            let target = null;
            let minDist = 220;
            const ox = o.tx * TZ + TZ / 2;
            const oy = o.ty * TZ + TZ / 2;
            for (const e of s.enemies) {
              const d = Math.hypot(e.x - ox, e.y - oy);
              if (d < minDist) {
                minDist = d;
                target = e;
              }
            }
            if (target) {
              const ang = Math.atan2(target.y - oy, target.x - ox);
              s.projs.push({
                x: ox, y: oy,
                vx: Math.cos(ang) * 11, vy: Math.sin(ang) * 11,
                dmg: 35, rng: 220, dist: 0,
                col: '#10b981', fx: 'slow', isArrow: true, sz: 5
              });
              s.parts.push({ x: ox, y: oy, vx: 0, vy: 0, life: 8, col: '#10b981', sz: 6 });
            }
          } else if (o.type === 'watch_tower') {
            let target = null;
            let minDist = 350;
            const ox = o.tx * TZ + TZ / 2;
            const oy = o.ty * TZ + TZ / 2;
            for (const e of s.enemies) {
              const d = Math.hypot(e.x - ox, e.y - oy);
              if (d < minDist) {
                minDist = d;
                target = e;
              }
            }
            if (target) {
              const ang = Math.atan2(target.y - oy, target.x - ox);
              s.projs.push({
                x: ox, y: oy,
                vx: Math.cos(ang) * 16, vy: Math.sin(ang) * 16,
                dmg: 65, rng: 350, dist: 0,
                col: '#f59e0b', fx: 'none', isArrow: true, sz: 6
              });
              s.parts.push({ x: ox, y: oy, vx: 0, vy: 0, life: 8, col: '#f59e0b', sz: 8 });
            }
          }
        }
      }

      // --- Town Structures Income and Production Updates ---
      if (s.ticks % 200 === 0) { // Every 200 ticks (~6-7 seconds)
        for (const o of s.objs) {
          const ox = o.tx * TZ + TZ / 2;
          const oy = o.ty * TZ + TZ / 2;
          
          if (o.type === 'settler_shelter') {
            s.pl.inv.gold_coins = (s.pl.inv.gold_coins || 0) + 2;
            s.parts.push({ x: ox, y: oy, vx: 0, vy: -1.2, life: 25, col: '#fbbf24', sz: 4 });
          } else if (o.type === 'town_house') {
            s.pl.inv.gold_coins = (s.pl.inv.gold_coins || 0) + 6;
            s.parts.push({ x: ox, y: oy, vx: 0, vy: -1.2, life: 25, col: '#fbbf24', sz: 5 });
          } else if (o.type === 'town_workshop') {
            s.pl.inv.iron_bar = (s.pl.inv.iron_bar || 0) + 1;
            s.parts.push({ x: ox, y: oy, vx: 0, vy: -1.2, life: 25, col: '#a1a1aa', sz: 5 });
          } else if (o.type === 'storage_depot') {
            s.pl.inv.wood = (s.pl.inv.wood || 0) + 2;
            s.pl.inv.stone = (s.pl.inv.stone || 0) + 2;
            s.pl.inv.fiber = (s.pl.inv.fiber || 0) + 2;
            s.parts.push({ x: ox, y: oy, vx: 0, vy: -1.2, life: 25, col: '#fb7185', sz: 5 });
          } else if (o.type === 'merchant_stall') {
            s.pl.inv.gold_coins = (s.pl.inv.gold_coins || 0) + 5;
            s.parts.push({ x: ox, y: oy, vx: 0, vy: -1.2, life: 30, col: '#f59e0b', sz: 5 });
          } else if (o.type === 'farm_plot') {
            s.pl.inv.berry = (s.pl.inv.berry || 0) + 1;
            s.parts.push({ x: ox, y: oy, vx: 0, vy: -1.2, life: 25, col: '#10b981', sz: 4 });
          }
        }
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
            s.camShake = (s.camShake || 0) + 3;

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
            } else if (p.fx === 'time_slow') {
              // Chrono-Scepter special: Slows down targets heavily and dilates time
              e.slowTicks = 360; // 6 seconds slow!
              e.flashTicks = 20;
              spawnExplosion(s, p.x, p.y, '#fbbf24', 20, 'ring');
              spawnExplosion(s, p.x, p.y, '#ffffff', 10, 'spark');
              // Age surrounding targets (dealing localized area damage)
              for (const other of s.enemies) {
                if (dist(e, other) < 110) {
                  other.hp -= Math.round(p.dmg * 0.6);
                  other.slowTicks = 240;
                  spawnExplosion(s, other.x, other.y, '#fcd34d', 6, 'pixel');
                }
              }
              addLog("⏳ Time Dilation: Localized space-time dilated!", '#fbbf24');
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
        
        if (s.ticks % 60 === 0) {
          const isSheltered = isNearStructure('shelter');
          
          if (s.activeEvent.effect?.statModifiers?.healthDrain) {
            const hDrain = s.activeEvent.effect.statModifiers.healthDrain;
            if (hDrain > 0) {
              if (isSheltered) {
                if (s.ticks % 300 === 0) {
                  addLog(`🏠 Sheltered: Protected from the health drain of "${s.activeEvent.title}"!`, '#10b981');
                }
              } else {
                s.pl.hp = Math.max(0, s.pl.hp - hDrain);
                if (s.pl.hp <= 0 && !showDeathScreen) {
                  if (checkPlayerDeath(s)) {
                    setShowDeathScreen(true);
                  }
                }
              }
            } else if (hDrain < 0) {
              s.pl.hp = Math.min(s.pl.mhp, s.pl.hp + Math.abs(hDrain));
            }
          }

          if (s.activeEvent.effect?.statModifiers?.hungerDrain) {
            const huDrain = s.activeEvent.effect.statModifiers.hungerDrain;
            if (huDrain > 0 && isSheltered) {
              if (s.ticks % 300 === 0) {
                addLog(`🏠 Sheltered: Protected from the hunger drain of "${s.activeEvent.title}"!`, '#10b981');
              }
            } else {
              s.pl.hu = Math.max(0, Math.min(100, (s.pl.hu ?? 100) - huDrain));
            }
          }

          if (s.activeEvent.effect?.statModifiers?.thirstDrain) {
            const thDrain = s.activeEvent.effect.statModifiers.thirstDrain;
            if (thDrain > 0 && isSheltered) {
              if (s.ticks % 300 === 0) {
                addLog(`🏠 Sheltered: Protected from the thirst drain of "${s.activeEvent.title}"!`, '#10b981');
              }
            } else {
              s.pl.th = Math.max(0, Math.min(100, (s.pl.th ?? 100) - thDrain));
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
        
        const currentRecipes = recipesRef.current.length > 0 ? recipesRef.current : recipes;
        for (let i = 0; i < currentRecipes.length; i++) {
          const r = currentRecipes[i];
          if (!autoCraftListRef.current[r.out]) continue;
          
          // Check structure requirement
          let isNear = true;
          if (r.req) {
            isNear = s.objs.some((o: any) => o.type === r.req);
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
      if (s.parts && s.parts.length > 200) {
        s.parts.splice(0, s.parts.length - 200);
      }
      for (let i = s.parts.length - 1; i >= 0; i--) {
        const pt = s.parts[i];
        pt.x += pt.vx || 0;
        pt.y += pt.vy || 0;
        pt.life--;
        if (pt.life <= 0) {
          s.parts.splice(i, 1);
        }
      }
        } // End of speed up tickCycle loop
      } // End of if (!pausedRef.current)

      // --- Draw ---
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      
      ctx.save();
      
      // Apply game zoom
      const zoom = gameZoomRef.current;
      ctx.scale(zoom, zoom);

      // Apply camera shake if any
      let shakeX = 0;
      let shakeY = 0;
      if (s.camShake && s.camShake > 0) {
        shakeX = (Math.random() - 0.5) * s.camShake;
        shakeY = (Math.random() - 0.5) * s.camShake;
        s.camShake *= 0.88; // decay
        if (s.camShake < 0.1) s.camShake = 0;
      }
      ctx.translate(shakeX, shakeY);

      // Tiles
      const sx0 = Math.max(0, Math.floor(s.cam.x / TZ) - 1);
      const sy0 = Math.max(0, Math.floor(s.cam.y / TZ) - 1);
      const ex = Math.min(WW, sx0 + Math.floor((ctx.canvas.width / zoom) / TZ) + 2);
      const ey = Math.min(WH, sy0 + Math.floor((ctx.canvas.height / zoom) / TZ) + 2);

      for (let y = sy0; y < ey; y++) {
        for (let x = sx0; x < ex; x++) {
          const t = s.world[y][x];
          const tc = TC[t] || TC[0];
          const txCoord = x * TZ - s.cam.x;
          const tyCoord = y * TZ - s.cam.y;
          
          // Draw base tile checkering
          ctx.fillStyle = (x + y) % 2 === 0 ? tc[0] : tc[1];
          ctx.fillRect(txCoord, tyCoord, TZ, TZ);
          
          // Subtle grid lines
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.012)';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(txCoord, tyCoord, TZ, TZ);

          // Draw premium micro-textures and shader effects on tiles
          ctx.save();
          const pSeed = (x * 37 + y * 13) % 100; // deterministic pseudo-random seed per tile

          if (t === TG) {
            // --- GRASS BIOME OVERHAUL ---
            // High-resolution grass micro-texture layer
            ctx.fillStyle = (x + y) % 2 === 0 ? 'rgba(21, 128, 61, 0.08)' : 'rgba(22, 163, 74, 0.08)';
            ctx.fillRect(txCoord + 2, tyCoord + 2, TZ - 4, TZ - 4);
            
            // Soft foliage texture speckles
            ctx.fillStyle = 'rgba(22, 101, 52, 0.12)';
            ctx.fillRect(txCoord + (pSeed % 12), tyCoord + ((pSeed * 3) % 12), 2, 2);
            ctx.fillRect(txCoord + 10 + (pSeed % 8), tyCoord + 8 + ((pSeed * 2) % 8), 1.5, 1.5);

            // Draw soft grass blades
            ctx.strokeStyle = 'rgba(34, 197, 94, 0.45)';
            ctx.lineWidth = 1;
            if (pSeed < 35) {
              const gx = txCoord + 4 + (pSeed % 12);
              const gy = tyCoord + 6 + (pSeed % 10);
              ctx.beginPath();
              ctx.moveTo(gx, gy + 10);
              ctx.quadraticCurveTo(gx - 2, gy + 2, gx - 4, gy);
              ctx.moveTo(gx + 3, gy + 10);
              ctx.quadraticCurveTo(gx + 4, gy + 3, gx + 6, gy + 1);
              ctx.stroke();
            }
            // Tiny wild flowers
            if (pSeed < 12) {
              const fx = txCoord + 6 + (pSeed * 2) % 14;
              const fy = tyCoord + 6 + (pSeed * 3) % 14;
              ctx.fillStyle = pSeed % 3 === 0 ? '#fbbf24' : pSeed % 3 === 1 ? '#f43f5e' : '#ffffff'; // yellow, rose, white
              ctx.beginPath();
              ctx.arc(fx, fy, 1.5, 0, Math.PI * 2);
              ctx.fill();
              // Tiny flower center
              ctx.fillStyle = '#fb7185';
              ctx.beginPath();
              ctx.arc(fx, fy, 0.5, 0, Math.PI * 2);
              ctx.fill();
            }
          } else if (t === TD) {
            // --- SOIL BIOME OVERHAUL ---
            // High-res soil granules micro-texture layer
            ctx.fillStyle = 'rgba(120, 53, 4, 0.08)'; // rich soil speckles
            ctx.fillRect(txCoord + (pSeed % 14), tyCoord + ((pSeed * 2) % 14), 2, 2);
            ctx.fillRect(txCoord + 8 + (pSeed % 8), tyCoord + 10 + ((pSeed * 3) % 6), 1, 1);

            // Small stones
            if (pSeed < 20) {
              const sx = txCoord + 5 + (pSeed * 2) % 12;
              const sy = tyCoord + 5 + (pSeed * 3) % 12;
              ctx.fillStyle = '#4b5563';
              ctx.beginPath();
              ctx.ellipse(sx, sy, 2, 1.2, Math.PI / 4, 0, Math.PI * 2);
              ctx.fill();
            }
            // Dirt crevices / plow-lines
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(txCoord + 3, tyCoord + TZ/2 + (pSeed % 6) - 3);
            ctx.quadraticCurveTo(txCoord + TZ/2, tyCoord + TZ/2 + (pSeed % 4) - 2, txCoord + TZ - 3, tyCoord + TZ/2 + (pSeed % 6) - 3);
            ctx.stroke();
          } else if (t === TS) {
            // --- STONE BIOME OVERHAUL ---
            // High-fidelity stone grain noise micro-texture
            ctx.fillStyle = 'rgba(71, 85, 105, 0.12)';
            ctx.fillRect(txCoord + (pSeed % 12), tyCoord + ((pSeed * 4) % 12), 3, 3);
            ctx.fillStyle = 'rgba(148, 163, 184, 0.08)';
            ctx.fillRect(txCoord + 12 + (pSeed % 6), tyCoord + 2 + ((pSeed * 2) % 10), 2, 2);

            // Cobble fissures
            ctx.strokeStyle = 'rgba(15, 23, 42, 0.3)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(txCoord + (pSeed % 8), tyCoord);
            ctx.lineTo(txCoord + TZ/2 + (pSeed % 4), tyCoord + TZ/2);
            ctx.lineTo(txCoord + (pSeed % 10), tyCoord + TZ);
            ctx.stroke();

            // Shaded crevices
            if (pSeed < 25) {
              ctx.fillStyle = 'rgba(255, 255, 255, 0.05)'; // Highlights
              ctx.fillRect(txCoord + 2, tyCoord + 2, TZ - 4, 2);
              ctx.fillStyle = 'rgba(0, 0, 0, 0.15)'; // Shading
              ctx.fillRect(txCoord + 2, tyCoord + TZ - 4, TZ - 4, 2);
            }
          } else if (t === TW) {
            // --- WATER BIOME OVERHAUL ---
            // High-fidelity water reflection layer
            const reflection = Math.sin(s.ticks * 0.025 + x * 0.5) * 0.15;
            ctx.fillStyle = `rgba(255, 255, 255, ${0.06 + reflection})`;
            ctx.fillRect(txCoord + 2, tyCoord + 2, TZ - 4, 3);

            // Dynamic waves
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            const waveOffset = Math.sin(s.ticks * 0.04 + x + y) * 4;
            ctx.moveTo(txCoord + 4, tyCoord + TZ/2 + waveOffset);
            ctx.quadraticCurveTo(txCoord + TZ/2, tyCoord + TZ/2 - 3 + waveOffset, txCoord + TZ - 4, tyCoord + TZ/2 + waveOffset);
            ctx.stroke();

            // Water glint sparkling dots
            if (pSeed < 10) {
              const pulseGlint = 0.2 + Math.abs(Math.sin(s.ticks * 0.035 + pSeed)) * 0.6;
              ctx.fillStyle = `rgba(255, 255, 255, ${pulseGlint})`;
              ctx.fillRect(txCoord + 6 + (pSeed % 12), tyCoord + 6 + (pSeed % 12), 1.5, 1.5);
            }

            // Shoreline / coastal foam! (Check if adjacent is land)
            const hasNorthLand = y > 0 && s.world[y - 1][x] !== TW && s.world[y - 1][x] !== TSW;
            const hasSouthLand = y < WH - 1 && s.world[y + 1][x] !== TW && s.world[y + 1][x] !== TSW;
            const hasWestLand = x > 0 && s.world[y][x - 1] !== TW && s.world[y][x - 1] !== TSW;
            const hasEastLand = x < WW - 1 && s.world[y][x + 1] !== TW && s.world[y][x + 1] !== TSW;

            if (hasNorthLand || hasSouthLand || hasWestLand || hasEastLand) {
              ctx.strokeStyle = `rgba(255, 255, 255, ${0.35 + Math.sin(s.ticks * 0.08) * 0.15})`;
              ctx.lineWidth = 1.5;
              ctx.setLineDash([4, 2]);
              ctx.beginPath();
              if (hasNorthLand) {
                ctx.moveTo(txCoord, tyCoord);
                ctx.lineTo(txCoord + TZ, tyCoord);
              }
              if (hasSouthLand) {
                ctx.moveTo(txCoord, tyCoord + TZ);
                ctx.lineTo(txCoord + TZ, tyCoord + TZ);
              }
              if (hasWestLand) {
                ctx.moveTo(txCoord, tyCoord);
                ctx.lineTo(txCoord, tyCoord + TZ);
              }
              if (hasEastLand) {
                ctx.moveTo(txCoord + TZ, tyCoord);
                ctx.lineTo(txCoord + TZ, tyCoord + TZ);
              }
              ctx.stroke();
              ctx.setLineDash([]);
            }
          } else if (t === TSA) {
            // --- SAND BIOME OVERHAUL ---
            // Dune ripples and fine sand micro-texture
            ctx.fillStyle = 'rgba(180, 83, 9, 0.06)';
            ctx.fillRect(txCoord + (pSeed % 10), tyCoord + ((pSeed * 5) % 12), 2.5, 2.5);

            // Dune ripples
            ctx.strokeStyle = 'rgba(217, 119, 6, 0.22)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(txCoord, tyCoord + 4);
            ctx.quadraticCurveTo(txCoord + TZ/2, tyCoord + TZ/2, txCoord + TZ, tyCoord + TZ - 4);
            ctx.stroke();

            // Tiny sand sparkles
            if (pSeed < 15) {
              const glint = 0.1 + Math.abs(Math.sin(s.ticks * 0.05 + pSeed)) * 0.7;
              ctx.fillStyle = `rgba(254, 240, 138, ${glint})`;
              ctx.fillRect(txCoord + (pSeed * 3) % TZ, tyCoord + (pSeed * 5) % TZ, 1, 1);
            }
          } else if (t === TSN) {
            // --- SNOW BIOME OVERHAUL ---
            // Ice crystal sparkles & shadows micro-texture
            ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
            ctx.fillRect(txCoord + (pSeed % 14), tyCoord + ((pSeed * 7) % 14), 2, 1.5);
            ctx.fillStyle = 'rgba(203, 213, 225, 0.15)';
            ctx.fillRect(txCoord + 10 + (pSeed % 8), tyCoord + 4 + ((pSeed * 3) % 8), 1.5, 2);

            // Frost contour shapes
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            if (pSeed < 20) {
              ctx.beginPath();
              ctx.arc(txCoord + TZ/2, tyCoord + TZ/2, 3, 0, Math.PI * 2);
              ctx.fill();
            }
            // Tiny sparkling snow stars
            if (pSeed < 12) {
              const spark = 0.2 + Math.abs(Math.sin(s.ticks * 0.04 + pSeed)) * 0.6;
              ctx.fillStyle = `rgba(255, 255, 255, ${spark})`;
              const sx = txCoord + (pSeed * 2) % (TZ - 4) + 2;
              const sy = tyCoord + (pSeed * 3) % (TZ - 4) + 2;
              ctx.fillRect(sx, sy, 1.2, 1.2);
            }
          } else if (t === TLV) {
            // --- MOLTEN LAVA BIOME OVERHAUL ---
            // Dark cooling rock crust clusters over bright orange lava
            ctx.fillStyle = '#1c1917';
            ctx.fillRect(txCoord + 2, tyCoord + 2, TZ - 4, TZ - 4);

            // Lava veins drawing pulsing energy
            const pulse = 0.5 + Math.sin(s.ticks * 0.05 + x + y) * 0.4;
            ctx.fillStyle = `rgba(249, 115, 22, ${0.6 + pulse * 0.4})`;
            ctx.beginPath();
            ctx.arc(txCoord + TZ/2, tyCoord + TZ/2, 4 + pulse * 3, 0, Math.PI * 2);
            ctx.fill();

            // Glowing hot red highlights
            ctx.strokeStyle = `rgba(239, 68, 68, ${0.4 + pulse * 0.4})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(txCoord, tyCoord + TZ/2);
            ctx.lineTo(txCoord + TZ, tyCoord + TZ/2);
            ctx.moveTo(txCoord + TZ/2, tyCoord);
            ctx.lineTo(txCoord + TZ/2, tyCoord + TZ);
            ctx.stroke();

            // Tiny heat ember sparks rising
            if (pSeed < 5) {
              const sy = tyCoord + TZ - ((s.ticks + pSeed * 4) % TZ);
              ctx.fillStyle = '#facc15';
              ctx.fillRect(txCoord + 4 + (pSeed % 12), sy, 1.5, 1.5);
            }
          } else if (t === TSW) {
            // --- MURKY SWAMP OVERHAUL ---
            // Swamp lily pads
            if (pSeed < 15) {
              const lx = txCoord + 6 + (pSeed % 10);
              const ly = tyCoord + 6 + (pSeed % 10);
              ctx.fillStyle = '#166534'; // rich dark green
              ctx.beginPath();
              ctx.arc(lx, ly, 3.5, 0, Math.PI * 1.75); // slight cut-out for leaf look
              ctx.fill();
              
              // Lily pad tiny pink flower bud
              if (pSeed % 3 === 0) {
                ctx.fillStyle = '#f472b6'; // pink
                ctx.beginPath();
                ctx.arc(lx, ly, 1, 0, Math.PI * 2);
                ctx.fill();
              }
            }
            // Bubbling swamp gas bubbles
            if (pSeed < 10) {
              const bPulse = Math.abs(Math.sin(s.ticks * 0.04 + pSeed));
              const bx = txCoord + 4 + (pSeed * 3) % 14;
              const by = tyCoord + 4 + (pSeed * 2) % 14;
              ctx.strokeStyle = `rgba(74, 222, 128, ${bPulse * 0.5})`;
              ctx.lineWidth = 0.5;
              ctx.beginPath();
              ctx.arc(bx, by, bPulse * 3, 0, Math.PI * 2);
              ctx.stroke();
            }
          } else if (t === TCR) {
            // --- CELESTIAL REALM OVERHAUL ---
            // Nebulous cosmic glow background
            const cosGlow = 0.12 + Math.sin(s.ticks * 0.03 + x + y) * 0.06;
            ctx.fillStyle = `rgba(147, 51, 234, ${cosGlow})`; // violet nebula
            ctx.fillRect(txCoord, tyCoord, TZ, TZ);

            // Floating white-blue stars
            if (pSeed < 12) {
              const stPulse = 0.2 + Math.abs(Math.sin(s.ticks * 0.06 + pSeed)) * 0.8;
              ctx.fillStyle = `rgba(56, 189, 248, ${stPulse})`; // sky blue sparkle
              const sx = txCoord + (pSeed * 3) % TZ;
              const sy = tyCoord + (pSeed * 2) % TZ;
              ctx.fillRect(sx, sy, 1.2, 1.2);
            }
          }

          ctx.restore();
        }
      }

      // Objects
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const o of s.objs) {
        const ox = o.tx * TZ + TZ / 2 - s.cam.x;
        const oy = o.ty * TZ + TZ / 2 - s.cam.y;
        if (ox < -TZ || ox > (ctx.canvas.width / zoom) + TZ || oy < -TZ || oy > (ctx.canvas.height / zoom) + TZ) continue;
        
        ctx.save();
        
        // General shadow beneath all physical objects
        if (o.type !== 'drop' && o.type !== 'fishing_hotspot' && o.type !== 'animal_track') {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
          ctx.beginPath();
          ctx.ellipse(ox, oy + TZ/2 - 2, TZ * 0.45, TZ * 0.18, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        if (o.type === 'tree') {
          // --- VECTOR TREE RENDERER ---
          const bob = Math.sin(s.ticks * 0.03 + o.tx * 7) * 0.5; // gentle wind rustle sway
          ctx.translate(ox, oy + TZ/2 - 3);
          ctx.rotate(bob * 0.04);

          // Draw trunk
          ctx.fillStyle = '#78350f'; // Dark brown
          ctx.fillRect(-2.5, -8, 5, 8);

          if (o.subtype === 'cactus') {
            // Cactus
            ctx.fillStyle = '#15803d'; // Rich green
            // Main stalk
            ctx.fillRect(-3, -24, 6, 16);
            // Arms
            ctx.fillRect(-8, -18, 5, 3);
            ctx.fillRect(-8, -22, 3, 5);
            ctx.fillRect(3, -15, 5, 3);
            ctx.fillRect(5, -19, 3, 5);
            // Spikes (little lines)
            ctx.strokeStyle = '#a3e635';
            ctx.lineWidth = 0.75;
            ctx.beginPath();
            ctx.moveTo(-5, -20); ctx.lineTo(-3, -20);
            ctx.moveTo(3, -22); ctx.lineTo(5, -22);
            ctx.moveTo(0, -12); ctx.lineTo(2, -12);
            ctx.stroke();
            // Flower on top
            ctx.fillStyle = '#f43f5e';
            ctx.beginPath();
            ctx.arc(0, -25, 2, 0, Math.PI * 2);
            ctx.fill();
          } else if (o.subtype === 'snowpine') {
            // Snowpine
            // Trunk roots
            ctx.fillStyle = '#451a03';
            ctx.fillRect(-3, -8, 6, 8);
            // Staggered branches
            const levels = [
              { w: 22, h: 8, y: -8, col: '#0f766e', snow: '#f8fafc' },
              { w: 16, h: 7, y: -14, col: '#115e59', snow: '#f1f5f9' },
              { w: 10, h: 6, y: -19, col: '#134e4a', snow: '#e2e8f0' }
            ];
            for (const l of levels) {
              ctx.fillStyle = l.col;
              ctx.beginPath();
              ctx.moveTo(0, l.y - l.h);
              ctx.lineTo(-l.w / 2, l.y);
              ctx.lineTo(l.w / 2, l.y);
              ctx.closePath();
              ctx.fill();

              // Snow Cap highlight
              ctx.fillStyle = l.snow;
              ctx.beginPath();
              ctx.moveTo(0, l.y - l.h);
              ctx.lineTo(-l.w / 4, l.y - l.h / 2);
              ctx.lineTo(l.w / 4, l.y - l.h / 2);
              ctx.closePath();
              ctx.fill();
            }
          } else if (o.subtype === 'blossom') {
            // Cherry Blossom
            ctx.fillStyle = '#5c2d17';
            ctx.fillRect(-2, -9, 4, 9);
            // Curved pink canopy clouds
            const clouds = [
              { x: 0, y: -14, r: 8, col: '#f472b6' },
              { x: -5, y: -10, r: 6, col: '#f472b6' },
              { x: 5, y: -11, r: 6, col: '#ec4899' },
              { x: -2, y: -18, r: 6, col: '#fbcfe8' }
            ];
            for (const c of clouds) {
              ctx.fillStyle = c.col;
              ctx.beginPath();
              ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
              ctx.fill();
            }
            // Tiny falling petal particle effect
            if (s.ticks % 60 < 20) {
              ctx.fillStyle = '#fbcfe8';
              ctx.beginPath();
              ctx.arc(Math.sin(s.ticks * 0.05) * 5, -5 + (s.ticks % 20) * 0.5, 1, 0, Math.PI * 2);
              ctx.fill();
            }
          } else if (o.subtype === 'cosmic') {
            // Cosmic purple tree
            ctx.fillStyle = '#2e1065';
            ctx.fillRect(-2.5, -9, 5, 9);
            // Nebula foliage clouds
            const clouds = [
              { x: 0, y: -15, r: 9, col: '#a855f7' },
              { x: -6, y: -11, r: 7, col: '#8b5cf6' },
              { x: 6, y: -12, r: 7, col: '#c084fc' },
              { x: 0, y: -19, r: 6, col: '#ddd6fe' }
            ];
            for (const c of clouds) {
              ctx.fillStyle = c.col;
              ctx.beginPath();
              ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
              ctx.fill();
              
              // Sparkle stars
              if (s.ticks % 40 < 10) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(c.x + (s.ticks % 5) - 2, c.y + (s.ticks % 4) - 2, 1, 1);
              }
            }
          } else {
            // Standard leafy/pine evergreen tree
            // Roots trunk details
            ctx.fillStyle = '#451a03';
            ctx.fillRect(-3, -8, 6, 8);
            // Multi-layered verdant forest leaves
            const branches = [
              { w: 24, h: 9, y: -8, col: '#15803d' },
              { w: 18, h: 8, y: -15, col: '#16a34a' },
              { w: 12, h: 7, y: -21, col: '#22c55e' }
            ];
            for (const b of branches) {
              ctx.fillStyle = b.col;
              ctx.beginPath();
              ctx.moveTo(0, b.y - b.h);
              ctx.lineTo(-b.w / 2, b.y);
              ctx.lineTo(b.w / 2, b.y);
              ctx.closePath();
              ctx.fill();
              
              // Dark trim shading
              ctx.strokeStyle = '#14532d';
              ctx.lineWidth = 0.5;
              ctx.strokeRect(-b.w / 2, b.y, b.w, 0.5);
            }
          }
        } else if (o.type === 'rock') {
          // --- VECTOR ROCK RENDERER ---
          ctx.translate(ox, oy + TZ/2 - 3);
          
          // Draw boulder base
          ctx.fillStyle = '#475569'; // slate grey
          ctx.beginPath();
          ctx.moveTo(-9, 0);
          ctx.lineTo(-10, -5);
          ctx.lineTo(-6, -11);
          ctx.lineTo(0, -13);
          ctx.lineTo(6, -11);
          ctx.lineTo(9, -4);
          ctx.lineTo(8, 0);
          ctx.closePath();
          ctx.fill();

          // Highlight bevel edge
          ctx.strokeStyle = '#64748b';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(-10, -5);
          ctx.lineTo(-6, -11);
          ctx.lineTo(0, -13);
          ctx.lineTo(6, -11);
          ctx.stroke();

          // Mineral crystals overlays
          if (o.subtype && o.subtype !== 'none') {
            let oreCol = '#94a3b8';
            let isSparkle = false;
            
            if (o.subtype === 'copper') oreCol = '#ea580c';
            else if (o.subtype === 'iron') oreCol = '#818cf8';
            else if (o.subtype === 'coal') oreCol = '#1e293b';
            else if (o.subtype === 'gold') { oreCol = '#fbbf24'; isSparkle = true; }
            else if (o.subtype === 'mithril') { oreCol = '#22d3ee'; isSparkle = true; }
            else if (o.subtype === 'sulfur') oreCol = '#eab308';
            else if (o.subtype === 'mana_crystal') { oreCol = '#c084fc'; isSparkle = true; }
            else if (o.subtype === 'void_crystal' || o.subtype === 'crystal') { oreCol = '#ec4899'; isSparkle = true; }
            else if (o.subtype === 'celestial') { oreCol = '#38bdf8'; isSparkle = true; }

            ctx.fillStyle = oreCol;
            // Draw 2-3 jagged crystal nodes sticking out of the boulder
            ctx.beginPath();
            ctx.moveTo(-4, -6);
            ctx.lineTo(-6, -11);
            ctx.lineTo(-2, -9);
            ctx.closePath();
            ctx.fill();

            ctx.beginPath();
            ctx.moveTo(2, -4);
            ctx.lineTo(5, -10);
            ctx.lineTo(5, -5);
            ctx.closePath();
            ctx.fill();

            ctx.beginPath();
            ctx.moveTo(-1, -11);
            ctx.lineTo(1, -15);
            ctx.lineTo(3, -11);
            ctx.closePath();
            ctx.fill();

            // Tiny star sparkles for rare gems
            if (isSparkle && (s.ticks % 30 < 8)) {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(Math.sin(s.ticks) * 6, -11 + Math.cos(s.ticks) * 3, 1.5, 1.5);
            }
          }
        } else if (o.type === 'drop') {
          // --- FLOATING ITEM RENDERER ---
          const hoverY = Math.sin(s.ticks * 0.08 + o.tx * 5) * 2.5;
          ctx.translate(ox, oy + hoverY);

          // Glowing floor shadow pedestal
          ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
          ctx.beginPath();
          ctx.arc(0, 10 - hoverY, 5, 0, Math.PI * 2);
          ctx.fill();

          // Pulsating magic halo
          const pulse = 5 + Math.sin(s.ticks * 0.15) * 3;
          ctx.save();
          ctx.shadowColor = '#38bdf8';
          ctx.shadowBlur = pulse;
          ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
          ctx.beginPath();
          ctx.arc(0, 0, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          // Render item emoji on top of pedestal
          const ico = IT[o.item]?.ico || '•';
          ctx.font = '10px serif';
          ctx.fillText(ico, 0, 0);
        } else if (o.type === 'campfire') {
          // --- DYNAMIC FLAME VECTOR RENDERER ---
          ctx.translate(ox, oy);

          // Draw Firewood base logs
          ctx.fillStyle = '#5c2d17';
          ctx.fillRect(-7, 2, 14, 3);
          ctx.fillRect(-5, -1, 10, 3);

          // Custom procedural overlapping flame shapes
          const pulseA = Math.sin(s.ticks * 0.2) * 2;
          const pulseB = Math.cos(s.ticks * 0.15) * 1.5;

          // 1. Outer Fire Ring (Warm orange-red)
          ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
          ctx.beginPath();
          ctx.moveTo(-6, 2);
          ctx.quadraticCurveTo(-4, -4 + pulseA, -1, -12 + pulseB);
          ctx.quadraticCurveTo(0, -6, 2, -10 + pulseA);
          ctx.quadraticCurveTo(4, -4, 6, 2);
          ctx.closePath();
          ctx.fill();

          // 2. Middle Fire Ring (Orange)
          ctx.fillStyle = 'rgba(249, 115, 22, 0.9)';
          ctx.beginPath();
          ctx.moveTo(-4, 2);
          ctx.quadraticCurveTo(-2, -2 + pulseB, -0.5, -9 + pulseA);
          ctx.quadraticCurveTo(0, -4, 1.5, -7 + pulseB);
          ctx.quadraticCurveTo(3, -2, 4, 2);
          ctx.closePath();
          ctx.fill();

          // 3. Inner Fire Ring (Hot yellow)
          ctx.fillStyle = 'rgba(253, 224, 71, 0.95)';
          ctx.beginPath();
          ctx.moveTo(-2, 2);
          ctx.quadraticCurveTo(0, -2 + pulseA, 0, -6 + pulseB);
          ctx.quadraticCurveTo(1, -2, 2, 2);
          ctx.closePath();
          ctx.fill();

          // Add ambient glow
          const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, TZ * 2);
          grad.addColorStop(0, 'rgba(251, 146, 60, 0.18)');
          grad.addColorStop(1, 'rgba(251, 146, 60, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(0, 0, TZ * 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (o.type === 'magic_altar') {
          // --- MAGICAL floating ALTER RENDERER ---
          ctx.translate(ox, oy);

          const hover = Math.sin(s.ticks * 0.05) * 3;

          // Draw pedestal base
          ctx.fillStyle = '#1e1b4b'; // deep indigo stone
          ctx.beginPath();
          ctx.moveTo(-10, 8);
          ctx.lineTo(-8, 3);
          ctx.lineTo(8, 3);
          ctx.lineTo(10, 8);
          ctx.closePath();
          ctx.fill();

          // Floating triangular monolith
          ctx.fillStyle = '#0f172a'; // obsidian dark slate
          ctx.beginPath();
          ctx.moveTo(0, -14 + hover);
          ctx.lineTo(-5, -3 + hover);
          ctx.lineTo(5, -3 + hover);
          ctx.closePath();
          ctx.fill();

          // Monolith neon magenta glowing rune lines
          ctx.strokeStyle = `rgba(232, 121, 249, ${0.4 + Math.sin(s.ticks * 0.08) * 0.4})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, -11 + hover);
          ctx.lineTo(0, -4 + hover);
          ctx.stroke();

          // Orbiting rings
          ctx.strokeStyle = 'rgba(168, 85, 247, 0.45)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.ellipse(0, -8 + hover, 9, 3, s.ticks * 0.03, 0, Math.PI * 2);
          ctx.stroke();

          // Vertical glowing stardust particles rising
          if (s.ticks % 25 < 12) {
            ctx.fillStyle = '#d946ef';
            ctx.fillRect(-3 + (s.ticks % 7), 2 - (s.ticks % 18), 1.5, 1.5);
          }
        } else if (o.type === 'fishing_hotspot') {
          // --- FISHING WHIRLPOOL RENDERER ---
          ctx.translate(ox, oy);

          const rippleRadius = (TZ * 0.4) + Math.abs(Math.sin(s.ticks * 0.05)) * (TZ * 0.4);
          ctx.strokeStyle = o.subtype === 'lava' ? 'rgba(239, 68, 68, 0.6)' : 'rgba(56, 189, 248, 0.6)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(0, 0, rippleRadius, 0, Math.PI * 2);
          ctx.stroke();

          // Swirling blue-white circles
          ctx.strokeStyle = o.subtype === 'lava' ? 'rgba(249, 115, 22, 0.3)' : 'rgba(14, 165, 233, 0.3)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(0, 0, TZ * 0.3, TZ * 0.15, s.ticks * 0.04, 0, Math.PI * 2);
          ctx.stroke();

          // Swimming fish silhouette helper inside bubble
          ctx.font = '8px serif';
          ctx.fillText(o.ico || '🐟', 0, Math.sin(s.ticks * 0.06) * 1.5);
        } else if (o.type === 'shelter' || o.type === 'settler_shelter') {
          // --- COZY LOG CABIN RENDERER ---
          ctx.translate(ox, oy);

          // Cabin wooden log walls
          ctx.fillStyle = '#b45309'; // warm amber brown
          ctx.fillRect(-12, -4, 24, 12);
          ctx.strokeStyle = '#78350f';
          ctx.lineWidth = 1;
          ctx.strokeRect(-12, -4, 24, 12);

          // Cute small logs joints lines
          ctx.fillStyle = '#78350f';
          ctx.fillRect(-12, -1, 3, 2);
          ctx.fillRect(9, -1, 3, 2);

          // Cozy glowing windows
          ctx.fillStyle = '#fef08a'; // Bright yellow soft light
          ctx.fillRect(-7, -1, 5, 5);
          ctx.strokeStyle = '#d97706';
          ctx.strokeRect(-7, -1, 5, 5);
          
          // Window cross divider
          ctx.beginPath();
          ctx.moveTo(-4.5, -1); ctx.lineTo(-4.5, 4);
          ctx.moveTo(-7, 1.5); ctx.lineTo(-2, 1.5);
          ctx.stroke();

          // Warm cabin door
          ctx.fillStyle = '#78350f';
          ctx.fillRect(2, 0, 6, 8);
          // Tiny brass doorknob
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.arc(3.5, 4, 1, 0, Math.PI * 2);
          ctx.fill();

          // Slanted straw/clay roof
          ctx.fillStyle = '#ea580c'; // Red clay roof tile
          ctx.beginPath();
          ctx.moveTo(0, -11);
          ctx.lineTo(-14, -4);
          ctx.lineTo(14, -4);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#9a3412';
          ctx.stroke();

          // Stone chimney emitting smoking rings!
          ctx.fillStyle = '#475569';
          ctx.fillRect(6, -11, 4, 5);
          
          if (s.ticks % 40 < 15) {
            ctx.strokeStyle = `rgba(148, 163, 184, ${0.6 - (s.ticks % 15) * 0.04})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(8, -13 - (s.ticks % 15) * 0.8, 1.5 + (s.ticks % 15) * 0.4, 0, Math.PI * 2);
            ctx.stroke();
          }
        } else if (o.type === 'watch_tower' || o.type === 'sentry_turret') {
          // --- WATCH TOWER DEFENSE STRUCTURE ---
          ctx.translate(ox, oy);

          // Range indicator preview
          ctx.strokeStyle = o.type === 'watch_tower' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)';
          ctx.fillStyle = o.type === 'watch_tower' ? 'rgba(245, 158, 11, 0.03)' : 'rgba(16, 185, 129, 0.03)';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(0, 0, o.type === 'watch_tower' ? 350 : 220, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.setLineDash([]);

          // Base stone support pillars
          ctx.fillStyle = '#64748b';
          ctx.fillRect(-8, 3, 4, 5);
          ctx.fillRect(4, 3, 4, 5);

          // Tower platform cabin wood
          ctx.fillStyle = '#b45309';
          ctx.fillRect(-10, -7, 20, 10);
          ctx.strokeStyle = '#78350f';
          ctx.strokeRect(-10, -7, 20, 10);

          // Wooden spiked railing
          ctx.fillStyle = '#d97706';
          ctx.fillRect(-10, -10, 20, 3);

          // Small lookout roof
          ctx.fillStyle = '#1e293b';
          ctx.beginPath();
          ctx.moveTo(0, -16);
          ctx.lineTo(-12, -10);
          ctx.lineTo(12, -10);
          ctx.closePath();
          ctx.fill();

          // Sentry defense gem / lens
          ctx.fillStyle = o.type === 'watch_tower' ? '#f59e0b' : '#10b981';
          ctx.beginPath();
          ctx.arc(0, -4, 3, 0, Math.PI * 2);
          ctx.fill();
        } else if (o.type === 'lore_node') {
          // --- ANCIENT LORE BOOK BOOKSHELF ---
          ctx.translate(ox, oy);

          const hover = Math.sin(s.ticks * 0.08) * 2;
          const ringRad = TZ * 0.5 + Math.sin(s.ticks * 0.08) * 3;

          // Glowing energy sphere back aura
          ctx.save();
          ctx.shadowColor = o.subtype === 'echo' ? '#06b6d4' : o.subtype === 'carving' ? '#eab308' : '#a855f7';
          ctx.shadowBlur = 10;
          ctx.fillStyle = o.subtype === 'echo' ? 'rgba(6, 182, 212, 0.15)' : o.subtype === 'carving' ? 'rgba(234, 179, 8, 0.15)' : 'rgba(168, 85, 247, 0.15)';
          ctx.beginPath();
          ctx.arc(0, hover, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          // Runic orbit energy rings
          ctx.strokeStyle = o.subtype === 'echo' ? 'rgba(56, 189, 248, 0.65)' : o.subtype === 'carving' ? 'rgba(234, 179, 8, 0.65)' : 'rgba(168, 85, 247, 0.65)';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 2]);
          ctx.beginPath();
          ctx.ellipse(0, hover, ringRad, ringRad / 2, s.ticks * 0.03, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);

          // Small leather tome icon
          ctx.font = '9px serif';
          ctx.fillText(o.ico || '📓', 0, hover);
        } else if (o.type === 'water_pump' || o.type === 'water_reservoir' || o.type === 'water_pipe') {
          // --- PUMP SYSTEM ---
          ctx.translate(ox, oy);

          // Glowing water system container
          ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
          ctx.beginPath();
          ctx.arc(0, 0, TZ * 0.45 + Math.sin(s.ticks * 0.05) * 2, 0, Math.PI * 2);
          ctx.fill();

          // Metallic pipelines brass lines
          ctx.fillStyle = '#d97706';
          ctx.fillRect(-3, -5, 6, 12);
          ctx.fillStyle = '#b45309';
          ctx.fillRect(-6, 3, 12, 3);

          // Glowing blue water indicator tube
          ctx.fillStyle = '#0284c7';
          ctx.fillRect(-1.5, -2, 3, 6);
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(-1.5, 1, 3, 3); // moving level

          // Water drop emitter
          ctx.fillStyle = '#38bdf8';
          ctx.font = '8px sans-serif';
          ctx.fillText('💧', 0, -11 + Math.sin(s.ticks * 0.08) * 2);
        } else {
          // Fallback simple emoji drawing with shadow
          const ico = o.ico || IT[o.type]?.ico || '?';
          ctx.font = `${TZ - 2}px serif`;
          ctx.fillText(ico, ox, oy);
        }

        // --- DYNAMIC REAL-TIME PROXIMITY LIGHTING OVERLAY ---
        let lightingColor = null;
        let lightingIntensity = 0;
        
        // 1. Player torch proximity lighting
        const pDist = Math.hypot(o.tx * TZ + TZ/2 - s.pl.x, o.ty * TZ + TZ/2 - s.pl.y);
        const isTorchActive = s.pl.hotbar[hotSlot] === 'torch' && (s.pl.inv['torch'] || 0) > 0;
        if (isTorchActive && pDist < 160) {
          lightingColor = 'rgba(251, 146, 60, 0.16)'; // warm torch orange
          lightingIntensity = (1 - pDist / 160) * 0.16;
        } else if (pDist < 100) {
          lightingColor = 'rgba(255, 255, 255, 0.08)'; // cool ambient white
          lightingIntensity = (1 - pDist / 100) * 0.08;
        }

        // 2. Campfire proximity flickering lighting
        for (const otherO of s.objs) {
          if (otherO.type === 'campfire' || otherO.type === 'camp_fire') {
            const fDist = Math.hypot((o.tx - otherO.tx) * TZ, (o.ty - otherO.ty) * TZ);
            if (fDist < 120) {
              const campIntensity = (1 - fDist / 120) * (0.24 + Math.sin(s.ticks * 0.15) * 0.06);
              if (campIntensity > lightingIntensity) {
                lightingColor = 'rgba(249, 115, 22, 0.24)'; // flickering orange fire glow
                lightingIntensity = campIntensity;
              }
            }
          }
        }

        // Apply lighting tint overlay using source-atop
        if (lightingColor && lightingIntensity > 0) {
          ctx.save();
          ctx.globalCompositeOperation = 'source-atop';
          ctx.fillStyle = lightingColor.replace(/[\d\.]+\)$/, `${lightingIntensity})`);
          // Draw at both local (0,0) and camera space (ox, oy) to support translated and absolute sub-renderers safely
          ctx.beginPath();
          ctx.arc(0, 0, TZ * 2.2, 0, Math.PI * 2);
          ctx.arc(ox, oy, TZ * 2.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        ctx.restore();
      }

      // Draw hover reticle
      if (mouseTileRef.current) {
        const { tx, ty } = mouseTileRef.current;
        const rx = tx * TZ - s.cam.x;
        const ry = ty * TZ - s.cam.y;
        
        // Calculate distance from player in tiles
        const px = Math.floor(s.pl.x / TZ);
        const py = Math.floor(s.pl.y / TZ);
        const distance = Math.abs(tx - px) + Math.abs(ty - py);
        const inRange = distance <= 4;
        
        ctx.save();
        if (inRange) {
          // Check if there is an object on this tile
          const o = s.objs.find((obj: any) => obj.tx === tx && obj.ty === ty);
          if (o) {
            ctx.strokeStyle = '#f43f5e'; // Red-orange for hitting an object
            ctx.shadowColor = '#f43f5e';
            ctx.lineWidth = 1.5;
          } else {
            ctx.strokeStyle = '#10b981'; // Green for gathering tile resource
            ctx.shadowColor = '#10b981';
            ctx.lineWidth = 1.2;
          }
          ctx.shadowBlur = 4;
          
          // Draw animated corners
          const pad = 2;
          const len = 6;
          ctx.beginPath();
          // Top Left
          ctx.moveTo(rx + pad, ry + pad + len);
          ctx.lineTo(rx + pad, ry + pad);
          ctx.lineTo(rx + pad + len, ry + pad);
          // Top Right
          ctx.moveTo(rx + TZ - pad - len, ry + pad);
          ctx.lineTo(rx + TZ - pad, ry + pad);
          ctx.lineTo(rx + TZ - pad, ry + pad + len);
          // Bottom Left
          ctx.moveTo(rx + pad, ry + TZ - pad - len);
          ctx.lineTo(rx + pad, ry + TZ - pad);
          ctx.lineTo(rx + pad + len, ry + TZ - pad);
          // Bottom Right
          ctx.moveTo(rx + TZ - pad - len, ry + TZ - pad);
          ctx.lineTo(rx + TZ - pad, ry + TZ - pad);
          ctx.lineTo(rx + TZ - pad, ry + TZ - pad - len);
          ctx.stroke();
          
          // Small text or indicator
          ctx.shadowBlur = 0;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
          ctx.font = '8px monospace';
          ctx.textAlign = 'center';
          if (o) {
            ctx.fillText(`HIT [HP:${o.hp || 1}]`, rx + TZ / 2, ry - 4);
          } else {
            // Get tile type text and emoji
            const tileType = s.world[ty]?.[tx];
            let label = "Dig";
            if (tileType === TG) label = "🌿 Fiber";
            else if (tileType === TD) label = "🪵 Stick";
            else if (tileType === TS) label = "🪨 Stone";
            else if (tileType === TW) label = "💧 Water";
            else if (tileType === TSA) label = "🌾 Flint";
            else if (tileType === TSN) label = "❄️ Ice";
            else if (tileType === TCR) label = "✨ Essence";
            
            ctx.fillText(label, rx + TZ / 2, ry - 4);
          }
        } else {
          // Out of range indicator
          ctx.strokeStyle = 'rgba(156, 163, 175, 0.4)'; // Gray dashed box
          ctx.setLineDash([2, 2]);
          ctx.strokeRect(rx + 2, ry + 2, TZ - 4, TZ - 4);
          ctx.fillStyle = 'rgba(156, 163, 175, 0.6)';
          ctx.font = '8px monospace';
          ctx.textAlign = 'center';
          ctx.fillText("Too Far", rx + TZ / 2, ry - 4);
        }
        ctx.restore();
      }

      // Draw Scouted Nodes on Radar (Reveal Map active)
      if (s.activeScoutedNodes && s.activeScoutedNodes.length > 0) {
        for (const sn of s.activeScoutedNodes) {
          const sx = sn.tx * TZ + TZ / 2 - s.cam.x;
          const sy = sn.ty * TZ + TZ / 2 - s.cam.y;
          
          if (sx < -TZ || sx > (ctx.canvas.width / zoom) + TZ || sy < -TZ || sy > (ctx.canvas.height / zoom) + TZ) continue;

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
      if (s.pl.ifr > 0 && s.ticks % 10 < 5) ctx.globalAlpha = 0.5;
      
      const pxDraw = s.pl.x - s.cam.x;
      const pyDraw = s.pl.y - s.cam.y;

      const plMoving = Math.abs(s.pl.vx) > 0.1 || Math.abs(s.pl.vy) > 0.1 || s.pl.isGridMoving;

      // Update and maintain a position history trail for smooth motion blur trailing
      if (!s.pl.trail) s.pl.trail = [];
      if (s.pl.trail.length === 0 || s.pl.trail[s.pl.trail.length - 1].x !== s.pl.x || s.pl.trail[s.pl.trail.length - 1].y !== s.pl.y) {
        s.pl.trail.push({ x: s.pl.x, y: s.pl.y });
        if (s.pl.trail.length > 5) s.pl.trail.shift();
      }

      // Draw beautiful translucent motion blur trail ghosts if moving fast/sprinting
      if (plMoving && s.pl.trail && s.pl.trail.length > 1) {
        for (let i = 0; i < s.pl.trail.length - 1; i += 2) {
          const trailPos = s.pl.trail[i];
          const txDraw = trailPos.x - s.cam.x;
          const tyDraw = trailPos.y - s.cam.y;
          const trailAlpha = 0.12 * (i + 1) / s.pl.trail.length;
          
          ctx.save();
          ctx.globalAlpha = trailAlpha;
          ctx.translate(txDraw, tyDraw);
          // Draw a modern glowing neon cyan/blue silhouette trail of the player character
          ctx.fillStyle = '#06b6d4';
          ctx.fillRect(-5, -3, 10, 11);
          ctx.beginPath();
          ctx.arc(0, -7, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // Draw shadow beneath player
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.ellipse(pxDraw, pyDraw + 11, 10, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Subtle magic shield if healing sanctuary is active
      if (s.activeSpells?.healingSanctuaryTimer > 0) {
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.65)';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#10b981';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(pxDraw, pyDraw, 20 + Math.sin(s.ticks * 0.1) * 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      ctx.restore();

      // --- VECTOR PLAYER CHARACTER OVERHAUL ---
      ctx.save();
      ctx.translate(pxDraw, pyDraw);

      // Idle breathing cycle or walk cycle bounce/wiggle
      const walkCycle = plMoving ? Math.sin(s.ticks * 0.2) * 2 : 0;
      const walkSway = plMoving ? Math.cos(s.ticks * 0.2) * 0.05 : 0;
      
      ctx.translate(0, walkCycle * 0.5);
      ctx.rotate(walkSway);

      // Gentle vertical breathing cycle when idle
      const breathScaleY = !plMoving ? 1 + Math.sin(s.ticks * 0.08) * 0.025 : 1;
      const breathScaleX = !plMoving ? 1 - Math.sin(s.ticks * 0.08) * 0.012 : 1;
      ctx.scale(breathScaleX, breathScaleY);

      // 1. Draw Backpack (Behind body)
      ctx.fillStyle = '#78350f'; // Leather brown backpack
      ctx.fillRect(-6, -6, 12, 10);
      ctx.fillStyle = '#451a03'; // straps
      ctx.fillRect(-5, -6, 2, 10);
      ctx.fillRect(3, -6, 2, 10);

      // 2. Draw Body / Armor Clothing (Chestpiece)
      let bodyCol = '#ef4444'; // default red tunic
      let trimCol = '#ffffff';
      
      if (s.pl.equip?.chest) {
        if (s.pl.equip.chest.includes('mithril')) { bodyCol = '#22d3ee'; trimCol = '#ffffff'; }
        else if (s.pl.equip.chest.includes('iron')) { bodyCol = '#94a3b8'; trimCol = '#475569'; }
        else if (s.pl.equip.chest.includes('beastmaster')) { bodyCol = '#ea580c'; trimCol = '#fbbf24'; }
        else if (s.pl.equip.chest.includes('leather')) { bodyCol = '#b45309'; trimCol = '#d97706'; }
      }
      ctx.fillStyle = bodyCol;
      ctx.fillRect(-5, -3, 10, 11);
      
      // Trim belt detail
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-5.5, 4, 11, 2.5);
      ctx.fillStyle = trimCol;
      ctx.fillRect(-1.5, 4, 3, 2.5); // belt buckle

      // 3. Draw Legs (Wiggling walk cycle!)
      let legCol = '#1d4ed8'; // default blue pants
      if (s.pl.equip?.legs) {
        if (s.pl.equip.legs.includes('mithril')) legCol = '#06b6d4';
        else if (s.pl.equip.legs.includes('iron')) legCol = '#64748b';
        else if (s.pl.equip.legs.includes('leather')) legCol = '#78350f';
      }
      ctx.fillStyle = legCol;
      // Left Leg
      ctx.fillRect(-4, 8, 3.5, 4 + (plMoving ? Math.sin(s.ticks * 0.2) * 1.5 : 0));
      // Right Leg
      ctx.fillRect(0.5, 8, 3.5, 4 + (plMoving ? -Math.sin(s.ticks * 0.2) * 1.5 : 0));

      // 4. Draw Head / Helmet
      let headCol = '#fbcfe8'; // default skin tone
      let hasHelmet = false;
      let helmCol = '#94a3b8';
      let plumeCol = '#f43f5e';

      if (s.pl.equip?.head) {
        hasHelmet = true;
        if (s.pl.equip.head.includes('mithril')) { helmCol = '#22d3ee'; plumeCol = '#c084fc'; }
        else if (s.pl.equip.head.includes('iron')) { helmCol = '#94a3b8'; plumeCol = '#ef4444'; }
        else if (s.pl.equip.head.includes('leather')) { helmCol = '#78350f'; plumeCol = '#fbbf24'; }
      }

      if (hasHelmet) {
        // Draw Helmet helmet vector
        ctx.fillStyle = helmCol;
        ctx.beginPath();
        ctx.arc(0, -9, 5.5, Math.PI, 0, false);
        ctx.fill();
        ctx.fillRect(-5.5, -9, 11, 3.5); // visor plate
        
        // Plume / Crest on helmet
        ctx.fillStyle = plumeCol;
        ctx.beginPath();
        ctx.moveTo(0, -14.5);
        ctx.lineTo(-4, -11.5);
        ctx.lineTo(2, -11.5);
        ctx.closePath();
        ctx.fill();

        // Eye slit glow
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(-3, -7.5, 6, 1);
      } else {
        // Draw simple round head
        ctx.fillStyle = headCol;
        ctx.beginPath();
        ctx.arc(0, -7, 5, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw cute little eyes
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-2.5, -8, 1.2, 1.2);
        ctx.fillRect(1.3, -8, 1.2, 1.2);
        
        // Hair
        ctx.fillStyle = '#d97706'; // orange/brown hair
        ctx.fillRect(-4.5, -11, 9, 3);
      }

      // 5. Draw Active Tool/Weapon in Hand (Rotating/swinging)
      ctx.save();
      ctx.translate(6, 1);
      const activeW = s.pl.weapon || 'fists';
      if (activeW !== 'fists') {
        const swing = Math.sin(s.ticks * 0.15) * 0.3; // idle sway
        ctx.rotate(0.3 + swing);

        // Render Tool vector graphic based on type
        if (activeW.includes('pickaxe')) {
          // Curved pickaxe
          let pickCol = '#94a3b8';
          if (activeW.includes('mithril')) pickCol = '#22d3ee';
          else if (activeW.includes('copper')) pickCol = '#ea580c';

          ctx.fillStyle = '#78350f'; // wood staff
          ctx.fillRect(-1, -12, 2, 14);
          ctx.fillStyle = pickCol; // metal double spike
          ctx.beginPath();
          ctx.moveTo(-6, -11);
          ctx.quadraticCurveTo(0, -13, 6, -11);
          ctx.lineTo(1, -9);
          ctx.lineTo(-1, -9);
          ctx.closePath();
          ctx.fill();
        } else if (activeW.includes('axe')) {
          // Felling Axe
          let metalCol = '#94a3b8';
          if (activeW.includes('mithril')) metalCol = '#22d3ee';
          else if (activeW.includes('stone')) metalCol = '#475569';

          ctx.fillStyle = '#78350f'; // shaft
          ctx.fillRect(-1, -12, 2, 14);
          ctx.fillStyle = metalCol; // axe blade
          ctx.beginPath();
          ctx.moveTo(0, -11);
          ctx.lineTo(5, -14);
          ctx.lineTo(5, -7);
          ctx.lineTo(0, -9);
          ctx.closePath();
          ctx.fill();
        } else if (activeW.includes('sword')) {
          // Sharp glittering sword
          let metalCol = '#cbd5e1';
          let hiltCol = '#fbbf24';
          if (activeW.includes('mithril')) metalCol = '#22d3ee';
          else if (activeW.includes('copper')) metalCol = '#f97316';

          ctx.fillStyle = hiltCol; // guard
          ctx.fillRect(-3, -2, 6, 1.5);
          ctx.fillStyle = '#78350f'; // handle
          ctx.fillRect(-0.75, -1, 1.5, 3);
          
          ctx.fillStyle = metalCol; // double-edged blade
          ctx.beginPath();
          ctx.moveTo(-1.2, -2);
          ctx.lineTo(-1.2, -14);
          ctx.lineTo(0, -17); // sharp point
          ctx.lineTo(1.2, -14);
          ctx.lineTo(1.2, -2);
          ctx.closePath();
          ctx.fill();

          // Shining reflection line
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(-0.5, -13, 0.6, 10);
        } else if (activeW === 'fishing_rod') {
          // Bent Fishing rod
          ctx.strokeStyle = '#d97706';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, 2);
          ctx.quadraticCurveTo(3, -5, 8, -10);
          ctx.stroke();

          // Hanging wire line
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.beginPath();
          ctx.moveTo(8, -10);
          ctx.lineTo(8, -2);
          ctx.stroke();
        } else if (activeW.includes('bow')) {
          // Bow
          ctx.strokeStyle = '#d97706';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(0, -5, 6, -Math.PI / 2, Math.PI / 2);
          ctx.stroke();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'; // bowstring
          ctx.beginPath();
          ctx.moveTo(0, -11);
          ctx.lineTo(0, 1);
          ctx.stroke();
        }
      } else {
        // Draw fists
        ctx.fillStyle = headCol;
        ctx.beginPath();
        ctx.arc(-1, 0, 1.5, 0, Math.PI * 2);
        ctx.arc(1, 1, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Overlap original emoji face inside a small float badge if they chose an interesting emoji custom shape
      if (s.pl.ico && s.pl.ico !== '🧍') {
        ctx.font = '7px sans-serif';
        ctx.fillText(s.pl.ico, 0, -16 + Math.sin(s.ticks * 0.08) * 1.5);
      }

      // --- DYNAMIC FIRE/TORCH LIGHTING OVERLAY ON PLAYER ---
      let pLightingColor = null;
      let pLightingIntensity = 0;
      for (const otherO of s.objs) {
        if (otherO.type === 'campfire' || otherO.type === 'camp_fire') {
          const fDist = Math.hypot(s.pl.x - (otherO.tx * TZ + TZ/2), s.pl.y - (otherO.ty * TZ + TZ/2));
          if (fDist < 120) {
            const campIntensity = (1 - fDist / 120) * (0.28 + Math.sin(s.ticks * 0.15) * 0.06);
            if (campIntensity > pLightingIntensity) {
              pLightingColor = 'rgba(249, 115, 22, 0.28)'; // Warm flickering fire glow
              pLightingIntensity = campIntensity;
            }
          }
        }
      }
      if (pLightingColor && pLightingIntensity > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = pLightingColor.replace(/[\d\.]+\)$/, `${pLightingIntensity})`);
        ctx.fillRect(-15, -25, 30, 40);
        ctx.restore();
      }

      ctx.restore();
      ctx.globalAlpha = 1;

      // Enemies
      for (const e of s.enemies) {
        const ex = e.x - s.cam.x;
        const ey = e.y - s.cam.y;
        if (ex < -TZ || ex > (ctx.canvas.width / zoom) + TZ || ey < -TZ || ey > (ctx.canvas.height / zoom) + TZ) continue;

        // Beautiful Bobbing and Squish-Stretch Animations
        const bob = Math.sin(s.ticks * 0.12 + e.id * 1.5) * 4;
        const squishX = 1 + Math.sin(s.ticks * 0.16 + e.id) * 0.06;
        const squishY = 1 - Math.sin(s.ticks * 0.16 + e.id) * 0.06;

        // Shadow beneath enemy
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        ctx.ellipse(ex, ey + 11, 10 * squishX, 4 * squishY, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // --- PREMIUM 3D BATTLE TOKEN WRAPPER ---
        ctx.save();
        ctx.translate(ex, ey + bob);
        ctx.scale(squishX, squishY);

        const isBoss = ET[e.eid]?.boss || e.boss;

        // Draw glowing token aura background
        let glowCol = 'rgba(56, 189, 248, 0.15)'; // friendly cyan
        let borderCol = '#64748b'; // default slate steel
        
        if (isBoss) {
          glowCol = 'rgba(245, 158, 11, 0.35)'; // gold lava glow
          borderCol = '#fbbf24'; // shiny gold border
        } else if (e.isAggro) {
          glowCol = 'rgba(239, 68, 68, 0.25)'; // angry red
          borderCol = '#ef4444'; // crimson red border
        } else if (e.slowTicks > 0) {
          glowCol = 'rgba(56, 189, 248, 0.25)'; // frozen sky blue
          borderCol = '#38bdf8';
        }

        // Draw polished 3D base token disk
        const baseRad = TZ * 0.52;
        ctx.shadowColor = borderCol;
        ctx.shadowBlur = isBoss ? 12 : 3;
        
        // Inner base fill
        const radGrad = ctx.createRadialGradient(0, -TZ/6, 0, 0, -TZ/6, baseRad);
        radGrad.addColorStop(0, '#1e293b'); // dark core
        radGrad.addColorStop(1, '#0f172a');
        ctx.fillStyle = radGrad;
        ctx.beginPath();
        ctx.arc(0, -TZ/6, baseRad, 0, Math.PI * 2);
        ctx.fill();
        
        // Outlined metallic bezel rim
        ctx.strokeStyle = borderCol;
        ctx.lineWidth = isBoss ? 2 : 1.2;
        ctx.beginPath();
        ctx.arc(0, -TZ/6, baseRad, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0; // reset

        // Red hit flash glow effect
        if (e.flashTicks && e.flashTicks > 0) {
          ctx.fillStyle = 'rgba(239, 68, 68, 0.55)';
          ctx.beginPath();
          ctx.arc(0, -TZ/6, baseRad - 0.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // Bobbing floating emoji monster avatar
        ctx.font = `${TZ - 4}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ET[e.eid].ico, 0, -TZ/6);
        
        // Draw boss gold crown on top of token if applicable
        if (isBoss) {
          ctx.fillStyle = '#fbbf24';
          ctx.strokeStyle = '#d97706';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(-6, -TZ * 0.72);
          ctx.lineTo(-7, -TZ * 0.88);
          ctx.lineTo(-3, -TZ * 0.80);
          ctx.lineTo(0, -TZ * 0.94); // center spire
          ctx.lineTo(3, -TZ * 0.80);
          ctx.lineTo(7, -TZ * 0.88);
          ctx.lineTo(6, -TZ * 0.72);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          
          // Tiny diamond dot
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(0, -TZ * 0.94, 0.8, 0, Math.PI * 2);
          ctx.fill();
        }

        // --- DYNAMIC FIRE/TORCH LIGHTING OVERLAY ON ENEMY ---
        let eLightingColor = null;
        let eLightingIntensity = 0;
        
        // 1. Proximity to player's active torch
        const pDist = Math.hypot(e.x - s.pl.x, e.y - s.pl.y);
        const isTorchActive = s.pl.hotbar[hotSlot] === 'torch' && (s.pl.inv['torch'] || 0) > 0;
        if (isTorchActive && pDist < 160) {
          eLightingColor = 'rgba(251, 146, 60, 0.2)'; // Torchlight warm orange
          eLightingIntensity = (1 - pDist / 160) * 0.2;
        }

        // 2. Proximity to campfires
        for (const otherO of s.objs) {
          if (otherO.type === 'campfire' || otherO.type === 'camp_fire') {
            const fDist = Math.hypot(e.x - (otherO.tx * TZ + TZ/2), e.y - (otherO.ty * TZ + TZ/2));
            if (fDist < 120) {
              const campIntensity = (1 - fDist / 120) * (0.25 + Math.sin(s.ticks * 0.15) * 0.05);
              if (campIntensity > eLightingIntensity) {
                eLightingColor = 'rgba(249, 115, 22, 0.25)'; // camp fire warm orange
                eLightingIntensity = campIntensity;
              }
            }
          }
        }

        if (eLightingColor && eLightingIntensity > 0) {
          ctx.save();
          ctx.globalCompositeOperation = 'source-atop';
          ctx.fillStyle = eLightingColor.replace(/[\d\.]+\)$/, `${eLightingIntensity})`);
          ctx.beginPath();
          ctx.arc(0, -TZ/6, baseRad, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        ctx.restore();

        // --- GLASSMORPHIC CAPSULE HEALTH BAR ---
        const barWidth = 32;
        const barHeight = 4.5;
        const barY = ey - 27 + bob;
        
        // Translucent background track
        ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.roundRect(ex - barWidth/2, barY, barWidth, barHeight, 2);
        ctx.fill();
        ctx.stroke();

        // Filling health bar with high contrast gradient
        const hpPct = Math.max(0, e.hp / e.mhp);
        if (hpPct > 0) {
          const barGrad = ctx.createLinearGradient(ex - barWidth/2, barY, ex + barWidth/2, barY);
          if (isBoss) {
            barGrad.addColorStop(0, '#f59e0b'); // amber gold for bosses
            barGrad.addColorStop(1, '#ef4444');
          } else {
            barGrad.addColorStop(0, '#ef4444'); // healthy red-to-pink
            barGrad.addColorStop(1, '#f472b6');
          }
          ctx.fillStyle = barGrad;
          ctx.beginPath();
          ctx.roundRect(ex - barWidth/2 + 0.5, barY + 0.5, (barWidth - 1) * hpPct, barHeight - 1, 1.5);
          ctx.fill();

          // Shiny white glaze sheen reflection on top of health bar
          ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
          ctx.fillRect(ex - barWidth/2 + 0.5, barY + 0.5, (barWidth - 1) * hpPct, (barHeight - 1) / 2);
        }

        // Render Active Status Effects above head
        let statusStr = '';
        if (e.isAggro && !isBoss) statusStr += '😡';
        if (e.slowTicks > 0) statusStr += '🧊';
        if (e.burnTicks > 0) statusStr += '🔥';
        if (statusStr) {
          ctx.font = '10px serif';
          ctx.textAlign = 'center';
          ctx.fillText(statusStr, ex, ey - 33 + bob);
        }
      }

      // Companions
      for (const c of s.companions) {
        const cx = c.x - s.cam.x;
        const cy = c.y - s.cam.y;
        if (cx < -TZ || cx > (ctx.canvas.width / zoom) + TZ || cy < -TZ || cy > (ctx.canvas.height / zoom) + TZ) continue;

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

        // --- PREMIUM 3D FRIENDLY TOKEN ---
        ctx.save();
        const bob = Math.sin(s.ticks * 0.12 + (c.id || 0) * 1.5) * 4;
        const squishX = 1 + Math.sin(s.ticks * 0.16 + (c.id || 0)) * 0.06;
        const squishY = 1 - Math.sin(s.ticks * 0.16 + (c.id || 0)) * 0.06;

        // Shadow beneath companion
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        ctx.ellipse(cx, cy + 11, 10 * squishX, 4 * squishY, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.translate(cx, cy + bob);
        ctx.scale(squishX, squishY);

        // Friendly green-teal token plate
        const baseRad = TZ * 0.52;
        ctx.shadowColor = '#00ffaa';
        ctx.shadowBlur = 6;
        
        // Inner base fill
        const radGrad = ctx.createRadialGradient(0, -TZ/6, 0, 0, -TZ/6, baseRad);
        radGrad.addColorStop(0, '#064e3b'); // dark emerald core
        radGrad.addColorStop(1, '#022c22');
        ctx.fillStyle = radGrad;
        ctx.beginPath();
        ctx.arc(0, -TZ/6, baseRad, 0, Math.PI * 2);
        ctx.fill();
        
        // Outlined metallic bezel rim
        ctx.strokeStyle = '#00ffaa';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(0, -TZ/6, baseRad, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0; // reset

        // Bobbing floating emoji companion avatar
        ctx.font = `${TZ - 4}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(c.ico || '🤝', 0, -TZ/6);
        ctx.restore();

        // --- NAME PLATE AND HP BAR ---
        // Name
        ctx.font = '10px sans-serif';
        ctx.fillStyle = '#00ffaa';
        ctx.textAlign = 'center';
        ctx.fillText(c.n, cx, cy - 35 + bob);

        // Glassmorphic health bar
        const barWidth = 30;
        const barHeight = 4.5;
        const barY = cy - 25 + bob;
        
        // Background track
        ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.roundRect(cx - barWidth/2, barY, barWidth, barHeight, 2);
        ctx.fill();
        ctx.stroke();

        // Filling health bar with friendly emerald gradient
        const hpPct = Math.max(0, c.hp / c.mhp);
        if (hpPct > 0) {
          const barGrad = ctx.createLinearGradient(cx - barWidth/2, barY, cx + barWidth/2, barY);
          barGrad.addColorStop(0, '#059669'); // emerald green
          barGrad.addColorStop(1, '#34d399'); // mint green
          ctx.fillStyle = barGrad;
          ctx.beginPath();
          ctx.roundRect(cx - barWidth/2 + 0.5, barY + 0.5, (barWidth - 1) * hpPct, barHeight - 1, 1.5);
          ctx.fill();

          // Reflection sheen
          ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
          ctx.fillRect(cx - barWidth/2 + 0.5, barY + 0.5, (barWidth - 1) * hpPct, (barHeight - 1) / 2);
        }
        ctx.textAlign = 'start';
      }

      // Projectiles
      for (const p of s.projs) {
        if (p.isArrow) {
          ctx.save();
          ctx.translate(p.x - s.cam.x, p.y - s.cam.y);
          ctx.rotate(Math.atan2(p.vy, p.vx));
          
          // Draw a sleek custom arrow trail/shadow
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(-20, 0);
          ctx.lineTo(-6, 0);
          ctx.stroke();

          // Draw the physical wooden/iron arrow shaft
          ctx.strokeStyle = '#d1d5db'; // light steel arrow shaft
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-12, 0);
          ctx.lineTo(6, 0);
          ctx.stroke();

          // Draw arrowhead (steel blue)
          ctx.fillStyle = '#64748b';
          ctx.beginPath();
          ctx.moveTo(6, -3.5);
          ctx.lineTo(13, 0);
          ctx.lineTo(6, 3.5);
          ctx.closePath();
          ctx.fill();

          // Draw fletching (feather in bright glowing orange-red)
          ctx.fillStyle = '#f97316';
          ctx.beginPath();
          ctx.moveTo(-12, 0);
          ctx.lineTo(-16, -3);
          ctx.lineTo(-11, -3);
          ctx.lineTo(-7, 0);
          ctx.lineTo(-11, 3);
          ctx.lineTo(-16, 3);
          ctx.closePath();
          ctx.fill();

          ctx.restore();
        } else {
          ctx.fillStyle = p.col || '#ffaa44';
          ctx.shadowColor = p.col || '#ffaa44';
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(p.x - s.cam.x, p.y - s.cam.y, p.sz || 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0; // Reset
        }
      }

      // Draw Beautiful Visual Particles
      for (const pt of s.parts) {
        const px = pt.x - s.cam.x;
        const py = pt.y - s.cam.y;
        if (px < -40 || px > (ctx.canvas.width / zoom) + 40 || py < -40 || py > (ctx.canvas.height / zoom) + 40) continue;
        
        ctx.save();
        ctx.fillStyle = pt.col || '#fff';
        ctx.globalAlpha = Math.max(0, Math.min(1, pt.life / (pt.maxLife || 30)));
        
        // Apply beautiful glowing additive blending to sparks, rings, fire embers, or magical neon particles
        const isGlowingColor = pt.col && (
          pt.col.includes('rgba') ||
          pt.col === '#38bdf8' || pt.col === '#06b6d4' || pt.col === '#60a5fa' ||
          pt.col === '#fbbf24' || pt.col === '#f97316' || pt.col === '#f43f5e' ||
          pt.col === '#a855f7' || pt.col === '#c084fc' || pt.col === '#10b981' ||
          pt.col === '#ec4899'
        );
        if (pt.type === 'ring' || pt.type === 'spark' || isGlowingColor) {
          ctx.globalCompositeOperation = 'screen';
        }

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

        // Light around campfires, merchants, altars, and caves
        for (const o of s.objs) {
          const ox = o.tx * TZ + TZ/2 - s.cam.x;
          const oy = o.ty * TZ + TZ/2 - s.cam.y;
          if (ox < -TZ || ox > (ctx.canvas.width / zoom) + TZ || oy < -TZ || oy > (ctx.canvas.height / zoom) + TZ) continue;
          
          let sRad = 0;
          if (o.type === 'campfire' || o.type === 'camp_fire') {
            sRad = 150 + Math.sin(s.ticks * 0.15) * 8;
          } else if (o.type === 'town_merchant' || o.type === 'blacksmith_merchant' || o.type === 'alchemist_merchant' || o.type === 'fountain' || o.type === 'resource_trader') {
            sRad = 120 + Math.sin(s.ticks * 0.08) * 4;
          } else if (o.type === 'cave_entrance' || o.type === 'magic_altar') {
            sRad = 160 + Math.sin(s.ticks * 0.1) * 6;
          }
          
          if (sRad > 0) {
            const oGrad = ctx.createRadialGradient(ox, oy, 0, ox, oy, sRad);
            oGrad.addColorStop(0, 'rgba(0,0,0,0.85)');
            oGrad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = oGrad;
            ctx.beginPath();
            ctx.arc(ox, oy, sRad, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.globalCompositeOperation = 'source-over';

        // Draw warm color lighting halos (additive ambient bloom)
        ctx.save();
        for (const o of s.objs) {
          const ox = o.tx * TZ + TZ/2 - s.cam.x;
          const oy = o.ty * TZ + TZ/2 - s.cam.y;
          if (ox < -TZ || ox > (ctx.canvas.width / zoom) + TZ || oy < -TZ || oy > (ctx.canvas.height / zoom) + TZ) continue;
          
          if (o.type === 'campfire' || o.type === 'camp_fire') {
            const size = 30 + Math.sin(s.ticks * 0.15) * 3;
            const halo = ctx.createRadialGradient(ox, oy, 0, ox, oy, size);
            halo.addColorStop(0, 'rgba(249, 115, 22, 0.25)'); // Warm orange
            halo.addColorStop(1, 'rgba(249, 115, 22, 0)');
            ctx.fillStyle = halo;
            ctx.beginPath();
            ctx.arc(ox, oy, size, 0, Math.PI * 2);
            ctx.fill();
          } else if (o.type === 'cave_entrance' || o.type === 'magic_altar') {
            const size = 40 + Math.sin(s.ticks * 0.1) * 4;
            const halo = ctx.createRadialGradient(ox, oy, 0, ox, oy, size);
            halo.addColorStop(0, 'rgba(168, 85, 247, 0.2)'); // Mysterious Purple
            halo.addColorStop(1, 'rgba(168, 85, 247, 0)');
            ctx.fillStyle = halo;
            ctx.beginPath();
            ctx.arc(ox, oy, size, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      }

      // Draw procedural weather/atmospheric particles and active weather overlays
      const mapIdx = Math.floor(s.pl.y / (ZH * TZ)) * ZCOLS + Math.floor(s.pl.x / (ZW * TZ));
      const bName = s.zoneMaps?.[mapIdx]?.n || MAPS[mapIdx]?.n || MAPS[0].n;
      const viewW = ctx.canvas.width / zoom;
      const viewH = ctx.canvas.height / zoom;
      
      const activeWeatherType = s.weather?.type || 'clear';

      // 1. Ambient Biome Base Particles
      if (bName.includes('Frozen') || bName.includes('Tundra')) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        for (let i = 0; i < 20; i++) {
          const px = ((Math.sin(i * 123.45) * 0.5 + 0.5) * viewW) % viewW;
          const py = ((i * 45.67 + s.ticks * 0.8) % viewH);
          ctx.beginPath();
          ctx.arc(px, py, 1.2 + Math.sin(i + s.ticks * 0.04) * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (bName.includes('Desert') || bName.includes('Waste') || bName.includes('Oasis')) {
        ctx.fillStyle = 'rgba(219, 180, 110, 0.2)'; 
        for (let i = 0; i < 15; i++) {
          const px = ((Math.sin(i * 54.32) * 0.5 + 0.5) * viewW - s.ticks * 1) % viewW;
          const py = (i * 98.76) % viewH;
          ctx.fillRect(px < 0 ? px + viewW : px, py, 2, 1.0);
        }
      } else if (bName.includes('Volcanic') || bName.includes('Scorched') || bName.includes('Spire')) {
        ctx.fillStyle = `rgba(239, 68, 68, ${0.35 + Math.sin(s.ticks * 0.08) * 0.15})`; 
        for (let i = 0; i < 15; i++) {
          const px = (Math.sin(i * 87.65) * 0.5 + 0.5) * viewW;
          const py = (viewH - (i * 32.1 + s.ticks * 0.5) % viewH);
          ctx.beginPath();
          ctx.arc(px, py, 1.0 + Math.abs(Math.sin(i + s.ticks * 0.08)) * 1.0, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (bName.includes('Swamp') || bName.includes('Forest') || bName.includes('Grove') || bName.includes('Cavern') || bName.includes('Garden')) {
        ctx.fillStyle = `rgba(132, 204, 22, ${0.4 + Math.sin(s.ticks * 0.05) * 0.2})`; 
        for (let i = 0; i < 12; i++) {
          const px = ((Math.sin(i * 92.11) * 0.5 + 0.5) * viewW + Math.sin(s.ticks * 0.02 + i) * 20) % viewW;
          const py = ((Math.cos(i * 41.22) * 0.5 + 0.5) * viewH + Math.cos(s.ticks * 0.02 + i) * 20) % viewH;
          ctx.beginPath();
          ctx.arc(px < 0 ? px + viewW : px, py < 0 ? py + viewH : py, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (bName.includes('Celestial') || bName.includes('Void') || bName.includes('Ruins') || bName.includes('Archipelago') || bName.includes('Cyber-Grid')) {
        ctx.fillStyle = `rgba(168, 85, 247, ${0.35 + Math.sin(s.ticks * 0.04) * 0.15})`; 
        for (let i = 0; i < 15; i++) {
          const px = ((Math.sin(i * 111.11) * 0.5 + 0.5) * viewW + Math.sin(s.ticks * 0.01 + i) * 10) % viewW;
          const py = ((Math.cos(i * 22.22) * 0.5 + 0.5) * viewH + Math.cos(s.ticks * 0.01 + i) * 10) % viewH;
          ctx.beginPath();
          ctx.arc(px < 0 ? px + viewW : px, py < 0 ? py + viewH : py, 1.0 + Math.abs(Math.sin(i + s.ticks * 0.04)) * 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 2. Active Weather Overlay Drawing
      if (activeWeatherType === 'rain' || activeWeatherType === 'storm') {
        // Draw falling rain lines
        ctx.strokeStyle = activeWeatherType === 'storm' ? 'rgba(125, 211, 252, 0.45)' : 'rgba(186, 230, 253, 0.35)';
        ctx.lineWidth = 1.0;
        const count = activeWeatherType === 'storm' ? 55 : 30;
        ctx.beginPath();
        for (let i = 0; i < count; i++) {
          const rx = ((Math.sin(i * 47.11) * 0.5 + 0.5) * viewW - (s.ticks * 1.5)) % viewW;
          const ry = ((i * 117.8 + s.ticks * 5.0) % viewH);
          const actualRx = rx < 0 ? rx + viewW : rx;
          ctx.moveTo(actualRx, ry);
          ctx.lineTo(actualRx - 6, ry + 18);
        }
        ctx.stroke();

        // Storm lightning flash screen-wide overlay
        if (activeWeatherType === 'storm' && s.lightningFlash && s.lightningFlash > 0) {
          const flashIntensity = (s.lightningFlash / 12) * 0.6;
          ctx.fillStyle = `rgba(224, 242, 254, ${flashIntensity})`;
          ctx.fillRect(0, 0, viewW, viewH);
        }
      } else if (activeWeatherType === 'blizzard') {
        // Heavy, fast drifting snow particles
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        for (let i = 0; i < 60; i++) {
          const sx = ((Math.sin(i * 139.73) * 0.5 + 0.5) * viewW - s.ticks * 5.5) % viewW;
          const sy = ((i * 79.2 + s.ticks * 3.0) % viewH);
          const actualSx = sx < 0 ? sx + viewW : sx;
          ctx.beginPath();
          ctx.arc(actualSx, sy, 1.5 + Math.sin(i + s.ticks * 0.1) * 1.0, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (activeWeatherType === 'sandstorm') {
        // Sweep orange/tan sand dust
        ctx.fillStyle = 'rgba(217, 119, 6, 0.28)';
        for (let i = 0; i < 45; i++) {
          const sx = ((Math.sin(i * 83.21) * 0.5 + 0.5) * viewW - s.ticks * 8.0) % viewW;
          const sy = (i * 133.45) % viewH;
          const actualSx = sx < 0 ? sx + viewW : sx;
          ctx.fillRect(actualSx, sy, 15 + Math.sin(i + s.ticks * 0.05) * 10, 1.5);
        }
        
        // Sandstorm warning orange fog vignetting
        const sandGrad = ctx.createRadialGradient(viewW / 2, viewH / 2, viewW / 3, viewW / 2, viewH / 2, viewW / 1.5);
        sandGrad.addColorStop(0, 'rgba(217, 119, 6, 0)');
        sandGrad.addColorStop(1, 'rgba(217, 119, 6, 0.15)');
        ctx.fillStyle = sandGrad;
        ctx.fillRect(0, 0, viewW, viewH);
      } else if (activeWeatherType === 'acid_rain') {
        // Greenish glowing droplets
        ctx.strokeStyle = 'rgba(163, 230, 53, 0.4)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let i = 0; i < 25; i++) {
          const rx = ((Math.sin(i * 39.42) * 0.5 + 0.5) * viewW - (s.ticks * 0.5)) % viewW;
          const ry = ((i * 143.1 + s.ticks * 3.5) % viewH);
          const actualRx = rx < 0 ? rx + viewW : rx;
          ctx.moveTo(actualRx, ry);
          ctx.lineTo(actualRx - 2, ry + 12);
        }
        ctx.stroke();

        // Bubble rings
        ctx.strokeStyle = 'rgba(163, 230, 53, 0.2)';
        ctx.lineWidth = 1.0;
        for (let i = 0; i < 8; i++) {
          const bx = ((Math.cos(i * 72.1) * 0.5 + 0.5) * viewW + Math.sin(s.ticks * 0.02 + i) * 15) % viewW;
          const by = ((Math.sin(i * 12.5) * 0.5 + 0.5) * viewH + Math.cos(s.ticks * 0.02 + i) * 15) % viewH;
          ctx.beginPath();
          ctx.arc(bx, by, 3 + (s.ticks + i * 20) % 15 * 0.6, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else if (activeWeatherType === 'heatwave') {
        // Reddish/hot screen border vignette
        const heatGrad = ctx.createRadialGradient(viewW / 2, viewH / 2, viewW / 4, viewW / 2, viewH / 2, viewW / 1.2);
        heatGrad.addColorStop(0, 'rgba(239, 68, 68, 0)');
        heatGrad.addColorStop(1, `rgba(239, 68, 68, ${0.12 + Math.sin(s.ticks * 0.06) * 0.04})`);
        ctx.fillStyle = heatGrad;
        ctx.fillRect(0, 0, viewW, viewH);
      } else if (activeWeatherType === 'chrono_mist') {
        // Creeping purple stasis mist waves
        ctx.fillStyle = `rgba(168, 85, 247, ${0.14 + Math.sin(s.ticks * 0.03) * 0.04})`;
        for (let i = 0; i < 25; i++) {
          const mx = ((Math.sin(i * 97.4) * 0.5 + 0.5) * viewW + Math.sin(s.ticks * 0.01 + i) * 30) % viewW;
          const my = ((Math.cos(i * 19.3) * 0.5 + 0.5) * viewH + Math.cos(s.ticks * 0.01 + i) * 30) % viewH;
          const actualMx = mx < 0 ? mx + viewW : mx;
          ctx.beginPath();
          ctx.arc(actualMx, my, 40 + Math.abs(Math.sin(i + s.ticks * 0.02)) * 30, 0, Math.PI * 2);
          ctx.fill();
        }
        
        // Digital grid glitch particles
        ctx.fillStyle = 'rgba(6, 182, 212, 0.4)';
        for (let i = 0; i < 15; i++) {
          const gx = ((Math.cos(i * 243.11) * 0.5 + 0.5) * viewW) % viewW;
          const gy = ((Math.sin(i * 87.12) * 0.5 + 0.5) * viewH - s.ticks * 2.0) % viewH;
          const actualGy = gy < 0 ? gy + viewH : gy;
          ctx.fillRect(gx, actualGy, 4, 4);
        }
      } else if (activeWeatherType === 'aether_gale') {
        // Swooping wind streaks in purple/magenta
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.35)';
        ctx.lineWidth = 1.5;
        const windAng = s.weather?.windAngle || 0;
        const cosW = Math.cos(windAng);
        const sinW = Math.sin(windAng);
        ctx.beginPath();
        for (let i = 0; i < 35; i++) {
          const wx = ((Math.sin(i * 123.4) * 0.5 + 0.5) * viewW + s.ticks * cosW * 8) % viewW;
          const wy = ((Math.cos(i * 78.9) * 0.5 + 0.5) * viewH + s.ticks * sinW * 8) % viewH;
          const actualWx = wx < 0 ? wx + viewW : wx;
          const actualWy = wy < 0 ? wy + viewH : wy;
          ctx.moveTo(actualWx, actualWy);
          ctx.lineTo(actualWx + cosW * 45, actualWy + sinW * 45);
        }
        ctx.stroke();
      } else if (activeWeatherType === 'grav_rift') {
        // Subtle purple vignetting
        const gravGrad = ctx.createRadialGradient(viewW / 2, viewH / 2, viewW / 4, viewW / 2, viewH / 2, viewW / 1.1);
        gravGrad.addColorStop(0, 'rgba(124, 58, 237, 0)');
        gravGrad.addColorStop(1, `rgba(124, 58, 237, ${0.16 + Math.sin(s.ticks * 0.05) * 0.06})`);
        ctx.fillStyle = gravGrad;
        ctx.fillRect(0, 0, viewW, viewH);
        
        // Render physical vortex center
        const well = s.weather?.gravityWell;
        if (well) {
          const wx = well.x - s.cam.x;
          const wy = well.y - s.cam.y;
          
          ctx.save();
          // Outer horizon ring
          ctx.strokeStyle = `rgba(192, 132, 252, ${0.4 + Math.sin(s.ticks * 0.1) * 0.15})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(wx, wy, well.radius, 0, Math.PI * 2);
          ctx.stroke();
          
          // Accretion disk
          const disks = 3;
          for (let d = 0; d < disks; d++) {
            const rot = (s.ticks * 0.03) + (d * Math.PI / disks);
            ctx.strokeStyle = `rgba(139, 92, 246, ${0.35 - d * 0.08})`;
            ctx.lineWidth = 4 - d;
            ctx.beginPath();
            ctx.ellipse(wx, wy, well.damageRadius + d * 18, (well.damageRadius + d * 18) * 0.4, rot, 0, Math.PI * 2);
            ctx.stroke();
          }

          // Singular core
          ctx.fillStyle = '#000000';
          ctx.beginPath();
          ctx.arc(wx, wy, well.damageRadius - 5 + Math.sin(s.ticks * 0.08) * 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#a78bfa';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.restore();
        }
      }

      // 3. Draw Lightning Bolt (rendered in screen space converted coordinates)
      if (s.lightningStrike) {
        const lx = s.lightningStrike.x - s.cam.x;
        const ly = s.lightningStrike.y - s.cam.y;
        
        ctx.save();
        ctx.strokeStyle = '#ffffff';
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 20;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        
        let curX = lx + (Math.random() * 30 - 15);
        let curY = Math.max(0, ly - 350);
        ctx.moveTo(curX, curY);
        
        const segments = 8;
        for (let j = 1; j <= segments; j++) {
          const nextY = Math.max(0, ly - 350) + (350 / segments) * j;
          const nextX = j === segments ? lx : lx + (Math.random() * 50 - 25);
          ctx.lineTo(nextX, nextY);
          curX = nextX;
          curY = nextY;
        }
        ctx.stroke();
        
        // Inner core
        ctx.strokeStyle = '#f0f9ff';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.restore();
      }

      ctx.restore();

      // --- ADVANCED CINEMATIC VIGNETTE OVERLAY ---
      // This applies a modern lens shading vignette to frame the game beautifully and enhance focus on the center
      const vigGrad = ctx.createRadialGradient(
        ctx.canvas.width / 2, ctx.canvas.height / 2, Math.min(ctx.canvas.width, ctx.canvas.height) * 0.45,
        ctx.canvas.width / 2, ctx.canvas.height / 2, Math.max(ctx.canvas.width, ctx.canvas.height) * 0.78
      );
      vigGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vigGrad.addColorStop(1, `rgba(0, 0, 0, ${0.32 + (nightA * 0.25)})`); // Darkens edges extra during nighttime
      ctx.fillStyle = vigGrad;
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

      if (minimapCanvasRef.current && !isMinimapCollapsedRef.current) {
        drawMinimap(s);
      }

      frameId = requestAnimationFrame(loop);
    };


    loop();
    return () => cancelAnimationFrame(frameId);
  }, [gameState]);

  const addLog = (msg: string, col: string = '#a8ff78') => {
    const id = `${Date.now()}-${Math.random()}`;
    setLogs(prev => [{ id, msg, col }, ...prev].slice(0, 5));
  };

  useEffect(() => {
    (window as any).addGameLog = addLog;
    return () => {
      delete (window as any).addGameLog;
    };
  }, [addLog]);

  const handleMinimapClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = minimapCanvasRef.current;
    if (!canvas || !stateRef.current) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const isWorldMode = minimapModeRef.current === 'world';
    const zoom = minimapZoomRef.current;

    const s = stateRef.current;
    const ptx = Math.floor(s.pl.x / TZ);
    const pty = Math.floor(s.pl.y / TZ);

    let tx = 0;
    let ty = 0;

    if (isWorldMode) {
      const pctX = clickX / canvas.width;
      const pctY = clickY / canvas.height;
      tx = Math.max(0, Math.min(WW - 1, Math.floor(pctX * WW)));
      ty = Math.max(0, Math.min(WH - 1, Math.floor(pctY * WH)));
    } else {
      const range = Math.round(18 / zoom);
      const size = range * 2 + 1;
      const tileSize = canvas.width / size;
      const dx = Math.floor(clickX / tileSize) - range;
      const dy = Math.floor(clickY / tileSize) - range;
      tx = Math.max(0, Math.min(WW - 1, ptx + dx));
      ty = Math.max(0, Math.min(WH - 1, pty + dy));
    }

    // Set waypoint
    setMinimapWaypoint({ tx, ty });
    addLog(`📍 Waypoint set at [X: ${tx}, Y: ${ty}]`, '#22d3ee');

    // Smooth auto-travel
    s.pl.targetX = tx * TZ + TZ / 2;
    s.pl.targetY = ty * TZ + TZ / 2;
    addLog(`🏃 Auto-traveling to Waypoint...`, '#34d399');
  }, [addLog]);

  const recruitVillager = (role: string, cost: { [key: string]: number }, name: string, ico: string, spd: number, dmg: number, hp: number) => {
    const s = stateRef.current;
    if (!s) return;
    
    // Check resources
    const hasMats = Object.entries(cost).every(([k, v]) => (s.pl.inv[k] || 0) >= v);
    if (!hasMats) {
      addLog("⚠️ Insufficient resources to recruit this villager!", "#ef4444");
      return;
    }

    // Deduct
    Object.entries(cost).forEach(([k, v]) => {
      s.pl.inv[k] -= v;
    });

    // Spawn companion
    s.companions.push({
      n: name,
      ico: ico,
      hp: hp,
      mhp: hp,
      spd: spd,
      dmg: dmg,
      cd: 0,
      scd: 0,
      target: null,
      x: s.pl.x,
      y: s.pl.y,
      role: role
    });

    addLog(`✨ Recruited ${name}! They have joined your survival party.`, '#10b981');
    spawnExplosion(s, s.pl.x, s.pl.y, '#10b981', 15, 'spell');
    setGameState({ ...s });
  };

  // --- Adventurers Guild & Masteries Expansion Logic ---
  const awardInvItem = (s: any, item: string, qty: number) => {
    let finalQty = qty;
    // Apply Masteries
    if (item === 'wood' || item === 'fiber' || item === 'herb') {
      const lvl = s.pl.masteries?.double_harvest || 0;
      if (lvl > 0 && Math.random() < lvl * 0.10) {
        finalQty *= 2;
        addLog(`✨ Double Harvest Proc! +${IT[item]?.n || item} x${finalQty}`, '#4df8aa');
      }
    } else if (['copper_ore', 'iron_ore', 'gold_ore', 'mithril_ore', 'coal', 'sulfur'].includes(item)) {
      const lvl = s.pl.masteries?.lucky_miner || 0;
      if (lvl > 0 && Math.random() < lvl * 0.10) {
        finalQty *= 2;
        addLog(`✨ Lucky Miner Proc! +${IT[item]?.n || item} x${finalQty}`, '#fbd38d');
      }
    }

    s.pl.inv[item] = (s.pl.inv[item] || 0) + finalQty;

    // Track Quest Objectives
    if (s.pl.activeQuests) {
      Object.keys(s.pl.activeQuests).forEach(qid => {
        const q = GUILD_QUESTS.find(x => x.id === qid);
        if (q && q.targetType === item) {
          s.pl.activeQuestsProgress[qid] = Math.min(q.targetCount, (s.pl.activeQuestsProgress[qid] || 0) + finalQty);
          addLog(`📊 Quest Progress: [${q.n}] (${s.pl.activeQuestsProgress[qid]}/${q.targetCount})`, '#67e8f9');
        }
      });
    }
  };

  const checkPlayerDeath = (s: any): boolean => {
    if (s.pl.hp <= 0) {
      if (s.pl.inv?.phoenix_feather && s.pl.inv.phoenix_feather > 0) {
        s.pl.inv.phoenix_feather--;
        s.pl.hp = Math.floor(s.pl.mhp * 0.5);
        s.pl.sta = 100;
        s.pl.mp = s.pl.mmp;
        addLog(`🔥 PHOENIX FEATHER ACTIVATED! You were saved from death and restored to 50% HP!`, '#ef4444');
        spawnExplosion(s, s.pl.x, s.pl.y, '#f97316', 30, 'fire');
        return false; // Did not die
      }
      return true; // Died
    }
    return false;
  };

  const handleAcceptQuest = (qid: string) => {
    const s = stateRef.current;
    if (!s || !s.pl) return;
    s.pl.activeQuests = s.pl.activeQuests || {};
    s.pl.activeQuestsProgress = s.pl.activeQuestsProgress || {};
    
    // Set active
    s.pl.activeQuests[qid] = true;
    s.pl.activeQuestsProgress[qid] = 0;
    
    // If it's a delivery quest, pre-populate progress with items in inventory
    const q = GUILD_QUESTS.find(x => x.id === qid);
    if (q && !q.isBoss) {
      const currentQty = s.pl.inv[q.targetType] || 0;
      s.pl.activeQuestsProgress[qid] = Math.min(q.targetCount, currentQty);
    }
    
    setGameState({ ...s });
    addLog(`📜 Quest Accepted: "${q?.n}"!`, '#fbbf24');
  };

  const handleAbandonQuest = (qid: string) => {
    const s = stateRef.current;
    if (!s || !s.pl) return;
    if (s.pl.activeQuests) {
      delete s.pl.activeQuests[qid];
    }
    if (s.pl.activeQuestsProgress) {
      delete s.pl.activeQuestsProgress[qid];
    }
    setGameState({ ...s });
    addLog(`❌ Abandoned Quest.`, '#f87171');
  };

  const handleClaimQuest = (qid: string) => {
    const s = stateRef.current;
    if (!s || !s.pl) return;
    const q = GUILD_QUESTS.find(x => x.id === qid);
    if (!q) return;

    // Double check completed
    const progress = s.pl.activeQuestsProgress?.[qid] || 0;
    if (progress < q.targetCount) {
      addLog(`❌ Quest is not complete yet!`, '#f87171');
      return;
    }

    // Deduct items if delivery quest
    if (!q.isBoss) {
      const invCount = s.pl.inv[q.targetType] || 0;
      if (invCount < q.targetCount) {
        addLog(`❌ You do not have enough ${IT[q.targetType]?.n || q.targetType} in your backpack to deliver!`, '#f87171');
        return;
      }
      s.pl.inv[q.targetType] -= q.targetCount;
    }

    // Reward Guild Tokens
    s.pl.guildTokens = (s.pl.guildTokens || 0) + q.rewardTokens;

    // Reward Gold Coins and items
    Object.entries(q.rewardItems).forEach(([itemKey, qty]) => {
      s.pl.inv[itemKey] = (s.pl.inv[itemKey] || 0) + (qty as number);
    });

    // Remove from active
    delete s.pl.activeQuests[qid];
    delete s.pl.activeQuestsProgress[qid];

    setGameState({ ...s });
    addLog(`✨ COMPLETED: "${q.n}"! Gained 🪙${q.rewardTokens} Guild Tokens & items!`, '#10b981');
  };

  const handleUpgradeMastery = (mid: string, cost: number, maxLevel: number) => {
    const s = stateRef.current;
    if (!s || !s.pl) return;
    s.pl.guildTokens = s.pl.guildTokens || 0;
    s.pl.masteries = s.pl.masteries || { adrenaline: 0, double_harvest: 0, lucky_miner: 0, toughened_hide: 0, vampiric_strikes: 0, sages_wisdom: 0 };

    const currentLvl = s.pl.masteries[mid] || 0;
    if (currentLvl >= maxLevel) {
      addLog(`❌ Mastery already at maximum level!`, '#f87171');
      return;
    }

    if (s.pl.guildTokens < cost) {
      addLog(`❌ Not enough Guild Tokens!`, '#f87171');
      return;
    }

    s.pl.guildTokens -= cost;
    s.pl.masteries[mid] = currentLvl + 1;

    // Apply special immediate effects
    if (mid === 'sages_wisdom') {
      s.pl.mmp += 10;
      s.pl.mp += 10;
    }

    setGameState({ ...s });
    addLog(`⚡ Trained Mastery: increased to Level ${currentLvl + 1}!`, '#f59e0b');
  };

  const handleBuyGuildStoreItem = (itemKey: string, cost: number) => {
    const s = stateRef.current;
    if (!s || !s.pl) return;
    s.pl.guildTokens = s.pl.guildTokens || 0;

    if (s.pl.guildTokens < cost) {
      addLog(`❌ Not enough Guild Tokens to buy this item!`, '#f87171');
      return;
    }

    s.pl.guildTokens -= cost;
    s.pl.inv[itemKey] = (s.pl.inv[itemKey] || 0) + 1;

    setGameState({ ...s });
    addLog(`🏪 Bought ${IT[itemKey]?.n || itemKey} from the Guild Store!`, '#10b981');
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
          rewardLogs.push(`+${rew.hpChange} HP 💚`);
        } else {
          s.pl.hp = Math.max(0, s.pl.hp - Math.abs(rew.hpChange));
          rewardLogs.push(`${rew.hpChange} HP 💔`);
          if (s.pl.hp <= 0 && !showDeathScreen) {
            if (checkPlayerDeath(s)) {
              setShowDeathScreen(true);
            }
          }
        }
      }
      if (rew.huChange && rew.huChange !== 0) {
        s.pl.hu = Math.max(0, Math.min(100, (s.pl.hu ?? 100) + rew.huChange));
        if (rew.huChange > 0) {
          rewardLogs.push(`+${rew.huChange} Hunger 🍖`);
        } else {
          rewardLogs.push(`${rew.huChange} Hunger 🍗`);
        }
      }
      if (rew.thChange && rew.thChange !== 0) {
        s.pl.th = Math.max(0, Math.min(100, (s.pl.th ?? 100) + rew.thChange));
        if (rew.thChange > 0) {
          rewardLogs.push(`+${rew.thChange} Thirst 💧`);
        } else {
          rewardLogs.push(`${rew.thChange} Thirst 🥵`);
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

    // Stamina verification has been removed as per instructions
    s.pl.sta = 100;

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
          s.camShake = (s.camShake || 0) + 4;
          spawnExplosion(s, e.x, e.y, '#f53b57', 12, 'pixel'); // Spectacular hit blood splash!
          if (wp.vamp && wp.vamp > 0) {
            const heal = Math.round(finalDmg * wp.vamp);
            if (heal > 0) {
              s.pl.hp = Math.min(s.pl.mhp, s.pl.hp + heal);
              addLog(`🩸 Vampirism: +${heal} HP!`, '#ff3366');
            }
          }
          // Vampiric Strikes Mastery
          const vampLvl = s.pl.masteries?.vampiric_strikes || 0;
          if (vampLvl > 0 && Math.random() < vampLvl * 0.05) {
            s.pl.hp = Math.min(s.pl.mhp, s.pl.hp + 4);
            addLog(`🩸 Vampiric Strikes Mastery Proc: +4 HP!`, '#ef4444');
            spawnExplosion(s, s.pl.x, s.pl.y, '#ef4444', 8, 'spark');
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
      const manaCost = wp.type === 'magic'
        ? Math.max(2, Math.round((wp.mp || 0) * (1 - (alchemyLvl - 1) * 0.03)))
        : 0;
      if (wp.type === 'magic' && s.pl.mp < manaCost) { // Only magic check
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

      let ang = 0;
      let hasAimDir = false;

      if (target) {
        ang = Math.atan2(target.y - s.pl.y, target.x - s.pl.x);
        hasAimDir = true;
      } else {
        // Fallback: check movement key inputs
        let kdx = 0;
        let kdy = 0;
        if (keysRef.current['w'] || keysRef.current['ArrowUp'] || keysRef.current['W']) kdy -= 1;
        if (keysRef.current['s'] || keysRef.current['ArrowDown'] || keysRef.current['S']) kdy += 1;
        if (keysRef.current['a'] || keysRef.current['ArrowLeft'] || keysRef.current['A']) kdx -= 1;
        if (keysRef.current['d'] || keysRef.current['ArrowRight'] || keysRef.current['D']) kdx += 1;

        if (kdx !== 0 || kdy !== 0) {
          ang = Math.atan2(kdy, kdx);
          hasAimDir = true;
        } else {
          // Fallback to active grid target or default to facing right
          const diffX = s.pl.targetX - s.pl.x;
          const diffY = s.pl.targetY - s.pl.y;
          if (Math.hypot(diffX, diffY) > 1) {
            ang = Math.atan2(diffY, diffX);
            hasAimDir = true;
          } else {
            ang = 0; // default to right
            hasAimDir = true;
          }
        }
      }

      if (hasAimDir) {
        // Alchemy can also decrease staff mana cost!
        const alchemyLvl = s.pl.skills?.alchemy?.lvl || 1;
        const combatLvl = s.pl.skills?.combat?.lvl || 1;
        const manaCost = wp.type === 'magic'
          ? Math.max(2, Math.round((wp.mp || 0) * (1 - (alchemyLvl - 1) * 0.03)))
          : 0;
        
        if (wp.type === 'magic' && s.pl.mp < manaCost) {
          addLog("Not enough Mana", "#f44");
          return;
        }
        
        if (manaCost > 0) {
          s.pl.mp -= manaCost;
        }
        
        // Scale damage
        const finalDmg = Math.round(wp.dmg * (1 + (wp.type === 'ranged' ? (combatLvl - 1) * 0.05 : (alchemyLvl - 1) * 0.05)) * eventDmgBoost);
        
        // Give some Alchemy XP if magic is cast
        if (wp.type === 'magic') {
          addSkillXPDirect(s, 'alchemy', 2);
        }
        
        // Faster projectiles for arrows so they feel extremely snappy and satisfying
        const projSpeed = wp.type === 'ranged' ? 14 : 9;
        
        s.projs.push({
          x: s.pl.x, y: s.pl.y,
          vx: Math.cos(ang) * projSpeed, vy: Math.sin(ang) * projSpeed,
          dmg: finalDmg, rng: wp.rng, dist: 0, 
          col: wp.type === 'ranged' ? '#cbd5e1' : (wp.col || '#ffaa44'),
          fx: wp.fx,
          vamp: wp.vamp,
          isArrow: wp.type === 'ranged',
          sz: wp.type === 'ranged' ? 6 : 4
        });
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

    if (it.t === 'food' || it.t === 'pot' || k === 'mana_crystal' || k === 'scroll_meteor' || k === 'philosophers_stone' || k === 'immortality_elixir' || k === 'canteen_full' || k === 'canteen_empty') {
      if (k === 'canteen_full') {
        s.pl.inv[k]--;
        s.pl.inv['canteen_empty'] = (s.pl.inv['canteen_empty'] || 0) + 1;
        s.pl.th = 100;
        addLog(`🥤 Drank from canteen: fully quenched thirst! (+1 Empty Canteen)`, '#38bdf8');
        spawnExplosion(s, s.pl.x, s.pl.y, '#38bdf8', 12, 'spark');
      } else if (k === 'canteen_empty') {
        const px = Math.floor(s.pl.x / TZ);
        const py = Math.floor(s.pl.y / TZ);
        let nearWaterSource = false;
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const tx = px + dx, ty = py + dy;
            if (tx >= 0 && tx < WW && ty >= 0 && ty < WH) {
              const tileType = s.world[ty]?.[tx];
              if (tileType === TW || tileType === TLV) {
                nearWaterSource = true;
              }
            }
          }
        }
        const adjacentStructure = s.objs.some((o: any) => {
          const dx = Math.abs(o.tx - px);
          const dy = Math.abs(o.ty - py);
          return (o.type === 'water_pump' || o.type === 'water_reservoir' || o.type === 'water_pipe') && dx <= 1 && dy <= 1;
        });
        if (nearWaterSource || adjacentStructure) {
          s.pl.inv[k]--;
          s.pl.inv['canteen_full'] = (s.pl.inv['canteen_full'] || 0) + 1;
          addLog(`🥤 Filled empty canteen with clean pure water! (+1 Full Canteen)`, '#38bdf8');
          spawnExplosion(s, s.pl.x, s.pl.y, '#38bdf8', 12, 'spark');
        } else {
          addLog(`⚠️ Stand adjacent to a water source, Water Pump, Reservoir, or Water Pipe to fill!`, '#94a3b8');
        }
      } else if (k === 'mana_crystal') {
        s.pl.mp = Math.min(s.pl.mmp, s.pl.mp + 40);
        s.pl.inv[k]--;
        addLog(`Used Mana Crystal: restored 40 MP 🔮`, '#c084fc');
      } else if (k === 'scroll_meteor') {
        s.pl.inv[k]--;
        addLog(`☄️ You channel the Scroll of Meteor: a shower of celestial fire descends!`, '#ef4444');
        spawnExplosion(s, s.pl.x, s.pl.y, '#f97316', 50, 'fire');
        // Strike all nearby enemies for 250 damage!
        let enemiesDamaged = 0;
        for (let i = s.enemies.length - 1; i >= 0; i--) {
          const e = s.enemies[i];
          if (dist(s.pl, e) < 300) {
            e.hp -= 250;
            e.flashTicks = 15;
            spawnExplosion(s, e.x, e.y, '#f97316', 20, 'pixel');
            enemiesDamaged++;
            if (e.hp <= 0) {
              handleEnemyKilled(s, e);
              s.enemies.splice(i, 1);
            }
          }
        }
        addLog(`☄️ Sited Meteor shower: hit ${enemiesDamaged} enemy/enemies for 250 flat fire damage!`, '#f97316');
      } else if (k === 'philosophers_stone') {
        s.pl.inv[k]--;
        // Transmute common resources in backpack into Gold Coins!
        const woodTransmuted = Math.min(s.pl.inv['wood'] || 0, 10);
        const stoneTransmuted = Math.min(s.pl.inv['stone'] || 0, 10);
        if (woodTransmuted > 0) s.pl.inv['wood'] -= woodTransmuted;
        if (stoneTransmuted > 0) s.pl.inv['stone'] -= stoneTransmuted;
        const goldGain = 120 + (woodTransmuted + stoneTransmuted) * 12;
        s.pl.inv['gold_coins'] = (s.pl.inv['gold_coins'] || 0) + goldGain;
        addSkillXPDirect(s, 'alchemy', 150);
        addLog(`✨ Philosopher's Stone dissolved: Transmuted common elements into +${goldGain} Gold Coins!`, '#fbbf24');
      } else if (k === 'immortality_elixir') {
        s.pl.inv[k]--;
        s.pl.mhp += 20;
        s.pl.hp = s.pl.mhp; // Full heal!
        s.pl.mp = s.pl.mmp; // Full mana!
        addSkillXPDirect(s, 'alchemy', 300);
        addLog(`🌌 Consumed Immortality Elixir: Max HP permanently increased by 20! Stats fully restored!`, '#ec4899');
      } else {
        if (it.t === 'food') {
          // Eating food restores Hunger, and also some Health / Mana depending on item
          const hungerAmount = it.hu || 25;
          const hpAmount = it.hp || 0;
          const mpAmount = it.mp || 0;
          
          // Determine if it also hydrates (thirst)
          let thAmount = 0;
          if (k === 'cactus_fruit') thAmount = 25;
          if (k === 'snowberry') thAmount = 20;
          if (k === 'celestial_fish') thAmount = 100;
          
          s.pl.hu = Math.min(100, (s.pl.hu || 100) + hungerAmount);
          if (thAmount > 0) {
            s.pl.th = Math.min(100, (s.pl.th || 100) + thAmount);
          }
          if (hpAmount > 0) s.pl.hp = Math.min(s.pl.mhp, s.pl.hp + hpAmount);
          if (mpAmount > 0) s.pl.mp = Math.min(s.pl.mmp, s.pl.mp + mpAmount);
          
          s.pl.inv[k]--;
          
          let logMsg = `Ate ${it.n}: +${hungerAmount} Hunger 🍗`;
          if (thAmount > 0) logMsg += `, +${thAmount} Hydration 💧`;
          if (hpAmount > 0) logMsg += `, +${hpAmount} HP 💚`;
          addLog(logMsg, '#00ffaa');
        } else {
          // Potion or other usable consumable
          const hpAmount = it.hp || 0;
          const mpAmount = it.mp || 0;
          
          // Potions are fluid, they hydrate the player!
          let thAmount = 0;
          if (k === 'heal_potion' || k === 'mana_potion') thAmount = 30;
          
          if (hpAmount > 0) s.pl.hp = Math.min(s.pl.mhp, s.pl.hp + hpAmount);
          if (mpAmount > 0) s.pl.mp = Math.min(s.pl.mmp, s.pl.mp + mpAmount);
          if (thAmount > 0) s.pl.th = Math.min(100, (s.pl.th || 100) + thAmount);
          
          s.pl.inv[k]--;
          
          let logMsg = `Used ${it.n}`;
          if (hpAmount > 0) logMsg += `: +${hpAmount} HP 💚`;
          if (mpAmount > 0) logMsg += `: +${mpAmount} MP 🔮`;
          if (thAmount > 0) logMsg += `, +${thAmount} Hydration 💧`;
          addLog(logMsg, '#00ffaa');
        }
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
    } else if (it.t === 'tool' || it.t === 'weapon' || it.id) {
       s.pl.weapon = k;
       addLog(`Selected ${it.n}`, '#ffffaa');
    } else if (it.t === 'struct') {
      const px = Math.floor(s.pl.x / TZ), py = Math.floor(s.pl.y / TZ);
      // Calculate HP with Building skill bonus
      const bldLvl = s.pl.skills?.building?.lvl || 1;
      let baseHp = 8;
      if (k === 'stone_wall') baseHp = 24;
      else if (k === 'watch_tower') baseHp = 60;
      else if (k === 'water_pump') baseHp = 40;
      else if (k === 'water_reservoir') baseHp = 40;
      else if (k === 'water_pipe') baseHp = 15;
      else if (k === 'supply_crate') baseHp = 30;
      else if (k === 'sentry_turret') baseHp = 35;
      else if (k === 'settler_shelter') baseHp = 50;
      else if (k === 'town_house') baseHp = 70;
      else if (k === 'town_workshop') baseHp = 90;
      else if (k === 'storage_depot') baseHp = 100;
      else if (k === 'merchant_stall') baseHp = 60;
      else if (k === 'guard_post') baseHp = 80;
      else if (k === 'farm_plot') baseHp = 30;
      const finalHp = Math.round(baseHp * (1 + 0.25 * (bldLvl - 1)));
      
      // Place structure
      s.objs.push({ type: k, tx: px, ty: py, hp: finalHp, mhp: finalHp, triggered: false });
      s.pl.inv[k]--;
      addLog(`Placed ${it.n} (Durability: ${finalHp}/${finalHp})`, '#ffaa00');
      addSkillXPDirect(s, 'building', 20);
    }
    
    // Refresh React state instantly
    setGameState({ ...s });
  };

  const handleUnequip = (slot: string) => {
    const s = stateRef.current;
    if (!s || !s.pl || !s.pl.equip) return;
    const oldKey = s.pl.equip[slot];
    if (!oldKey) return;

    // Mark as manually unequipped for the auto-equip check
    justManualUnequippedRef.current[oldKey] = true;

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

  const isNearStructure = (type: string) => {
    const s = stateRef.current;
    if (!s) return false;
    const ptx = Math.floor(s.pl.x / TZ);
    const pty = Math.floor(s.pl.y / TZ);
    for (const o of s.objs) {
      if (o.type === type) {
        const dx = o.tx - ptx;
        const dy = o.ty - pty;
        if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
          return true;
        }
      }
    }
    return false;
  };

  const getBiomeAtPlayer = (s: any) => {
    const mapIdx = Math.floor(s.pl.y / (ZH * TZ)) * ZCOLS + Math.floor(s.pl.x / (ZW * TZ));
    const bName = s.zoneMaps?.[mapIdx]?.n || MAPS[mapIdx]?.n || MAPS[0].n;
    return bName;
  };

  const getWeatherForBiome = (bName: string): any => {
    const isCold = bName.includes('Frozen') || bName.includes('Tundra');
    const isDry = bName.includes('Desert') || bName.includes('Scorched') || bName.includes('Spire') || bName.includes('Oasis');
    const isSwampy = bName.includes('Swamp') || bName.includes('Cavern') || bName.includes('Volcanic') || bName.includes('Waste') || bName.includes('Ruins');
    const isRift = bName.includes('Chrono') || bName.includes('Rift') || bName.includes('Aether');

    const rand = Math.random();

    if (isRift) {
      if (rand < 0.35) {
        return {
          type: 'clear',
          label: 'Chrono-Stasis',
          icon: '🌌',
          threat: 'None',
          desc: 'A calm pocket of space-time. Ideal for exploration and gathering.'
        };
      } else if (rand < 0.55) {
        return {
          type: 'chrono_mist',
          label: 'Chrono-Mist',
          icon: '⏳',
          threat: 'Medium',
          desc: 'A misty temporal distortion! Reduces player speed by 20% and reduces enemy vision range by 45%.'
        };
      } else if (rand < 0.80) {
        return {
          type: 'aether_gale',
          label: 'Aether Gale',
          icon: '🌀',
          threat: 'High',
          desc: 'Violent spatial winds! Aligns speed with the wind direction, speeding you up or slowing you down.'
        };
      } else {
        return {
          type: 'grav_rift',
          label: 'Gravitational Storm',
          icon: '🕳️',
          threat: 'Extreme',
          desc: 'Spatial tears create unstable gravity! Periodically drags you and enemies toward a dimensional vortex.'
        };
      }
    } else if (isCold) {
      if (rand < 0.45) {
        return {
          type: 'clear',
          label: 'Crisp Calm',
          icon: '❄️',
          threat: 'None',
          desc: 'Cold but clear air. Easy traveling.'
        };
      } else {
        return {
          type: 'blizzard',
          label: 'Howling Blizzard',
          icon: '🌪️',
          threat: 'Extreme',
          desc: 'Freezing blizzard! Health (-2 HP/sec) and stamina decline rapidly without a Campfire 🔥 or Shelter ⛺.'
        };
      }
    } else if (isDry) {
      if (rand < 0.40) {
        return {
          type: 'clear',
          label: 'Sunny Heat',
          icon: '☀️',
          threat: 'None',
          desc: 'Hot and dry conditions.'
        };
      } else if (rand < 0.70) {
        return {
          type: 'sandstorm',
          label: 'Raging Sandstorm',
          icon: '🌪️',
          threat: 'High',
          desc: 'Blinding dust! Reduces movement speed by 30% and rapidly drains hydration.'
        };
      } else {
        return {
          type: 'heatwave',
          label: 'Scorching Heatwave',
          icon: '🔥',
          threat: 'Medium',
          desc: 'Extreme solar radiation! Rapidly depletes hydration. Stand in water or near a reservoir to stay cool.'
        };
      }
    } else if (isSwampy) {
      if (rand < 0.40) {
        return {
          type: 'clear',
          label: 'Dense Smog',
          icon: '🌫️',
          threat: 'Low',
          desc: 'Heavy, damp, sulfurous air.'
        };
      } else if (rand < 0.70) {
        return {
          type: 'acid_rain',
          label: 'Acid Torrent',
          icon: '☣️',
          threat: 'High',
          desc: 'Corrosive chemical rainfall! Slowly corrodes health (-1 HP/sec) unless fully armored or in a Shelter ⛺.'
        };
      } else {
        return {
          type: 'storm',
          label: 'Toxic Tempest',
          icon: '⛈️',
          threat: 'Medium',
          desc: 'Acidic lightning storm. Standing in open land drains stamina and triggers lightning.'
        };
      }
    } else {
      // Normal / Lush biomes
      if (rand < 0.40) {
        return {
          type: 'clear',
          label: 'Clear Skies',
          icon: '☀️',
          threat: 'None',
          desc: 'Mild conditions. Standard health and stamina regeneration.'
        };
      } else if (rand < 0.75) {
        return {
          type: 'rain',
          label: 'Steady Rain',
          icon: '🌧️',
          threat: 'Low',
          desc: 'Cool rain. Dampens open fires. Naturally replenishes your hydration (+0.1/sec).'
        };
      } else {
        return {
          type: 'storm',
          label: 'Violent Thunderstorm',
          icon: '⛈️',
          threat: 'Medium',
          desc: 'Severe lightning storms. Damps open fires, drains stamina, and strikes nearby tiles.'
        };
      }
    }
  };

  const isWeatherCompatible = (weatherType: string, bName: string) => {
    const isCold = bName.includes('Frozen') || bName.includes('Tundra');
    const isDry = bName.includes('Desert') || bName.includes('Scorched') || bName.includes('Spire') || bName.includes('Oasis');
    const isSwampy = bName.includes('Swamp') || bName.includes('Cavern') || bName.includes('Volcanic') || bName.includes('Waste') || bName.includes('Ruins');
    const isRift = bName.includes('Chrono') || bName.includes('Rift') || bName.includes('Aether');
    
    if (isRift) {
      return ['clear', 'chrono_mist', 'aether_gale', 'grav_rift'].includes(weatherType);
    }
    if (isCold) {
      return ['clear', 'blizzard'].includes(weatherType);
    }
    if (isDry) {
      return ['clear', 'sandstorm', 'heatwave'].includes(weatherType);
    }
    if (isSwampy) {
      return ['clear', 'acid_rain', 'storm'].includes(weatherType);
    }
    return ['clear', 'rain', 'storm'].includes(weatherType);
  };

  const triggerLightningStrike = (s: any) => {
    const ptx = Math.floor(s.pl.x / TZ);
    const pty = Math.floor(s.pl.y / TZ);
    const dx = Math.floor(Math.random() * 11) - 5;
    const dy = Math.floor(Math.random() * 11) - 5;
    const tx = ptx + dx;
    const ty = pty + dy;
    
    if (tx >= 0 && tx < WW && ty >= 0 && ty < WH) {
      const sx = tx * TZ + TZ / 2;
      const sy = ty * TZ + TZ / 2;
      
      s.lightningFlash = 12;
      s.lightningStrike = { x: sx, y: sy, duration: 8 };
      
      spawnExplosion(s, sx, sy, '#38bdf8', 15, 'spark');
      
      const distToPlayer = Math.hypot(s.pl.x - sx, s.pl.y - sy);
      if (distToPlayer < 40) {
        s.pl.hp = Math.max(0, s.pl.hp - 15);
        addLog("⚡ Crack! Lightning struck extremely close and shocked you for 15 damage!", "#ef4444");
        s.camShake = Math.max(s.camShake || 0, 10);
      } else if (distToPlayer < 120) {
        addLog("⚡ BOOM! Thunder rumbles deafeningly nearby!", "#38bdf8");
        s.camShake = Math.max(s.camShake || 0, 6);
      }
      
      for (let i = s.objs.length - 1; i >= 0; i--) {
        const o = s.objs[i];
        if (o.tx === tx && o.ty === ty) {
          if (o.hp !== undefined && o.hp !== 999) {
            o.hp -= 15;
            if (o.hp <= 0) {
              s.objs.splice(i, 1);
              addLog(`⚡ Lightning destroyed a ${IT[o.type]?.n || o.type}!`, "#ef4444");
            }
          }
        }
      }
      
      for (let i = s.enemies.length - 1; i >= 0; i--) {
        const e = s.enemies[i];
        const dist = Math.hypot(e.x - sx, e.y - sy);
        if (dist < 45) {
          e.hp -= 40;
          if (e.hp <= 0) {
            s.enemies.splice(i, 1);
            addLog(`⚡ Lightning vaporized a ${ET[e.eid]?.n || 'hostile'}!`, "#38bdf8");
          }
        }
      }
    }
  };

  const isNearWater = () => {
    const s = stateRef.current;
    if (!s) return false;
    const px = Math.floor(s.pl.x / TZ);
    const py = Math.floor(s.pl.y / TZ);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const tx = px + dx;
        const ty = py + dy;
        if (tx >= 0 && tx < WW && ty >= 0 && ty < WH) {
          const tile = s.world[ty][tx];
          if (tile === TW || tile === TSW) {
            return true;
          }
        }
      }
    }
    return false;
  };

  const handleDrinkWater = () => {
    const s = stateRef.current;
    if (!s) return;
    if (isNearWater()) {
      s.pl.th = Math.min(100, (s.pl.th || 100) + 40);
      addLog("🥛 Quenched your thirst: Drank clean refreshing water from the source! (+40 Hydration)", '#38bdf8');
      spawnExplosion(s, s.pl.x, s.pl.y, '#38bdf8', 12, 'spark');
      setGameState({ ...s });
    } else {
      addLog("⚠️ No water source nearby to drink from!", '#94a3b8');
    }
  };

  const assignToHotbar = (itemKey: string, index: number) => {
    const s = stateRef.current;
    if (!s || !s.pl) return;
    s.pl.hotbar[index] = itemKey;
    setGameState({ ...s });
    addLog(`Assigned ${IT[itemKey]?.n || itemKey} to Hotbar Slot ${index + 1}`, '#10b981');
  };

  const handleHotbarDrop = (e: React.DragEvent, targetIdx: number) => {
    setDraggedOverSlot(null);
    const itemKey = e.dataTransfer.getData("text/plain");
    const sourceHotbarIdxStr = e.dataTransfer.getData("hotbar-index");

    const s = stateRef.current;
    if (!s || !s.pl) return;

    if (itemKey) {
      s.pl.hotbar[targetIdx] = itemKey;
      setGameState({ ...s });
      addLog(`Assigned ${IT[itemKey]?.n || itemKey} to Hotbar Slot ${targetIdx + 1}`, '#10b981');
    } else if (sourceHotbarIdxStr !== "") {
      const srcIdx = parseInt(sourceHotbarIdxStr, 10);
      if (srcIdx >= 0 && srcIdx < s.pl.hotbar.length) {
        const temp = s.pl.hotbar[targetIdx];
        s.pl.hotbar[targetIdx] = s.pl.hotbar[srcIdx];
        s.pl.hotbar[srcIdx] = temp;
        setGameState({ ...s });
        addLog(`Swapped Hotbar Slot ${srcIdx + 1} and Slot ${targetIdx + 1}`, '#10b981');
      }
    }
  };

  const handleHotbarClick = (idx: number) => {
    const s = stateRef.current;
    if (!s || !s.pl) return;

    const item = s.pl.hotbar[idx];
    if (hotSlot === idx) {
      if (item && s.pl.inv[item] > 0) {
        handleUse(item);
      }
    } else {
      setHotSlot(idx);
    }
  };

  const handleHotbarDoubleClick = (idx: number) => {
    const s = stateRef.current;
    if (!s || !s.pl) return;

    const item = s.pl.hotbar[idx];
    if (item && s.pl.inv[item] > 0) {
      handleUse(item);
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
        alchemy: { lvl: 1, xp: 0, xpNext: 100 },
        hunting: { lvl: 1, xp: 0, xpNext: 100 },
        smithing: { lvl: 1, xp: 0, xpNext: 100 },
        farming: { lvl: 1, xp: 0, xpNext: 100 },
        building: { lvl: 1, xp: 0, xpNext: 100 }
      };
    }
    if (!s.pl.skills[skill]) {
      s.pl.skills[skill] = { lvl: 1, xp: 0, xpNext: 100 };
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

    // Track monster slaying quest progress
    if (s.pl.activeQuests) {
      s.pl.activeQuestsProgress = s.pl.activeQuestsProgress || {};
      Object.keys(s.pl.activeQuests).forEach(qid => {
        const q = GUILD_QUESTS.find(x => x.id === qid);
        if (q && q.targetType === e.eid) {
          s.pl.activeQuestsProgress[qid] = Math.min(q.targetCount, (s.pl.activeQuestsProgress[qid] || 0) + 1);
          addLog(`📊 Quest Progress: [${q.n}] (${s.pl.activeQuestsProgress[qid]}/${q.targetCount})`, '#67e8f9');
        }
      });
    }

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

      // Defeated enemies also drop Gold Coins!
      const goldCoinsQty = Math.max(1, Math.round(et.xp * (0.8 + Math.random() * 0.6)));
      if (etx >= 0 && etx < WW && ety >= 0 && ety < WH) {
        s.objs.push({
          type: 'drop',
          tx: etx,
          ty: ety,
          item: 'gold_coins',
          qty: goldCoinsQty
        });
      }

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

  const executeInteractAtTile = (tx: number, ty: number) => {
    const s = stateRef.current;
    if (!s) return;

    // Bounds check
    if (tx < 0 || tx >= WW || ty < 0 || ty >= WH) return;

    // Stamina check (harvesting requires stamina and consumes a bit)
    if ((s.pl.sta || 100) < 5) {
      addLog("Too exhausted to harvest! Rest a bit.", "#ff8888");
      return;
    }

    // Spend stamina
    s.pl.sta = Math.max(0, (s.pl.sta || 100) - 4);

    // Check if clicking on an object in s.objs
    let objGathered = false;
    for (let i = s.objs.length - 1; i >= 0; i--) {
      const o = s.objs[i];
      if (o.tx === tx && o.ty === ty) {
        // Found an object on the clicked tile!
        objGathered = true;

        if (o.type === 'tree') {
          // Calculate weapon damage bonus for chopping wood
          let dmg = 1;
          const w = s.pl.weapon;
          if (w) {
            if (w === 'stone_axe') dmg = 2;
            else if (w === 'copper_axe') dmg = 3;
            else if (w === 'iron_axe') dmg = 4;
            else if (w === 'gold_axe') dmg = 5;
            else if (w === 'mithril_axe') dmg = 6;
            else if (w.includes('axe')) dmg = 3; // fallback
          }
          
          o.hp -= dmg;
          gainSkillXP('woodcutting', 3);
          spawnExplosion(s, tx * TZ + TZ / 2, ty * TZ + TZ / 2, '#4ade80', 5, 'spark');

          if (o.hp <= 0) {
            s.objs.splice(i, 1);
            const wcLvl = s.pl.skills?.woodcutting?.lvl || 1;
            const baseLogs = 2 + Math.floor(Math.random() * 2);
            const bonusLogs = Math.floor(Math.random() * (wcLvl * 0.5));
            const q = baseLogs + bonusLogs;
            awardInvItem(s, 'wood', q);

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
            } else if (o.subtype === 'maple') {
              if (Math.random() < 0.60) {
                s.pl.inv.maple_syrup = (s.pl.inv.maple_syrup || 0) + 1;
                addLog(`+Maple Syrup x1! 🍁`, '#fb923c');
              }
            } else if (o.subtype === 'apple') {
              if (Math.random() < 0.60) {
                const qty = 1 + Math.floor(Math.random() * 2);
                s.pl.inv.apple = (s.pl.inv.apple || 0) + qty;
                addLog(`+Apple x${qty}! 🍎`, '#ef4444');
              }
            } else if (o.subtype === 'redwood') {
              const extraWood = 5 + Math.floor(Math.random() * 5);
              s.pl.inv.wood = (s.pl.inv.wood || 0) + extraWood;
              addLog(`+Giant Redwood Lumber x${extraWood}! 🪵`, '#fb923c');
              if (Math.random() < 0.40) {
                s.pl.inv.amber = (s.pl.inv.amber || 0) + 1;
                addLog(`+Amber Clump x1! 🟡`, '#eab308');
              }
            } else if (o.subtype === 'glowshroom') {
              if (Math.random() < 0.50) {
                const qty = 1 + Math.floor(Math.random() * 2);
                s.pl.inv.glowing_spore = (s.pl.inv.glowing_spore || 0) + qty;
                addLog(`+Glowing Spore x${qty}! 🍄`, '#a855f7');
              }
            } else if (o.subtype === 'shadowwood') {
              if (Math.random() < 0.50) {
                s.pl.inv.shadow_bark = (s.pl.inv.shadow_bark || 0) + 1;
                addLog(`+Shadow Bark x1! 🎋`, '#c084fc');
              }
              if (Math.random() < 0.30) {
                s.pl.inv.void_crystal = (s.pl.inv.void_crystal || 0) + 1;
                addLog(`+Void Crystal x1! 🔮`, '#a855f7');
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
            spawnExplosion(s, tx * TZ + TZ / 2, ty * TZ + TZ / 2, '#22c55e', 12, 'spark');
          } else {
            addLog(`Chopping ${o.subtype || 'tree'}... ${o.hp} left`, '#ffe88a');
          }
        } else if (o.type === 'rock') {
          // Calculate weapon damage bonus for mining rocks
          let dmg = 1;
          const w = s.pl.weapon;
          if (w) {
            if (w === 'stone_pickaxe') dmg = 2;
            else if (w === 'copper_pickaxe') dmg = 3;
            else if (w === 'iron_pickaxe') dmg = 4;
            else if (w === 'gold_pickaxe') dmg = 5;
            else if (w === 'mithril_pickaxe') dmg = 6;
            else if (w === 'aether_pickaxe') dmg = 8;
            else if (w.includes('pickaxe')) dmg = 3; // fallback
          }

          o.hp -= dmg;
          gainSkillXP('mining', 3);
          spawnExplosion(s, tx * TZ + TZ / 2, ty * TZ + TZ / 2, '#9ca3af', 5, 'spark');

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
              awardInvItem(s, 'copper_ore', qty);
            } else if (o.subtype === 'iron') {
              const qty = 1 + Math.floor(Math.random() * 2) + Math.floor(mineLvl * 0.3);
              awardInvItem(s, 'iron_ore', qty);
            } else if (o.subtype === 'coal') {
              const qty = 1 + Math.floor(Math.random() * 2) + Math.floor(mineLvl * 0.3);
              awardInvItem(s, 'coal', qty);
            } else if (o.subtype === 'gold') {
              const qty = 1 + Math.floor(Math.random() * 2) + Math.floor(mineLvl * 0.2);
              awardInvItem(s, 'gold_ore', qty);
            } else if (o.subtype === 'mithril') {
              const qty = 1 + Math.floor(Math.random() * 1) + Math.floor(mineLvl * 0.15);
              awardInvItem(s, 'mithril_ore', qty);
            } else if (o.subtype === 'sulfur') {
              const qty = 1 + Math.floor(Math.random() * 2) + Math.floor(mineLvl * 0.2);
              awardInvItem(s, 'sulfur', qty);
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
            spawnExplosion(s, tx * TZ + TZ / 2, ty * TZ + TZ / 2, '#ffd700', 12, 'spark');
          } else {
            addLog(`Mining ${o.subtype || 'rock'}... ${o.hp} left`, '#ffe88a');
          }
        } else if (o.type === 'animal_track') {
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
          spawnExplosion(s, tx * TZ + TZ / 2, ty * TZ + TZ / 2, '#f472b6', 10, 'spark');
        } else if (o.type === 'drop') {
          s.pl.inv[o.item] = (s.pl.inv[o.item] || 0) + o.qty;
          addLog(`+${IT[o.item]?.n || o.item} x${o.qty}`, '#ccffaa');
          const farmItems = ['herb', 'berry', 'mushroom', 'cactus_fruit', 'snowberry', 'astral_flower', 'fiber'];
          if (farmItems.includes(o.item)) {
            addSkillXPDirect(s, 'farming', 10 * o.qty);
          }
          s.objs.splice(i, 1);
          spawnExplosion(s, tx * TZ + TZ / 2, ty * TZ + TZ / 2, '#ccffaa', 8, 'spark');
        } else if (o.type === 'supply_crate') {
          setActiveCrateIndex(i);
          if (!o.items) o.items = {};
          addLog("📦 Opened Supply Crate. Click items in backpack or crate to transfer!", "#fb923c");
          spawnExplosion(s, tx * TZ + TZ / 2, ty * TZ + TZ / 2, '#fb923c', 8, 'spark');
        } else if (o.type === 'water_pump') {
          s.pl.th = 100;
          let refilledCount = 0;
          const canteenQty = s.pl.inv['canteen_empty'] || 0;
          if (canteenQty > 0) {
            s.pl.inv['canteen_empty'] = 0;
            s.pl.inv['canteen_full'] = (s.pl.inv['canteen_full'] || 0) + canteenQty;
            refilledCount = canteenQty;
          }
          addLog(`⛲ Activated Water Pump! Quenched thirst completely and refilled ${refilledCount} canteens!`, '#38bdf8');
          spawnExplosion(s, tx * TZ + TZ / 2, ty * TZ + TZ / 2, '#38bdf8', 12, 'spark');
        } else if (o.type === 'water_reservoir') {
          s.pl.th = 100;
          let refilledCount = 0;
          const canteenQty = s.pl.inv['canteen_empty'] || 0;
          if (canteenQty > 0) {
            s.pl.inv['canteen_empty'] = 0;
            s.pl.inv['canteen_full'] = (s.pl.inv['canteen_full'] || 0) + canteenQty;
            refilledCount = canteenQty;
          }
          addLog(`🛢️ Accessed Water Reservoir! Quenched thirst completely and refilled ${refilledCount} canteens!`, '#38bdf8');
          spawnExplosion(s, tx * TZ + TZ / 2, ty * TZ + TZ / 2, '#38bdf8', 12, 'spark');
        } else if (o.type === 'water_pipe') {
          s.pl.th = 100;
          addLog(`🚰 Drank from Water Pipe: Quenched thirst completely!`, '#38bdf8');
          spawnExplosion(s, tx * TZ + TZ / 2, ty * TZ + TZ / 2, '#38bdf8', 8, 'spark');
        } else if (o.type === 'cave_treasure') {
          s.objs.splice(i, 1);
          const goldBonus = 150 + Math.floor(Math.random() * 250);
          s.pl.inv.gold_coins = (s.pl.inv.gold_coins || 0) + goldBonus;
          s.pl.inv.void_crystal = (s.pl.inv.void_crystal || 0) + 3;
          s.pl.inv.mana_crystal = (s.pl.inv.mana_crystal || 0) + 3;
          s.pl.inv.celestial_shard = (s.pl.inv.celestial_shard || 0) + 1;
          addLog(`👑 Opened Cave Treasure! +🪙${goldBonus} Gold, +3 Void Crystal, +3 Mana Crystal, +1 Celestial Shard!`, '#a855f7');
          spawnExplosion(s, tx * TZ + TZ / 2, ty * TZ + TZ / 2, '#ec4899', 15, 'spark');
        } else if (o.type === 'cave_entrance') {
          enterCave(s, 'forgotten_cave');
        } else if (o.type === 'cave_exit') {
          exitCave(s);
        }
        break; // Process one object click per pointer down
      }
    }

    // If no object was clicked, harvest the raw tile directly from the terrain!
    if (!objGathered) {
      const tileType = s.world[ty]?.[tx];
      let collectedName = "";
      let collectedKey = "";
      let colVal = "#ffffff";
      let xpCategory = "";

      if ((tileType === TW || tileType === TLV) && (s.pl.weapon === 'fishing_rod' || (s.pl.inv && s.pl.inv.fishing_rod > 0))) {
        if (s.pl.weapon !== 'fishing_rod' && s.pl.inv.fishing_rod > 0) {
          s.pl.weapon = 'fishing_rod';
        }
        handleStartFishing();
        return;
      }

      if (tileType === TG || tileType === TD) {
        // Grass / Soil: Harvest wood (stick) or fiber or herb
        const r = Math.random();
        if (r < 0.45) {
          collectedKey = "fiber";
          collectedName = "Fiber";
          colVal = "#a3e635";
          xpCategory = "farming";
        } else if (r < 0.8) {
          collectedKey = "stick";
          collectedName = "Stick";
          colVal = "#b45309";
          xpCategory = "woodcutting";
        } else {
          collectedKey = "herb";
          collectedName = "Herb";
          colVal = "#22c55e";
          xpCategory = "farming";
        }
      } else if (tileType === TS || tileType === TSN) {
        // Stone / Snow: Harvest stone or flint
        const r = Math.random();
        if (r < 0.6) {
          collectedKey = "stone";
          collectedName = "Stone";
          colVal = "#9ca3af";
        } else if (r < 0.9) {
          collectedKey = "flint";
          collectedName = "Flint";
          colVal = "#6b7280";
        } else {
          collectedKey = "coal";
          collectedName = "Coal";
          colVal = "#4b5563";
        }
        xpCategory = "mining";
      } else if (tileType === TSA) {
        // Sand: Harvest flint or sand/crystal
        const r = Math.random();
        if (r < 0.65) {
          collectedKey = "flint";
          collectedName = "Flint";
          colVal = "#d97706";
        } else {
          collectedKey = "crystal";
          collectedName = "Crystal";
          colVal = "#38bdf8";
        }
        xpCategory = "mining";
      } else if (tileType === TW) {
        // Water: Gather water or clay
        const r = Math.random();
        if (r < 0.7) {
          collectedKey = "herb";
          collectedName = "River Herb";
          colVal = "#2dd4bf";
        } else {
          collectedKey = "mana_crystal";
          collectedName = "River Crystal";
          colVal = "#818cf8";
        }
        xpCategory = "alchemy";
      } else if (tileType === TCR) {
        // Celestial Realm: Harvest mana_crystal or void_crystal or magic_essence
        const r = Math.random();
        if (r < 0.5) {
          collectedKey = "magic_essence";
          collectedName = "Magic Essence";
          colVal = "#c084fc";
        } else if (r < 0.8) {
          collectedKey = "mana_crystal";
          collectedName = "Mana Crystal";
          colVal = "#a78bfa";
        } else {
          collectedKey = "void_crystal";
          collectedName = "Void Crystal";
          colVal = "#e879f9";
        }
        xpCategory = "alchemy";
      }

      if (collectedKey) {
        const qty = 1;
        s.pl.inv[collectedKey] = (s.pl.inv[collectedKey] || 0) + qty;
        addLog(`+${collectedName} x${qty} (Gathered from ground)`, colVal);
        
        if (xpCategory) {
          gainSkillXP(xpCategory, 2);
        }
        
        spawnExplosion(s, tx * TZ + TZ / 2, ty * TZ + TZ / 2, colVal, 6, 'spark');
      }
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // 1. Don't gather if a menu/modal is open
    if (showTownHub || showCharCustomizer || showSkills || showQuests || showMasteries || showCraft || showRecipeBook || showOracle || showSaveMenu || showWorldMenu || showSpellbook || showNFTMarket || showShop || showDeathScreen || showInv || showMusicMenu || isFishing || activeNPC) {
      return;
    }

    const s = stateRef.current;
    if (!s || !canvasRef.current) return;

    // Convert mouse coordinates to world tile
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) / gameZoom;
    const mouseY = (e.clientY - rect.top) / gameZoom;
    const tx = Math.floor((mouseX + s.cam.x) / TZ);
    const ty = Math.floor((mouseY + s.cam.y) / TZ);

    // Bounds check
    if (tx < 0 || tx >= WW || ty < 0 || ty >= WH) return;

    const px = Math.floor(s.pl.x / TZ);
    const py = Math.floor(s.pl.y / TZ);
    const distTiles = Math.abs(tx - px) + Math.abs(ty - py);

    // Check if there is an enemy under the click/tap!
    let clickedEnemy = null;
    const clickWorldX = mouseX + s.cam.x;
    const clickWorldY = mouseY + s.cam.y;
    for (const enemy of s.enemies) {
      const d = Math.hypot(enemy.x - clickWorldX, enemy.y - clickWorldY);
      if (d < TZ * 1.3) {
        clickedEnemy = enemy;
        break;
      }
    }

    if (clickedEnemy) {
      const wp = getWeaponStats(s, s.pl.weapon);
      const pxDist = dist(s.pl, clickedEnemy);
      if (pxDist <= wp.rng) {
        // Attack immediately!
        s.pl.touchTarget = null;
        handleAttack();
      } else {
        // Set target to walk and attack!
        s.pl.touchTarget = {
          tx: Math.floor(clickedEnemy.x / TZ),
          ty: Math.floor(clickedEnemy.y / TZ),
          action: { type: 'attack', targetId: clickedEnemy.id }
        };
        addLog(`🎯 Targeting ${ET[clickedEnemy.eid]?.n || 'enemy'}... Moving into attack range!`, '#ef4444');
      }
      setGameState({ ...s });
      return;
    }

    // Check distance for immediate gathering vs auto-walk pathing
    if (distTiles <= 4) {
      s.pl.touchTarget = null;
      executeInteractAtTile(tx, ty);
    } else {
      // Set path target to walk and harvest
      s.pl.touchTarget = {
        tx,
        ty,
        action: { type: 'gather_or_interact', tx, ty }
      };
      addLog(`🚶 Moving towards target tile...`, '#38bdf8');
    }

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
          let dmg = 1;
          const w = s.pl.weapon;
          if (w) {
            if (w === 'stone_axe') dmg = 2;
            else if (w === 'copper_axe') dmg = 3;
            else if (w === 'iron_axe') dmg = 4;
            else if (w === 'gold_axe') dmg = 5;
            else if (w === 'mithril_axe') dmg = 6;
            else if (w.includes('axe')) dmg = 3;
          }
          o.hp -= dmg;
          gainSkillXP('woodcutting', 3);
          if (o.hp <= 0) {
            s.objs.splice(i, 1);
            const wcLvl = s.pl.skills?.woodcutting?.lvl || 1;
            const baseLogs = 2 + Math.floor(Math.random() * 2);
            const bonusLogs = Math.floor(Math.random() * (wcLvl * 0.5));
            const q = baseLogs + bonusLogs;
            awardInvItem(s, 'wood', q);

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
            } else if (o.subtype === 'maple') {
              if (Math.random() < 0.60) {
                s.pl.inv.maple_syrup = (s.pl.inv.maple_syrup || 0) + 1;
                addLog(`+Maple Syrup x1! 🍁`, '#fb923c');
              }
            } else if (o.subtype === 'apple') {
              if (Math.random() < 0.60) {
                const qty = 1 + Math.floor(Math.random() * 2);
                s.pl.inv.apple = (s.pl.inv.apple || 0) + qty;
                addLog(`+Apple x${qty}! 🍎`, '#ef4444');
              }
            } else if (o.subtype === 'redwood') {
              const extraWood = 5 + Math.floor(Math.random() * 5);
              s.pl.inv.wood = (s.pl.inv.wood || 0) + extraWood;
              addLog(`+Giant Redwood Lumber x${extraWood}! 🪵`, '#fb923c');
              if (Math.random() < 0.40) {
                s.pl.inv.amber = (s.pl.inv.amber || 0) + 1;
                addLog(`+Amber Clump x1! 🟡`, '#eab308');
              }
            } else if (o.subtype === 'glowshroom') {
              if (Math.random() < 0.50) {
                const qty = 1 + Math.floor(Math.random() * 2);
                s.pl.inv.glowing_spore = (s.pl.inv.glowing_spore || 0) + qty;
                addLog(`+Glowing Spore x${qty}! 🍄`, '#a855f7');
              }
            } else if (o.subtype === 'shadowwood') {
              if (Math.random() < 0.50) {
                s.pl.inv.shadow_bark = (s.pl.inv.shadow_bark || 0) + 1;
                addLog(`+Shadow Bark x1! 🎋`, '#c084fc');
              }
              if (Math.random() < 0.30) {
                s.pl.inv.void_crystal = (s.pl.inv.void_crystal || 0) + 1;
                addLog(`+Void Crystal x1! 🔮`, '#a855f7');
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
          let dmg = 1;
          const w = s.pl.weapon;
          if (w) {
            if (w === 'stone_pickaxe') dmg = 2;
            else if (w === 'copper_pickaxe') dmg = 3;
            else if (w === 'iron_pickaxe') dmg = 4;
            else if (w === 'gold_pickaxe') dmg = 5;
            else if (w === 'mithril_pickaxe') dmg = 6;
            else if (w === 'aether_pickaxe') dmg = 8;
            else if (w.includes('pickaxe')) dmg = 3;
          }
          o.hp -= dmg;
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
              awardInvItem(s, 'copper_ore', qty);
            } else if (o.subtype === 'iron') {
              const qty = 1 + Math.floor(Math.random() * 2) + Math.floor(mineLvl * 0.3);
              awardInvItem(s, 'iron_ore', qty);
            } else if (o.subtype === 'coal') {
              const qty = 1 + Math.floor(Math.random() * 2) + Math.floor(mineLvl * 0.3);
              awardInvItem(s, 'coal', qty);
            } else if (o.subtype === 'gold') {
              const qty = 1 + Math.floor(Math.random() * 2) + Math.floor(mineLvl * 0.2);
              awardInvItem(s, 'gold_ore', qty);
            } else if (o.subtype === 'mithril') {
              const qty = 1 + Math.floor(Math.random() * 1) + Math.floor(mineLvl * 0.15);
              awardInvItem(s, 'mithril_ore', qty);
            } else if (o.subtype === 'sulfur') {
              const qty = 1 + Math.floor(Math.random() * 2) + Math.floor(mineLvl * 0.2);
              awardInvItem(s, 'sulfur', qty);
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
        if (o.type === 'lore_node') {
          s.objs.splice(i, 1);
          const entry = LORE_ENTRIES.find(le => le.id === o.loreId);
          if (entry) {
            setActiveLore(entry);
            addLog(`📜 Uncovered ancient relic: "${entry.title}"!`, '#a855f7');
            
            if (entry.xpBonus) {
              s.pl.xp += entry.xpBonus;
              addLog(`+${entry.xpBonus} Player XP`, '#ffd700');
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
            if (entry.xpSkill && entry.xpBonus) {
              addSkillXPDirect(s, entry.xpSkill, entry.xpBonus);
            }
            if (entry.rewardItem && entry.rewardQty) {
              s.pl.inv[entry.rewardItem] = (s.pl.inv[entry.rewardItem] || 0) + entry.rewardQty;
              addLog(`🎁 Discovered reward: +${IT[entry.rewardItem]?.n || entry.rewardItem} x${entry.rewardQty}!`, '#22c55e');
            }

            // Unlock a recipe from lore discovery
            const currentRecipes = recipesRef.current.length > 0 ? recipesRef.current : recipes;
            const lockedRecipes = currentRecipes.filter((r: any) => !r.discovered);
            if (lockedRecipes.length > 0) {
              const randomRecipe = lockedRecipes[Math.floor(Math.random() * lockedRecipes.length)];
              randomRecipe.discovered = true;
              setRecipes([...currentRecipes]);
              addLog(`📖 LORE DECODED: Revealed "${randomRecipe.n}" crafting recipe!`, '#c084fc');
            }

            // Beautiful magical particle burst
            spawnExplosion(s, o.tx * TZ + TZ / 2, o.ty * TZ + TZ / 2, '#a855f7', 25, 'spell');
          }
          setGameState({ ...s });
          return;
        }
        if (o.type === 'town_merchant' || o.type === 'blacksmith_merchant' || o.type === 'alchemist_merchant') {
          const typeMap: Record<string, 'general' | 'blacksmith' | 'alchemist'> = {
            town_merchant: 'general',
            blacksmith_merchant: 'blacksmith',
            alchemist_merchant: 'alchemist'
          };
          setTownShopType(typeMap[o.type]);
          setShowTownShop(true);
          addLog(`🧔 Conversing with the local merchant...`, '#38bdf8');
          return;
        }
        if (o.type === 'lost_explorer' || o.type === 'elven_druid' || o.type === 'tame_dog' || o.type === 'tavern_bard' || o.type === 'resource_trader') {
          setActiveNPC(o);
          addLog(`💬 Conversing with the ${o.type.replace('_', ' ')}...`, '#38bdf8');
          return;
        }
        if (o.type === 'bandit_chest') {
          // Verify if bandits are still alive in this zone to protect it
          const zc = Math.floor(s.pl.x / (ZW * TZ));
          const zr = Math.floor(s.pl.y / (ZH * TZ));
          const activeGuard = s.enemies.some((e: any) => e.spawnZc === zc && e.spawnZr === zr && !e.dead);
          if (activeGuard) {
            addLog(`❌ The Bandit Chest is locked! You must defeat the guarding bandits first!`, '#ef4444');
            return;
          }
          
          s.objs.splice(i, 1);
          const goldBonus = 150 + Math.floor(Math.random() * 200);
          s.pl.inv.gold_coins = (s.pl.inv.gold_coins || 0) + goldBonus;
          s.pl.inv.iron_ore = (s.pl.inv.iron_ore || 0) + 5;
          s.pl.inv.crystal = (s.pl.inv.crystal || 0) + 2;
          s.pl.inv.gem = (s.pl.inv.gem || 0) + 1;
          
          addLog(`📦 Unlocked Bandit Chest! +🪙${goldBonus} Gold Coins, +5 Iron Ore, +2 Crystal, +1 Gem!`, '#eab308');
          spawnExplosion(s, o.tx * TZ + TZ / 2, o.ty * TZ + TZ / 2, '#eab308', 20, 'spark');
          setGameState({ ...s });
          return;
        }
        if (o.type === 'cave_treasure') {
          s.objs.splice(i, 1);
          const goldBonus = 200 + Math.floor(Math.random() * 300);
          s.pl.inv.gold_coins = (s.pl.inv.gold_coins || 0) + goldBonus;
          s.pl.inv.void_crystal = (s.pl.inv.void_crystal || 0) + 3;
          s.pl.inv.mana_crystal = (s.pl.inv.mana_crystal || 0) + 3;
          s.pl.inv.celestial_shard = (s.pl.inv.celestial_shard || 0) + 1;
          
          addLog(`👑 Opened Cave Treasure! +🪙${goldBonus} Gold, +3 Void Crystal, +3 Mana Crystal, +1 Celestial Shard!`, '#a855f7');
          spawnExplosion(s, o.tx * TZ + TZ / 2, o.ty * TZ + TZ / 2, '#c084fc', 25, 'spell');
          setGameState({ ...s });
          return;
        }
        if (o.type === 'cave_entrance') {
          enterCave(s, 'forgotten_cave');
          return;
        }
        if (o.type === 'cave_exit') {
          exitCave(s);
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

  const getFilteredNFTs = () => {
    const searchId = parseInt(nftSearchToken.trim(), 10);
    if (!isNaN(searchId) && searchId >= 1 && searchId <= 10000) {
      return [getNFTItem(searchId)];
    }

    const items: any[] = [];
    const itemsPerPage = 12;
    const startIndex = nftPage * itemsPerPage;
    
    let matchedInPrePages = 0;
    let count = 0;
    
    for (let id = 1; id <= 10000; id++) {
      const item = getNFTItem(id);
      const matchRarity = nftRarityFilter === 'All' || item.rarity === nftRarityFilter;
      const matchType = nftTypeFilter === 'All' || item.t === nftTypeFilter.toLowerCase();
      
      if (matchRarity && matchType) {
        if (matchedInPrePages < startIndex) {
          matchedInPrePages++;
        } else {
          items.push(item);
          count++;
          if (count >= itemsPerPage) {
            break;
          }
        }
      }
    }
    return items;
  };

  const handleBuyNFT = (tokenId: number) => {
    const s = stateRef.current;
    if (!s) return;
    const nft = getNFTItem(tokenId);
    const cost = nft.price;
    const currentCoins = s.pl.inv.gold_coins || 0;
    if (currentCoins < cost) {
      addLog(`Insufficient Gold Coins! Need 🪙${cost}`, '#ef4444');
      return;
    }
    
    // Deduct cost and add NFT to inventory
    s.pl.inv.gold_coins = currentCoins - cost;
    const nftKey = `nft_${tokenId}`;
    s.pl.inv[nftKey] = (s.pl.inv[nftKey] || 0) + 1;
    
    addLog(`Successfully purchased ${nft.n} for 🪙${cost}! 🎉`, '#3b82f6');
    setGameState({ ...s });
  };

  const handleAwardNFTs = (nftIds: number[], goldCost: number = 0) => {
    const s = stateRef.current;
    if (!s) return;
    
    if (goldCost !== 0) {
      const currentCoins = s.pl.inv.gold_coins || 0;
      s.pl.inv.gold_coins = Math.max(0, currentCoins - goldCost);
    }
    
    if (nftIds.length > 5) {
      nftIds.forEach((tokenId) => {
        const nftKey = `nft_${tokenId}`;
        s.pl.inv[nftKey] = (s.pl.inv[nftKey] || 0) + 1;
      });
      addLog(`⭐ Unwrapped ${nftIds.length} Premium NFTs from Bundle! 🎉`, '#f59e0b');
    } else {
      nftIds.forEach((tokenId) => {
        const nftKey = `nft_${tokenId}`;
        s.pl.inv[nftKey] = (s.pl.inv[nftKey] || 0) + 1;
        const nft = getNFTItem(tokenId);
        addLog(`⭐ Unwrapped ${nft.n} from Premium Bundle!`, '#f59e0b');
      });
    }
    
    setGameState({ ...s });
  };

  const handleSellItem = (itemKey: string, sellQty: number = 1) => {
    const s = stateRef.current;
    if (!s) return;
    const qty = s.pl.inv[itemKey] || 0;
    if (qty < sellQty) return;

    // Define sell prices in Gold Coins per unit
    const prices: Record<string, number> = {
      wood: 1, stone: 1, fiber: 1, flint: 2, meat: 2, berry: 1, mushroom: 2,
      cooked_meat: 5, iron_ore: 3, iron_bar: 8, steel_bar: 15,
      copper_ore: 2, copper_bar: 5, gold_ore: 10, gold_bar: 25,
      mithril_ore: 25, mithril_bar: 60, crystal: 15, magic_essence: 20,
      void_crystal: 50, celestial_shard: 150, dragon_scale: 200, silk: 15,
      mana_crystal: 30
    };

    let pricePerUnit = 0;
    if (itemKey.startsWith('nft_')) {
      const tokenId = parseInt(itemKey.replace('nft_', ''), 10);
      const nft = getNFTItem(tokenId);
      pricePerUnit = Math.round(nft.price * 0.7);
    } else if (prices[itemKey] !== undefined) {
      pricePerUnit = prices[itemKey];
    } else {
      // Default fallback based on type
      const it = IT[itemKey];
      if (it) {
        if (it.t === 'weapon') {
          pricePerUnit = Math.round((it.dmg || 10) * 1.5);
        } else if (it.t === 'armor') {
          pricePerUnit = Math.round((it.def || 5) * 2.0);
        } else {
          pricePerUnit = 2;
        }
      }
    }

    if (pricePerUnit <= 0) {
      addLog(`This item cannot be sold.`, '#a1a1aa');
      return;
    }

    const totalEarning = pricePerUnit * sellQty;
    s.pl.inv[itemKey] -= sellQty;
    if (s.pl.inv[itemKey] <= 0) {
      delete s.pl.inv[itemKey];
    }

    s.pl.inv.gold_coins = (s.pl.inv.gold_coins || 0) + totalEarning;
    addLog(`Sold ${sellQty}x ${IT[itemKey]?.n || itemKey} for 🪙${totalEarning} Gold Coins`, '#10b981');
    setGameState({ ...s });
  };

  const handleCastSpell = async (spellName: string, manaCost: number, paymentType: 'mp' | 'crystals' = 'mp') => {
    const s = stateRef.current;
    if (!s) return;

    let actualManaCost = manaCost;
    if (paymentType === 'mp') {
      const sageLvl = s.pl.masteries?.sages_wisdom || 0;
      if (sageLvl > 0) {
        actualManaCost = Math.round(manaCost * (1 - sageLvl * 0.10));
      }
    }

    const crystalCost = spellName === "Heal" ? 1 
      : spellName === "Reveal Map" ? 2 
      : spellName === "Healing Sanctuary" ? 2 
      : spellName === "Flame Burst" ? 1 
      : spellName === "Tectonic Rift" ? 2 
      : 3;

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
      if (s.pl.mp < actualManaCost) {
        addLog("❌ You do not have enough Mana to cast this spell!", "#ef4444");
        return;
      }
      // Spend Mana immediately
      s.pl.mp -= actualManaCost;
      setGameState({ ...s });
      addLog(`✨ Channelling spell: "${spellName}" (${actualManaCost} MP spent)...`, "#c084fc");
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
      } else if (spellName === "Flame Burst") {
        const damageValue = result.damage || 75;
        addLog(`🔥 Casting Flame Burst! Searing heat wave unleashed for ${damageValue} damage!`, "#f97316");
        
        // Circle fire shockwave particle burst around player
        const numFireParts = 36;
        for (let i = 0; i < numFireParts; i++) {
          const angle = (i / numFireParts) * Math.PI * 2;
          s.parts.push({
            x: s.pl.x,
            y: s.pl.y,
            vx: Math.cos(angle) * 5,
            vy: Math.sin(angle) * 5,
            life: 30,
            maxLife: 30,
            col: i % 2 === 0 ? '#ea580c' : '#f97316',
            sz: 4
          });
        }
        spawnExplosion(s, s.pl.x, s.pl.y, "#f97316", 35, "spark");

        // Hurt and push back surrounding enemies (within 150px)
        let hitCount = 0;
        for (let i = s.enemies.length - 1; i >= 0; i--) {
          const e = s.enemies[i];
          const distance = dist(s.pl, e);
          if (distance < 150) {
            hitCount++;
            e.hp -= damageValue;
            e.flashTicks = 12;
            
            // Knock back enemy slightly away from player
            const kbAngle = Math.atan2(e.y - s.pl.y, e.x - s.pl.x);
            e.x = Math.max(0, Math.min(WW * TZ - 1, e.x + Math.cos(kbAngle) * 45));
            e.y = Math.max(0, Math.min(WH * TZ - 1, e.y + Math.sin(kbAngle) * 45));
            
            spawnExplosion(s, e.x, e.y, "#ef4444", 12, "pixel");
            
            if (e.hp <= 0) {
              handleEnemyKilled(s, e);
              s.enemies.splice(i, 1);
            }
          }
        }
        if (hitCount > 0) {
          addLog(`💥 Hit ${hitCount} hostile monster(s) with fire shockwave!`, "#f97316");
        } else {
          addLog(`💨 No monsters were in range of the flame burst.`, "#a1a1aa");
        }
      } else if (spellName === "Tectonic Rift") {
        addLog(`🪨 Casting Tectonic Rift! Shattering ground in a 150px area...`, "#fbbf24");
        
        // Shake the ground particles
        const numEarthquakeParts = 40;
        for (let i = 0; i < numEarthquakeParts; i++) {
          const angle = Math.random() * Math.PI * 2;
          const r = 20 + Math.random() * 130;
          s.parts.push({
            x: s.pl.x + Math.cos(angle) * r,
            y: s.pl.y + Math.sin(angle) * r,
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2,
            life: 25,
            maxLife: 25,
            col: i % 2 === 0 ? '#78350f' : '#b45309', // Brown/amber soil
            sz: 3
          });
        }
        spawnExplosion(s, s.pl.x, s.pl.y, "#d97706", 30, "pixel");

        const px = Math.floor(s.pl.x / TZ), py = Math.floor(s.pl.y / TZ);
        let harvestedCount = 0;
        
        // Loop backwards to safely splice from s.objs
        for (let i = s.objs.length - 1; i >= 0; i--) {
          const o = s.objs[i];
          if (o.type === 'tree' || o.type === 'rock') {
            const odist = Math.sqrt(Math.pow((o.tx - px), 2) + Math.pow((o.ty - py), 2));
            if (odist <= 5) {
              harvestedCount++;
              
              // Woodcutting or mining skill XP
              if (o.type === 'tree') {
                gainSkillXP('woodcutting', 15);
                const baseLogs = 2 + Math.floor(Math.random() * 2);
                const q = baseLogs;
                s.pl.inv.wood = (s.pl.inv.wood || 0) + q;
                addLog(`+Wood x${q} (Rift Harvest)`, '#22c55e');

                if (o.subtype === 'cactus') {
                  s.pl.inv.cactus_fruit = (s.pl.inv.cactus_fruit || 0) + 1;
                } else if (o.subtype === 'snowpine') {
                  s.pl.inv.snowberry = (s.pl.inv.snowberry || 0) + 1;
                } else if (o.subtype === 'blossom') {
                  s.pl.inv.astral_flower = (s.pl.inv.astral_flower || 0) + 1;
                } else if (o.subtype === 'cosmic') {
                  s.pl.inv.void_crystal = (s.pl.inv.void_crystal || 0) + 1;
                }
              } else if (o.type === 'rock') {
                gainSkillXP('mining', 15);
                const baseStones = 3;
                s.pl.inv.stone = (s.pl.inv.stone || 0) + baseStones;
                addLog(`+Stone x${baseStones} (Rift Harvest)`, '#22c55e');

                // Roll ore drop
                if (o.subtype === 'copper') {
                  s.pl.inv.copper_ore = (s.pl.inv.copper_ore || 0) + 2;
                } else if (o.subtype === 'iron') {
                  s.pl.inv.iron_ore = (s.pl.inv.iron_ore || 0) + 2;
                } else if (o.subtype === 'coal') {
                  s.pl.inv.coal = (s.pl.inv.coal || 0) + 2;
                } else if (o.subtype === 'gold') {
                  s.pl.inv.gold_ore = (s.pl.inv.gold_ore || 0) + 1;
                } else if (o.subtype === 'mithril') {
                  s.pl.inv.mithril_ore = (s.pl.inv.mithril_ore || 0) + 1;
                } else if (o.subtype === 'sulfur') {
                  s.pl.inv.sulfur = (s.pl.inv.sulfur || 0) + 2;
                } else if (o.subtype === 'mana_crystal') {
                  s.pl.inv.mana_crystal = (s.pl.inv.mana_crystal || 0) + 1;
                } else if (o.subtype === 'crystal') {
                  s.pl.inv.crystal = (s.pl.inv.crystal || 0) + 1;
                } else if (o.subtype === 'void_crystal') {
                  s.pl.inv.void_crystal = (s.pl.inv.void_crystal || 0) + 1;
                } else if (o.subtype === 'celestial') {
                  s.pl.inv.celestial_shard = (s.pl.inv.celestial_shard || 0) + 1;
                } else {
                  if (Math.random() < 0.2) s.pl.inv.iron_ore = (s.pl.inv.iron_ore || 0) + 1;
                }
              }
              
              // Spawn rift sparkles and delete object
              spawnExplosion(s, o.tx * TZ + TZ/2, o.ty * TZ + TZ/2, '#fbbf24', 12, 'spark');
              s.objs.splice(i, 1);
            }
          }
        }
        
        if (harvestedCount > 0) {
          addLog(`⛰️ Tectonic Rift harvested ${harvestedCount} environmental resource nodes!`, "#fbbf24");
        } else {
          addLog(`💨 No harvestable trees or boulders were in range of the tectonic rift.`, "#a1a1aa");
        }
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
      const isNear = s.objs.some((o: any) => o.type === r.req);
      if (!isNear) {
        addLog(`Must build a ${IT[r.req]?.n || r.req} 🛠️ somewhere on the entire map to craft this!`, '#ff4444');
        return;
      }
    }

    // Check building skill level requirement
    if (r.reqBld) {
      const bldLvl = s.pl.skills?.building?.lvl || 1;
      if (bldLvl < r.reqBld) {
        addLog(`❌ Requires Building level ${r.reqBld} to craft this!`, '#ff4444');
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
    } else if (r.cat === 'Weapons' || r.cat === 'Armor' || r.out.includes('bar') || r.out.includes('pickaxe') || r.out.includes('axe')) {
      addSkillXPDirect(s, 'smithing', 20 * qty);
    } else if (r.cat === 'Structures') {
      addSkillXPDirect(s, 'building', 30 * qty);
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

  const loadRecipeReactants = (recipe: any) => {
    const s = stateRef.current;
    if (!s) return;
    
    const toLoad: { itemKey: string; qty: number }[] = [];
    let canLoadAll = true;
    const missing: string[] = [];
    
    for (const [k, qtyNeeded] of Object.entries(recipe.c)) {
      const held = s.pl.inv[k] || 0;
      const reqQty = qtyNeeded as number;
      if (held < reqQty) {
        canLoadAll = false;
        missing.push(`${reqQty - held}x ${IT[k]?.n || k}`);
      }
      toLoad.push({ itemKey: k, qty: reqQty });
    }
    
    if (!canLoadAll) {
      addLog(`⚠️ Cannot auto-load: Missing ${missing.join(', ')}!`, '#ef4444');
      setLabStatus({ success: false, msg: `Cannot auto-load "${recipe.n}": Missing ${missing.join(', ')}!` });
      return;
    }
    
    setLabReactants(toLoad);
    setLabStatus({ success: true, msg: `Loaded ingredients for ${recipe.n}! Ready to transmute.` });
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
        const isNear = s.objs.some((o: any) => o.type === r.req);
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
    return gameState.objs.some((o: any) => o.type === r.req);
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
        return it.t === 'tool' || it.t === 'weapon' || (!!it.id && it.t !== 'armor');
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
      if (invCategory === 'nft') {
        return k.startsWith('nft_') || !!it.isNFT;
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
        className="block cursor-crosshair"
        onPointerDown={handleCanvasClick}
        onPointerMove={(e) => {
          const s = stateRef.current;
          if (!s || !canvasRef.current) return;
          const rect = canvasRef.current.getBoundingClientRect();
          const mouseX = (e.clientX - rect.left) / gameZoom;
          const mouseY = (e.clientY - rect.top) / gameZoom;
          const tx = Math.floor((mouseX + s.cam.x) / TZ);
          const ty = Math.floor((mouseY + s.cam.y) / TZ);
          if (tx >= 0 && tx < WW && ty >= 0 && ty < WH) {
            mouseTileRef.current = { tx, ty };
          } else {
            mouseTileRef.current = null;
          }
        }}
        onPointerLeave={() => {
          mouseTileRef.current = null;
        }}
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

      {/* Floating HUD Controller & Zoom Pill (Always interactive, clean and modern) */}
      <div className="absolute top-4 left-4 z-50 flex items-center gap-1.5 pointer-events-auto bg-zinc-950/90 border border-white/10 p-1.5 rounded-xl backdrop-blur-md shadow-2xl text-xs font-mono font-bold select-none">
        <button 
          onClick={() => setIsHUDHidden(prev => !prev)}
          className="px-2 py-1 bg-white/5 border border-white/10 hover:border-yellow-500/50 hover:bg-yellow-500/10 rounded-lg text-[10px] text-zinc-300 hover:text-yellow-400 cursor-pointer transition-all active:scale-95 flex items-center gap-1"
          title="Toggle HUD Visibility (H)"
        >
          {isHUDHidden ? '👁️ SHOW HUD' : '🙈 HIDE HUD'}
          <span className="text-[8px] bg-white/10 px-1 rounded text-zinc-400 font-bold">H</span>
        </button>
        <div className="h-4 w-px bg-white/10 mx-0.5" />
        <button 
          onClick={() => setGameZoom(prev => Math.max(0.4, Number((prev - 0.15).toFixed(2))))}
          className="w-6 h-6 flex items-center justify-center bg-white/5 border border-white/10 hover:border-cyan-500/50 hover:bg-cyan-500/10 rounded-lg text-zinc-300 hover:text-cyan-400 cursor-pointer transition-all active:scale-95 font-black"
          title="Zoom Out"
        >
          ➖
        </button>
        <span className="text-[10px] text-zinc-400 px-1 text-center min-w-[32px]">{Math.round(gameZoom * 100)}%</span>
        <button 
          onClick={() => setGameZoom(prev => Math.min(1.5, Number((prev + 0.15).toFixed(2))))}
          className="w-6 h-6 flex items-center justify-center bg-white/5 border border-white/10 hover:border-cyan-500/50 hover:bg-cyan-500/10 rounded-lg text-zinc-300 hover:text-cyan-400 cursor-pointer transition-all active:scale-95 font-black"
          title="Zoom In"
        >
          ➕
        </button>
      </div>

      {/* --- HUD --- */}
      <div className={`absolute top-0 left-0 right-0 p-4 flex justify-between items-start pointer-events-none z-10 transition-all duration-300 ${isHUDHidden ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'}`}>
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
                <button 
                  onClick={() => setShowCharCustomizer(true)}
                  className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-500 to-amber-300 flex items-center justify-center text-sm font-black text-black shadow-inner shadow-black/20 animate-pulse hover:scale-110 active:scale-95 transition-all cursor-pointer"
                  title="Click to Edit Character"
                >
                  {gameState?.pl.ico || '🧍'}
                </button>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold tracking-wider text-yellow-400 uppercase font-sans">
                    {gameState?.pl.charName || 'Hero'} the {gameState?.pl.class || 'Survivor'}
                  </span>
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

              {/* Hunger (HU) */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center text-[10px] font-bold font-mono">
                  <span className="text-amber-400 flex items-center gap-1">🍖 HUNGER</span>
                  <span className="text-amber-200">{Math.floor(gameState?.pl.hu ?? 100)}%</span>
                </div>
                <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden border border-white/5 p-0.5 shadow-inner">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-amber-600 to-yellow-400 rounded-full"
                    initial={{ width: '100%' }}
                    animate={{ width: `${Math.max(0, Math.min(100, (gameState?.pl.hu ?? 100)))}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>

              {/* Thirst (TH) */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center text-[10px] font-bold font-mono">
                  <span className="text-sky-400 flex items-center gap-1">💧 THIRST</span>
                  <span className="text-sky-200">{Math.floor(gameState?.pl.th ?? 100)}%</span>
                </div>
                <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden border border-white/5 p-0.5 shadow-inner">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-sky-600 to-cyan-400 rounded-full"
                    initial={{ width: '100%' }}
                    animate={{ width: `${Math.max(0, Math.min(100, (gameState?.pl.th ?? 100)))}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>

              {/* Stamina (STA) */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center text-[10px] font-bold font-mono">
                  <span className="text-emerald-400 flex items-center gap-1">⚡ STAMINA</span>
                  <span className="text-emerald-200">{Math.floor(gameState?.pl.sta ?? 100)}%</span>
                </div>
                <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden border border-white/5 p-0.5 shadow-inner">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-emerald-600 to-teal-400 rounded-full"
                    initial={{ width: '100%' }}
                    animate={{ width: `${Math.max(0, Math.min(100, (gameState?.pl.sta ?? 100)))}%` }}
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
                  { slot: 'back', n: 'Backpack', ico: '🎒' },
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
            {gameState?.zoneMaps?.[Math.floor((gameState?.pl.y || 0) / (ZH * TZ)) * ZCOLS + Math.floor((gameState?.pl.x || 0) / (ZW * TZ))]?.n || "Unknown"}
          </div>

          {gameState?.weather && (
            <div className="mt-1 flex flex-col items-end gap-0.5 bg-black/50 border border-white/5 backdrop-blur-md p-1.5 rounded-xl max-w-[170px] text-right shadow-lg">
              <div className="flex items-center gap-1.5 text-xs font-bold text-white leading-none">
                <span className="text-sm">{gameState.weather.icon}</span>
                <span className="tracking-tight">{gameState.weather.label}</span>
              </div>
              <div className="flex items-center gap-1 text-[9px] font-mono leading-none">
                <span className="opacity-50">Threat:</span>
                <span className={
                  gameState.weather.threat === 'Extreme' ? 'text-red-400 font-bold animate-pulse' :
                  gameState.weather.threat === 'High' ? 'text-orange-400 font-bold' :
                  gameState.weather.threat === 'Medium' ? 'text-yellow-400 font-bold' :
                  gameState.weather.threat === 'Low' ? 'text-sky-300' :
                  'text-emerald-400'
                }>
                  {gameState.weather.threat}
                </span>
              </div>
              <p className="text-[8px] leading-tight text-white/50 select-none mt-0.5">
                {gameState.weather.desc}
              </p>
            </div>
          )}

          <div className="text-[10px] font-mono text-orange-400 font-bold tracking-wider mt-0.5">
            {gameState?.waveActive ? (
              <span className="text-red-400 animate-pulse">⚠️ WAVE {gameState?.waveNum} ({gameState?.waveTimer}s left)</span>
            ) : (
              <span>WAVE {(gameState?.waveNum || 0) + 1} IN {gameState?.waveTimer}s</span>
            )}
          </div>
          <div className="w-32 h-1 bg-white/10 rounded-full mt-1 overflow-hidden">
            <div className="h-full bg-yellow-400" style={{ width: `${(gameState?.pl.xp / gameState?.pl.xpNext) * 100}%` }} />
          </div>

          {/* Master Action & Management Menu Bar */}
          {isMenuBarCollapsed ? (
            <div className="mt-3 pointer-events-auto">
              <button 
                onClick={() => setIsMenuBarCollapsed(false)}
                className="px-3 py-2 bg-zinc-950/90 border border-yellow-500/30 hover:border-yellow-400 text-yellow-400 hover:text-yellow-300 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-lg animate-pulse"
              >
                <span>🎛️ SYSTEM CONTROLS</span>
                <span className="text-[8px] bg-yellow-500/20 text-yellow-300 px-1.5 py-0.5 rounded font-black">OPEN</span>
              </button>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-1.5 sm:gap-2 justify-end max-w-[310px] sm:max-w-[460px] md:max-w-[600px] lg:max-w-[550px] pointer-events-auto bg-zinc-950/95 border border-white/10 p-3 rounded-2xl backdrop-blur-md shadow-2xl transition-all">
              <div className="w-full flex justify-between items-center border-b border-white/10 pb-2 mb-1">
                <span className="text-[10px] font-bold text-yellow-400 tracking-widest uppercase">🎛️ CONTROLS MENU</span>
                <button 
                  onClick={() => setIsMenuBarCollapsed(true)}
                  className="px-2 py-0.5 bg-zinc-900 border border-red-500/20 hover:border-red-500 text-[9px] rounded-lg text-zinc-400 hover:text-red-400 cursor-pointer transition-all active:scale-95"
                >
                  ✕ HIDE
                </button>
              </div>
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
                onClick={() => {
                  const s = stateRef.current;
                  if (s && s.pl) {
                    setCustomTownName(s.pl.townName || 'Camp Horizon');
                  }
                  setShowTownHub(true);
                }}
                className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-zinc-900 border border-green-500/20 hover:border-green-400/50 rounded-xl text-[9px] sm:text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 sm:gap-1.5 transition-all text-white hover:text-green-300 hover:scale-105 active:scale-95 cursor-pointer shadow-lg"
              >
                <span className="text-green-400 text-[11px] sm:text-xs">🏘️</span>
                <span>TOWN HUB</span>
              </button>
              <button 
                onClick={() => setShowCharCustomizer(true)}
                className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-zinc-900 border border-purple-500/20 hover:border-purple-400/50 rounded-xl text-[9px] sm:text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 sm:gap-1.5 transition-all text-white hover:text-purple-300 hover:scale-105 active:scale-95 cursor-pointer shadow-lg"
              >
                <span className="text-purple-400 text-[11px] sm:text-xs">👤</span>
                <span>PLAYER</span>
              </button>
              <button 
                onClick={() => setShowResearch(true)}
                className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-zinc-900 border border-cyan-500/20 hover:border-cyan-400/50 rounded-xl text-[9px] sm:text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 sm:gap-1.5 transition-all text-white hover:text-cyan-400 hover:scale-105 active:scale-95 cursor-pointer shadow-lg"
              >
                <Cpu size={11} className="text-cyan-400 font-bold" />
                <span>RESEARCH</span>
              </button>
              <button 
                onClick={() => setShowRecipeBook(true)}
                className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-zinc-900 border border-amber-500/20 hover:border-amber-400/50 rounded-xl text-[9px] sm:text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 sm:gap-1.5 transition-all text-white hover:text-amber-400 hover:scale-105 active:scale-95 cursor-pointer shadow-lg"
              >
                <Book size={11} className="text-amber-400" />
                <span>RECIPES</span>
              </button>
              <button 
                onClick={() => setIsAutoCollapsed(prev => !prev)}
                className={`px-2.5 py-1.5 sm:px-3 sm:py-2 bg-zinc-900 border rounded-xl text-[9px] sm:text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 sm:gap-1.5 transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-lg ${!isAutoCollapsed ? 'border-teal-400 text-teal-300 shadow-[0_0_15px_rgba(20,184,166,0.25)] font-bold' : 'border-teal-500/20 text-white hover:text-teal-300'}`}
              >
                <Cpu size={11} className="text-teal-400" />
                <span>AUTOMATE</span>
              </button>
              <button 
                onClick={() => setShowSkills(true)}
                className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-zinc-900 border border-teal-500/20 hover:border-teal-400/50 rounded-xl text-[9px] sm:text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 sm:gap-1.5 transition-all text-white hover:text-teal-300 hover:scale-105 active:scale-95 cursor-pointer shadow-lg"
              >
                <Sparkles size={11} className="text-teal-400" />
                <span>SKILLS</span>
              </button>
              <button 
                onClick={() => setShowQuests(true)}
                className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-zinc-900 border border-emerald-500/20 hover:border-emerald-400/50 rounded-xl text-[9px] sm:text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 sm:gap-1.5 transition-all text-white hover:text-emerald-300 hover:scale-105 active:scale-95 cursor-pointer shadow-lg"
              >
                <Compass size={11} className="text-emerald-400" />
                <span>QUESTS</span>
              </button>
              <button 
                onClick={() => setShowMasteries(true)}
                className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-zinc-900 border border-orange-500/20 hover:border-orange-400/50 rounded-xl text-[9px] sm:text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 sm:gap-1.5 transition-all text-white hover:text-orange-300 hover:scale-105 active:scale-95 cursor-pointer shadow-lg"
              >
                <Flame size={11} className="text-orange-400" />
                <span>MASTERIES</span>
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
              <button 
                onClick={() => setShowNFTMarket(true)}
                className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-zinc-900 border border-cyan-500/30 hover:border-cyan-400 rounded-xl text-[9px] sm:text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 sm:gap-1.5 transition-all text-cyan-400 hover:text-cyan-300 hover:scale-105 active:scale-95 cursor-pointer shadow-[0_0_15px_rgba(6,182,212,0.15)] hover:shadow-[0_0_25px_rgba(6,182,212,0.3)] animate-pulse"
              >
                <Cpu size={11} className="text-cyan-400" />
                <span>NFT SHOP</span>
              </button>
              <button 
                onClick={() => setShowShop(true)}
                className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/40 hover:border-yellow-400 rounded-xl text-[9px] sm:text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 sm:gap-1.5 transition-all text-yellow-400 hover:text-yellow-300 hover:scale-105 active:scale-95 cursor-pointer shadow-[0_0_15px_rgba(245,158,11,0.15)] hover:shadow-[0_0_25px_rgba(245,158,11,0.3)]"
              >
                <Sparkles size={11} className="text-yellow-400" />
                <span>💎 SHOP</span>
              </button>
              <button 
                onClick={() => setShowMusicMenu(true)}
                className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-zinc-900 border border-rose-500/20 hover:border-rose-400/50 rounded-xl text-[9px] sm:text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 sm:gap-1.5 transition-all text-rose-400 hover:text-rose-300 hover:scale-105 active:scale-95 cursor-pointer shadow-lg"
              >
                <Music size={11} className={isMusicPlaying ? "animate-bounce text-rose-400" : "text-rose-400"} />
                <span>MUSIC</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* --- MINIMAP OVERLAY PANEL --- */}
      <div className={`transition-all duration-300 ${isHUDHidden ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'}`}>
        {!isMinimapCollapsed ? (
        <div className="absolute top-[280px] sm:top-[220px] right-4 flex flex-col gap-2 p-3 bg-zinc-950/85 border border-white/10 rounded-2xl backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.5)] pointer-events-auto w-[200px] select-none z-10">
          <div className="flex items-center justify-between border-b border-white/10 pb-1.5 mb-1">
            <span className="text-[10px] font-extrabold tracking-wider text-cyan-400 uppercase flex items-center gap-1">
              <Compass size={11} className="animate-spin text-cyan-400 [animation-duration:8s]" />
              {minimapMode === 'local' ? 'RADAR FEED' : 'WORLD SCAN'}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setMinimapMode(prev => prev === 'local' ? 'world' : 'local')}
                className="px-1.5 py-0.5 bg-zinc-900 border border-white/5 hover:border-cyan-500/30 hover:bg-zinc-800 text-[8px] rounded-md text-zinc-300 font-extrabold cursor-pointer transition-all uppercase"
                title="Toggle Mode"
              >
                {minimapMode === 'local' ? 'WORLD' : 'LOCAL'}
              </button>
              <button 
                onClick={() => setIsMinimapCollapsed(true)} 
                className="p-0.5 bg-zinc-900 border border-white/5 hover:border-red-500/30 text-[9px] rounded-md text-zinc-400 hover:text-white cursor-pointer transition-all flex items-center justify-center"
                title="Collapse Map"
              >
                <X size={10} />
              </button>
            </div>
          </div>

          {/* Canvas Container */}
          <div className="relative w-[174px] h-[174px] mx-auto rounded-lg overflow-hidden bg-black/50 border border-white/5 shadow-inner flex items-center justify-center">
            <canvas 
              ref={minimapCanvasRef} 
              width={174} 
              height={174} 
              onClick={handleMinimapClick}
              className="w-[174px] h-[174px] cursor-crosshair active:scale-95 transition-transform"
              title="Click to place waypoint and auto-travel"
            />
            
            {/* Scope crosshair decorative rings overlay */}
            <div className="absolute inset-0 pointer-events-none border border-cyan-500/5 rounded-full m-1 animate-pulse" />
            <div className="absolute inset-0 pointer-events-none border border-white/5 rounded-full m-6" />
          </div>

          {/* Coordinates & Location info */}
          <div className="flex flex-col gap-0.5 mt-1 font-mono text-[9px]">
            <div className="flex items-center justify-between text-zinc-400">
              <span>X: <span className="text-white font-bold">{gameState ? Math.floor(gameState.pl.x / TZ) : 0}</span></span>
              <span>Y: <span className="text-white font-bold">{gameState ? Math.floor(gameState.pl.y / TZ) : 0}</span></span>
              <span className="text-cyan-400/80 uppercase text-[8px] font-black">{minimapMode === 'local' ? `${Math.round(minimapZoom * 100)}%` : '5X5'}</span>
            </div>
            <div className="text-center font-bold text-yellow-400/90 truncate text-[9px] mt-1 border-t border-white/5 pt-1 flex items-center justify-center gap-1">
              <MapPin size={8} className="text-yellow-400" />
              <span>
                {(() => {
                  if (!gameState || !gameState.pl) return "Wilds";
                  const zx = Math.floor(gameState.pl.x / (ZW * TZ));
                  const zy = Math.floor(gameState.pl.y / (ZH * TZ));
                  const boundedX = Math.max(0, Math.min(4, zx));
                  const boundedY = Math.max(0, Math.min(4, zy));
                  const idx = boundedY * ZCOLS + boundedX;
                  return MAPS[idx]?.n || "Unknown Wilds";
                })()}
              </span>
            </div>

            {/* Cave Compass */}
            {gameState && (
              <div className="mt-1.5 border-t border-white/5 pt-1.5 flex flex-col gap-0.5 text-center bg-pink-950/20 border border-pink-500/20 rounded-lg p-1 animate-pulse">
                <span className="text-[7px] text-pink-400 font-extrabold tracking-widest uppercase flex items-center justify-center gap-1">
                  <Compass size={8} className="text-pink-400" /> CAVE COMPASS
                </span>
                {(() => {
                  if (gameState.inCave) {
                    return (
                      <div className="text-[9px] font-black text-green-400">
                        🪜 Cave Exit nearby!
                      </div>
                    );
                  }
                  const ptx = Math.floor(gameState.pl.x / TZ);
                  const pty = Math.floor(gameState.pl.y / TZ);
                  let nearest = null;
                  let minDist = Infinity;
                  const caveZones = [
                    { zc: 0, r: 1 },
                    { zc: 3, r: 3 },
                    { zc: 5, r: 4 },
                    { zc: 1, r: 5 },
                    { zc: 6, r: 2 },
                    { zc: 4, r: 7 },
                  ];
                  for (const cz of caveZones) {
                    const etx = cz.zc * ZW + 30;
                    const ety = cz.r * ZH + 30;
                    const dx = etx - ptx;
                    const dy = ety - pty;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < minDist) {
                      minDist = dist;
                      nearest = { cz, dx, dy, dist };
                    }
                  }
                  if (!nearest) return null;
                  const dx = nearest.dx;
                  const dy = nearest.dy;
                  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                  let dirStr = "";
                  if (nearest.dist < 8) dirStr = "🕳️ RIGHT HERE!";
                  else {
                    if (angle >= -22.5 && angle < 22.5) dirStr = "➡️ East";
                    else if (angle >= 22.5 && angle < 67.5) dirStr = "➡️⬇️ SE";
                    else if (angle >= 67.5 && angle < 112.5) dirStr = "⬇️ South";
                    else if (angle >= 112.5 && angle < 157.5) dirStr = "⬅️⬇️ SW";
                    else if (angle >= 157.5 || angle < -157.5) dirStr = "⬅️ West";
                    else if (angle >= -157.5 && angle < -112.5) dirStr = "⬅️⬆️ NW";
                    else if (angle >= -112.5 && angle < -67.5) dirStr = "⬆️ North";
                    else if (angle >= -67.5 && angle < -22.5) dirStr = "➡️⬆️ NE";
                  }
                  return (
                    <div className="text-[9px] font-bold text-pink-300">
                      <div>{dirStr} ({Math.round(nearest.dist)}m)</div>
                      <div className="text-[7px] text-pink-400/80">Zone ({nearest.cz.zc}, {nearest.cz.r})</div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Local zoom controls */}
          {minimapMode === 'local' && (
            <div className="flex gap-1 justify-center mt-1">
              <button
                onClick={() => setMinimapZoom(prev => Math.max(0.6, prev - 0.2))}
                className="flex-1 py-0.5 bg-zinc-900 border border-white/5 hover:border-cyan-500/30 text-[8px] rounded-md text-zinc-400 hover:text-white cursor-pointer flex items-center justify-center"
                title="Zoom Out"
              >
                <Minus size={8} />
              </button>
              <button
                onClick={() => setMinimapZoom(prev => Math.min(2.0, prev + 0.2))}
                className="flex-1 py-0.5 bg-zinc-900 border border-white/5 hover:border-cyan-500/30 text-[8px] rounded-md text-zinc-400 hover:text-white cursor-pointer flex items-center justify-center"
                title="Zoom In"
              >
                <Plus size={8} />
              </button>
            </div>
          )}

          {/* Legend toggle & content */}
          <div className="flex flex-col gap-1 mt-1 border-t border-white/5 pt-1">
            <button
              onClick={() => setShowMinimapLegend(prev => !prev)}
              className="w-full py-0.5 bg-zinc-900 border border-white/5 hover:border-cyan-500/30 text-[8px] font-bold rounded-md text-zinc-300 hover:text-white cursor-pointer transition-all flex items-center justify-center gap-1 uppercase"
            >
              <span>{showMinimapLegend ? 'Hide Legend ▲' : 'Show Legend ▼'}</span>
            </button>
            
            {showMinimapLegend && (
              <div className="grid grid-cols-2 gap-x-1 gap-y-1 text-[8px] font-mono text-zinc-300 bg-black/40 p-1.5 rounded-lg border border-white/5 max-h-[140px] overflow-y-auto scrollbar-none">
                <div className="col-span-2 text-[7px] text-cyan-400 font-bold uppercase tracking-wider mb-0.5 border-b border-white/5 pb-0.5">Terrain / Markers</div>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e] border border-white/20" />
                  <span>You</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#ef4444]" />
                  <span>Enemies</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#f97316]" />
                  <span>Structures</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#a855f7]" />
                  <span>Portal</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#ec4899]" />
                  <span>Cave 🕳️</span>
                </div>

                <div className="col-span-2 text-[7px] text-yellow-400 font-bold uppercase tracking-wider mt-1.5 mb-0.5 border-b border-white/5 pb-0.5">Resources / Nodes</div>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#15803d] border border-black/40" />
                  <span>Tree</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#a3e635] border border-black/40" />
                  <span>Cactus</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#93c5fd] border border-black/40" />
                  <span>Snowpine</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#f472b6] border border-black/40" />
                  <span>Blossom</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#a855f7] border border-black/40" />
                  <span>Cosmic Tree</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#94a3b8] border border-black/40" />
                  <span>Stone Node</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#f97316] border border-black/40" />
                  <span>Copper Ore</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#818cf8] border border-black/40" />
                  <span>Iron Ore</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#facc15] border border-black/40" />
                  <span>Gold Ore</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#22d3ee] border border-black/40" />
                  <span>Mithril Ore</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#fbbf24] border border-black/40" />
                  <span>Sulfur Node</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#c084fc] border border-black/40" />
                  <span>Mana Crystal</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#ec4899] border border-black/40" />
                  <span>Void Crystal</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#38bdf8] border border-black/40" />
                  <span>Celestial</span>
                </div>

                <div className="col-span-2 text-[7px] text-emerald-400 font-bold uppercase tracking-wider mt-1.5 mb-0.5 border-b border-white/5 pb-0.5">Loose Ground Drops</div>
                <div className="flex items-center gap-1">
                  <div className="w-1 h-1 rounded-full bg-[#b45309]" />
                  <span>Wood 🪵</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-1 h-1 rounded-full bg-[#6b7280]" />
                  <span>Stone 🪨</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-1 h-1 rounded-full bg-[#10b981]" />
                  <span>Fiber 🌿</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-1 h-1 rounded-full bg-[#c084fc]" />
                  <span>Berries 🫐</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-1 h-1 rounded-full bg-[#f472b6]" />
                  <span>Mushroom 🍄</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-1 h-1 rounded-full bg-[#34d399]" />
                  <span>Herbs 🌿</span>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="absolute top-[280px] sm:top-[220px] right-4 flex flex-col gap-2 p-2 bg-zinc-950/85 border border-white/10 rounded-2xl backdrop-blur-md shadow-lg pointer-events-auto select-none z-10">
          <button 
            onClick={() => setIsMinimapCollapsed(false)} 
            className="px-2.5 py-1.5 bg-zinc-900 border border-white/10 hover:border-cyan-400 rounded-xl text-[9px] font-bold uppercase tracking-widest flex items-center gap-1 transition-all text-white cursor-pointer"
          >
            <Compass size={11} className="text-cyan-400 animate-pulse" />
            <span>SHOW MAP</span>
          </button>
        </div>
      )}
      </div>

      {/* --- Logs (Restored as a clean, sleek, auto-fading game console feed) --- */}
      {!isHUDHidden && logs && logs.length > 0 && (
        <div className="absolute bottom-[280px] sm:bottom-[160px] left-4 z-40 flex flex-col gap-1 max-w-[280px] pointer-events-none select-none font-mono">
          <AnimatePresence>
            {logs.slice(0, 4).map((log) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -20, scale: 0.95 }}
                animate={{ opacity: 0.85, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -20, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="px-2.5 py-1 bg-black/80 border border-white/5 rounded-lg shadow-md backdrop-blur-xs text-[10px] font-bold leading-normal"
                style={{ color: log.col || '#fff' }}
              >
                {log.msg}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

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
      {/* Bottom Center: Hotbar (Always centered at the bottom, pointer enabled, persistent floating design) */}
      {(!showRecipeBook && !showOracle && !showSaveMenu && !showWorldMenu && !showSpellbook && !showNFTMarket && !showDeathScreen && gameState) && (
        <div 
          className={`absolute left-1/2 -translate-x-1/2 pointer-events-auto select-none flex flex-col items-center gap-2 transition-all duration-300 ${
            (showInv || showCraft || showSkills || showShop || showTownShop)
              ? 'bottom-6 z-[52] scale-105' 
              : 'bottom-4 z-[52]'
          }`}
        >
          {/* Quick Crafting Panel */}
          {(!showInv && !showCraft && !showSkills && !showShop && !showTownShop) && (() => {
            const getNearStations = () => {
              if (!gameState || !gameState.pl || !gameState.objs) return [];
              const ptx = Math.floor(gameState.pl.x / TZ);
              const pty = Math.floor(gameState.pl.y / TZ);
              const stations = ['campfire', 'camp_fire', 'workbench', 'forge', 'magic_altar'];
              const near: string[] = [];
              
              for (const o of gameState.objs) {
                if (stations.includes(o.type)) {
                  const dx = o.tx - ptx;
                  const dy = o.ty - pty;
                  if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
                    if (!near.includes(o.type)) {
                      near.push(o.type);
                    }
                  }
                }
              }
              return near;
            };

            const activeStations = getNearStations();
            if (activeStations.length === 0) return null;

            const getStationDisplayName = (station: string) => {
              if (station === 'campfire' || station === 'camp_fire') return 'Campfire 🔥';
              if (station === 'workbench') return 'Workbench 🪚';
              if (station === 'forge') return 'Forge 🌋';
              if (station === 'magic_altar') return 'Magic Altar 🔮';
              return station;
            };

            const validQuickRecipes = recipes
              .map((r, i) => ({ r, i }))
              .filter(({ r }) => {
                if (!r.discovered) return false;
                
                const isStationMatch = !r.req || activeStations.some(ns => {
                  if (r.req === 'campfire' && ns === 'camp_fire') return true;
                  if (r.req === 'camp_fire' && ns === 'campfire') return true;
                  return r.req === ns;
                });
                if (!isStationMatch) return false;

                const hasMats = Object.entries(r.c).every(([k, v]) => (gameState?.pl?.inv[k] || 0) >= (v as number));
                if (!hasMats) return false;

                const bldLvl = gameState?.pl?.skills?.building?.lvl || 1;
                const bldMet = !r.reqBld || bldLvl >= r.reqBld;
                if (!bldMet) return false;

                return true;
              });

            return (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="bg-zinc-950/95 border border-cyan-500/30 p-2.5 rounded-2xl backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.7)] w-[360px] md:w-[450px] flex flex-col gap-1.5 select-none shrink-0"
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/5 pb-1 px-1">
                  <span className="text-[9px] font-black tracking-widest text-cyan-400 flex items-center gap-1.5 uppercase">
                    <span className="animate-pulse">⚡</span> QUICK CRAFT: {activeStations.map(getStationDisplayName).join(' & ')}
                  </span>
                  <span className="text-[8px] text-zinc-400 uppercase font-mono">
                    {validQuickRecipes.length} item(s) available
                  </span>
                </div>

                {/* Content */}
                {validQuickRecipes.length > 0 ? (
                  <div className="flex gap-2 overflow-x-auto py-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                    {validQuickRecipes.map(({ r, i }) => (
                      <motion.button
                        key={`${r.out}-${i}`}
                        onClick={() => craft(i, 1)}
                        whileHover={{ scale: 1.02, borderColor: 'rgba(6,182,212,0.5)' }}
                        whileTap={{ scale: 0.96 }}
                        className="flex-shrink-0 bg-white/[0.02] border border-white/10 hover:bg-cyan-500/[0.05] p-2 rounded-xl flex items-center gap-2 cursor-pointer transition-all duration-200 max-w-[150px] md:max-w-[180px]"
                        title={`Craft 1x ${r.n}`}
                      >
                        <span className="text-lg shrink-0">{IT[r.out]?.ico || '📦'}</span>
                        <div className="text-left min-w-0">
                          <div className="text-[9px] font-black text-zinc-100 truncate uppercase leading-tight">
                            {r.n}
                          </div>
                          {/* Cost preview */}
                          <div className="flex gap-1 items-center mt-0.5 overflow-x-auto scrollbar-none">
                            {Object.entries(r.c).map(([matKey, qty]) => (
                              <span key={matKey} className="text-[7.5px] text-zinc-400 flex items-center gap-0.5 bg-black/40 px-1 rounded-sm shrink-0">
                                <span>{IT[matKey]?.ico || '📦'}</span>
                                <span className="font-sans font-bold">{qty}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-2 text-[8px] text-zinc-500 uppercase tracking-wider font-mono">
                    No quick recipes can be forged. Collect materials to craft here!
                  </div>
                )}
              </motion.div>
            );
          })()}

          {/* Visual Vital Status Progress HUD (Health, Hunger, Thirst, Mana) */}
          <div className="bg-zinc-950/90 border border-white/10 p-3 px-4 rounded-2xl backdrop-blur-md shadow-2xl grid grid-cols-2 gap-x-5 gap-y-2 select-none w-[360px] md:w-[450px] relative">
            {/* Health Bar */}
            <div className={`flex-1 flex flex-col gap-0.5 relative transition-all duration-300 ${flashHp ? 'scale-[1.05]' : 'scale-100'}`}>
              <div className="flex justify-between items-center text-[9px] font-bold">
                <span className="text-red-400 flex items-center gap-0.5">❤️ HP</span>
                <span className="text-red-200">{Math.floor(gameState?.pl.hp || 0)}</span>
              </div>
              <div className={`w-full h-2.5 bg-black/50 rounded-full overflow-hidden border border-white/5 p-0.5 relative ${flashHp ? 'ring-2 ring-red-500 shadow-[0_0_12px_rgba(239,68,68,0.5)]' : ''}`}>
                <div 
                  className="h-full bg-gradient-to-r from-red-600 to-rose-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(0, Math.min(100, ((gameState?.pl.hp || 0) / (gameState?.pl.mhp || 100)) * 100))}%` }}
                />
              </div>
              {/* Floating hp indicator changes */}
              <div className="absolute right-0 -top-5 flex flex-col items-end pointer-events-none overflow-visible">
                <AnimatePresence>
                  {statChanges.filter(c => c.type === 'hp').map((c, idx) => (
                    <motion.span
                      key={`${c.id}-${idx}`}
                      initial={{ opacity: 0, y: 10, scale: 0.8 }}
                      animate={{ opacity: 1, y: -15, scale: 1.1 }}
                      exit={{ opacity: 0, y: -30, scale: 0.9 }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className={`text-[10px] font-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] ${c.delta > 0 ? 'text-emerald-400' : 'text-red-500'}`}
                    >
                      {c.delta > 0 ? `+${c.delta} 💚` : `${c.delta} 💔`}
                    </motion.span>
                  ))}
                </AnimatePresence>
              </div>
            </div>

            {/* Mana Bar */}
            <div className={`flex-1 flex flex-col gap-0.5 relative transition-all duration-300 ${flashMp ? 'scale-[1.05]' : 'scale-100'}`}>
              <div className="flex justify-between items-center text-[9px] font-bold">
                <span className="text-purple-400 flex items-center gap-0.5">🔮 MANA</span>
                <span className="text-purple-200">{Math.floor(gameState?.pl.mp ?? 100)}</span>
              </div>
              <div className={`w-full h-2.5 bg-black/50 rounded-full overflow-hidden border border-white/5 p-0.5 relative ${flashMp ? 'ring-2 ring-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.5)]' : ''}`}>
                <div 
                  className="h-full bg-gradient-to-r from-purple-600 to-indigo-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(0, Math.min(100, ((gameState?.pl.mp || 0) / (gameState?.pl.mmp || 100)) * 100))}%` }}
                />
              </div>
              {/* Floating mp indicator changes */}
              <div className="absolute right-0 -top-5 flex flex-col items-end pointer-events-none overflow-visible">
                <AnimatePresence>
                  {statChanges.filter(c => c.type === 'mp').map((c, idx) => (
                    <motion.span
                      key={`${c.id}-${idx}`}
                      initial={{ opacity: 0, y: 10, scale: 0.8 }}
                      animate={{ opacity: 1, y: -15, scale: 1.1 }}
                      exit={{ opacity: 0, y: -30, scale: 0.9 }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className={`text-[10px] font-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] ${c.delta > 0 ? 'text-emerald-400' : 'text-purple-400'}`}
                    >
                      {c.delta > 0 ? `+${c.delta} 🔮` : `${c.delta} ✨`}
                    </motion.span>
                  ))}
                </AnimatePresence>
              </div>
            </div>

            {/* Hunger Bar */}
            <div className={`flex-1 flex flex-col gap-0.5 relative transition-all duration-300 ${flashHu ? 'scale-[1.05]' : 'scale-100'}`}>
              <div className="flex justify-between items-center text-[9px] font-bold">
                <span className="text-amber-400 flex items-center gap-0.5">🍖 HUNGER</span>
                <span className="text-amber-200">{Math.floor(gameState?.pl.hu ?? 100)}%</span>
              </div>
              <div className={`w-full h-2.5 bg-black/50 rounded-full overflow-hidden border border-white/5 p-0.5 relative ${flashHu ? 'ring-2 ring-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.5)]' : ''}`}>
                <div 
                  className="h-full bg-gradient-to-r from-amber-600 to-yellow-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(0, Math.min(100, (gameState?.pl.hu ?? 100)))}%` }}
                />
              </div>
              {/* Floating hunger indicator changes */}
              <div className="absolute right-0 -top-5 flex flex-col items-end pointer-events-none overflow-visible">
                <AnimatePresence>
                  {statChanges.filter(c => c.type === 'hu').map((c, idx) => (
                    <motion.span
                      key={`${c.id}-${idx}`}
                      initial={{ opacity: 0, y: 10, scale: 0.8 }}
                      animate={{ opacity: 1, y: -15, scale: 1.1 }}
                      exit={{ opacity: 0, y: -30, scale: 0.9 }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className={`text-[10px] font-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] ${c.delta > 0 ? 'text-emerald-400' : 'text-amber-500'}`}
                    >
                      {c.delta > 0 ? `+${c.delta} 🍖` : `${c.delta} 🍗`}
                    </motion.span>
                  ))}
                </AnimatePresence>
              </div>
            </div>

            {/* Thirst Bar */}
            <div className={`flex-1 flex flex-col gap-0.5 relative transition-all duration-300 ${flashTh ? 'scale-[1.05]' : 'scale-100'}`}>
              <div className="flex justify-between items-center text-[9px] font-bold">
                <span className="text-sky-400 flex items-center gap-0.5">💧 THIRST</span>
                <span className="text-sky-200">{Math.floor(gameState?.pl.th ?? 100)}%</span>
              </div>
              <div className={`w-full h-2.5 bg-black/50 rounded-full overflow-hidden border border-white/5 p-0.5 relative ${flashTh ? 'ring-2 ring-sky-500 shadow-[0_0_12px_rgba(14,165,233,0.5)]' : ''}`}>
                <div 
                  className="h-full bg-gradient-to-r from-sky-600 to-cyan-400 rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(0, Math.min(100, (gameState?.pl.th ?? 100)))}%` }}
                />
              </div>
              {/* Floating thirst indicator changes */}
              <div className="absolute right-0 -top-5 flex flex-col items-end pointer-events-none overflow-visible">
                <AnimatePresence>
                  {statChanges.filter(c => c.type === 'th').map((c, idx) => (
                    <motion.span
                      key={`${c.id}-${idx}`}
                      initial={{ opacity: 0, y: 10, scale: 0.8 }}
                      animate={{ opacity: 1, y: -15, scale: 1.1 }}
                      exit={{ opacity: 0, y: -30, scale: 0.9 }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className={`text-[10px] font-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] ${c.delta > 0 ? 'text-emerald-400' : 'text-sky-400'}`}
                    >
                      {c.delta > 0 ? `+${c.delta} 💧` : `${c.delta} 🥵`}
                    </motion.span>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {gameState?.pl.hotbar[hotSlot] && (() => {
            const key = gameState.pl.hotbar[hotSlot];
            const stats = getWeaponStats(gameState, key);
            return (
              <div className="bg-black/85 border border-white/10 px-3 py-1.5 rounded-full text-[11px] backdrop-blur-md text-gray-300 font-mono tracking-tight flex items-center justify-center gap-2 shadow-xl max-w-sm whitespace-nowrap animate-fadeIn">
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

          <div className={`flex flex-col items-center gap-1.5 bg-black/90 p-2.5 rounded-2xl border backdrop-blur-md transition-all duration-300 ${
            showInv 
              ? 'border-green-500/40 shadow-[0_0_24px_rgba(34,197,94,0.15)] bg-zinc-950/95' 
              : 'border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.6)]'
          }`}>
            <div className="flex gap-1">
              {gameState?.pl.hotbar.map((item: string, i: number) => {
                const isDraggedOver = draggedOverSlot === i;
                const hasQty = (gameState.pl.inv[item] || 0) > 0;
                return (
                  <button
                    key={i}
                    draggable={!!item}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("hotbar-index", String(i));
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (draggedOverSlot !== i) setDraggedOverSlot(i);
                    }}
                    onDragLeave={() => {
                      setDraggedOverSlot(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleHotbarDrop(e, i);
                    }}
                    onClick={() => handleHotbarClick(i)}
                    onDoubleClick={() => handleHotbarDoubleClick(i)}
                    className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center relative transition-all duration-200 border cursor-pointer select-none group ${
                      isDraggedOver 
                        ? 'border-yellow-400 bg-yellow-500/30 scale-110 shadow-[0_0_12px_rgba(234,179,8,0.5)] z-10' 
                        : hotSlot === i 
                          ? 'bg-green-500/20 border-green-400 shadow-[0_0_10px_rgba(34,197,94,0.3)] scale-[1.03]' 
                          : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.08] hover:border-white/20 hover:scale-[1.02]'
                    }`}
                    title={item ? `${IT[item]?.n || item} (Slot ${i + 1}) - Drag to swap, click active to use/equip` : `Empty Slot ${i + 1}`}
                  >
                    {item ? (
                      <>
                        <span className={`text-xl transition-transform duration-200 ${hotSlot === i ? 'scale-110' : 'group-hover:scale-[1.08]'}`}>
                          {IT[item]?.ico || '?'}
                        </span>
                        <span className={`absolute bottom-1 right-1 text-[8px] font-extrabold px-0.5 rounded leading-none ${
                          hasQty ? 'text-green-400 bg-black/60' : 'text-red-400 bg-black/60 opacity-60 line-through'
                        }`}>
                          x{gameState.pl.inv[item] || 0}
                        </span>
                      </>
                    ) : (
                      <span className="text-[10px] text-zinc-600/40">➕</span>
                    )}
                    <span className="absolute top-1 left-1.5 text-[7px] opacity-45 font-mono font-bold">{i + 1}</span>
                  </button>
                );
              })}
            </div>

            {/* Quick access status / guide label */}
            <span className="text-[7.5px] font-mono tracking-wider opacity-50 uppercase text-zinc-400 select-none text-center px-2">
              {showInv 
                ? '🖐️ Hover over backpack items + press [1-8] to instantly bind • Drag slots to swap'
                : '⚡ Press [1-8] key to switch slots and equip/use • Click active slot to use'
              }
            </span>
          </div>
        </div>
      )}

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
          onClick={handleDrinkWater}
          className="w-14 h-14 rounded-full bg-blue-900/40 border border-blue-500/30 flex flex-col items-center justify-center hover:bg-blue-800/40 active:scale-95 transition-all shadow-lg text-white cursor-pointer"
          title="Drink clean water when standing adjacent to water source"
        >
          <Droplets size={20} className="text-blue-400 animate-pulse" />
          <span className="text-[8px] mt-1 text-blue-400/85 font-bold tracking-wider">DRINK</span>
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
            onClick={handleDrinkWater}
            className="w-11 h-11 rounded-full bg-blue-900/40 border border-blue-500/30 flex flex-col items-center justify-center hover:bg-blue-800/40 active:scale-95 transition-all shadow-md text-white cursor-pointer"
            title="Drink from nearby water"
          >
            <Droplets size={16} className="text-blue-400 animate-pulse" />
            <span className="text-[7px] mt-0.5 text-blue-400 font-bold">DRINK</span>
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
        {showTownHub && (
          <motion.div 
            key="town-hub-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 flex flex-col font-mono"
          >
            {/* Header */}
            <div className="p-4 sm:p-6 flex justify-between items-center border-b border-white/10 shrink-0">
              <h2 className="text-xl font-bold tracking-widest text-green-400 flex items-center gap-2">
                🏘️ {gameState?.pl.townName || 'Camp Horizon'} Town Management
              </h2>
              <button 
                onClick={() => setShowTownHub(false)} 
                className="p-2 hover:bg-white/10 rounded-full cursor-pointer transition-all active:scale-95 text-zinc-400 hover:text-white"
              >
                <X />
              </button>
            </div>

            {/* Content body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              
              {/* Town Naming and Level Section */}
              <div className="bg-zinc-900/60 border border-white/10 p-4 sm:p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <label className="text-[10px] text-green-400 font-extrabold tracking-widest uppercase">Settlement Name</label>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      value={customTownName}
                      onChange={(e) => setCustomTownName(e.target.value)}
                      maxLength={24}
                      className="bg-black/50 border border-white/10 hover:border-white/20 focus:border-green-400/80 rounded-xl px-3 py-2 text-white font-bold tracking-wide outline-none flex-1 max-w-sm text-sm"
                    />
                    <button 
                      onClick={() => {
                        const s = stateRef.current;
                        if (s && s.pl) {
                          s.pl.townName = customTownName || 'Camp Horizon';
                          addLog(`🏘️ Settlement successfully renamed to: "${s.pl.townName}"`, '#10b981');
                          setGameState({ ...s });
                        }
                      }}
                      className="px-4 py-2 bg-green-500 hover:bg-green-400 text-black font-black uppercase text-xs tracking-wider rounded-xl cursor-pointer transition-all active:scale-95 shadow-lg shadow-green-500/10"
                    >
                      Save Name
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-4 bg-black/40 border border-white/5 p-4 rounded-xl">
                  <div className="text-3xl">🏘️</div>
                  <div>
                    <div className="text-[10px] text-zinc-400 uppercase font-extrabold tracking-widest">Town Status</div>
                    <div className="text-sm font-black text-white">
                      {(() => {
                        const s = stateRef.current;
                        if (!s) return 'Wilderness Camp (LVL 1)';
                        const count = s.objs.filter((o: any) => ['settler_shelter', 'town_house', 'town_workshop', 'storage_depot', 'merchant_stall', 'guard_post', 'farm_plot'].includes(o.type)).length;
                        if (count >= 9) return 'Survival Citadel (LVL 4)';
                        if (count >= 5) return 'Thriving Village (LVL 3)';
                        if (count >= 2) return 'Budding Hamlet (LVL 2)';
                        return 'Wilderness Camp (LVL 1)';
                      })()}
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      Based on placed town structures (Total: {
                        gameState?.objs.filter((o: any) => ['settler_shelter', 'town_house', 'town_workshop', 'storage_depot', 'merchant_stall', 'guard_post', 'farm_plot'].includes(o.type)).length || 0
                      })
                    </div>
                  </div>
                </div>
              </div>

              {/* Statistics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-zinc-900/40 border border-white/5 p-4 rounded-2xl flex items-center gap-3">
                  <span className="text-2xl">🪙</span>
                  <div>
                    <div className="text-[9px] text-zinc-400 uppercase font-bold tracking-wider">Treasury Coins</div>
                    <div className="text-base font-black text-yellow-400">{gameState?.pl.inv.gold_coins || 0}</div>
                  </div>
                </div>
                <div className="bg-zinc-900/40 border border-white/5 p-4 rounded-2xl flex items-center gap-3">
                  <span className="text-2xl">🛖</span>
                  <div>
                    <div className="text-[9px] text-zinc-400 uppercase font-bold tracking-wider">Town Cabins</div>
                    <div className="text-base font-black text-white">{gameState?.objs.filter((o: any) => o.type === 'settler_shelter').length || 0}</div>
                  </div>
                </div>
                <div className="bg-zinc-900/40 border border-white/5 p-4 rounded-2xl flex items-center gap-3">
                  <span className="text-2xl">🏪</span>
                  <div>
                    <div className="text-[9px] text-zinc-400 uppercase font-bold tracking-wider">Trading Stalls</div>
                    <div className="text-base font-black text-white">{gameState?.objs.filter((o: any) => o.type === 'merchant_stall').length || 0}</div>
                  </div>
                </div>
                <div className="bg-zinc-900/40 border border-white/5 p-4 rounded-2xl flex items-center gap-3">
                  <span className="text-2xl">🧑‍🌾</span>
                  <div>
                    <div className="text-[9px] text-zinc-400 uppercase font-bold tracking-wider">Villager Companions</div>
                    <div className="text-base font-black text-green-400">
                      {gameState?.companions.filter((c: any) => c.role).length || 0}
                    </div>
                  </div>
                </div>
              </div>

              {/* Town Structures Blueprint Section */}
              <div className="space-y-3">
                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 border-b border-white/10 pb-1.5 flex items-center gap-1.5">
                  📐 Settlement Construction Blueprints
                </h3>
                <p className="text-[11px] text-zinc-500 leading-relaxed max-w-4xl">
                  Craft and place these buildings in your active zone to establish a thriving town. Hotbar-equip them and click the ground nearby to construct! Each placed building earns passive income or resources every few seconds.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
                  {[
                    { id: 'settler_shelter', n: 'Settler Shelter', ico: '🛖', desc: 'Rustic survival cabin. Attracts basic settlers. Generates +2 Gold Coins passively.', cost: '🪵15 Wood, 🪨10 Stone, 🌿10 Fiber' },
                    { id: 'town_house', n: 'Town House', ico: '🏡', desc: 'A comfortable family residence. Attracts workers and residents. Earns +6 Gold Coins passively.', cost: '🪵30 Wood, 🪨20 Stone, 🌿15 Fiber, 🪙100 Coins' },
                    { id: 'town_workshop', n: 'Town Workshop', ico: '🏭', desc: 'Advanced manufacturing center. Automatically crafts +1 Iron Bar over time.', cost: '🪨35 Stone, 🔩8 Iron Bars, 🪵20 Wood' },
                    { id: 'storage_depot', n: 'Storage Depot', ico: '🏬', desc: 'Massive resource log depot. Gathers +2 Wood, +2 Stone, and +2 Fiber over time.', cost: '🪵40 Wood, 🪨30 Stone, 🔩4 Iron Bars' },
                    { id: 'merchant_stall', n: 'Merchant Stall', ico: '🏪', desc: 'Trading post for local travelers. Generates +5 Gold Coins passively.', cost: '🪵20 Wood, 🌿15 Fiber, 🪙150 Coins' },
                    { id: 'guard_post', n: 'Guard Post', ico: '🛡️', desc: 'Defensive post with lookouts. Boosts zone security. Spawns high health guards.', cost: '🪨20 Stone, 🔩5 Iron Bars, 🪵10 Wood' },
                    { id: 'farm_plot', n: 'Farm Plot', ico: '🌾', desc: 'Irrigated soil garden. Automatically produces +1 Berry over time.', cost: '🪵8 Wood, 🌿12 Fiber, 🫐5 Berries' },
                  ].map((b) => {
                    const count = gameState?.objs.filter((o: any) => o.type === b.id).length || 0;
                    return (
                      <div key={b.id} className="bg-zinc-900/50 border border-white/5 hover:border-white/10 p-4 rounded-2xl space-y-2.5 flex flex-col justify-between">
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center">
                            <span className="text-2xl">{b.ico}</span>
                            <span className="text-[9px] bg-green-500/10 text-green-400 font-bold px-1.5 py-0.5 rounded-md">
                              {count} Placed
                            </span>
                          </div>
                          <h4 className="font-extrabold text-sm text-white">{b.n}</h4>
                          <p className="text-[10px] text-zinc-400 leading-normal">{b.desc}</p>
                        </div>
                        <div className="space-y-1 pt-1.5 border-t border-white/5">
                          <div className="text-[8px] uppercase tracking-wider text-zinc-500 font-bold">Crafting Cost</div>
                          <div className="text-[9px] text-amber-500 font-bold">{b.cost}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recruitment Section */}
              <div className="space-y-3">
                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 border-b border-white/10 pb-1.5 flex items-center gap-1.5">
                  🤝 Recruit Settlement Villager Companions
                </h3>
                <p className="text-[11px] text-zinc-500 leading-relaxed max-w-4xl">
                  Invite specialized survivors to move into your town and join your active survival party. They will follow you on the map, fight monsters, collect raw resources, or heal your wounds depending on their role!
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
                  {[
                    {
                      role: 'guard',
                      name: 'Town Militia',
                      ico: '🛡️',
                      desc: 'Defensive melee fighter. Attacks nearby monsters with high health (120 HP) and heavy armor.',
                      costDisplay: '🪙 100 Gold Coins, 🪨 15 Stone',
                      cost: { gold_coins: 100, stone: 15 },
                      hp: 120, dmg: 12, spd: 1.8
                    },
                    {
                      role: 'hunter',
                      name: 'Ranger Guard',
                      ico: '🏹',
                      desc: 'Ranged bow sniper. Attacks targets from a distance with high precision arrow damage (15 DMG).',
                      costDisplay: '🪙 150 Gold Coins, 🪵 10 Wood',
                      cost: { gold_coins: 150, wood: 10 },
                      hp: 80, dmg: 15, spd: 2.1
                    },
                    {
                      role: 'gatherer',
                      name: 'Scavenger',
                      ico: '🧑‍🌾',
                      desc: 'Resource harvester. Follows you and automatically gathers wood, stone, flint, and fiber every 10 seconds.',
                      costDisplay: '🪙 80 Gold Coins, 🫐 10 Berries',
                      cost: { gold_coins: 80, berry: 10 },
                      hp: 60, dmg: 5, spd: 2.0
                    },
                    {
                      role: 'alchemist',
                      name: 'Hedge Alchemist',
                      ico: '🧙‍♀️',
                      desc: 'Healer/Supporter. Casts protective spells to restore +20 HP whenever your health drops below 60%.',
                      costDisplay: '🪙 200 Gold Coins, 💎 5 Crystal',
                      cost: { gold_coins: 200, crystal: 5 },
                      hp: 70, dmg: 8, spd: 1.9
                    },
                  ].map((v) => {
                    const hasGold = (gameState?.pl.inv.gold_coins || 0) >= (v.cost.gold_coins || 0);
                    const additionalKey = Object.keys(v.cost).find(k => k !== 'gold_coins') || '';
                    const hasAdditional = !additionalKey || (gameState?.pl.inv[additionalKey] || 0) >= (v.cost[additionalKey] || 0);
                    const canAfford = hasGold && hasAdditional;

                    return (
                      <div key={v.name} className="bg-zinc-900/50 border border-white/5 hover:border-white/10 p-4 rounded-2xl flex flex-col justify-between space-y-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{v.ico}</span>
                            <div>
                              <h4 className="font-extrabold text-sm text-white">{v.name}</h4>
                              <span className="text-[8px] bg-purple-500/10 text-purple-400 px-1 py-0.2 rounded font-bold uppercase tracking-wider">
                                {v.role}
                              </span>
                            </div>
                          </div>
                          <p className="text-[10px] text-zinc-400 leading-normal">{v.desc}</p>
                        </div>

                        <div className="space-y-2.5">
                          <div className="pt-2 border-t border-white/5 space-y-1">
                            <div className="text-[8px] uppercase tracking-wider text-zinc-500 font-bold">Recruit Fee</div>
                            <div className="text-[10px] text-yellow-400 font-bold font-mono">{v.costDisplay}</div>
                          </div>
                          <button 
                            onClick={() => recruitVillager(v.role, v.cost, v.name, v.ico, v.spd, v.dmg, v.hp)}
                            disabled={!canAfford}
                            className={`w-full py-2 text-xs font-black uppercase tracking-wider rounded-xl cursor-pointer transition-all active:scale-95 text-center ${
                              canAfford 
                                ? 'bg-green-500 hover:bg-green-400 text-black shadow-lg shadow-green-500/15' 
                                : 'bg-zinc-800 text-zinc-500 border border-white/5 cursor-not-allowed'
                            }`}
                          >
                            {canAfford ? `Hire ${v.name}` : 'Cannot Afford'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </motion.div>
        )}

        {showCharCustomizer && (
          <motion.div 
            key="char-customizer-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 flex flex-col font-mono"
          >
            <div className="p-4 sm:p-6 flex justify-between items-center border-b border-white/10 shrink-0">
              <h2 className="text-xl font-bold tracking-widest text-purple-400 flex items-center gap-2">
                👤 Customize Character Style & Professional Class
              </h2>
              <button 
                onClick={() => setShowCharCustomizer(false)} 
                className="p-2 hover:bg-white/10 rounded-full cursor-pointer transition-all active:scale-95 text-zinc-400 hover:text-white"
              >
                <X />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              {(() => {
                const s = stateRef.current;
                if (!s) return null;
                return <CharCustomizerPanel s={s} onClose={() => setShowCharCustomizer(false)} />;
              })()}
            </div>
          </motion.div>
        )}

        {showInv && (
          <motion.div 
            key="inventory-modal"
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
              <div className="w-full md:w-1/4 flex flex-col gap-4 overflow-y-auto bg-zinc-950/60 border border-white/10 rounded-2xl p-4 pb-28 shrink-0">
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
                    { slot: 'back', n: 'Backpack', ico: '🎒' },
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
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold tracking-widest text-green-400 uppercase flex items-center gap-1">
                      🎒 BACKPACK ITEMS
                    </h3>
                    {user && (
                      <button
                        onClick={handleSyncCloudInventory}
                        disabled={isCloudSyncing}
                        className="px-2 py-0.5 rounded-md bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 text-sky-400 text-[8px] font-extrabold tracking-wider uppercase transition-all flex items-center gap-1 shrink-0 cursor-pointer active:scale-95 disabled:opacity-50 animate-pulse"
                        title="Synchronize and retrieve all owned items and NFTs from the secure Firebase Cloud Firestore database!"
                      >
                        {isCloudSyncing ? "⏳ Syncing..." : "🔄 Sync Cloud Inventory"}
                      </button>
                    )}
                  </div>
                  
                  {/* Tabs */}
                  <div className="flex flex-wrap gap-1">
                    {[
                      { id: 'all', n: '🎒 All' },
                      { id: 'weapon', n: '⚔️ Gear' },
                      { id: 'armor', n: '🛡️ Armor' },
                      { id: 'food', n: '🧪 Consumables' },
                      { id: 'mat', n: '🪵 Materials' },
                      { id: 'nft', n: '💎 NFTs' },
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
                <div className="flex-1 overflow-y-auto pr-1 pb-28">
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
                              onMouseEnter={() => setHoveredItem(k)}
                              onMouseLeave={() => setHoveredItem(null)}
                              draggable={true}
                              onDragStart={(e) => {
                                e.dataTransfer.setData("text/plain", k);
                                e.dataTransfer.effectAllowed = "move";
                              }}
                              className={`relative bg-white/[0.02] border rounded-xl p-3 flex flex-col items-center gap-1.5 transition-all cursor-grab active:cursor-grabbing group hover:bg-white/[0.05] ${
                                isSelected 
                                  ? 'border-green-400 bg-green-500/10 shadow-[0_0_12px_rgba(34,197,94,0.15)] scale-[1.02]' 
                                  : 'border-white/5 hover:border-white/10'
                              }`}
                              title="Drag down to Hotbar or hover & press 1-8 to bind, click to inspect"
                            >
                              <div className="absolute inset-0 bg-black/80 rounded-xl flex flex-col items-center justify-center text-[8px] text-yellow-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none uppercase tracking-wider text-center p-1 z-10">
                                <span>Press 1-8</span>
                                <span className="opacity-60 text-[7px] mt-0.5 font-normal normal-case text-zinc-300">to bind to slot</span>
                              </div>
                              <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-60 transition-opacity text-[8px] text-zinc-400 select-none">
                                ☰
                              </div>
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
              <div className="w-full md:w-1/3 xl:w-1/4 flex flex-col bg-zinc-950/60 border border-white/10 rounded-2xl p-4 pb-28 overflow-y-auto shrink-0 animate-fadeIn">
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
                      {/* Beautiful Holographic Collectible Art */}
                      <NFTCollectibleArt item={{ ...it, id: selectedInvItem }} />

                      {/* Logo and Name header */}
                      <div className="flex items-center gap-3 bg-white/[0.02] border border-white/5 p-3 rounded-xl">
                        <span className="text-4xl bg-white/5 p-2 rounded-xl border border-white/5">{it.ico}</span>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-black text-white truncate">{it.n}</span>
                          <span className="text-[8px] tracking-wider text-zinc-400 uppercase mt-0.5 leading-none">
                            {it.t === 'armor' ? `🛡️ Body Armor (${it.sl})` : 
                             it.t === 'tool' || it.t === 'weapon' || it.id ? '⚔️ Weapon / Tool' :
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
                        {(it.id || it.t === 'tool' || it.t === 'weapon') && (
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
                            {it.t === 'food' ? (
                              <div className="flex justify-between">
                                <span className="opacity-50">HP Restored:</span>
                                <span className="font-bold text-rose-400">+{ (it.hp || 0) + (it.hu || 0) } HP</span>
                              </div>
                            ) : (
                              it.hp && (
                                <div className="flex justify-between">
                                  <span className="opacity-50">HP Restored:</span>
                                  <span className="font-bold text-rose-400">+{it.hp} HP</span>
                                </div>
                              )
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

                      {it.desc && (
                        <div className="bg-white/[0.02] border border-white/5 p-3 rounded-xl text-[10px] text-zinc-300 leading-relaxed">
                          <span className="text-[9px] text-zinc-500 font-bold block uppercase tracking-wider mb-1">📜 Relic Lore</span>
                          "{it.desc}"
                        </div>
                      )}

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
                          (it.t === 'armor' || it.t === 'weapon' || it.id || it.t === 'tool' || it.t === 'food' || it.t === 'pot' || selectedInvItem === 'mana_crystal') && (
                            <button
                              onClick={() => {
                                handleUse(selectedInvItem);
                              }}
                              className="w-full py-2.5 bg-green-500 hover:bg-green-400 text-black rounded-xl text-xs font-black uppercase transition-all active:scale-[0.98] cursor-pointer text-center shadow-lg shadow-green-500/10"
                            >
                              {it.t === 'armor' ? '🛡️ Equip Armor' : 
                               it.t === 'weapon' || it.id || it.t === 'tool' ? '⚔️ Equip Weapon' : '🧪 Consume / Use'}
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
      </AnimatePresence>

      {/* --- Beautiful Narrative / Lore Discovery Modal --- */}
      <AnimatePresence>
        {activeLore && (
          <motion.div 
            key="lore-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 font-mono pointer-events-auto"
          >
              <motion.div 
                initial={{ scale: 0.95, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: -15 }}
                className="relative max-w-xl w-full bg-amber-950/20 border border-amber-500/30 rounded-3xl p-6 sm:p-8 flex flex-col gap-6 shadow-[0_0_50px_rgba(245,158,11,0.15)] text-amber-100 overflow-hidden"
                style={{
                  background: 'radial-gradient(circle at center, #1c130c 0%, #0a0604 100%)'
                }}
              >
                {/* Vintage Scroll Border Decor */}
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
                <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-transparent via-amber-500/20 to-transparent" />
                <div className="absolute inset-y-0 right-0 w-1 bg-gradient-to-b from-transparent via-amber-500/20 to-transparent" />

                {/* Header */}
                <div className="flex justify-between items-center border-b border-amber-500/20 pb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">
                      {activeLore.type === 'journal' ? '📓' : activeLore.type === 'carving' ? '🗿' : '🌀'}
                    </span>
                    <div>
                      <h3 className="text-xs uppercase tracking-widest text-amber-500 font-extrabold">Ancient Fragment Found</h3>
                      <h2 className="text-sm sm:text-base font-bold text-amber-200 mt-0.5">{activeLore.title}</h2>
                    </div>
                  </div>
                  <button 
                    onClick={() => setActiveLore(null)}
                    className="w-8 h-8 rounded-full bg-white/5 border border-amber-500/10 flex items-center justify-center hover:bg-amber-500/20 active:scale-95 transition-all cursor-pointer text-amber-300"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Content with beautiful typewriter-style serif aesthetic */}
                <div className="flex-1 py-2 font-serif text-sm sm:text-base italic leading-relaxed text-amber-100/90 whitespace-pre-line tracking-wide relative">
                  <div className="absolute -left-3 -top-3 text-5xl text-amber-500/10 select-none font-serif">“</div>
                  <p className="px-4 py-2 bg-amber-950/10 border-l border-amber-500/20 rounded-r-xl">
                    {activeLore.text}
                  </p>
                </div>

                {/* Guidance / Hint */}
                {activeLore.hint && (
                  <div className="bg-amber-950/40 border border-amber-500/15 p-4 rounded-xl text-xs text-amber-400/80 leading-relaxed font-sans">
                    <span className="font-extrabold text-amber-500 block uppercase tracking-wider mb-1">🔍 Oracle Guidance</span>
                    {activeLore.hint}
                  </div>
                )}

                {/* Rewards Summary */}
                <div className="bg-black/40 border border-amber-500/10 rounded-2xl p-4 flex justify-between items-center text-xs">
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] text-amber-500/60 uppercase tracking-widest font-bold">Rewards Earned</span>
                    <div className="flex gap-2 flex-wrap mt-0.5">
                      {activeLore.xpBonus && (
                        <span className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 px-2 py-0.5 rounded-lg text-[10px] font-bold">
                          +{activeLore.xpBonus} Player XP
                        </span>
                      )}
                      {activeLore.xpSkill && (
                        <span className="bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase">
                          +{activeLore.xpBonus} {activeLore.xpSkill} XP
                        </span>
                      )}
                      {activeLore.rewardItem && (
                        <span className="bg-green-500/10 border border-green-500/20 text-green-400 px-2 py-0.5 rounded-lg text-[10px] font-bold">
                          +{IT[activeLore.rewardItem]?.n || activeLore.rewardItem} x{activeLore.rewardQty}
                        </span>
                      )}
                    </div>
                  </div>
                  <button 
                    onClick={() => setActiveLore(null)}
                    className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs tracking-widest uppercase rounded-xl transition-all active:scale-95 cursor-pointer shadow-lg shadow-amber-500/10"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      <AnimatePresence>
        {showRecipeBook && (
          <motion.div 
            key="recipe-book-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 flex flex-col font-mono"
          >
            <div className="p-6 flex justify-between items-center border-b border-white/10 shrink-0">
              <h2 className="text-xl font-bold tracking-widest text-amber-400 flex items-center gap-2">
                <Book className="text-amber-400" /> CHRONICLES OF DISCOVERY & RECIPES
              </h2>
              <button onClick={() => setShowRecipeBook(false)} className="p-2 hover:bg-white/10 rounded-full cursor-pointer transition-all text-white">
                <X />
              </button>
            </div>

            <div className="flex-1 p-6 overflow-y-auto max-w-5xl mx-auto w-full flex flex-col gap-6">
              {/* Stat Cards & Explainer Banner */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-zinc-950 border border-amber-500/20 rounded-2xl flex flex-col justify-center">
                  <div className="text-[10px] uppercase opacity-40 font-bold tracking-wider">Formulae Decoded</div>
                  <div className="text-2xl font-bold text-amber-400 mt-1 flex items-baseline gap-2">
                    {recipes.filter(r => r.discovered).length} <span className="text-xs opacity-50">/ {recipes.length}</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 ml-auto">{Math.round((recipes.filter(r => r.discovered).length / recipes.length) * 100)}%</span>
                  </div>
                </div>

                <div className="p-4 bg-zinc-950 border border-amber-500/20 rounded-2xl flex flex-col justify-center">
                  <div className="text-[10px] uppercase opacity-40 font-bold tracking-wider">Total Items Crafted</div>
                  <div className="text-2xl font-bold text-yellow-400 mt-1 flex items-baseline gap-2">
                    {recipes.reduce((sum, r) => sum + (r.craftCount || 0), 0)} <span className="text-xs opacity-50">items</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-300 ml-auto">Master Artisan</span>
                  </div>
                </div>

                <div className="p-4 bg-zinc-950 border border-teal-500/20 rounded-2xl flex flex-col justify-center">
                  <div className="text-[10px] uppercase opacity-40 font-bold tracking-wider">Explored Zones</div>
                  <div className="text-2xl font-bold text-teal-400 mt-1 flex items-baseline gap-2">
                    {gameState?.exploredSectors?.length || 1} <span className="text-xs opacity-50">sectors</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-teal-500/10 text-teal-300 ml-auto">Voyager</span>
                  </div>
                </div>
              </div>

              {/* Explainer / Guide Banner */}
              <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/20 text-xs text-amber-300/90 leading-relaxed">
                💡 <span className="font-bold text-amber-400">Survivalist Clue:</span> Discover rare crafting formulas by stepping onto new procedural biome sectors across the world map, or by unearthing glowing <span className="text-purple-400 font-bold">Lore Nodes 📜</span> hidden in dangerous ruins.
              </div>

              {/* Filter Bar */}
              <div className="bg-zinc-950 border border-white/10 p-4 rounded-2xl flex flex-col gap-4">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 text-zinc-500" size={16} />
                  <input
                    type="text"
                    placeholder="Search discovered recipes by name or materials..."
                    value={recipeSearch}
                    onChange={(e) => setRecipeSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-zinc-900/60 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                  {recipeSearch && (
                    <button 
                      onClick={() => setRecipeSearch('')}
                      className="absolute right-3 top-2 text-zinc-400 hover:text-white"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Categories Tabs */}
                <div className="flex flex-wrap gap-1.5 border-b border-white/5 pb-1">
                  {['All', 'Weapons', 'Armor', 'Food', 'Potions', 'Materials', 'Structures'].map(cat => (
                    <button
                      key={cat}
                      onClick={() => setRecipeFilter(cat)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                        recipeFilter === cat 
                          ? 'bg-amber-500 text-black shadow-md' 
                          : 'bg-zinc-900 border border-white/5 text-zinc-400 hover:text-white hover:border-white/10'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid of Recipes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recipes.filter(r => {
                  if (recipeFilter !== 'All' && r.cat !== recipeFilter) return false;
                  if (recipeSearch.trim() !== '') {
                    const term = recipeSearch.toLowerCase();
                    if (r.discovered) {
                      const nameMatch = r.n.toLowerCase().includes(term);
                      const outputMatch = r.out.toLowerCase().includes(term);
                      const materialsMatch = Object.keys(r.c).some(m => (IT[m]?.n || m).toLowerCase().includes(term));
                      return nameMatch || outputMatch || materialsMatch;
                    } else {
                      return "locked".includes(term) || "???".includes(term);
                    }
                  }
                  return true;
                }).length > 0 ? (
                  recipes.filter(r => {
                    if (recipeFilter !== 'All' && r.cat !== recipeFilter) return false;
                    if (recipeSearch.trim() !== '') {
                      const term = recipeSearch.toLowerCase();
                      if (r.discovered) {
                        const nameMatch = r.n.toLowerCase().includes(term);
                        const outputMatch = r.out.toLowerCase().includes(term);
                        const materialsMatch = Object.keys(r.c).some(m => (IT[m]?.n || m).toLowerCase().includes(term));
                        return nameMatch || outputMatch || materialsMatch;
                      } else {
                        return "locked".includes(term) || "???".includes(term);
                      }
                    }
                    return true;
                  }).map((rc, idx) => {
                    const itemDef = IT[rc.out];
                    const discovered = rc.discovered;

                    return (
                      <div 
                        key={rc.n + '-' + idx}
                        className={`p-5 rounded-2xl border transition-all duration-300 flex flex-col gap-4 relative overflow-hidden ${
                          discovered 
                            ? 'bg-zinc-950 border-white/10 hover:border-amber-500/35 hover:shadow-[0_0_20px_rgba(245,158,11,0.05)]' 
                            : 'bg-zinc-950/40 border-zinc-900 border-dashed text-zinc-500 opacity-75'
                        }`}
                      >
                        {discovered && rc.craftCount > 0 && (
                          <div className="absolute right-3 top-3 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[9px] text-emerald-400 font-bold uppercase tracking-wider">
                            Crafted {rc.craftCount}x
                          </div>
                        )}

                        <div className="flex items-start gap-3.5">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 ${
                            discovered 
                              ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400' 
                              : 'bg-zinc-900 border border-zinc-800 text-zinc-600'
                          }`}>
                            {discovered ? (itemDef?.ico || '📦') : '🔒'}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className={`font-bold text-sm truncate ${discovered ? 'text-white' : 'text-zinc-600 font-mono italic'}`}>
                                {discovered ? rc.n : '??? Locked Formula'}
                              </span>
                              {discovered && rc.req && (
                                <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400">
                                  {IT[rc.req]?.n || rc.req}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mt-0.5">
                              {rc.cat}
                            </div>
                          </div>
                        </div>

                        {/* Required Materials */}
                        <div className="bg-black/30 border border-white/[0.03] p-3 rounded-xl flex flex-col gap-2">
                          <div className="text-[9px] text-zinc-400 uppercase font-bold tracking-wider">Required Materials:</div>
                          <div className="grid grid-cols-2 gap-2 mt-1">
                            {Object.entries(rc.c).map(([mKey, reqQty]) => {
                              const matDef = IT[mKey];
                              const currentQty = gameState?.pl?.inv[mKey] || 0;
                              const hasEnough = currentQty >= (reqQty as number);
                              return (
                                <div 
                                  key={mKey}
                                  className="flex items-center justify-between text-xs font-mono p-1 rounded hover:bg-white/[0.02]"
                                >
                                  <span className={`truncate flex items-center gap-1.5 ${discovered ? 'text-zinc-300' : 'text-zinc-600'}`}>
                                    <span>{matDef?.ico || '▪️'}</span>
                                    <span>{discovered ? (matDef?.n || mKey) : '???'}</span>
                                  </span>
                                  <span className={`font-bold shrink-0 ${
                                    !discovered 
                                      ? 'text-zinc-700' 
                                      : hasEnough 
                                        ? 'text-emerald-400' 
                                        : 'text-red-400'
                                  }`}>
                                    {discovered ? `${currentQty}/${reqQty}` : `?/${reqQty}`}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Specs or Hints */}
                        {discovered ? (
                          <div className="text-xs text-zinc-400 leading-normal flex flex-wrap gap-x-4 gap-y-1.5 border-t border-white/5 pt-3 mt-auto font-sans">
                            {itemDef?.dmg !== undefined && (
                              <span className="font-mono text-[10px] text-yellow-400 font-bold bg-yellow-900/10 border border-yellow-500/20 px-2 py-0.5 rounded">
                                ⚔️ DMG: {itemDef.dmg}
                              </span>
                            )}
                            {itemDef?.def !== undefined && (
                              <span className="font-mono text-[10px] text-teal-400 font-bold bg-teal-900/10 border border-teal-500/20 px-2 py-0.5 rounded">
                                🛡️ DEF: {itemDef.def}
                              </span>
                            )}
                            {itemDef?.hpBonus !== undefined && (
                              <span className="font-mono text-[10px] text-emerald-400 font-bold bg-emerald-900/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                                ❤️ HP: +{itemDef.hpBonus}
                              </span>
                            )}
                            {itemDef?.mpBonus !== undefined && (
                              <span className="font-mono text-[10px] text-purple-400 font-bold bg-purple-900/10 border border-purple-500/20 px-2 py-0.5 rounded">
                                🔮 MP: +{itemDef.mpBonus}
                              </span>
                            )}
                            {itemDef?.spdBonus !== undefined && (
                              <span className="font-mono text-[10px] text-cyan-400 font-bold bg-cyan-900/10 border border-cyan-500/20 px-2 py-0.5 rounded">
                                ⚡ SPEED: +{itemDef.spdBonus}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="text-[10px] text-amber-500/60 leading-relaxed font-sans italic border-t border-dashed border-zinc-900 pt-3 mt-auto flex items-center gap-1.5">
                            🔍 Search unexplored biomes & activate lore relics to decode this blueprint.
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="col-span-1 md:col-span-2 py-12 text-center text-zinc-500 text-xs">
                    No recipes found matching current filters.
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-white/10 shrink-0 flex justify-end">
              <button 
                onClick={() => setShowRecipeBook(false)}
                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl text-xs uppercase tracking-widest active:scale-95 transition-all cursor-pointer shadow-lg"
              >
                Close Chronicles
              </button>
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
                  },
                  {
                    id: 'smithing',
                    n: 'Smithing',
                    ico: '⚒️',
                    color: 'from-blue-700 to-indigo-600',
                    border: 'border-blue-500/30',
                    bg: 'bg-blue-950/20',
                    desc: 'Forging refined weapons, tools, plate armor, and solid metal ingots.',
                    perks: [
                      'Boosts crafted equipment durability / gear attributes',
                      'Level 3: Enables crafting higher-tier Copper & Iron Pickaxes',
                      'Level 6: Enables forging precious Gold & Mithril equipment'
                    ]
                  },
                  {
                    id: 'farming',
                    n: 'Farming',
                    ico: '🌱',
                    color: 'from-lime-600 to-emerald-500',
                    border: 'border-lime-500/30',
                    bg: 'bg-lime-950/20',
                    desc: 'Cultivating wild flora, picking botanical herbs, and harvesting high-yield fiber crops.',
                    perks: [
                      'Earn +10% bonus crop yield per level when gathering from the ground',
                      'Level 4: High probability to obtain rare botanical seeds or glowing spores',
                      'Level 10: Harvest magical flower variants'
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

        {showQuests && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 flex flex-col font-mono"
          >
            {/* Header */}
            <div className="p-6 flex justify-between items-center border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <Compass className="text-emerald-400" />
                <div>
                  <h2 className="text-xl font-bold tracking-widest text-emerald-400">
                    ADVENTURERS' GUILD BOARD
                  </h2>
                  <p className="text-[10px] opacity-40 uppercase tracking-widest">
                    Accept bounties, claim tokens, and secure legendary provisions
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2 bg-emerald-950/40 px-4 py-2 rounded-xl border border-emerald-500/20">
                  <span className="text-xs font-bold text-emerald-300">GUILD TOKENS:</span>
                  <span className="font-bold text-emerald-400 text-sm">🪙 {gameState?.pl.guildTokens || 0}</span>
                </div>
                <button onClick={() => setShowQuests(false)} className="p-2 hover:bg-white/10 rounded-full cursor-pointer transition-all">
                  <X />
                </button>
              </div>
            </div>

            {/* Tab Selector */}
            <div className="flex border-b border-white/5 bg-zinc-900/40 shrink-0">
              <button 
                onClick={() => setGuildTab('quests')}
                className={`flex-1 py-4 text-center text-xs uppercase tracking-widest font-bold transition-all border-b-2 cursor-pointer ${guildTab === 'quests' ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5' : 'border-transparent text-gray-400 hover:text-white'}`}
              >
                📜 Active Bounties & Quests
              </button>
              <button 
                onClick={() => setGuildTab('store')}
                className={`flex-1 py-4 text-center text-xs uppercase tracking-widest font-bold transition-all border-b-2 cursor-pointer ${guildTab === 'store' ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5' : 'border-transparent text-gray-400 hover:text-white'}`}
              >
                🏪 Guild Armory & Provisions Shop
              </button>
            </div>

            {/* Scrollable Content Container */}
            <div className="flex-1 p-6 overflow-y-auto max-w-6xl mx-auto w-full">
              {guildTab === 'quests' ? (
                <div className="space-y-6">
                  <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/10 text-xs opacity-80 leading-relaxed">
                    Welcome to the Adventurers' Guild Board. Complete the hunting, resource gathering, or dangerous boss slaying contracts below to earn valuable <span className="text-emerald-400 font-bold">Guild Tokens</span> and precious resources. Active delivery quests automatically check your inventory. Slaying quests track active targets!
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {GUILD_QUESTS.map(q => {
                      const isActive = !!gameState?.pl.activeQuests?.[q.id];
                      const progress = gameState?.pl.activeQuestsProgress?.[q.id] || 0;
                      const isComplete = progress >= q.targetCount;

                      return (
                        <div key={q.id} className={`p-5 rounded-2xl border transition-all ${isActive ? 'bg-emerald-950/10 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.05)]' : 'bg-zinc-900/30 border-white/5'}`}>
                          <div className="flex items-start justify-between">
                            <div>
                              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-zinc-800 border border-white/5 text-emerald-400">
                                {q.isBoss ? '☠️ Legendary Boss Bounty' : '📜 Resource Contract'}
                              </span>
                              <h3 className="font-bold text-white text-lg mt-2">{q.n}</h3>
                              <p className="text-xs text-gray-400 mt-1">{q.d}</p>
                            </div>
                            
                            {isActive && (
                              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${isComplete ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse'}`}>
                                {isComplete ? 'Ready to Claim' : 'Active'}
                              </span>
                            )}
                          </div>

                          {/* Progress bar if active */}
                          {isActive && (
                            <div className="mt-4">
                              <div className="flex justify-between items-center text-[10px] text-gray-400 mb-1.5">
                                <span>Objective: {IT[q.targetType]?.n || q.targetType} ({progress} / {q.targetCount})</span>
                                <span>{Math.floor(Math.min(100, (progress / q.targetCount) * 100))}%</span>
                              </div>
                              <div className="h-2 w-full bg-white/5 border border-white/10 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-emerald-600 to-green-500"
                                  style={{ width: `${Math.min(100, (progress / q.targetCount) * 100)}%` }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Rewards */}
                          <div className="mt-4 pt-3 border-t border-white/5 flex flex-wrap gap-x-6 gap-y-2 text-xs">
                            <div className="flex items-center gap-1.5 text-gray-400">
                              <span>Rewards:</span>
                              <span className="text-emerald-400 font-bold">🪙 {q.rewardTokens} Guild Tokens</span>
                            </div>
                            {Object.entries(q.rewardItems).map(([itemKey, qty]) => (
                              <div key={itemKey} className="flex items-center gap-1 text-gray-300">
                                <span>{IT[itemKey]?.ico || '💎'}</span>
                                <span>{IT[itemKey]?.n || itemKey} x{qty}</span>
                              </div>
                            ))}
                          </div>

                          {/* Actions */}
                          <div className="mt-5 flex gap-3">
                            {!isActive ? (
                              <button 
                                onClick={() => handleAcceptQuest(q.id)}
                                className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl text-xs uppercase tracking-wider active:scale-95 transition-all cursor-pointer shadow-md"
                              >
                                Accept Contract 📜
                              </button>
                            ) : (
                              <>
                                {isComplete ? (
                                  <button 
                                    onClick={() => handleClaimQuest(q.id)}
                                    className="flex-1 py-2 bg-green-500 hover:bg-green-400 text-black font-bold rounded-xl text-xs uppercase tracking-wider active:scale-95 transition-all cursor-pointer shadow-md shadow-green-500/15"
                                  >
                                    Claim Reward & Complete ✨
                                  </button>
                                ) : (
                                  <button 
                                    onClick={() => handleAbandonQuest(q.id)}
                                    className="px-4 py-2 bg-zinc-800 hover:bg-red-500/20 text-gray-400 hover:text-red-400 border border-white/5 hover:border-red-500/30 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                                  >
                                    Abandon
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/10 text-xs opacity-80 leading-relaxed">
                    Spend your earned <span className="text-emerald-400 font-bold">Guild Tokens</span> to procure epic tools, legendary gear, and celestial spells that cannot be crafted elsewhere!
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[
                      {
                        key: 'phoenix_feather',
                        name: 'Phoenix Feather',
                        icon: '🔥',
                        desc: 'Unmatched defensive item. Keeps you safe by auto-reviving you to 50% health, mana, and full stamina upon fatal damage! Consumes itself on trigger.',
                        cost: 5,
                        tier: 'Epic Artifact'
                      },
                      {
                        key: 'scroll_meteor',
                        name: 'Scroll of Meteor',
                        icon: '☄️',
                        desc: 'Unleash direct destruction! Call down celestial meteor fire dealing 250 flat fire damage to all nearby threats in a huge radius.',
                        cost: 3,
                        tier: 'Legendary Scroll'
                      },
                      {
                        key: 'aegis_plate',
                        name: 'Aegis Plate Armor',
                        icon: '🛡️',
                        desc: 'The legendary steel of the guild. Equippable armor that grants a massive +40 defense rating and boosts maximum HP by +80.',
                        cost: 8,
                        tier: 'Legendary Armor'
                      },
                      {
                        key: 'mithril_pickaxe',
                        name: 'Mithril Pickaxe',
                        icon: '⛏️',
                        desc: 'The pinnacle of subterranean prospecting. Cleaves rocks instantly, hitting for 6 flat mining damage. High attack damage.',
                        cost: 10,
                        tier: 'Legendary Tool'
                      },
                      {
                        key: 'mithril_axe',
                        name: 'Mithril Axe',
                        icon: '🪓',
                        desc: 'Masterfully forged felling tool. Chops down giant trees with 6 flat lumber damage. Superior attack speed and melee damage.',
                        cost: 10,
                        tier: 'Legendary Tool'
                      }
                    ].map(item => {
                      const tokens = gameState?.pl.guildTokens || 0;
                      const canAfford = tokens >= item.cost;
                      const invQty = gameState?.pl.inv[item.key] || 0;

                      return (
                        <div key={item.key} className="p-5 rounded-2xl bg-zinc-900/30 border border-white/5 flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-start">
                              <span className="text-3xl">{item.icon}</span>
                              <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded bg-zinc-800 border border-white/5 text-emerald-400">
                                {item.tier}
                              </span>
                            </div>
                            <h3 className="font-bold text-white text-base mt-3 flex items-center gap-2">
                              {item.name}
                              {invQty > 0 && <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/30 px-1.5 py-0.5 rounded border border-emerald-500/10">In Pack: {invQty}</span>}
                            </h3>
                            <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">{item.desc}</p>
                          </div>

                          <div className="mt-5 pt-4 border-t border-white/5">
                            <div className="flex justify-between items-center mb-3">
                              <span className="text-xs text-gray-400">Armory Cost:</span>
                              <span className="text-emerald-400 font-bold text-sm">🪙 {item.cost} Tokens</span>
                            </div>
                            <button 
                              onClick={() => handleBuyGuildStoreItem(item.key, item.cost)}
                              disabled={!canAfford}
                              className={`w-full py-2 font-bold rounded-xl text-xs uppercase tracking-wider active:scale-95 transition-all cursor-pointer ${canAfford ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-md' : 'bg-zinc-800 text-gray-500 border border-white/5 cursor-not-allowed'}`}
                            >
                              {canAfford ? 'Purchase Item' : 'Need More Tokens'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {showMasteries && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 flex flex-col font-mono"
          >
            {/* Header */}
            <div className="p-6 flex justify-between items-center border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <Flame className="text-orange-500" />
                <div>
                  <h2 className="text-xl font-bold tracking-widest text-orange-500">
                    MASTERIES & PASSIVES TRAINER
                  </h2>
                  <p className="text-[10px] opacity-40 uppercase tracking-widest">
                    Invest Guild Tokens to permanently awaken specialized combat and gatherer potentials
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 bg-orange-950/40 px-4 py-2 rounded-xl border border-orange-500/20">
                  <span className="text-xs font-bold text-orange-300">GUILD TOKENS:</span>
                  <span className="font-bold text-orange-400 text-sm">🪙 {gameState?.pl.guildTokens || 0}</span>
                </div>
                <button onClick={() => setShowMasteries(false)} className="p-2 hover:bg-white/10 rounded-full cursor-pointer transition-all">
                  <X />
                </button>
              </div>
            </div>

            {/* Scrollable Content Container */}
            <div className="flex-1 p-6 overflow-y-auto max-w-5xl mx-auto w-full">
              <div className="p-4 mb-6 rounded-xl bg-orange-950/20 border border-orange-500/10 text-xs opacity-80 leading-relaxed">
                Welcome to the Masteries Training chambers. Awaken your latent power by training the 6 high-tier mastery pathways. Each passive trait can be upgraded up to <span className="text-orange-400 font-bold">Level 3</span>. Training costs <span className="text-orange-400 font-bold">5 Guild Tokens per level</span> (Level 1: 5 Tokens, Level 2: 10 Tokens, Level 3: 15 Tokens).
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  {
                    id: 'adrenaline',
                    name: 'Adrenaline Rush ⚡',
                    desc: 'Grants raw speed when survival is on the line. When health drops below 40%, gain +10% extra movement speed per level.',
                    color: 'from-amber-600 to-yellow-500',
                    border: 'border-yellow-500/20',
                    bg: 'bg-yellow-950/10',
                    perks: [
                      'Level 1: +10% Speed under 40% HP',
                      'Level 2: +20% Speed under 40% HP',
                      'Level 3: +30% Speed under 40% HP (Max)'
                    ]
                  },
                  {
                    id: 'double_harvest',
                    name: 'Double Harvest 🌿',
                    desc: 'Expertise in botanical botany and forestry. Gives +10% chance per level to double all herbalism, fiber, and wood felling yields.',
                    color: 'from-green-600 to-emerald-500',
                    border: 'border-emerald-500/20',
                    bg: 'bg-emerald-950/10',
                    perks: [
                      'Level 1: +10% Double Harvest chance',
                      'Level 2: +20% Double Harvest chance',
                      'Level 3: +30% Double Harvest chance (Max)'
                    ]
                  },
                  {
                    id: 'lucky_miner',
                    name: 'Lucky Miner 🪙',
                    desc: 'Eye for glittering underground treasures. Gives +10% chance per level to double all mineral and ore felling drops.',
                    color: 'from-sky-600 to-blue-500',
                    border: 'border-sky-500/20',
                    bg: 'bg-sky-950/10',
                    perks: [
                      'Level 1: +10% Double Mineral chance',
                      'Level 2: +20% Double Mineral chance',
                      'Level 3: +30% Double Mineral chance (Max)'
                    ]
                  },
                  {
                    id: 'toughened_hide',
                    name: 'Toughened Hide 🛡️',
                    desc: 'Thickened outer defenses. Permanently reduces all incoming damage from enemies by a flat amount (1 point per level).',
                    color: 'from-indigo-600 to-violet-500',
                    border: 'border-violet-500/20',
                    bg: 'bg-violet-950/10',
                    perks: [
                      'Level 1: -1 flat damage from enemy hits',
                      'Level 2: -2 flat damage from enemy hits',
                      'Level 3: -3 flat damage from enemy hits (Max)'
                    ]
                  },
                  {
                    id: 'vampiric_strikes',
                    name: 'Vampiric Strikes 🩸',
                    desc: 'Siphon vitality directly from threats. Grants +5% chance per level on all melee attacks to restore +4 HP instantly.',
                    color: 'from-red-600 to-rose-500',
                    border: 'border-rose-500/20',
                    bg: 'bg-rose-950/10',
                    perks: [
                      'Level 1: 5% chance to heal +4 HP on hit',
                      'Level 2: 10% chance to heal +4 HP on hit',
                      'Level 3: 15% chance to heal +4 HP on hit (Max)'
                    ]
                  },
                  {
                    id: 'sages_wisdom',
                    name: 'Sage\'s Wisdom 🧿',
                    desc: 'Awakened connection to the mystical ether. Permanently decreases the mana cost of all active spells by 10% per level.',
                    color: 'from-purple-600 to-fuchsia-500',
                    border: 'border-fuchsia-500/20',
                    bg: 'bg-fuchsia-950/10',
                    perks: [
                      'Level 1: -10% spell mana cost, permanent +10 max MP',
                      'Level 2: -20% spell mana cost, permanent +20 max MP',
                      'Level 3: -30% spell mana cost, permanent +30 max MP (Max)'
                    ]
                  }
                ].map(mst => {
                  const currentLvl = gameState?.pl?.masteries?.[mst.id] || 0;
                  const isMax = currentLvl >= 3;
                  const cost = (currentLvl + 1) * 5;
                  const tokens = gameState?.pl.guildTokens || 0;
                  const canAfford = tokens >= cost && !isMax;

                  return (
                    <div key={mst.id} className={`p-5 rounded-2xl border ${mst.border} ${mst.bg} flex flex-col justify-between`}>
                      <div>
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-white text-base tracking-wide">{mst.name}</h3>
                          <div className={`px-3 py-1 rounded-full border font-bold text-sm ${isMax ? 'bg-orange-500/20 border-orange-500/40 text-orange-400' : 'bg-white/10 border-white/5 text-gray-300'}`}>
                            {isMax ? 'MAX LVL 3' : `LVL ${currentLvl}`}
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 mt-2 leading-relaxed">{mst.desc}</p>

                        <div className="mt-4 pt-3 border-t border-white/5">
                          <h4 className="text-[10px] uppercase tracking-wider font-bold opacity-40 mb-1.5">Training Benefits:</h4>
                          <ul className="space-y-1">
                            {mst.perks.map((perk, pidx) => (
                              <li key={pidx} className={`text-xs flex items-start gap-1 ${currentLvl > pidx ? 'text-orange-400 font-bold opacity-100' : 'opacity-50'}`}>
                                <span>{currentLvl > pidx ? '✓' : '•'}</span>
                                <span>{perk}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between gap-4">
                        {!isMax ? (
                          <>
                            <div className="text-xs">
                              <span className="text-gray-400">Next Level Cost:</span>
                              <div className="text-orange-400 font-bold text-sm mt-0.5">🪙 {cost} Tokens</div>
                            </div>
                            <button 
                              onClick={() => handleUpgradeMastery(mst.id, cost, 3)}
                              disabled={!canAfford}
                              className={`flex-1 py-2 font-bold rounded-xl text-xs uppercase tracking-wider active:scale-95 transition-all cursor-pointer ${canAfford ? 'bg-orange-500 hover:bg-orange-400 text-black shadow-md' : 'bg-zinc-800 text-gray-500 border border-white/5 cursor-not-allowed'}`}
                            >
                              {canAfford ? 'Upgrade Mastery ⚡' : 'Cannot Afford'}
                            </button>
                          </>
                        ) : (
                          <div className="w-full text-center py-2 bg-orange-500/10 border border-orange-500/20 text-orange-400 font-bold rounded-xl text-xs uppercase tracking-wider">
                            ✨ awakened potential reached ✨
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {showCraft && (
          <div className="fixed inset-0 z-50 bg-zinc-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 font-mono overflow-hidden">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-6xl h-[88vh] sm:h-[85vh] bg-zinc-900/95 border border-white/10 rounded-2xl flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.85)] overflow-hidden"
            >
              {/* Header */}
              <div className="p-4 sm:p-5 flex justify-between items-center border-b border-white/10 shrink-0">
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
                              className={`p-3 sm:p-4 rounded-xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition-all duration-300 ${
                                canForge 
                                  ? 'bg-zinc-900/90 border-yellow-500/30 shadow-[0_4px_20px_rgba(234,179,8,0.06)] hover:border-yellow-400/80 hover:bg-zinc-900 scale-[1.01]' 
                                  : 'bg-zinc-950/70 border-white/5 opacity-40 grayscale-[40%] hover:opacity-60 hover:grayscale-[20%]'
                              }`}
                            >
                              <div className="flex items-start sm:items-center gap-4 w-full">
                                <div className={`text-3xl w-14 h-14 rounded-lg flex items-center justify-center shrink-0 border shadow-inner transition-all duration-300 ${
                                  canForge 
                                    ? 'bg-white/5 border-yellow-500/30 text-white' 
                                    : 'bg-zinc-900/50 border-white/5 text-zinc-500'
                                }`}>
                                  {r.discovered ? (IT[r.out]?.ico || '❓') : '❓'}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`font-bold text-sm sm:text-base ${canForge ? 'text-yellow-400' : 'text-zinc-400'}`}>
                                      {r.discovered ? r.n : 'Hidden Formula'}
                                    </span>
                                    {r.discovered && r.craftCount > 0 && (
                                      <span className="text-[8px] sm:text-[9px] bg-yellow-500/10 text-yellow-500 border border-yellow-500/25 px-1.5 py-0.5 rounded-md font-sans">
                                        Crafted {r.craftCount}x
                                      </span>
                                    )}
                                    
                                    {/* Status Indicator Badge */}
                                    {!r.discovered ? (
                                      <span className="text-[8px] sm:text-[9px] bg-zinc-800 text-zinc-400 border border-zinc-700/50 px-2 py-0.5 rounded-full uppercase font-sans tracking-wider">
                                        🔒 Lab Research
                                      </span>
                                    ) : !hasMats ? (
                                      <span className="text-[8px] sm:text-[9px] bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full uppercase font-sans tracking-wider">
                                        ❌ Out of Materials
                                      </span>
                                    ) : !isNear ? (
                                      <span className="text-[8px] sm:text-[9px] bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded-full uppercase font-sans tracking-wider">
                                        🚫 Station Needed
                                      </span>
                                    ) : (
                                      <span className="text-[8px] sm:text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-sans uppercase font-bold animate-pulse">
                                        ✨ Ready ({maxQty}x)
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] sm:text-xs opacity-50 mt-1">
                                    {r.discovered ? `Produces: ${IT[r.out]?.n || r.out}` : 'Combine components in alchemy Transmutation Lab to unlock formula!'}
                                  </p>

                                  {/* Required Ingredients */}
                                  <div className="flex flex-wrap gap-1.5 mt-3">
                                    {Object.entries(r.c).map(([k, v]) => {
                                      const held = gameState?.pl?.inv[k] || 0;
                                      const cost = v as number;
                                      const sufficient = held >= cost;
                                      return (
                                        <div 
                                          key={k} 
                                          className={`text-[10px] flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-colors ${
                                            sufficient 
                                              ? 'bg-emerald-500/5 border-emerald-500/15 text-emerald-400 font-bold' 
                                              : 'bg-red-500/5 border-red-500/15 text-red-400'
                                          }`}
                                        >
                                          <span className="text-xs select-none">{IT[k]?.ico || '❓'}</span>
                                          <span className="truncate max-w-[80px] sm:max-w-[120px]">{IT[k]?.n || k}</span>
                                          <span className="opacity-80 font-mono text-[9px]">({held}/{cost})</span>
                                        </div>
                                      );
                                    })}
                                  </div>

                                  {/* Proximity / Station requirements */}
                                  {r.req && (
                                    <div className="mt-2 flex items-center gap-1.5 text-[10px]">
                                      <span className={`px-2 py-0.5 rounded border flex items-center gap-1.5 ${
                                        isNear 
                                          ? 'bg-emerald-500/5 border-emerald-500/15 text-emerald-400 font-bold' 
                                          : 'bg-orange-500/5 border-orange-500/15 text-orange-400'
                                      }`}>
                                        {isNear ? '✓ Station Built (Map-wide):' : '✗ Station Needed (Map-wide):'} {IT[r.req]?.ico || '🏢'} {IT[r.req]?.n || r.req}
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
                                      className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold transition-all uppercase tracking-wider cursor-pointer ${
                                        canForge 
                                          ? 'bg-yellow-500 hover:bg-yellow-400 text-black active:scale-95 shadow-md font-black' 
                                          : 'bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'
                                      }`}
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
                                          if (next[r.out]) {
                                            if (!autoCraftState) {
                                              addLog(`🛠️ Queued "${r.n}" for Auto-Craft. Enable "Auto-Craft Core" in the AUTOMATE panel!`, '#f97316');
                                            } else {
                                              addLog(`🛠️ Queued "${r.n}" for Auto-Craft.`, '#4ade80');
                                            }
                                          } else {
                                            addLog(`🛠️ Removed "${r.n}" from Auto-Craft queue.`, '#94a3b8');
                                          }
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
                                  <div className="text-[10px] text-cyan-400 uppercase tracking-widest font-sans flex items-center gap-1 py-1.5 px-3 bg-cyan-500/10 rounded-lg border border-cyan-500/30 shrink-0">
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
                <div className="h-full flex flex-col md:flex-row p-4 gap-4 overflow-y-auto">
                  
                  {/* Left Column: Alchemy Formulas Book */}
                  <div className="w-full md:w-80 shrink-0 flex flex-col gap-3 bg-white/[0.01] border border-white/5 p-4 rounded-xl max-h-[300px] md:max-h-none overflow-hidden">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1">
                        <BookOpen size={13} /> Formula Book
                      </span>
                      <span className="text-[8px] opacity-40 uppercase font-bold">Lab Recipes</span>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2">
                      {recipes
                        .filter(r => !RC.some(rc => rc.out === r.out)) // Only show magic lab exclusive creations here
                        .map((r, idx) => {
                          const heldCount = gameState?.pl?.inv[r.out] || 0;
                          const hasIngredients = Object.entries(r.c).every(([k, v]) => (gameState?.pl?.inv[k] || 0) >= (v as number));
                          return (
                            <div 
                              key={idx}
                              className={`p-2.5 rounded-lg border text-left transition-all ${
                                r.discovered 
                                  ? 'bg-cyan-950/20 border-cyan-500/20 hover:border-cyan-500/40' 
                                  : 'bg-zinc-950/30 border-white/5 opacity-70'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-1.5 mb-1.5">
                                <div className="truncate">
                                  <div className="text-[10px] font-bold text-white flex items-center gap-1.5 truncate">
                                    <span className="text-sm select-none">{r.discovered ? IT[r.out]?.ico : '🔒'}</span>
                                    <span className="truncate">{r.discovered ? r.n : 'Locked Formula'}</span>
                                  </div>
                                  <p className="text-[8px] opacity-40 uppercase tracking-wider mt-0.5">
                                    {r.discovered ? `HELD: ${heldCount}x` : 'Combine raw elements to unlock'}
                                  </p>
                                </div>
                                
                                {hasIngredients && (
                                  <button
                                    onClick={() => loadRecipeReactants(r)}
                                    className="px-1.5 py-0.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 hover:border-cyan-500/50 rounded text-[8px] font-bold text-cyan-300 uppercase tracking-wider transition-all cursor-pointer"
                                    title="Auto-load required resources into the Alchemy pot"
                                  >
                                    LOAD
                                  </button>
                                )}
                              </div>
                              
                              {/* Ratios Preview */}
                              <div className="flex flex-wrap gap-1">
                                {Object.entries(r.c).map(([k, v]) => {
                                  const held = gameState?.pl?.inv[k] || 0;
                                  const needed = v as number;
                                  return (
                                    <span 
                                      key={k} 
                                      className={`text-[8px] px-1 py-0.5 rounded flex items-center gap-1 ${
                                        held >= needed ? 'bg-emerald-500/5 border border-emerald-500/15 text-emerald-400 font-bold' : 'bg-red-500/5 border border-red-500/15 text-red-400'
                                      }`}
                                    >
                                      <span>{r.discovered ? IT[k]?.ico : '❓'}</span>
                                      <span>{needed}</span>
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* Center Column: Interactive Mixing Pot & Crucible */}
                  <div className="flex-1 flex flex-col gap-4 bg-white/[0.02] border border-white/10 p-4 sm:p-5 rounded-xl min-w-0">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <div className="flex items-center gap-2">
                        <FlaskConical className="text-cyan-400 animate-pulse animate-[pulse_2s_infinite]" size={18} />
                        <div>
                          <h3 className="font-bold text-white text-xs sm:text-sm tracking-wider uppercase leading-none">
                            Transmutation Crucible
                          </h3>
                          <p className="text-[8px] opacity-40 uppercase tracking-widest mt-1">Combine raw reagents in specific ratios</p>
                        </div>
                      </div>
                      
                      {labReactants.length > 0 && (
                        <button 
                          onClick={() => setLabReactants([])}
                          className="px-2 py-1 hover:bg-red-500/10 text-red-400 border border-red-500/20 hover:border-red-500/30 rounded-lg text-[9px] font-bold uppercase transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 size={10} /> CLEAR ALL
                        </button>
                      )}
                    </div>

                    {/* Fusing Crucible list & Glyphs */}
                    <div className="flex-1 min-h-[180px] border border-dashed border-white/10 rounded-xl p-4 flex flex-col justify-center items-center gap-4 relative overflow-y-auto bg-black/40">
                      
                      {/* Magical Alchemical Glyph rotating circle and bubbles! */}
                      <div className="relative w-44 h-44 flex items-center justify-center my-1 mx-auto shrink-0 select-none">
                        <svg className="absolute w-full h-full text-cyan-500/15 animate-[spin_60s_linear_infinite]" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="0.75" strokeDasharray="5,3" />
                          <circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" strokeWidth="0.5" />
                          <polygon points="50,12 83,68 17,68" fill="none" stroke="currentColor" strokeWidth="0.5" />
                          <polygon points="50,88 83,32 17,32" fill="none" stroke="currentColor" strokeWidth="0.5" />
                        </svg>
                        
                        {/* Interactive Reactant bubbles floating around alchemical sigils */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          {labReactants.length === 0 ? (
                            <div className="text-center p-2">
                              <span className="text-4xl animate-pulse block">🧪</span>
                              <span className="text-[8px] uppercase tracking-widest opacity-35 block mt-2 animate-pulse">POT EMPTY</span>
                            </div>
                          ) : (
                            <div className="relative w-full h-full flex items-center justify-center">
                              {labReactants.map((react, index) => {
                                const angle = (index / labReactants.length) * 2 * Math.PI;
                                const radius = 52; // px radius
                                const x = Math.cos(angle) * radius;
                                const y = Math.sin(angle) * radius;
                                return (
                                  <motion.div
                                    key={react.itemKey}
                                    initial={{ scale: 0, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1, x, y }}
                                    className="absolute bg-zinc-950/95 border border-cyan-400/30 p-2 rounded-full shadow-[0_0_12px_rgba(34,211,238,0.2)] flex flex-col items-center justify-center w-[38px] h-[38px]"
                                  >
                                    <span className="text-base select-none leading-none">{IT[react.itemKey]?.ico || '🍀'}</span>
                                    <span className="text-[8px] font-mono text-cyan-400 leading-none font-black mt-0.5">{react.qty}</span>
                                  </motion.div>
                                );
                              })}
                              <div className="absolute w-12 h-12 rounded-full bg-cyan-500/5 border border-cyan-400/20 flex items-center justify-center animate-pulse shadow-[0_0_15px_rgba(34,211,238,0.4)]">
                                <Sparkles className="text-cyan-400 animate-spin animate-[spin_12s_linear_infinite]" size={14} />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Reactant items list with +/- adjustment sliders */}
                      {labReactants.length > 0 && (
                        <div className="w-full flex flex-col gap-1.5 max-h-[140px] overflow-y-auto pr-1">
                          {labReactants.map((react) => {
                            const maxInventory = gameState?.pl.inv[react.itemKey] || 0;
                            return (
                              <div 
                                key={react.itemKey}
                                className="flex justify-between items-center bg-white/[0.02] p-2 rounded-lg border border-white/5 text-white"
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <span className="text-xl select-none shrink-0">{IT[react.itemKey]?.ico || '🍀'}</span>
                                  <div className="truncate">
                                    <div className="text-[10px] font-bold text-cyan-400 truncate">{IT[react.itemKey]?.n || react.itemKey}</div>
                                    <div className="text-[8px] opacity-40 uppercase">Held: {maxInventory}</div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button 
                                    onClick={() => adjustReactantQty(react.itemKey, -1)}
                                    className="w-6 h-6 flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/10 rounded-md text-xs font-sans hover:text-cyan-400 transition-all font-black cursor-pointer"
                                  >
                                    -
                                  </button>
                                  <span className="text-xs font-mono font-bold text-white px-1.5 min-w-[16px] text-center">
                                    {react.qty}
                                  </span>
                                  <button 
                                    onClick={() => adjustReactantQty(react.itemKey, 1)}
                                    className="w-6 h-6 flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/10 rounded-md text-xs font-sans hover:text-cyan-400 transition-all font-black cursor-pointer"
                                  >
                                    +
                                  </button>
                                  <button 
                                    onClick={() => removeReactant(react.itemKey)}
                                    className="p-1 hover:bg-red-500/20 text-red-400 rounded transition-all ml-1 cursor-pointer"
                                    title="Remove from pot"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Transmute action button */}
                    <button 
                      onClick={combineMaterials}
                      className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white py-2.5 rounded-xl font-bold font-mono tracking-widest text-xs flex items-center justify-center gap-1.5 shadow-md hover:shadow-cyan-500/10 transition-all active:scale-95 cursor-pointer shrink-0"
                    >
                      <Sparkles size={14} /> TRANSMUTE REAGENTS
                    </button>

                    {/* Action result panel */}
                    {labStatus && (
                      <div className={`p-3 rounded-xl border text-[10px] leading-relaxed shrink-0 ${labStatus.success ? 'bg-green-500/10 border-green-500/20 text-green-400 font-sans' : 'bg-red-500/10 border-red-500/20 text-red-400 font-sans'}`}>
                        <div className="font-bold mb-1 flex items-center gap-1.5 text-[9px] tracking-wider uppercase font-mono">
                          {labStatus.success ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                          {labStatus.success ? 'TRANSMUTATION COMPATIBLE' : 'ALCHEMY UNSTABLE'}
                        </div>
                        <p className="opacity-90">{labStatus.msg}</p>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Reactant Ingredient Palette */}
                  <div className="w-full md:w-64 shrink-0 flex flex-col gap-3 bg-white/[0.01] border border-white/5 p-4 rounded-xl max-h-[300px] md:max-h-none overflow-hidden">
                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                      <div>
                        <h3 className="font-bold text-white text-xs tracking-wider uppercase flex items-center gap-1">
                          💼 Lab Palette
                        </h3>
                        <p className="text-[8px] opacity-40 uppercase mt-0.5">Ingredients in bag</p>
                      </div>
                      <span className="text-[8px] bg-white/5 px-2 py-0.5 rounded-full text-white/50">
                        {Object.entries(gameState?.pl.inv || {}).filter(([k, v]) => (v as number) > 0 && IT[k]?.t === 'mat').length} Types
                      </span>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-1">
                      <div className="grid grid-cols-3 md:grid-cols-2 gap-2 pb-6">
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
                                className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                                  isSelected 
                                    ? 'bg-cyan-500/10 border-cyan-400 hover:border-cyan-300 shadow-md shadow-cyan-500/5' 
                                    : 'bg-white/5 border-white/5 hover:border-white/10'
                                }`}
                              >
                                <span className="text-2xl select-none">{IT[k]?.ico || '💎'}</span>
                                <span className="text-[9px] font-bold truncate max-w-full text-center leading-none mt-1">{IT[k]?.n || k}</span>
                                <span className="text-[8px] text-cyan-400 font-mono font-bold">Qty: {v as number}</span>
                              </div>
                            );
                          })}
                        {Object.entries(gameState?.pl.inv || {}).filter(([k, v]) => (v as number) > 0 && IT[k]?.t === 'mat').length === 0 && (
                          <div className="col-span-full text-[9px] text-white/30 italic text-center py-8">
                            No raw materials available. Explore the map to collect iron ore, crystals, and celestial shards!
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

    <AnimatePresence>
      {showOracle && (
        <motion.div 
          key="oracle-modal"
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
      </AnimatePresence>

      <AnimatePresence>
        {showSaveMenu && (
          <motion.div 
            key="save-menu-modal"
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
      </AnimatePresence>

      <AnimatePresence>
        {showWorldMenu && (
          <motion.div 
            key="world-menu-modal"
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

              {/* Procedural Terrain & Biomes Feature Config Utility */}
              <div className="bg-white/[0.01] border border-white/5 p-5 sm:p-6 rounded-2xl flex flex-col gap-6">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <Sliders size={13} />
                    <span>Procedural Terrain & Biome Customizer</span>
                  </div>
                  <p className="text-[10px] opacity-40 uppercase mt-1">Configure preset world models or custom-carve the land mass, water distribution, and resource density:</p>
                </div>

                {/* Preset Selector Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                  {[
                    { id: 'standard', n: 'Standard', ico: '🌍', desc: 'Default survival map ratios' },
                    { id: 'archipelago', n: 'Archipelago', ico: '🏝️', desc: 'Dense cluster of small islands' },
                    { id: 'desolate', n: 'Desolate', ico: '🏜️', desc: 'Arid sweeps, low water, high minerals' },
                    { id: 'rainforest', n: 'Rainforest', ico: '🌳', desc: 'Overgrown dense woods and rich water' },
                    { id: 'highlands', n: 'Highlands', ico: '🏔️', desc: 'Extreme mountainous slate formations' },
                    { id: 'swamp', n: 'Swampland', ico: '🐊', desc: 'Vast low-lying damp muddy rivers' },
                  ].map((p) => {
                    const isSelected = selectedWorldPreset === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => applyWorldPreset(p.id)}
                        className={`p-2.5 rounded-xl border flex flex-col items-center text-center transition-all cursor-pointer hover:scale-102 active:scale-98 ${
                          isSelected
                            ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300 font-bold shadow-[0_0_12px_rgba(16,185,129,0.1)]'
                            : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04] text-zinc-400'
                        }`}
                        title={p.desc}
                      >
                        <span className="text-xl mb-1">{p.ico}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider">{p.n}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Live Custom Sliders */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 border-t border-white/5 pt-5">
                  {/* Ocean Cutoff */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-[9px] text-zinc-400 uppercase font-bold">
                      <span className="flex items-center gap-1 text-sky-400">🌊 Ocean Coverage</span>
                      <span className="font-mono text-sky-300">{(genWaterLevel * 100).toFixed(0)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.01"
                      max="0.55"
                      step="0.01"
                      value={genWaterLevel}
                      onChange={(e) => {
                        setGenWaterLevel(parseFloat(e.target.value));
                        setSelectedWorldPreset('custom');
                      }}
                      className="accent-sky-500 w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="text-[8px] opacity-30 uppercase">Sets water or lava level cutoff.</span>
                  </div>

                  {/* Coast Cutoff */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-[9px] text-zinc-400 uppercase font-bold">
                      <span className="flex items-center gap-1 text-amber-400">🏖️ Shoreline/Flat Width</span>
                      <span className="font-mono text-amber-300">{(genCoastLevel * 100).toFixed(0)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.02"
                      max="0.65"
                      step="0.01"
                      value={genCoastLevel}
                      onChange={(e) => {
                        setGenCoastLevel(parseFloat(e.target.value));
                        setSelectedWorldPreset('custom');
                      }}
                      className="accent-amber-500 w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="text-[8px] opacity-30 uppercase">Configures sandy beaches and dry plains.</span>
                  </div>

                  {/* Mountain Peak Cutoff */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-[9px] text-zinc-400 uppercase font-bold">
                      <span className="flex items-center gap-1 text-slate-300">🏔️ Rocky Ridge Peak</span>
                      <span className="font-mono text-slate-100">{(genMountainLevel * 100).toFixed(0)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.50"
                      max="0.95"
                      step="0.01"
                      value={genMountainLevel}
                      onChange={(e) => {
                        setGenMountainLevel(parseFloat(e.target.value));
                        setSelectedWorldPreset('custom');
                      }}
                      className="accent-slate-400 w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="text-[8px] opacity-30 uppercase">Configures steep granite peak spawns.</span>
                  </div>

                  {/* Forest density */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-[9px] text-zinc-400 uppercase font-bold">
                      <span className="flex items-center gap-1 text-emerald-400">🌲 Forest/Tree Density</span>
                      <span className="font-mono text-emerald-300">{genTreeDensity.toFixed(1)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="3.0"
                      step="0.1"
                      value={genTreeDensity}
                      onChange={(e) => {
                        setGenTreeDensity(parseFloat(e.target.value));
                        setSelectedWorldPreset('custom');
                      }}
                      className="accent-emerald-500 w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="text-[8px] opacity-30 uppercase">Influences forestry canopy density.</span>
                  </div>

                  {/* Ore density */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-[9px] text-zinc-400 uppercase font-bold">
                      <span className="flex items-center gap-1 text-cyan-400">🪨 Ore Deposit Spawn</span>
                      <span className="font-mono text-cyan-300">{genOreDensity.toFixed(1)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="3.0"
                      step="0.1"
                      value={genOreDensity}
                      onChange={(e) => {
                        setGenOreDensity(parseFloat(e.target.value));
                        setSelectedWorldPreset('custom');
                      }}
                      className="accent-cyan-500 w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="text-[8px] opacity-30 uppercase">Scales mining vein generation rates.</span>
                  </div>

                  {/* Frequency Scale */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-[9px] text-zinc-400 uppercase font-bold">
                      <span className="flex items-center gap-1 text-purple-400">🌀 Continent Sizing</span>
                      <span className="font-mono text-purple-300">{genFreqScale.toFixed(2)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.30"
                      max="2.50"
                      step="0.05"
                      value={genFreqScale}
                      onChange={(e) => {
                        setGenFreqScale(parseFloat(e.target.value));
                        setSelectedWorldPreset('custom');
                      }}
                      className="accent-purple-500 w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="text-[8px] opacity-30 uppercase">Scales noise octave sizing.</span>
                  </div>
                </div>
              </div>

              {/* Grid map Preview / Biome Layout overview */}
              <div className="flex flex-col gap-3">
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">Procedural Zone Layout for Seed: {worldSeed}</div>
                <p className="text-[10px] opacity-40 uppercase">The map is a {ZCOLS}x{ZROWS} cluster of continuous biomes. Below is the mapped layout:</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3.5 mt-2">
                  {Array.from({ length: ZROWS * ZCOLS }).map((_, i) => {
                    const zr = Math.floor(i / ZCOLS);
                    const zc = i % ZCOLS;
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
                            <span className="text-lg">{M.n.includes('Desert') ? '🏜️' : M.n.includes('Forest') ? '🌲' : M.n.includes('Frozen') ? '❄️' : M.n.includes('Scorched') ? '🌋' : M.n.includes('Celestial') ? '🌌' : M.n.includes('Chrono') || M.n.includes('Rift') ? '⏳' : '🌾'}</span>
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
                  })}
                </div>
              </div>

              {/* Interactive Procedural Noise 2D Grid Section */}
              <div className="border-t border-white/10 pt-6 mt-2 flex flex-col gap-3">
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">Interactive Micro-Terrain Noise Simulator</div>
                <p className="text-[10px] opacity-40 uppercase">Fine-tune the mathematical parameters of the Fractional Brownian Motion noise generator below:</p>
                <TerrainGenerator 
                  currentWorldSeed={worldSeed} 
                  onApplySeed={(newSeed) => {
                    setWorldSeed(newSeed);
                    addLog(`🌍 Synchronized core seed to mathematical noise output: ${newSeed}`, '#34d399');
                  }} 
                />
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

      <AnimatePresence>
        {showSpellbook && (
          <motion.div 
            key="spellbook-modal"
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
                    },
                    {
                      name: "Flame Burst",
                      cost: 35,
                      crystalCost: 1,
                      ico: "🔥",
                      tag: "ELEMENTAL DEFENSE",
                      desc: "Ignites the space around you. Searing fire ring deals 60-90 damage to all nearby monsters and knocks them back."
                    },
                    {
                      name: "Tectonic Rift",
                      cost: 45,
                      crystalCost: 2,
                      ico: "🪨",
                      tag: "GEOLOGICAL SHATTER",
                      desc: "Releases an earthquake pulse that instantly breaks and harvests all standing trees and rocks/ores within a 150px radius."
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
      </AnimatePresence>

      <AnimatePresence>
        {showNFTMarket && (
          <motion.div 
            key="nft-market-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
          >
            <div className="max-w-6xl w-full bg-zinc-950 border border-cyan-500/30 rounded-3xl p-6 md:p-8 flex flex-col gap-6 max-h-[95vh] overflow-y-auto shadow-[0_0_50px_rgba(6,182,212,0.15)] text-white pointer-events-auto font-mono">
              {/* Header */}
              <div className="flex justify-between items-center border-b border-white/10 pb-4">
                <div className="flex items-center gap-2.5">
                  <Cpu size={22} className="text-cyan-400 animate-pulse" />
                  <div>
                    <h2 className="text-xl font-bold uppercase tracking-wider text-cyan-400">Survival NFT Exchange</h2>
                    <p className="text-[10px] opacity-50 uppercase mt-0.5">Browse & Trade 10,000 unique procedurally-generated Web3 weapons and armor</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowNFTMarket(false)}
                  className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Balance Bar */}
              <div className="bg-cyan-950/20 border border-cyan-500/20 p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🪙</span>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-cyan-400">Your Trade Capital</div>
                    <div className="text-xl font-black text-cyan-300 mt-0.5">
                      {gameState?.pl.inv.gold_coins || 0} Gold Coins
                    </div>
                  </div>
                </div>
                <p className="text-[10px] opacity-40 uppercase text-right max-w-xs leading-relaxed hidden md:block">
                  Defeat high-tier monsters to collect Gold Coins or liquidate your excess survival resources at the Liquidity Desk on the right.
                </p>
              </div>

              {/* Main Content: Split into Market and Liquidity */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left 2 Columns: NFT Browse & Purchase */}
                <div className="lg:col-span-2 flex flex-col gap-4">
                  <div className="text-sm font-bold uppercase tracking-wider text-cyan-400 border-b border-white/10 pb-1 flex items-center gap-1.5">
                    <Sparkles size={14} /> Catalog Terminal (1-10,000)
                  </div>

                  {/* Filters and Search ID */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white/[0.02] border border-white/5 p-4 rounded-2xl">
                    {/* Search Token ID */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[9px] font-bold uppercase opacity-50">Token ID Search</label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30" size={13} />
                        <input 
                          type="number"
                          placeholder="e.g. 777"
                          min="1"
                          max="10000"
                          value={nftSearchToken}
                          onChange={(e) => {
                            setNftSearchToken(e.target.value);
                            setNftPage(0); // reset page
                          }}
                          className="w-full bg-zinc-900 border border-white/10 rounded-xl py-1.5 pl-8 pr-3 text-xs text-white focus:outline-none focus:border-cyan-400 transition-all font-mono"
                        />
                      </div>
                    </div>

                    {/* Filter Rarity */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[9px] font-bold uppercase opacity-50">Filter Rarity</label>
                      <select 
                        value={nftRarityFilter}
                        onChange={(e) => {
                          setNftRarityFilter(e.target.value);
                          setNftPage(0);
                        }}
                        className="bg-zinc-900 border border-white/10 rounded-xl py-1.5 px-3 text-xs text-white focus:outline-none focus:border-cyan-400 transition-all cursor-pointer font-mono"
                      >
                        {['All', 'Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'].map((rar) => (
                          <option key={rar} value={rar}>{rar.toUpperCase()}</option>
                        ))}
                      </select>
                    </div>

                    {/* Filter Type */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[9px] font-bold uppercase opacity-50">Filter Type</label>
                      <select 
                        value={nftTypeFilter}
                        onChange={(e) => {
                          setNftTypeFilter(e.target.value);
                          setNftPage(0);
                        }}
                        className="bg-zinc-900 border border-white/10 rounded-xl py-1.5 px-3 text-xs text-white focus:outline-none focus:border-cyan-400 transition-all cursor-pointer font-mono"
                      >
                        {['All', 'Weapon', 'Armor'].map((t) => (
                          <option key={t} value={t}>{t.toUpperCase()}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* NFT Grid */}
                  {(() => {
                    const filteredNFTs = getFilteredNFTs();
                    if (filteredNFTs.length === 0) {
                      return (
                        <div className="flex flex-col items-center justify-center p-12 bg-white/[0.01] border border-white/5 rounded-2xl">
                          <AlertCircle size={28} className="text-cyan-400/50 mb-2" />
                          <p className="text-xs text-white/50 uppercase font-bold tracking-widest">No matching NFT assets found</p>
                          <p className="text-[9px] text-white/30 uppercase mt-1">Try relaxing filters or broadening your Token ID range</p>
                        </div>
                      );
                    }

                    return (
                      <div className="flex flex-col gap-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                          {filteredNFTs.map((item) => {
                            const isWeapon = item.t === 'weapon';
                            const playerCoins = gameState?.pl.inv.gold_coins || 0;
                            const canAfford = playerCoins >= item.price;
                            
                            return (
                              <div 
                                key={item.id}
                                style={{ boxShadow: `0 0 15px ${item.rarityColor}12` }}
                                className="bg-zinc-900/60 border border-white/10 hover:border-white/20 rounded-2xl p-4 flex flex-col justify-between gap-3 relative overflow-hidden transition-all group hover:scale-[1.02]"
                              >
                                {/* Glow badge */}
                                <div 
                                  className="absolute top-0 right-0 w-24 h-24 blur-2xl opacity-10 rounded-full" 
                                  style={{ backgroundColor: item.rarityColor }}
                                />

                                <div>
                                  <div className="flex justify-between items-center mb-3">
                                    <span 
                                      style={{ color: item.rarityColor, borderColor: `${item.rarityColor}33` }}
                                      className="text-[8px] font-black uppercase border px-1.5 py-0.5 rounded tracking-widest bg-white/[0.01]"
                                    >
                                      {item.rarity}
                                    </span>
                                    <span className="text-[9px] opacity-40 font-mono">TOKEN ID: #{item.tokenId}</span>
                                  </div>

                                  {/* Beautiful Generative Holographic Asset Art */}
                                  <NFTCollectibleArt item={item} />

                                  <h3 className="text-xs font-bold text-white mt-3 truncate group-hover:text-cyan-300 transition-colors">
                                    {item.n}
                                  </h3>

                                  {/* Stats details */}
                                  <div className="mt-2.5 bg-black/40 p-2 rounded-xl text-[9px] flex flex-col gap-1 text-white/80">
                                    {isWeapon ? (
                                      <>
                                        <div className="flex justify-between">
                                          <span>⚔️ Base DMG:</span>
                                          <span className="font-bold text-red-400">+{item.dmg}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span>⚡ Speed Cooldown:</span>
                                          <span className="font-bold text-orange-400">{item.spd} ticks</span>
                                        </div>
                                      </>
                                    ) : (
                                      <>
                                        <div className="flex justify-between">
                                          <span>🛡️ Defense:</span>
                                          <span className="font-bold text-blue-400">+{item.def}</span>
                                        </div>
                                        {item.hpBonus && (
                                          <div className="flex justify-between">
                                            <span>❤️ HP Max:</span>
                                            <span className="font-bold text-green-400">+{item.hpBonus}</span>
                                          </div>
                                        )}
                                        {item.mpBonus && (
                                          <div className="flex justify-between">
                                            <span>💙 MP Max:</span>
                                            <span className="font-bold text-fuchsia-400">+{item.mpBonus}</span>
                                          </div>
                                        )}
                                        {item.spdBonus && (
                                          <div className="flex justify-between">
                                            <span>🏃 Run Speed:</span>
                                            <span className="font-bold text-teal-400">+{item.spdBonus}</span>
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>

                                <div className="border-t border-white/5 pt-2.5 flex flex-col gap-1.5">
                                  <div className="flex justify-between items-center text-[10px]">
                                    <span className="opacity-40">MINT PRICE:</span>
                                    <span className="font-black text-yellow-400">🪙 {item.price} Coins</span>
                                  </div>

                                  <button
                                    onClick={() => handleBuyNFT(item.tokenId)}
                                    disabled={!canAfford}
                                    className={`w-full py-1.5 rounded-xl text-[9px] font-bold uppercase tracking-widest cursor-pointer transition-all ${
                                      canAfford 
                                        ? 'bg-cyan-600 hover:bg-cyan-500 text-white hover:shadow-lg active:scale-95' 
                                        : 'bg-zinc-800 text-zinc-600 border border-zinc-700/10 cursor-not-allowed'
                                    }`}
                                  >
                                    {canAfford ? '🛒 Purchase' : '❌ Insufficient'}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Pagination (only show if not specific Token ID Search) */}
                        {!nftSearchToken && (
                          <div className="flex justify-between items-center bg-white/[0.02] border border-white/5 p-3 rounded-2xl text-[10px]">
                            <button 
                              disabled={nftPage === 0}
                              onClick={() => setNftPage(prev => Math.max(0, prev - 1))}
                              className="px-3 py-1.5 bg-zinc-900 border border-white/10 rounded-xl hover:border-cyan-400 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed text-white uppercase font-bold"
                            >
                              ◀ Prev Page
                            </button>
                            <span className="opacity-50 font-bold uppercase tracking-widest text-cyan-400">
                              Block Page {nftPage + 1}
                            </span>
                            <button 
                              disabled={filteredNFTs.length < 12}
                              onClick={() => setNftPage(prev => prev + 1)}
                              className="px-3 py-1.5 bg-zinc-900 border border-white/10 rounded-xl hover:border-cyan-400 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed text-white uppercase font-bold"
                            >
                              Next Page ▶
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Right 1 Column: Liquidity Desk (Sell Items) */}
                <div className="bg-zinc-900/40 border border-white/5 p-5 rounded-2xl flex flex-col gap-4">
                  <div className="text-sm font-bold uppercase tracking-wider text-cyan-400 border-b border-white/10 pb-1 flex items-center gap-1.5">
                    <Backpack size={14} /> Liquidity & Swap Desk
                  </div>
                  <p className="text-[9px] opacity-40 uppercase leading-relaxed">
                    Instantly liquidate your excess items, harvested materials, resources, or bought NFTs for solid Gold Coins to purchase new items.
                  </p>

                  <div className="flex flex-col gap-2.5 max-h-[50vh] overflow-y-auto pr-1">
                    {(() => {
                      const sellableItems = Object.entries(gameState?.pl.inv || {}).filter(([k, qty]) => {
                        return k !== 'gold_coins' && (qty as number) > 0 && IT[k] !== undefined;
                      });

                      if (sellableItems.length === 0) {
                        return (
                          <div className="p-8 text-center bg-white/[0.01] border border-dashed border-white/5 rounded-xl text-white/30 text-[10px] uppercase font-bold tracking-widest">
                            No sellable items in inventory
                          </div>
                        );
                      }

                      return sellableItems.map(([key, qty]: [string, any]) => {
                        const itemInfo = IT[key];
                        if (!itemInfo) return null;
                        
                        // Define sell values matching the backend handlers
                        const prices: Record<string, number> = {
                          wood: 1, stone: 1, fiber: 1, flint: 2, meat: 2, berry: 1, mushroom: 2,
                          cooked_meat: 5, iron_ore: 3, iron_bar: 8, steel_bar: 15,
                          copper_ore: 2, copper_bar: 5, gold_ore: 10, gold_bar: 25,
                          mithril_ore: 25, mithril_bar: 60, crystal: 15, magic_essence: 20,
                          void_crystal: 50, celestial_shard: 150, dragon_scale: 200, silk: 15,
                          mana_crystal: 30
                        };

                        let pricePerUnit = 2;
                        if (key.startsWith('nft_')) {
                          pricePerUnit = Math.round(itemInfo.price * 0.7);
                        } else if (prices[key] !== undefined) {
                          pricePerUnit = prices[key];
                        } else {
                          if (itemInfo.t === 'weapon') {
                            pricePerUnit = Math.round((itemInfo.dmg || 10) * 1.5);
                          } else if (itemInfo.t === 'armor') {
                            pricePerUnit = Math.round((itemInfo.def || 5) * 2.0);
                          }
                        }

                        return (
                          <div 
                            key={key} 
                            className="bg-black/40 border border-white/5 rounded-xl p-3 flex justify-between items-center gap-2 group hover:border-cyan-500/20 transition-all"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{itemInfo.ico}</span>
                              <div className="flex flex-col">
                                <span className="text-[11px] font-bold text-white truncate max-w-[120px]">{itemInfo.n}</span>
                                <span className="text-[8px] opacity-40 uppercase">Held: {qty}x</span>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <span className="text-[9px] font-black text-yellow-400">🪙 {pricePerUnit} ea</span>
                              <div className="flex gap-1">
                                <button 
                                  onClick={() => handleSellItem(key, 1)}
                                  className="px-2 py-0.5 bg-white/5 hover:bg-cyan-500/10 text-cyan-400 border border-white/10 hover:border-cyan-400/40 rounded text-[8px] font-bold uppercase tracking-wider cursor-pointer transition-all active:scale-95"
                                >
                                  Sell 1
                                </button>
                                {qty > 1 && (
                                  <button 
                                    onClick={() => handleSellItem(key, qty)}
                                    className="px-2 py-0.5 bg-white/5 hover:bg-yellow-500/10 text-yellow-400 border border-white/10 hover:border-yellow-400/40 rounded text-[8px] font-bold uppercase tracking-wider cursor-pointer transition-all active:scale-95"
                                  >
                                    All
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showShop && (
          <Shop 
            onClose={() => setShowShop(false)} 
            playerGold={gameState?.pl?.inv?.gold_coins || 0} 
            onAwardNFTs={handleAwardNFTs} 
            addLog={addLog} 
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTownShop && (
          <TownShop 
            onClose={() => setShowTownShop(false)}
            shopType={townShopType}
            gameState={gameState}
            setGameState={setGameState}
            addLog={addLog}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeNPC && (
          <NPCDialogue 
            npc={activeNPC}
            onClose={() => setActiveNPC(null)}
            gameState={gameState}
            setGameState={setGameState}
            addLog={addLog}
            spawnExplosion={(col, count, style) => {
              const s = stateRef.current;
              if (s) {
                spawnExplosion(s, s.pl.x, s.pl.y, col, count, style);
                setGameState({ ...s });
              }
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showResearch && (
          <ResearchTree 
            onClose={() => setShowResearch(false)}
            gameState={gameState}
            setGameState={setGameState}
            addLog={addLog}
            spawnExplosion={(col, count, style) => {
              const s = stateRef.current;
              if (s) {
                spawnExplosion(s, s.pl.x, s.pl.y, col, count, style);
                setGameState({ ...s });
              }
            }}
            setRecipes={setRecipes}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showMusicMenu && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-black/95 backdrop-blur-md flex items-center justify-center p-4"
          >
            <div className="max-w-xl w-full bg-zinc-950 border border-rose-500/30 rounded-3xl p-6 md:p-8 flex flex-col gap-6 shadow-[0_0_50px_rgba(244,63,94,0.15)] text-white font-mono pointer-events-auto">
              <div className="flex justify-between items-center border-b border-white/10 pb-4">
                <div className="flex items-center gap-2.5">
                  <Music size={22} className="text-rose-400" />
                  <div>
                    <h2 className="text-xl font-bold uppercase tracking-wider text-rose-400 font-mono">PROCEDURAL SYNTHESIZER</h2>
                    <p className="text-[10px] opacity-50 uppercase mt-0.5 font-mono">Real-time Web Audio Synthesizer Loop & FX Station</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowMusicMenu(false)}
                  className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Music Playback Status Bar */}
              <div className="bg-white/[0.01] border border-white/5 p-5 rounded-2xl flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setIsMusicPlaying(!isMusicPlaying)}
                      className={`w-12 h-12 rounded-full border flex items-center justify-center transition-all cursor-pointer ${
                        isMusicPlaying 
                          ? 'bg-rose-500 text-black border-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.4)] hover:bg-rose-400' 
                          : 'bg-zinc-900 text-rose-400 border-rose-500/30 hover:bg-zinc-800'
                      }`}
                    >
                      {isMusicPlaying ? <Pause size={20} /> : <Play size={20} className="ml-1" />}
                    </button>
                    <div>
                      <div className="text-xs font-extrabold uppercase tracking-wider text-white">
                        {isMusicPlaying ? 'SYNTH ENGINE ACTIVE' : 'SYNTH ENGINE MUTED'}
                      </div>
                      <div className="text-[9px] text-zinc-400 uppercase tracking-widest mt-0.5 font-mono">
                        {isMusicPlaying ? 'Generating real-time synth waves...' : 'Click play to initialize Web Audio API'}
                      </div>
                    </div>
                  </div>

                  {/* Animated soundwave bars */}
                  {isMusicPlaying && (
                    <div className="flex items-end gap-1.5 h-6">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div 
                          key={i} 
                          className="w-1 bg-rose-400 rounded-full animate-bounce [animation-duration:0.6s]" 
                          style={{ 
                            height: `${[40, 90, 60, 100, 50][i-1]}%`,
                            animationDelay: `${i * 0.12}s`
                          }} 
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Volume Controller Slider */}
                <div className="flex items-center gap-3 border-t border-white/5 pt-4 mt-2">
                  <span className="text-rose-400 shrink-0">
                    {musicVolume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
                  </span>
                  <input 
                    type="range" 
                    min="0" 
                    max="0.80" 
                    step="0.05" 
                    value={musicVolume}
                    onChange={(e) => setMusicVolume(parseFloat(e.target.value))}
                    className="accent-rose-500 flex-1 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-[10px] font-bold text-zinc-300 w-10 text-right">
                    {Math.round(musicVolume * 125)}%
                  </span>
                </div>
              </div>

              {/* Track Selection Grid */}
              <div className="flex flex-col gap-2.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Available Synthesizer Presets</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: 'ethereal', n: 'Ethereal Whispers', ico: '🌌', col: 'border-fuchsia-500/20 text-fuchsia-400 hover:border-fuchsia-400/50 bg-fuchsia-950/5', desc: 'A-minor pad progression with floating pentatonic melodies' },
                    { id: 'verdant', n: 'Verdant Forest', ico: '🌲', col: 'border-emerald-500/20 text-emerald-400 hover:border-emerald-400/50 bg-emerald-950/5', desc: 'Warm sine-wave pluck chords with bright G-major plucks' },
                    { id: 'cosmic', n: 'Cosmic Expedition', ico: '🚀', col: 'border-cyan-500/20 text-cyan-400 hover:border-cyan-400/50 bg-cyan-950/5', desc: 'Cybernetic space chords with deep retro sweeps and plucks' },
                  ].map((track) => {
                    const active = musicTrack === track.id;
                    return (
                      <button
                        key={track.id}
                        onClick={() => {
                          setMusicTrack(track.id as any);
                          setIsMusicPlaying(true);
                        }}
                        className={`p-4 rounded-2xl border text-left transition-all active:scale-95 flex flex-col justify-between gap-3 h-32 cursor-pointer ${track.col} ${
                          active 
                            ? 'border-rose-500 bg-rose-500/5 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.1)]' 
                            : 'border-white/5 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <div className="flex justify-between items-start w-full">
                          <span className="text-xl">{track.ico}</span>
                          {active && (
                            <span className="text-[7px] bg-rose-500 text-black px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-wider text-white">{track.n}</div>
                          <p className="text-[8px] opacity-50 lowercase tracking-tight leading-normal mt-0.5 font-sans font-medium">{track.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Engine Technical Explainer */}
              <div className="bg-zinc-900/50 border border-white/5 p-4 rounded-2xl text-[9px] text-zinc-500 uppercase leading-relaxed font-sans">
                💡 <span className="text-rose-400/80 font-mono font-bold">Procedural Synthesis Engine:</span> Unlike standard static audio streams, this engine utilizes raw browser oscillator nodes, envelope shaping, lowpass filter sweeping, and custom feedback delay lines to construct non-repeating, dynamic background tracks dynamically.
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- Supply Crate Storage UI Overlay --- */}
      <AnimatePresence>
        {activeCrateIndex !== null && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <div className="max-w-4xl w-full bg-zinc-950 border border-amber-500/30 rounded-3xl p-6 md:p-8 flex flex-col gap-6 shadow-[0_0_50px_rgba(245,158,11,0.1)] text-white font-mono pointer-events-auto">
              <div className="flex justify-between items-center border-b border-white/10 pb-4">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">📦</span>
                  <div>
                    <h2 className="text-xl font-bold uppercase tracking-wider text-amber-400 font-mono">SUPPLY STORAGE CRATE</h2>
                    <p className="text-[10px] opacity-50 uppercase mt-0.5 font-mono">Secure containment facility for storing resources and supplies</p>
                  </div>
                </div>
                <button 
                  onClick={() => setActiveCrateIndex(null)}
                  className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all cursor-pointer text-zinc-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              {/* Two columns: Left is Crate Storage, Right is Player Backpack */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 overflow-hidden max-h-[60vh]">
                {/* Left Column: Crate Storage */}
                <div className="flex flex-col gap-3 bg-zinc-900/40 border border-white/5 rounded-2xl p-4 overflow-y-auto">
                  <div className="flex justify-between items-center border-b border-white/5 pb-2">
                    <span className="text-xs font-bold text-amber-400">📦 CRATE CONTENTS</span>
                    <button
                      onClick={() => {
                        const s = stateRef.current;
                        if (!s || activeCrateIndex === null) return;
                        const crate = s.objs[activeCrateIndex];
                        if (!crate || !crate.items) return;
                        // Move everything in crate to player inventory
                        Object.entries(crate.items).forEach(([k, qty]: any) => {
                          if (qty > 0) {
                            s.pl.inv[k] = (s.pl.inv[k] || 0) + qty;
                          }
                        });
                        crate.items = {};
                        addLog("📦 Transferred all items to Backpack!", "#eab308");
                        setGameState({ ...s });
                      }}
                      className="text-[9px] uppercase px-2 py-1 bg-amber-500/20 text-amber-300 rounded hover:bg-amber-500/30 active:scale-95 transition-all cursor-pointer"
                    >
                      Take All
                    </button>
                  </div>

                  {/* Render storage slots */}
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 pb-2">
                    {(() => {
                      const crate = gameState?.objs?.[activeCrateIndex];
                      const crateItems = crate?.items || {};
                      const storedItems = Object.entries(crateItems).filter(([_, qty]: any) => qty > 0);

                      if (storedItems.length === 0) {
                        return (
                          <div className="col-span-full py-12 text-center text-[10px] text-zinc-500 uppercase">
                            Crate is empty. Click items in your backpack to store them here!
                          </div>
                        );
                      }

                      return storedItems.map(([k, qty]: any) => {
                        const it = IT[k];
                        return (
                          <button
                            key={k}
                            onClick={() => {
                              const s = stateRef.current;
                              if (!s || activeCrateIndex === null) return;
                              const targetCrate = s.objs[activeCrateIndex];
                              if (!targetCrate || !targetCrate.items || !targetCrate.items[k]) return;
                              
                              // Withdraw 1 item
                              targetCrate.items[k]--;
                              s.pl.inv[k] = (s.pl.inv[k] || 0) + 1;
                              if (targetCrate.items[k] <= 0) {
                                delete targetCrate.items[k];
                              }
                              setGameState({ ...s });
                            }}
                            className="flex flex-col items-center justify-center p-2 rounded-xl bg-zinc-950 border border-white/5 hover:border-amber-500/40 hover:bg-zinc-900/50 active:scale-95 transition-all relative aspect-square cursor-pointer"
                            title={`Click to withdraw 1 ${it?.n || k}`}
                          >
                            <span className="text-xl">{it?.ico || '📦'}</span>
                            <span className="text-[8px] mt-1 text-zinc-400 truncate w-full text-center">{it?.n || k}</span>
                            <span className="absolute top-1 right-1 bg-amber-500 text-zinc-950 text-[8px] font-black px-1 rounded-md min-w-[14px] text-center shadow">
                              {qty}
                            </span>
                          </button>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* Right Column: Player Backpack */}
                <div className="flex flex-col gap-3 bg-zinc-900/40 border border-white/5 rounded-2xl p-4 overflow-y-auto">
                  <div className="flex justify-between items-center border-b border-white/5 pb-2">
                    <span className="text-xs font-bold text-emerald-400">🎒 BACKPACK INVENTORY</span>
                    <button
                      onClick={() => {
                        const s = stateRef.current;
                        if (!s || activeCrateIndex === null) return;
                        const crate = s.objs[activeCrateIndex];
                        if (!crate) return;
                        if (!crate.items) crate.items = {};
                        // Store all non-essential elements from backpack
                        const nonEssentials = ['wood', 'stone', 'fiber', 'copper_ore', 'iron_ore', 'gold_ore', 'coal', 'sulfur', 'crystal', 'leather', 'feather', 'bone', 'resin', 'raw_meat', 'raw_fish', 'cooked_meat', 'cooked_fish'];
                        let count = 0;
                        nonEssentials.forEach((k) => {
                          const qty = s.pl.inv[k] || 0;
                          if (qty > 0) {
                            crate.items[k] = (crate.items[k] || 0) + qty;
                            s.pl.inv[k] = 0;
                            count++;
                          }
                        });
                        if (count > 0) {
                          addLog("📦 Transferred all raw supplies to Crate!", "#10b981");
                        }
                        setGameState({ ...s });
                      }}
                      className="text-[9px] uppercase px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded hover:bg-emerald-500/30 active:scale-95 transition-all cursor-pointer"
                    >
                      Store All Supplies
                    </button>
                  </div>

                  {/* Render player inventory slots */}
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 pb-2">
                    {(() => {
                      const invItems = Object.entries(gameState?.pl?.inv || {}).filter(([k, qty]: any) => qty > 0 && k !== 'gold_coins');

                      if (invItems.length === 0) {
                        return (
                          <div className="col-span-full py-12 text-center text-[10px] text-zinc-500 uppercase">
                            Backpack is empty!
                          </div>
                        );
                      }

                      return invItems.map(([k, qty]: any) => {
                        const it = IT[k];
                        return (
                          <button
                            key={k}
                            onClick={() => {
                              const s = stateRef.current;
                              if (!s || activeCrateIndex === null) return;
                              const targetCrate = s.objs[activeCrateIndex];
                              if (!targetCrate) return;
                              if (!targetCrate.items) targetCrate.items = {};
                              
                              // Deposit 1 item
                              s.pl.inv[k]--;
                              targetCrate.items[k] = (targetCrate.items[k] || 0) + 1;
                              setGameState({ ...s });
                            }}
                            className="flex flex-col items-center justify-center p-2 rounded-xl bg-zinc-950 border border-white/5 hover:border-emerald-500/40 hover:bg-zinc-900/50 active:scale-95 transition-all relative aspect-square cursor-pointer"
                            title={`Click to deposit 1 ${it?.n || k}`}
                          >
                            <span className="text-xl">{it?.ico || '📦'}</span>
                            <span className="text-[8px] mt-1 text-zinc-400 truncate w-full text-center">{it?.n || k}</span>
                            <span className="absolute top-1 right-1 bg-emerald-500 text-zinc-950 text-[8px] font-black px-1 rounded-md min-w-[14px] text-center shadow">
                              {qty}
                            </span>
                          </button>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>

              <div className="bg-zinc-900/50 border border-white/5 p-4 rounded-2xl text-[9px] text-zinc-500 uppercase leading-relaxed text-center">
                💡 <span className="text-amber-400 font-bold">PRO-TIP:</span> Click any individual item inside either container to instantly transfer <span className="text-white font-black">1 unit</span> of it to the other container!
              </div>
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

// --- Character Style and Profession Customizer Sub-Component ---
interface CharCustomizerPanelProps {
  s: any;
  onClose: () => void;
}

const CharCustomizerPanel: React.FC<CharCustomizerPanelProps> = ({ s, onClose }) => {
  const [name, setName] = useState(s.pl.charName || 'Hero');
  const [selectedIco, setSelectedIco] = useState(s.pl.ico || '🧍');
  const [selectedClass, setSelectedClass] = useState(s.pl.class || 'Survivor');

  const emojis = ['🧍', '🧙‍♂️', '🛡️', '🥷', '🏹', '🧑‍🌾', '🧑‍🚀', '👩', '🧔', '🧝'];
  const classes = [
    { name: 'Survivor', desc: 'Balanced baseline survivor. No major disadvantages.', icon: '🧍', bonus: 'None' },
    { name: 'Warrior', desc: 'A rugged melee brawler. Permanently gains +20 Max HP and +4 flat defense.', icon: '🛡️', bonus: '+20 Max HP, +4 Defense' },
    { name: 'Wizard', desc: 'Master of spellcraft. Gains +20 Max Mana and generates +1 Mana every 2 seconds.', icon: '🧙‍♂️', bonus: '+20 Max MP, Mana Regen' },
    { name: 'Ninja', desc: 'Silent agile operative. Permanently gains +15% extra movement speed.', icon: '🥷', bonus: '+15% Speed' },
    { name: 'Ranger', desc: 'Expert marksman. Ranged bow attacks deal +12% flat bonus damage.', icon: '🏹', bonus: '+12% Ranged DMG' },
    { name: 'Farmer', desc: 'Tamed companion whisperer. Double berry taming efficacy and gathers +1 extra log/stone from harvest.', icon: '🧑‍🌾', bonus: 'Harvest bonus, Tame rate x2' },
  ];

  const handleApply = () => {
    s.pl.charName = name || 'Hero';
    s.pl.ico = selectedIco;
    
    const oldClass = s.pl.class;
    s.pl.class = selectedClass;
    
    if (selectedClass !== oldClass) {
      // Revert old class bonuses
      if (oldClass === 'Warrior') {
        s.pl.mhp = Math.max(100, s.pl.mhp - 20);
        s.pl.def = Math.max(0, s.pl.def - 4);
      }
      if (oldClass === 'Wizard') {
        s.pl.mmp = Math.max(100, s.pl.mmp - 20);
      }
      
      // Apply new bonuses
      if (selectedClass === 'Warrior') {
        s.pl.mhp += 20;
        s.pl.hp = s.pl.mhp;
        s.pl.def += 4;
      }
      if (selectedClass === 'Wizard') {
        s.pl.mmp += 20;
        s.pl.mp = s.pl.mmp;
      }
    }
    
    // Add nice global log
    const logStr = `👤 Character Re-styled: Now playing as "${name}" the ${selectedClass}!`;
    if (typeof window !== 'undefined' && (window as any).addGameLog) {
      (window as any).addGameLog(logStr, '#c084fc');
    }
    
    // Trigger visual blast particles
    if (s.parts) {
      s.parts.push({ x: s.pl.x, y: s.pl.y, vx: 0, vy: 0, life: 25, col: '#c084fc', sz: 8 });
    }
    
    onClose();
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto font-mono text-zinc-300">
      
      {/* Visual Avatar Preview */}
      <div className="bg-zinc-900/60 border border-white/10 p-5 rounded-2xl flex flex-col sm:flex-row items-center gap-6">
        <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-400 flex items-center justify-center text-4xl shadow-inner shadow-black/40 border border-purple-500/30 animate-pulse shrink-0">
          {selectedIco}
        </div>
        <div className="space-y-1.5 flex-1 w-full text-center sm:text-start">
          <div className="text-[10px] text-purple-400 uppercase font-extrabold tracking-widest">Character Preview</div>
          <h3 className="text-xl font-black text-white">{name}</h3>
          <p className="text-xs text-zinc-400 leading-normal">
            Profession Role: <span className="text-purple-300 font-extrabold">{selectedClass}</span>
          </p>
        </div>
      </div>

      {/* Editing Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Left Side: Identity */}
        <div className="bg-zinc-900/40 border border-white/5 p-5 rounded-2xl space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] text-purple-400 font-extrabold tracking-widest uppercase">Character Name</label>
            <input 
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={16}
              className="bg-black/50 border border-white/10 hover:border-white/20 focus:border-purple-400/80 rounded-xl px-4 py-3 text-white font-bold tracking-wide outline-none w-full text-sm"
            />
          </div>

          <div className="space-y-2.5">
            <label className="text-[10px] text-purple-400 font-extrabold tracking-widest uppercase block">Select Map Sprite / Avatar</label>
            <div className="grid grid-cols-5 gap-2">
              {emojis.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => setSelectedIco(emoji)}
                  className={`aspect-square text-2xl flex items-center justify-center rounded-xl transition-all cursor-pointer ${
                    selectedIco === emoji 
                      ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20 scale-105 border border-purple-400' 
                      : 'bg-black/40 hover:bg-white/5 border border-white/5'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Professional Class */}
        <div className="bg-zinc-900/40 border border-white/5 p-5 rounded-2xl space-y-3.5">
          <label className="text-[10px] text-purple-400 font-extrabold tracking-widest uppercase block">Assign Profession Class</label>
          
          <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
            {classes.map((cls) => (
              <button
                key={cls.name}
                onClick={() => setSelectedClass(cls.name)}
                className={`w-full p-3 rounded-xl border flex items-start gap-3 transition-all text-start cursor-pointer ${
                  selectedClass === cls.name 
                    ? 'bg-purple-950/20 border-purple-500 text-white' 
                    : 'bg-black/20 border-white/5 hover:bg-white/5 text-zinc-400'
                }`}
              >
                <span className="text-xl mt-0.5">{cls.icon}</span>
                <div className="space-y-0.5">
                  <div className="text-xs font-black flex items-center gap-2">
                    <span>{cls.name}</span>
                    {cls.bonus !== 'None' && (
                      <span className="text-[8px] bg-purple-500/15 text-purple-300 font-bold px-1.5 py-0.2 rounded uppercase">
                        {cls.bonus}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] opacity-75 leading-normal">{cls.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* Footer Controls */}
      <div className="flex justify-end gap-3 pt-4 border-t border-white/10 shrink-0">
        <button 
          onClick={onClose}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-extrabold uppercase text-xs tracking-wider rounded-xl cursor-pointer transition-all active:scale-95"
        >
          Cancel
        </button>
        <button 
          onClick={handleApply}
          className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-black uppercase text-xs tracking-widest rounded-xl cursor-pointer transition-all active:scale-95 shadow-lg shadow-purple-500/20"
        >
          Apply & Save
        </button>
      </div>

    </div>
  );
};
