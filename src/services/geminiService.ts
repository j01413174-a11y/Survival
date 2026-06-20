export async function getOracleGuidance(gameState: any) {
  try {
    const response = await fetch('/api/oracle-guidance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(gameState),
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Gemini Error:", error);
    return null;
  }
}
