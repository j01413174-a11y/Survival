export async function getOracleGuidance(gameState: any) {
  try {
    const response = await fetch("/api/gemini/guidance", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ gameState }),
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
    const response = await fetch("/api/gemini/world-event", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ gameState }),
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
