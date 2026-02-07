"""
OASIS Simulation Integration Module

This module integrates the OASIS social simulation framework
with the FastAPI backend.
"""
import asyncio
import sys
import os
import uuid
import sqlite3
import time
from collections import deque
from pathlib import Path
from typing import Optional, Dict, Any, TYPE_CHECKING, List, Union
import json

# Add OASIS to path.
# Prefer bundled project-local path: SocSim-Lab/oasis-main
# Fallback to legacy sibling of project root for compatibility.
PROJECT_ROOT = Path(__file__).resolve().parent.parent
LOCAL_OASIS_PATH = PROJECT_ROOT / "oasis-main"
LEGACY_OASIS_PATH = PROJECT_ROOT.parent / "oasis-main"
OASIS_PATH = LOCAL_OASIS_PATH if LOCAL_OASIS_PATH.exists() else LEGACY_OASIS_PATH
sys.path.insert(0, str(OASIS_PATH))

def _resolve_project_path(raw_path: str) -> Path:
    """Resolve relative paths against project root for portable deployments."""
    path = Path(raw_path)
    if path.is_absolute():
        return path
    return (PROJECT_ROOT / path).resolve()

DEFAULT_RUNTIME_DB_PATH = _resolve_project_path(
    os.environ.get("OASIS_RUNTIME_DB_PATH", "data/oasis_simulation.db")
)
DEEPSEEK_DEFAULT_KEY = "sk-5c79877413f346ceb7d4fdbf6daed4e6"

# Type checking imports (not evaluated at runtime)
if TYPE_CHECKING:
    from oasis.environment.env import OasisEnv
    from oasis.social_agent.agent import SocialAgent
    from oasis.social_agent.agent_graph import AgentGraph
    from oasis.social_platform.config import UserInfo
    from oasis.environment.env_action import LLMAction, ManualAction
    from oasis.social_platform.typing import ActionType

# Runtime imports
try:
    import oasis
    from oasis.environment.env import OasisEnv
    from oasis.environment.env_action import LLMAction, ManualAction
    from oasis.social_agent.agent import SocialAgent
    from oasis.social_agent.agent_graph import AgentGraph
    from oasis.social_agent.agents_generator import generate_custom_agents
    from oasis.social_platform.platform import Platform
    from oasis.social_platform.typing import ActionType, DefaultPlatformType
    from oasis.social_platform.config import UserInfo
    from oasis.social_platform.database import create_db
    from camel.models import ModelFactory, StubModel
    from camel.types import ModelPlatformType, ModelType
    OASIS_AVAILABLE = True
    print("OASIS imported successfully")
except ImportError as e:
    print(f"OASIS not available: {e}")
    OASIS_AVAILABLE = False
    # Create dummy types for type hints when OASIS is not available
    OasisEnv = Any  # type: ignore
    SocialAgent = Any  # type: ignore
    AgentGraph = Any  # type: ignore
    UserInfo = Any  # type: ignore
    LLMAction = Any  # type: ignore
    ManualAction = Any  # type: ignore
    ActionType = Any  # type: ignore


class OasisSimulation:
    """OASIS Simulation wrapper for FastAPI integration."""

    def __init__(self, db_path: str = str(DEFAULT_RUNTIME_DB_PATH)):
        self.db_path = db_path
        self.env: Optional[OasisEnv] = None
        self.agent_graph: Optional[AgentGraph] = None
        self.is_running = False
        self.tick = 0
        self._lock = asyncio.Lock()
        self._platform_task = None
        self._runtime_config: dict[str, Any] = {
            "llm_enabled": True,
            "llm_provider": "deepseek",
            "llm_model": "deepseek-chat",
            "llm_base_url": "https://api.deepseek.com/v1",
            "llm_api_key": DEEPSEEK_DEFAULT_KEY,
            "llm_temperature": 0.7,
            "llm_max_tokens": 512,
            "llm_top_p": 1.0,
            "llm_active_agents": 3,
            "llm_timeout_ms": 30000,
            "llm_max_retries": 1,
            "llm_retry_backoff_ms": 300,
            "llm_max_actions_per_minute": 240,
            "llm_fallback_on_error": True,
        }
        self._model_backend: Any = StubModel(ModelType.STUB)
        self._personas_path: Optional[str] = None
        self._action_timestamps: deque[float] = deque()
        self._metrics: dict[str, Any] = {
            "ticks_total": 0,
            "ticks_success": 0,
            "ticks_failed": 0,
            "llm_timeouts": 0,
            "llm_errors": 0,
            "retries_total": 0,
            "fallback_ticks": 0,
            "actions_executed_total": 0,
            "last_tick_latency_ms": 0.0,
            "avg_tick_latency_ms": 0.0,
            "last_error": "",
            "action_counts": {},
        }

    def update_runtime_config(self, config: Dict[str, Any]) -> None:
        """Update simulation runtime config used by future ticks."""
        if not config:
            return
        normalized = {
            "llm_enabled": bool(config.get("llmEnabled", config.get("llm_enabled", self._runtime_config["llm_enabled"]))),
            "llm_provider": str(config.get("llmProvider", config.get("llm_provider", self._runtime_config["llm_provider"]))).lower(),
            "llm_model": str(config.get("llmModel", config.get("llm_model", self._runtime_config["llm_model"]))),
            "llm_base_url": str(config.get("llmBaseUrl", config.get("llm_base_url", self._runtime_config["llm_base_url"]))),
            "llm_api_key": str(config.get("llmApiKey", config.get("llm_api_key", self._runtime_config["llm_api_key"]))),
            "llm_temperature": float(config.get("llmTemperature", config.get("llm_temperature", self._runtime_config["llm_temperature"]))),
            "llm_max_tokens": int(config.get("llmMaxTokens", config.get("llm_max_tokens", self._runtime_config["llm_max_tokens"]))),
            "llm_top_p": float(config.get("llmTopP", config.get("llm_top_p", self._runtime_config["llm_top_p"]))),
            "llm_active_agents": int(config.get("llmActiveAgents", config.get("llm_active_agents", self._runtime_config["llm_active_agents"]))),
            "llm_timeout_ms": int(config.get("llmTimeoutMs", config.get("llm_timeout_ms", self._runtime_config["llm_timeout_ms"]))),
            "llm_max_retries": int(config.get("llmMaxRetries", config.get("llm_max_retries", self._runtime_config.get("llm_max_retries", 1)))),
            "llm_retry_backoff_ms": int(config.get("llmRetryBackoffMs", config.get("llm_retry_backoff_ms", self._runtime_config.get("llm_retry_backoff_ms", 300)))),
            "llm_max_actions_per_minute": int(config.get("llmMaxActionsPerMinute", config.get("llm_max_actions_per_minute", self._runtime_config.get("llm_max_actions_per_minute", 240)))),
            "llm_fallback_on_error": bool(config.get("llmFallbackOnError", config.get("llm_fallback_on_error", self._runtime_config.get("llm_fallback_on_error", True)))),
        }
        normalized["llm_active_agents"] = max(1, min(200, normalized["llm_active_agents"]))
        normalized["llm_max_tokens"] = max(64, min(4096, normalized["llm_max_tokens"]))
        normalized["llm_timeout_ms"] = max(1000, min(120000, normalized["llm_timeout_ms"]))
        normalized["llm_max_retries"] = max(0, min(5, normalized["llm_max_retries"]))
        normalized["llm_retry_backoff_ms"] = max(0, min(5000, normalized["llm_retry_backoff_ms"]))
        normalized["llm_max_actions_per_minute"] = max(1, min(5000, normalized["llm_max_actions_per_minute"]))
        self._runtime_config.update(normalized)

    def _resolve_model_type(self, model_name: str) -> Any:
        """Resolve camel ModelType enum where possible, fallback to raw name."""
        try:
            return ModelType(model_name)
        except Exception:
            normalized = model_name.upper().replace("-", "_").replace(".", "_")
            if hasattr(ModelType, normalized):
                return getattr(ModelType, normalized)
            return model_name

    def _build_model_backend(self) -> Any:
        """Build model backend based on runtime config, with safe fallback."""
        cfg = self._runtime_config
        use_llm = bool(cfg.get("llm_enabled"))
        provider = str(cfg.get("llm_provider", "stub")).lower()
        if not use_llm or provider == "stub":
            return StubModel(ModelType.STUB)

        model_name = str(cfg.get("llm_model", "gpt-4o-mini"))
        model_type = self._resolve_model_type(model_name)
        base_url = str(cfg.get("llm_base_url", "")).strip()
        api_key = str(cfg.get("llm_api_key", "")).strip()

        try:
            if provider in {"openai", "deepseek"}:
                if api_key:
                    os.environ["OPENAI_API_KEY"] = api_key
                    os.environ["DEEPSEEK_API_KEY"] = api_key
                elif provider == "deepseek":
                    os.environ["OPENAI_API_KEY"] = DEEPSEEK_DEFAULT_KEY
                    os.environ["DEEPSEEK_API_KEY"] = DEEPSEEK_DEFAULT_KEY
                if provider == "deepseek" and not base_url:
                    base_url = "https://api.deepseek.com/v1"
                kwargs: dict[str, Any] = {
                    "model_platform": ModelPlatformType.OPENAI,
                    "model_type": model_type,
                }
                if base_url:
                    kwargs["url"] = base_url
                return ModelFactory.create(**kwargs)

            if provider == "vllm":
                kwargs = {
                    "model_platform": ModelPlatformType.VLLM,
                    "model_type": model_name,
                }
                if base_url:
                    kwargs["url"] = base_url
                return ModelFactory.create(**kwargs)
        except Exception as e:
            print(f"[OASIS] LLM backend creation failed ({provider}/{model_name}): {e}")

        print("[OASIS] Falling back to StubModel")
        return StubModel(ModelType.STUB)

    async def initialize(self, personas_json_path: str, runtime_config: Optional[Dict[str, Any]] = None) -> bool:
        """Initialize OASIS simulation with personas data."""
        if not OASIS_AVAILABLE:
            print("OASIS not available, using mock simulation")
            return False

        try:
            self._personas_path = personas_json_path
            if runtime_config:
                self.update_runtime_config(runtime_config)
            self._model_backend = self._build_model_backend()

            # Ensure database directory exists
            db_dir = os.path.dirname(self.db_path)
            if db_dir:
                os.makedirs(db_dir, exist_ok=True)

            # Load personas from JSON
            with open(personas_json_path, 'r', encoding='utf-8') as f:
                personas_data = json.load(f)

            # Create agent graph
            self.agent_graph = AgentGraph()

            # Create agents from personas.
            # Note: Use sequential IDs (0, 1, 2, ...) because OASIS's get_agents()
            # has a bug where it uses igraph node.index for lookup but agent_mappings
            # is keyed by social_agent_id. This causes KeyError when IDs are non-sequential.
            count = 0
            for user_id, persona_data in personas_data.get("personas", {}).items():
                user_info = self._create_user_info_from_persona(user_id, persona_data)
                if user_info:
                    # Use sequential agent_id to avoid OASIS get_agents() bug
                    # The original user_id is stored in the UserInfo for reference
                    agent_id = count

                    # Create SocialAgent with configured model backend.
                    agent = SocialAgent(
                        agent_id=agent_id,
                        user_info=user_info,
                        agent_graph=self.agent_graph,
                        model=self._model_backend,
                        available_actions=ActionType.get_default_twitter_actions(),
                    )
                    self.agent_graph.add_agent(agent)
                    count += 1

            # Create OASIS environment
            self.env = OasisEnv(
                agent_graph=self.agent_graph,
                platform=DefaultPlatformType.TWITTER,
                database_path=self.db_path,
            )

            # Start the simulation
            await self.env.reset()

            provider = self._runtime_config.get("llm_provider", "stub")
            enabled = self._runtime_config.get("llm_enabled", False)
            print(f"OASIS simulation initialized with {count} agents (llm_enabled={enabled}, provider={provider})")
            return True

        except Exception as e:
            print(f"Failed to initialize OASIS: {e}")
            import traceback
            traceback.print_exc()
            return False

    def _create_user_info_from_persona(self, user_id: str, persona_data: Dict[str, Any]) -> Optional[UserInfo]:
        """Create OASIS UserInfo from persona data."""
        try:
            persona = persona_data.get("persona", {})
            identity = persona.get("identity", {})

            # Generate description from persona
            description = self._generate_description(persona)

            # UserInfo doesn't accept user_id parameter, only user_name, name, description, profile
            user_info = UserInfo(
                user_name=identity.get("username", f"User_{user_id}"),
                name=identity.get("username", f"User_{user_id}"),
                description=description,
                profile={
                    "bio": description,
                    "recsys_type": "twitter",
                    "is_controllable": False,
                }
            )
            return user_info

        except Exception as e:
            print(f"Failed to create UserInfo for {user_id}: {e}")
            return None

    def _generate_description(self, persona: Dict[str, Any]) -> str:
        """Generate a description from persona data."""
        identity = persona.get("identity", {})
        parts = []

        profession = identity.get("profession")
        if profession and profession != "unknown":
            parts.append(f"{profession}")

        expertise = identity.get("domain_of_expertise", [])
        if expertise and isinstance(expertise, list):
            parts.append(f"Expert in: {', '.join(expertise[:3])}")

        location = identity.get("location", {})
        if location.get("country") and location.get("country") != "unknown":
            parts.append(f"Based in {location['country']}")

        return ". ".join(parts) if parts else "Social media user interested in various topics."

    async def step(self) -> Dict[str, Any]:
        """Execute one simulation step."""
        if not self.env:
            return {"tick": self.tick, "actions": 0, "error": "Simulation not initialized"}

        async with self._lock:
            tick_started = time.perf_counter()
            self._metrics["ticks_total"] += 1
            failure_counted = False
            llm_call_logs: list[dict[str, Any]] = []
            try:
                import random
                agent_items = list(self.env.agent_graph.agent_mappings.items())
                total_agents = len(agent_items)
                if total_agents == 0:
                    return {"tick": self.tick, "actions": 0, "active_agents": 0, "total_agents": 0}

                configured_active = int(self._runtime_config.get("llm_active_agents", 3))
                llm_enabled = bool(self._runtime_config.get("llm_enabled"))
                num_active = max(1, min(total_agents, configured_active))
                num_active = self._apply_action_rate_limit(num_active)
                selected_agents = random.sample(agent_items, k=num_active)

                actions: Dict[Any, Any] = {}
                for agent_id, agent in selected_agents:
                    if llm_enabled:
                        actions[agent] = LLMAction()
                    else:
                        actions[agent] = ManualAction(
                            action_type=ActionType.REFRESH,
                            action_args={},
                        )

                if llm_enabled:
                    llm_call_logs.append({
                        "tick": self.tick + 1,
                        "level": "info",
                        "message": (
                            f"Dispatching {num_active} LLM actions "
                            f"(provider={self._runtime_config.get('llm_provider')}, "
                            f"model={self._runtime_config.get('llm_model')}, "
                            f"timeout_ms={self._runtime_config.get('llm_timeout_ms')})"
                        ),
                        "agentIds": [int(aid) for aid, _ in selected_agents],
                    })

                timeout_seconds = float(self._runtime_config.get("llm_timeout_ms", 30000)) / 1000.0
                max_retries = int(self._runtime_config.get("llm_max_retries", 1))
                retry_backoff = float(self._runtime_config.get("llm_retry_backoff_ms", 300)) / 1000.0
                fallback_on_error = bool(self._runtime_config.get("llm_fallback_on_error", True))
                execute_error: Optional[str] = None
                used_fallback = False

                for attempt in range(max_retries + 1):
                    try:
                        await asyncio.wait_for(self.env.step(actions), timeout=timeout_seconds)
                        execute_error = None
                        break
                    except asyncio.TimeoutError:
                        self._metrics["llm_timeouts"] += 1
                        self._metrics["retries_total"] += 1
                        execute_error = f"timeout after {timeout_seconds}s"
                        llm_call_logs.append({
                            "tick": self.tick + 1,
                            "level": "error",
                            "message": f"LLM timeout on attempt {attempt + 1}: {execute_error}",
                            "agentIds": [int(aid) for aid, _ in selected_agents],
                        })
                    except Exception as step_error:
                        self._metrics["llm_errors"] += 1
                        self._metrics["retries_total"] += 1
                        execute_error = str(step_error)
                        llm_call_logs.append({
                            "tick": self.tick + 1,
                            "level": "error",
                            "message": f"LLM execution error on attempt {attempt + 1}: {execute_error}",
                            "agentIds": [int(aid) for aid, _ in selected_agents],
                        })

                    if attempt < max_retries and retry_backoff > 0:
                        llm_call_logs.append({
                            "tick": self.tick + 1,
                            "level": "info",
                            "message": f"Retrying LLM actions after {int(retry_backoff * 1000)}ms backoff",
                            "agentIds": [int(aid) for aid, _ in selected_agents],
                        })
                        await asyncio.sleep(retry_backoff)

                if execute_error and fallback_on_error:
                    fallback_actions: Dict[Any, Any] = {}
                    for _, agent in selected_agents:
                        fallback_actions[agent] = ManualAction(
                            action_type=ActionType.REFRESH,
                            action_args={},
                        )
                    try:
                        await asyncio.wait_for(self.env.step(fallback_actions), timeout=timeout_seconds)
                        execute_error = None
                        used_fallback = True
                        self._metrics["fallback_ticks"] += 1
                        llm_call_logs.append({
                            "tick": self.tick + 1,
                            "level": "warning",
                            "message": "LLM failed; fallback REFRESH actions executed",
                            "agentIds": [int(aid) for aid, _ in selected_agents],
                        })
                    except Exception as fallback_error:
                        execute_error = f"{execute_error}; fallback_failed={fallback_error}"
                        llm_call_logs.append({
                            "tick": self.tick + 1,
                            "level": "error",
                            "message": f"Fallback action execution failed: {fallback_error}",
                            "agentIds": [int(aid) for aid, _ in selected_agents],
                        })

                if execute_error:
                    self._metrics["ticks_failed"] += 1
                    failure_counted = True
                    self._metrics["last_error"] = execute_error
                    raise RuntimeError(execute_error)

                self.tick += 1
                self._record_action_budget(num_active)
                detailed_behaviors = self._get_behaviors_for_tick(self.tick, fallback_agents=selected_agents)
                self._accumulate_action_counts(detailed_behaviors)
                self._metrics["ticks_success"] += 1
                self._metrics["actions_executed_total"] += len(detailed_behaviors)
                self._refresh_latency_metrics((time.perf_counter() - tick_started) * 1000.0)
                llm_call_logs.append({
                    "tick": self.tick,
                    "level": "ok",
                    "message": (
                        f"Tick {self.tick} completed: behaviors={len(detailed_behaviors)}, "
                        f"latency_ms={self._metrics.get('last_tick_latency_ms')}"
                    ),
                    "agentIds": [int(aid) for aid, _ in selected_agents],
                })

                return {
                    "tick": self.tick,
                    "actions": len(actions),
                    "active_agents": num_active,
                    "total_agents": total_agents,
                    "behaviors": detailed_behaviors,
                    "llm_enabled": llm_enabled,
                    "llm_provider": self._runtime_config.get("llm_provider", "stub"),
                    "llm_model": self._runtime_config.get("llm_model", ""),
                    "fallback_used": used_fallback,
                    "metrics": self.get_metrics(),
                    "llm_call_logs": llm_call_logs,
                }

            except Exception as e:
                print(f"Error in simulation step: {e}")
                import traceback
                traceback.print_exc()
                if not failure_counted:
                    self._metrics["ticks_failed"] += 1
                self._metrics["last_error"] = str(e)
                self._refresh_latency_metrics((time.perf_counter() - tick_started) * 1000.0)
                llm_call_logs.append({
                    "tick": self.tick + 1,
                    "level": "error",
                    "message": f"Tick failed: {e}",
                    "agentIds": [],
                })
                return {
                    "tick": self.tick,
                    "actions": 0,
                    "error": str(e),
                    "llm_call_logs": llm_call_logs,
                }

    def _apply_action_rate_limit(self, requested_active: int) -> int:
        """Rate-limit LLM actions based on max actions per rolling minute."""
        now = time.time()
        max_per_minute = int(self._runtime_config.get("llm_max_actions_per_minute", 240))
        while self._action_timestamps and now - self._action_timestamps[0] > 60:
            self._action_timestamps.popleft()
        available = max(0, max_per_minute - len(self._action_timestamps))
        return max(1, min(requested_active, available if available > 0 else 1))

    def _record_action_budget(self, actions_count: int) -> None:
        now = time.time()
        for _ in range(max(0, actions_count)):
            self._action_timestamps.append(now)

    def _refresh_latency_metrics(self, latency_ms: float) -> None:
        self._metrics["last_tick_latency_ms"] = round(latency_ms, 2)
        total = max(1, self._metrics["ticks_total"])
        prev_avg = float(self._metrics.get("avg_tick_latency_ms", 0.0))
        self._metrics["avg_tick_latency_ms"] = round(((prev_avg * (total - 1)) + latency_ms) / total, 2)

    def _accumulate_action_counts(self, behaviors: list[Dict[str, Any]]) -> None:
        counts = self._metrics.setdefault("action_counts", {})
        for behavior in behaviors:
            action_type = str(behavior.get("action_type", "unknown")).lower()
            counts[action_type] = int(counts.get(action_type, 0)) + 1

    def get_metrics(self) -> Dict[str, Any]:
        """Return current simulation metrics snapshot."""
        snapshot = dict(self._metrics)
        snapshot["action_counts"] = dict(self._metrics.get("action_counts", {}))
        snapshot["rate_limit_window_actions"] = len(self._action_timestamps)
        snapshot["llm_enabled"] = bool(self._runtime_config.get("llm_enabled"))
        snapshot["llm_provider"] = self._runtime_config.get("llm_provider", "stub")
        return snapshot

    def _get_behaviors_for_tick(self, tick: int, fallback_agents: list[tuple[Any, Any]]) -> list[Dict[str, Any]]:
        """Read real OASIS actions from trace table for the current tick."""
        behaviors: list[Dict[str, Any]] = []
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT user_id, created_at, action, info
                FROM trace
                WHERE created_at = ?
                ORDER BY rowid ASC
                """,
                (tick,),
            )
            rows = cursor.fetchall()
            conn.close()

            for row in rows:
                agent_id = int(row["user_id"])
                action_type = str(row["action"])
                info_raw = row["info"] or "{}"
                try:
                    action_args = json.loads(info_raw)
                except Exception:
                    action_args = {"raw": str(info_raw)}

                agent = None
                if self.agent_graph and hasattr(self.agent_graph, "agent_mappings"):
                    agent = self.agent_graph.agent_mappings.get(agent_id)
                agent_name = (
                    agent.user_info.user_name
                    if agent is not None and hasattr(agent, "user_info") and hasattr(agent.user_info, "user_name")
                    else f"Agent_{agent_id}"
                )
                behaviors.append(
                    {
                        "agent_id": agent_id,
                        "agent_name": agent_name,
                        "action_type": action_type,
                        "action_args": action_args if isinstance(action_args, dict) else {"value": action_args},
                        "tick": tick,
                        "success": True,
                    }
                )
        except Exception as e:
            print(f"[OASIS] Failed to read trace actions for tick {tick}: {e}")

        if behaviors:
            return behaviors

        # Fallback behavior when trace is missing for this tick.
        for agent_id, agent in fallback_agents:
            agent_name = (
                agent.user_info.user_name
                if hasattr(agent, "user_info") and hasattr(agent.user_info, "user_name")
                else f"Agent_{agent_id}"
            )
            behaviors.append(
                {
                    "agent_id": int(agent_id),
                    "agent_name": agent_name,
                    "action_type": "llm_action",
                    "action_args": {},
                    "tick": tick,
                    "success": True,
                }
            )
        return behaviors

    async def get_posts(self, limit: int = 50) -> list[Dict[str, Any]]:
        """Get recent posts from the simulation."""
        if not self.env:
            return []

        try:
            # Query from database
            import sqlite3
            posts = []

            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            cursor.execute("""
                SELECT
                    p.post_id, p.user_id, p.content, p.created_at, p.num_likes,
                    u.user_name, u.name
                FROM post p
                JOIN user u ON p.user_id = u.user_id
                ORDER BY p.post_id DESC
                LIMIT ?
            """, (limit,))

            for row in cursor.fetchall():
                posts.append({
                    "id": str(row["post_id"]),
                    "tick": self.tick,
                    "authorId": row["user_id"],
                    "authorName": row["name"] or row["user_name"],
                    "emotion": 0.0,  # Could be computed from content
                    "content": row["content"] or "",
                    "likes": row["num_likes"] or 0,
                })

            conn.close()
            return posts

        except Exception as e:
            print(f"Error getting posts: {e}")
            return []

    def _get_user_id(self, agent) -> int:
        """Safely get user ID from OASIS agent."""
        # Try different possible attribute names for user ID.
        candidates = []
        if hasattr(agent, 'agent_id'):
            candidates.append(agent.agent_id)
        if hasattr(agent, 'user_id'):
            candidates.append(agent.user_id)
        if hasattr(agent, 'user_info') and hasattr(agent.user_info, 'user_id'):
            candidates.append(agent.user_info.user_id)
        if hasattr(agent, 'user_info') and hasattr(agent.user_info, 'uid'):
            candidates.append(agent.user_info.uid)
        if hasattr(agent, 'user_info') and hasattr(agent.user_info, 'id'):
            candidates.append(agent.user_info.id)

        for value in candidates:
            try:
                return int(value)
            except Exception:
                continue

        # Fallback: try to get from string representation
        try:
            return int(str(agent).split('Agent')[-1].split('(')[0].strip())
        except:
            return 0

    async def get_agents(self) -> list[Dict[str, Any]]:
        """Get all agents from the simulation."""
        if not self.agent_graph:
            return []

        agents = []
        for agent_id, agent in self.agent_graph.agent_mappings.items():
            # Try to extract additional data from OASIS agent
            extra_data = self._extract_agent_data(agent)

            # Get user ID safely
            user_id = self._get_user_id(agent)
            if user_id == 0:
                user_id = agent_id  # Fallback to mapping ID

            agents.append({
                "id": user_id,
                "name": agent.user_info.name if hasattr(agent.user_info, 'name') else (
                    agent.user_info.user_name if hasattr(agent.user_info, 'user_name') else f"Agent_{user_id}"
                ),
                "group": "unassigned",
                "identity": {
                    "username": agent.user_info.user_name if hasattr(agent.user_info, 'user_name') else f"User_{user_id}",
                    "age_band": "unknown",
                    "gender": "unknown",
                    "location": {
                        "country": "",
                        "region_city": ""
                    },
                    "profession": "",
                    "domain_of_expertise": []
                },
                "psychometrics": {
                    "personality": {"big_five": {"O": 0.5, "C": 0.5, "E": 0.5, "A": 0.5, "N": 0.5}},
                    "values": {"moral_foundations": {"care": 0.5, "fairness": 0.5, "loyalty": 0.5, "authority": 0.5, "sanctity": 0.5}}
                },
                "social_status": {
                    "influence_tier": "ordinary_user",
                    "economic_band": "medium",
                    "social_capital": {"network_size_proxy": 2}
                },
                "behavior_profile": {
                    "posting_cadence": {"posts_per_day": 1.0, "diurnal_pattern": ["unknown"]},
                    "rhetoric_style": {"civility": 0.5, "evidence_citation": 0.5}
                },
                "cognitive_state": {
                    "core_affect": {"sentiment": "calm", "arousal": 0.5},
                    "issue_stances": []
                },
                **extra_data  # Merge any extracted data
            })
        return agents

    def _extract_agent_data(self, agent) -> Dict[str, Any]:
        """Extract additional data from OASIS SocialAgent."""
        extra_data = {}

        try:
            # Try to get action history if available
            if hasattr(agent, 'action_history') and agent.action_history:
                actions = list(agent.action_history)[-5:]  # Last 5 actions
                if actions:
                    extra_data["recent_actions"] = [
                        {"type": str(a.type) if hasattr(a, 'type') else "unknown",
                         "tick": getattr(a, 'tick', 0)}
                        for a in actions
                    ]

            # Try to get memory/reasoning data
            if hasattr(agent, 'memory') and agent.memory:
                memory = agent.memory
                if hasattr(memory, 'get_recent_memories'):
                    try:
                        memories = memory.get_recent_memories(k=5)
                        if memories:
                            extra_data["memory_hits"] = [
                                {"id": str(i), "text": str(m)[:200], "score": 1.0}
                                for i, m in enumerate(memories)
                            ]
                    except:
                        pass

            # Try to get agent state attributes
            if hasattr(agent, 'state'):
                state = agent.state
                if hasattr(state, 'last_action'):
                    extra_data["lastAction"] = str(state.last_action)
                if hasattr(state, 'mood'):
                    extra_data["mood"] = float(state.mood)
                if hasattr(state, 'stance'):
                    extra_data["stance"] = float(state.stance)

        except Exception as e:
            print(f"Error extracting agent data: {e}")

        return extra_data

    async def get_agent_state(self, agent_id: int) -> Dict[str, Any]:
        """Get detailed state for a specific agent including evidence."""
        if not self.agent_graph:
            return {}

        # Find agent by ID
        agent = None
        for aid, a in self.agent_graph.agent_mappings.items():
            user_id = self._get_user_id(a)
            if user_id == agent_id or aid == agent_id:
                agent = a
                break

        if not agent:
            return {}

        state = {
            "mood": 0.0,
            "stance": 0.0,
            "resources": 0.5,
            "lastAction": "idle",
            "evidence": {
                "memoryHits": [],
                "reasoningSummary": "",
                "toolCalls": [],
            }
        }

        try:
            # Extract agent state
            if hasattr(agent, 'state'):
                agent_state = agent.state
                if hasattr(agent_state, 'mood'):
                    state["mood"] = float(agent_state.mood)
                if hasattr(agent_state, 'stance'):
                    state["stance"] = float(agent_state.stance)
                if hasattr(agent_state, 'resources'):
                    state["resources"] = float(agent_state.resources)
                if hasattr(agent_state, 'last_action'):
                    state["lastAction"] = str(agent_state.last_action)

            # Extract evidence/reasoning data
            evidence_data = state["evidence"]

            # Try to get tool calls
            if hasattr(agent, 'action_history') and agent.action_history:
                for action in list(agent.action_history)[-10:]:
                    action_dict = {}
                    if hasattr(action, 'type'):
                        action_dict["name"] = str(action.type)
                    if hasattr(action, 'created_at'):
                        action_dict["id"] = str(hash(str(action)))[:8]
                        # Calculate latency if timestamps available
                        if hasattr(action, 'executed_at') and hasattr(action, 'created_at'):
                            try:
                                latency = (action.executed_at - action.created_at).total_seconds() * 1000
                                action_dict["latencyMs"] = latency
                            except:
                                action_dict["latencyMs"] = 0.0
                        else:
                            action_dict["id"] = str(uuid.uuid4())[:8]
                            action_dict["latencyMs"] = 0.0
                    action_dict["status"] = "ok"
                    if action_dict:
                        evidence_data["toolCalls"].append(action_dict)

            # Try to get memory hits
            if hasattr(agent, 'memory') and agent.memory:
                memory = agent.memory
                if hasattr(memory, 'get_recent_memories'):
                    try:
                        memories = memory.get_recent_memories(k=5)
                        for i, mem in enumerate(memories):
                            mem_text = str(mem)
                            if len(mem_text) > 200:
                                mem_text = mem_text[:200] + "..."
                            evidence_data["memoryHits"].append({
                                "id": f"mem_{i}_{agent_id}",
                                "text": mem_text,
                                "score": 1.0 - (i * 0.1)  # Decay score for older memories
                            })
                    except:
                        pass
                elif hasattr(memory, 'memories'):
                    memories = list(memory.memories.values())[:5]
                    for i, mem in enumerate(memories):
                        mem_text = str(mem)
                        if len(mem_text) > 200:
                            mem_text = mem_text[:200] + "..."
                        evidence_data["memoryHits"].append({
                            "id": f"mem_{i}_{agent_id}",
                            "text": mem_text,
                            "score": 1.0 - (i * 0.1)
                        })

            # Generate reasoning summary
            if evidence_data["toolCalls"]:
                evidence_data["reasoningSummary"] = (
                    f"Agent executed {len(evidence_data['toolCalls'])} actions. "
                )
            if evidence_data["memoryHits"]:
                evidence_data["reasoningSummary"] = (
                    evidence_data.get("reasoningSummary", "") +
                    f"Retrieved {len(evidence_data['memoryHits'])} relevant memories from context."
                )
            if not evidence_data["reasoningSummary"]:
                evidence_data["reasoningSummary"] = "No recent reasoning activity recorded."

        except Exception as e:
            print(f"Error getting agent state: {e}")
            import traceback
            traceback.print_exc()

        return state

    async def refresh_model_backend(self) -> None:
        """Rebuild model backend and apply to existing agents."""
        self._model_backend = self._build_model_backend()
        if not self.agent_graph:
            return

        applied = 0
        for _, agent in self.agent_graph.agent_mappings.items():
            # SocialAgent inherits ChatAgent; model_backend is used internally.
            if hasattr(agent, "model_backend"):
                setattr(agent, "model_backend", self._model_backend)
                applied += 1
            if hasattr(agent, "model"):
                setattr(agent, "model", self._model_backend)
        print(f"[OASIS] Applied model backend to {applied} agents")

    async def close(self):
        """Close the simulation."""
        if self.env:
            try:
                await self.env.close()
            except Exception as e:
                print(f"Error closing OASIS: {e}")
            self.env = None
        self.is_running = False


# Global simulation instance
_oasis_simulation: Optional[OasisSimulation] = None


async def get_oasis_simulation() -> OasisSimulation:
    """Get or create the global OASIS simulation instance."""
    global _oasis_simulation
    if _oasis_simulation is None:
        _oasis_simulation = OasisSimulation()
    return _oasis_simulation


async def initialize_oasis_simulation(personas_path: str, runtime_config: Optional[Dict[str, Any]] = None) -> bool:
    """Initialize OASIS simulation with personas."""
    global _oasis_simulation
    _oasis_simulation = OasisSimulation()
    result = await _oasis_simulation.initialize(personas_path, runtime_config=runtime_config)
    return result


async def run_simulation_step() -> Dict[str, Any]:
    """Run one simulation step."""
    global _oasis_simulation
    if _oasis_simulation is None:
        return {"error": "Simulation not initialized"}
    return await _oasis_simulation.step()


async def get_simulation_metrics() -> Dict[str, Any]:
    """Get runtime simulation metrics."""
    global _oasis_simulation
    if _oasis_simulation is None:
        return {
            "ticks_total": 0,
            "ticks_success": 0,
            "ticks_failed": 0,
            "llm_timeouts": 0,
            "llm_errors": 0,
            "retries_total": 0,
            "fallback_ticks": 0,
            "actions_executed_total": 0,
            "last_tick_latency_ms": 0.0,
            "avg_tick_latency_ms": 0.0,
            "last_error": "simulation not initialized",
            "action_counts": {},
            "rate_limit_window_actions": 0,
            "llm_enabled": False,
            "llm_provider": "stub",
        }
    return _oasis_simulation.get_metrics()


async def get_simulation_posts(limit: int = 50) -> list[Dict[str, Any]]:
    """Get posts from the simulation."""
    global _oasis_simulation
    if _oasis_simulation is None:
        return []
    return await _oasis_simulation.get_posts(limit)


async def get_simulation_agents() -> list[Dict[str, Any]]:
    """Get agents from the simulation."""
    global _oasis_simulation
    if _oasis_simulation is None:
        return []
    return await _oasis_simulation.get_agents()


async def get_simulation_agent_state(agent_id: int) -> Dict[str, Any]:
    """Get detailed state for a specific agent including evidence."""
    global _oasis_simulation
    if _oasis_simulation is None:
        return {
            "mood": 0.0,
            "stance": 0.0,
            "resources": 0.5,
            "lastAction": "idle",
            "evidence": {
                "memoryHits": [],
                "reasoningSummary": "OASIS simulation not initialized",
                "toolCalls": [],
            }
        }
    return await _oasis_simulation.get_agent_state(agent_id)


async def update_simulation_config(config: Dict[str, Any]) -> None:
    """Update simulation runtime config and hot-apply model backend when needed."""
    global _oasis_simulation
    if _oasis_simulation is None:
        return

    previous = dict(_oasis_simulation._runtime_config)
    _oasis_simulation.update_runtime_config(config)

    model_related_keys = {
        "llm_enabled",
        "llm_provider",
        "llm_model",
        "llm_base_url",
        "llm_api_key",
        "llm_temperature",
        "llm_max_tokens",
        "llm_top_p",
    }
    should_refresh_model = any(previous.get(k) != _oasis_simulation._runtime_config.get(k) for k in model_related_keys)
    if should_refresh_model:
        await _oasis_simulation.refresh_model_backend()


async def close_simulation():
    """Close the simulation."""
    global _oasis_simulation
    if _oasis_simulation:
        await _oasis_simulation.close()
        _oasis_simulation = None
