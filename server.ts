import express, {type NextFunction, type Request, type Response} from 'express';
import {readFile} from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import {GoogleGenAI} from '@google/genai';
import {createServer as createViteServer} from 'vite';

dotenv.config();

function buildOraclePrompt(gameState: any) {
  return `
        You are the "Celestial Oracle" in a survival RPG game. 
        The player is currently at:
        - Level: ${gameState.lvl}
        - Wave: ${gameState.waveNum}
        - Day: ${gameState.day}
        - Current Map: ${gameState.mapName}
        - Health: ${gameState.hp}/${gameState.mhp}
        - Inventory: ${JSON.stringify(gameState.inv)}

        Provide a short, cryptic, but helpful piece of advice or a "prophecy" (max 2 sentences). 
        Also, suggest a "World Event" that should happen (e.g., "A meteor shower of iron", "A swarm of golden rabbits", "A sudden mana storm").
        Return the response in JSON format:
        {
          "message": "The message to the player",
          "event": "A short description of the event",
          "eventType": "one of: meteor, swarm, storm, blessing, curse"
        }
      `;
}

function createRateLimiter(maxRequests: number, windowMs: number) {
  const requests = new Map<string, {count: number; resetAt: number}>();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = req.ip || 'unknown';
    const current = requests.get(key);

    if (!current || current.resetAt <= now) {
      requests.set(key, {count: 1, resetAt: now + windowMs});
      next();
      return;
    }

    if (current.count >= maxRequests) {
      res.status(429).json({error: 'Too many requests'});
      return;
    }

    current.count += 1;
    next();
  };
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);
  const key = process.env.GEMINI_API_KEY;
  const ai = key && key !== 'MY_GEMINI_API_KEY' ? new GoogleGenAI({apiKey: key}) : null;
  const apiLimiter = createRateLimiter(30, 60_000);
  const pageLimiter = createRateLimiter(240, 60_000);

  app.use(express.json({limit: '10kb'}));

  app.post('/api/oracle-guidance', apiLimiter, async (req, res) => {
    try {
      if (!ai) {
        return res.status(503).json({error: 'Gemini API key is not configured'});
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: buildOraclePrompt(req.body),
        config: {
          responseMimeType: 'application/json',
        },
      });

      const text = response.text;
      if (!text) {
        return res.status(502).json({error: 'Empty response from Gemini'});
      }

      res.json(JSON.parse(text));
    } catch (error) {
      console.error('Gemini Error:', error);
      res.status(500).json({error: 'Failed to fetch oracle guidance'});
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {middlewareMode: true},
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    const indexHtml = await readFile(path.join(distPath, 'index.html'), 'utf8');
    app.use(express.static(distPath));
    app.get('*', pageLimiter, (_req, res) => {
      res.type('html').send(indexHtml);
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Critical server bootstrap error:', error);
});
