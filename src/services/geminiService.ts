function sanitizeGameState(gameState: any) {
  if (!gameState) return null;
  
  // Strip out huge procedural arrays like "world", "objs", "enemies", etc.
  // which are not used by the backend APIs, keeping payload size extremely small.
  return {
    lvl: gameState.lvl || (gameState.pl?.lvl) || 1,
    waveNum: gameState.waveNum || 0,
    day: gameState.day || 1,
    hp: gameState.hp || (gameState.pl?.hp) || 100,
    mhp: gameState.mhp || (gameState.pl?.mhp) || 100,
    inv: gameState.inv || (gameState.pl?.inv) || {},
    mapName: gameState.mapName || "Celestial Plain",
    currentBiome: gameState.currentBiome ? { n: gameState.currentBiome.n } : null,
    pl: gameState.pl ? {
      lvl: gameState.pl.lvl || 1,
      hp: gameState.pl.hp || 100,
      mhp: gameState.pl.mhp || 100,
      inv: gameState.pl.inv || {},
      x: gameState.pl.x || 0,
      y: gameState.pl.y || 0,
    } : null,
  };
}

export async function getOracleGuidance(gameState: any) {
  try {
    const sanitizedState = sanitizeGameState(gameState);
    const response = await fetch("/api/gemini/guidance", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ gameState: sanitizedState }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Client getOracleGuidance Error:", error);
    return {
      message: "An echoing cosmic wave interrupts your telepathy... Double check that your API key is correctly configured in Settings > Secrets.",
      event: "Cosmic Whispers",
      eventType: "error"
    };
  }
}

export async function generateWorldEvent(gameState: any) {
  try {
    const sanitizedState = sanitizeGameState(gameState);
    const response = await fetch("/api/gemini/world-event", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ gameState: sanitizedState }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Client generateWorldEvent Error:", error);
    return null;
  }
}

export async function castSpell(spellName: string, gameState: any) {
  try {
    const sanitizedState = sanitizeGameState(gameState);
    const response = await fetch("/api/gemini/cast-spell", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ spellName, gameState: sanitizedState }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Client castSpell Error:", error);
    return {
      success: false,
      message: "The local atmospheric mana currents disrupted the magical sequence... Try again."
    };
  }
}
