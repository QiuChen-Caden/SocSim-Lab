"""
OASIS Frontend Integration Backend - Main FastAPI Application

This backend service provides REST API and WebSocket endpoints
to integrate the OASIS simulation platform with the frontend demo.
"""
import uuid
import time
import asyncio
import re
import math
from typing import Optional, List, Any
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings

from models import (
    init_db,
    get_all_agents,
    get_agent_by_id,
    get_agents_by_ids,
    save_agent_profile,
    get_feed_posts,
    save_feed_post,
    get_simulation_state,
    save_simulation_state,
    create_snapshot,
    get_all_snapshots,
    get_snapshot_by_id,
    save_timeline_event,
    get_timeline_events,
    save_log_line,
    get_log_lines,
    save_intervention,
    get_all_interventions,
    save_bookmark,
    get_all_bookmarks,
    delete_bookmark,
    get_all_group_profiles,
    AgentProfile,
    AgentState,
    Evidence,
    FeedPost,
    TimelineEvent,
    LogLine,
    SimulationConfig,
    InterventionRecord,
    SimulationSnapshot,
    SimulationState,
    EventType,
    LogLevel,
)

from algorithms import (
    compute_agent_layout,
    get_emotion_from_content,
    simulate_mood_change,
    EmotionScore,
)

from websocket import manager as ws_manager


# ============= Configuration =============

class Settings(BaseSettings):
    """Application settings."""
    app_name: str = "OASIS Frontend Backend"
    version: str = "0.1.0"
    debug: bool = True
    cors_origins: List[str] = ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "http://localhost:3000"]
    use_oasis: bool = True  # Enable OASIS simulation

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

# Import OASIS integration
from oasis_integration import (
    initialize_oasis_simulation,
    run_simulation_step,
    get_simulation_posts,
    get_simulation_agents,
    get_simulation_agent_state,
    close_simulation,
    OASIS_AVAILABLE,
)

# Path to personas file (relative to backend directory)
PERSONAS_PATH = "twitter_personas_20260123_222506.json"


# ============= Lifecycle Management =============

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Startup
    print(f"Starting {settings.app_name} v{settings.version}")
    init_db()
    print("Database initialized")

    # Initialize OASIS if available
    oasis_initialized = False
    if settings.use_oasis and OASIS_AVAILABLE:
        print("Initializing OASIS simulation...")
        oasis_initialized = await initialize_oasis_simulation(PERSONAS_PATH)
        if oasis_initialized:
            print("OASIS simulation initialized successfully")
        else:
            print("OASIS initialization failed, using fallback ticker")
    else:
        print("OASIS not available, using fallback ticker")

    # Auto-start simulation: set is_running to True on startup
    global _sim_state
    _sim_state = get_simulation_state()
    _sim_state.is_running = True
    save_simulation_state(_sim_state)
    print(f"Simulation auto-started: tick={_sim_state.tick}, is_running={_sim_state.is_running}")

    # Start simulation ticker (uses OASIS or fallback)
    ticker_task = asyncio.create_task(simulation_ticker())

    yield

    # Shutdown
    ticker_task.cancel()
    if oasis_initialized:
        await close_simulation()
    print(f"Shutting down {settings.app_name}")


app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============= Request/Response Models =============

class AgentResponse(BaseModel):
    """Agent response model."""
    id: int
    name: str
    group: str
    identity: dict
    psychometrics: dict
    social_status: dict
    behavior_profile: dict
    cognitive_state: dict


class AgentStateResponse(BaseModel):
    """Agent state response model."""
    mood: float
    stance: float
    resources: float
    lastAction: str
    evidence: Optional[dict] = None


class FeedPostResponse(BaseModel):
    """Feed post response model."""
    id: str
    tick: int
    authorId: int
    authorName: str
    emotion: float
    content: str
    likes: int


class TimelineEventResponse(BaseModel):
    """Timeline event response model."""
    id: str
    tick: int
    type: str
    agentId: Optional[int]
    title: str
    payload: Optional[dict]


class LogLineResponse(BaseModel):
    """Log line response model."""
    id: str
    tick: int
    agentId: Optional[int]
    level: str
    text: str


class SimulationStateResponse(BaseModel):
    """Simulation state response model."""
    config: dict
    tick: int
    isRunning: bool
    speed: float
    selectedAgentId: Optional[int]
    agents: dict
    groups: dict
    logs: List[dict]
    events: List[dict]
    feed: List[dict]
    interventions: List[dict]
    snapshots: List[dict]
    currentSnapshotId: Optional[str]


class InterventionRequest(BaseModel):
    """Intervention request model."""
    tick: int
    command: str
    targetAgentId: Optional[int] = None


class SnapshotRequest(BaseModel):
    """Snapshot request model."""
    name: str


class BookmarkRequest(BaseModel):
    """Bookmark request model."""
    tick: int
    note: str = ""


class SimulationControlRequest(BaseModel):
    """Simulation control request model."""
    action: str  # start, stop, pause, resume
    speed: Optional[float] = None
    tick: Optional[int] = None


# ============= Simulation Ticker =============

# Global simulation state
_sim_state: SimulationState = SimulationState()
_ticker_running = False
_ticker_lock = asyncio.Lock()


def _get_action_description(action_type: str, action_args: dict) -> str:
    """Convert OASIS action type to readable description."""
    if "CREATE_POST" in action_type:
        content = action_args.get("content", "")
        if content:
            return f"posted: {content[:50]}..."
        return "posted"
    elif "REFRESH" in action_type:
        return "refreshed recommendation feed"
    elif "DO_NOTHING" in action_type:
        return "observing"
    elif "LIKE" in action_type:
        return "liked a post"
    elif "SHARE" in action_type:
        return "shared a post"
    elif "COMMENT" in action_type:
        return "commented on a post"
    else:
        return f"action: {action_type}"


def _normalize_agent_id_list(state: SimulationState) -> list[int]:
    """Return agent ids as integers, regardless of key type."""
    ids: list[int] = []
    for raw_key in state.agents.keys():
        try:
            ids.append(int(raw_key))
        except (TypeError, ValueError):
            continue
    return ids


def _get_agent_state_ref(state: SimulationState, agent_id: int) -> Optional[dict[str, Any]]:
    """Get mutable agent state dict by id, supporting int/str keys."""
    if agent_id in state.agents:
        agent = state.agents[agent_id]
    elif str(agent_id) in state.agents:
        agent = state.agents[str(agent_id)]
    else:
        return None
    return agent.get("state")


def _get_agent_group(state: SimulationState, agent_id: int) -> str:
    """Get agent group name if available."""
    agent = state.agents.get(agent_id) or state.agents.get(str(agent_id)) or {}
    profile = agent.get("profile", {})
    return str(profile.get("group", ""))


def _agent_ids_by_group(state: SimulationState, group_name: str) -> list[int]:
    """Find agent ids by exact group name (case-insensitive)."""
    target = group_name.strip().lower()
    matched: list[int] = []
    for agent_id in _normalize_agent_id_list(state):
        if _get_agent_group(state, agent_id).strip().lower() == target:
            matched.append(agent_id)
    return matched


def _parse_assignments(raw: str) -> dict[str, float]:
    """Parse assignment fragments like: mood=0.6 stance=-0.2 resources=120."""
    assignments: dict[str, float] = {}
    for key, value in re.findall(r"(mood|stance|resources)\s*=\s*([+-]?\d+(?:\.\d+)?)", raw, flags=re.IGNORECASE):
        key_norm = key.lower()
        num = float(value)
        if key_norm in {"mood", "stance"}:
            num = max(-1.0, min(1.0, num))
        elif key_norm == "resources":
            num = max(0.0, min(10_000.0, num))
        assignments[key_norm] = num
    return assignments


def _apply_agent_patch(state: SimulationState, agent_id: int, patch: dict[str, float]) -> bool:
    """Apply parsed numeric patch to an agent state."""
    agent_state = _get_agent_state_ref(state, agent_id)
    if not agent_state:
        return False

    if "mood" in patch:
        agent_state["mood"] = patch["mood"]
    if "stance" in patch:
        agent_state["stance"] = patch["stance"]
    if "resources" in patch:
        agent_state["resources"] = patch["resources"]
    agent_state["lastAction"] = "intervened"
    return True


def _execute_intervention(state: SimulationState, command: str, target_agent_id: Optional[int]) -> dict[str, Any]:
    """
    Execute a supported intervention command and mutate simulation state in-place.
    Returns a structured execution summary for API response/event payload.
    """
    original = command.strip()
    normalized = original

    # Frontend group mode prefixes commands as: [Group A, Group B] actual command
    if normalized.startswith("[") and "]" in normalized:
        normalized = normalized.split("]", 1)[1].strip()

    lower = normalized.lower()
    affected_agents: list[int] = []
    effects: list[str] = []
    state_changed = False

    if lower in {"pause", "stop"}:
        state.is_running = False
        effects.append("simulation_paused")
        state_changed = True
    elif lower in {"resume", "run", "start"}:
        state.is_running = True
        effects.append("simulation_resumed")
        state_changed = True
    else:
        speed_match = re.search(r"(?:set\s+)?speed\s*=?\s*([+-]?\d+(?:\.\d+)?)", lower)
        if speed_match:
            speed = float(speed_match.group(1))
            state.speed = max(0.1, min(10.0, speed))
            effects.append(f"speed_set:{state.speed}")
            state_changed = True

    set_agent_match = re.match(r"set\s+agent\s+(\d+)\s+(.+)", normalized, flags=re.IGNORECASE)
    if set_agent_match:
        agent_id = int(set_agent_match.group(1))
        patch = _parse_assignments(set_agent_match.group(2))
        if patch and _apply_agent_patch(state, agent_id, patch):
            affected_agents.append(agent_id)
            effects.append("agent_state_set")
            state_changed = True

    # If targetAgentId is provided, allow direct key-value command fragments.
    if target_agent_id is not None and not set_agent_match:
        patch = _parse_assignments(normalized)
        if patch and _apply_agent_patch(state, target_agent_id, patch):
            affected_agents.append(target_agent_id)
            effects.append("target_agent_state_set")
            state_changed = True

    group_shift_match = re.search(
        r"shift\s+group\s+(.+?)\s+mood\s*=\s*([+-]?\d+(?:\.\d+)?)",
        normalized,
        flags=re.IGNORECASE,
    )
    if group_shift_match:
        group_name = group_shift_match.group(1).strip()
        delta = float(group_shift_match.group(2))
        target_ids = _agent_ids_by_group(state, group_name)
        for agent_id in target_ids:
            agent_state = _get_agent_state_ref(state, agent_id)
            if not agent_state:
                continue
            current = float(agent_state.get("mood", 0.0))
            agent_state["mood"] = max(-1.0, min(1.0, current + delta))
            agent_state["lastAction"] = "intervened_group_shift"
            affected_agents.append(agent_id)
        if target_ids:
            effects.append(f"group_mood_shift:{group_name}")
            state_changed = True

    if lower.startswith("inject event"):
        effects.append("event_injected")
    if lower.startswith("survey"):
        effects.append("survey_triggered")
    if lower.startswith("broadcast"):
        effects.append("broadcast_sent")

    status = "applied" if state_changed or effects else "recorded_only"
    if not effects:
        effects.append("command_recorded")

    return {
        "status": status,
        "normalizedCommand": normalized,
        "effects": effects,
        "affectedAgentIds": sorted(set(affected_agents)),
    }


async def simulation_ticker():
    """Background task that advances the simulation tick."""
    global _ticker_running, _sim_state

    # Initialize state
    _sim_state = get_simulation_state()

    # Initialize agents dict if empty
    if not _sim_state.agents:
        all_agents = get_all_agents()
        for agent in all_agents:
            _sim_state.agents[agent.id] = {
                "profile": agent.to_dict(),
                "state": {
                    "mood": 0.0,
                    "stance": 0.0,
                    "resources": 100.0,
                    "lastAction": "idle",
                }
            }
        save_simulation_state(_sim_state)
        print(f"[Ticker] Initialized {len(_sim_state.agents)} agents")

    # Initialize groups dict if empty
    if not _sim_state.groups:
        all_groups = get_all_group_profiles()
        _sim_state.groups = {g.key: g.to_dict() for g in all_groups}
        save_simulation_state(_sim_state)
        print(f"[Ticker] Initialized {len(_sim_state.groups)} groups")

    while True:
        try:
            # Check if OASIS is available
            use_oasis = settings.use_oasis and OASIS_AVAILABLE

            if _sim_state.is_running:
                async with _ticker_lock:
                    if use_oasis:
                        # Use OASIS simulation
                        result = await run_simulation_step()
                        _sim_state.tick = result.get("tick", _sim_state.tick)

                        # Log activity
                        if "actions" in result:
                            actions = result.get('actions', 0)
                            active_agents = result.get('active_agents', 0)
                            behaviors = result.get('behaviors', [])  # Get detailed behaviors
                            print(f"[OASIS] Tick {_sim_state.tick}: {actions} actions, {active_agents} active agents")

                            # Create log entry for tick summary (will appear in Events)
                            import uuid
                            from models import save_timeline_event, TimelineEvent, EventType, save_feed_post, FeedPost
                            tick_summary_event = TimelineEvent(
                                id=str(uuid.uuid4()),
                                tick=_sim_state.tick,
                                type=EventType.INTERVENTION,  # Use INTERVENTION for system events
                                title=f"[OASIS] Tick {_sim_state.tick}: {actions} actions, {active_agents} active agents",
                                agent_id=None,
                                payload={"actions": actions, "active_agents": active_agents}
                            )
                            save_timeline_event(tick_summary_event)
                            await ws_manager.emit_event_created(tick_summary_event.to_dict())

                            # Sync OASIS behaviors to feed as activity logs
                            for behavior in behaviors:
                                agent_name = behavior.get("agent_name", "Unknown")
                                action_type = behavior.get("action_type", "unknown")
                                action_args = behavior.get("action_args", {})
                                agent_id = int(behavior.get("agent_id", 0))

                                # Convert action type to readable description
                                action_desc = _get_action_description(action_type, action_args)

                                # Create feed post as behavior log
                                behavior_post = FeedPost(
                                    id=str(uuid.uuid4()),
                                    tick=_sim_state.tick,
                                    author_id=agent_id,
                                    author_name=agent_name,
                                    emotion=0.0,
                                    content=f"[Behavior] {action_desc}",
                                    likes=0,
                                )
                                persisted_id = save_feed_post(behavior_post)
                                behavior_post.id = persisted_id
                                await ws_manager.emit_post_created(behavior_post.to_dict())

                                behavior_log = LogLine(
                                    id=str(uuid.uuid4()),
                                    tick=_sim_state.tick,
                                    level=LogLevel.INFO,
                                    text=f"[Ticker] {agent_name}: {action_desc}",
                                    agent_id=agent_id if agent_id > 0 else None,
                                )
                                save_log_line(behavior_log)
                                await ws_manager.emit_log_added(behavior_log.to_dict())
                                print(f"[Ticker] {agent_name}: {action_desc}")
                            # Also sync actual posts to feed database
                            try:
                                new_posts = await get_simulation_posts(limit=20)
                                print(f"[Ticker] Fetched {len(new_posts)} posts from OASIS")
                                from models import save_oasis_feed_post

                                for post_data in new_posts:
                                    # Create FeedPost from OASIS post data
                                    feed_post = FeedPost(
                                        id=f"oasis_{post_data['id']}",  # Use prefixed ID for reference
                                        tick=_sim_state.tick,
                                        author_id=post_data["authorId"],
                                        author_name=post_data.get("authorName", f"Agent_{post_data['authorId']}"),
                                        emotion=post_data.get("emotion", 0.0),
                                        content=post_data.get("content", ""),
                                        likes=post_data.get("likes", 0),
                                    )
                                    # save_oasis_feed_post handles ID mapping internally
                                    saved = save_oasis_feed_post(int(post_data["id"]), feed_post)
                                    if saved:
                                        await ws_manager.emit_post_created(feed_post.to_dict())
                                        sync_log = LogLine(
                                            id=str(uuid.uuid4()),
                                            tick=_sim_state.tick,
                                            level=LogLevel.INFO,
                                            text=f"[Ticker] Synced OASIS post {post_data['id']} to feed",
                                            agent_id=feed_post.author_id,
                                        )
                                        save_log_line(sync_log)
                                        await ws_manager.emit_log_added(sync_log.to_dict())
                                        print(f"[Ticker] Synced OASIS post {post_data['id']} to feed")
                                    else:
                                        skip_log = LogLine(
                                            id=str(uuid.uuid4()),
                                            tick=_sim_state.tick,
                                            level=LogLevel.INFO,
                                            text=f"[Ticker] OASIS post {post_data['id']} already synced, skipping",
                                            agent_id=feed_post.author_id,
                                        )
                                        save_log_line(skip_log)
                                        await ws_manager.emit_log_added(skip_log.to_dict())
                                        print(f"[Ticker] OASIS post {post_data['id']} already synced, skipping")
                            except Exception as e:
                                sync_err_log = LogLine(
                                    id=str(uuid.uuid4()),
                                    tick=_sim_state.tick,
                                    level=LogLevel.ERROR,
                                    text=f"[Ticker] Failed to sync OASIS posts: {e}",
                                    agent_id=None,
                                )
                                save_log_line(sync_err_log)
                                await ws_manager.emit_log_added(sync_err_log.to_dict())
                                print(f"[Ticker] Failed to sync OASIS posts: {e}")
                                import traceback
                                traceback.print_exc()
                    else:
                        # Fallback: simple ticker
                        _sim_state.tick += 1

                        # Update some agents (simulate behavior)
                        import random
                        agents_list = list(_sim_state.agents.keys())
                        num_to_update = max(5, len(agents_list) // 10)

                        # Randomly create posts (about 10% chance per tick when agents are active)
                        if agents_list and random.random() < 0.3:
                            agent_id = random.choice(agents_list)
                            agent = _sim_state.agents[agent_id]
                            agent_profile = agent.get("profile", {})
                            agent_state = agent.get("state", {})

                            # Generate post content based on agent mood
                            mood = agent_state.get("mood", 0)
                            last_action = agent_state.get("lastAction", "idle")

                            # Post templates based on mood
                            if mood > 0.5:
                                templates = [
                                    "Great things are happening today! #positive",
                                    "Feeling optimistic! Looking forward to what's coming.",
                                    "Making progress on my goals. Every step counts!",
                                ]
                            elif mood < -0.5:
                                templates = [
                                    "This is frustrating. Why can't things be better?",
                                    "Disappointed with the current situation.",
                                    "Need to speak up about what matters.",
                                ]
                            else:
                                templates = [
                                    "Just observing the conversation.",
                                    "Taking time to process everything.",
                                    "Thinking about the next steps.",
                                ]

                            # Add domain-specific posts if agent has expertise
                            expertise = agent_profile.get("identity", {}).get("domain_of_expertise", [])
                            if expertise and random.random() < 0.3:
                                templates.append(f"Thoughts on {expertise[0]} today...")

                            content = random.choice(templates)

                            # Calculate emotion from mood
                            emotion = max(-1.0, min(1.0, mood))

                            # Save post to database
                            try:
                                from models import save_feed_post, FeedPost
                                import uuid
                                post = FeedPost(
                                    id=str(uuid.uuid4()),
                                    tick=_sim_state.tick,  # Use simulation tick
                                    author_id=agent_id,
                                    author_name=agent_profile.get("identity", {}).get("username", f"Agent_{agent_id}"),
                                    emotion=emotion,
                                    content=content,
                                    likes=0,
                                )
                                persisted_id = save_feed_post(post)
                                post.id = persisted_id

                                # Update agent's last action
                                _sim_state.agents[agent_id]["state"]["lastAction"] = "post"
                                print(f"[Ticker] New post by Agent_{agent_id}: {content[:40]}...")

                            except Exception as e:
                                print(f"[Ticker] Failed to save post: {e}")

                        # Update agent states
                        for _ in range(num_to_update):
                            if not agents_list:
                                break
                            agent_id = random.choice(agents_list)
                            if agent_id in _sim_state.agents:
                                # Simulate mood change
                                current_mood = _sim_state.agents[agent_id]["state"]["mood"]
                                stimulus = random.uniform(-0.3, 0.3)

                                # Get agent profile from database to get personality
                                try:
                                    from models import get_agent_by_id
                                    agent = get_agent_by_id(agent_id)
                                    openness = agent.psychometrics.big_five.O
                                    neuroticism = agent.psychometrics.big_five.N
                                except:
                                    openness =  0.5
                                    neuroticism = 0.5

                                new_mood = simulate_mood_change(
                                    current_mood,
                                    stimulus,
                                    openness=openness,
                                    neuroticism=neuroticism,
                                )
                                _sim_state.agents[agent_id]["state"]["mood"] = new_mood
                                _sim_state.agents[agent_id]["state"]["lastAction"] = (
                                    "celebrate" if new_mood > 0.3 else "complain" if new_mood < -0.3 else "observe"
                                )

                    # Save state
                    save_simulation_state(_sim_state)

                    # Emit tick update
                    await ws_manager.emit_tick_update(_sim_state.tick, _sim_state.is_running, _sim_state.speed)

            await asyncio.sleep(1.0 / (_sim_state.config.ticks_per_second * _sim_state.speed))

        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"Error in simulation ticker: {e}")
            import traceback
            traceback.print_exc()
            await asyncio.sleep(1.0)


# ============= API Routes =============

@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": settings.app_name,
        "version": settings.version,
        "status": "running",
    }


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy"}


# ============= Agent Endpoints =============

@app.get("/api/agents", response_model=List[AgentResponse])
async def get_agents(
    ids: Optional[str] = Query(None, description="Comma-separated list of agent IDs"),
    limit: Optional[int] = Query(None, description="Maximum number of agents to return"),
    offset: int = Query(0, description="Number of agents to skip"),
):
    """
    Get all agents or a subset by IDs.

    Query parameters:
    - ids: Comma-separated list of agent IDs (e.g., "1,2,3")
    - limit: Maximum number of agents to return
    - offset: Number of agents to skip (for pagination)
    """
    if ids:
        agent_ids = [int(id.strip()) for id in ids.split(",") if id.strip().isdigit()]
        agents = get_agents_by_ids(agent_ids)
    else:
        agents = get_all_agents()

    # Apply pagination
    if offset:
        agents = agents[offset:]
    if limit:
        agents = agents[:limit]

    return [
        AgentResponse(
            id=agent.id,
            name=agent.name,
            group=agent.group,
            identity=agent.identity.to_dict(),
            psychometrics=agent.psychometrics.to_dict(),
            social_status=agent.social_status.to_dict(),
            behavior_profile=agent.behavior_profile.to_dict(),
            cognitive_state=agent.cognitive_state.to_dict(),
        )
        for agent in agents
    ]


@app.get("/api/agents/{agent_id}", response_model=AgentResponse)
async def get_agent(agent_id: int):
    """Get a single agent by ID."""
    agent = get_agent_by_id(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agent {agent_id} not found")

    return AgentResponse(
        id=agent.id,
        name=agent.name,
        group=agent.group,
        identity=agent.identity.to_dict(),
        psychometrics=agent.psychometrics.to_dict(),
        social_status=agent.social_status.to_dict(),
        behavior_profile=agent.behavior_profile.to_dict(),
        cognitive_state=agent.cognitive_state.to_dict(),
    )


@app.get("/api/agents/{agent_id}/state")
async def get_agent_state(agent_id: int):
    """Get the current state of an agent including evidence."""
    def _safe_num(value: Any, default: float) -> float:
        try:
            num = float(value)
            return num if math.isfinite(num) else default
        except Exception:
            return default

    def _fallback_state() -> dict[str, Any]:
        state = _sim_state
        agent_data = state.agents.get(agent_id) or state.agents.get(str(agent_id))
        if not agent_data:
            raise HTTPException(status_code=404, detail=f"Agent {agent_id} state not found")

        agent_state = agent_data.get("state", {})
        return {
            "mood": _safe_num(agent_state.get("mood", 0.0), 0.0),
            "stance": _safe_num(agent_state.get("stance", 0.0), 0.0),
            "resources": _safe_num(agent_state.get("resources", 0.5), 0.5),
            "lastAction": str(agent_state.get("lastAction", "")),
            "evidence": {
                "memoryHits": [],
                "reasoningSummary": "fallback state (OASIS unavailable or invalid)",
                "toolCalls": [],
            },
        }

    # Try to get state from OASIS first if available
    try:
        if settings.use_oasis and OASIS_AVAILABLE:
            oasis_state = await get_simulation_agent_state(agent_id)
            if oasis_state and "evidence" in oasis_state:
                # Merge with in-memory state for stable values.
                state = _sim_state
                agent_data = state.agents.get(agent_id) or state.agents.get(str(agent_id))
                if agent_data:
                    agent_state = agent_data.get("state", {})
                    oasis_state["mood"] = _safe_num(agent_state.get("mood", oasis_state.get("mood", 0.0)), 0.0)
                    oasis_state["stance"] = _safe_num(agent_state.get("stance", oasis_state.get("stance", 0.0)), 0.0)
                    oasis_state["resources"] = _safe_num(agent_state.get("resources", oasis_state.get("resources", 0.5)), 0.5)
                    oasis_state["lastAction"] = str(agent_state.get("lastAction", oasis_state.get("lastAction", "")))
                else:
                    oasis_state["mood"] = _safe_num(oasis_state.get("mood", 0.0), 0.0)
                    oasis_state["stance"] = _safe_num(oasis_state.get("stance", 0.0), 0.0)
                    oasis_state["resources"] = _safe_num(oasis_state.get("resources", 0.5), 0.5)
                    oasis_state["lastAction"] = str(oasis_state.get("lastAction", ""))

                # Ensure evidence shape is always JSON-safe.
                evidence = oasis_state.get("evidence") or {}
                oasis_state["evidence"] = {
                    "memoryHits": evidence.get("memoryHits", []),
                    "reasoningSummary": str(evidence.get("reasoningSummary", "")),
                    "toolCalls": evidence.get("toolCalls", []),
                }
                return oasis_state
    except Exception as e:
        print(f"[AgentState] OASIS state fetch failed for agent {agent_id}: {e}")

    # Fall back to in-memory state if OASIS path fails or unavailable.
    return _fallback_state()


@app.patch("/api/agents/{agent_id}/state")
async def patch_agent_state(
    agent_id: int,
    mood: Optional[float] = Body(None),
    stance: Optional[float] = Body(None),
    resources: Optional[float] = Body(None),
    lastAction: Optional[str] = Body(None),
):
    """Update an agent's state."""
    state = get_simulation_state()

    if agent_id not in state.agents:
        raise HTTPException(status_code=404, detail=f"Agent {agent_id} state not found")

    if mood is not None:
        state.agents[agent_id]["state"]["mood"] = mood
    if stance is not None:
        state.agents[agent_id]["state"]["stance"] = stance
    if resources is not None:
        state.agents[agent_id]["state"]["resources"] = resources
    if lastAction is not None:
        state.agents[agent_id]["state"]["lastAction"] = lastAction

    save_simulation_state(state)

    # Emit update
    await ws_manager.emit_agent_update(agent_id, state.agents[agent_id]["state"])

    return {"status": "ok"}


# ============= Groups Endpoints =============

@app.get("/api/groups")
async def get_groups():
    """Get all group profiles."""
    groups = get_all_group_profiles()
    return {
        "groups": [group.to_dict() for group in groups],
    }


# ============= Feed Endpoints =============

@app.get("/api/feed", response_model=List[FeedPostResponse])
async def get_feed(
    limit: int = Query(50, description="Maximum number of posts to return"),
    offset: int = Query(0, description="Number of posts to skip"),
    sort: str = Query("time", description="Sort order: time, emotion, likes"),
):
    """
    Get feed posts.

    Query parameters:
    - limit: Maximum number of posts to return
    - offset: Number of posts to skip
    - sort: Sort order (time, emotion, likes)
    """
    posts = get_feed_posts(limit=limit * 2, offset=offset)  # Get more for sorting

    if sort == "emotion":
        posts.sort(key=lambda p: abs(p.emotion), reverse=True)
    elif sort == "likes":
        posts.sort(key=lambda p: p.likes, reverse=True)
    # else: time (default, already sorted by created_at DESC)

    posts = posts[:limit]

    return [
        FeedPostResponse(
            id=post.id,
            tick=post.tick,
            authorId=post.author_id,
            authorName=post.author_name,
            emotion=post.emotion,
            content=post.content,
            likes=post.likes,
        )
        for post in posts
    ]


@app.post("/api/feed")
async def create_post(
    agent_id: int = Body(..., embed=True),
    content: str = Body(..., embed=True),
    emotion: Optional[float] = Body(None, embed=True),
):
    """Create a new post."""
    from models import get_agent_by_id
    agent = get_agent_by_id(agent_id)
    author_name = agent.name if agent else f"Agent_{agent_id}"

    # Calculate emotion if not provided
    if emotion is None:
        emotion = get_emotion_from_content(content, fallback=0.0)

    state = get_simulation_state()

    post = FeedPost(
        id=str(uuid.uuid4()),
        tick=state.tick,
        author_id=agent_id,
        author_name=author_name,
        emotion=emotion,
        content=content,
        likes=0,
    )

    persisted_id = save_feed_post(post)
    post.id = persisted_id

    # Emit post creation
    await ws_manager.emit_post_created(post.to_dict())

    return FeedPostResponse(**post.to_dict())


# ============= State Endpoints =============

@app.get("/api/state", response_model=SimulationStateResponse)
async def get_state():
    """Get the current simulation state."""
    # Use global in-memory state for real-time updates
    state = _sim_state

    # Ensure groups are populated
    if not state.groups:
        groups = get_all_group_profiles()
        state.groups = {g.key: g.to_dict() for g in groups}

    intervention_records = get_all_interventions()[:120]

    return SimulationStateResponse(
        config=state.config.to_dict(),
        tick=state.tick,
        isRunning=state.is_running,
        speed=state.speed,
        selectedAgentId=state.selected_agent_id,
        agents=state.agents,
        groups=state.groups,
        logs=[log.to_dict() for log in state.logs],
        events=[event.to_dict() for event in state.events],
        feed=[post.to_dict() for post in state.feed],
        interventions=[intervention.to_dict() for intervention in intervention_records],
        snapshots=[snapshot.to_dict() for snapshot in state.snapshots],
        currentSnapshotId=state.current_snapshot_id,
    )


@app.patch("/api/state")
async def patch_state(
    isRunning: Optional[bool] = Body(None),
    speed: Optional[float] = Body(None),
    tick: Optional[int] = Body(None),
    selectedAgentId: Optional[int] = Body(None),
):
    """Update simulation state."""
    state = get_simulation_state()

    if isRunning is not None:
        state.is_running = isRunning
    if speed is not None:
        state.speed = max(0.1, min(10.0, speed))
    if tick is not None:
        state.tick = max(0, tick)
    if selectedAgentId is not None:
        state.selected_agent_id = selectedAgentId

    save_simulation_state(state)

    # Emit state update
    await ws_manager.emit_tick_update(state.tick, state.is_running, state.speed)

    return {"status": "ok"}


# ============= Simulation Control Endpoints =============

@app.post("/api/simulation/start")
async def start_simulation(request: Optional[SimulationControlRequest] = None):
    """Start the simulation."""
    global _sim_state
    # Sync from database first
    _sim_state = get_simulation_state()
    _sim_state.is_running = True

    if request and request.speed:
        _sim_state.speed = max(0.1, min(10.0, request.speed))

    save_simulation_state(_sim_state)

    await ws_manager.emit_tick_update(_sim_state.tick, _sim_state.is_running, _sim_state.speed)

    return {"status": "started", "tick": _sim_state.tick}


@app.post("/api/simulation/stop")
async def stop_simulation():
    """Stop the simulation."""
    global _sim_state
    _sim_state = get_simulation_state()
    _sim_state.is_running = False
    save_simulation_state(_sim_state)

    await ws_manager.emit_tick_update(_sim_state.tick, _sim_state.is_running, _sim_state.speed)

    return {"status": "stopped", "tick": _sim_state.tick}


@app.post("/api/simulation/pause")
async def pause_simulation():
    """Pause the simulation."""
    global _sim_state
    _sim_state = get_simulation_state()
    _sim_state.is_running = False
    save_simulation_state(_sim_state)

    await ws_manager.emit_tick_update(_sim_state.tick, _sim_state.is_running, _sim_state.speed)

    return {"status": "paused", "tick": _sim_state.tick}


@app.post("/api/simulation/resume")
async def resume_simulation():
    """Resume the simulation."""
    global _sim_state
    _sim_state = get_simulation_state()
    _sim_state.is_running = True
    save_simulation_state(_sim_state)

    await ws_manager.emit_tick_update(_sim_state.tick, _sim_state.is_running, _sim_state.speed)

    return {"status": "resumed", "tick": _sim_state.tick}


@app.put("/api/simulation/speed")
async def set_simulation_speed(speed: float = Body(..., embed=True)):
    """Set the simulation speed."""
    global _sim_state
    _sim_state = get_simulation_state()
    _sim_state.speed = max(0.1, min(10.0, speed))
    save_simulation_state(_sim_state)

    await ws_manager.emit_tick_update(_sim_state.tick, _sim_state.is_running, _sim_state.speed)

    return {"status": "ok", "speed": _sim_state.speed}


@app.post("/api/simulation/tick")
async def set_simulation_tick(tick: int = Body(..., embed=True)):
    """Set the current tick."""
    global _sim_state
    _sim_state = get_simulation_state()
    _sim_state.tick = max(0, tick)
    save_simulation_state(_sim_state)

    await ws_manager.emit_tick_update(_sim_state.tick, _sim_state.is_running, _sim_state.speed)

    return {"status": "ok", "tick": _sim_state.tick}


# ============= Events Endpoints =============

@app.get("/api/events", response_model=List[TimelineEventResponse])
async def get_events(
    limit: int = Query(100, description="Maximum number of events to return"),
    offset: int = Query(0, description="Number of events to skip"),
):
    """Get timeline events."""
    events = get_timeline_events(limit=limit, offset=offset)

    return [
        TimelineEventResponse(
            id=event.id,
            tick=event.tick,
            type=event.type.value,
            agentId=event.agent_id,
            title=event.title,
            payload=event.payload,
        )
        for event in events
    ]


@app.post("/api/events")
async def create_event(
    tick: int = Body(...),
    type: str = Body(...),
    title: str = Body(...),
    agentId: Optional[int] = Body(None),
    payload: Optional[dict] = Body(None),
):
    """Create a timeline event."""
    event = TimelineEvent(
        id=str(uuid.uuid4()),
        tick=tick,
        type=EventType(type),
        title=title,
        agent_id=agentId,
        payload=payload,
    )

    save_timeline_event(event)

    await ws_manager.emit_event_created(event.to_dict())

    return TimelineEventResponse(
        id=event.id,
        tick=event.tick,
        type=event.type.value,
        agentId=event.agent_id,
        title=event.title,
        payload=event.payload,
    )


# ============= Logs Endpoints =============

@app.get("/api/logs", response_model=List[LogLineResponse])
async def get_logs(
    limit: int = Query(100, description="Maximum number of logs to return"),
    offset: int = Query(0, description="Number of logs to skip"),
    level: Optional[str] = Query(None, description="Filter by log level"),
):
    """Get simulation logs."""
    logs = get_log_lines(limit=limit)
    # Apply offset by slicing (since get_log_lines doesn't support offset parameter)
    if offset > 0:
        logs = logs[offset:]

    if level:
        logs = [log for log in logs if log.level.value == level]

    return [
        LogLineResponse(
            id=log.id,
            tick=log.tick,
            agentId=log.agent_id,
            level=log.level.value,
            text=log.text,
        )
        for log in logs
    ]


@app.post("/api/logs")
async def create_log(
    tick: int = Body(...),
    level: str = Body(...),
    text: str = Body(...),
    agentId: Optional[int] = Body(None),
):
    """Create a log entry."""
    log = LogLine(
        id=str(uuid.uuid4()),
        tick=tick,
        level=LogLevel(level),
        text=text,
        agent_id=agentId,
    )

    save_log_line(log)

    await ws_manager.emit_log_added(log.to_dict())

    return LogLineResponse(
        id=log.id,
        tick=log.tick,
        agentId=log.agent_id,
        level=log.level.value,
        text=log.text,
    )


# ============= Snapshots Endpoints =============

@app.get("/api/snapshots")
async def get_snapshots():
    """Get all simulation snapshots."""
    snapshots = get_all_snapshots()

    return [
        {
            "id": snapshot.id,
            "name": snapshot.name,
            "experimentName": snapshot.experiment_name,
            "createdAt": snapshot.created_at,
            "runNumber": snapshot.run_number,
            "finalTick": snapshot.final_tick,
        }
        for snapshot in snapshots
    ]


@app.post("/api/snapshots")
async def create_snapshot(request: SnapshotRequest):
    """Create a simulation snapshot."""
    state = get_simulation_state()

    snapshot = create_snapshot(request.name, state)

    return {
        "id": snapshot.id,
        "name": snapshot.name,
        "experimentName": snapshot.experiment_name,
        "createdAt": snapshot.created_at,
        "runNumber": snapshot.run_number,
        "finalTick": snapshot.final_tick,
    }


@app.get("/api/snapshots/{snapshot_id}")
async def get_snapshot(snapshot_id: str):
    """Get a snapshot by ID."""
    snapshot = get_snapshot_by_id(snapshot_id)
    if not snapshot:
        raise HTTPException(status_code=404, detail=f"Snapshot {snapshot_id} not found")

    return {
        "id": snapshot.id,
        "name": snapshot.name,
        "experimentName": snapshot.experiment_name,
        "createdAt": snapshot.created_at,
        "runNumber": snapshot.run_number,
        "finalTick": snapshot.final_tick,
        "data": snapshot.data,
    }


@app.post("/api/snapshots/{snapshot_id}/load")
async def load_snapshot(snapshot_id: str):
    """Load a snapshot, restoring the simulation state."""
    snapshot = get_snapshot_by_id(snapshot_id)
    if not snapshot:
        raise HTTPException(status_code=404, detail=f"Snapshot {snapshot_id} not found")

    # Restore state
    state = SimulationState.from_dict(snapshot.data)
    save_simulation_state(state)

    # Emit state update
    await ws_manager.emit_simulation_state(state.to_dict())

    return {
        "status": "loaded",
        "snapshotId": snapshot_id,
        "tick": state.tick,
    }


@app.delete("/api/snapshots/{snapshot_id}")
async def delete_snapshot(snapshot_id: str):
    """Delete a snapshot."""
    # TODO: Implement delete in database.py
    return {"status": "deleted", "snapshotId": snapshot_id}


# ============= Bookmarks Endpoints =============

@app.get("/api/bookmarks")
async def get_bookmarks():
    """Get all bookmarks."""
    bookmarks = get_all_bookmarks()
    return bookmarks


@app.post("/api/bookmarks")
async def create_bookmark(request: BookmarkRequest):
    """Create a bookmark."""
    bookmark_id = save_bookmark(request.tick, request.note)

    # Also create a timeline event
    event = TimelineEvent(
        id=str(uuid.uuid4()),
        tick=request.tick,
        type=EventType.BOOKMARK,
        title=f"Bookmark: {request.note}" if request.note else "Bookmark",
    )
    save_timeline_event(event)

    return {
        "id": bookmark_id,
        "tick": request.tick,
        "note": request.note,
    }


@app.delete("/api/bookmarks/{bookmark_id}")
async def remove_bookmark(bookmark_id: str):
    """Delete a bookmark."""
    delete_bookmark(bookmark_id)
    return {"status": "deleted", "id": bookmark_id}


# ============= Intervention Endpoints =============

@app.get("/api/interventions")
async def list_interventions(
    limit: int = Query(100, description="Maximum number of intervention records to return"),
    offset: int = Query(0, description="Number of intervention records to skip"),
):
    """Get intervention history records."""
    records = get_all_interventions()
    if offset > 0:
        records = records[offset:]
    if limit >= 0:
        records = records[:limit]
    return [record.to_dict() for record in records]


@app.post("/api/intervention")
async def create_intervention(request: InterventionRequest):
    """Create an intervention record and apply command effects to simulation state."""
    global _sim_state
    _sim_state = get_simulation_state()

    execution = _execute_intervention(_sim_state, request.command, request.targetAgentId)

    # Keep a lightweight in-memory trail for quick state snapshots.
    _sim_state.interventions.append({
        "id": str(uuid.uuid4()),
        "tick": request.tick,
        "command": request.command,
        "targetAgentId": request.targetAgentId,
    })
    _sim_state.interventions = _sim_state.interventions[-500:]

    save_simulation_state(_sim_state)

    # Emit updates affected by this intervention.
    await ws_manager.emit_tick_update(_sim_state.tick, _sim_state.is_running, _sim_state.speed)
    for agent_id in execution["affectedAgentIds"]:
        agent_state = _get_agent_state_ref(_sim_state, agent_id)
        if agent_state:
            await ws_manager.emit_agent_update(agent_id, agent_state)

    intervention = InterventionRecord(
        id=str(uuid.uuid4()),
        tick=request.tick,
        command=request.command,
        target_agent_id=request.targetAgentId,
    )

    save_intervention(intervention)

    # Create timeline event
    event = TimelineEvent(
        id=str(uuid.uuid4()),
        tick=request.tick,
        type=EventType.INTERVENTION,
        title=f"Intervention: {request.command}",
        agent_id=request.targetAgentId,
        payload={"command": request.command, "execution": execution},
    )
    save_timeline_event(event)

    await ws_manager.emit_event_created(event.to_dict())

    return {
        "id": intervention.id,
        "tick": intervention.tick,
        "command": intervention.command,
        "targetAgentId": intervention.target_agent_id,
        "execution": execution,
    }


# ============= Visualization Endpoints =============

@app.get("/api/visualization/layout")
async def get_agent_layout(
    algorithm: str = Query("force_directed", description="Layout algorithm"),
):
    """
    Get 2D positions for all agents for visualization.

    Query parameters:
    - algorithm: Layout algorithm (force_directed, circular, grid)
    """
    from models import get_all_agents
    agents = get_all_agents()

    agent_ids = [agent.id for agent in agents]

    # TODO: Get actual follow relationships from database
    follow_edges = []

    positions = compute_agent_layout(
        agent_ids=agent_ids,
        follow_edges=follow_edges,
        width=1000.0,
        height=1000.0,
        algorithm=algorithm,
    )

    return {
        "positions": positions,
        "algorithm": algorithm,
    }


# ============= WebSocket Endpoint =============

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for real-time updates.

    Subscribe to events by sending messages like:
    {"type": "subscribe", "eventTypes": ["tick", "post"], "agentIds": [1, 2, 3]}
    {"type": "unsubscribe", "eventTypes": ["tick"]}

    Broadcast messages:
    {"type": "tick_update", "tick": 123, "isRunning": true, "speed": 1.0}
    {"type": "agent_update", "agentId": 1, "state": {...}}
    {"type": "post_created", "post": {...}}
    {"type": "event_created", "event": {...}}
    {"type": "log_added", "log": {...}}
    """
    client_id = await ws_manager.connect(websocket)

    try:
        while True:
            data = await websocket.receive_json()

            message_type = data.get("type")

            if message_type == "subscribe":
                event_types = data.get("eventTypes")
                agent_ids = data.get("agentIds")
                ws_manager.subscribe(client_id, event_types, agent_ids)

            elif message_type == "unsubscribe":
                event_types = data.get("eventTypes")
                agent_ids = data.get("agentIds")
                ws_manager.unsubscribe(client_id, event_types, agent_ids)

            elif message_type == "ping":
                await ws_manager.send_personal_message({
                    "type": "pong",
                    "timestamp": datetime.now().isoformat(),
                }, client_id)

    except WebSocketDisconnect:
        ws_manager.disconnect(client_id)
    except Exception as e:
        print(f"WebSocket error: {e}")
        ws_manager.disconnect(client_id)


# ============= Error Handlers =============

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """Handle HTTP exceptions."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail},
    )


@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    """Handle general exceptions."""
    if settings.debug:
        import traceback
        print(traceback.format_exc())

    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error"},
    )


# ============= Main Entry Point =============

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8765,
        reload=False,
        log_level="info",
    )

