// --- Procedural Web Audio API Synthesizer and Music Engine ---
// Generates beautiful ambient soundtracks dynamically in real-time

class ProceduralMusicEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private delayNode: DelayNode | null = null;
  private delayFeedback: GainNode | null = null;
  private isPlaying: boolean = false;
  private schedulerTimer: ReturnType<typeof setInterval> | null = null;
  
  // Track parameters
  private currentTrack: 'ethereal' | 'verdant' | 'cosmic' = 'ethereal';
  private currentChordIdx: number = 0;
  private tempoBPM: number = 72;
  private volume: number = 0.3; // default volume
  
  // Dynamic scale notes (in Hz)
  // Ethereal (A Minor / C Major Pentatonic)
  private scales = {
    ethereal: {
      chords: [
        [110.00, 220.00, 261.63, 329.63, 392.00], // Am7 (A2, A3, C4, E4, G4)
        [87.31, 174.61, 220.00, 261.63, 329.63],  // Fmaj7 (F2, F3, A3, C4, E4)
        [130.81, 261.63, 329.63, 392.00, 493.88], // Cmaj7 (C3, C4, E4, G4, B4)
        [82.41, 164.81, 196.00, 246.94, 293.66],  // Em7 (E2, E3, G3, B3, D4)
      ],
      melody: [440.00, 493.88, 523.25, 587.33, 659.25, 783.99, 880.00, 987.77] // A Pentatonic
    },
    verdant: {
      chords: [
        [98.00, 196.00, 246.94, 293.66, 392.00],  // Gmaj7 (G2, G3, B3, D4, G4)
        [130.81, 261.63, 329.63, 392.00, 440.00], // Cadd9 (C3, C4, E4, G4, A4)
        [73.42, 146.83, 220.00, 293.66, 369.99],  // D7 (D2, D3, A3, D4, F#4)
        [110.00, 220.00, 261.63, 329.63, 440.00], // Am7 (A2, A3, C4, E4, A4)
      ],
      melody: [392.00, 440.00, 493.88, 587.33, 659.25, 783.99, 880.00] // G Pentatonic
    },
    cosmic: {
      chords: [
        [73.42, 146.83, 220.00, 261.63, 311.13],  // Dm7b5 (D2, D3, A3, C4, Eb4)
        [110.00, 220.00, 246.94, 311.13, 392.00], // Adim7 (A2, A3, B3, Eb4, G4)
        [58.27, 116.54, 174.61, 233.08, 293.66],  // Bbmaj7 (Bb1, Bb2, F3, Bb3, D4)
        [82.41, 164.81, 207.65, 246.94, 329.63],  // E7 (E2, E3, G#3, B3, E4)
      ],
      melody: [293.66, 311.13, 349.23, 392.00, 440.00, 466.16, 523.25, 587.33] // D Minor scale
    }
  };

  private lastScheduledTime: number = 0;
  private beatCounter: number = 0;

  constructor() {}

  // Lazily initializes the Web Audio API on first play
  private init() {
    if (this.ctx) return true;
    
    // Create audio context
    const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) {
      console.warn('Web Audio API is not supported in this browser.');
      return false;
    }

    this.ctx = new AudioContextClass();
    
    // Create master volume node
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);
    
    // Create delay (echo) node
    this.delayNode = this.ctx.createDelay(2.0);
    this.delayNode.delayTime.setValueAtTime(0.42, this.ctx.currentTime);
    
    this.delayFeedback = this.ctx.createGain();
    this.delayFeedback.gain.setValueAtTime(0.35, this.ctx.currentTime);
    
    // Connect Delay feedback loop
    this.delayNode.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delayNode);
    
    // Connect master delay to master output
    this.delayNode.connect(this.masterGain);
    return true;
  }

  public play(track: 'ethereal' | 'verdant' | 'cosmic' = 'ethereal') {
    if (!this.init()) return;
    if (this.isPlaying) {
      if (this.currentTrack !== track) {
        this.currentTrack = track;
        this.currentChordIdx = 0;
        this.beatCounter = 0;
      }
      return;
    }
    
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    
    this.currentTrack = track;
    this.isPlaying = true;
    this.currentChordIdx = 0;
    this.beatCounter = 0;
    this.lastScheduledTime = this.ctx ? this.ctx.currentTime : 0;
    
    // Start scheduler tick
    this.startScheduler();
  }

  public pause() {
    this.isPlaying = false;
    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public getCurrentTrack(): 'ethereal' | 'verdant' | 'cosmic' {
    return this.currentTrack;
  }

  private startScheduler() {
    if (this.schedulerTimer) clearInterval(this.schedulerTimer);
    
    // Check every 150ms to queue up notes ahead of time
    this.schedulerTimer = setInterval(() => {
      if (!this.isPlaying || !this.ctx) return;
      
      const lookahead = 0.3; // schedule notes 300ms in advance
      const currentTime = this.ctx.currentTime;
      const secondsPerBeat = 60 / this.tempoBPM;
      
      while (this.lastScheduledTime < currentTime + lookahead) {
        this.scheduleBeat(this.lastScheduledTime, secondsPerBeat);
        this.lastScheduledTime += secondsPerBeat;
        this.beatCounter++;
      }
    }, 150);
  }

  private scheduleBeat(time: number, beatDuration: number) {
    if (!this.ctx || !this.masterGain || !this.delayNode) return;

    const ctx = this.ctx;
    const masterGain = this.masterGain;
    const delayNode = this.delayNode;
    
    const trackData = this.scales[this.currentTrack];
    
    // --- Chord Progression Scheduling ---
    // Change chord every 8 beats
    if (this.beatCounter % 8 === 0) {
      const chord = trackData.chords[this.currentChordIdx];
      this.currentChordIdx = (this.currentChordIdx + 1) % trackData.chords.length;
      
      // Play chord notes (soft pads)
      chord.forEach((freq) => {
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        
        // Ethereal and Cosmic use smooth triangle wave, Verdant uses rustic sine
        osc.type = this.currentTrack === 'cosmic' ? 'sawtooth' : this.currentTrack === 'ethereal' ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, time);
        
        // Lowpass filter for warm sound
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        // Make cosmic/ethereal pads warmer, verdant slightly brighter
        filter.frequency.setValueAtTime(this.currentTrack === 'cosmic' ? 380 : 450, time);
        
        // Gentle pad volume envelope
        oscGain.gain.setValueAtTime(0, time);
        oscGain.gain.linearRampToValueAtTime(0.045, time + 1.2); // slow attack
        oscGain.gain.setValueAtTime(0.045, time + beatDuration * 8 - 1.5);
        oscGain.gain.exponentialRampToValueAtTime(0.0001, time + beatDuration * 8); // slow decay
        
        // Connections
        osc.connect(filter);
        filter.connect(oscGain);
        oscGain.connect(masterGain);
        
        // Also feed a little bit into the echo delay node
        oscGain.connect(delayNode);
        
        osc.start(time);
        osc.stop(time + beatDuration * 8);
      });
    }
    
    // --- Melody/Arpeggio Scheduling ---
    // Schedule a melody note on beats 0, 2, 4, 6 or randomly on other subdivisions
    const shouldPlayMelody = 
      this.beatCounter % 2 === 0 || 
      (this.currentTrack === 'ethereal' && Math.random() < 0.35) ||
      (this.currentTrack === 'cosmic' && Math.random() < 0.25);
      
    if (shouldPlayMelody) {
      const scale = trackData.melody;
      // Procedurally select melody notes with weighted bias towards chord roots
      const randomNoteIdx = Math.floor(Math.random() * scale.length);
      const freq = scale[randomNoteIdx];
      
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      
      osc.type = this.currentTrack === 'verdant' ? 'sine' : 'triangle'; // pure plucks
      osc.frequency.setValueAtTime(freq, time);
      
      // Add subtle vibrato (LFO)
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 4.5; // 4.5 Hz vibrato
      lfoGain.gain.value = 3.5; // depth of frequency modulation in Hz
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start(time);
      lfo.stop(time + beatDuration * 1.5);
      
      // Short pluck envelope
      oscGain.gain.setValueAtTime(0, time);
      oscGain.gain.linearRampToValueAtTime(0.05, time + 0.04); // quick attack
      oscGain.gain.exponentialRampToValueAtTime(0.0001, time + beatDuration * (0.8 + Math.random() * 0.7)); // smooth decay
      
      // Filter sweep
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1200, time);
      filter.frequency.exponentialRampToValueAtTime(400, time + beatDuration);
      
      osc.connect(filter);
      filter.connect(oscGain);
      oscGain.connect(masterGain);
      
      // Plucks feed moderately into delay echo node
      oscGain.connect(delayNode);
      
      osc.start(time);
      osc.stop(time + beatDuration * 2);
    }
  }
}

export const musicEngine = new ProceduralMusicEngine();
