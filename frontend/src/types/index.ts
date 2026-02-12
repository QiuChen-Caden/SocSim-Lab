/**
 * 全局类型定义 - 单一数据源
 * 所有类型都从这里导出，避免重复定义
 */

// ============ 基础类型 ============
export type ViewportMode = 'micro' | 'macro';
export type LogLevel = 'info' | 'ok' | 'error' | 'warn';
export type EventType = 'agent_action' | 'message' | 'intervention' | 'alert' | 'bookmark';
export type Theme = 'light' | 'dark';
export type StepTabKey = 'scenario' | 'pipeline' | 'groups' | 'config';
export type Step = 'design' | 'run' | 'intervene' | 'analyze';

// ============ 智能体相关类型 ============
export type AgeBand = '18-24' | '25-34' | '35-44' | '45-54' | '55-64' | '65+' | 'unknown';
export type Gender = 'male' | 'female' | 'unknown';
export type InfluenceTier = 'ordinary_user' | 'opinion_leader' | 'elite';
export type EconomicBand = 'low' | 'medium' | 'high' | 'unknown';
export type DiurnalPattern = 'morning' | 'afternoon' | 'evening' | 'night' | 'unknown';
export type Sentiment = 'angry' | 'calm' | 'happy' | 'sad' | 'fearful' | 'surprised';

// Big Five Personality Traits (大五人格)
export interface BigFive {
  O: number; // Openness 开放性 0..1
  C: number; // Conscientiousness 尽责性 0..1
  E: number; // Extraversion 外向性 0..1
  A: number; // Agreeableness 宜人性 0..1
  N: number; // Neuroticism 神经质 0..1
}

// Moral Foundations Theory (道德基础理论)
export interface MoralFoundations {
  care: number;      // Care/Harm 关怀/伤害 0..1
  fairness: number;  // Fairness/Cheating 公平/欺骗 0..1
  loyalty: number;   // Loyalty/Betrayal 忠诚/背叛 0..1
  authority: number; // Authority/Subversion 权威/反叛 0..1
  sanctity: number;  // Sanctity/Degradation 神圣/堕落 0..1
}

export interface Identity {
  username: string;
  age_band: AgeBand;
  gender: Gender;
  location: {
    country: string;
    region_city: string;
  };
  profession: string;
  domain_of_expertise: string[];
}

export interface Psychometrics {
  personality: {
    big_five: BigFive;
  };
  values: {
    moral_foundations: MoralFoundations;
  };
}

export interface SocialStatus {
  influence_tier: InfluenceTier;
  economic_band: EconomicBand;
  social_capital: {
    network_size_proxy: number; // 0..4+
  };
}

export interface BehaviorProfile {
  posting_cadence: {
    posts_per_day: number;
    diurnal_pattern: DiurnalPattern[];
  };
  rhetoric_style: {
    civility: number;        // 0..1 文明程度
    evidence_citation: number; // 0..1 证据引用倾向
  };
}

export interface CoreAffect {
  sentiment: Sentiment;
  arousal: number; // 0..1 唤醒度
}

export interface IssueStance {
  topic: string;
  support: number;   // -1..1 支持度
  certainty: number; // 0..1 确信度
}

export interface CognitiveState {
  core_affect: CoreAffect;
  issue_stances: IssueStance[];
}

export interface AgentProfile {
  id: number;
  name: string;
  group: string;
  identity: Identity;
  psychometrics: Psychometrics;
  social_status: SocialStatus;
  behavior_profile: BehaviorProfile;
  cognitive_state: CognitiveState;
}

export interface ToolCall {
  id: string;
  name: string;
  status: 'ok' | 'error';
  latencyMs: number;
}

export interface Evidence {
  memoryHits: Array<{ id: string; text: string; score: number }>;
  reasoningSummary: string;
  toolCalls: ToolCall[];
}

export interface AgentState {
  mood: number;
  stance: number;
  resources: number;
  lastAction: string;
  evidence: Evidence;
}

// ============ 群体类型 ============
export type SocialStratum = 'elite' | 'upper-middle' | 'middle' | 'working' | 'precarious';

export interface GroupProfile {
  key: string;
  label: string;
  dominantStratum: SocialStratum;
  cohesion: number;    // 0..1
  polarization: number; // 0..1
  trustClimate: number; // 0..1
  normSummary: string;
}

// ============ 信息流类型 ============
export interface FeedPost {
  id: string;
  tick: number;
  authorId: number;
  authorName: string;
  emotion: number;
  content: string;
  likes: number;
}

// ============ 事件与日志类型 ============
export interface TimelineEvent {
  id: string;
  tick: number;
  type: EventType;
  agentId?: number;
  title: string;
  payload?: Record<string, unknown>;
}

export interface LogLine {
  id: string;
  tick: number;
  agentId?: number;
  level: LogLevel;
  text: string;
}

export interface SystemLog {
  id: string;
  timestamp: number;
  level: 'info' | 'ok' | 'error' | 'warn';
  message: string;
  category: string;
}

// ============ 干预与快照类型 ============
export interface InterventionRecord {
  id: string;
  tick: number;
  command: string;
  targetAgentId?: number;
}

export interface SimulationSnapshot {
  id: string;
  experimentName: string;
  createdAt: number;
  runNumber: number;
  finalTick: number;
  data: {
    config: SimulationConfig;
    agents: Record<number, { profile: AgentProfile; state: AgentState }>;
    groups: Record<string, GroupProfile>;
    logs: LogLine[];
    events: TimelineEvent[];
    feed: FeedPost[];
    interventions: InterventionRecord[];
    systemLogs: SystemLog[];
  };
}

// ============ 配置类型 ============
export interface SimulationConfig {
  seed: number;
  agentCount: number;
  worldSize: number;
  ticksPerSecond: number;
  sampleAgents: number;
  viewportMode: ViewportMode;
  scenarioText: string;
  experimentName: string;
  designReady: boolean;
  llmEnabled: boolean;
  llmProvider: string;
  llmModel: string;
  llmBaseUrl: string;
  llmApiKey: string;
  llmTemperature: number;
  llmMaxTokens: number;
  llmTopP: number;
  llmActiveAgents: number;
  llmTimeoutMs: number;
  llmMaxRetries: number;
  llmRetryBackoffMs: number;
  llmMaxActionsPerMinute: number;
  llmFallbackOnError: boolean;
}

// ============ 状态类型 ============
export interface SimulationState {
  config: SimulationConfig;
  tick: number;
  isRunning: boolean;
  speed: number;
  selectedAgentId: number | null;
  agents: Record<number, { profile: AgentProfile; state: AgentState }>;
  groups: Record<string, GroupProfile>;
  logs: LogLine[];
  events: TimelineEvent[];
  feed: FeedPost[];
  interventions: InterventionRecord[];
  snapshots: SimulationSnapshot[];
  currentSnapshotId: string | null;
  systemLogs: SystemLog[];
}

// ============ API 相关类型 ============
export interface ApiError {
  error: string;
  detail?: string;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface Bookmark {
  id: string;
  tick: number;
  note: string;
  createdAt: number;
}

// ============ 视图相关类型 ============
export interface PersonaStats {
  totalAgents: number;
  influenceTierDistribution: Record<string, number>;
  groupDistribution: Record<string, number>;
  ageBandDistribution: Record<string, number>;
  genderDistribution: Record<string, number>;
  sentimentDistribution: Record<string, number>;
  avgMood: number;
  avgStance: number;
  avgResources: number;
  avgCivility: number;
  avgEvidenceCitation: number;
  topTopics: Array<{ topic: string; count: number }>;
  economicBandDistribution: Record<string, number>;
}

export interface FeedStats {
  avgEmotion: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  totalLikes: number;
  avgLikes: number;
  mostEngaged?: FeedPost;
}

export interface StreamItem {
  kind: 'post' | 'event' | 'log';
  id: string;
  tick: number;
  // Post fields
  authorName?: string;
  authorId?: number;
  content?: string;
  emotion?: number;
  likes?: number;
  // Event fields
  eventType?: string;
  title?: string;
  // Log fields
  level?: LogLevel;
  text?: string;
}

// ============ WebSocket 类型 ============
export type WebSocketMessage =
  | { type: 'connected'; clientId: string; timestamp: string }
  | { type: 'tick_update'; tick: number; isRunning: boolean; speed: number; timestamp: string }
  | { type: 'agent_update'; agentId: number; state: AgentState; timestamp: string }
  | { type: 'post_created'; post: FeedPost; timestamp: string }
  | { type: 'event_created'; event: TimelineEvent; timestamp: string }
  | { type: 'log_added'; log: LogLine; timestamp: string }
  | { type: 'system_log'; log: SystemLog; timestamp: string }
  | { type: 'simulation_state'; state: SimulationState; timestamp: string }
  | { type: 'error'; error: string; details?: Record<string, unknown>; timestamp: string }
  | { type: 'pong'; timestamp: string };

export type WebSocketEventListener = (message: WebSocketMessage) => void;

// ============ Action 类型 ============
export type Action =
  | { type: 'toggle_run' }
  | { type: 'set_running'; isRunning: boolean }
  | { type: 'set_speed'; speed: number }
  | { type: 'set_tick'; tick: number }
  | { type: 'set_selected_agent'; agentId: number | null }
  | { type: 'push_log'; level: LogLevel; tick: number; agentId?: number; text: string }
  | { type: 'push_event'; event: TimelineEvent }
  | { type: 'push_feed'; tick: number; authorId: number; content: string; emotion: number; authorName?: string; likes?: number; postId?: string }
  | { type: 'apply_intervention'; tick: number; command: string; targetAgentId?: number }
  | { type: 'set_config'; patch: Partial<SimulationConfig> }
  | { type: 'mutate_agent_state'; agentId: number; patch: Partial<AgentState> }
  | { type: 'regenerate_personas' }
  | { type: 'create_snapshot' }
  | { type: 'load_snapshot'; snapshotId: string }
  | { type: 'delete_snapshot'; snapshotId: string }
  | { type: 'clear_snapshots' }
  | { type: 'push_system_log'; log: SystemLog }
  | { type: 'set_system_logs'; logs: SystemLog[] };
