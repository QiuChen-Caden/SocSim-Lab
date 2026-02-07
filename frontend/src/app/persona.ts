import type {
  AgentProfile,
  GroupProfile,
  Identity,
  Psychometrics,
  SocialStatus,
  BehaviorProfile,
  CognitiveState,
  BigFive,
  MoralFoundations,
  IssueStance,
  CoreAffect,
  AgeBand,
  Gender,
  InfluenceTier,
  EconomicBand,
  DiurnalPattern,
  Sentiment,
  SocialStratum,
} from './types'
import { agentGroup, clamp, hash01 } from './util'

// ============= 常量 Constants =============

const AGE_BANDS: AgeBand[] = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+', 'unknown']
const GENDERS: Gender[] = ['male', 'female', 'unknown']
const DIURNAL_PATTERNS: DiurnalPattern[] = ['morning', 'afternoon', 'evening', 'night', 'unknown']
const SENTIMENTS: Sentiment[] = ['angry', 'calm', 'happy', 'sad', 'fearful', 'surprised']

const COUNTRIES = ['United States', 'USA', 'United Kingdom', 'Canada', 'unknown'] as const
const REGIONS = ['New York', 'California', 'Texas', 'Chicago', 'Louisville, KY', 'Howard County, Maryland', 'unknown'] as const

// 按领域分类的职业 Professions by domain
const PROFESSIONS_BY_DOMAIN: Record<string, string[]> = {
  'social movements': ['activist', 'social_worker', 'community_organizer', 'social activist'],
  'racial justice': ['civil_rights_advocate', 'community_organizer', 'social_worker'],
  'gender equality': ['activist', 'social_worker', 'academia'],
  'politics': ['political_analyst', 'journalist', 'activist', 'community_organizer'],
  'social activism': ['activist', 'community_organizer', 'social_worker'],
  'law enforcement': ['law_enforcement_officer', 'public_safety_officer', 'security'],
  'public safety': ['law_enforcement_officer', 'public_safety_officer'],
  'public health': ['public_health_advocate', 'HIV_prevention_specialist', 'health_advocate'],
  'criminal justice': ['legal_professional', 'law_enforcement_officer', 'social_worker'],
  'journalism': ['journalist', 'reporter', 'news_analyst'],
  'academia': ['professor', 'researcher', 'academic'],
  'business': ['entrepreneur', 'business_owner', 'manager'],
}

// 专业领域 Domains of expertise
const DOMAINS_OF_EXPERTISE = [
  'social movements',
  'racial justice',
  'gender equality',
  'politics',
  'social activism',
  'law enforcement',
  'public safety',
  'public health',
  'HIV prevention',
  'criminal justice',
  'criminal justice',
  'journalism',
  'academia',
  'business',
  'social justice',
  'environment',
  'social_politics',
  'community engagement',
  'education',
  'life',
  'community',
  'social issues',
  'law enforcement support',
  'political commentary',
]

// 议题立场的话题 Topics for issue stances
const TOPICS = [
  'BlackLivesMatter',
  'Black Lives Matter',
  'MeToo',
  'Impeach Trump',
  'ImpeachTrump',
  'Political Resistance',
  'TheResistance',
  'law enforcement and public safety',
  'law enforcement support',
  'StandingRock',
  'politics',
  'HIV prevention',
  'BlackWomen',
  'PrEP',
  'anti-Trump activism',
  'political resistance',
  'BlueLivesMatter',
  'life',
  'business',
  'social justice',
  'unknown',
]

// ============= 工具函数 Utility Functions =============

function rand01(seed: number, salt: number): number {
  return hash01(seed * 131 + salt * 17.3)
}

function pick<T>(arr: readonly T[], t01: number): T {
  return arr[Math.min(arr.length - 1, Math.max(0, Math.floor(t01 * arr.length)))]
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function range01(min: number, max: number, t: number): number {
  return clamp(lerp(min, max, t), 0, 1)
}

// ============= 身份信息生成 Identity Generation =============

function makeIdentity(seed: number, agentId: number, _group: GroupProfile): Identity {
  const t1 = rand01(seed + agentId * 7, 1)
  const t2 = rand01(seed + agentId * 11, 2)

  // 生成用户名（名字和随机组合） Generate username (combination of name and random)
  const firstName = ['Alex', 'Mikki', 'Ruthanne', 'John', 'Amy', 'JSun', 'Andrea', 'Shoman', 'QueenSadie', 'Louis']
  const lastNamePart = ['Chronicle', 'Chandler', 'Sanch', 'Fuzz', 'Gamie', 'News', 'Wright', 'BoBina', 'Rat', 'Short']
  const username = `${pick(firstName, t1)}${pick(lastNamePart, t2)}`

  // 年龄段 Age band
  const age_band = pick(AGE_BANDS, rand01(seed + agentId * 17, 4))

  // 性别 Gender
  const gender = pick(GENDERS, rand01(seed + agentId * 19, 5))

  // 位置 Location
  const country = pick(COUNTRIES, rand01(seed + agentId * 23, 6))
  const region_city = pick(REGIONS, rand01(seed + agentId * 29, 7))

  // 专业领域（1-3个） Domain of expertise (1-3 domains)
  const domainCount = 1 + Math.floor(rand01(seed + agentId * 31, 8) * 3)
  const domain_of_expertise: string[] = []
  for (let i = 0; i < domainCount; i++) {
    const domain = pick(DOMAINS_OF_EXPERTISE, rand01(seed + agentId * 37 + i * 7, 9 + i))
    if (!domain_of_expertise.includes(domain)) {
      domain_of_expertise.push(domain)
    }
  }

  // 基于领域的职业 Profession based on domain
  const primaryDomain = domain_of_expertise[0] || 'community'
  const professionOptions = PROFESSIONS_BY_DOMAIN[primaryDomain] || ['community_member', 'unknown', 'activist']
  const profession = pick(professionOptions, rand01(seed + agentId * 41, 10))

  return {
    username,
    age_band,
    gender,
    location: {
      country,
      region_city,
    },
    profession,
    domain_of_expertise,
  }
}

// ============= 心理测量生成 Psychometrics Generation =============

function makeBigFive(seed: number, agentId: number): BigFive {
  // 基准值约0.5，带变化 Base values around 0.5 with variation
  const base = 0.5
  const variation = 0.2

  return {
    O: clamp(base + (rand01(seed + agentId * 3, 101) - 0.5) * variation * 2, 0, 1),
    C: clamp(base + (rand01(seed + agentId * 5, 103) - 0.5) * variation * 2, 0, 1),
    E: clamp(base + (rand01(seed + agentId * 7, 107) - 0.5) * variation * 2, 0, 1),
    A: clamp(base + (rand01(seed + agentId * 11, 109) - 0.5) * variation * 2, 0, 1),
    N: clamp(base + (rand01(seed + agentId * 13, 113) - 0.5) * variation * 2, 0, 1),
  }
}

function makeMoralFoundations(seed: number, agentId: number, group: GroupProfile): MoralFoundations {
  // 道德基础因群体而异 Moral foundations vary by group somewhat
  const base = 0.5
  const groupBias = group.polarization > 0.5 ? 0.1 : 0

  return {
    care: clamp(base + (rand01(seed + agentId * 17, 201) - 0.5) * 0.3, 0, 1),
    fairness: clamp(base + groupBias + (rand01(seed + agentId * 19, 203) - 0.5) * 0.3, 0, 1),
    loyalty: clamp(base + (rand01(seed + agentId * 23, 207) - 0.5) * 0.3, 0, 1),
    authority: clamp(base + (rand01(seed + agentId * 29, 211) - 0.5) * 0.3, 0, 1),
    sanctity: clamp(base + (rand01(seed + agentId * 31, 217) - 0.5) * 0.3, 0, 1),
  }
}

function makePsychometrics(seed: number, agentId: number, group: GroupProfile): Psychometrics {
  return {
    personality: {
      big_five: makeBigFive(seed, agentId),
    },
    values: {
      moral_foundations: makeMoralFoundations(seed, agentId, group),
    },
  }
}

// ============= 社会地位生成 Social Status Generation =============

function makeSocialStatus(seed: number, agentId: number, _group: GroupProfile): SocialStatus {
  // 基于网络规模代理值的影响力层级 Influence tier based on network size proxy
  const networkSizeProxy = Math.floor(rand01(seed + agentId * 41, 307) * 5)
  let influence_tier: InfluenceTier
  if (networkSizeProxy >= 4) influence_tier = 'elite'
  else if (networkSizeProxy >= 1) influence_tier = 'opinion_leader'
  else influence_tier = 'ordinary_user'

  // 经济水平与影响力有一定相关性 Economic band correlates somewhat with influence
  const economicBandValue = rand01(seed + agentId * 43, 311)
  let economic_band: EconomicBand
  if (economicBandValue > 0.66) economic_band = 'high'
  else if (economicBandValue > 0.33) economic_band = 'medium'
  else economic_band = 'low'

  return {
    influence_tier,
    economic_band,
    social_capital: {
      network_size_proxy: networkSizeProxy,
    },
  }
}

// ============= 行为画像生成 Behavior Profile Generation =============

function makeBehaviorProfile(seed: number, agentId: number): BehaviorProfile {
  // 发帖频率 Posting cadence
  const postsPerDay = rand01(seed + agentId * 47, 401) * 5
  const patternCount = 1 + Math.floor(rand01(seed + agentId * 53, 403) * 3)
  const diurnalPatternSet = new Set<DiurnalPattern>()
  for (let i = 0; i < patternCount; i++) {
    diurnalPatternSet.add(pick(DIURNAL_PATTERNS, rand01(seed + agentId * 59 + i * 11, 407 + i)))
  }

  // 修辞风格 Rhetoric style
  const civility = range01(0.3, 1.0, rand01(seed + agentId * 61, 413))
  const evidenceCitation = range01(0.3, 0.8, rand01(seed + agentId * 67, 419))

  return {
    posting_cadence: {
      posts_per_day: postsPerDay,
      diurnal_pattern: Array.from(diurnalPatternSet),
    },
    rhetoric_style: {
      civility,
      evidence_citation: evidenceCitation,
    },
  }
}

// ============= 认知状态生成 Cognitive State Generation =============

function makeCoreAffect(seed: number, agentId: number): CoreAffect {
  const sentiment = pick(SENTIMENTS, rand01(seed + agentId * 71, 501))
  const arousal = rand01(seed + agentId * 73, 503)

  return {
    sentiment,
    arousal,
  }
}

function makeIssueStances(seed: number, agentId: number, identity: Identity): IssueStance[] {
  const stances: IssueStance[] = []
  const stanceCount = 1 + Math.floor(rand01(seed + agentId * 79, 509) * 3)

  // 基于专业领域生成立场 Generate stances based on domains of expertise
  const availableTopics = TOPICS.filter(t => {
    // 匹配主题与领域 Match topics to domains
    const domain = identity.domain_of_expertise[0] || ''
    if (domain.includes('racial') && t.toLowerCase().includes('black')) return true
    if (domain.includes('politics') && (t.toLowerCase().includes('trump') || t.toLowerCase().includes('political'))) return true
    if (domain.includes('health') && (t.toLowerCase().includes('hiv') || t.toLowerCase().includes('prep'))) return true
    if (domain.includes('law') && t.toLowerCase().includes('law')) return true
    return Math.random() > 0.7
  })

  for (let i = 0; i < stanceCount && i < availableTopics.length; i++) {
    const topic = availableTopics[i]
    const support = clamp((rand01(seed + agentId * 83 + i * 13, 521) * 2 - 1), -1, 1)
    const certainty = rand01(seed + agentId * 89 + i * 17, 523)

    stances.push({ topic, support, certainty })
  }

  return stances
}

function makeCognitiveState(seed: number, agentId: number, identity: Identity): CognitiveState {
  return {
    core_affect: makeCoreAffect(seed, agentId),
    issue_stances: makeIssueStances(seed, agentId, identity),
  }
}

// ============= 群体画像生成 Group Profile Generation =============

function stratumFor(seed: number, groupKey: string): SocialStratum {
  const t = rand01(seed, groupKey.length * 97 + groupKey.charCodeAt(0))
  if (groupKey.endsWith('A')) return t < 0.1 ? 'elite' : t < 0.35 ? 'upper-middle' : t < 0.7 ? 'middle' : t < 0.92 ? 'working' : 'precarious'
  if (groupKey.endsWith('E')) return t < 0.04 ? 'elite' : t < 0.18 ? 'upper-middle' : t < 0.48 ? 'middle' : t < 0.82 ? 'working' : 'precarious'
  return t < 0.06 ? 'elite' : t < 0.26 ? 'upper-middle' : t < 0.6 ? 'middle' : t < 0.88 ? 'working' : 'precarious'
}

export function makeGroupProfiles(seed: number): Record<string, GroupProfile> {
  const keys = ['Group A', 'Group B', 'Group C', 'Group D', 'Group E']
  const labels = ['Civic Elite 公共精英', 'Urban Middle 城市中产', 'Local Communities 本地社群', 'Industrial Workers 产业工薪', 'Precarious Fringe 边缘群体']
  const out: Record<string, GroupProfile> = {}

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    const base = rand01(seed, i * 101 + 13)
    const cohesion = range01(0.25, 0.9, rand01(seed, i * 101 + 21))
    const polarization = range01(0.15, 0.85, rand01(seed, i * 101 + 31))
    const trustClimate = range01(0.2, 0.85, rand01(seed, i * 101 + 41))
    const dominantStratum = stratumFor(seed + i * 7, key)

    const norm = base > 0.66 ? '重视秩序与效率' : base > 0.33 ? '重视协作与稳定' : '重视生存与互助'
    out[key] = {
      key,
      label: labels[i],
      dominantStratum,
      cohesion,
      polarization,
      trustClimate,
      normSummary: `${norm}；群体凝聚=${cohesion.toFixed(2)}，极化=${polarization.toFixed(2)}（mock）`,
    }
  }

  return out
}

// ============= 主画像生成函数 Main Profile Generation Function =============

export function makeAgentProfile(seed: number, agentId: number, groups: Record<string, GroupProfile>): AgentProfile {
  const groupKey = agentGroup(agentId)
  const group = groups[groupKey] ?? {
    key: groupKey,
    label: groupKey,
    dominantStratum: 'middle',
    cohesion: 0.5,
    polarization: 0.5,
    trustClimate: 0.5,
    normSummary: 'n/a',
  }

  // 生成所有组件 Generate all components
  const identity = makeIdentity(seed, agentId, group)
  const psychometrics = makePsychometrics(seed, agentId, group)
  const social_status = makeSocialStatus(seed, agentId, group)
  const behavior_profile = makeBehaviorProfile(seed, agentId)
  const cognitive_state = makeCognitiveState(seed, agentId, identity)

  return {
    id: agentId,
    name: identity.username, // 使用身份中的用户名 Use username from identity
    group: groupKey,
    identity,
    psychometrics,
    social_status,
    behavior_profile,
    cognitive_state,
  }
}

// ============= Twitter Personas 数据（来自 JSON 的真实数据） Twitter Personas Data (Real Data from JSON) =============

// 从 twitter_personas_20260123_222506.json 中提取的原始 Twitter personas 数据 Raw Twitter personas data extracted from twitter_personas_20260123_222506.json
const TWITTER_PERSONAS_DATA = {
  "user_988804598394707968": {
    username: "LeafChronicle",
    age_band: "25-34",
    gender: "unknown",
    location: { country: "United States", region_city: "unknown" },
    profession: "unknown",
    domain_of_expertise: ["social movements", "racial justice"],
    big_five: { O: 0.5, C: 0.5, E: 0.5, A: 0.5, N: 0.5 },
    moral_foundations: { care: 0.5, fairness: 0.727, loyalty: 0.5, authority: 0.5, sanctity: 0.5 },
    influence_tier: "ordinary_user",
    economic_band: "unknown",
    network_size_proxy: 0,
    posts_per_day: 0.0,
    diurnal_pattern: ["evening"],
    civility: 1.0,
    evidence_citation: 0.5,
    sentiment: "angry",
    arousal: 0.0,
    issue_stances: [{ topic: "BlackLivesMatter", support: 1.0, certainty: 0.5 }]
  },
  "user_2678618421": {
    username: "MikkiChandler",
    age_band: "25-34",
    gender: "female",
    location: { country: "USA", region_city: "unknown" },
    profession: "activist|social_worker|academia",
    domain_of_expertise: ["social movements", "racial justice", "gender equality"],
    big_five: { O: 0.5, C: 0.5, E: 0.639, A: 0.5, N: 0.5 },
    moral_foundations: { care: 0.5, fairness: 0.5, loyalty: 0.5, authority: 0.5, sanctity: 0.5 },
    influence_tier: "ordinary_user",
    economic_band: "unknown",
    network_size_proxy: 1,
    posts_per_day: 0.0001,
    diurnal_pattern: ["evening"],
    civility: 1.0,
    evidence_citation: 0.5,
    sentiment: "angry",
    arousal: 0.0,
    issue_stances: [
      { topic: "MeToo", support: 1.0, certainty: 0.5 },
      { topic: "BlackLivesMatter", support: 1.0, certainty: 0.5 }
    ]
  },
  "user_1161405967260704768": {
    username: "RuthanneSanch12",
    age_band: "25-34",
    gender: "female",
    location: { country: "United States", region_city: "unknown" },
    profession: "unknown",
    domain_of_expertise: ["politics", "social activism"],
    big_five: { O: 0.5, C: 0.5, E: 0.67, A: 0.5, N: 0.5 },
    moral_foundations: { care: 0.5, fairness: 0.5, loyalty: 0.5, authority: 0.5, sanctity: 0.5 },
    influence_tier: "opinion_leader",
    economic_band: "unknown",
    network_size_proxy: 4,
    posts_per_day: 0.0,
    diurnal_pattern: ["evening"],
    civility: 1.0,
    evidence_citation: 0.5,
    sentiment: "angry",
    arousal: 0.0,
    issue_stances: [
      { topic: "Impeach Trump", support: 1.0, certainty: 1.0 },
      { topic: "Political Resistance", support: 1.0, certainty: 0.9 }
    ]
  },
  "user_1993384785318916096": {
    username: "ea_fuzz",
    age_band: "25-34",
    gender: "unknown",
    location: { country: "USA", region_city: "unknown" },
    profession: "unknown",
    domain_of_expertise: ["law enforcement", "public safety"],
    big_five: { O: 0.5, C: 0.609, E: 0.5, A: 0.5, N: 0.5 },
    moral_foundations: { care: 0.5, fairness: 0.5, loyalty: 0.5, authority: 0.609, sanctity: 0.5 },
    influence_tier: "opinion_leader",
    economic_band: "unknown",
    network_size_proxy: 1,
    posts_per_day: 0.0,
    diurnal_pattern: ["evening"],
    civility: 1.0,
    evidence_citation: 0.5,
    sentiment: "angry",
    arousal: 0.0,
    issue_stances: [{ topic: "law enforcement and public safety", support: 0.7, certainty: 0.5 }]
  },
  "user_1081299991870795776": {
    username: "amygamie",
    age_band: "25-34",
    gender: "female",
    location: { country: "United States", region_city: "unknown" },
    profession: "social activist or community organizer",
    domain_of_expertise: ["social movements", "racial justice"],
    big_five: { O: 0.5, C: 0.5, E: 0.5, A: 0.5, N: 0.5 },
    moral_foundations: { care: 0.5, fairness: 0.5, loyalty: 0.5, authority: 0.5, sanctity: 0.5 },
    influence_tier: "opinion_leader",
    economic_band: "unknown",
    network_size_proxy: 1,
    posts_per_day: 0.0,
    diurnal_pattern: ["evening"],
    civility: 1.0,
    evidence_citation: 0.5,
    sentiment: "angry",
    arousal: 0.0,
    issue_stances: [{ topic: "Black Lives Matter", support: 1.0, certainty: 0.5 }]
  },
  "user_989622987883253760": {
    username: "JSunNews",
    age_band: "25-34",
    gender: "unknown",
    location: { country: "United States", region_city: "unknown" },
    profession: "journalist|social activist",
    domain_of_expertise: ["social movements", "criminal justice", "racial equality"],
    big_five: { O: 0.5, C: 0.5, E: 0.5, A: 0.5, N: 0.5 },
    moral_foundations: { care: 0.5, fairness: 0.727, loyalty: 0.5, authority: 0.5, sanctity: 0.5 },
    influence_tier: "ordinary_user",
    economic_band: "unknown",
    network_size_proxy: 0,
    posts_per_day: 0.0,
    diurnal_pattern: ["evening"],
    civility: 1.0,
    evidence_citation: 0.5,
    sentiment: "angry",
    arousal: 0.0,
    issue_stances: [{ topic: "Black Lives Matter", support: 1.0, certainty: 1.0 }]
  },
  "user_1631200173912211456": {
    username: "AndreaT2303",
    age_band: "25-34",
    gender: "female",
    location: { country: "USA", region_city: "unknown" },
    profession: "activist|political_analyst|journalist",
    domain_of_expertise: ["politics", "social_justice", "environment"],
    big_five: { O: 0.5, C: 0.5, E: 0.56, A: 0.5, N: 0.5 },
    moral_foundations: { care: 0.5, fairness: 0.5, loyalty: 0.5, authority: 0.5, sanctity: 0.5 },
    influence_tier: "ordinary_user",
    economic_band: "unknown",
    network_size_proxy: 0,
    posts_per_day: 0.0,
    diurnal_pattern: ["evening"],
    civility: 1.0,
    evidence_citation: 0.5,
    sentiment: "angry",
    arousal: 0.025,
    issue_stances: [
      { topic: "StandingRock", support: 0.8, certainty: 0.5 },
      { topic: "BlackLivesMatter", support: 0.8, certainty: 0.5 },
      { topic: "politics", support: 0.7, certainty: 0.5 }
    ]
  },
  "user_541395242528677888": {
    username: "ShomanWright",
    age_band: "25-34",
    gender: "unknown",
    location: { country: "United States", region_city: "unknown" },
    profession: "unknown",
    domain_of_expertise: ["social movements", "racial justice"],
    big_five: { O: 0.5, C: 0.5, E: 0.5, A: 0.5, N: 0.5 },
    moral_foundations: { care: 0.5, fairness: 0.5, loyalty: 0.5, authority: 0.5, sanctity: 0.5 },
    influence_tier: "ordinary_user",
    economic_band: "unknown",
    network_size_proxy: 0,
    posts_per_day: 0.0,
    diurnal_pattern: ["evening"],
    civility: 1.0,
    evidence_citation: 0.5,
    sentiment: "angry",
    arousal: 0.0,
    issue_stances: [{ topic: "Black Lives Matter", support: 1.0, certainty: 1.0 }]
  },
  "user_801543963865993224": {
    username: "blacklivesbot",
    age_band: "unknown",
    gender: "unknown",
    location: { country: "unknown", region_city: "unknown" },
    profession: "unknown",
    domain_of_expertise: ["social movements", "racial justice"],
    big_five: { O: 0.5, C: 0.5, E: 0.5, A: 0.5, N: 0.5 },
    moral_foundations: { care: 0.5, fairness: 0.5, loyalty: 0.5, authority: 0.5, sanctity: 0.5 },
    influence_tier: "ordinary_user",
    economic_band: "unknown",
    network_size_proxy: 0,
    posts_per_day: 0.0,
    diurnal_pattern: ["evening"],
    civility: 1.0,
    evidence_citation: 0.5,
    sentiment: "angry",
    arousal: 0.0,
    issue_stances: [{ topic: "blacklivesmatter", support: 1.0, certainty: 0.5 }]
  },
  "user_924727227534544896": {
    username: "mikasparkle",
    age_band: "25-34",
    gender: "female",
    location: { country: "United States", region_city: "unknown" },
    profession: "unknown",
    domain_of_expertise: ["social issues", "law enforcement support"],
    big_five: { O: 0.5, C: 0.5, E: 0.5, A: 0.5, N: 0.5 },
    moral_foundations: { care: 0.5, fairness: 0.5, loyalty: 0.5, authority: 0.5, sanctity: 0.5 },
    influence_tier: "opinion_leader",
    economic_band: "unknown",
    network_size_proxy: 2,
    posts_per_day: 0.0,
    diurnal_pattern: ["evening"],
    civility: 1.0,
    evidence_citation: 0.5,
    sentiment: "angry",
    arousal: 0.0,
    issue_stances: [{ topic: "law enforcement support", support: 1.0, certainty: 0.8 }]
  },
  "user_1978226467570941953": {
    username: "SSHobbs",
    age_band: "25-34",
    gender: "unknown",
    location: { country: "USA", region_city: "unknown" },
    profession: "unknown",
    domain_of_expertise: ["politics", "social activism"],
    big_five: { O: 0.5, C: 0.5, E: 0.647, A: 0.5, N: 0.5 },
    moral_foundations: { care: 0.5, fairness: 0.5, loyalty: 0.5, authority: 0.5, sanctity: 0.5 },
    influence_tier: "opinion_leader",
    economic_band: "unknown",
    network_size_proxy: 2,
    posts_per_day: 0.0001,
    diurnal_pattern: ["evening"],
    civility: 1.0,
    evidence_citation: 0.5,
    sentiment: "angry",
    arousal: 0.0,
    issue_stances: [
      { topic: "anti-Trump activism", support: 1.0, certainty: 0.8 },
      { topic: "political resistance", support: 1.0, certainty: 0.8 }
    ]
  },
  "user_1200083856239611904": {
    username: "PPact",
    age_band: "25-34",
    gender: "unknown",
    location: { country: "United States", region_city: "unknown" },
    profession: "public health advocate / HIV prevention specialist",
    domain_of_expertise: ["public health", "HIV prevention", "community outreach"],
    big_five: { O: 0.5, C: 0.5, E: 0.5, A: 0.5, N: 0.5 },
    moral_foundations: { care: 0.5, fairness: 0.5, loyalty: 0.5, authority: 0.5, sanctity: 0.5 },
    influence_tier: "opinion_leader",
    economic_band: "unknown",
    network_size_proxy: 1,
    posts_per_day: 0.0,
    diurnal_pattern: ["evening"],
    civility: 1.0,
    evidence_citation: 0.5,
    sentiment: "angry",
    arousal: 0.0,
    issue_stances: [
      { topic: "HIV prevention", support: 1.0, certainty: 1.0 },
      { topic: "Black women's health", support: 1.0, certainty: 1.0 }
    ]
  },
  "user_59870241": {
    username: "Hedytf",
    age_band: "25-34",
    gender: "female",
    location: { country: "unknown", region_city: "unknown" },
    profession: "health advocate/activist",
    domain_of_expertise: ["public health", "HIV prevention", "social activism"],
    big_five: { O: 0.5, C: 0.5, E: 0.5, A: 0.5, N: 0.5 },
    moral_foundations: { care: 0.5, fairness: 0.5, loyalty: 0.5, authority: 0.5, sanctity: 0.5 },
    influence_tier: "opinion_leader",
    economic_band: "unknown",
    network_size_proxy: 1,
    posts_per_day: 0.0,
    diurnal_pattern: ["evening"],
    civility: 1.0,
    evidence_citation: 0.5,
    sentiment: "angry",
    arousal: 0.0,
    issue_stances: [
      { topic: "BlackWomen", support: 1.0, certainty: 1.0 },
      { topic: "PrEP", support: 1.0, certainty: 1.0 },
      { topic: "HIV prevention", support: 1.0, certainty: 1.0 }
    ]
  },
  "user_992253830996754434": {
    username: "TeresaPauley2",
    age_band: "25-34",
    gender: "female",
    location: { country: "United States", region_city: "unknown" },
    profession: "unknown",
    domain_of_expertise: ["politics", "social activism"],
    big_five: { O: 0.5, C: 0.5, E: 0.67, A: 0.5, N: 0.5 },
    moral_foundations: { care: 0.5, fairness: 0.5, loyalty: 0.5, authority: 0.5, sanctity: 0.5 },
    influence_tier: "opinion_leader",
    economic_band: "unknown",
    network_size_proxy: 4,
    posts_per_day: 0.0,
    diurnal_pattern: ["evening"],
    civility: 1.0,
    evidence_citation: 0.5,
    sentiment: "angry",
    arousal: 0.0,
    issue_stances: [
      { topic: "Impeach Trump", support: 1.0, certainty: 1.0 },
      { topic: "Political Resistance", support: 1.0, certainty: 1.0 }
    ]
  },
  "user_1607858056951382016": {
    username: "GinaGinaBoBina_",
    age_band: "unknown",
    gender: "unknown",
    location: { country: "unknown", region_city: "unknown" },
    profession: "unknown",
    domain_of_expertise: [],
    big_five: { O: 0.5, C: 0.5, E: 0.5, A: 0.5, N: 0.5 },
    moral_foundations: { care: 0.5, fairness: 0.5, loyalty: 0.5, authority: 0.5, sanctity: 0.5 },
    influence_tier: "ordinary_user",
    economic_band: "unknown",
    network_size_proxy: 2,
    posts_per_day: 0.0,
    diurnal_pattern: ["evening"],
    civility: 1.0,
    evidence_citation: 0.5,
    sentiment: "angry",
    arousal: 0.048,
    issue_stances: [{ topic: "unknown", support: 0.5, certainty: 0.5 }]
  },
  "user_1113553199401709574": {
    username: "zylon9",
    age_band: "25-34",
    gender: "unknown",
    location: { country: "unknown", region_city: "unknown" },
    profession: "unknown",
    domain_of_expertise: ["politics"],
    big_five: { O: 0.5, C: 0.5, E: 0.61, A: 0.5, N: 0.5 },
    moral_foundations: { care: 0.5, fairness: 0.5, loyalty: 0.5, authority: 0.5, sanctity: 0.5 },
    influence_tier: "ordinary_user",
    economic_band: "unknown",
    network_size_proxy: 1,
    posts_per_day: 0.0,
    diurnal_pattern: ["evening"],
    civility: 1.0,
    evidence_citation: 0.5,
    sentiment: "angry",
    arousal: 0.043,
    issue_stances: [{ topic: "politics", support: 0.522, certainty: 0.5 }]
  },
  "user_1348955111423410176": {
    username: "RecoveryRat",
    age_band: "25-34",
    gender: "male",
    location: { country: "United States", region_city: "unknown" },
    profession: "unknown",
    domain_of_expertise: ["law enforcement support", "political commentary"],
    big_five: { O: 0.5, C: 0.5, E: 0.5, A: 0.5, N: 0.5 },
    moral_foundations: { care: 0.5, fairness: 0.5, loyalty: 0.5, authority: 0.5, sanctity: 0.5 },
    influence_tier: "ordinary_user",
    economic_band: "unknown",
    network_size_proxy: 0,
    posts_per_day: 0.0,
    diurnal_pattern: ["evening"],
    civility: 1.0,
    evidence_citation: 0.5,
    sentiment: "angry",
    arousal: 0.0,
    issue_stances: [
      { topic: "law enforcement support", support: 1.0, certainty: 1.0 },
      { topic: "criminal justice", support: 0.8, certainty: 0.8 }
    ]
  },
  "user_1667627457669627907": {
    username: "QueenSadie88",
    age_band: "25-34",
    gender: "female",
    location: { country: "United States", region_city: "Chicago" },
    profession: "unknown",
    domain_of_expertise: ["law enforcement support", "community awareness"],
    big_five: { O: 0.5, C: 0.609, E: 0.5, A: 0.5, N: 0.5 },
    moral_foundations: { care: 0.5, fairness: 0.5, loyalty: 0.5, authority: 0.609, sanctity: 0.5 },
    influence_tier: "opinion_leader",
    economic_band: "unknown",
    network_size_proxy: 1,
    posts_per_day: 0.0,
    diurnal_pattern: ["evening"],
    civility: 1.0,
    evidence_citation: 0.5,
    sentiment: "angry",
    arousal: 0.0,
    issue_stances: [{ topic: "law enforcement and public safety", support: 0.8, certainty: 0.5 }]
  },
  "user_1154541615559643136": {
    username: "eenkblot",
    age_band: "25-34",
    gender: "unknown",
    location: { country: "unknown", region_city: "unknown" },
    profession: "unknown",
    domain_of_expertise: ["social movements", "social justice"],
    big_five: { O: 0.5, C: 0.5, E: 0.5, A: 0.5, N: 0.5 },
    moral_foundations: { care: 0.5, fairness: 0.5, loyalty: 0.5, authority: 0.5, sanctity: 0.5 },
    influence_tier: "ordinary_user",
    economic_band: "unknown",
    network_size_proxy: 1,
    posts_per_day: 0.0,
    diurnal_pattern: ["evening"],
    civility: 1.0,
    evidence_citation: 0.5,
    sentiment: "angry",
    arousal: 0.0,
    issue_stances: [{ topic: "BlackLivesMatter", support: 1.0, certainty: 0.5 }]
  },
  "user_1854314878980218885": {
    username: "LouisShortXIV",
    age_band: "25-34",
    gender: "male",
    location: { country: "United States", region_city: "unknown" },
    profession: "unknown",
    domain_of_expertise: ["politics", "social activism"],
    big_five: { O: 0.5, C: 0.5, E: 0.667, A: 0.5, N: 0.5 },
    moral_foundations: { care: 0.5, fairness: 0.5, loyalty: 0.5, authority: 0.5, sanctity: 0.5 },
    influence_tier: "opinion_leader",
    economic_band: "unknown",
    network_size_proxy: 4,
    posts_per_day: 0.0,
    diurnal_pattern: ["evening"],
    civility: 1.0,
    evidence_citation: 0.5,
    sentiment: "angry",
    arousal: 0.0,
    issue_stances: [
      { topic: "ImpeachTrump", support: 1.0, certainty: 1.0 },
      { topic: "TheResistance", support: 1.0, certainty: 1.0 }
    ]
  },
  "user_1896294378013855746": {
    username: "rbeestweets",
    age_band: "unknown",
    gender: "unknown",
    location: { country: "unknown", region_city: "unknown" },
    profession: "unknown",
    domain_of_expertise: ["social_politics"],
    big_five: { O: 0.5, C: 0.5, E: 0.5, A: 0.5, N: 0.5 },
    moral_foundations: { care: 0.5, fairness: 0.5, loyalty: 0.5, authority: 0.5, sanctity: 0.5 },
    influence_tier: "ordinary_user",
    economic_band: "unknown",
    network_size_proxy: 0,
    posts_per_day: 0.0,
    diurnal_pattern: ["evening"],
    civility: 1.0,
    evidence_citation: 0.5,
    sentiment: "angry",
    arousal: 0.0,
    issue_stances: [{ topic: "BlueLivesMatter", support: 1.0, certainty: 1.0 }]
  },
  "user_839425326316843010": {
    username: "Heather_11_16",
    age_band: "25-34",
    gender: "female",
    location: { country: "USA", region_city: "unknown" },
    profession: "activist|social_worker|community_organizer",
    domain_of_expertise: ["social movements", "racial justice"],
    big_five: { O: 0.5, C: 0.5, E: 0.5, A: 0.5, N: 0.5 },
    moral_foundations: { care: 0.5, fairness: 0.5, loyalty: 0.5, authority: 0.5, sanctity: 0.5 },
    influence_tier: "opinion_leader",
    economic_band: "unknown",
    network_size_proxy: 1,
    posts_per_day: 0.0,
    diurnal_pattern: ["evening"],
    civility: 1.0,
    evidence_citation: 0.5,
    sentiment: "angry",
    arousal: 0.0,
    issue_stances: [{ topic: "BlackLivesMatter", support: 1.0, certainty: 0.5 }]
  },
  "user_917246673385963520": {
    username: "LouisvilleB2012",
    age_band: "45-54",
    gender: "male",
    location: { country: "United States", region_city: "Louisville, KY" },
    profession: "unknown",
    domain_of_expertise: ["life", "community"],
    big_five: { O: 0.5, C: 0.5, E: 0.5, A: 0.5, N: 0.5 },
    moral_foundations: { care: 0.5, fairness: 0.5, loyalty: 0.5, authority: 0.5, sanctity: 0.5 },
    influence_tier: "opinion_leader",
    economic_band: "unknown",
    network_size_proxy: 1,
    posts_per_day: 0.0,
    diurnal_pattern: ["evening"],
    civility: 1.0,
    evidence_citation: 0.5,
    sentiment: "angry",
    arousal: 0.0,
    issue_stances: [{ topic: "life", support: 0.5, certainty: 0.5 }]
  },
  "user_a7383357": {
    username: "MaizieK",
    age_band: "25-34",
    gender: "unknown",
    location: { country: "USA", region_city: "unknown" },
    profession: "social activist or community organizer",
    domain_of_expertise: ["social movements", "racial justice"],
    big_five: { O: 0.5, C: 0.56, E: 0.5, A: 0.5, N: 0.5 },
    moral_foundations: { care: 0.5, fairness: 0.5, loyalty: 0.5, authority: 0.56, sanctity: 0.5 },
    influence_tier: "opinion_leader",
    economic_band: "unknown",
    network_size_proxy: 2,
    posts_per_day: 0.0,
    diurnal_pattern: ["evening"],
    civility: 1.0,
    evidence_citation: 0.5,
    sentiment: "angry",
    arousal: 0.0,
    issue_stances: [{ topic: "Black Lives Matter", support: 1.0, certainty: 0.5 }]
  },
  "user_1861373017374208000": {
    username: "MoSheepdog",
    age_band: "25-34",
    gender: "unknown",
    location: { country: "unknown", region_city: "unknown" },
    profession: "unknown",
    domain_of_expertise: ["business"],
    big_five: { O: 0.5, C: 0.5, E: 0.5, A: 0.5, N: 0.5 },
    moral_foundations: { care: 0.5, fairness: 0.5, loyalty: 0.5, authority: 0.5, sanctity: 0.5 },
    influence_tier: "ordinary_user",
    economic_band: "unknown",
    network_size_proxy: 3,
    posts_per_day: 0.0,
    diurnal_pattern: ["evening"],
    civility: 0.474,
    evidence_citation: 0.5,
    sentiment: "angry",
    arousal: 0.0,
    issue_stances: [{ topic: "business", support: 0.0, certainty: 0.5 }]
  },
  "user_1589773747": {
    username: "AsianSocialNet",
    age_band: "25-34",
    gender: "unknown",
    location: { country: "unknown", region_city: "unknown" },
    profession: "unknown",
    domain_of_expertise: ["social movements", "social justice", "education"],
    big_five: { O: 0.5, C: 0.5, E: 0.5, A: 0.5, N: 0.5 },
    moral_foundations: { care: 0.5, fairness: 0.5, loyalty: 0.5, authority: 0.5, sanctity: 0.5 },
    influence_tier: "ordinary_user",
    economic_band: "unknown",
    network_size_proxy: 0,
    posts_per_day: 0.0,
    diurnal_pattern: ["evening"],
    civility: 1.0,
    evidence_citation: 0.679,
    sentiment: "angry",
    arousal: 0.0,
    issue_stances: [
      { topic: "Black Lives Matter", support: 0.5, certainty: 0.5 },
      { topic: "social justice", support: 0.5, certainty: 0.5 }
    ]
  },
  "user_837474412232388609": {
    username: "RaisedbyTexans2",
    age_band: "35-44",
    gender: "unknown",
    location: { country: "United States", region_city: "Texas" },
    profession: "unknown",
    domain_of_expertise: ["life"],
    big_five: { O: 0.5, C: 0.5, E: 0.5, A: 0.5, N: 0.5 },
    moral_foundations: { care: 0.5, fairness: 0.5, loyalty: 0.5, authority: 0.5, sanctity: 0.5 },
    influence_tier: "opinion_leader",
    economic_band: "unknown",
    network_size_proxy: 1,
    posts_per_day: 0.0001,
    diurnal_pattern: ["evening"],
    civility: 1.0,
    evidence_citation: 0.5,
    sentiment: "angry",
    arousal: 0.0,
    issue_stances: [{ topic: "life", support: 0.5, certainty: 0.5 }]
  },
  "user_1250818959152164865": {
    username: "UUColumbia",
    age_band: "25-34",
    gender: "unknown",
    location: { country: "USA", region_city: "Howard County, Maryland" },
    profession: "community organizer / social activist",
    domain_of_expertise: ["social movements", "community engagement"],
    big_five: { O: 0.5, C: 0.5, E: 0.5, A: 0.5, N: 0.5 },
    moral_foundations: { care: 0.5, fairness: 0.5, loyalty: 0.5, authority: 0.5, sanctity: 0.5 },
    influence_tier: "ordinary_user",
    economic_band: "unknown",
    network_size_proxy: 0,
    posts_per_day: 0.0001,
    diurnal_pattern: ["evening"],
    civility: 1.0,
    evidence_citation: 0.5,
    sentiment: "angry",
    arousal: 0.0,
    issue_stances: [{ topic: "Black Lives Matter", support: 1.0, certainty: 0.5 }]
  },
  "user_818841277424771072": {
    username: "Karenrosegt",
    age_band: "25-34",
    gender: "female",
    location: { country: "USA", region_city: "unknown" },
    profession: "health advocate / public health professional",
    domain_of_expertise: ["HIV prevention", "Black women's health", "public health advocacy"],
    big_five: { O: 0.5, C: 0.5, E: 0.5, A: 0.5, N: 0.5 },
    moral_foundations: { care: 0.5, fairness: 0.5, loyalty: 0.5, authority: 0.5, sanctity: 0.5 },
    influence_tier: "opinion_leader",
    economic_band: "unknown",
    network_size_proxy: 1,
    posts_per_day: 0.0,
    diurnal_pattern: ["evening"],
    civility: 1.0,
    evidence_citation: 0.5,
    sentiment: "angry",
    arousal: 0.0,
    issue_stances: [
      { topic: "BlackWomen", support: 1.0, certainty: 1.0 },
      { topic: "PrEP", support: 1.0, certainty: 1.0 },
      { topic: "HIV", support: 1.0, certainty: 1.0 }
    ]
  }
}

// 用户 ID 到数字 ID 的映射 User ID to numeric ID mapping
const TWITTER_USER_IDS: Record<string, number> = {
  "user_988804598394707968": 1,
  "user_2678618421": 2,
  "user_1161405967260704768": 3,
  "user_1993384785318916096": 4,
  "user_1081299991870795776": 5,
  "user_989622987883253760": 6,
  "user_1631200173912211456": 7,
  "user_541395242528677888": 8,
  "user_801543963865993224": 9,
  "user_924727227534544896": 10,
  "user_1978226467570941953": 11,
  "user_1200083856239611904": 12,
  "user_59870241": 13,
  "user_992253830996754434": 14,
  "user_1607858056951382016": 15,
  "user_1113553199401709574": 16,
  "user_1348955111423410176": 17,
  "user_1667627457669627907": 18,
  "user_1154541615559643136": 19,
  "user_1854314878980218885": 20,
  "user_1896294378013855746": 21,
  "user_839425326316843010": 22,
  "user_917246673385963520": 23,
  "user_a7383357": 24,
  "user_1861373017374208000": 25,
  "user_1589773747": 26,
  "user_837474412232388609": 27,
  "user_1250818959152164865": 28,
  "user_818841277424771072": 29,
  "user_043621c5": 30,
}

// 反向映射：数字 ID 到用户键 Reverse mapping: numeric ID to user key
const NUMERIC_TO_USER_KEY: Record<number, string> = {}
for (const [userKey, numericId] of Object.entries(TWITTER_USER_IDS)) {
  NUMERIC_TO_USER_KEY[numericId] = userKey
}

// ============= Twitter Persona 到 AgentProfile 转换 Twitter Persona to AgentProfile Conversion =============

/**
 * 将 Twitter persona 数据转换为 AgentProfile 格式
 * Convert Twitter persona data to AgentProfile format
 */
export function twitterPersonaToAgentProfile(
  numericId: number,
  groupKey: string
): AgentProfile {
  const userKey = NUMERIC_TO_USER_KEY[numericId]
  if (!userKey || !TWITTER_PERSONAS_DATA[userKey as keyof typeof TWITTER_PERSONAS_DATA]) {
    // 如果未找到 Twitter 数据，回退到生成的画像 Fallback to generated profile if Twitter data not found
    return makeAgentProfile(20260121, numericId, makeGroupProfiles(20260121))
  }

  const data = TWITTER_PERSONAS_DATA[userKey as keyof typeof TWITTER_PERSONAS_DATA]

  // 验证并转换 age_band Validate and convert age_band
  const validAgeBands: AgeBand[] = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+', 'unknown']
  const age_band: AgeBand = validAgeBands.includes(data.age_band as AgeBand) ? (data.age_band as AgeBand) : 'unknown'

  // 验证并转换性别 Validate and convert gender
  const validGenders: Gender[] = ['male', 'female', 'unknown']
  const gender: Gender = validGenders.includes(data.gender as Gender) ? (data.gender as Gender) : 'unknown'

  // 验证并转换情感 Validate and convert sentiment
  const validSentiments: Sentiment[] = ['angry', 'calm', 'happy', 'sad', 'fearful', 'surprised']
  const sentiment: Sentiment = validSentiments.includes(data.sentiment as Sentiment) ? (data.sentiment as Sentiment) : 'calm'

  // 验证并转换影响力层级 Validate and convert influence_tier
  const validInfluenceTiers: InfluenceTier[] = ['ordinary_user', 'opinion_leader', 'elite']
  const influence_tier: InfluenceTier = validInfluenceTiers.includes(data.influence_tier as InfluenceTier) ? (data.influence_tier as InfluenceTier) : 'ordinary_user'

  // 验证并转换经济水平 Validate and convert economic_band
  const validEconomicBands: EconomicBand[] = ['low', 'medium', 'high', 'unknown']
  const economic_band: EconomicBand = validEconomicBands.includes(data.economic_band as EconomicBand) ? (data.economic_band as EconomicBand) : 'unknown'

  // 验证并转换活动时段模式 Validate and convert diurnal_pattern
  const validDiurnalPatterns: DiurnalPattern[] = ['morning', 'afternoon', 'evening', 'night', 'unknown']
  const diurnal_pattern: DiurnalPattern[] = data.diurnal_pattern.filter((p: string) => validDiurnalPatterns.includes(p as DiurnalPattern)) as DiurnalPattern[]

  // 为 big_five 和 moral_foundations 添加基于 agentId 的变化，使进度条显示更明显 Add variation to big_five and moral_foundations based on agentId to make progress bars more visible
  const addVariation = (base: number, salt: number): number => {
    // 如果原始值不是 0.5，保留原始值；如果是 0.5，则添加变化 If original value is not 0.5, keep it; if 0.5, add variation
    if (Math.abs(base - 0.5) > 0.01) return base
    const variation = (hash01(numericId * 7 + salt) - 0.5) * 0.6  // -0.3 到 0.3
    return clamp(base + variation, 0.1, 0.9)
  }

  const variedBigFive = {
    O: addVariation(data.big_five.O, 101),
    C: addVariation(data.big_five.C, 103),
    E: addVariation(data.big_five.E, 107),
    A: addVariation(data.big_five.A, 109),
    N: addVariation(data.big_five.N, 113),
  }

  const variedMoralFoundations = {
    care: addVariation(data.moral_foundations.care, 201),
    fairness: addVariation(data.moral_foundations.fairness, 203),
    loyalty: addVariation(data.moral_foundations.loyalty, 207),
    authority: addVariation(data.moral_foundations.authority, 211),
    sanctity: addVariation(data.moral_foundations.sanctity, 217),
  }

  return {
    id: numericId,
    name: data.username,
    group: groupKey,
    identity: {
      username: data.username,
      age_band,
      gender,
      location: {
        country: data.location.country,
        region_city: data.location.region_city,
      },
      profession: data.profession,
      domain_of_expertise: data.domain_of_expertise,
    },
    psychometrics: {
      personality: {
        big_five: variedBigFive,
      },
      values: {
        moral_foundations: variedMoralFoundations,
      },
    },
    social_status: {
      influence_tier,
      economic_band,
      social_capital: {
        network_size_proxy: data.network_size_proxy,
      },
    },
    behavior_profile: {
      posting_cadence: {
        posts_per_day: data.posts_per_day,
        diurnal_pattern: diurnal_pattern.length > 0 ? diurnal_pattern : ['evening'],
      },
      rhetoric_style: {
        civility: Math.max(0, Math.min(1, data.civility)),
        evidence_citation: Math.max(0, Math.min(1, data.evidence_citation)),
      },
    },
    cognitive_state: {
      core_affect: {
        sentiment,
        arousal: Math.max(0, Math.min(1, data.arousal)),
      },
      issue_stances: data.issue_stances.map((s: { topic: string; support: number; certainty: number }) => ({
        topic: s.topic,
        support: Math.max(-1, Math.min(1, s.support)),
        certainty: Math.max(0, Math.min(1, s.certainty)),
      })),
    },
  }
}

/**
 * 获取所有 Twitter persona 的数字 ID（1-30）
 * Get all Twitter persona numeric IDs (1-30)
 */
export function getTwitterPersonaIds(): number[] {
  return Object.values(TWITTER_USER_IDS).sort((a, b) => a - b)
}

/**
 * 获取 Twitter personas 的数量
 * Get the count of Twitter personas
 */
export function getTwitterPersonaCount(): number {
  return Object.keys(TWITTER_PERSONAS_DATA).length
}
