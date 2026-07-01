import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Coins, 
  ShoppingBag, 
  Hammer, 
  FlaskConical, 
  TrendingUp, 
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  PackageOpen,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { IT } from './SurvivalGame';

interface TownShopProps {
  onClose: () => void;
  shopType: 'general' | 'blacksmith' | 'alchemist';
  gameState: any;
  setGameState: (s: any) => void;
  addLog: (msg: string, col?: string) => void;
}

export default function TownShop({ onClose, shopType: initialShopType, gameState, setGameState, addLog }: TownShopProps) {
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
  const [shopType, setShopType] = useState<'general' | 'blacksmith' | 'alchemist'>(initialShopType);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  if (!gameState || !gameState.pl) return null;

  const playerGold = gameState.pl.inv.gold_coins || 0;

  // Shop inventories with buy prices
  const shopInventories: Record<string, Array<{ id: string; price: number; stock?: number }>> = {
    general: [
      { id: 'cooked_meat', price: 20 },
      { id: 'cooked_fish', price: 30 },
      { id: 'berry', price: 5 },
      { id: 'wood', price: 6 },
      { id: 'fiber', price: 4 },
      { id: 'leather', price: 15 },
      { id: 'torch', price: 10 },
      { id: 'workbench', price: 40 }
    ],
    blacksmith: [
      { id: 'iron_ore', price: 12 },
      { id: 'copper_ore', price: 8 },
      { id: 'coal', price: 10 },
      { id: 'flint', price: 5 },
      { id: 'iron_bar', price: 45 },
      { id: 'copper_bar', price: 30 },
      { id: 'gold_bar', price: 90 },
      { id: 'copper_sword', price: 75 },
      { id: 'iron_sword', price: 180 },
      { id: 'stone_pickaxe', price: 40 }
    ],
    alchemist: [
      { id: 'heal_potion', price: 40 },
      { id: 'mana_potion', price: 40 },
      { id: 'herb', price: 10 },
      { id: 'magic_essence', price: 95 },
      { id: 'crystal', price: 80 },
      { id: 'mana_crystal', price: 120 }
    ]
  };

  // Base sell values of items (percentage of buy price, or defined constants)
  const getSellPrice = (itemId: string) => {
    const item = IT[itemId];
    if (!item) return 0;
    
    // Find buy price if it exists in any shop
    let buyPrice = 0;
    for (const shop of Object.values(shopInventories)) {
      const match = shop.find(i => i.id === itemId);
      if (match) {
        buyPrice = match.price;
        break;
      }
    }

    if (buyPrice > 0) {
      return Math.max(1, Math.floor(buyPrice * 0.45)); // 45% sellback rate
    }

    // Default rates for high-tier loot not directly sold in shops
    const fallbackSellPrices: Record<string, number> = {
      stone: 1,
      sulfur: 8,
      void_crystal: 65,
      celestial_shard: 150,
      dragon_scale: 180,
      meat: 4,
      raw_fish: 6,
      clay: 3,
      gold_ore: 25,
      mithril_ore: 50,
      mithril_bar: 220,
      gem: 75,
      bone: 3,
      venom: 10,
      silk: 12,
      feather: 2,
      astral_flower: 25
    };

    return fallbackSellPrices[itemId] || 2;
  };

  const handleBuyItem = (itemId: string, price: number) => {
    if (playerGold < price) {
      addLog(`❌ Cannot purchase! You need 🪙 ${price} Gold Coins.`, '#ef4444');
      return;
    }

    const s = { ...gameState };
    s.pl.inv.gold_coins = playerGold - price;
    s.pl.inv[itemId] = (s.pl.inv[itemId] || 0) + 1;
    
    const item = IT[itemId];
    addLog(`🛒 Purchased 1x ${item?.ico || '📦'} ${item?.n || itemId} for 🪙 ${price} Gold Coins!`, '#10b981');
    
    // Add light sparkle particle effect at player center
    if (s.parts) {
      for (let i = 0; i < 12; i++) {
        s.parts.push({
          x: s.pl.x + (Math.random() - 0.5) * 16,
          y: s.pl.y + (Math.random() - 0.5) * 16,
          vx: (Math.random() - 0.5) * 3,
          vy: (Math.random() - 0.5) * 3,
          life: 15,
          maxLife: 15,
          col: '#22c55e',
          sz: 2 + Math.random() * 2
        });
      }
    }

    setGameState(s);
  };

  const handleSellItem = (itemId: string) => {
    const qty = gameState.pl.inv[itemId] || 0;
    if (qty <= 0) return;

    const sellPrice = getSellPrice(itemId);
    const s = { ...gameState };
    
    s.pl.inv[itemId] = qty - 1;
    s.pl.inv.gold_coins = (s.pl.inv.gold_coins || 0) + sellPrice;
    
    const item = IT[itemId];
    addLog(`🪙 Sold 1x ${item?.ico || '📦'} ${item?.n || itemId} for 🪙 ${sellPrice} Gold Coins!`, '#eab308');

    // Particle burst
    if (s.parts) {
      for (let i = 0; i < 8; i++) {
        s.parts.push({
          x: s.pl.x + (Math.random() - 0.5) * 12,
          y: s.pl.y + (Math.random() - 0.5) * 12,
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2,
          life: 12,
          maxLife: 12,
          col: '#eab308',
          sz: 1.5 + Math.random() * 1.5
        });
      }
    }

    setGameState(s);
  };

  const getMerchantName = () => {
    if (shopType === 'general') return 'Caelen - General Provisioner';
    if (shopType === 'blacksmith') return 'Kaelen Steelhand - Blacksmith';
    return 'Eldrin the Sage - Royal Alchemist';
  };

  const getMerchantIco = () => {
    if (shopType === 'general') return '🧔';
    if (shopType === 'blacksmith') return '⚒️';
    return '🧙‍♂️';
  };

  const getMerchantGlow = () => {
    if (shopType === 'general') return 'shadow-[0_0_50px_rgba(34,197,94,0.12)] border-green-500/20 text-green-400';
    if (shopType === 'blacksmith') return 'shadow-[0_0_50px_rgba(249,115,22,0.12)] border-orange-500/20 text-orange-400';
    return 'shadow-[0_0_50px_rgba(168,85,247,0.12)] border-purple-500/20 text-purple-400';
  };

  const getMerchantBanner = () => {
    if (shopType === 'general') return 'bg-gradient-to-r from-emerald-950/40 via-zinc-900 to-zinc-950 border-emerald-500/20';
    if (shopType === 'blacksmith') return 'bg-gradient-to-r from-orange-950/40 via-zinc-900 to-zinc-950 border-orange-500/20';
    return 'bg-gradient-to-r from-purple-950/40 via-zinc-900 to-zinc-950 border-purple-500/20';
  };

  // Get player inventory items suitable for sellback
  const getPlayerSellables = () => {
    return Object.entries(gameState.pl.inv)
      .filter(([k, v]) => {
        const count = v as number;
        if (count <= 0 || k === 'gold_coins') return false;
        const item = IT[k];
        if (!item) return false;
        
        // Match inventory items appropriate to selected merchant type for immersive logic
        if (shopType === 'general') {
          return item.t === 'food' || item.t === 'pot' || ['wood', 'fiber', 'leather', 'bone', 'feather', 'silk'].includes(k);
        } else if (shopType === 'blacksmith') {
          return item.t === 'armor' || item.t === 'tool' || item.id || ['stone', 'iron_ore', 'copper_ore', 'gold_ore', 'mithril_ore', 'iron_bar', 'copper_bar', 'gold_bar', 'mithril_bar', 'coal', 'clay'].includes(k);
        } else {
          return ['herb', 'magic_essence', 'crystal', 'void_crystal', 'mana_crystal', 'celestial_shard', 'sulfur', 'venom', 'astral_flower'].includes(k) || item.t === 'pot';
        }
      })
      .map(([k, v]) => ({
        id: k,
        qty: v as number,
        price: getSellPrice(k)
      }));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 font-mono overflow-hidden">
      <motion.div 
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 20 }}
        className={`relative w-full max-w-4xl h-[85vh] bg-zinc-950 border rounded-3xl flex flex-col overflow-hidden text-white ${getMerchantGlow()}`}
      >
        {/* Merchant Hero Header Banner */}
        <div className={`p-5 sm:p-6 flex flex-col sm:flex-row justify-between items-center border-b shrink-0 gap-4 ${getMerchantBanner()}`}>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center text-3xl shadow-inner select-none">
              {getMerchantIco()}
            </div>
            <div className="text-center sm:text-left">
              <h2 className="text-lg font-black tracking-widest text-zinc-100 uppercase">
                {getMerchantName()}
              </h2>
              <p className="text-[10px] uppercase tracking-wider text-zinc-400 mt-0.5">
                {shopType === 'general' ? '🍎 Consumables, tools, and general structural materials' :
                 shopType === 'blacksmith' ? '⚒️ High quality raw ore refining, weapons, and iron works' :
                 '🧙‍♂️ Healing herbs, magical essences, and pristine focusing crystals'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-black/40 border border-zinc-800 px-3 py-1.5 rounded-full text-xs font-bold text-amber-400">
              <Coins size={14} className="text-amber-500 animate-bounce" />
              <span>{playerGold} Gold</span>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/5 rounded-full border border-white/5 hover:border-white/15 transition-all text-white/60 hover:text-white cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Merchant Selectors & Tabs */}
        <div className="bg-zinc-900/30 border-b border-white/5 px-6 py-3 flex flex-wrap justify-between items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5 bg-black/50 p-1 rounded-xl border border-white/5">
            <button
              onClick={() => setShopType('general')}
              className={`px-3 py-1.5 text-[9px] font-bold rounded-lg uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer ${
                shopType === 'general' ? 'bg-green-600 text-white font-extrabold shadow-md' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <ShoppingBag size={11} /> General
            </button>
            <button
              onClick={() => setShopType('blacksmith')}
              className={`px-3 py-1.5 text-[9px] font-bold rounded-lg uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer ${
                shopType === 'blacksmith' ? 'bg-orange-600 text-white font-extrabold shadow-md' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Hammer size={11} /> Blacksmith
            </button>
            <button
              onClick={() => setShopType('alchemist')}
              className={`px-3 py-1.5 text-[9px] font-bold rounded-lg uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer ${
                shopType === 'alchemist' ? 'bg-purple-600 text-white font-extrabold shadow-md' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <FlaskConical size={11} /> Alchemist
            </button>
          </div>

          <div className="flex items-center bg-zinc-900 border border-white/5 rounded-xl overflow-hidden p-0.5">
            <button
              onClick={() => setActiveTab('buy')}
              className={`px-4 py-1 text-[9px] font-bold rounded-lg uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'buy' ? 'bg-zinc-100 text-zinc-950 font-black' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Buy items
            </button>
            <button
              onClick={() => setActiveTab('sell')}
              className={`px-4 py-1 text-[9px] font-bold rounded-lg uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'sell' ? 'bg-zinc-100 text-zinc-950 font-black' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Sell resources
            </button>
          </div>
        </div>

        {/* Catalog Panel */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 flex flex-col gap-4">
          {activeTab === 'buy' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {shopInventories[shopType].map((itemDef) => {
                const item = IT[itemDef.id];
                if (!item) return null;
                const canAfford = playerGold >= itemDef.price;
                const currentQty = gameState.pl.inv[itemDef.id] || 0;

                return (
                  <div
                    key={itemDef.id}
                    onMouseEnter={() => setHoveredItem(itemDef.id)}
                    onMouseLeave={() => setHoveredItem(null)}
                    className="bg-zinc-900/45 border border-white/5 hover:border-white/10 rounded-2xl p-4 flex items-center justify-between gap-4 transition-all hover:bg-zinc-900/70"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-zinc-950 border border-white/5 flex items-center justify-center text-2xl shrink-0">
                        {item.ico}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-zinc-200 flex items-center gap-1.5 truncate">
                          {item.n}
                          {currentQty > 0 && (
                            <span className="text-[8px] bg-zinc-800 text-zinc-400 px-1 rounded-md font-mono">
                              Owned: {currentQty}
                            </span>
                          )}
                        </div>
                        <p className="text-[9px] text-zinc-500 mt-1 uppercase truncate font-sans">
                          {item.t === 'food' ? `Food • Restores ${item.hu || 0} Hunger` :
                           item.t === 'pot' ? `Potion • Restores ${item.hp || item.mp || 0} Vitality` :
                           item.t === 'armor' ? `Defense: +${item.def || 0} Armor` :
                           item.dmg ? `Weapon • DMG: +${item.dmg}` : 'Useful raw resource material'}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleBuyItem(itemDef.id, itemDef.price)}
                      className={`px-4 py-2 text-[10px] font-bold rounded-xl border flex items-center gap-1.5 transition-all cursor-pointer ${
                        canAfford 
                          ? 'bg-zinc-100 text-zinc-950 border-white font-extrabold hover:bg-white active:scale-95 hover:shadow-lg'
                          : 'bg-zinc-900 text-zinc-600 border-zinc-800/20 cursor-not-allowed'
                      }`}
                    >
                      <Coins size={12} className={canAfford ? 'text-amber-500' : 'text-zinc-600'} />
                      <span>{itemDef.price} Gold</span>
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div>
              {getPlayerSellables().length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-6 bg-zinc-900/10 border border-dashed border-white/5 rounded-2xl text-center">
                  <span className="text-3xl mb-3">🎒</span>
                  <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Your Bag is empty of merchant items</div>
                  <p className="text-[9px] text-zinc-600 uppercase max-w-xs mt-1 font-mono leading-relaxed">
                    Explore different biomes, chop trees, mine rocks/ores, or defeat monsters to gather sellable items for this merchant!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {getPlayerSellables().map((sellDef) => {
                    const item = IT[sellDef.id];
                    if (!item) return null;

                    return (
                      <div
                        key={sellDef.id}
                        className="bg-zinc-900/45 border border-white/5 rounded-2xl p-4 flex items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-12 h-12 rounded-xl bg-zinc-950 border border-white/5 flex items-center justify-center text-2xl shrink-0">
                            {item.ico}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-zinc-200 truncate flex items-center gap-1.5">
                              {item.n}
                              <span className="text-[9px] text-zinc-400 font-mono bg-zinc-800 px-1 rounded-md">
                                In Bag: {sellDef.qty}
                              </span>
                            </div>
                            <p className="text-[9px] text-zinc-500 mt-1 uppercase font-mono">
                              Returns gold directly back to capital
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => handleSellItem(sellDef.id)}
                          className="px-4 py-2 text-[10px] font-bold rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500 text-amber-200 hover:text-zinc-950 transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
                        >
                          <Coins size={12} />
                          <span>+{sellDef.price} Gold</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-white/5 shrink-0 bg-zinc-950/80 flex justify-between items-center text-[9px] uppercase tracking-wider text-zinc-500">
          <div className="flex items-center gap-1 text-green-500">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping mr-1" />
            <span>Secure trade connection established</span>
          </div>
          <p>Merchant inventories update periodically with player progression</p>
        </div>
      </motion.div>
    </div>
  );
}
