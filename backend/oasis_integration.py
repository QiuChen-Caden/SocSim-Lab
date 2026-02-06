"""
OASIS Simulation Integration Module

This module integrates the OASIS social simulation framework
with the FastAPI backend.
"""
import asyncio
import sys
import os
from pathlib import Path
from typing import Optional, Dict, Any, TYPE_CHECKING, List, Union
import json

# Add OASIS to path
# File: C:\Users\Lenovo\Desktop\SocSim-Lab\backend\oasis_integration.py
# .parent (1) = backend, .parent (2) = SocSim-Lab, .parent (3) = Desktop
# oasis-main is at C:\Users\Lenovo\Desktop\oasis-main
OASIS_PATH = Path(__file__).parent.parent.parent / "oasis-main"
sys.path.insert(0, str(OASIS_PATH))

# Type checking imports (not evaluated at runtime)
if TYPE_CHECKING:
    from oasis.environment.env import OasisEnv
    from oasis.social_agent.agent import SocialAgent
    from oasis.social_agent.agent_graph import AgentGraph
    from oasis.social_platform.config import UserInfo
    from oasis.environment.env_action import ManualAction
    from oasis.social_platform.typing import ActionType

# Runtime imports
try:
    import oasis
    from oasis.environment.env import OasisEnv
    from oasis.environment.env_action import ManualAction
    from oasis.social_agent.agent import SocialAgent
    from oasis.social_agent.agent_graph import AgentGraph
    from oasis.social_agent.agents_generator import generate_custom_agents
    from oasis.social_platform.platform import Platform
    from oasis.social_platform.typing import ActionType, DefaultPlatformType
    from oasis.social_platform.config import UserInfo
    from oasis.social_platform.database import create_db
    # Import StubModel to avoid requiring LLM API keys and tiktoken downloads
    from camel.models import StubModel
    from camel.types import ModelType
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
    ManualAction = Any  # type: ignore
    ActionType = Any  # type: ignore


class OasisSimulation:
    """OASIS Simulation wrapper for FastAPI integration."""

    def __init__(self, db_path: str = str(Path(__file__).resolve().parent.parent / "data" / "oasis_simulation.db")):
        self.db_path = db_path
        self.env: Optional[OasisEnv] = None
        self.agent_graph: Optional[AgentGraph] = None
        self.is_running = False
        self.tick = 0
        self._lock = asyncio.Lock()
        self._platform_task = None
        # Create a shared stub model for all agents - no LLM API required
        # The stub model avoids tiktoken downloads and API key requirements
        self._stub_model = StubModel(ModelType.STUB)

    async def initialize(self, personas_json_path: str) -> bool:
        """Initialize OASIS simulation with personas data."""
        if not OASIS_AVAILABLE:
            print("OASIS not available, using mock simulation")
            return False

        try:
            # Ensure database directory exists
            db_dir = os.path.dirname(self.db_path)
            if db_dir:
                os.makedirs(db_dir, exist_ok=True)

            # Load personas from JSON
            with open(personas_json_path, 'r', encoding='utf-8') as f:
                personas_data = json.load(f)

            # Create agent graph
            self.agent_graph = AgentGraph()

            # Create agents from personas - using shared stub model to avoid LLM API
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

                    # Create SocialAgent with stub model - no LLM API required
                    agent = SocialAgent(
                        agent_id=agent_id,
                        user_info=user_info,
                        agent_graph=self.agent_graph,
                        model=self._stub_model,
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

            print(f"OASIS simulation initialized with {count} agents")
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
            try:
                # Prepare actions - let agents decide what to do
                # For simplicity, randomly select some agents to perform actions
                import random
                actions = {}
                agent_behaviors = []  # Track detailed behaviors

                # Get agents from agent_mappings as (key, value) pairs
                # The key is the sequential agent_id (0, 1, 2, ...)
                agent_items = list(self.env.agent_graph.agent_mappings.items())
                # Select ~10% of agents to act each tick
                num_active = max(1, len(agent_items) // 10)

                for _ in range(num_active):
                    agent_id, agent = random.choice(agent_items)
                    # Use simple actions that don't require existing IDs
                    # CREATE_POST just needs content, DO_NOTHING needs nothing
                    simple_actions = [
                        ActionType.CREATE_POST,
                        ActionType.DO_NOTHING,
                        ActionType.REFRESH,
                    ]
                    # Select a random simple action
                    action_type = random.choice(simple_actions)
                    action_args = self._get_action_args(action_type, agent)

                    # Track behavior before execution - use the sequential agent_id
                    user_name = agent.user_info.user_name if hasattr(agent.user_info, 'user_name') else f"Agent_{agent_id}"

                    actions[agent] = ManualAction(
                        action_type=action_type,
                        action_args=action_args
                    )

                    # Record behavior details - use sequential agent_id from mappings
                    behavior = {
                        "agent_id": int(agent_id),  # Use the sequential ID from mappings
                        "agent_name": user_name,
                        "action_type": str(action_type),
                        "action_args": action_args,
                    }
                    agent_behaviors.append(behavior)

                # Execute the step
                result = await self.env.step(actions)
                self.tick += 1

                # Capture actual results from OASIS (posts created, etc.)
                # The result dict contains info about what actually happened
                detailed_behaviors = []
                for behavior in agent_behaviors:
                    behavior_copy = behavior.copy()
                    behavior_copy["tick"] = self.tick
                    behavior_copy["success"] = True  # Default to success
                    detailed_behaviors.append(behavior_copy)

                return {
                    "tick": self.tick,
                    "actions": len(actions),
                    "active_agents": num_active,
                    "total_agents": len(agent_items),
                    "behaviors": detailed_behaviors,  # Return detailed behaviors
                }

            except Exception as e:
                print(f"Error in simulation step: {e}")
                import traceback
                traceback.print_exc()
                return {"tick": self.tick, "actions": 0, "error": str(e)}

    def _get_action_args(self, action_type: ActionType, agent=None) -> Dict[str, Any]:
        """Get action arguments based on action type."""
        if action_type == ActionType.CREATE_POST:
            # Generate varied post content
            post_contents = [
                "Just finished a great book!",
                "Beautiful day today.",
                "Thinking about the future.",
                "Anyone else excited for the weekend?",
                "Coffee is life.",
                "Working on a new project.",
                "Interesting article I just read.",
                "Time for a break.",
                "Looking forward to new opportunities.",
                "Grateful for today's moments.",
            ]
            import random
            return {"content": random.choice(post_contents)}
        return {}

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


async def initialize_oasis_simulation(personas_path: str) -> bool:
    """Initialize OASIS simulation with personas."""
    global _oasis_simulation
    _oasis_simulation = OasisSimulation()
    result = await _oasis_simulation.initialize(personas_path)
    return result


async def run_simulation_step() -> Dict[str, Any]:
    """Run one simulation step."""
    global _oasis_simulation
    if _oasis_simulation is None:
        return {"error": "Simulation not initialized"}
    return await _oasis_simulation.step()


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


async def close_simulation():
    """Close the simulation."""
    global _oasis_simulation
    if _oasis_simulation:
        await _oasis_simulation.close()
        _oasis_simulation = None
