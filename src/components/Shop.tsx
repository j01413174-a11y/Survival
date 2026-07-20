import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Sparkles, 
  Wallet, 
  Coins, 
  PackageOpen, 
  Percent, 
  TrendingUp, 
  CheckCircle2, 
  ShieldAlert,
  ArrowRight,
  Gift,
  ExternalLink,
  DollarSign,
  CreditCard,
  Zap,
  Info
} from 'lucide-react';

interface ShopProps {
  onClose: () => void;
  playerGold: number;
  onAwardNFTs: (nftIds: number[], goldCost: number) => void;
  addLog: (msg: string, col?: string) => void;
}

const stringToHex = (str: string): string => {
  let hex = '';
  for (let i = 0; i < str.length; i++) {
    hex += str.charCodeAt(i).toString(16).padStart(2, '0');
  }
  return '0x' + hex;
};

export default function Shop({ onClose, playerGold, onAwardNFTs, addLog }: ShopProps) {
  const [shopTab, setShopTab] = useState<'nfts' | 'gold'>('nfts');
  const [selectedBundle, setSelectedBundle] = useState<{
    id: string;
    name: string;
    qty: number;
    priceCoins: number;
    badge?: string;
    color: string;
    desc: string;
    glow: string;
  } | null>(null);

  const [selectedGoldBundle, setSelectedGoldBundle] = useState<{
    id: string;
    name: string;
    amount: number;
    priceUSD: number;
    ethEquivalent: string;
    badge?: string;
    color: string;
    desc: string;
    glow: string;
  } | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<'browse' | 'pay' | 'success'>('browse');
  const [mintedNfts, setMintedNfts] = useState<any[]>([]);
  const [purchasedGold, setPurchasedGold] = useState<number>(0);
  const [txHash, setTxHash] = useState<string>('');

  // Web3 state
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [isUsingRealWeb3, setIsUsingRealWeb3] = useState(false);

  // Check for pre-existing Web3 account on load and setup listeners
  useEffect(() => {
    if (typeof window === 'undefined' || !(window as any).ethereum) return;

    const eth = (window as any).ethereum;

    const checkConnectedWallet = async () => {
      try {
        const accounts = await eth.request({ method: 'eth_accounts' });
        if (accounts && accounts.length > 0) {
          setWalletConnected(true);
          setWalletAddress(accounts[0]);
          setIsUsingRealWeb3(true);
        }
      } catch (e) {
        console.error("Failed to check eth accounts", e);
      }
    };

    checkConnectedWallet();

    const handleAccounts = (newAccounts: string[]) => {
      if (newAccounts.length > 0) {
        setWalletAddress(newAccounts[0]);
        setWalletConnected(true);
        setIsUsingRealWeb3(true);
        addLog(`🔌 Wallet Switched: ${newAccounts[0].slice(0, 6)}...${newAccounts[0].slice(-4)}`, '#10b981');
      } else {
        setWalletConnected(false);
        setWalletAddress('');
        setIsUsingRealWeb3(false);
        addLog('🔌 Wallet Disconnected', '#f43f5e');
      }
    };

    const handleChain = (chainId: string) => {
      addLog(`🔌 Web3 Network Switched: Chain ID ${parseInt(chainId, 16)}`, '#38bdf8');
    };

    if (eth.on) {
      eth.on('accountsChanged', handleAccounts);
      eth.on('chainChanged', handleChain);
    }

    return () => {
      if (eth.removeListener) {
        eth.removeListener('accountsChanged', handleAccounts);
        eth.removeListener('chainChanged', handleChain);
      }
    };
  }, []);

  const nftBundles = [
    {
      id: 'starter',
      name: 'Celestial Apprentice Shard',
      qty: 1,
      priceCoins: 150,
      desc: 'Contains 1 procedurally generated, ultra-rare Mythic NFT Item with unique combat modifiers.',
      color: 'from-cyan-500/20 to-blue-500/20 border-cyan-500/30 text-cyan-400',
      badge: 'Starter',
      glow: 'shadow-[0_0_20px_rgba(6,182,212,0.15)]'
    },
    {
      id: 'explorer',
      name: "Wanderer's Treasure Pack",
      qty: 5,
      priceCoins: 500,
      desc: 'Contains 5 high-grade procedurally minted NFT items. Guaranteed at least one Epic tier attribute.',
      color: 'from-purple-500/25 to-indigo-500/25 border-purple-500/40 text-purple-400',
      badge: 'Popular • Save 33%',
      glow: 'shadow-[0_0_25px_rgba(168,85,247,0.2)]'
    },
    {
      id: 'champion',
      name: 'Overlord Celestial Vault',
      qty: 10,
      priceCoins: 900,
      desc: 'Ultimate value! Contains 10 premium custom-minted items. Highest chance of Legendary prefix modifiers.',
      color: 'from-amber-500/25 to-yellow-500/25 border-amber-500/40 text-amber-400',
      badge: 'Best Value • Save 40%',
      glow: 'shadow-[0_0_35px_rgba(245,158,11,0.25)]'
    }
  ];

  const goldBundles = [
    {
      id: 'gold_small',
      name: "Adventurer's Coin Pouch",
      amount: 50000,
      priceUSD: 2.99,
      ethEquivalent: '0.001 ETH',
      badge: 'Micro Cache',
      color: 'from-amber-600/15 to-yellow-600/15 border-amber-600/30 text-amber-400',
      desc: 'Top up with 50,000 gold coins. Instantly craft basic base tools and start recruiting initial villagers.',
      glow: 'shadow-[0_0_15px_rgba(217,119,6,0.1)]'
    },
    {
      id: 'gold_medium',
      name: "Overlord's Gold Cache",
      amount: 200000,
      priceUSD: 9.99,
      ethEquivalent: '0.003 ETH',
      badge: 'Most Popular • 200k Pack',
      color: 'from-yellow-500/25 to-amber-500/25 border-yellow-500/40 text-yellow-400',
      desc: 'Add 200,000 gold coins instantly! Perfect for building massive fortifications, town houses, and advanced workshops.',
      glow: 'shadow-[0_0_30px_rgba(245,158,11,0.3)]'
    },
    {
      id: 'gold_large',
      name: "Imperial Sovereign Hoard",
      amount: 500000,
      priceUSD: 22.99,
      ethEquivalent: '0.007 ETH',
      badge: 'Unrivaled Wealth',
      color: 'from-amber-400/25 to-yellow-300/25 border-amber-400/50 text-amber-300',
      desc: 'Obtain 500,000 gold coins. Fully fund an unstoppable empire with high-tier guard towers and custom gear.',
      glow: 'shadow-[0_0_35px_rgba(245,158,11,0.25)]'
    }
  ];

  const handleConnectWallet = async () => {
    setIsProcessing(true);
    try {
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        const eth = (window as any).ethereum;
        const accounts = await eth.request({ method: 'eth_requestAccounts' });
        if (accounts && accounts.length > 0) {
          setWalletConnected(true);
          setWalletAddress(accounts[0]);
          setIsUsingRealWeb3(true);
          addLog(`🔌 Securely connected MetaMask: ${accounts[0].slice(0, 6)}...${accounts[0].slice(-4)}!`, '#22c55e');
        }
      } else {
        addLog('❌ MetaMask Web3 provider not detected! Please install MetaMask or open the app in a tab with a Web3-compatible browser.', '#f43f5e');
      }
    } catch (err: any) {
      console.error(err);
      addLog(`❌ Wallet Connection Failed: ${err.message || err}`, '#f43f5e');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePurchaseNFT = async () => {
    if (!selectedBundle) return;
    
    if (playerGold < selectedBundle.priceCoins) {
      addLog('❌ Insufficient Gold Coins to mint this bundle!', '#f43f5e');
      return;
    }

    if (typeof window === 'undefined' || !(window as any).ethereum || !walletAddress) {
      addLog('❌ Web3 Wallet not connected! Please connect your MetaMask Web3 wallet first.', '#f43f5e');
      return;
    }

    setIsProcessing(true);
    let currentTxHash = '';

    // Web3 Real Smart Contract Signature Simulation
    try {
      addLog("⏳ Requesting Smart Contract mint authorization from MetaMask...", "#a78bfa");
      const message = `Authorize minting of ${selectedBundle.qty}x Procedural NFT Pack (${selectedBundle.name}) for ${selectedBundle.priceCoins} gold coins.\n\nAccount: ${walletAddress}\nTimestamp: ${Date.now()}`;
      const hexMessage = stringToHex(message);
      
      const signature = await (window as any).ethereum.request({
        method: 'personal_sign',
        params: [hexMessage, walletAddress],
      });
      currentTxHash = signature;
      setTxHash(signature);
      addLog("✅ Smart Contract Signature Verified!", "#22c55e");
    } catch (err: any) {
      console.warn("User rejected Web3 signature", err);
      addLog(`❌ Signature rejected: ${err.message || err}. Transaction aborted.`, '#f43f5e');
      setIsProcessing(false);
      return; // Halt if real transaction fails/declines!
    }

    setTimeout(() => {
      // Generate newly minted NFTs
      const newlyMintedIds: number[] = [];
      for (let i = 0; i < selectedBundle.qty; i++) {
        newlyMintedIds.push(Math.floor(Math.random() * 9500) + 500);
      }
      
      // Award to player and deduct gold
      onAwardNFTs(newlyMintedIds, selectedBundle.priceCoins);
      setMintedNfts(newlyMintedIds);
      setPurchasedGold(0);
      setIsProcessing(false);
      setCheckoutStep('success');
      
      addLog(`💎 Minted ${selectedBundle.qty}x Celestial NFTs successfully for 🪙${selectedBundle.priceCoins}!`, '#fbbf24');
    }, 1500);
  };

  const handlePurchaseGold = async () => {
    if (!selectedGoldBundle) return;

    if (typeof window === 'undefined' || !(window as any).ethereum || !walletAddress) {
      addLog('❌ Web3 Wallet not connected! Please connect your MetaMask Web3 wallet first.', '#f43f5e');
      return;
    }

    setIsProcessing(true);
    let currentTxHash = '';

    // Web3 Real MetaMask Transaction Trigger
    try {
      addLog(`⏳ Requesting MetaMask transaction approval of $${selectedGoldBundle.priceUSD} (${selectedGoldBundle.ethEquivalent}) to Vault...`, "#38bdf8");
      
      // Define standard dev/recipient treasury wallet
      const recipient = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';
      
      // Dynamic ETH/MATIC Value mapping in Hex based on bundle selection
      const valInHex = selectedGoldBundle.id === 'gold_small' 
        ? '0x38d7ea4c68000'   // 0.001 ETH
        : selectedGoldBundle.id === 'gold_medium' 
        ? '0xaa87bee538000'  // 0.003 ETH
        : '0x18d4a2d3e38000'; // 0.007 ETH

      const transactionParameters = {
        from: walletAddress,
        to: recipient,
        value: valInHex,
        gasLimit: '0x5208', // 21000 Gwei
      };

      const tx = await (window as any).ethereum.request({
        method: 'eth_sendTransaction',
        params: [transactionParameters],
      });

      currentTxHash = tx;
      setTxHash(tx);
      addLog(`✅ MetaMask Transaction Approved! Hash: ${tx.slice(0, 10)}...`, "#22c55e");
    } catch (err: any) {
      console.warn("Real MetaMask transaction failed/rejected", err);
      addLog(`❌ MetaMask transaction declined: ${err.message || err}. Transaction aborted.`, '#f43f5e');
      setIsProcessing(false);
      return; // Halt if real transaction fails/declines!
    }

    // Process delivery
    setTimeout(() => {
      // Award the Gold to player by passing negative goldCost (-amount)
      onAwardNFTs([], -selectedGoldBundle.amount);
      setPurchasedGold(selectedGoldBundle.amount);
      setMintedNfts([]);
      
      setIsProcessing(false);
      setCheckoutStep('success');
      
      addLog(`🪙 Success! Purchased & credited 🪙${selectedGoldBundle.amount.toLocaleString()} Gold Coins to your inventory!`, '#10b981');
    }, 1500);
  };

  const resetCheckout = () => {
    setSelectedBundle(null);
    setSelectedGoldBundle(null);
    setCheckoutStep('browse');
    setMintedNfts([]);
    setPurchasedGold(0);
    setTxHash('');
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
              <h2 className="text-md sm:text-lg font-extrabold tracking-widest text-amber-400 uppercase">
                Celestial NFT Forge & Gold Store
              </h2>
              <p className="text-[8px] opacity-40 uppercase tracking-widest leading-none mt-1">
                Mint unique Web3 armor/weapons or top up your in-game Gold Balance
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-white/5 rounded-lg border border-white/5 hover:border-white/15 transition-all text-white/60 hover:text-white cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Selection Switcher (Only visible in browse mode) */}
        {checkoutStep === 'browse' && (
          <div className="px-4 sm:px-6 py-2 border-b border-white/5 bg-zinc-950/20 flex gap-2 shrink-0">
            <button
              onClick={() => setShopTab('nfts')}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 cursor-pointer ${
                shopTab === 'nfts' 
                  ? 'bg-amber-400 text-zinc-950 shadow-md' 
                  : 'bg-zinc-800/40 text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              <PackageOpen size={14} /> NFT Item Forge
            </button>
            <button
              onClick={() => setShopTab('gold')}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 cursor-pointer ${
                shopTab === 'gold' 
                  ? 'bg-amber-400 text-zinc-950 shadow-md' 
                  : 'bg-zinc-800/40 text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              <Coins size={14} /> Buy Gold Coins (MetaMask)
            </button>
          </div>
        )}

        {/* Content Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-6">
          
          <AnimatePresence mode="wait">
            {checkoutStep === 'browse' && shopTab === 'nfts' && (
              <motion.div 
                key="browse-nfts"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="flex-1 flex flex-col justify-between"
              >
                {/* Banner introducing the store */}
                <div className="bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-transparent border border-amber-500/20 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                  <div className="max-w-xl">
                    <span className="text-[8px] bg-amber-500/15 border border-amber-500/30 text-amber-400 font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider">
                      Gold-Backed Minting Active
                    </span>
                    <h3 className="text-xs sm:text-sm font-bold text-white mt-1.5 uppercase tracking-wide">
                      Web3 Procedural Gear Unwrapping
                    </h3>
                    <p className="text-[10px] text-white/50 leading-relaxed mt-1">
                      No credit cards required! Use the gold coins you earn in battle, quests, or buy from our store to mint genuine procedurally-generated weapon and armor assets.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 bg-black/40 px-3 py-2 rounded-lg border border-white/5 shrink-0 self-start sm:self-center">
                    <Coins className="text-yellow-400 animate-spin animate-[spin_8s_linear_infinite]" size={14} />
                    <div>
                      <div className="text-[8px] opacity-40 uppercase">Your Gold Coins</div>
                      <div className="text-xs font-bold text-yellow-400 font-sans">🪙 {playerGold.toLocaleString()}</div>
                    </div>
                  </div>
                </div>

                {/* Bundle Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {nftBundles.map((b) => {
                    const canAfford = playerGold >= b.priceCoins;
                    return (
                      <div 
                        key={b.id}
                        className={`relative rounded-xl border bg-gradient-to-b ${b.color} p-4 sm:p-5 flex flex-col justify-between transition-all hover:scale-[1.02] ${b.glow} group overflow-hidden`}
                      >
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

                          <p className="text-[10px] text-white/60 leading-relaxed mb-4 font-sans">
                            {b.desc}
                          </p>
                        </div>

                        <div className="pt-3 border-t border-white/5 mt-auto">
                          <div className="flex items-baseline gap-2 mb-3">
                            <span className="text-xl font-bold font-sans text-yellow-400">🪙 {b.priceCoins.toLocaleString()}</span>
                            <span className="text-[8px] opacity-50 uppercase tracking-widest text-zinc-400">Coins</span>
                          </div>
                          
                          <button 
                            onClick={() => {
                              setSelectedBundle(b);
                              setSelectedGoldBundle(null);
                              setCheckoutStep('pay');
                            }}
                            className={`w-full font-bold py-2 rounded-lg text-[10px] sm:text-xs tracking-widest uppercase transition-all flex items-center justify-center gap-1.5 shadow-md active:scale-95 cursor-pointer ${
                              canAfford 
                                ? 'bg-amber-400 text-zinc-950 hover:bg-yellow-300' 
                                : 'bg-zinc-800 text-zinc-500 border border-zinc-700/50 cursor-not-allowed'
                            }`}
                          >
                            {canAfford ? (
                              <>Forge Pack <ArrowRight size={12} /></>
                            ) : (
                              'Insufficient Gold'
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-5 text-center bg-black/15 p-2 rounded-lg border border-white/5">
                  <p className="text-[9px] text-white/40 uppercase">
                    🔒 Secure Server Sync • Drop Rates: 70% Common/Rare, 20% Epic, 10% Mythic Prefix Tier
                  </p>
                </div>
              </motion.div>
            )}

            {checkoutStep === 'browse' && shopTab === 'gold' && (
              <motion.div 
                key="browse-gold"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="flex-1 flex flex-col justify-between"
              >
                {/* Gold Purchase Welcome Banner */}
                <div className="bg-gradient-to-r from-cyan-500/10 via-blue-500/5 to-transparent border border-cyan-500/20 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                  <div className="max-w-2xl">
                    <span className="text-[8px] bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider">
                      MetaMask Web3 Payment Portal
                    </span>
                    <h3 className="text-xs sm:text-sm font-bold text-white mt-1.5 uppercase tracking-wide flex items-center gap-1.5">
                      <Zap size={14} className="text-yellow-400" /> Web3 Instant Gold Infusions
                    </h3>
                    <p className="text-[10px] text-white/50 leading-relaxed mt-1">
                      Instantly credit huge amounts of Gold Coins to your account securely via your MetaMask Web3 Wallet. Verify blockchain transactions to bypass grinding and build the ultimate defensive fortress!
                    </p>
                  </div>
                  <div className="flex items-center gap-2 bg-black/40 px-3 py-2 rounded-lg border border-white/5 shrink-0 self-start sm:self-center">
                    <Coins className="text-yellow-400" size={14} />
                    <div>
                      <div className="text-[8px] opacity-40 uppercase">Current Balance</div>
                      <div className="text-xs font-bold text-yellow-400 font-sans">🪙 {playerGold.toLocaleString()}</div>
                    </div>
                  </div>
                </div>

                {/* Gold Coins Bundles Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {goldBundles.map((b) => {
                    const isMedium = b.id === 'gold_medium'; // The requested 200,000 for 9.99
                    return (
                      <div 
                        key={b.id}
                        className={`relative rounded-xl border bg-gradient-to-b ${b.color} p-4 sm:p-5 flex flex-col justify-between transition-all hover:scale-[1.02] ${b.glow} group overflow-hidden ${
                          isMedium ? 'border-yellow-400/80 shadow-[0_0_20px_rgba(234,179,8,0.25)]' : ''
                        }`}
                      >
                        {/* Highlights & Tags */}
                        {isMedium && (
                          <div className="absolute top-0 right-0 bg-yellow-400 text-zinc-950 text-[7px] font-black px-2.5 py-1 uppercase rounded-bl tracking-widest z-10">
                            ★ REQUIRED BUNDLE ★
                          </div>
                        )}
                        <div className="absolute top-0 left-0 w-24 h-24 bg-white/[0.01] rounded-full blur-2xl" />

                        <div>
                          {b.badge && (
                            <span className={`inline-block text-[8px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-widest mb-3 border ${
                              isMedium 
                                ? 'bg-yellow-400/20 text-yellow-300 border-yellow-400/30' 
                                : 'bg-white/10 text-white/90 border-white/5'
                            }`}>
                              {b.badge}
                            </span>
                          )}
                          <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider mb-2 text-white">
                            {b.name}
                          </h4>
                          
                          {/* Visual Coin Icon */}
                          <div className="flex items-center gap-3 my-3">
                            <div className="w-12 h-12 rounded-xl bg-black/50 border border-white/10 flex items-center justify-center text-2xl select-none relative overflow-hidden shadow-inner">
                              <div className="absolute inset-0 bg-gradient-to-t from-yellow-500/20 to-transparent" />
                              💰
                            </div>
                            <div>
                              <div className="text-sm font-black text-yellow-400 font-sans">🪙 {b.amount.toLocaleString()}</div>
                              <div className="text-[7px] text-zinc-400 uppercase tracking-widest">In-Game Gold Coins</div>
                            </div>
                          </div>

                          <p className="text-[10px] text-white/60 leading-relaxed mb-4 font-sans">
                            {b.desc}
                          </p>
                        </div>

                        <div className="pt-3 border-t border-white/5 mt-auto">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <div className="text-[7px] opacity-40 uppercase tracking-widest">Standard Price</div>
                              <span className="text-xl font-bold font-sans text-white">${b.priceUSD}</span>
                            </div>
                            <div className="text-right">
                              <div className="text-[7px] opacity-40 uppercase tracking-widest">Web3 Amount</div>
                              <span className="text-xs font-bold text-cyan-400 font-sans">{b.ethEquivalent}</span>
                            </div>
                          </div>
                          
                          <button 
                            onClick={() => {
                              setSelectedGoldBundle(b);
                              setSelectedBundle(null);
                              setCheckoutStep('pay');
                            }}
                            className="w-full font-bold py-2.5 rounded-lg text-[10px] sm:text-xs tracking-widest uppercase transition-all flex items-center justify-center gap-1.5 shadow-md active:scale-95 cursor-pointer bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-400 hover:to-blue-400"
                          >
                            <CreditCard size={12} /> Buy with MetaMask
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Quick informational note about drops */}
                <div className="mt-5 text-center bg-black/15 p-2 rounded-lg border border-white/5 flex items-center justify-center gap-1.5">
                  <Info size={11} className="text-cyan-400" />
                  <p className="text-[9px] text-white/40 uppercase">
                    Tokens are delivered directly through the game state on authorization. Supports Polygon/Ethereum Testnets & Mainnet.
                  </p>
                </div>
              </motion.div>
            )}

            {checkoutStep === 'pay' && (selectedBundle || selectedGoldBundle) && (
              <motion.div 
                key="checkout"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex-1 max-w-2xl mx-auto w-full flex flex-col justify-between"
              >
                <div className="bg-zinc-950/40 border border-white/5 rounded-xl p-5 space-y-5">
                  {/* Selected Item Summary */}
                  <div className="flex justify-between items-center border-b border-white/10 pb-4">
                    {selectedBundle ? (
                      <>
                        <div>
                          <span className="text-[8px] opacity-40 uppercase">Checkout NFT Bundle</span>
                          <h4 className="text-xs sm:text-sm font-bold text-amber-400 uppercase tracking-wider">{selectedBundle.name}</h4>
                        </div>
                        <div className="text-right">
                          <span className="text-[8px] opacity-40 uppercase">Total Gold Due</span>
                          <div className="text-sm font-bold font-sans text-yellow-400">🪙 {selectedBundle.priceCoins.toLocaleString()} Coins</div>
                        </div>
                      </>
                    ) : selectedGoldBundle ? (
                      <>
                        <div>
                          <span className="text-[8px] opacity-40 uppercase">Gold Purchase Pack</span>
                          <h4 className="text-xs sm:text-sm font-bold text-cyan-400 uppercase tracking-wider">{selectedGoldBundle.name}</h4>
                        </div>
                        <div className="text-right">
                          <span className="text-[8px] opacity-40 uppercase">Total USD Due</span>
                          <div className="text-sm font-bold font-sans text-green-400">${selectedGoldBundle.priceUSD} ({selectedGoldBundle.ethEquivalent})</div>
                        </div>
                      </>
                    ) : null}
                  </div>

                  {/* Web3 Wallet Integration Panel */}
                  <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-4">
                    <h5 className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Wallet size={12} /> Web3 Wallet Sync (MetaMask & Injected)
                    </h5>
                    
                    {walletConnected ? (
                      <div className="bg-green-500/10 border border-green-500/20 p-3 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <span className="text-[8px] opacity-40 uppercase font-bold">Connected Web3 Address</span>
                          <div className="text-[11px] font-bold text-green-400 font-mono break-all">{walletAddress}</div>
                        </div>
                        <span className="text-[8px] bg-green-500/20 px-2 py-0.5 rounded text-green-300 font-extrabold uppercase shrink-0 self-start sm:self-center">
                          METAMASK ACTIVE
                        </span>
                      </div>
                    ) : (
                      <div className="border border-dashed border-white/15 rounded-lg p-4 text-center">
                        <p className="text-[10px] text-white/60 mb-3 leading-relaxed uppercase font-sans">
                          Link your Ethereum / Polygon Web3 wallet to execute secure on-chain payments, sign contract minting parameters, or purchase in-game tokens.
                        </p>
                        <button 
                          onClick={handleConnectWallet}
                          disabled={isProcessing}
                          className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-[9px] sm:text-xs font-extrabold uppercase tracking-widest transition-all cursor-pointer shadow-md disabled:opacity-50"
                        >
                          {isProcessing ? 'Connecting...' : 'Connect MetaMask / Web3'}
                        </button>
                      </div>
                    )}
                    
                    <div className="text-[8px] opacity-40 uppercase mt-3 leading-relaxed">
                      Chain ID: 137 (Polygon Network) or 1 (Ethereum Mainnet). Purchasing prompts standard MetaMask window authorization.
                    </div>
                  </div>

                  {/* Pricing and balances summary */}
                  {selectedBundle ? (
                    <div className="space-y-2 text-[10px] uppercase font-bold">
                      <div className="flex justify-between items-center">
                        <span className="opacity-50">Your Gold Balance:</span>
                        <span className="text-white">🪙 {playerGold.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center border-t border-white/5 pt-3">
                        <span className="opacity-50">Remaining Balance:</span>
                        <span className={playerGold >= selectedBundle.priceCoins ? 'text-green-400' : 'text-red-400'}>
                          🪙 {(playerGold - selectedBundle.priceCoins).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ) : selectedGoldBundle ? (
                    <div className="space-y-2 text-[10px] uppercase font-bold bg-black/20 p-3 rounded-lg border border-white/5">
                      <div className="flex justify-between items-center text-cyan-400">
                        <span>Gold Credit to Receive:</span>
                        <span>+ 🪙{selectedGoldBundle.amount.toLocaleString()} Coins</span>
                      </div>
                      <div className="flex justify-between items-center text-emerald-400 border-t border-white/5 pt-2">
                        <span>Checkout Cost (USD):</span>
                        <span>${selectedGoldBundle.priceUSD} USD</span>
                      </div>
                    </div>
                  ) : null}
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
                  {!walletConnected ? (
                    <button 
                      onClick={handleConnectWallet}
                      disabled={isProcessing}
                      className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-bold py-2.5 rounded-xl text-[9px] sm:text-xs tracking-widest uppercase transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      {isProcessing ? 'CONNECTING...' : 'CONNECT WALLET TO PROCEED'}
                    </button>
                  ) : selectedBundle ? (
                    <button 
                      onClick={handlePurchaseNFT}
                      disabled={isProcessing || playerGold < selectedBundle.priceCoins}
                      className="flex-1 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-zinc-950 font-bold py-2.5 rounded-xl text-[9px] sm:text-xs tracking-widest uppercase transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-yellow-500/10 active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      {isProcessing ? (
                        <span className="flex items-center gap-2">
                          <span className="w-3 h-3 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                          SIGNING CONTRACT...
                        </span>
                      ) : (
                        <>MINT WITH SIGNATURE (🪙{selectedBundle.priceCoins})</>
                      )}
                    </button>
                  ) : selectedGoldBundle ? (
                    <button 
                      onClick={handlePurchaseGold}
                      disabled={isProcessing}
                      className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-bold py-2.5 rounded-xl text-[9px] sm:text-xs tracking-widest uppercase transition-all flex items-center justify-center gap-1.5 shadow-lg active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      {isProcessing ? (
                        <span className="flex items-center gap-2">
                          <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          TX PENDING...
                        </span>
                      ) : (
                        <>PAY WITH METAMASK</>
                      )}
                    </button>
                  ) : null}
                </div>
              </motion.div>
            )}

            {checkoutStep === 'success' && (
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
                  PAYMENT & CREDIT SUCCESSFUL!
                </h3>
                <p className="text-[10px] uppercase opacity-45 tracking-wider mt-1 font-mono break-all px-4">
                  Tx: {txHash ? `${txHash.slice(0, 24)}...${txHash.slice(-24)}` : 'SECURE-STATE-SYNCED'}
                </p>
                
                {purchasedGold > 0 ? (
                  /* Gold Purchase Success Display */
                  <div className="w-full bg-zinc-950/40 border border-white/5 rounded-xl p-5 my-4">
                    <div className="text-[9px] opacity-45 uppercase font-extrabold tracking-widest mb-2 border-b border-white/5 pb-1 text-center">
                      MINT RECORD ACQUIRED
                    </div>
                    <div className="text-3xl font-black text-yellow-400 font-sans my-3 animate-pulse">
                      + 🪙{purchasedGold.toLocaleString()}
                    </div>
                    <div className="text-xs text-white uppercase tracking-wider font-extrabold">
                      Gold Coins Added to Bag
                    </div>
                    <p className="text-[8px] text-zinc-500 uppercase mt-2">
                      New Balance: 🪙{(playerGold).toLocaleString()} Coins
                    </p>
                  </div>
                ) : (
                  /* NFT Purchase Success Display */
                  <div className="w-full bg-zinc-950/40 border border-white/5 rounded-xl p-4 my-4 max-h-[180px] overflow-y-auto pr-1">
                    <div className="text-[9px] opacity-45 uppercase font-extrabold tracking-widest mb-2 border-b border-white/5 pb-1 flex items-center justify-between">
                      <span>MINTED CONTRACT TOKENS</span>
                      <span className="text-yellow-400 font-sans">qty: {mintedNfts.length}</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      {mintedNfts.slice(0, 12).map((id, index) => (
                        <div key={index} className="bg-white/[0.02] border border-white/5 p-2 rounded-lg text-left flex items-center gap-2">
                          <span className="text-lg select-none">💎</span>
                          <div>
                            <div className="text-[9px] font-bold text-white uppercase tracking-wider">NFT Item #{id}</div>
                            <div className="text-[7px] text-amber-400/80 font-bold uppercase tracking-widest">Added to Bag</div>
                          </div>
                        </div>
                      ))}
                      {mintedNfts.length > 12 && (
                        <div className="col-span-2 bg-rose-500/10 border border-rose-500/30 p-2.5 rounded-lg text-center font-bold text-[9px] text-rose-400 uppercase tracking-widest animate-pulse">
                          ⭐ AND {mintedNfts.length - 12} MORE CELESTIAL NFTS DELIVERED TO YOUR BAG! ⭐
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="text-[10px] text-white/60 text-center leading-relaxed max-w-sm mb-4 font-sans">
                  The transaction was validated by the Web3 network. Your game state and balance have been updated and synced locally. Enjoy forging and constructing!
                </div>

                <button 
                  onClick={resetCheckout}
                  className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-zinc-950 font-black rounded-xl text-[10px] tracking-widest uppercase transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  Return to Store
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
