import type { AgentState, SimulationState, TimelineEvent } from './types'
import { makeAgentProfile, makeGroupProfiles, twitterPersonaToAgentProfile, getTwitterPersonaIds } from './persona'
import { clamp, hash01, id } from './util'

const USE_REAL_API = import.meta.env.VITE_USE_REAL_API === 'true'

export type Action =
  | { type: 'toggle_run' }
  | { type: 'set_running'; isRunning: boolean }
  | { type: 'set_speed'; speed: number }
  | { type: 'set_tick'; tick: number }
  | { type: 'set_selected_agent'; agentId: number | null }
  | { type: 'push_log'; level: 'info' | 'ok' | 'error'; tick: number; agentId?: number; text: string }
  | { type: 'push_event'; event: TimelineEvent }
  | {
      type: 'push_feed'
      tick: number
      authorId: number
      content: string
      emotion: number
      authorName?: string
      likes?: number
      postId?: string
    }
  | { type: 'apply_intervention'; tick: number; command: string; targetAgentId?: number }
  | { type: 'set_config'; patch: Partial<SimulationState['config']> }
  | { type: 'mutate_agent_state'; agentId: number; patch: Partial<AgentState> }
  | { type: 'regenerate_personas' }
  | { type: 'create_snapshot' }
  | { type: 'load_snapshot'; snapshotId: string }
  | { type: 'delete_snapshot'; snapshotId: string }
  | { type: 'clear_snapshots' }
  | { type: 'push_system_log'; log: SimulationState['systemLogs'][number] }
  | { type: 'set_system_logs'; logs: SimulationState['systemLogs'] }

const MAX_LOGS = 4000
const MAX_EVENTS = 2500
const MAX_FEED = 2000
const MAX_INTERVENTIONS = 120
const MAX_SYSTEM_LOGS = 500

function makeEvidence(agentId: number, tick: number) {
  const mem = Array.from({ length: 4 }).map((_, i) => {
    const score = clamp(0.55 + hash01(agentId * 31 + tick * 7 + i) * 0.42, 0, 1)
    return {
      id: id('mem'),
      score,
      text: `memory_hit_${i}: “在 tick ${Math.max(0, tick - 20 - i * 7)} 发生的事件片段…（mock）”`,
    }
  })
  const toolCalls = [
    { id: id('tool'), name: 'retrieve_memory', status: 'ok' as const, latencyMs: 45 + Math.floor(hash01(agentId * 7 + tick) * 80) },
    { id: id('tool'), name: 'rank_options', status: 'ok' as const, latencyMs: 30 + Math.floor(hash01(agentId * 9 + tick) * 60) },
    {
      id: id('tool'),
      name: 'call_world_api',
      status: hash01(agentId * 13 + tick) > 0.93 ? ('error' as const) : ('ok' as const),
      latencyMs: 60 + Math.floor(hash01(agentId * 11 + tick) * 220),
    },
  ]

  const reasoningSummary =
    `目标：提高自身资源与社交连结；约束：保持立场一致；` +
    `候选：发帖/私信/加入群体讨论；` +
    `选择：基于记忆命中与当前情绪的折中（mock）。`

  return { memoryHits: mem, toolCalls, reasoningSummary }
}

export function initialState(): SimulationState {
  const seed = 20260121
  const agentCount = 30 // Only 30 Twitter personas from JSON data
  const groups = makeGroupProfiles(seed)
  const initialAgents: SimulationState['agents'] = {}

  // Use ONLY Twitter personas (30 agents total, IDs 1-30)
  const twitterIds = getTwitterPersonaIds()
  for (const twitterId of twitterIds) {
    const groupKey = `Group ${String.fromCharCode(65 + (twitterId % 5))}` // Group A-E based on ID
    initialAgents[twitterId] = {
      profile: twitterPersonaToAgentProfile(twitterId, groupKey),
      state: {
        mood: clamp(hash01(seed + twitterId * 3) * 2 - 1, -1, 1),
        stance: clamp(hash01(seed + twitterId * 5) * 2 - 1, -1, 1),
        resources: 100 + Math.floor(hash01(seed + twitterId * 9) * 900),
        lastAction: 'idle',
        evidence: makeEvidence(twitterId, 0),
      },
    }
  }

  return {
    config: {
      seed,
      agentCount,
      worldSize: 3000, // Smaller world for 30 agents
      ticksPerSecond: 10,
      sampleAgents: 30, // Sample all 30 agents
      viewportMode: 'micro',
      scenarioText:
        '场景：基于真实 Twitter 用户画像的社交模拟。使用 30 个真实提取的 Twitter personas（包含身份、心理测量、行为特征等）。智能体会在空间中移动，并在 Feed 中发布/互动。你可以暂停并注入事件或修改智能体状态。',
      experimentName: 'Twitter Personas Simulation',
      designReady: false,
      llmEnabled: true,
      llmProvider: 'deepseek',
      llmModel: 'deepseek-chat',
      llmBaseUrl: 'https://api.deepseek.com/v1',
      llmApiKey: 'sk-5c79877413f346ceb7d4fdbf6daed4e6',
      llmTemperature: 0.7,
      llmMaxTokens: 512,
      llmTopP: 1,
      llmActiveAgents: 3,
      llmTimeoutMs: 30000,
      llmMaxRetries: 1,
      llmRetryBackoffMs: 300,
      llmMaxActionsPerMinute: 240,
      llmFallbackOnError: true,
    },
    tick: 0,
    isRunning: true,
    speed: 1,
    selectedAgentId: 1, // Start with first Twitter persona (LeafChronicle)
    agents: initialAgents,
    groups,
    logs: [
      {
        id: id('log'),
        tick: 0,
        level: 'info',
        agentId: 1,
        text: 'agent_1 (@LeafChronicle): bootstrapping… (Twitter persona loaded)',
      },
    ],
    events: [
      // Bookmarks 书签
      { id: id('evt'), tick: 0, type: 'bookmark', title: 'Simulation started 模拟开始', payload: { seed } },
      { id: id('evt'), tick: 120, type: 'bookmark', title: 'First wave adoption 首波采用', payload: { note: '首批智能体开始使用平台' } },
      { id: id('evt'), tick: 450, type: 'bookmark', title: 'Controversy begins 争议开始', payload: { note: '第一个热门争议话题出现' } },
      { id: id('evt'), tick: 890, type: 'bookmark', title: 'Peak activity 活动高峰', payload: { note: '平台活跃度达到峰值' } },

      // Agent Actions 智能体行为 (using Twitter persona IDs)
      { id: id('evt'), tick: 5, type: 'agent_action', agentId: 1, title: '@LeafChronicle: Published BLM post 发布BLM帖子', payload: { topic: 'BLM', reach: 45 } },
      { id: id('evt'), tick: 8, type: 'agent_action', agentId: 2, title: '@MikkiChandler: Shared MeToo article 分享MeToo文章', payload: { shares: 12 } },
      { id: id('evt'), tick: 12, type: 'agent_action', agentId: 3, title: '@RuthanneSanch12: Posted impeachment support 发表弹劾支持', payload: { topic: 'impeach', reach: 89 } },
      { id: id('evt'), tick: 18, type: 'agent_action', agentId: 4, title: '@ea_fuzz: Supported law enforcement 支持执法', payload: { topic: 'police_support' } },
      { id: id('evt'), tick: 25, type: 'agent_action', agentId: 5, title: '@amygamie: Organized rally 组织集会', payload: { topic: 'racial_justice', participants: 45 } },
      { id: id('evt'), tick: 32, type: 'agent_action', agentId: 6, title: '@JSunNews: Published news story 发布新闻报道', payload: { topic: 'BLM', reach: 156 } },
      { id: id('evt'), tick: 45, type: 'agent_action', agentId: 7, title: '@AndreaT2303: Posted environmental advocacy 发表环保倡导', payload: { topic: 'environment' } },
      { id: id('evt'), tick: 52, type: 'agent_action', agentId: 11, title: '@SSHobbs: Posted anti-Trump content 发表反特朗普内容', payload: { topic: 'politics' } },
      { id: id('evt'), tick: 68, type: 'agent_action', agentId: 12, title: '@PPact: Shared HIV prevention info 分享HIV预防信息', payload: { topic: 'health', reach: 78 } },
      { id: id('evt'), tick: 85, type: 'agent_action', agentId: 14, title: '@TeresaPauley2: Led protest campaign 领导抗议活动', payload: { topic: 'impeachment', participants: 120 } },
      { id: id('evt'), tick: 110, type: 'agent_action', agentId: 17, title: '@RecoveryRat: Defended police 辩护警方', payload: { topic: 'law_enforcement' } },
      { id: id('evt'), tick: 135, type: 'agent_action', agentId: 18, title: '@QueenSadie88: Community safety event 社区安全活动', payload: { topic: 'public_safety', attendance: 34 } },
      { id: id('evt'), tick: 180, type: 'agent_action', agentId: 20, title: '@LouisShortXIV: Mobilized resistance 动员抵抗', payload: { topic: 'resistance', reach: 230 } },
      { id: id('evt'), tick: 220, type: 'agent_action', agentId: 22, title: '@Heather_11_16: Cross-group dialogue 跨群体对话', payload: { groups: ['racial_justice', 'public_health'] } },
      { id: id('evt'), tick: 280, type: 'agent_action', agentId: 23, title: '@LouisvilleB2012: Local community initiative 本地社区倡议', payload: { topic: 'community' } },
      { id: id('evt'), tick: 350, type: 'agent_action', agentId: 26, title: '@AsianSocialNet: Educational resource 教育资源', payload: { topic: 'social_justice' } },
      { id: id('evt'), tick: 450, type: 'agent_action', agentId: 28, title: '@UUColumbia: Civic engagement event 公民参与活动', payload: { topic: 'community_engagement' } },
      { id: id('evt'), tick: 580, type: 'agent_action', agentId: 29, title: '@Karenrosegt: Health outreach 健康外展', payload: { topic: 'HIV_prevention', reach: 95 } },
      { id: id('evt'), tick: 720, type: 'agent_action', agentId: 3, title: '@RuthanneSanch12: Consolidated following 巩固影响力', payload: { followers: 450 } },
      { id: id('evt'), tick: 890, type: 'agent_action', agentId: 5, title: '@amygamie: Network expansion 网络扩展', payload: { newConnections: 67 } },

      // Messages 消息 (Twitter personas content)
      { id: id('evt'), tick: 3, type: 'message', agentId: 1, title: '@LeafChronicle: "Black Lives Matter. Justice for all." #BLM', payload: { channel: 'public' } },
      { id: id('evt'), tick: 7, type: 'message', agentId: 2, title: '@MikkiChandler: "MeToo movement matters. Survivors deserve to be heard."', payload: { sentiment: 'supportive' } },
      { id: id('evt'), tick: 15, type: 'message', agentId: 3, title: '@RuthanneSanch12: "Time to impeach. This cannot stand." #Resistance', payload: { link: true } },
      { id: id('evt'), tick: 28, type: 'message', agentId: 4, title: '@ea_fuzz: "Support our law enforcement. They put their lives on the line."', payload: { call: 'support' } },
      { id: id('evt'), tick: 40, type: 'message', agentId: 6, title: '@JSunNews: "Breaking: Community protests continue into second week. Full coverage:"', payload: { type: 'news' } },
      { id: id('evt'), tick: 55, type: 'message', agentId: 12, title: '@PPact: "HIV prevention resources available. Get tested, know your status."', payload: { sentiment: 'informative' } },
      { id: id('evt'), tick: 75, type: 'message', agentId: 17, title: '@RecoveryRat: "Blue Lives Matter too. Police protect our communities."', payload: { type: 'counter_protest' } },
      { id: id('evt'), tick: 95, type: 'message', agentId: 20, title: '@LouisShortXIV: "The resistance grows. Join us:"', payload: { sentiment: 'mobilizing' } },
      { id: id('evt'), tick: 125, type: 'message', agentId: 14, title: '@TeresaPauley2: "We need accountability now. Impeach!"', payload: { type: 'demand' } },
      { id: id('evt'), tick: 165, type: 'message', agentId: 26, title: '@AsianSocialNet: "Education is key to social justice. Resources:"', payload: { sentiment: 'constructive' } },
      { id: id('evt'), tick: 210, type: 'message', agentId: 21, title: '@rbeestweets: "Back the blue. Support our officers." #BlueLivesMatter', payload: { type: 'law_enforcement_support' } },
      { id: id('evt'), tick: 300, type: 'message', agentId: 29, title: '@Karenrosegt: "Black women\'s health matters. PrEP saves lives."', payload: { urgency: 'health' } },
      { id: id('evt'), tick: 420, type: 'message', agentId: 5, title: '@amygamie: "Racial justice IS public health. Cannot separate the two."', payload: { type: 'intersectional' } },
      { id: id('evt'), tick: 560, type: 'message', agentId: 23, title: '@LouisvilleB2012: "Let\'s focus on what brings us together - our community."', payload: { type: 'bridging' } },
      { id: id('evt'), tick: 750, type: 'message', agentId: 11, title: '@SSHobbs: "This administration must answer. #TheResistance"', payload: { type: 'accountability' } },

      // Interventions 干预
      { id: id('evt'), tick: 50, type: 'intervention', title: 'System injected topic boost 系统注入话题提升', payload: { topic: 'civic_engagement', boost: 0.3 } },
      { id: id('evt'), tick: 150, type: 'intervention', title: 'Moderator flagged controversial content 版主标记争议内容', payload: { contentId: 'post_112', action: 'review' } },
      { id: id('evt'), tick: 280, type: 'intervention', agentId: 42, title: 'Admin adjusted agent resources 管理员调整智能体资源', payload: { agentId: 42, delta: 50 } },
      { id: id('evt'), tick: 400, type: 'intervention', title: 'System promoted diverse viewpoints 系统推广多元观点', payload: { algorithm: 'diversity_boost' } },
      { id: id('evt'), tick: 620, type: 'intervention', title: 'Fact-check notification deployed 事实核查通知已部署', payload: { topic: 'policy_claims' } },
      { id: id('evt'), tick: 800, type: 'intervention', agentId: 1, title: 'External event injected: news breakout 外部事件注入：新闻爆发', payload: { event: 'breaking_news' } },

      // Alerts 警告
      { id: id('evt'), tick: 88, type: 'alert', title: 'Polarization spike detected 检测到极化激增', payload: { metric: 'polarization', value: 0.78, threshold: 0.7 } },
      { id: id('evt'), tick: 245, type: 'alert', title: 'Misinformation spread warning 虚假信息传播警告', payload: { reach: 450, velocity: 'high' } },
      { id: id('evt'), tick: 380, type: 'alert', title: 'Network fragmentation risk 网络碎片化风险', payload: { clusters: 8, isolation: 'medium' } },
      { id: id('evt'), tick: 520, type: 'alert', title: 'Cascade initiation detected 检测到级联启动', payload: { source: 'agent_7', depth: 3 } },
      { id: id('evt'), tick: 680, type: 'alert', title: 'Echo chamber intensification 回声室强化', payload: { group: 'political_A', homogeneity: 0.91 } },
      { id: id('evt'), tick: 850, type: 'alert', title: 'Resource exhaustion warning 资源耗尽警告', payload: { agentId: 1, resources: 15 } },
    ],
    feed: [],
    interventions: [],
    snapshots: [],
    currentSnapshotId: null,
    systemLogs: [],
  }
}

function ensureAgent(state: SimulationState, agentId: number): SimulationState {
  if (state.agents[agentId]) return state
  const seed = state.config.seed
  return {
    ...state,
    agents: {
      ...state.agents,
      [agentId]: {
        profile: makeAgentProfile(state.config.seed, agentId, state.groups),
        state: {
          mood: clamp(hash01(seed + agentId * 3) * 2 - 1, -1, 1),
          stance: clamp(hash01(seed + agentId * 5) * 2 - 1, -1, 1),
          resources: 100 + Math.floor(hash01(seed + agentId * 9) * 900),
          lastAction: 'idle',
          evidence: makeEvidence(agentId, state.tick),
        },
      },
    },
  }
}

export function reducer(state: SimulationState, action: Action): SimulationState {
  switch (action.type) {
    case 'toggle_run':
      return { ...state, isRunning: !state.isRunning }
    case 'set_running':
      return { ...state, isRunning: action.isRunning }
    case 'set_speed':
      return { ...state, speed: clamp(action.speed, 0.1, 20) }
    case 'set_tick': {
      const next = clamp(action.tick, 0, 200_000)
      if (USE_REAL_API) {
        // In backend-driven mode, keep stream data intact and only advance tick.
        return { ...state, tick: next }
      }
      const agentId = state.selectedAgentId

      // 根据新的 tick 过滤数据
      const filteredLogs = state.logs.filter(l => l.tick <= next)
      const filteredEvents = state.events.filter(e => e.tick <= next)
      const filteredFeed = state.feed.filter(f => f.tick <= next)
      const filteredInterventions = state.interventions.filter(i => i.tick <= next)

      // 更新 agents 的状态基于新的 tick
      const updatedAgents: SimulationState['agents'] = {}
      for (const [idStr, agent] of Object.entries(state.agents)) {
        const id = Number(idStr)
        const baseMood = clamp(hash01(state.config.seed + id * 3) * 2 - 1, -1, 1)
        const baseStance = clamp(hash01(state.config.seed + id * 5) * 2 - 1, -1, 1)
        const baseResources = 100 + Math.floor(hash01(state.config.seed + id * 9) * 900)

        // 基于 tick 动态计算状态
        const mood = clamp(baseMood + (Math.sin(next / 20 + id) * 0.3), -1, 1)
        const lastAction = mood > 0.4 ? 'celebrate' : mood < -0.4 ? 'complain' : 'observe'

        updatedAgents[id] = {
          ...agent,
          state: {
            ...agent.state,
            mood,
            stance: baseStance,
            resources: baseResources,
            lastAction,
            evidence: makeEvidence(id, next),
          },
        }
      }

      const s2 = { ...state, tick: next }
      if (agentId == null || !s2.agents[agentId]) {
        return {
          ...s2,
          logs: filteredLogs,
          events: filteredEvents,
          feed: filteredFeed,
          interventions: filteredInterventions,
          agents: updatedAgents,
        }
      }

      return {
        ...s2,
        logs: filteredLogs,
        events: filteredEvents,
        feed: filteredFeed,
        interventions: filteredInterventions,
        agents: {
          ...updatedAgents,
          [agentId]: {
            ...updatedAgents[agentId],
            state: { ...updatedAgents[agentId].state, evidence: makeEvidence(agentId, next) },
          },
        },
      }
    }
    case 'set_selected_agent': {
      if (action.agentId == null) return { ...state, selectedAgentId: null }
      const s2 = ensureAgent(state, action.agentId)
      return {
        ...s2,
        selectedAgentId: action.agentId,
        agents: {
          ...s2.agents,
          [action.agentId]: {
            ...s2.agents[action.agentId],
            state: { ...s2.agents[action.agentId].state, evidence: makeEvidence(action.agentId, s2.tick) },
          },
        },
      }
    }
    case 'push_log': {
      const next = [
        ...state.logs,
        { id: id('log'), tick: action.tick, agentId: action.agentId, level: action.level, text: action.text },
      ]
      return { ...state, logs: next.slice(Math.max(0, next.length - MAX_LOGS)) }
    }
    case 'push_event': {
      const next = [...state.events, action.event]
      return { ...state, events: next.slice(Math.max(0, next.length - MAX_EVENTS)) }
    }
    case 'push_feed': {
      const authorId = action.authorId
      const s2 = ensureAgent(state, authorId)
      const authorName = action.authorName ?? s2.agents[authorId].profile.name
      const next = [
        ...s2.feed,
        {
          id: action.postId ?? id('post'),
          tick: action.tick,
          authorId,
          authorName,
          content: action.content,
          emotion: action.emotion,
          likes: action.likes ?? 0,
        },
      ]
      return { ...s2, feed: next.slice(Math.max(0, next.length - MAX_FEED)) }
    }
    case 'apply_intervention': {
      const s2 = action.targetAgentId != null ? ensureAgent(state, action.targetAgentId) : state
      const nextInterventions = [
        ...s2.interventions,
        { id: id('iv'), tick: action.tick, command: action.command, targetAgentId: action.targetAgentId },
      ]
      return {
        ...s2,
        interventions: nextInterventions.slice(Math.max(0, nextInterventions.length - MAX_INTERVENTIONS)),
      }
    }
    case 'set_config': {
      const nextConfig = { ...state.config, ...action.patch }
      if (action.patch.seed != null && action.patch.seed !== state.config.seed) {
        const seed = nextConfig.seed
        const groups = makeGroupProfiles(seed)
        const nextAgents: SimulationState['agents'] = {}
        for (const k of Object.keys(state.agents)) {
          const agentId = Number(k)
          const curr = state.agents[agentId]
          nextAgents[agentId] = { ...curr, profile: makeAgentProfile(seed, agentId, groups) }
        }
        return { ...state, config: nextConfig, groups, agents: nextAgents }
      }
      return { ...state, config: nextConfig }
    }
    case 'mutate_agent_state': {
      const s2 = ensureAgent(state, action.agentId)
      const curr = s2.agents[action.agentId]
      return {
        ...s2,
        agents: {
          ...s2.agents,
          [action.agentId]: {
            ...curr,
            state: { ...curr.state, ...action.patch },
          },
        },
      }
    }
    case 'regenerate_personas': {
      const seed = state.config.seed
      const groups = makeGroupProfiles(seed)
      const nextAgents: SimulationState['agents'] = {}
      for (const k of Object.keys(state.agents)) {
        const agentId = Number(k)
        const curr = state.agents[agentId]
        nextAgents[agentId] = { ...curr, profile: makeAgentProfile(seed, agentId, groups) }
      }
      return { ...state, groups, agents: nextAgents }
    }
    case 'create_snapshot': {
      const runNumber = state.snapshots.length + 1
      const experimentName = state.config.experimentName || `Experiment ${runNumber}`
      const snapshot = {
        id: id('snap'),
        experimentName,
        createdAt: Date.now(),
        runNumber,
        finalTick: state.tick,
        data: {
          config: { ...state.config },
          agents: JSON.parse(JSON.stringify(state.agents)),
          groups: JSON.parse(JSON.stringify(state.groups)),
          logs: [...state.logs],
          events: [...state.events],
          feed: [...state.feed],
          interventions: [...state.interventions],
        },
      }
      return {
        ...state,
        snapshots: [...state.snapshots, snapshot],
        currentSnapshotId: snapshot.id,
      }
    }
    case 'load_snapshot': {
      const snapshot = state.snapshots.find(s => s.id === action.snapshotId)
      if (!snapshot) return state
      return {
        ...state,
        tick: 0,
        isRunning: false,
        config: { ...snapshot.data.config },
        agents: JSON.parse(JSON.stringify(snapshot.data.agents)),
        groups: JSON.parse(JSON.stringify(snapshot.data.groups)),
        logs: [...snapshot.data.logs],
        events: [...snapshot.data.events],
        feed: [...snapshot.data.feed],
        interventions: [...snapshot.data.interventions],
        currentSnapshotId: snapshot.id,
      }
    }
    case 'delete_snapshot': {
      return {
        ...state,
        snapshots: state.snapshots.filter(s => s.id !== action.snapshotId),
        currentSnapshotId: state.currentSnapshotId === action.snapshotId ? null : state.currentSnapshotId,
      }
    }
    case 'clear_snapshots': {
      return { ...state, snapshots: [], currentSnapshotId: null }
    }
    case 'push_system_log': {
      const next = [...state.systemLogs, action.log]
      return { ...state, systemLogs: next.slice(Math.max(0, next.length - MAX_SYSTEM_LOGS)) }
    }
    case 'set_system_logs': {
      return { ...state, systemLogs: action.logs }
    }
    default:
      return state
  }
}
