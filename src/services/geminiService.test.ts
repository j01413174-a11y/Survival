import { describe, it, expect } from 'vitest';
import {
  sanitizeGameState,
  getProceduralGuidance,
  getProceduralWorldEvent,
  getProceduralSpellResult,
} from './geminiService';

// ---------------------------------------------------------------------------
// sanitizeGameState
// ---------------------------------------------------------------------------
describe('sanitizeGameState', () => {
  it('returns null for null/undefined input', () => {
    expect(sanitizeGameState(null)).toBeNull();
    expect(sanitizeGameState(undefined)).toBeNull();
  });

  it('extracts top-level fields with defaults when missing', () => {
    const result = sanitizeGameState({});
    expect(result).toMatchObject({
      lvl: 1,
      waveNum: 0,
      day: 1,
      hp: 100,
      mhp: 100,
      inv: {},
      mapName: 'Celestial Plain',
      currentBiome: null,
      pl: null,
    });
  });

  it('prefers top-level fields over nested pl fields', () => {
    const state = {
      lvl: 5,
      waveNum: 3,
      day: 10,
      hp: 80,
      mhp: 120,
      inv: { wood: 5 },
      mapName: 'Frozen Wastes',
      currentBiome: { n: 'Tundra', extra: 'ignored' },
      pl: { lvl: 2, hp: 40, mhp: 100, inv: {}, x: 64, y: 128 },
    };
    const result = sanitizeGameState(state);
    expect(result!.lvl).toBe(5);
    expect(result!.day).toBe(10);
    expect(result!.hp).toBe(80);
    expect(result!.mapName).toBe('Frozen Wastes');
  });

  it('strips large world arrays – only keeps allowed keys', () => {
    const state = {
      lvl: 3,
      world: new Array(10000).fill(0),
      objs: new Array(500).fill({}),
      enemies: new Array(200).fill({}),
    };
    const result = sanitizeGameState(state);
    expect(result).not.toHaveProperty('world');
    expect(result).not.toHaveProperty('objs');
    expect(result).not.toHaveProperty('enemies');
  });

  it('extracts biome name only', () => {
    const state = { currentBiome: { n: 'Desert', color: '#ffcc00', moisture: 0.1 } };
    const result = sanitizeGameState(state);
    expect(result!.currentBiome).toEqual({ n: 'Desert' });
  });

  it('maps nested pl fields when top-level fields are absent', () => {
    const state = {
      pl: { lvl: 7, hp: 55, mhp: 110, inv: { stone: 3 }, x: 32, y: 96 },
    };
    const result = sanitizeGameState(state);
    expect(result!.lvl).toBe(7);
    expect(result!.hp).toBe(55);
    expect(result!.mhp).toBe(110);
    expect(result!.pl).toMatchObject({ lvl: 7, hp: 55, mhp: 110, x: 32, y: 96 });
  });
});

// ---------------------------------------------------------------------------
// getProceduralGuidance
// ---------------------------------------------------------------------------
describe('getProceduralGuidance', () => {
  it('returns an object with message, event and eventType', () => {
    const result = getProceduralGuidance({});
    expect(result).toHaveProperty('message');
    expect(result).toHaveProperty('event');
    expect(result).toHaveProperty('eventType');
  });

  it('message contains day and hp values from gameState', () => {
    // Run enough times to have a reasonable chance of hitting those templates
    const results = Array.from({ length: 50 }, () =>
      getProceduralGuidance({ day: 42, lvl: 3, hp: 77 })
    );
    const messages = results.map((r) => r.message);
    const mentionsDay = messages.some((m) => m.includes('42'));
    const mentionsHp = messages.some((m) => m.includes('77'));
    // At least one template references day, at least one references hp
    expect(mentionsDay).toBe(true);
    expect(mentionsHp).toBe(true);
  });

  it('defaults day/lvl/hp when not provided', () => {
    // Should not throw
    expect(() => getProceduralGuidance(null)).not.toThrow();
    expect(() => getProceduralGuidance(undefined)).not.toThrow();
  });

  it('eventType is one of the known types', () => {
    const knownTypes = new Set(['meteor', 'swarm', 'storm', 'blessing', 'curse']);
    for (let i = 0; i < 20; i++) {
      const { eventType } = getProceduralGuidance({});
      expect(knownTypes.has(eventType)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// getProceduralWorldEvent
// ---------------------------------------------------------------------------
describe('getProceduralWorldEvent', () => {
  it('returns an event object with expected shape', () => {
    const event = getProceduralWorldEvent({});
    expect(event).toHaveProperty('title');
    expect(event).toHaveProperty('narrative');
    expect(event).toHaveProperty('durationSeconds');
    expect(event).toHaveProperty('effect');
    expect(event).toHaveProperty('choices');
  });

  it('choices array is non-empty', () => {
    for (let i = 0; i < 10; i++) {
      const event = getProceduralWorldEvent({});
      expect(Array.isArray(event.choices)).toBe(true);
      expect(event.choices.length).toBeGreaterThan(0);
    }
  });

  it('each choice has id, text, isMet and reward', () => {
    for (let i = 0; i < 10; i++) {
      const event = getProceduralWorldEvent({});
      for (const choice of event.choices) {
        expect(choice).toHaveProperty('id');
        expect(choice).toHaveProperty('text');
        expect(choice).toHaveProperty('isMet');
        expect(choice).toHaveProperty('reward');
      }
    }
  });

  it('level-gated choices require level ≥ threshold', () => {
    // Twilight Void Eclipse choice 1 requires level 5
    // Generate many events; when we get the void eclipse, verify gate
    let foundVoid = false;
    for (let i = 0; i < 200; i++) {
      const event = getProceduralWorldEvent({ pl: { lvl: 2 } });
      if (event.title.includes('Twilight Void Eclipse')) {
        foundVoid = true;
        const gatedChoice = event.choices.find((c: any) => c.id === 'void_choice_1');
        expect(gatedChoice!.isMet).toBe(false);
        break;
      }
    }
    // If we never hit the event in 200 tries that's fine (random), skip assertion
    if (!foundVoid) return;
  });

  it('high-level player satisfies level-gated choices', () => {
    for (let i = 0; i < 200; i++) {
      const event = getProceduralWorldEvent({ pl: { lvl: 10 } });
      if (event.title.includes('Twilight Void Eclipse')) {
        const gatedChoice = event.choices.find((c: any) => c.id === 'void_choice_1');
        expect(gatedChoice!.isMet).toBe(true);
        break;
      }
    }
  });

  it('effect has statModifiers object', () => {
    const event = getProceduralWorldEvent({});
    expect(event.effect).toHaveProperty('statModifiers');
    const sm = event.effect.statModifiers;
    expect(sm).toHaveProperty('speedBoost');
    expect(sm).toHaveProperty('dmgBoost');
    expect(sm).toHaveProperty('healthDrain');
  });
});

// ---------------------------------------------------------------------------
// getProceduralSpellResult
// ---------------------------------------------------------------------------
describe('getProceduralSpellResult', () => {
  it('Reveal Map returns scouted nodes', () => {
    const result = getProceduralSpellResult('Reveal Map', {});
    expect(result.success).toBe(true);
    expect(Array.isArray(result.scoutedNodes)).toBe(true);
    expect(result.scoutedNodes!.length).toBeGreaterThan(0);
  });

  it('Resource Bounty – celestial biome returns celestial drops', () => {
    const result = getProceduralSpellResult('Resource Bounty', {
      currentBiome: { n: 'Celestial Plain' },
    });
    expect(result.success).toBe(true);
    const items = result.spawnDrops!.map((d: any) => d.item);
    expect(items).toContain('void_crystal');
  });

  it('Resource Bounty – desert biome returns desert drops', () => {
    const result = getProceduralSpellResult('Resource Bounty', {
      currentBiome: { n: 'Barren Desert' },
    });
    const items = result.spawnDrops!.map((d: any) => d.item);
    expect(items).toContain('gold_ore');
  });

  it('Resource Bounty – frozen/tundra biome returns iron/crystal drops', () => {
    const result = getProceduralSpellResult('Resource Bounty', {
      currentBiome: { n: 'Frozen Tundra' },
    });
    const items = result.spawnDrops!.map((d: any) => d.item);
    expect(items).toContain('iron_ore');
  });

  it('Resource Bounty – default biome returns wood/copper/berry', () => {
    const result = getProceduralSpellResult('Resource Bounty', {
      currentBiome: { n: 'Forest' },
    });
    const items = result.spawnDrops!.map((d: any) => d.item);
    expect(items).toContain('wood');
  });

  it('Healing Sanctuary returns restoration with healHP', () => {
    const result = getProceduralSpellResult('Healing Sanctuary', {});
    expect(result.success).toBe(true);
    expect(result.restoration).toHaveProperty('healHP');
    expect(result.restoration!.healHP).toBeGreaterThan(0);
  });

  it('Flame Burst returns damage', () => {
    const result = getProceduralSpellResult('Flame Burst', {});
    expect(result.success).toBe(true);
    expect(result.damage).toBeGreaterThan(0);
  });

  it('Tectonic Rift returns harvestRange', () => {
    const result = getProceduralSpellResult('Tectonic Rift', {});
    expect(result.success).toBe(true);
    expect(result.harvestRange).toBeGreaterThan(0);
  });

  it('unknown spell falls back to a healing result', () => {
    const result = getProceduralSpellResult('Unknown Spell XYZ', {});
    expect(result.success).toBe(true);
    expect(result.restoration).toHaveProperty('healHP');
  });

  it('Reveal Map uses player coordinates from gameState', () => {
    const result = getProceduralSpellResult('Reveal Map', {
      pl: { x: 320, y: 160 },
    });
    const plX = Math.floor(320 / 32); // 10
    const plY = Math.floor(160 / 32); // 5
    // The nodes are offset from plX/plY – verify at least one is nearby
    const firstNode = result.scoutedNodes![0];
    // tx should be plX ± some offset (not completely unrelated to coords)
    expect(Math.abs(firstNode.tx - plX)).toBeLessThan(20);
  });
});
