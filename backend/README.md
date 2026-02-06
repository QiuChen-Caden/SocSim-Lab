# OASIS Frontend Backend

Backend API service for integrating OASIS simulation platform with the frontend demo application.

## Features

- **REST API**: Complete REST API for agents, feed, state, events, logs, snapshots, bookmarks, and interventions
- **WebSocket**: Real-time updates for simulation tick, agent states, posts, events, and logs
- **Extended Data Model**: Psychometrics (Big Five, Moral Foundations), social status, behavior profiles, cognitive state
- **2D Layout**: Force-directed and other layout algorithms for agent visualization
- **Emotion Analysis**: Rule-based and lexicon-based emotion analysis for posts
- **Snapshot System**: Save and restore simulation states
- **Bookmark System**: Mark and jump to key moments in simulation

## Installation

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On Linux/Mac:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

## Configuration

Create a `.env` file in the backend directory:

```env
# Database
OASIS_DB_PATH=backend/data/oasis_frontend.db

# CORS (allow frontend to connect)
CORS_ORIGINS=["http://localhost:5173","http://localhost:3000"]

# Debug mode
DEBUG=true
```

## Running

```bash
# Run the server
python main.py

# Or with uvicorn directly
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Windows PowerShell (verified command)

```powershell
Set-Location "C:\Users\Lenovo\Desktop\SocSim-Lab\backend"
$env:PYTHONIOENCODING = "utf-8"
.\venv\Scripts\python.exe .\main.py
```

The API will be available at `http://localhost:8000`

## API Documentation

Once the server is running, visit:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## API Endpoints

### Agents
- `GET /api/agents` - Get all agents or filter by IDs
- `GET /api/agents/{agent_id}` - Get single agent
- `GET /api/agents/{agent_id}/state` - Get agent state
- `PATCH /api/agents/{agent_id}/state` - Update agent state

### Feed
- `GET /api/feed` - Get feed posts
- `POST /api/feed` - Create new post

### State
- `GET /api/state` - Get simulation state
- `PATCH /api/state` - Update simulation state

### Simulation Control
- `POST /api/simulation/start` - Start simulation
- `POST /api/simulation/stop` - Stop simulation
- `POST /api/simulation/pause` - Pause simulation
- `POST /api/simulation/resume` - Resume simulation
- `PUT /api/simulation/speed` - Set speed
- `POST /api/simulation/tick` - Set current tick

### Events
- `GET /api/events` - Get timeline events
- `POST /api/events` - Create event

### Logs
- `GET /api/logs` - Get simulation logs
- `POST /api/logs` - Create log entry

### Snapshots
- `GET /api/snapshots` - Get all snapshots
- `POST /api/snapshots` - Create snapshot
- `GET /api/snapshots/{snapshot_id}` - Get snapshot
- `POST /api/snapshots/{snapshot_id}/load` - Load snapshot
- `DELETE /api/snapshots/{snapshot_id}` - Delete snapshot

### Bookmarks
- `GET /api/bookmarks` - Get all bookmarks
- `POST /api/bookmarks` - Create bookmark
- `DELETE /api/bookmarks/{bookmark_id}` - Delete bookmark

### Interventions
- `POST /api/intervention` - Create intervention

### Visualization
- `GET /api/visualization/layout` - Get 2D agent positions

### WebSocket
- `WS /ws` - WebSocket connection for real-time updates

## WebSocket Usage

```javascript
const ws = new WebSocket('ws://localhost:8000/ws');

// Subscribe to specific events
ws.send(JSON.stringify({
  type: 'subscribe',
  eventTypes: ['tick', 'post', 'agent_update'],
  agentIds: [1, 2, 3]
}));

// Handle messages
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data);

  // Message types:
  // - tick_update: {tick, isRunning, speed}
  // - agent_update: {agentId, state}
  // - post_created: {post}
  // - event_created: {event}
  // - log_added: {log}
};
```

## Database Schema

The backend extends the OASIS database schema with:

- `user_big_five` - Big Five personality traits
- `user_moral_foundations` - Moral Foundations scores
- `user_social_status` - Social status information
- `user_behavior_profile` - Behavior patterns
- `user_cognitive_state` - Cognitive and emotional state
- `user_issue_stance` - Issue positions
- `user_identity` - Extended identity information
- `user_group` - Group assignment and 2D position
- `post_emotion` - Post emotion scores
- `simulation_snapshot` - Snapshot storage
- `timeline_bookmark` - Timeline bookmarks
- `timeline_event` - Timeline events
- `simulation_log` - Simulation logs
- `simulation_state` - Global simulation state
- `intervention_record` - Intervention records

## Directory Structure

```
backend/
├── main.py              # FastAPI application
├── requirements.txt     # Python dependencies
├── README.md           # This file
├── .env                # Configuration (create this)
├── data/
│   └── oasis_frontend.db  # SQLite database
├── schema/
│   └── extended_user.sql  # Extended database schema
├── models/
│   ├── __init__.py
│   ├── types.py       # Data type definitions
│   └── database.py    # Database operations
├── algorithms/
│   ├── __init__.py
│   ├── layout.py      # 2D layout algorithms
│   └── emotion.py     # Emotion analysis
└── websocket/
    ├── __init__.py
    └── manager.py     # WebSocket connection manager
```

## Development

```bash
# Install development dependencies
pip install -r requirements.txt

# Run with auto-reload
uvicorn main:app --reload

# Run tests (when available)
pytest
```

## Integration with OASIS

The backend can optionally integrate with the OASIS library. Add the OASIS path to your Python path or install it:

```bash
# Option 1: Add to path
export PYTHONPATH="${PYTHONPATH}:/path/to/oasis-main"

# Option 2: Install in development mode
cd /path/to/oasis-main
pip install -e .
```

Then the backend can use OASIS's simulation engine directly.

## License

This backend integration follows the same license as the parent project.
