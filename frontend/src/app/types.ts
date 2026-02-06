export type ViewportMode = 'micro' | 'macro'

export type LogLevel = 'info' | 'ok' | 'error'

export type ToolCall = {
  id: string
  name: string
  status: 'ok' | 'error'
  latencyMs: number
}

export type Evidence = {
  memoryHits: Array<{ id: string; text: string; score: number }>
  reasoningSummary: string
  toolCalls: ToolCall[]
}

// ============= Twitter Persona Types (Based on JSON Data) =============

export type AgeBand = '18-24' | '25-34' | '35-44' | '45-54' | '55-64' | '65+' | 'unknown'

export type Gender = 'male' | 'female' | 'unknown'

export type InfluenceTier = 'ordinary_user' | 'opinion_leader' | 'elite'

export type EconomicBand = 'low' | 'medium' | 'high' | 'unknown'

export type DiurnalPattern = 'morning' | 'afternoon' | 'evening' | 'night' | 'unknown'

export type Sentiment = 'angry' | 'calm' | 'happy' | 'sad' | 'fearful' | 'surprised'

// Big Five Personality Traits (大五人格)
export type BigFive = {
  O: number // Openness 开放性 0..1
  C: number // Conscientiousness 尽责性 0..1
  E: number // Extraversion 外向性 0..1
  A: number // Agreeableness 宜人性 0..1
  N: number // Neuroticism 神经质 0..1
}

// Moral Foundations Theory (道德基础理论)
export type MoralFoundations = {
  care: number       // Care/Harm 关怀/伤害 0..1
  fairness: number   // Fairness/Cheating 公平/欺骗 0..1
  loyalty: number    // Loyalty/Betrayal 忠诚/背叛 0..1
  authority: number  // Authority/Subversion 权威/反叛 0..1
  sanctity: number   // Sanctity/Degradation 神圣/堕落 0..1
}

// Identity (身份信息)
export type Identity = {
  username: string
  age_band: AgeBand
  gender: Gender
  location: {
    country: string
    region_city: string
  }
  profession: string
  domain_of_expertise: string[]
}

// Psychometrics (心理测量)
export type Psychometrics = {
  personality: {
    big_five: BigFive
  }
  values: {
    moral_foundations: MoralFoundations
  }
}

// Social Status (社会地位)
export type SocialStatus = {
  influence_tier: InfluenceTier
  economic_band: EconomicBand
  social_capital: {
    network_size_proxy: number // 0..4+ (网络规模代理值)
  }
}

// Behavior Profile (行为画像)
export type BehaviorProfile = {
  posting_cadence: {
    posts_per_day: number
    diurnal_pattern: DiurnalPattern[]
  }
  rhetoric_style: {
    civility: number        // 0..1 文明程度
    evidence_citation: number // 0..1 证据引用倾向
  }
}

// Core Affect (核心情感)
export type CoreAffect = {
  sentiment: Sentiment
  arousal: number // 0..1 唤醒度
}

// Issue Stance (议题立场)
export type IssueStance = {
  topic: string
  support: number   // -1..1 支持度 (negative = oppose, positive = support)
  certainty: number // 0..1 确信度
}

// Cognitive State (认知状态)
export type CognitiveState = {
  core_affect: CoreAffect
  issue_stances: IssueStance[]
}

// ============= Combined Persona Types =============

export type AgentProfile = {
  id: number
  name: string
  group: string
  identity: Identity
  psychometrics: Psychometrics
  social_status: SocialStatus
  behavior_profile: BehaviorProfile
  cognitive_state: CognitiveState
}

// Legacy types for backward compatibility (maps to new structure)
export type SocialStratum = 'elite' | 'upper-middle' | 'middle' | 'working' | 'precarious'

export type AgentSocialProfile = {
  stratum: SocialStratum
  age: number
  occupation: string
  education: string
  incomeLevel: number // 0..1
  influence: number // 0..1
  networkSize: number
  location: string
  interests: string[]
}

export type AgentCognitiveTraits = {
  analytical: number // 0..1
  openness: number // 0..1
  conformity: number // 0..1
  riskTolerance: number // 0..1
  socialTrust: number // 0..1
  empathy: number // 0..1
  attention: number // 0..1
  longTermPlanning: number // 0..1
  mediaLiteracy: number // 0..1
}

export type AgentCognitiveProfile = {
  archetype: string
  traits: AgentCognitiveTraits
  biases: string[]
  summary: string
}

export type AgentState = {
  mood: number
  stance: number
  resources: number
  lastAction: string
  evidence: Evidence
}

export type GroupProfile = {
  key: string
  label: string
  dominantStratum: SocialStratum
  cohesion: number // 0..1
  polarization: number // 0..1
  trustClimate: number // 0..1
  normSummary: string
}

export type LogLine = {
  id: string
  tick: number
  agentId?: number
  level: LogLevel
  text: string
}

export type TimelineEvent = {
  id: string
  tick: number
  type: 'agent_action' | 'message' | 'intervention' | 'alert' | 'bookmark'
  agentId?: number
  title: string
  payload?: Record<string, unknown>
}

export type FeedPost = {
  id: string
  tick: number
  authorId: number
  authorName: string
  emotion: number
  content: string
  likes: number
}

export type SimulationConfig = {
  seed: number
  agentCount: number
  worldSize: number
  ticksPerSecond: number
  sampleAgents: number
  viewportMode: ViewportMode
  scenarioText: string
  experimentName: string
  designReady: boolean
}

export type InterventionRecord = {
  id: string
  tick: number
  command: string
  targetAgentId?: number
}

export type SimulationSnapshot = {
  id: string
  experimentName: string
  createdAt: number
  runNumber: number
  finalTick: number
  data: {
    config: SimulationConfig
    agents: Record<number, { profile: AgentProfile; state: AgentState }>
    groups: Record<string, GroupProfile>
    logs: LogLine[]
    events: TimelineEvent[]
    feed: FeedPost[]
    interventions: InterventionRecord[]
  }
}

export type SimulationState = {
  config: SimulationConfig
  tick: number
  isRunning: boolean
  speed: number
  selectedAgentId: number | null
  agents: Record<number, { profile: AgentProfile; state: AgentState }>
  groups: Record<string, GroupProfile>
  logs: LogLine[]
  events: TimelineEvent[]
  feed: FeedPost[]
  interventions: InterventionRecord[]
  snapshots: SimulationSnapshot[]
  currentSnapshotId: string | null
}
