import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Shuffle, Sliders, Layers, RefreshCw, Eye, Percent, Database } from 'lucide-react';

// --- Procedural 2D Coherent Noise Generator (Pseudo Perlin / Value Noise with Seed) ---
class CoherentNoise2D {
  private p: number[] = [];

  constructor(seed: number) {
    this.reseed(seed);
  }

  public reseed(seed: number) {
    // Standard Linear Congruential Generator to shuffle permutation table based on seed
    const lcg = (s: number) => {
      let current = s;
      return () => {
        current = (current * 1664525 + 1013904223) % 4294967296;
        return current / 4294967296;
      };
    };

    const nextRand = lcg(seed);
    const permutation = Array.from({ length: 256 }, (_, i) => i);
    
    // Shuffle
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(nextRand() * (i + 1));
      const temp = permutation[i];
      permutation[i] = permutation[j];
      permutation[j] = temp;
    }

    // Duplicate table to prevent wrap boundaries
    this.p = [...permutation, ...permutation];
  }

  private fade(t: number) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(t: number, a: number, b: number) {
    return a + t * (b - a);
  }

  private grad(hash: number, x: number, y: number) {
    const h = hash & 7;
    const u = h < 4 ? x : y;
    const v = h < 4 ? y : x;
    return ((h & 1) ? -u : u) + ((h & 2) ? -2.0 * v : 2.0 * v);
  }

  // 2D Coherent Noise output between -1.0 and 1.0
  public noise(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;

    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);

    const u = this.fade(xf);
    const v = this.fade(yf);

    const aa = this.p[this.p[X] + Y];
    const ab = this.p[this.p[X] + Y + 1];
    const ba = this.p[this.p[X + 1] + Y];
    const bb = this.p[this.p[X + 1] + Y + 1];

    const x1 = this.lerp(u, this.grad(aa, xf, yf), this.grad(ba, xf - 1, yf));
    const x2 = this.lerp(u, this.grad(ab, xf, yf - 1), this.grad(bb, xf - 1, yf - 1));

    return this.lerp(v, x1, x2);
  }

  // Fractional Brownian Motion (fBm) with multiple octaves
  public fBm(x: number, y: number, octaves: number, persistence: number, lacunarity: number): number {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      total += this.noise(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    // Normalize result between -1 and 1, then map to 0.0 - 1.0
    const rawVal = total / maxValue;
    return (rawVal + 1.0) / 2.0;
  }
}

export interface TerrainTile {
  x: number;
  y: number;
  elevation: number;
  moisture: number;
  type: 'water' | 'plains' | 'forest' | 'mountain';
  label: string;
  emoji: string;
  color: string;
  bgClass: string;
  desc: string;
}

interface TerrainGeneratorProps {
  onApplySeed?: (seed: number) => void;
  currentWorldSeed?: number;
}

export default function TerrainGenerator({ onApplySeed, currentWorldSeed }: TerrainGeneratorProps) {
  // Configuration State
  const [seed, setSeed] = useState<number>(currentWorldSeed || 42);
  const [gridSize, setGridSize] = useState<number>(18); // 18x18 standard tile grid
  const [scale, setScale] = useState<number>(0.12);
  const [octaves, setOctaves] = useState<number>(3);
  const [persistence, setPersistence] = useState<number>(0.5);
  const [lacunarity, setLacunarity] = useState<number>(2.0);
  
  // Custom thresholds (0.0 to 1.0)
  const [waterLevel, setWaterLevel] = useState<number>(0.35);
  const [forestLevel, setForestLevel] = useState<number>(0.65);
  const [mountainLevel, setMountainLevel] = useState<number>(0.82);

  const [grid, setGrid] = useState<TerrainTile[][]>([]);
  const [selectedTile, setSelectedTile] = useState<TerrainTile | null>(null);
  const [stats, setStats] = useState({ water: 0, plains: 0, forest: 0, mountain: 0 });

  // Generate terrain function
  const regenerateGrid = () => {
    const generator = new CoherentNoise2D(seed);
    const moistureGenerator = new CoherentNoise2D(seed + 9876); // offset seed for moisture map
    
    const newGrid: TerrainTile[][] = [];
    let waterCount = 0;
    let plainsCount = 0;
    let forestCount = 0;
    let mountainCount = 0;

    for (let y = 0; y < gridSize; y++) {
      const row: TerrainTile[] = [];
      for (let x = 0; x < gridSize; x++) {
        // Evaluate elevation fBm
        const elevation = generator.fBm(
          x * scale, 
          y * scale, 
          octaves, 
          persistence, 
          lacunarity
        );

        // Evaluate moisture/humidity fBm
        const moisture = moistureGenerator.fBm(
          x * scale * 1.5, 
          y * scale * 1.5, 
          2, 
          0.5, 
          2.0
        );

        // Assign biome type based on thresholds
        let type: 'water' | 'plains' | 'forest' | 'mountain' = 'plains';
        let label = 'Plains';
        let emoji = '🌾';
        let color = '#a3e635'; // Lime green
        let bgClass = 'bg-lime-500/10 border-lime-500/30 text-lime-400 hover:bg-lime-500/20';
        let desc = 'Open grassy plains perfect for gathering fiber, hunting wild deer, and setting camp.';

        if (elevation < waterLevel) {
          type = 'water';
          label = 'Deep Water';
          emoji = '🌊';
          color = '#38bdf8'; // Sky blue
          bgClass = 'bg-sky-500/15 border-sky-500/30 text-sky-400 hover:bg-sky-500/25';
          desc = 'Vibrant ocean or deep lake resource. Ideal for spearfishing and gathering water kelp.';
          waterCount++;
        } else if (elevation >= mountainLevel) {
          type = 'mountain';
          label = 'High Peak';
          emoji = '🏔️';
          color = '#cbd5e1'; // Slate gray
          bgClass = 'bg-slate-500/20 border-slate-500/40 text-slate-300 hover:bg-slate-500/30';
          desc = 'High altitude rock. Packed with heavy iron deposits, raw coals, and rare crystal clusters.';
          mountainCount++;
        } else {
          // Plains or Forest determined by moisture level
          if (moisture > (1 - forestLevel)) {
            type = 'forest';
            label = 'Dense Forest';
            emoji = '🌲';
            color = '#22c55e'; // Green
            bgClass = 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25';
            desc = 'Thick forest canopies teeming with high-grade wood logs, wild herbs, mushrooms, and active wolf dens.';
            forestCount++;
          } else {
            type = 'plains';
            plainsCount++;
          }
        }

        row.push({
          x,
          y,
          elevation,
          moisture,
          type,
          label,
          emoji,
          color,
          bgClass,
          desc
        });
      }
      newGrid.push(row);
    }

    setGrid(newGrid);
    
    const total = gridSize * gridSize;
    setStats({
      water: Math.round((waterCount / total) * 100),
      plains: Math.round((plainsCount / total) * 100),
      forest: Math.round((forestCount / total) * 100),
      mountain: Math.round((mountainCount / total) * 100)
    });

    // Auto-select center tile for details
    const mid = Math.floor(gridSize / 2);
    if (newGrid[mid]?.[mid]) {
      setSelectedTile(newGrid[mid][mid]);
    }
  };

  // Sync seed from props if available
  useEffect(() => {
    if (currentWorldSeed) {
      setSeed(currentWorldSeed);
    }
  }, [currentWorldSeed]);

  // Regenerate when values change
  useEffect(() => {
    regenerateGrid();
  }, [seed, gridSize, scale, octaves, persistence, lacunarity, waterLevel, forestLevel, mountainLevel]);

  const handleRandomSeed = () => {
    const newSeed = Math.floor(Math.random() * 99999) + 1;
    setSeed(newSeed);
  };

  return (
    <div className="bg-zinc-950/80 border border-emerald-500/20 p-5 rounded-2xl flex flex-col gap-5 text-white font-mono">
      {/* Module Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-white/5 pb-3">
        <div>
          <div className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-widest flex items-center gap-1.5">
            <RefreshCw size={11} className="animate-spin [animation-duration:10s]" />
            Noise Synthesis Engine
          </div>
          <h3 className="text-md font-bold text-white uppercase mt-0.5 tracking-wider">Procedural 2D Map Generator</h3>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={handleRandomSeed}
            className="flex-1 sm:flex-none px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer"
          >
            <Shuffle size={12} />
            <span>Random</span>
          </button>
          
          {onApplySeed && (
            <button
              onClick={() => {
                onApplySeed(seed);
              }}
              className="flex-1 sm:flex-none px-3.5 py-1.5 bg-emerald-500 text-black hover:bg-emerald-400 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 cursor-pointer flex items-center justify-center"
            >
              <span>APPLY WORLD SEED</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left Column: Noise Slider Customization (4 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="bg-white/[0.01] border border-white/5 p-4 rounded-xl flex flex-col gap-4">
            <div className="text-[10px] font-bold uppercase text-emerald-400 flex items-center gap-1">
              <Sliders size={12} />
              <span>Octave Parameters</span>
            </div>

            {/* Seed input */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[9px] text-zinc-400 uppercase font-bold">
                <span>Terrain Generation Seed</span>
                <span className="text-emerald-400">#{seed}</span>
              </div>
              <input 
                type="number" 
                value={seed}
                onChange={(e) => setSeed(parseInt(e.target.value) || 0)}
                className="bg-zinc-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs font-bold text-emerald-300 focus:outline-none focus:border-emerald-500/50"
              />
            </div>

            {/* Noise Frequency / Scale */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[9px] text-zinc-400 uppercase font-bold">
                <span>Noise Frequency (Scale)</span>
                <span className="text-white font-mono">{scale.toFixed(3)}</span>
              </div>
              <input 
                type="range" 
                min="0.02" 
                max="0.45" 
                step="0.01" 
                value={scale}
                onChange={(e) => setScale(parseFloat(e.target.value))}
                className="accent-emerald-500 w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Noise Octaves */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[9px] text-zinc-400 uppercase font-bold">
                <span>Octaves (Layer Detail)</span>
                <span className="text-white font-mono">{octaves}</span>
              </div>
              <input 
                type="range" 
                min="1" 
                max="4" 
                step="1" 
                value={octaves}
                onChange={(e) => setOctaves(parseInt(e.target.value))}
                className="accent-emerald-500 w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Persistence */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[9px] text-zinc-400 uppercase font-bold">
                <span>Persistence (Grit)</span>
                <span className="text-white font-mono">{persistence.toFixed(2)}</span>
              </div>
              <input 
                type="range" 
                min="0.20" 
                max="0.80" 
                step="0.05" 
                value={persistence}
                onChange={(e) => setPersistence(parseFloat(e.target.value))}
                className="accent-emerald-500 w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>

          <div className="bg-white/[0.01] border border-white/5 p-4 rounded-xl flex flex-col gap-4">
            <div className="text-[10px] font-bold uppercase text-emerald-400 flex items-center gap-1">
              <Layers size={12} />
              <span>Biome Level Cuts</span>
            </div>

            {/* Water Threshold */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[9px] text-zinc-400 uppercase font-bold">
                <span>Water Level Cutoff</span>
                <span className="text-sky-400 font-mono">{(waterLevel * 100).toFixed(0)}%</span>
              </div>
              <input 
                type="range" 
                min="0.10" 
                max="0.55" 
                step="0.02" 
                value={waterLevel}
                onChange={(e) => setWaterLevel(parseFloat(e.target.value))}
                className="accent-sky-500 w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Forest Threshold */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[9px] text-zinc-400 uppercase font-bold">
                <span>Forest Humidity cutoff</span>
                <span className="text-emerald-400 font-mono">{(forestLevel * 100).toFixed(0)}%</span>
              </div>
              <input 
                type="range" 
                min="0.30" 
                max="0.85" 
                step="0.02" 
                value={forestLevel}
                onChange={(e) => setForestLevel(parseFloat(e.target.value))}
                className="accent-emerald-500 w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Mountain Threshold */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[9px] text-zinc-400 uppercase font-bold">
                <span>Mountain peak Level</span>
                <span className="text-slate-300 font-mono">{(mountainLevel * 100).toFixed(0)}%</span>
              </div>
              <input 
                type="range" 
                min="0.65" 
                max="0.92" 
                step="0.01" 
                value={mountainLevel}
                onChange={(e) => setMountainLevel(parseFloat(e.target.value))}
                className="accent-slate-400 w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Center/Right Column: Interactive 2D Map Grid Rendering (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="bg-zinc-950 border border-white/5 p-4 rounded-xl flex flex-col justify-center items-center">
            
            {/* 2D Tile Grid rendering */}
            <div className="grid gap-1 bg-zinc-900/30 p-2.5 rounded-2xl border border-white/5 relative">
              <div 
                style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}
                className="grid gap-[2px] w-full max-w-[420px] aspect-square"
              >
                {grid.flat().map((tile) => {
                  const isSelected = selectedTile?.x === tile.x && selectedTile?.y === tile.y;
                  return (
                    <button
                      key={`${tile.x}-${tile.y}`}
                      onClick={() => setSelectedTile(tile)}
                      className={`aspect-square flex items-center justify-center text-[10px] sm:text-xs rounded border transition-all select-none hover:scale-110 active:scale-95 cursor-pointer ${tile.bgClass} ${
                        isSelected ? 'scale-115 shadow-[0_0_12px_rgba(255,255,255,0.15)] ring-1 ring-white/60 z-10' : ''
                      }`}
                      title={`(${tile.x}, ${tile.y}) - ${tile.label}`}
                    >
                      {tile.emoji}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Color Legend & Statistics */}
            <div className="w-full grid grid-cols-4 gap-2 mt-4 text-[9px] text-zinc-400 text-center uppercase border-t border-white/5 pt-3">
              <div className="flex flex-col gap-1 border-r border-white/5">
                <div className="text-[11px]">🌊</div>
                <div className="font-extrabold text-sky-400">WATER {stats.water}%</div>
              </div>
              <div className="flex flex-col gap-1 border-r border-white/5">
                <div className="text-[11px]">🌾</div>
                <div className="font-extrabold text-lime-400">PLAINS {stats.plains}%</div>
              </div>
              <div className="flex flex-col gap-1 border-r border-white/5">
                <div className="text-[11px]">🌲</div>
                <div className="font-extrabold text-emerald-400">FOREST {stats.forest}%</div>
              </div>
              <div className="flex flex-col gap-1">
                <div className="text-[11px]">🏔️</div>
                <div className="font-extrabold text-slate-300">PEAK {stats.mountain}%</div>
              </div>
            </div>
          </div>

          {/* Selected Tile Inspector Panel */}
          {selectedTile && (
            <div className="bg-white/[0.01] border border-white/10 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-2xl select-none">{selectedTile.emoji}</span>
                  <div>
                    <div className="text-xs font-black text-white uppercase tracking-wider">{selectedTile.label} Tile</div>
                    <div className="text-[9px] text-zinc-500">GRID POSITION: ({selectedTile.x}, {selectedTile.y})</div>
                  </div>
                </div>
                <p className="text-[10px] opacity-65 leading-relaxed uppercase mt-2 font-sans">{selectedTile.desc}</p>
              </div>

              {/* Precise Coherent Noise readouts */}
              <div className="flex sm:flex-col gap-3 sm:gap-1.5 shrink-0 bg-zinc-900/60 p-3 rounded-lg border border-white/5 w-full sm:w-auto text-[9px]">
                <div className="flex-1 sm:flex-none flex justify-between gap-6 uppercase">
                  <span className="opacity-50 flex items-center gap-1">
                    <Database size={10} className="text-amber-400" /> Elevation
                  </span>
                  <span className="text-amber-400 font-extrabold font-mono">{selectedTile.elevation.toFixed(4)}</span>
                </div>
                <div className="flex-1 sm:flex-none flex justify-between gap-6 uppercase">
                  <span className="opacity-50 flex items-center gap-1">
                    <Percent size={10} className="text-cyan-400" /> Moisture
                  </span>
                  <span className="text-cyan-400 font-extrabold font-mono">{selectedTile.moisture.toFixed(4)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
