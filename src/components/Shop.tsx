import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Sparkles, 
  CreditCard, 
  Wallet, 
  Coins, 
  PackageOpen, 
  Percent, 
  TrendingUp, 
  CheckCircle2, 
  ShieldAlert,
  ArrowRight,
  Gift
} from 'lucide-react';

interface ShopProps {
  onClose: () => void;
  playerGold: number;
  onAwardNFTs: (nftIds: number[]) => void;
  addLog: (msg: string, col?: string) => void;
}

export default function Shop({ onClose, playerGold, onAwardNFTs, addLog }: ShopProps) {
  const [selectedBundle, setSelectedBundle] = useState<{
    id: string;
    name: string;
    qty: number;
    price: string;
    oldPrice?: string;
    badge?: string;
    color: string;
    desc: string;
  } | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<'card' | 'crypto'>('card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<'browse' | 'pay' | 'success'>('browse');
  const [mintedNfts, setMintedNfts] = useState<any[]>([]);

  // Card details
  const [cardNumber, setCardNumber] = useState('4111 2222 3333 4444');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCVC, setCardCVC] = useState('777');

  // Crypto details
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');

  const bundles = [
    {
      id: 'starter',
      name: 'Celestial Apprentice Shard',
      qty: 1,
      price: '$1.49',
      desc: 'Contains 1 procedurally generated, ultra-rare Mythic NFT Item with unique combat modifiers.',
      color: 'from-cyan-500/20 to-blue-500/20 border-cyan-500/30 text-cyan-400',
      badge: 'Starter',
      glow: 'shadow-[0_0_20px_rgba(6,182,212,0.15)]'
    },
    {
      id: 'explorer',
      name: 'Wanderer\'s Treasure Pack',
      qty: 5,
      price: '$4.99',
      oldPrice: '$7.45',
      desc: 'Contains 5 high-grade procedurally minted NFT items. Guaranteed at least one Epic tier attribute.',
      color: 'from-purple-500/25 to-indigo-500/25 border-purple-500/40 text-purple-400',
      badge: 'Popular • Save 33%',
      glow: 'shadow-[0_0_25px_rgba(168,85,247,0.2)]'
    },
    {
      id: 'champion',
      name: 'Overlord Celestial Vault',
      qty: 10,
      price: '$8.99',
      oldPrice: '$14.90',
      desc: 'Ultimate value! Contains 10 premium custom-minted items. Highest chance of Legendary prefix modifiers.',
      color: 'from-amber-500/25 to-yellow-500/25 border-amber-500/40 text-amber-400',
      badge: 'Best Value • Save 40%',
      glow: 'shadow-[0_0_35px_rgba(245,158,11,0.25)]'
    }
  ];

  const handleConnectWallet = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setWalletConnected(true);
      setWalletAddress('0x71C...931a72');
      addLog('🔌 Connected simulated Web3 Web3Wallet securely!', '#22c55e');
    }, 1200);
  };

  const handlePurchase = () => {
    if (!selectedBundle) return;
    setIsProcessing(true);
    
    setTimeout(() => {
      // Simulate minting random NFT IDs (between 500 and 10000 to keep it interesting)
      const newlyMintedIds: number[] = [];
      for (let i = 0; i < selectedBundle.qty; i++) {
        newlyMintedIds.push(Math.floor(Math.random() * 9500) + 500);
      }
      
      onAwardNFTs(newlyMintedIds);
      setMintedNfts(newlyMintedIds);
      setIsProcessing(false);
      setCheckoutStep('success');
      
      addLog(`💎 Minted ${selectedBundle.qty}x Celestial NFTs successfully! Added to your bag.`, '#f59e0b');
    }, 2200);
  };

  const resetCheckout = () => {
    setSelectedBundle(null);
    setCheckoutStep('browse');
    setMintedNfts([]);
    setWalletConnected(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 font-mono overflow-hidden">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative w-full max-w-5xl h-[90vh] sm:h-[85vh] bg-zinc-900/95 border border-white/10 rounded-2xl flex flex-col shadow-[0_0_60px_rgba(0,0,0,0.85)] overflow-hidden text-white"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 flex justify-between items-center border-b border-white/10 shrink-0 bg-zinc-900/40">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-400 flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.3)] animate-pulse">
              <Sparkles className="text-zinc-900" size={18} />
            </div>
            <div>
              <h2 className="text-md sm:text-lg font-extrabold tracking-widest text-amber-400">
                CELESTIAL MONETIZATION STORE
              </h2>
              <p className="text-[8px] opacity-40 uppercase tracking-widest leading-none mt-1">Get Premium NFT Packs & Support Live Servers</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-white/5 rounded-lg border border-white/5 hover:border-white/15 transition-all text-white/60 hover:text-white cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-6">
          
          <AnimatePresence mode="wait">
            {checkoutStep === 'browse' && (
              <motion.div 
                key="browse"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="flex-1 flex flex-col justify-between"
              >
                {/* Banner introducing the store */}
                <div className="bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-transparent border border-amber-500/20 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                  <div className="max-w-xl">
                    <span className="text-[8px] bg-amber-500/15 border border-amber-500/30 text-amber-400 font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider">
                      Live Economy Active
                    </span>
                    <h3 className="text-xs sm:text-sm font-bold text-white mt-1.5 uppercase tracking-wide">
                      Web3 Procedural Gear Unwrapping
                    </h3>
                    <p className="text-[10px] text-white/50 leading-relaxed mt-1">
                      Every pack contains fully functional in-game items generated on the fly. These NFTs can be equipped instantly for battle or liquidated in the Player Marketplace for solid gold.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 bg-black/40 px-3 py-2 rounded-lg border border-white/5 shrink-0 self-start sm:self-center">
                    <Coins className="text-yellow-400 animate-spin animate-[spin_8s_linear_infinite]" size={14} />
                    <div>
                      <div className="text-[8px] opacity-40 uppercase">Your Gold</div>
                      <div className="text-xs font-bold text-yellow-400 font-sans">🪙 {playerGold.toLocaleString()}</div>
                    </div>
                  </div>
                </div>

                {/* Bundle Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {bundles.map((b) => (
                    <div 
                      key={b.id}
                      className={`relative rounded-xl border bg-gradient-to-b ${b.color} p-4 sm:p-5 flex flex-col justify-between transition-all hover:scale-[1.02] ${b.glow} group overflow-hidden`}
                    >
                      {/* Decorative elements */}
                      <div className="absolute top-0 right-0 w-24 h-24 bg-white/[0.02] rounded-full blur-2xl group-hover:bg-white/[0.05] transition-all" />
                      
                      <div>
                        {b.badge && (
                          <span className="inline-block text-[8px] font-extrabold px-2 py-0.5 rounded-full bg-white/10 text-white/90 uppercase tracking-widest mb-3 border border-white/5">
                            {b.badge}
                          </span>
                        )}
                        <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider mb-2 text-white">
                          {b.name}
                        </h4>
                        
                        {/* Bundle Size Indicator */}
                        <div className="flex items-center gap-2 my-3">
                          <div className="w-10 h-10 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center text-xl select-none">
                            {b.qty === 1 ? '🎁' : b.qty === 5 ? '🎒' : '👑'}
                          </div>
                          <div>
                            <div className="text-xs font-extrabold text-white font-sans">{b.qty}x NFT Pack</div>
                            <div className="text-[8px] opacity-50 uppercase tracking-widest">Procedural Mint</div>
                          </div>
                        </div>

                        <p className="text-[10px] text-white/60 leading-relaxed mb-4">
                          {b.desc}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-white/5 mt-auto">
                        <div className="flex items-baseline gap-2 mb-3">
                          <span className="text-xl font-bold font-sans text-white">{b.price}</span>
                          {b.oldPrice && (
                            <span className="text-xs line-through font-sans opacity-40 text-white/70">{b.oldPrice}</span>
                          )}
                        </div>
                        
                        <button 
                          onClick={() => {
                            setSelectedBundle(b);
                            setCheckoutStep('pay');
                          }}
                          className="w-full bg-white text-zinc-950 hover:bg-amber-400 hover:text-zinc-900 font-bold py-2 rounded-lg text-[10px] sm:text-xs tracking-widest uppercase transition-all flex items-center justify-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                        >
                          Unlock Pack <ArrowRight size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Quick informational note about drop rates */}
                <div className="mt-5 text-center bg-black/15 p-2 rounded-lg border border-white/5">
                  <p className="text-[9px] text-white/40 uppercase">
                    🔒 Secure Server Sync • Drop Rates: 70% Common/Rare, 20% Epic, 10% Mythic Prefix Tier
                  </p>
                </div>
              </motion.div>
            )}

            {checkoutStep === 'pay' && selectedBundle && (
              <motion.div 
                key="checkout"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex-1 max-w-2xl mx-auto w-full flex flex-col justify-between"
              >
                <div className="bg-zinc-950/40 border border-white/5 rounded-xl p-5">
                  {/* Selected Bundle Summary */}
                  <div className="flex justify-between items-center border-b border-white/10 pb-3 mb-4">
                    <div>
                      <span className="text-[8px] opacity-40 uppercase">Checkout Item</span>
                      <h4 className="text-xs sm:text-sm font-bold text-amber-400 uppercase tracking-wider">{selectedBundle.name}</h4>
                    </div>
                    <div className="text-right">
                      <span className="text-[8px] opacity-40 uppercase">Total Due</span>
                      <div className="text-sm font-bold font-sans text-white">{selectedBundle.price}</div>
                    </div>
                  </div>

                  {/* Payment Method Tabs */}
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    <button 
                      onClick={() => setPaymentMethod('card')}
                      className={`py-2 px-3 rounded-lg border flex items-center justify-center gap-2 text-[10px] sm:text-xs font-bold uppercase transition-all cursor-pointer ${paymentMethod === 'card' ? 'bg-amber-500/10 border-amber-500 text-amber-400' : 'bg-white/5 border-white/10 text-white/50 hover:border-white/20'}`}
                    >
                      <CreditCard size={13} /> Credit Card
                    </button>
                    <button 
                      onClick={() => setPaymentMethod('crypto')}
                      className={`py-2 px-3 rounded-lg border flex items-center justify-center gap-2 text-[10px] sm:text-xs font-bold uppercase transition-all cursor-pointer ${paymentMethod === 'crypto' ? 'bg-amber-500/10 border-amber-500 text-amber-400' : 'bg-white/5 border-white/10 text-white/50 hover:border-white/20'}`}
                    >
                      <Wallet size={13} /> Web3 Wallet
                    </button>
                  </div>

                  {/* Payment Form */}
                  <AnimatePresence mode="wait">
                    {paymentMethod === 'card' ? (
                      <motion.div 
                        key="card-form"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="space-y-3.5"
                      >
                        <div>
                          <label className="block text-[8px] opacity-40 uppercase tracking-wider mb-1">Card Number</label>
                          <input 
                            type="text" 
                            value={cardNumber}
                            onChange={(e) => setCardNumber(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-lg py-2 px-3 text-xs focus:border-amber-500 focus:outline-none transition-all font-sans"
                            placeholder="4111 2222 3333 4444"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[8px] opacity-40 uppercase tracking-wider mb-1">Expiration Date</label>
                            <input 
                              type="text" 
                              value={cardExpiry}
                              onChange={(e) => setCardExpiry(e.target.value)}
                              className="w-full bg-black/40 border border-white/10 rounded-lg py-2 px-3 text-xs focus:border-amber-500 focus:outline-none transition-all font-sans"
                              placeholder="MM/YY"
                            />
                          </div>
                          <div>
                            <label className="block text-[8px] opacity-40 uppercase tracking-wider mb-1">CVC / CVV</label>
                            <input 
                              type="password" 
                              value={cardCVC}
                              onChange={(e) => setCardCVC(e.target.value)}
                              className="w-full bg-black/40 border border-white/10 rounded-lg py-2 px-3 text-xs focus:border-amber-500 focus:outline-none transition-all font-sans"
                              placeholder="777"
                            />
                          </div>
                        </div>
                        <div className="text-[9px] text-white/40 italic flex items-start gap-1">
                          <span>🛡️</span>
                          <span>Simulated sandbox payment processing. Safe to submit with fake mock information.</span>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div 
                        key="crypto-form"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="space-y-4 text-center py-3"
                      >
                        {walletConnected ? (
                          <div className="bg-green-500/10 border border-green-500/20 p-3 rounded-lg flex items-center justify-between">
                            <div className="text-left">
                              <span className="text-[8px] opacity-40 uppercase">Wallet Connected</span>
                              <div className="text-xs font-bold text-green-400 font-mono">{walletAddress}</div>
                            </div>
                            <span className="text-xs bg-green-500/20 px-2 py-0.5 rounded text-green-300 font-extrabold uppercase">CONNECTED</span>
                          </div>
                        ) : (
                          <div className="p-4 border border-dashed border-white/15 rounded-lg">
                            <p className="text-[10px] text-white/60 mb-3 leading-relaxed uppercase">
                              Connect your Web3 Web3Wallet (Polygon Network supported) to interact with SURV smart contracts.
                            </p>
                            <button 
                              onClick={handleConnectWallet}
                              disabled={isProcessing}
                              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg text-[9px] sm:text-xs font-extrabold uppercase tracking-widest transition-all cursor-pointer shadow-md disabled:opacity-50"
                            >
                              {isProcessing ? 'Syncing...' : 'Connect MetaMask / Web3'}
                            </button>
                          </div>
                        )}
                        <div className="text-[8px] opacity-40 uppercase tracking-widest">
                          Polygon ChainID: 137 • Transaction commission handled automatically via smart contracts.
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Checkout Actions */}
                <div className="flex items-center gap-3 mt-4">
                  <button 
                    onClick={() => setCheckoutStep('browse')}
                    disabled={isProcessing}
                    className="w-1/3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl py-2.5 text-[9px] sm:text-xs font-bold uppercase transition-all disabled:opacity-50 cursor-pointer"
                  >
                    Back
                  </button>
                  <button 
                    onClick={handlePurchase}
                    disabled={isProcessing || (paymentMethod === 'crypto' && !walletConnected)}
                    className="flex-1 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-zinc-950 font-bold py-2.5 rounded-xl text-[9px] sm:text-xs tracking-widest uppercase transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-yellow-500/10 active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    {isProcessing ? (
                      <span className="flex items-center gap-2">
                        <span className="w-3 h-3 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                        PROCESSING SECURE ESCROW...
                      </span>
                    ) : (
                      <>MINT & OPEN BUNDLE ({selectedBundle.price})</>
                    )}
                  </button>
                </div>
              </motion.div>
            )}

            {checkoutStep === 'success' && selectedBundle && (
              <motion.div 
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex-1 max-w-xl mx-auto w-full text-center flex flex-col justify-between items-center py-4"
              >
                <div className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center text-green-400 mb-2 animate-bounce">
                  <CheckCircle2 size={30} />
                </div>
                
                <h3 className="text-md sm:text-lg font-black tracking-widest text-green-400 uppercase">
                  PAYMENT SUCCESSFUL!
                </h3>
                <p className="text-[10px] uppercase opacity-45 tracking-wider mt-1">Simulated Order Sync: SECURE-#{Math.floor(Math.random() * 89999) + 10000}</p>
                
                <div className="w-full bg-zinc-950/40 border border-white/5 rounded-xl p-4 my-4 max-h-[180px] overflow-y-auto pr-1">
                  <div className="text-[9px] opacity-45 uppercase font-extrabold tracking-widest mb-2 border-b border-white/5 pb-1 flex items-center justify-between">
                    <span>MINTED CONTRACT TOKENS</span>
                    <span className="text-yellow-400 font-sans">qty: {mintedNfts.length}</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    {mintedNfts.map((id, index) => (
                      <div key={index} className="bg-white/[0.02] border border-white/5 p-2 rounded-lg text-left flex items-center gap-2">
                        <span className="text-lg select-none">💎</span>
                        <div>
                          <div className="text-[9px] font-bold text-white uppercase tracking-wider">NFT Item #{id}</div>
                          <div className="text-[7px] text-amber-400/80 font-bold uppercase tracking-widest">Added to Bag</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="text-[10px] text-white/60 text-center leading-relaxed max-w-sm mb-4">
                  Congratulations! These item tokens have been generated with unique prefixes and pushed directly into your bag. Equip them from your Inventory or trade them with others.
                </div>

                <button 
                  onClick={resetCheckout}
                  className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-zinc-950 font-black rounded-xl text-[10px] tracking-widest uppercase transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  Continue Shopping
                </button>
              </motion.div>
            )}
          </AnimatePresence>

        </div>

        {/* Persistent Footer Panel: Marketplace Commission Information */}
        <div className="p-4 sm:p-5 border-t border-white/10 shrink-0 bg-black/40">
          <div className="flex items-start gap-3 max-w-4xl mx-auto">
            <div className="p-2 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-lg shrink-0">
              <Percent size={16} className="animate-pulse" />
            </div>
            <div>
              <h4 className="text-[10px] sm:text-xs font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-1.5 leading-none mb-1">
                <TrendingUp size={12} /> 5% Marketplace Trading Commission Policy
              </h4>
              <p className="text-[9px] sm:text-[10px] text-white/50 leading-relaxed uppercase">
                To sustain live global server nodes, indexers, and continuous procedural event generation, a standard <strong className="text-white">5% commission fee</strong> is automatically deducted from all player-to-player sales and trades on the local exchange. Gold collected goes directly back into system liquidity events, fueling worldwide map discoveries, boss events, and resource drops! Thank you for supporting the live ecosystem.
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
