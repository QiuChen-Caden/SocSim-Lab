# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**SocSim Lab** (v3.2) is a social simulation visualization platform based on Agent-Based Modeling (ABM). It uses real Twitter user personas (30 profiles) combined with psychological models (Big Five personality, Moral Foundations Theory) to simulate and visualize social dynamics, opinion propagation, and group behavior.

**Current Status**: Production Ready
**Last Updated**: 2026-02-07

## Common Development Commands

### Frontend (React + Vite + TypeScript)
```bash
cd frontend
npm install           # Install dependencies
npm run dev          # Start dev server (http://localhost:5173)
npm run build        # Production build
npm run lint         # ESLint check
npm run preview      # Preview production build
```

### Backend (FastAPI + Python)
```bash
cd backend
python -m venv venv
venv\Scripts\activate     # Windows
source venv/bin/activate  # Linux/Mac
pip install -r requirements.txt
python main.py            # Start server (http://localhost:8000)
```

### Configuration

**Frontend mode**: Set `VITE_USE_REAL_API=true` in `frontend/.env` to connect to backend API
- Default: `false` (uses mock data in `useMockEngine.ts`)
- With real API: Fetches agents, state, feed from backend

**Backend**: Copy `backend/.env.example` to `backend/.env` and configure:
- `OASIS_DB_PATH`: SQLite database path (default: `data/oasis_frontend.db`)
- `CORS_ORIGINS`: Allowed frontend origins
- `DEBUG`: Debug mode

## Architecture

### High-Level Structure

```
SocSim-Lab/
├── frontend/              # React 19 + TypeScript + Vite
│   ├── src/
│   │   ├── app/          # Core application logic
│   │   │   ├── SimulationProvider.tsx  # Global state (React Context + useReducer)
│   │   │   ├── state.ts               # State reducer & actions
│   │   │   ├── types.ts               # TypeScript definitions
│   │   │   ├── api.ts                 # Backend API client
│   │   │   ├── useMockEngine.ts       # Mock simulation (default)
│   │   │   └── useRealEngine.ts       # Real backend integration
│   │   ├── components/   # Reusable UI components
│   │   │   └── PixiWorld.tsx          # PixiJS 2D agent visualization
│   │   └── views/        # Main application views
│   │       ├── WorkbenchView.tsx      # Experiment control interface
│   │       ├── WorldView.tsx          # 2D agent world visualization
│   │       ├── FeedView.tsx           # Social media feed
│   │       └── ReplayView.tsx         # System log viewer (events, timeline, bookmarks)
│   ├── package.json
│   └── vite.config.ts    # Proxy config: /api -> http://127.0.0.1:8000
├── backend/              # FastAPI + Python
│   ├── main.py           # FastAPI app + REST/WebSocket endpoints
│   ├── requirements.txt
│   ├── models/           # Database models & operations
│   ├── algorithms/       # Layout algorithms, emotion analysis
│   ├── websocket/        # WebSocket manager
│   └── data/             # SQLite database location
└── docs/                 # Product docs (PRD, UI Inventory, README)
```

### Dual Engine Architecture

The frontend can operate in two modes:

1. **Mock Mode** (default): `useMockEngine.ts` - Generates simulated data locally
2. **Real Mode**: `useRealEngine.ts` - Connects to FastAPI backend via HTTP/WebSocket

Control via `VITE_USE_REAL_API` environment variable.

### State Management (Frontend)

- **Pattern**: React Context + `useReducer`
- **Provider**: `SimulationProvider.tsx` wraps entire app
- **State shape**: `SimulationState` in `types.ts`
- **Actions**: Defined in `state.ts` (e.g., `toggle_run`, `set_tick`, `push_feed`)

### Data Flow

```
User Action → View Component → SimActions → Context dispatch → Reducer
                                                          ↓
                                              State Update → Re-render
                                                          ↓
                                    (Optional) API call → Backend
                                                          ↓
                                              WebSocket update → Frontend
```

### Key Data Structures

**AgentProfile**: Twitter persona with identity, psychometrics (Big Five, Moral Foundations), social status, behavior profile, cognitive state

**AgentState**: Runtime state (mood, stance, resources, lastAction, evidence)

**FeedPost**: Social media posts with emotion scores

**TimelineEvent**: Agent actions, messages, interventions, alerts, bookmarks

**SimulationState**: Global config, tick, agents, events, logs, feed, snapshots

### Backend Integration

**REST API Endpoints**:
- `/api/agents` - Agent CRUD
- `/api/feed` - Feed posts
- `/api/state` - Simulation state
- `/api/simulation/*` - Control (start, stop, pause, speed, tick)
- `/api/events`, `/api/logs`, `/api/snapshots`, `/api/bookmarks`, `/api/intervention`
- `/api/visualization/layout` - 2D agent positions

**WebSocket** (`/ws`): Real-time updates for tick, agent state, posts, events, logs

**OASIS Integration**: Backend can integrate with OASIS simulation framework (optional)

## Development Notes

### Twitter Personas Data

- Location: `twitter_personas_20260123_222506.json` (30 real Twitter profiles)
- Used by: `frontend/src/app/persona.ts` and `backend/import_personas.py`
- Contains: Identity, Big Five personality, Moral Foundations, social status, behavior patterns

### PixiJS Visualization

- Library: PixiJS 8.x + pixi-viewport
- Component: `PixiWorld.tsx`
- Features: 1000+ agents, zoom/pan, click selection, mood-based coloring
- Modes: micro (individual agents) vs macro (heat map/clusters)

### State Synchronization

- Frontend state is source of truth in mock mode
- Backend state syncs via `api.state.get()` and WebSocket in real mode
- Tick changes filter logs/events/feed based on timestamp

### Simulation Control

- Play/Pause: `toggle_run` action
- Speed: `set_speed` action (0.1x to 20x)
- Tick navigation: `set_tick` action (updates all time-based data)
- Snapshots: Save/load complete simulation state

## Important Constraints

- Only 30 Twitter personas available (IDs 1-30)
- Mock mode generates plausible data but not scientifically accurate
- Real backend requires OASIS framework integration for authentic simulation
- Frontend types must match backend models (Python dataclasses in `models/types.py`)

## Documentation References

- `docs/PRD.md`: Product requirements, user journeys, feature breakdown
- `docs/ui-inventory.md`: Complete UI component inventory
- `backend/README.md`: API documentation and setup
- `docs/README.md`: Project overview in Chinese
