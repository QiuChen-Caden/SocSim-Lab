"""
Extended data types for OASIS frontend integration.
These types match the frontend TypeScript types in src/app/types.ts
"""
from dataclasses import dataclass, field
from typing import Any, Literal
from enum import Enum
import json
from datetime import datetime


class AgeBand(str, Enum):
    AGE_18_24 = "18-24"
    AGE_25_34 = "25-34"
    AGE_35_44 = "35-44"
    AGE_45_54 = "45-54"
    AGE_55_64 = "55-64"
    AGE_65_PLUS = "65+"
    UNKNOWN = "unknown"


class Gender(str, Enum):
    MALE = "male"
    FEMALE = "female"
    UNKNOWN = "unknown"


class InfluenceTier(str, Enum):
    ORDINARY_USER = "ordinary_user"
    OPINION_LEADER = "opinion_leader"
    ELITE = "elite"


class EconomicBand(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    UNKNOWN = "unknown"


class DiurnalPattern(str, Enum):
    MORNING = "morning"
    AFTERNOON = "afternoon"
    EVENING = "evening"
    NIGHT = "night"
    UNKNOWN = "unknown"


class Sentiment(str, Enum):
    ANGRY = "angry"
    CALM = "calm"
    HAPPY = "happy"
    SAD = "sad"
    FEARFUL = "fearful"
    SURPRISED = "surprised"


class LogLevel(str, Enum):
    INFO = "info"
    OK = "ok"
    ERROR = "error"


class ViewportMode(str, Enum):
    MICRO = "micro"
    MACRO = "macro"


class EventType(str, Enum):
    AGENT_ACTION = "agent_action"
    MESSAGE = "message"
    INTERVENTION = "intervention"
    ALERT = "alert"
    BOOKMARK = "bookmark"


class SocialStratum(str, Enum):
    ELITE = "elite"
    UPPER_MIDDLE = "upper-middle"
    MIDDLE = "middle"
    WORKING = "working"
    PRECARIOUS = "precarious"


@dataclass
class BigFive:
    """Big Five Personality Traits (大五人格)"""
    O: float = 0.5  # Openness 开放性 0..1
    C: float = 0.5  # Conscientiousness 尽责性 0..1
    E: float = 0.5  # Extraversion 外向性 0..1
    A: float = 0.5  # Agreeableness 宜人性 0..1
    N: float = 0.5  # Neuroticism 神经质 0..1

    def to_dict(self) -> dict[str, float]:
        return {"O": self.O, "C": self.C, "E": self.E, "A": self.A, "N": self.N}

    @classmethod
    def from_dict(cls, data: dict[str, float]) -> "BigFive":
        return cls(
            O=data.get("O", 0.5),
            C=data.get("C", 0.5),
            E=data.get("E", 0.5),
            A=data.get("A", 0.5),
            N=data.get("N", 0.5),
        )


@dataclass
class MoralFoundations:
    """Moral Foundations Theory (道德基础理论)"""
    care: float = 0.5       # Care/Harm 关怀/伤害 0..1
    fairness: float = 0.5   # Fairness/Cheating 公平/欺骗 0..1
    loyalty: float = 0.5    # Loyalty/Betrayal 忠诚/背叛 0..1
    authority: float = 0.5  # Authority/Subversion 权威/反叛 0..1
    sanctity: float = 0.5   # Sanctity/Degradation 神圣/堕落 0..1

    def to_dict(self) -> dict[str, float]:
        return {
            "care": self.care,
            "fairness": self.fairness,
            "loyalty": self.loyalty,
            "authority": self.authority,
            "sanctity": self.sanctity,
        }

    @classmethod
    def from_dict(cls, data: dict[str, float]) -> "MoralFoundations":
        return cls(
            care=data.get("care", 0.5),
            fairness=data.get("fairness", 0.5),
            loyalty=data.get("loyalty", 0.5),
            authority=data.get("authority", 0.5),
            sanctity=data.get("sanctity", 0.5),
        )


@dataclass
class Identity:
    """Identity (身份信息)"""
    username: str = ""
    age_band: AgeBand = AgeBand.UNKNOWN
    gender: Gender = Gender.UNKNOWN
    country: str = ""
    region_city: str = ""
    profession: str = ""
    domain_of_expertise: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "username": self.username,
            "age_band": self.age_band.value,
            "gender": self.gender.value,
            "location": {
                "country": self.country,
                "region_city": self.region_city,
            },
            "profession": self.profession,
            "domain_of_expertise": self.domain_of_expertise,
        }


@dataclass
class Psychometrics:
    """Psychometrics (心理测量)"""
    big_five: BigFive = field(default_factory=BigFive)
    moral_foundations: MoralFoundations = field(default_factory=MoralFoundations)

    def to_dict(self) -> dict[str, Any]:
        return {
            "personality": {
                "big_five": self.big_five.to_dict(),
            },
            "values": {
                "moral_foundations": self.moral_foundations.to_dict(),
            },
        }


@dataclass
class SocialStatus:
    """Social Status (社会地位)"""
    influence_tier: InfluenceTier = InfluenceTier.ORDINARY_USER
    economic_band: EconomicBand = EconomicBand.MEDIUM
    network_size_proxy: int = 2  # 0..4+

    def to_dict(self) -> dict[str, Any]:
        return {
            "influence_tier": self.influence_tier.value,
            "economic_band": self.economic_band.value,
            "social_capital": {
                "network_size_proxy": self.network_size_proxy,
            },
        }


@dataclass
class BehaviorProfile:
    """Behavior Profile (行为画像)"""
    posts_per_day: float = 1.0
    diurnal_pattern: list[DiurnalPattern] = field(default_factory=lambda: [DiurnalPattern.UNKNOWN])
    civility: float = 0.5  # 0..1
    evidence_citation: float = 0.5  # 0..1

    def to_dict(self) -> dict[str, Any]:
        return {
            "posting_cadence": {
                "posts_per_day": self.posts_per_day,
                "diurnal_pattern": [p.value for p in self.diurnal_pattern],
            },
            "rhetoric_style": {
                "civility": self.civility,
                "evidence_citation": self.evidence_citation,
            },
        }


@dataclass
class CoreAffect:
    """Core Affect (核心情感)"""
    sentiment: Sentiment = Sentiment.CALM
    arousal: float = 0.5  # 0..1

    def to_dict(self) -> dict[str, Any]:
        return {
            "sentiment": self.sentiment.value,
            "arousal": self.arousal,
        }


@dataclass
class IssueStance:
    """Issue Stance (议题立场)"""
    topic: str = ""
    support: float = 0.0  # -1..1
    certainty: float = 0.5  # 0..1

    def to_dict(self) -> dict[str, float | str]:
        return {
            "topic": self.topic,
            "support": self.support,
            "certainty": self.certainty,
        }


@dataclass
class CognitiveState:
    """Cognitive State (认知状态)"""
    core_affect: CoreAffect = field(default_factory=CoreAffect)
    issue_stances: list[IssueStance] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "core_affect": self.core_affect.to_dict(),
            "issue_stances": [s.to_dict() for s in self.issue_stances],
        }


@dataclass
class AgentProfile:
    """Agent Profile (智能体画像)"""
    id: int
    name: str
    group: str
    identity: Identity = field(default_factory=Identity)
    psychometrics: Psychometrics = field(default_factory=Psychometrics)
    social_status: SocialStatus = field(default_factory=SocialStatus)
    behavior_profile: BehaviorProfile = field(default_factory=BehaviorProfile)
    cognitive_state: CognitiveState = field(default_factory=CognitiveState)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "group": self.group,
            "identity": self.identity.to_dict(),
            "psychometrics": self.psychometrics.to_dict(),
            "social_status": self.social_status.to_dict(),
            "behavior_profile": self.behavior_profile.to_dict(),
            "cognitive_state": self.cognitive_state.to_dict(),
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "AgentProfile":
        identity_data = data.get("identity", {})
        psychometrics_data = data.get("psychometrics", {})
        social_status_data = data.get("social_status", {})
        behavior_profile_data = data.get("behavior_profile", {})
        cognitive_state_data = data.get("cognitive_state", {})

        return cls(
            id=data["id"],
            name=data["name"],
            group=data.get("group", "unassigned"),
            identity=Identity(
                username=identity_data.get("username", ""),
                age_band=AgeBand(identity_data.get("age_band", "unknown")),
                gender=Gender(identity_data.get("gender", "unknown")),
                country=identity_data.get("location", {}).get("country", ""),
                region_city=identity_data.get("location", {}).get("region_city", ""),
                profession=identity_data.get("profession", ""),
                domain_of_expertise=identity_data.get("domain_of_expertise", []),
            ),
            psychometrics=Psychometrics(
                big_five=BigFive.from_dict(
                    psychometrics_data.get("personality", {}).get("big_five", {})
                ),
                moral_foundations=MoralFoundations.from_dict(
                    psychometrics_data.get("values", {}).get("moral_foundations", {})
                ),
            ),
            social_status=SocialStatus(
                influence_tier=InfluenceTier(social_status_data.get("influence_tier", "ordinary_user")),
                economic_band=EconomicBand(social_status_data.get("economic_band", "medium")),
                network_size_proxy=social_status_data.get("social_capital", {}).get("network_size_proxy", 2),
            ),
            behavior_profile=BehaviorProfile(
                posts_per_day=behavior_profile_data.get("posting_cadence", {}).get("posts_per_day", 1.0),
                diurnal_pattern=[DiurnalPattern(p) for p in behavior_profile_data.get("posting_cadence", {}).get("diurnal_pattern", ["unknown"])],
                civility=behavior_profile_data.get("rhetoric_style", {}).get("civility", 0.5),
                evidence_citation=behavior_profile_data.get("rhetoric_style", {}).get("evidence_citation", 0.5),
            ),
            cognitive_state=CognitiveState(
                core_affect=CoreAffect(
                    sentiment=Sentiment(cognitive_state_data.get("core_affect", {}).get("sentiment", "calm")),
                    arousal=cognitive_state_data.get("core_affect", {}).get("arousal", 0.5),
                ),
                issue_stances=[
                    IssueStance(
                        topic=s.get("topic", ""),
                        support=s.get("support", 0.0),
                        certainty=s.get("certainty", 0.5),
                    )
                    for s in cognitive_state_data.get("issue_stances", [])
                ],
            ),
        )


@dataclass
class ToolCall:
    """Tool Call (工具调用记录)"""
    id: str = ""
    name: str = ""
    status: str = "ok"  # "ok" or "error"
    latency_ms: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "status": self.status,
            "latencyMs": self.latency_ms,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "ToolCall":
        return cls(
            id=data.get("id", ""),
            name=data.get("name", ""),
            status=data.get("status", "ok"),
            latency_ms=data.get("latencyMs", data.get("latency_ms", 0.0)),
        )


@dataclass
class MemoryHit:
    """Memory Hit (记忆命中)"""
    id: str = ""
    text: str = ""
    score: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "text": self.text,
            "score": self.score,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "MemoryHit":
        return cls(
            id=data.get("id", ""),
            text=data.get("text", ""),
            score=data.get("score", 0.0),
        )


@dataclass
class Evidence:
    """Evidence (证据追踪)"""
    memory_hits: list[MemoryHit] = field(default_factory=list)
    reasoning_summary: str = ""
    tool_calls: list[ToolCall] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "memoryHits": [m.to_dict() for m in self.memory_hits],
            "reasoningSummary": self.reasoning_summary,
            "toolCalls": [t.to_dict() for t in self.tool_calls],
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Evidence":
        return cls(
            memory_hits=[MemoryHit.from_dict(m) for m in data.get("memoryHits", [])],
            reasoning_summary=data.get("reasoningSummary", ""),
            tool_calls=[ToolCall.from_dict(t) for t in data.get("toolCalls", [])],
        )


@dataclass
class AgentState:
    """Agent State (智能体状态)"""
    mood: float = 0.0  # -1..1
    stance: float = 0.0  # -1..1
    resources: float = 0.5  # 0..1
    last_action: str = ""
    evidence: Evidence = field(default_factory=Evidence)

    def to_dict(self) -> dict[str, Any]:
        return {
            "mood": self.mood,
            "stance": self.stance,
            "resources": self.resources,
            "lastAction": self.last_action,
            "evidence": self.evidence.to_dict(),
        }


@dataclass
class FeedPost:
    """Feed Post (信息流帖子)"""
    id: str
    tick: int
    author_id: int
    author_name: str
    emotion: float  # -1..1
    content: str
    likes: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "tick": self.tick,
            "authorId": self.author_id,
            "authorName": self.author_name,
            "emotion": self.emotion,
            "content": self.content,
            "likes": self.likes,
        }


@dataclass
class TimelineEvent:
    """Timeline Event (时间线事件)"""
    id: str
    tick: int
    type: EventType
    title: str
    agent_id: int | None = None
    payload: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "tick": self.tick,
            "type": self.type.value,
            "agentId": self.agent_id,
            "title": self.title,
            "payload": self.payload,
        }


@dataclass
class LogLine:
    """Log Line (日志行)"""
    id: str
    tick: int
    level: LogLevel
    text: str
    agent_id: int | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "tick": self.tick,
            "agentId": self.agent_id,
            "level": self.level.value,
            "text": self.text,
        }


@dataclass
class GroupProfile:
    """Group Profile (群体画像)"""
    key: str
    label: str
    dominant_stratum: SocialStratum = SocialStratum.MIDDLE
    cohesion: float = 0.5  # 0..1
    polarization: float = 0.5  # 0..1
    trust_climate: float = 0.5  # 0..1
    norm_summary: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "key": self.key,
            "label": self.label,
            "dominantStratum": self.dominant_stratum.value,
            "cohesion": self.cohesion,
            "polarization": self.polarization,
            "trustClimate": self.trust_climate,
            "normSummary": self.norm_summary,
        }


@dataclass
class SimulationConfig:
    """Simulation Configuration"""
    seed: int = 42
    agent_count: int = 30
    world_size: int = 1000
    ticks_per_second: float = 1.0
    sample_agents: int = 30
    viewport_mode: ViewportMode = ViewportMode.MICRO
    scenario_text: str = ""
    experiment_name: str = "experiment_1"
    design_ready: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {
            "seed": self.seed,
            "agentCount": self.agent_count,
            "worldSize": self.world_size,
            "ticksPerSecond": self.ticks_per_second,
            "sampleAgents": self.sample_agents,
            "viewportMode": self.viewport_mode.value,
            "scenarioText": self.scenario_text,
            "experimentName": self.experiment_name,
            "designReady": self.design_ready,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "SimulationConfig":
        return cls(
            seed=data.get("seed", 42),
            agent_count=data.get("agentCount", data.get("agent_count", 30)),
            world_size=data.get("worldSize", data.get("world_size", 1000)),
            ticks_per_second=data.get("ticksPerSecond", data.get("ticks_per_second", 1.0)),
            sample_agents=data.get("sampleAgents", data.get("sample_agents", 30)),
            viewport_mode=ViewportMode(data.get("viewportMode", data.get("viewport_mode", "micro"))),
            scenario_text=data.get("scenarioText", data.get("scenario_text", "")),
            experiment_name=data.get("experimentName", data.get("experiment_name", "experiment_1")),
            design_ready=data.get("designReady", data.get("design_ready", False)),
        )


@dataclass
class InterventionRecord:
    """Intervention Record"""
    id: str
    tick: int
    command: str
    target_agent_id: int | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "tick": self.tick,
            "command": self.command,
            "targetAgentId": self.target_agent_id,
        }


@dataclass
class SimulationSnapshot:
    """Simulation Snapshot"""
    id: str
    experiment_name: str
    created_at: int
    run_number: int
    final_tick: int
    data: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "experimentName": self.experiment_name,
            "createdAt": self.created_at,
            "runNumber": self.run_number,
            "finalTick": self.final_tick,
            "data": self.data,
        }


@dataclass
class SimulationState:
    """Simulation State (模拟状态)"""
    config: SimulationConfig = field(default_factory=SimulationConfig)
    tick: int = 0
    is_running: bool = False
    speed: float = 1.0
    selected_agent_id: int | None = None
    agents: dict[int, dict[str, Any]] = field(default_factory=dict)
    groups: dict[str, dict[str, Any]] = field(default_factory=dict)
    logs: list[dict[str, Any]] = field(default_factory=list)
    events: list[dict[str, Any]] = field(default_factory=list)
    feed: list[dict[str, Any]] = field(default_factory=list)
    interventions: list[dict[str, Any]] = field(default_factory=list)
    snapshots: list[dict[str, Any]] = field(default_factory=list)
    current_snapshot_id: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "config": self.config.to_dict(),
            "tick": self.tick,
            "isRunning": self.is_running,
            "speed": self.speed,
            "selectedAgentId": self.selected_agent_id,
            "agents": self.agents,
            "groups": self.groups,
            "logs": self.logs,
            "events": self.events,
            "feed": self.feed,
            "interventions": self.interventions,
            "snapshots": self.snapshots,
            "currentSnapshotId": self.current_snapshot_id,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "SimulationState":
        """Create SimulationState from dictionary (for deserialization from JSON)."""
        return cls(
            config=SimulationConfig.from_dict(data.get("config", {})),
            tick=data.get("tick", 0),
            is_running=data.get("isRunning", data.get("is_running", False)),
            speed=data.get("speed", 1.0),
            selected_agent_id=data.get("selectedAgentId", data.get("selected_agent_id")),
            agents=data.get("agents", {}),
            groups=data.get("groups", {}),
            logs=data.get("logs", []),
            events=data.get("events", []),
            feed=data.get("feed", []),
            interventions=data.get("interventions", []),
            snapshots=data.get("snapshots", []),
            current_snapshot_id=data.get("currentSnapshotId", data.get("current_snapshot_id")),
        )


@dataclass
class VisualizationAgent:
    """Agent data for PixiJS visualization"""
    id: int
    x: float
    y: float
    emotion: float  # -1..1
    group: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "x": self.x,
            "y": self.y,
            "emotion": self.emotion,
            "group": self.group,
        }
