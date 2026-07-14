# Survival

Survival is a browser-based crafting and exploration game built with React, Vite, TypeScript, and an Express server. The project combines a large real-time survival sandbox with AI-assisted world events, spell casting, oracle guidance, procedural music, and Firebase-backed cloud saves.

## Highlights

- Large tile-based survival world with combat, gathering, crafting, building, and progression
- AI-powered oracle guidance, world events, and spell outcomes with procedural fallbacks when Gemini is unavailable
- Firebase authentication and Firestore cloud save support
- Built-in research, shops, NPC dialogue, fishing, quests, and music systems
- Single local server that hosts both the Vite frontend and backend API routes

## Tech Stack

- React 19
- TypeScript
- Vite
- Express
- Firebase Auth + Firestore
- Google Gemini API

## Getting Started

### Prerequisites

- Node.js
- npm

### Installation

```bash
npm install
```

### Environment

Create a local environment file from the example:

```bash
cp .env.example .env.local
```

Required variables:

- `GEMINI_API_KEY` - enables Gemini-backed guidance, world events, and spell results
- `APP_URL` - used by the hosted app configuration

If `GEMINI_API_KEY` is missing, the game still runs and falls back to procedural responses.

## Running the Project

Start the local development server:

```bash
npm run dev
```

The app runs through `server.ts`, which serves the frontend and the backend API together.

## Available Scripts

- `npm run dev` - start the local Express + Vite development server
- `npm run build` - build the frontend and bundle the server into `dist/`
- `npm run start` - run the production server from `dist/server.cjs`
- `npm run preview` - preview the Vite frontend build
- `npm run lint` - run TypeScript type-checking with `tsc --noEmit`
- `npm run clean` - remove the `dist/` directory

## Project Structure

```text
.
├── server.ts                 # Express server and Gemini API endpoints
├── src/
│   ├── App.tsx               # App shell
│   ├── components/
│   │   ├── SurvivalGame.tsx  # Main game implementation
│   │   ├── Shop.tsx
│   │   ├── TownShop.tsx
│   │   ├── NPCDialogue.tsx
│   │   ├── ResearchTree.tsx
│   │   └── TerrainGenerator.tsx
│   └── services/
│       ├── audioService.ts   # Procedural music engine
│       ├── firebase.ts       # Auth and Firestore helpers
│       └── geminiService.ts  # Client API calls and fallbacks
├── firestore.rules
└── vite.config.ts
```

## Notes

- The main game logic currently lives in `src/components/SurvivalGame.tsx`.
- Firebase app configuration is already checked into the repository for client setup.
- Build output may warn about large frontend chunks; the build still succeeds.
