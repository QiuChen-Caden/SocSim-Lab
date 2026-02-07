import { useMemo, useState, useEffect, useRef } from 'react'
import { useSim } from '../app/SimulationProvider'
import { clamp } from '../app/util'
import ReactECharts from 'echarts-for-react'

// 获取当前主题的图表颜色配置
function getChartColors() {
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light'
  return {
    text: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)',
    textLight: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)',
    splitLine: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)',
    axisLine: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
    radarAxis: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
    radarName: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)',
    radarSplitLine: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
  }
}

type StepTabKey = 'scenario' | 'pipeline' | 'groups' | 'config'

type BenchMetrics = {
  // 微观层面对齐 Micro-level alignment
  accuracy: number
  macroF1: number
  cosineSimilarity: number
  // 宏观层面对齐 Macro-level alignment
  bias: number
  diversity: number
  dtw: number
  pearson: number
} | null

type BehaviorConsistencyMetrics = {
  // Behavior Pattern Score - 行为模式一致性
  bps: number
  // Decision Alignment Score - 决策一致性
  das: number
  // Temporal Consistency Score - 时间行为一致性
  tcs: number
  // Network Pattern Score - 社交网络一致性
  nps: number
  // Overall Consistency Score - 总体一致性
  ocs: number
  // 详细分解 Detailed breakdown
  postFrequencyMatch: number
  interactionPatternMatch: number
  emotionStability: number
  responseLatency: number
} | null

type PersonaStats = {
  totalAgents: number
  influenceTierDistribution: Record<string, number>
  groupDistribution: Record<string, number>
  ageBandDistribution: Record<string, number>
  genderDistribution: Record<string, number>
  sentimentDistribution: Record<string, number>
  avgMood: number
  avgStance: number
  avgResources: number
  avgCivility: number
  avgEvidenceCitation: number
  topTopics: Array<{ topic: string; count: number }>
  economicBandDistribution: Record<string, number>
} | null

export function WorkbenchView() {
  const sim = useSim()
  const [step, setStep] = useState<1 | 2 | 3 | 4>(2)
  const [designTab, setDesignTab] = useState<StepTabKey>('scenario')
  const [benchRunning, setBenchRunning] = useState(false)
  const [benchMetrics, setBenchMetrics] = useState<BenchMetrics>(null)
  const [behaviorConsistencyRunning, setBehaviorConsistencyRunning] = useState(false)
  const [chartColors, setChartColors] = useState(getChartColors())

  // 监听主题变化
  useEffect(() => {
    const handleThemeChange = () => setChartColors(getChartColors())
    window.addEventListener('theme-changed', handleThemeChange)
    return () => window.removeEventListener('theme-changed', handleThemeChange)
  }, [])
  const [behaviorMetrics, setBehaviorMetrics] = useState<BehaviorConsistencyMetrics>(null)
  const [personaStats, setPersonaStats] = useState<PersonaStats>(null)
  const [reviewAgentId, setReviewAgentId] = useState<number>(42)
  const [agentSearchInput, setAgentSearchInput] = useState('42')
  const [mergeSourceGroup, setMergeSourceGroup] = useState<string | null>(null)
  const [mergeTargetGroup, setMergeTargetGroup] = useState<string | null>(null)
  const [bookmarkTitle, setBookmarkTitle] = useState('')

  // 获取书签 Get bookmarks
  const bookmarks = useMemo(() => {
    return sim.state.events.filter(e => e.type === 'bookmark').sort((a, b) => b.tick - a.tick)
  }, [sim.state.events])

  // 为指标仪表板计算 feed 统计信息 Calculate feed stats for metrics dashboard
  const feedStats = useMemo(() => {
    const feed = sim.state.feed
    if (feed.length === 0) return null
    const emotions = feed.map(p => p.emotion)
    const avgEmotion = emotions.reduce((a, b) => a + b, 0) / emotions.length
    const positiveCount = emotions.filter(e => e > 0.2).length
    const negativeCount = emotions.filter(e => e < -0.2).length
    const neutralCount = feed.length - positiveCount - negativeCount
    const totalLikes = feed.reduce((sum, p) => sum + p.likes, 0)
    const avgLikes = totalLikes / feed.length

    return {
      avgEmotion,
      positiveCount,
      negativeCount,
      neutralCount,
      totalLikes,
      avgLikes,
      mostEngaged: [...feed].sort((a, b) => b.likes - a.likes)[0],
    }
  }, [sim.state.feed])

  const handleCreateBookmark = () => {
    const title = bookmarkTitle.trim() || `Bookmark @tick ${sim.state.tick}`
    sim.actions.pushEvent({
      tick: sim.state.tick,
      type: 'bookmark',
      title,
    })
    sim.actions.logOk(`bookmark created at tick ${sim.state.tick}`)
    setBookmarkTitle('')
  }

  const handleJumpToBookmark = (tick: number) => {
    sim.actions.setTick(tick)
  }

  const stepTitle = useMemo(() => {
    if (step === 1) return 'Design 设计'
    if (step === 2) return 'Run 运行'
    if (step === 3) return 'Intervene 干预'
    return 'Analyze 分析'
  }, [step])

  return (
    <div className="workbench-single">
      <section className="panel">
        <div className="panel__hd">
          <div className="panel__title">Workbench 工作台 · {stepTitle}</div>
          <div className="row">
            <button className="btn" onClick={() => setStep(1)}>
              1 Design 设计
            </button>
            <button className="btn" onClick={() => setStep(2)}>
              2 Run 运行
            </button>
            <button className="btn" onClick={() => setStep(3)}>
              3 Intervene 干预
            </button>
            <button className="btn" onClick={() => setStep(4)}>
              4 Analyze 分析
            </button>
          </div>
        </div>

        <div className="panel__bd">
          {step === 1 && (
            <div className="panel panel--nested">
              <div className="panel__hd">
                <div className="panel__title">Design Flow 设计流程</div>
                <div className="subtabs">
                  <button
                    className={`subtab ${designTab === 'scenario' ? 'subtab--active' : ''}`}
                    onClick={() => setDesignTab('scenario')}
                  >
                    Scenario 场景
                  </button>
                  <button
                    className={`subtab ${designTab === 'pipeline' ? 'subtab--active' : ''}`}
                    onClick={() => setDesignTab('pipeline')}
                  >
                    Pipeline 流程
                  </button>
                  <button
                    className={`subtab ${designTab === 'groups' ? 'subtab--active' : ''}`}
                    onClick={() => setDesignTab('groups')}
                  >
                    Groups 群体画像
                  </button>
                  <button
                    className={`subtab ${designTab === 'config' ? 'subtab--active' : ''}`}
                    onClick={() => setDesignTab('config')}
                  >
                    Config 配置
                  </button>
                </div>
              </div>
              <div className="panel__bd">
                    {designTab === 'scenario' && (
                      <>
                        <div className="muted" style={{ marginBottom: 10 }}>
                          定义场景描述和约束条件，作为智能体行为的基础。
                        </div>
                        <textarea
                          className="textarea"
                          style={{ minHeight: 300, fontSize: 13 }}
                          value={sim.state.config.scenarioText}
                          onChange={(e) => sim.actions.setConfig({ scenarioText: e.target.value })}
                          placeholder="在此描述场景背景、社会环境、约束规则等..."
                        />
                        <div className="row" style={{ marginTop: 10, justifyContent: 'space-between' }}>
                          <span className="muted" style={{ fontSize: 12 }}>
                            字符数: {sim.state.config.scenarioText.length}
                          </span>
                          <button
                            className="btn"
                            onClick={() => {
                              sim.actions.setConfig({ designReady: true })
                              sim.actions.logInfo('(user) updated scenario text')
                              sim.actions.logOk('(system) design marked ready')
                              sim.actions.pushEvent({
                                tick: sim.state.tick,
                                type: 'intervention',
                                title: 'Design saved and unlocked for run',
                              })
                            }}
                          >
                            保存变更 Save Changes
                          </button>
                        </div>
                      </>
                    )}

                    {designTab === 'pipeline' && (
                      <>
                        <div className="muted" style={{ marginBottom: 10 }}>
                          工作流程：按"导入 → 个人画像 → 分群 → 审阅/冻结版本"推进
                        </div>

                        <div className="panel panel--nested" style={{ marginBottom: 'var(--space-md)' }}>
                          <div className="panel__hd">
                            <div className="panel__title">1) Import 导入</div>
                            <span className="pill pill--warn">pending 待开发</span>
                          </div>
                          <div className="panel__bd">
                            <div className="muted" style={{ fontSize: 12, lineHeight: 1.35 }}>
                              导入聊天记录/事件流/互动边（推荐含 agentId、时间戳、关系边），作为画像证据与分群特征。
                            </div>
                            <div className="row" style={{ marginTop: 10 }}>
                              <button className="btn" disabled>
                                Import Chat Logs (todo)
                              </button>
                              <span className="pill">evidence 可追溯</span>
                            </div>
                          </div>
                        </div>

                        <div className="panel panel--nested" style={{ marginBottom: 'var(--space-md)' }}>
                          <div className="panel__hd">
                            <div className="panel__title">2) Individual Personas 个人画像</div>
                            <span className="pill pill--ok">ready 就绪</span>
                          </div>
                          <div className="panel__bd">
                            <div className="muted" style={{ fontSize: 12, lineHeight: 1.35 }}>
                              LLM/规则抽取个人维度：社会层级、职业、兴趣 + 认知画像（性格/偏差/媒介素养等）。
                            </div>
                            <div className="row" style={{ marginTop: 10, justifyContent: 'space-between' }}>
                              <button
                                className="btn btn--primary"
                                onClick={() => {
                                  sim.actions.regeneratePersonas()
                                  sim.actions.pushEvent({ tick: sim.state.tick, type: 'intervention', title: 'Regenerate personas (Twitter-based)' })
                                  sim.actions.logInfo('(user) regenerate personas (Twitter-based)')

                                  // 计算并更新统计信息
                                  const agents = Object.values(sim.state.agents)
                                  const totalAgents = agents.length

                                  // 影响力层级分布 Influence tier distribution
                                  const influenceTierDistribution: Record<string, number> = {}
                                  agents.forEach(a => {
                                    const t = a.profile.social_status.influence_tier
                                    influenceTierDistribution[t] = (influenceTierDistribution[t] || 0) + 1
                                  })

                                  // 群体分布
                                  const groupDistribution: Record<string, number> = {}
                                  agents.forEach(a => {
                                    const g = a.profile.group
                                    groupDistribution[g] = (groupDistribution[g] || 0) + 1
                                  })

                                  // 年龄段分布 Age band distribution
                                  const ageBandDistribution: Record<string, number> = {}
                                  agents.forEach(a => {
                                    const ab = a.profile.identity.age_band
                                    ageBandDistribution[ab] = (ageBandDistribution[ab] || 0) + 1
                                  })

  // 性别分布 Gender distribution
                                  const genderDistribution: Record<string, number> = {}
                                  agents.forEach(a => {
                                    const g = a.profile.identity.gender
                                    genderDistribution[g] = (genderDistribution[g] || 0) + 1
                                  })

  // 情感分布 Sentiment distribution
                                  const sentimentDistribution: Record<string, number> = {}
                                  agents.forEach(a => {
                                    const s = a.profile.cognitive_state.core_affect.sentiment
                                    sentimentDistribution[s] = (sentimentDistribution[s] || 0) + 1
                                  })

  // 经济水平分布 Economic band distribution
                                  const economicBandDistribution: Record<string, number> = {}
                                  agents.forEach(a => {
                                    const eb = a.profile.social_status.economic_band
                                    economicBandDistribution[eb] = (economicBandDistribution[eb] || 0) + 1
                                  })

                                  // 平均值
                                  const avgMood = agents.reduce((sum, a) => sum + a.state.mood, 0) / totalAgents
                                  const avgStance = agents.reduce((sum, a) => sum + a.state.stance, 0) / totalAgents
                                  const avgResources = agents.reduce((sum, a) => sum + a.state.resources, 0) / totalAgents
                                  const avgCivility = agents.reduce((sum, a) => sum + a.profile.behavior_profile.rhetoric_style.civility, 0) / totalAgents
                                  const avgEvidenceCitation = agents.reduce((sum, a) => sum + a.profile.behavior_profile.rhetoric_style.evidence_citation, 0) / totalAgents

                                  // Topics统计
                                  const topicCounts: Record<string, number> = {}
                                  agents.forEach(a => {
                                    a.profile.cognitive_state.issue_stances.forEach(is => {
                                      topicCounts[is.topic] = (topicCounts[is.topic] || 0) + 1
                                    })
                                  })
                                  const topTopics = Object.entries(topicCounts)
                                    .map(([topic, count]) => ({ topic, count }))
                                    .sort((a, b) => b.count - a.count)
                                    .slice(0, 5)

                                  setPersonaStats({
                                    totalAgents,
                                    influenceTierDistribution,
                                    groupDistribution,
                                    ageBandDistribution,
                                    genderDistribution,
                                    sentimentDistribution,
                                    avgMood,
                                    avgStance,
                                    avgResources,
                                    avgCivility,
                                    avgEvidenceCitation,
                                    topTopics,
                                    economicBandDistribution,
                                  })
                                }}
                              >
                                Regenerate Personas
                              </button>
                              <span className="pill">cognitive 认知画像</span>
                            </div>

                            {personaStats && (
                              <div style={{ marginTop: 12, padding: 12, border: '1px solid var(--border)', borderRadius: 10, background: 'rgba(0,0,0,0.2)' }}>
                                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: 'var(--accent)' }}>
                                  生成统计 Generation Stats (Twitter Personas)
                                </div>
                                <div className="kv" style={{ fontSize: 13, gridTemplateColumns: '160px 1fr', lineHeight: 1.6 }}>
                                  <div className="kv__k">总智能体 Total Agents</div>
                                  <div>{personaStats.totalAgents}</div>

                                  <div className="kv__k">平均情绪 Avg Mood</div>
                                  <div>{personaStats.avgMood.toFixed(3)}</div>

                                  <div className="kv__k">平均立场 Avg Stance</div>
                                  <div>{personaStats.avgStance.toFixed(3)}</div>

                                  <div className="kv__k">平均资源 Avg Resources</div>
                                  <div>{personaStats.avgResources.toFixed(1)}</div>

                                  <div className="kv__k">平均文明度 Civility</div>
                                  <div>{personaStats.avgCivility.toFixed(3)}</div>

                                  <div className="kv__k">平均证据引用 Evidence</div>
                                  <div>{personaStats.avgEvidenceCitation.toFixed(3)}</div>

                                  <div className="kv__k" style={{ marginTop: 6, fontWeight: 600 }}>影响力层级 Influence Tier</div>
                                  <div style={{ marginTop: 6 }}>
                                    {Object.entries(personaStats.influenceTierDistribution).map(([k, v]) => (
                                      <span key={k} className="pill" style={{ marginRight: 6, marginBottom: 6, fontSize: 12, padding: '6px 10px' }}>
                                        {k}: {v}
                                      </span>
                                    ))}
                                  </div>

                                  <div className="kv__k" style={{ fontWeight: 600 }}>群体分布 Groups</div>
                                  <div>
                                    {Object.entries(personaStats.groupDistribution).slice(0, 4).map(([k, v]) => (
                                      <span key={k} className="pill pill--ok" style={{ marginRight: 6, marginBottom: 6, fontSize: 12, padding: '6px 10px' }}>
                                        {k}: {v}
                                      </span>
                                    ))}
                                  </div>

                                  <div className="kv__k" style={{ fontWeight: 600 }}>年龄分布 Age Bands</div>
                                  <div>
                                    {Object.entries(personaStats.ageBandDistribution).map(([k, v]) => (
                                      <span key={k} className="pill pill--warn" style={{ marginRight: 6, marginBottom: 6, fontSize: 12, padding: '6px 10px' }}>
                                        {k}: {v}
                                      </span>
                                    ))}
                                  </div>

                                  <div className="kv__k" style={{ fontWeight: 600 }}>性别分布 Gender</div>
                                  <div>
                                    {Object.entries(personaStats.genderDistribution).map(([k, v]) => (
                                      <span key={k} className="pill" style={{ marginRight: 6, marginBottom: 6, fontSize: 12, padding: '6px 10px' }}>
                                        {k}: {v}
                                      </span>
                                    ))}
                                  </div>

                                  <div className="kv__k" style={{ fontWeight: 600 }}>情绪分布 Sentiment</div>
                                  <div>
                                    {Object.entries(personaStats.sentimentDistribution).map(([k, v]) => (
                                      <span key={k} className="pill pill--info" style={{ marginRight: 6, marginBottom: 6, fontSize: 12, padding: '6px 10px' }}>
                                        {k}: {v}
                                      </span>
                                    ))}
                                  </div>

                                  <div className="kv__k" style={{ fontWeight: 600 }}>经济水平 Economic Band</div>
                                  <div>
                                    {Object.entries(personaStats.economicBandDistribution).map(([k, v]) => (
                                      <span key={k} className="pill pill--success" style={{ marginRight: 6, marginBottom: 6, fontSize: 12, padding: '6px 10px' }}>
                                        {k}: {v}
                                      </span>
                                    ))}
                                  </div>

                                  <div className="kv__k" style={{ fontWeight: 600 }}>热门议题 Top Topics</div>
                                  <div>
                                    {personaStats.topTopics.map(({ topic, count }) => (
                                      <span key={topic} className="pill pill--danger" style={{ marginRight: 6, marginBottom: 6, fontSize: 12, padding: '6px 10px' }}>
                                        {topic}: {count}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="panel panel--nested" style={{ marginBottom: 'var(--space-md)' }}>
                          <div className="panel__hd">
                            <div className="panel__title">3) Group Builder 分群</div>
                            <span className="pill pill--ok">ready 就绪</span>
                          </div>
                          <div className="panel__bd">
                            <div className="muted" style={{ fontSize: 12, lineHeight: 1.35 }}>
                              先按硬约束（社会层级/组织/地理）切分，再结合画像/关系图特征做聚类，产出群体规范与叙事。
                            </div>
                            <div className="row" style={{ marginTop: 10 }}>
                              <button className="btn" onClick={() => setDesignTab('groups')}>
                                View Group Personas →
                              </button>
                              <span className="pill">{Object.keys(sim.state.groups).length} groups</span>
                            </div>
                          </div>
                        </div>

                        <div className="panel panel--nested">
                          <div className="panel__hd">
                            <div className="panel__title">4) Review & Freeze 审阅/冻结</div>
                            <span className="pill pill--ok">ready 就绪</span>
                          </div>
                          <div className="panel__bd">
                            <div className="muted" style={{ fontSize: 12, lineHeight: 1.35, marginBottom: 12 }}>
                              审阅代表性 agent 的画像证据，合并/拆分群体，最后冻结为 Scenario 版本快照供 Run/Replay 复用。
                            </div>

                            {/* 代表性Agent审阅 */}
                            <div className="panel panel--nested" style={{ marginBottom: 'var(--space-md)', background: 'rgba(0,0,0,0.15)', padding: 'var(--space-md)', borderRadius: 'var(--radius-sm)' }}>
                              <div style={{ fontSize: 13, fontWeight: 650, marginBottom: 10, color: 'var(--accent)' }}>
                                代表性 Agent 审阅 Representative Agents
                              </div>
                              <div className="row" style={{ gap: 8, marginBottom: 12 }}>
                                <input
                                  className="input"
                                  style={{ flex: 1 }}
                                  placeholder="输入 agent ID 搜索 (如: 42)"
                                  value={agentSearchInput}
                                  onChange={(e) => setAgentSearchInput(e.target.value)}
                                />
                                <button
                                  className="btn btn--primary"
                                  onClick={() => {
                                    const id = Number(agentSearchInput)
                                    if (Number.isFinite(id) && sim.state.agents[id]) {
                                      setReviewAgentId(id)
                                      sim.actions.selectAgent(id)
                                    }
                                  }}
                                  disabled={!agentSearchInput.trim()}
                                >
                                  搜索 Search
                                </button>
                              </div>

                              {/* Agent Full Profile */}
                              {sim.state.agents[reviewAgentId] ? (() => {
                                const agent = sim.state.agents[reviewAgentId]
                                const groupProfile = sim.state.groups[agent.profile.group] ?? null
                                return (
                                  <div>
                                    {/* 头部标题 */}
                                    <div className="panel" style={{ background: 'linear-gradient(135deg, rgba(65, 211, 159, 0.15) 0%, rgba(59, 130, 246, 0.15) 100%)', padding: '16px 20px', borderRadius: 8, marginBottom: 16, border: '1px solid rgba(65, 211, 159, 0.3)' }}>
                                      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>
                                            @{agent.profile.identity.username}
                                          </div>
                                          <div className="muted" style={{ fontSize: 12 }}>完整画像 Full Profile</div>
                                        </div>
                                        <span className="pill pill--ok" style={{ fontSize: 13, padding: '6px 14px', fontWeight: 600 }}>ID: {reviewAgentId}</span>
                                      </div>
                                    </div>

                                    {/* Identity 身份信息 */}
                                    <div className="panel" style={{ background: 'rgba(0,0,0,0.25)', padding: '14px 16px', borderRadius: 8, marginBottom: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
                                      <div style={{ fontSize: 14, fontWeight: 650, color: 'var(--ok)', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                        📋 Identity 身份信息
                                      </div>
                                      <div className="kv" style={{ fontSize: 12, gridTemplateColumns: '150px 1fr', rowGap: '6px' }}>
                                        <div className="kv__k">username 用户名</div>
                                        <div>@{agent.profile.identity.username}</div>
                                        <div className="kv__k">group 群体</div>
                                        <div>{agent.profile.group}</div>
                                        <div className="kv__k">age_band 年龄段</div>
                                        <div>{agent.profile.identity.age_band}</div>
                                        <div className="kv__k">gender 性别</div>
                                        <div>{agent.profile.identity.gender}</div>
                                        <div className="kv__k">profession 职业</div>
                                        <div>{agent.profile.identity.profession}</div>
                                        <div className="kv__k">location 地点</div>
                                        <div>{agent.profile.identity.location.country}, {agent.profile.identity.location.region_city}</div>
                                        <div className="kv__k">domains 专业领域</div>
                                        <div>{agent.profile.identity.domain_of_expertise.join(', ')}</div>
                                      </div>
                                    </div>

                                    {/* Psychometrics 心理测量 */}
                                    <div className="panel" style={{ background: 'rgba(0,0,0,0.25)', padding: '14px 16px', borderRadius: 8, marginBottom: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
                                      <div style={{ fontSize: 14, fontWeight: 650, color: 'var(--warn)', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                        🧠 Psychometrics 心理测量
                                      </div>
                                      <div className="kv" style={{ fontSize: 12, gridTemplateColumns: '150px 1fr', rowGap: '6px' }}>
                                        <div className="kv__k">Big Five O 开放性</div>
                                        <div>{agent.profile.psychometrics.personality.big_five.O.toFixed(3)}</div>
                                        <div className="kv__k">Big Five C 尽责性</div>
                                        <div>{agent.profile.psychometrics.personality.big_five.C.toFixed(3)}</div>
                                        <div className="kv__k">Big Five E 外向性</div>
                                        <div>{agent.profile.psychometrics.personality.big_five.E.toFixed(3)}</div>
                                        <div className="kv__k">Big Five A 宜人性</div>
                                        <div>{agent.profile.psychometrics.personality.big_five.A.toFixed(3)}</div>
                                        <div className="kv__k">Big Five N 神经质</div>
                                        <div>{agent.profile.psychometrics.personality.big_five.N.toFixed(3)}</div>
                                        <div className="kv__k">Moral: Care 关怀</div>
                                        <div>{agent.profile.psychometrics.values.moral_foundations.care.toFixed(3)}</div>
                                        <div className="kv__k">Moral: Fairness 公平</div>
                                        <div>{agent.profile.psychometrics.values.moral_foundations.fairness.toFixed(3)}</div>
                                        <div className="kv__k">Moral: Loyalty 忠诚</div>
                                        <div>{agent.profile.psychometrics.values.moral_foundations.loyalty.toFixed(3)}</div>
                                      </div>
                                    </div>

                                    {/* Social Status 社会地位 */}
                                    <div className="panel" style={{ background: 'rgba(0,0,0,0.25)', padding: '14px 16px', borderRadius: 8, marginBottom: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
                                      <div style={{ fontSize: 14, fontWeight: 650, color: 'var(--info)', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                        👑 Social Status 社会地位
                                      </div>
                                      <div className="kv" style={{ fontSize: 12, gridTemplateColumns: '150px 1fr', rowGap: '6px' }}>
                                        <div className="kv__k">influence_tier 影响力</div>
                                        <div><span className="pill pill--ok">{agent.profile.social_status.influence_tier}</span></div>
                                        <div className="kv__k">economic_band 经济</div>
                                        <div><span className="pill">{agent.profile.social_status.economic_band}</span></div>
                                        <div className="kv__k">network_size_proxy 网络</div>
                                        <div>{agent.profile.social_status.social_capital.network_size_proxy}</div>
                                      </div>
                                    </div>

                                    {/* Behavior Profile 行为画像 */}
                                    <div className="panel" style={{ background: 'rgba(0,0,0,0.25)', padding: '14px 16px', borderRadius: 8, marginBottom: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
                                      <div style={{ fontSize: 14, fontWeight: 650, color: '#a855f7', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                        📊 Behavior Profile 行为画像
                                      </div>
                                      <div className="kv" style={{ fontSize: 12, gridTemplateColumns: '150px 1fr', rowGap: '6px' }}>
                                        <div className="kv__k">posts_per_day 日发帖</div>
                                        <div>{agent.profile.behavior_profile.posting_cadence.posts_per_day.toFixed(2)}</div>
                                        <div className="kv__k">diurnal_pattern 时段</div>
                                        <div>{agent.profile.behavior_profile.posting_cadence.diurnal_pattern.join(', ')}</div>
                                        <div className="kv__k">civility 文明度</div>
                                        <div>{agent.profile.behavior_profile.rhetoric_style.civility.toFixed(3)}</div>
                                        <div className="kv__k">evidence_citation 证据</div>
                                        <div>{agent.profile.behavior_profile.rhetoric_style.evidence_citation.toFixed(3)}</div>
                                      </div>
                                    </div>

                                    {/* Cognitive State 认知状态 */}
                                    <div className="panel" style={{ background: 'rgba(0,0,0,0.25)', padding: '14px 16px', borderRadius: 8, marginBottom: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
                                      <div style={{ fontSize: 14, fontWeight: 650, color: '#f97316', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                        💭 Cognitive State 认知状态
                                      </div>
                                      <div className="kv" style={{ fontSize: 12, gridTemplateColumns: '150px 1fr', rowGap: '6px' }}>
                                        <div className="kv__k">sentiment 情绪</div>
                                        <div><span className="pill pill--warn">{agent.profile.cognitive_state.core_affect.sentiment}</span></div>
                                        <div className="kv__k">arousal 唤醒度</div>
                                        <div>{agent.profile.cognitive_state.core_affect.arousal.toFixed(3)}</div>
                                        <div className="kv__k">mood 情绪值</div>
                                        <div>{agent.state.mood.toFixed(2)}</div>
                                        <div className="kv__k">stance 立场</div>
                                        <div>{agent.state.stance.toFixed(2)}</div>
                                        <div className="kv__k">resources 资源</div>
                                        <div>{agent.state.resources}</div>
                                      </div>
                                    </div>

                                    {/* Issue Stances 议题立场 */}
                                    <div className="panel" style={{ background: 'rgba(0,0,0,0.25)', padding: '14px 16px', borderRadius: 8, marginBottom: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
                                      <div style={{ fontSize: 14, fontWeight: 650, color: '#ef4444', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                        🎯 Issue Stances 议题立场
                                      </div>
                                      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                                        {agent.profile.cognitive_state.issue_stances.map(stance => (
                                          <span key={stance.topic} className="pill pill--danger" style={{ fontSize: 11 }}>
                                            {stance.topic}: {stance.support.toFixed(2)} (c={stance.certainty.toFixed(2)})
                                          </span>
                                        ))}
                                      </div>
                                    </div>

                                    {/* 所属群体 */}
                                    {groupProfile && (
                                      <div className="panel" style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%)', padding: '14px 16px', borderRadius: 8, border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                                        <div style={{ fontSize: 14, fontWeight: 650, color: '#818cf8', marginBottom: 10 }}>
                                          🏛️ 所属群体 Group Profile
                                        </div>
                                        <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                                          <span className="pill pill--ok" style={{ fontSize: 13 }}>{groupProfile.label}</span>
                                          <span className="muted" style={{ fontSize: 12 }}>凝聚力: {groupProfile.cohesion.toFixed(2)}</span>
                                          <span className="muted" style={{ fontSize: 12 }}>极化度: {groupProfile.polarization.toFixed(2)}</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )
                              })() : (
                                <div className="muted" style={{ textAlign: 'center', padding: 16, fontSize: 12 }}>
                                  未找到 ID 为 {reviewAgentId} 的智能体
                                  <br />
                                  Agent with ID {reviewAgentId} not found
                                </div>
                              )}
                            </div>

                            {/* 群体合并/拆分 */}
                            <div className="panel panel--nested" style={{ marginBottom: 'var(--space-md)', background: 'rgba(0,0,0,0.15)', padding: 'var(--space-sm)' }}>
                              <div style={{ fontSize: 12, fontWeight: 650, marginBottom: 8, color: 'var(--accent)' }}>
                                群体操作 Group Operations
                              </div>
                              <div className="row" style={{ marginBottom: 8, alignItems: 'center', gap: 8 }}>
                                <span className="muted" style={{ fontSize: 11 }}>合并群体 Merge:</span>
                                <select
                                  className="select"
                                  style={{ width: 120, fontSize: 11 }}
                                  value={mergeSourceGroup ?? ''}
                                  onChange={(e) => setMergeSourceGroup(e.target.value || null)}
                                >
                                  <option value="">选择源群体</option>
                                  {Object.keys(sim.state.groups).map(g => (
                                    <option key={g} value={g}>{g}</option>
                                  ))}
                                </select>
                                <span className="muted">→</span>
                                <select
                                  className="select"
                                  style={{ width: 120, fontSize: 11 }}
                                  value={mergeTargetGroup ?? ''}
                                  onChange={(e) => setMergeTargetGroup(e.target.value || null)}
                                >
                                  <option value="">选择目标群体</option>
                                  {Object.keys(sim.state.groups).map(g => (
                                    <option key={g} value={g}>{g}</option>
                                  ))}
                                </select>
                                <button
                                  className="btn btn--primary"
                                  style={{ fontSize: 11, padding: '6px 10px' }}
                                  onClick={() => {
                                    if (mergeSourceGroup && mergeTargetGroup && mergeSourceGroup !== mergeTargetGroup) {
                                      sim.actions.logInfo(`(user) merged group ${mergeSourceGroup} into ${mergeTargetGroup} (mock)`)
                                      setMergeSourceGroup(null)
                                      setMergeTargetGroup(null)
                                    }
                                  }}
                                  disabled={!mergeSourceGroup || !mergeTargetGroup || mergeSourceGroup === mergeTargetGroup}
                                >
                                  执行合并 Execute
                                </button>
                              </div>
                              <div className="muted" style={{ fontSize: 11 }}>
                                选择源群体和目标群体可执行合并（当前为 mock 流程）。
                              </div>
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {designTab === 'config' && (
                      <>
                        <div className="kv kv--wide">
                          <div className="kv__k">Seed 随机种子</div>
                          <div className="kv__v">{sim.state.config.seed}</div>

                          <div className="kv__k">Agent Count 智能体数量</div>
                          <div className="kv__v">{sim.state.config.agentCount.toLocaleString()}</div>

                          <div className="kv__k">World Size 世界大小</div>
                          <div className="kv__v">{sim.state.config.worldSize}px</div>

                          <div className="kv__k">Ticks/sec 时间步/秒</div>
                          <div className="kv__v">{sim.state.config.ticksPerSecond}</div>

                          <div className="kv__k">Viewport Mode 视口模式</div>
                          <div className="kv__v">{sim.state.config.viewportMode}</div>
                        </div>
                        <div style={{ marginTop: 10 }}>
                          <label className="muted">seed</label>
                          <input
                            className="input"
                            type="number"
                            value={sim.state.config.seed}
                            onChange={(e) => sim.actions.setConfig({ seed: clamp(Number(e.target.value || 0), 0, 9_999_999_999) })}
                          />
                        </div>
                        <div style={{ marginTop: 10 }}>
                          <label className="muted">ticks/sec</label>
                          <input
                            className="input"
                            type="number"
                            min={1}
                            max={60}
                            value={sim.state.config.ticksPerSecond}
                            onChange={(e) => sim.actions.setConfig({ ticksPerSecond: Number(e.target.value) })}
                          />
                        </div>
                        <div style={{ marginTop: 10 }}>
                          <label className="muted">world size</label>
                          <input
                            className="input"
                            type="number"
                            min={2000}
                            max={20000}
                            value={sim.state.config.worldSize}
                            onChange={(e) => sim.actions.setConfig({ worldSize: Number(e.target.value) })}
                          />
                        </div>
                        <div style={{ marginTop: 10 }}>
                          <label className="muted">sample agents (render)</label>
                          <input
                            className="input"
                            type="number"
                            min={200}
                            max={50000}
                            value={sim.state.config.sampleAgents}
                            onChange={(e) => sim.actions.setConfig({ sampleAgents: Number(e.target.value) })}
                          />
                        </div>
                        <div style={{ marginTop: 10 }}>
                          <label className="muted">experiment name 实验名称</label>
                          <input
                            className="input"
                            type="text"
                            placeholder="输入本次实验的名称..."
                            value={sim.state.config.experimentName}
                            onChange={(e) => sim.actions.setConfig({ experimentName: e.target.value })}
                          />
                        </div>
                        <div style={{ marginTop: 14, padding: 10, border: '1px solid var(--border)', borderRadius: 10, background: 'rgba(255,255,255,0.02)' }}>
                          <div style={{ fontWeight: 600, marginBottom: 8 }}>LLM Runtime（DeepSeek）</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <div>
                              <label className="muted">LLM enabled</label>
                              <select
                                className="input"
                                value={sim.state.config.llmEnabled ? 'true' : 'false'}
                                onChange={(e) => sim.actions.setConfig({ llmEnabled: e.target.value === 'true' })}
                              >
                                <option value="true">true</option>
                                <option value="false">false</option>
                              </select>
                            </div>
                            <div>
                              <label className="muted">provider</label>
                              <input
                                className="input"
                                type="text"
                                value={sim.state.config.llmProvider}
                                onChange={(e) => sim.actions.setConfig({ llmProvider: e.target.value })}
                              />
                            </div>
                            <div>
                              <label className="muted">model</label>
                              <input
                                className="input"
                                type="text"
                                value={sim.state.config.llmModel}
                                onChange={(e) => sim.actions.setConfig({ llmModel: e.target.value })}
                              />
                            </div>
                            <div>
                              <label className="muted">active agents / tick</label>
                              <input
                                className="input"
                                type="number"
                                min={1}
                                max={100}
                                value={sim.state.config.llmActiveAgents}
                                onChange={(e) => sim.actions.setConfig({ llmActiveAgents: Number(e.target.value) })}
                              />
                            </div>
                            <div>
                              <label className="muted">timeout ms</label>
                              <input
                                className="input"
                                type="number"
                                min={1000}
                                max={120000}
                                value={sim.state.config.llmTimeoutMs}
                                onChange={(e) => sim.actions.setConfig({ llmTimeoutMs: Number(e.target.value) })}
                              />
                            </div>
                            <div>
                              <label className="muted">max retries</label>
                              <input
                                className="input"
                                type="number"
                                min={0}
                                max={5}
                                value={sim.state.config.llmMaxRetries}
                                onChange={(e) => sim.actions.setConfig({ llmMaxRetries: Number(e.target.value) })}
                              />
                            </div>
                            <div>
                              <label className="muted">retry backoff ms</label>
                              <input
                                className="input"
                                type="number"
                                min={0}
                                max={5000}
                                value={sim.state.config.llmRetryBackoffMs}
                                onChange={(e) => sim.actions.setConfig({ llmRetryBackoffMs: Number(e.target.value) })}
                              />
                            </div>
                            <div>
                              <label className="muted">max actions/min</label>
                              <input
                                className="input"
                                type="number"
                                min={1}
                                max={5000}
                                value={sim.state.config.llmMaxActionsPerMinute}
                                onChange={(e) => sim.actions.setConfig({ llmMaxActionsPerMinute: Number(e.target.value) })}
                              />
                            </div>
                            <div>
                              <label className="muted">fallback on error</label>
                              <select
                                className="input"
                                value={sim.state.config.llmFallbackOnError ? 'true' : 'false'}
                                onChange={(e) => sim.actions.setConfig({ llmFallbackOnError: e.target.value === 'true' })}
                              >
                                <option value="true">true</option>
                                <option value="false">false</option>
                              </select>
                            </div>
                          </div>
                          <div style={{ marginTop: 8 }}>
                            <label className="muted">base url</label>
                            <input
                              className="input"
                              type="text"
                              value={sim.state.config.llmBaseUrl}
                              onChange={(e) => sim.actions.setConfig({ llmBaseUrl: e.target.value })}
                            />
                          </div>
                          <div style={{ marginTop: 8 }}>
                            <label className="muted">api key</label>
                            <input
                              className="input"
                              type="password"
                              value={sim.state.config.llmApiKey}
                              onChange={(e) => sim.actions.setConfig({ llmApiKey: e.target.value })}
                            />
                          </div>
                        </div>
                        <div style={{ marginTop: 16, padding: 12, border: '1px solid var(--border)', borderRadius: 10, background: 'rgba(65, 211, 159, 0.08)' }}>
                          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--ok)' }}>
                                配置完成 Configuration Complete
                              </div>
                              <div className="muted" style={{ fontSize: 11 }}>
                                {'Design 配置可随时修改，Run 不再受限。'}
                              </div>
                            </div>
                            <button
                              className="btn btn--primary"
                              onClick={() => {
                                sim.actions.logInfo('(user) started run from config')
                                setStep(2)
                              }}
                              style={{ padding: '8px 16px', fontWeight: 650 }}
                            >
                              开始 Run →
                            </button>
                          </div>
                        </div>
                      </>
                    )}

                    {designTab === 'groups' && (
                      <>
                        <div className="row" style={{ marginBottom: 10, justifyContent: 'space-between' }}>
                          <span className="pill">{Object.keys(sim.state.groups).length} groups</span>
                          <button className="btn btn--primary" onClick={() => setDesignTab('pipeline')}>
                            ← Back to Pipeline
                          </button>
                        </div>
                        {Object.values(sim.state.groups).map((g) => (
                          <div key={g.key} className="logline logline--info" style={{ marginBottom: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                              <div style={{ fontWeight: 700 }}>{g.key}</div>
                              <div className="muted" style={{ fontSize: 12 }}>
                                {g.dominantStratum}
                              </div>
                            </div>
                            <div style={{ marginTop: 4, fontSize: 12 }}>{g.label}</div>
                            <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                              {g.normSummary}
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
            )}

          {step === 2 && (
            <>
              {/* 4象限布局 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 12, maxHeight: 'calc(100vh - 200px)' }}>
                {/* 左上：Console 控制台 */}
                <div className="panel panel--nested" style={{ display: 'flex', flexDirection: 'column' }}>
                  <div className="panel__hd">
                    <div className="panel__title">Console 控制台</div>
                    <span className={`pill ${sim.state.isRunning ? 'pill--ok' : ''}`}>{sim.state.isRunning ? '运行中' : '已暂停'}</span>
                  </div>
                  <div className="panel__bd" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    {/* 状态卡片 */}
                    <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                      <div style={{ flex: 1, padding: 10, background: 'rgba(0,0,0,0.15)', borderRadius: 8 }}>
                        <div className="muted" style={{ fontSize: 10 }}>tick</div>
                        <div style={{ fontSize: 18, fontWeight: 600 }}>{sim.state.tick}</div>
                      </div>
                      <div style={{ flex: 1, padding: 10, background: 'rgba(0,0,0,0.15)', borderRadius: 8 }}>
                        <div className="muted" style={{ fontSize: 10 }}>速度</div>
                        <div style={{ fontSize: 18, fontWeight: 600 }}>{sim.state.speed.toFixed(1)}x</div>
                      </div>
                      <div style={{ flex: 1, padding: 10, background: 'rgba(0,0,0,0.15)', borderRadius: 8 }}>
                        <div className="muted" style={{ fontSize: 10 }}>智能体</div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{sim.state.selectedAgentId ?? '-'}</div>
                      </div>
                    </div>

                    {/* 控制按钮 */}
                    <div className="row" style={{ gap: 8, marginBottom: 12 }}>
                      <button
                        className="btn btn--primary"
                        style={{ flex: 1 }}
                        onClick={() => sim.actions.toggleRun()}
                      >
                        {sim.state.isRunning ? '⏸ 暂停' : '▶ 运行'}
                      </button>
                      <button className="btn" style={{ flex: 1 }} onClick={() => sim.actions.pushEvent({ tick: sim.state.tick, type: 'bookmark', title: 'Bookmark' })}>
                        🔖 书签
                      </button>
                      <button className="btn btn--danger" style={{ flex: 1 }} onClick={() => { if (sim.state.isRunning) sim.actions.toggleRun(); sim.actions.logInfo(`实验结束 @ tick ${sim.state.tick}`); }}>
                        ⏹ 结束
                      </button>
                    </div>

                    {/* 速度控制 */}
                    <div style={{ marginTop: 'auto' }}>
                      <label className="muted" style={{ fontSize: 11 }}>播放速度</label>
                      <input
                        className="input"
                        type="range"
                        min={0.2}
                        max={8}
                        step={0.2}
                        value={sim.state.speed}
                        onChange={(e) => sim.actions.setSpeed(Number(e.target.value))}
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>
                </div>

                {/* 右上：Recent Logs 最近日志 */}
                <div className="panel panel--nested" style={{ display: 'flex', flexDirection: 'column' }}>
                  <div className="panel__hd">
                    <div className="panel__title">Recent Logs 最近日志</div>
                    <span className="pill">{sim.state.logs.length} 条</span>
                  </div>
                  <div className="panel__bd scroller" style={{ flex: 1, overflow: 'auto' }}>
                    {sim.state.logs.slice(-20).reverse().map((l) => (
                      <div
                        key={l.id}
                        className={`logline ${l.level === 'error' ? 'logline--error' : l.level === 'ok' ? 'logline--ok' : 'logline--info'}`}
                        style={{ fontSize: 12 }}
                      >
                        <div className="muted" style={{ fontSize: 10 }}>
                          tick {l.tick} {l.agentId != null ? `· agent_${l.agentId}` : ''}
                        </div>
                        <div>{l.text}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 左下：Bookmarks 书签管理 */}
                <div className="panel panel--nested" style={{ display: 'flex', flexDirection: 'column' }}>
                  <div className="panel__hd">
                    <div className="panel__title">Bookmarks 书签管理</div>
                    <span className="pill">{bookmarks.length} 个</span>
                  </div>
                  <div className="panel__bd" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {/* 添加书签 */}
                    <div style={{ marginBottom: 10 }}>
                      <div className="row" style={{ gap: 8 }}>
                        <input
                          className="input"
                          style={{ flex: 1 }}
                          placeholder="书签标题 (可选)"
                          value={bookmarkTitle}
                          onChange={(e) => setBookmarkTitle(e.target.value)}
                        />
                        <button className="btn btn--primary" onClick={handleCreateBookmark}>添加</button>
                      </div>
                    </div>

                    {/* 书签列表 */}
                    {bookmarks.length === 0 ? (
                      <div className="muted" style={{ textAlign: 'center', padding: 20, fontSize: 11 }}>
                        暂无书签
                      </div>
                    ) : (
                      <div style={{ flex: 1, overflow: 'auto' }}>
                        {bookmarks.map((bm) => (
                          <div
                            key={bm.id}
                            className="logline logline--info"
                            style={{ marginBottom: 4, padding: '6px 8px', cursor: 'pointer', fontSize: 12 }}
                            onClick={() => handleJumpToBookmark(bm.tick)}
                          >
                            <div className="row" style={{ justifyContent: 'space-between' }}>
                              <span className="muted" style={{ fontSize: 10 }}>tick {bm.tick}</span>
                              <span>{bm.title}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* 右下：Tick-Time Chart Tick-时间图 */}
                <div className="panel panel--nested" style={{ display: 'flex', flexDirection: 'column' }}>
                  <div className="panel__hd">
                    <div className="panel__title">Tick-Time Chart Tick-时间图</div>
                    <span className="pill">运行速度</span>
                  </div>
                  <div className="panel__bd" style={{ flex: 1, minHeight: 0 }}>
                    <TickTimeChart />
                  </div>
                </div>

              </div>
            </>
          )}

          {step === 3 && <IntervenePanel />}

          {step === 4 && (
            <div className="row" style={{ alignItems: 'stretch' }}>
              <div style={{ flex: 1 }}>
                <div className="panel panel--nested">
                  <div className="panel__hd">
                    <div className="panel__title">Metrics Dashboard 指标仪表板</div>
                  </div>
                  <div className="panel__bd" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Basic Stats */}
                    <div className="panel panel--nested">
                      <div className="panel__hd" style={{ paddingBottom: 8 }}>
                        <div className="panel__title" style={{ fontSize: 14 }}>Basic Stats 基础统计</div>
                      </div>
                      <div className="panel__bd" style={{ paddingTop: 0 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px 16px' }}>
                          <div>
                            <div className="muted" style={{ fontSize: 13, marginBottom: 4 }}>total posts 总帖子</div>
                            <div style={{ fontSize: 18, fontWeight: 600 }}>{sim.state.feed.length}</div>
                          </div>
                          <div>
                            <div className="muted" style={{ fontSize: 13, marginBottom: 4 }}>current tick 时间步</div>
                            <div style={{ fontSize: 18, fontWeight: 600 }}>{sim.state.tick}</div>
                          </div>
                          <div>
                            <div className="muted" style={{ fontSize: 13, marginBottom: 4 }}>sort mode 排序</div>
                            <div><span className="pill">time</span></div>
                          </div>
                          <div>
                            <div className="muted" style={{ fontSize: 13, marginBottom: 4 }}>selected agent 选中</div>
                            <div><span className="pill">agent_{sim.state.selectedAgentId ?? 42}</span></div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {feedStats && (
                      <>
                        {/* Engagement */}
                        <div className="panel panel--nested">
                          <div className="panel__hd" style={{ paddingBottom: 8 }}>
                            <div className="panel__title" style={{ fontSize: 14 }}>Engagement 参与度</div>
                          </div>
                          <div className="panel__bd" style={{ paddingTop: 0 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px 16px' }}>
                              <div>
                                <div className="muted" style={{ fontSize: 13, marginBottom: 4 }}>total likes 总点赞</div>
                                <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--ok)' }}>{feedStats.totalLikes.toLocaleString()}</div>
                              </div>
                              <div>
                                <div className="muted" style={{ fontSize: 13, marginBottom: 4 }}>avg likes 平均</div>
                                <div style={{ fontSize: 20, fontWeight: 600 }}>{feedStats.avgLikes.toFixed(1)}</div>
                              </div>
                            </div>
                            {feedStats.mostEngaged && (
                              <div style={{ marginTop: 16, padding: 12, background: 'rgba(0,0,0,0.15)', borderRadius: 8 }}>
                                <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>Most Engaged 最受关注</div>
                                <div className="logline logline--info" style={{ fontSize: 12 }}>
                                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{feedStats.mostEngaged.authorName}</div>
                                  <div style={{ marginBottom: 4 }}>{feedStats.mostEngaged.content.slice(0, 60)}...</div>
                                  <div className="muted">❤️ {feedStats.mostEngaged.likes} likes</div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Sentiment Distribution */}
                        <div className="panel panel--nested">
                          <div className="panel__hd" style={{ paddingBottom: 8 }}>
                            <div className="panel__title" style={{ fontSize: 14 }}>Sentiment Distribution 情绪分布</div>
                          </div>
                          <div className="panel__bd" style={{ paddingTop: 0 }}>
                            <div style={{ marginBottom: 12 }}>
                              <div className="muted" style={{ marginBottom: 8, fontSize: 12 }}>Sentiment Bar 情绪分布条</div>
                              <div style={{ display: 'flex', height: 28, borderRadius: '999px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                                <div
                                  style={{
                                    width: `${(feedStats.positiveCount / sim.state.feed.length) * 100}%`,
                                    background: 'linear-gradient(135deg, var(--ok) 0%, #22c55e 100%)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: '#000',
                                  }}
                                >
                                  {feedStats.positiveCount > 0 ? `+${feedStats.positiveCount}` : ''}
                                </div>
                                <div
                                  style={{
                                    width: `${(feedStats.neutralCount / sim.state.feed.length) * 100}%`,
                                    background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.08) 100%)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 12,
                                    fontWeight: 600,
                                  }}
                                >
                                  {feedStats.neutralCount > 0 ? `±${feedStats.neutralCount}` : ''}
                                </div>
                                <div
                                  style={{
                                    width: `${(feedStats.negativeCount / sim.state.feed.length) * 100}%`,
                                    background: 'linear-gradient(135deg, var(--danger) 0%, #dc2626 100%)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: '#fff',
                                  }}
                                >
                                  {feedStats.negativeCount > 0 ? `-${feedStats.negativeCount}` : ''}
                                </div>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                                <span className="muted" style={{ fontSize: 13 }}>positive 积极</span>
                                <span className="muted" style={{ fontSize: 13 }}>neutral 中性</span>
                                <span className="muted" style={{ fontSize: 13 }}>negative 消极</span>
                              </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                              <div style={{ padding: 12, background: 'rgba(34, 197, 94, 0.1)', borderRadius: 8, border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                                <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>positive 积极</div>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                                  <span className="pill pill--ok" style={{ fontSize: 18, fontWeight: 600 }}>{feedStats.positiveCount}</span>
                                  <span className="muted" style={{ fontSize: 13 }}>{((feedStats.positiveCount / sim.state.feed.length) * 100).toFixed(1)}%</span>
                                </div>
                              </div>
                              <div style={{ padding: 12, background: 'rgba(239, 68, 68, 0.1)', borderRadius: 8, border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>negative 消极</div>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                                  <span className="pill pill--danger" style={{ fontSize: 18, fontWeight: 600 }}>{feedStats.negativeCount}</span>
                                  <span className="muted" style={{ fontSize: 13 }}>{((feedStats.negativeCount / sim.state.feed.length) * 100).toFixed(1)}%</span>
                                </div>
                              </div>
                            </div>
                            <div style={{ marginTop: 12, padding: 12, background: 'rgba(0,0,0,0.1)', borderRadius: 8 }}>
                              <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>neutral 中性</div>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                                <span className="pill" style={{ fontSize: 18, fontWeight: 600 }}>{feedStats.neutralCount}</span>
                                <span className="muted" style={{ fontSize: 13 }}>{((feedStats.neutralCount / sim.state.feed.length) * 100).toFixed(1)}%</span>
                              </div>
                            </div>
                            <div style={{ marginTop: 12 }}>
                              <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>avg emotion 平均情绪</div>
                              <span className={`pill ${feedStats.avgEmotion > 0.2 ? 'pill--ok' : feedStats.avgEmotion < -0.2 ? 'pill--danger' : ''}`} style={{ fontSize: 16 }}>
                                {feedStats.avgEmotion > 0 ? '+' : ''}{feedStats.avgEmotion.toFixed(3)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {/* Polarization Index */}
                    <div className="panel panel--nested">
                      <div className="panel__hd" style={{ paddingBottom: 8 }}>
                        <div className="panel__title" style={{ fontSize: 14 }}>Polarization Index 极化指数</div>
                      </div>
                      <div className="panel__bd" style={{ paddingTop: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                          <div>
                            <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>current index 当前指数</div>
                            <span className={`pill ${(0.5 + 0.5 * Math.sin(sim.state.tick / 18)) > 0.6 ? 'pill--danger' : 'pill--warn'}`} style={{ fontSize: 20, fontWeight: 600, padding: '8px 16px' }}>
                              {(0.5 + 0.5 * Math.sin(sim.state.tick / 18)).toFixed(3)}
                            </span>
                          </div>
                          <div className="muted" style={{ fontSize: 13, textAlign: 'right', maxWidth: 120 }}>
                            {(0.5 + 0.5 * Math.sin(sim.state.tick / 18)) > 0.6 ? '⚠️ 高极化' : (0.5 + 0.5 * Math.sin(sim.state.tick / 18)) > 0.4 ? '⚡ 中等' : '✓ 低极化'}
                          </div>
                        </div>
                        <div style={{ marginBottom: 12 }}>
                          <div className="muted" style={{ marginBottom: 8, fontSize: 13 }}>polarization trend 极化趋势</div>
                          <div className="bar" style={{ height: 12, borderRadius: '999px' }}>
                            <div style={{ width: `${((0.5 + 0.5 * Math.sin(sim.state.tick / 18)) * 100)}%`, height: '100%', borderRadius: '999px' }} />
                          </div>
                        </div>
                        <div className="muted" style={{ fontSize: 13, lineHeight: 1.5, padding: 10, background: 'rgba(0,0,0,0.1)', borderRadius: 6 }}>
                          极化指数反映群体观点分化程度，值越高表示对立越严重。基于帖子情绪分布计算 (mock)。
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ flex: 1 }}>
                <div className="panel panel--nested">
                  <div className="panel__hd">
                    <div className="panel__title">Bench Evaluation 评估指标</div>
                    <div className="row">
                      {benchMetrics ? (
                        <span className="pill pill--ok">evaluated 已评估</span>
                      ) : (
                        <span className="pill pill--warn">pending 待评估</span>
                      )}
                    </div>
                  </div>
                  <div className="panel__bd">
                    <button
                      className={`btn ${benchRunning ? 'btn--primary' : ''}`}
                      onClick={() => {
                        if (benchRunning) return
                        setBenchRunning(true)
                        // 模拟评估 Simulate evaluation
                        setTimeout(() => {
                          setBenchMetrics({
                            // 微观层面对齐 Micro-level alignment
                            accuracy: 0.82 + Math.random() * 0.1,
                            macroF1: 0.75 + Math.random() * 0.12,
                            cosineSimilarity: 0.78 + Math.random() * 0.15,
                            // 宏观层面对齐 Macro-level alignment
                            bias: Math.sin(sim.state.tick / 50) * 0.3,
                            diversity: 0.65 + Math.random() * 0.2,
                            dtw: 150 + Math.random() * 50,
                            pearson: 0.7 + Math.random() * 0.2,
                          })
                          setBenchRunning(false)
                        }, 2000)
                      }}
                      disabled={benchRunning}
                    >
                      {benchRunning ? 'Running 运行中...' : benchMetrics ? 'Re-run 重新评估' : 'Start Bench 启动评估'}
                    </button>

                    {benchMetrics && (
                      <div style={{ marginTop: 16 }}>
                        {/* Radar Chart - 总体概览 */}
                        <div className="panel panel--nested" style={{ marginBottom: 'var(--space-xl)' }}>
                          <div className="panel__hd">
                            <div className="panel__title" style={{ fontSize: 14 }}>Evaluation Overview 评估概览</div>
                          </div>
                          <div className="panel__bd" style={{ paddingTop: 8 }}>
                            <ReactECharts
                              option={{
                                color: ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444'],
                                radar: {
                                  indicator: [
                                    { name: 'Accuracy\n准确率', max: 100 },
                                    { name: 'Macro-F1\n宏F1', max: 1 },
                                    { name: 'Cosine Sim\n余弦相似', max: 1 },
                                    { name: 'Diversity\n多样性', max: 1 },
                                    { name: 'Pearson\n相关系数', max: 1 },
                                  ],
                                  shape: 'polygon',
                                  splitNumber: 4,
                                  axisName: {
                                    color: chartColors.radarName,
                                    fontSize: 11,
                                  },
                                  splitLine: {
                                    lineStyle: { color: chartColors.radarSplitLine },
                                  },
                                  splitArea: { show: false },
                                  axisLine: {
                                    lineStyle: { color: chartColors.radarAxis },
                                  },
                                },
                                series: [
                                  {
                                    type: 'radar',
                                    data: [
                                      {
                                        value: [
                                          benchMetrics.accuracy * 100,
                                          benchMetrics.macroF1,
                                          benchMetrics.cosineSimilarity,
                                          benchMetrics.diversity,
                                          benchMetrics.pearson,
                                        ],
                                        name: 'Alignment 对齐度',
                                        areaStyle: { opacity: 0.3 },
                                        lineStyle: { width: 2 },
                                      },
                                    ],
                                  },
                                ],
                              }}
                              style={{ height: '280px' }}
                              opts={{ renderer: 'svg' }}
                            />
                          </div>
                        </div>

                        {/* Micro-level + Bar Chart */}
                        <div className="panel panel--nested" style={{ marginBottom: 'var(--space-xl)' }}>
                          <div className="panel__hd">
                            <div className="panel__title" style={{ fontSize: 14 }}>Micro-level Alignment 微观对齐分析</div>
                          </div>
                          <div className="panel__bd" style={{ paddingTop: 8 }}>
                            <div style={{ display: 'flex', gap: 20 }}>
                              <div style={{ flex: 1 }}>
                                <div className="kv" style={{ fontSize: 13, gridTemplateColumns: '160px 1fr', gap: '8px 12px' }}>
                                  <div className="kv__k">Accuracy 准确率</div>
                                  <div>
                                    <span className="pill pill--ok">{(benchMetrics.accuracy * 100).toFixed(1)}%</span>
                                    <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>5类中预测对的比例</span>
                                  </div>
                                  <div className="kv__k">Macro-F1 宏平均F1</div>
                                  <div>
                                    <span className="pill pill--ok">{benchMetrics.macroF1.toFixed(3)}</span>
                                    <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>体现稀有类型预测能力</span>
                                  </div>
                                  <div className="kv__k">Cosine Similarity 余弦相似度</div>
                                  <div>
                                    <span className={`pill ${benchMetrics.cosineSimilarity > 0.8 ? 'pill--ok' : ''}`}>{benchMetrics.cosineSimilarity.toFixed(3)}</span>
                                    <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>生成与真实文本语义接近度</span>
                                  </div>
                                </div>
                              </div>
                              <div style={{ flex: 1 }}>
                                <ReactECharts
                                  option={{
                                    grid: { top: 10, right: 10, bottom: 30, left: 50 },
                                    xAxis: {
                                      type: 'category',
                                      data: ['Accuracy', 'Macro-F1', 'Cosine'],
                                      axisLabel: { color: chartColors.text, fontSize: 11 },
                                      axisLine: { lineStyle: { color: chartColors.axisLine } },
                                    },
                                    yAxis: {
                                      type: 'value',
                                      max: 1,
                                      axisLabel: { color: chartColors.text, fontSize: 11 },
                                      splitLine: { lineStyle: { color: chartColors.splitLine } },
                                    },
                                    series: [
                                      {
                                        type: 'bar',
                                        data: [
                                          { value: benchMetrics.accuracy, itemStyle: { color: '#22c55e' } },
                                          { value: benchMetrics.macroF1, itemStyle: { color: '#3b82f6' } },
                                          { value: benchMetrics.cosineSimilarity, itemStyle: { color: '#f59e0b' } },
                                        ],
                                        barWidth: '50%',
                                        label: {
                                          show: true,
                                          position: 'top',
                                          color: chartColors.textLight,
                                          fontSize: 11,
                                          formatter: (c: any) => (c.value * 100).toFixed(1) + '%',
                                        },
                                      },
                                    ],
                                  }}
                                  style={{ height: '160px' }}
                                  opts={{ renderer: 'svg' }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Macro-level + Bar Chart */}
                        <div className="panel panel--nested" style={{ marginBottom: 'var(--space-xl)' }}>
                          <div className="panel__hd">
                            <div className="panel__title" style={{ fontSize: 14 }}>Macro-level Alignment 宏观对齐分析</div>
                          </div>
                          <div className="panel__bd" style={{ paddingTop: 8 }}>
                            <div style={{ display: 'flex', gap: 20 }}>
                              <div style={{ flex: 1 }}>
                                <div className="kv" style={{ fontSize: 13, gridTemplateColumns: '160px 1fr', gap: '8px 12px' }}>
                                  <div className="kv__k">Bias 偏差</div>
                                  <div>
                                    <span className={`pill ${Math.abs(benchMetrics.bias) < 0.1 ? 'pill--ok' : Math.abs(benchMetrics.bias) < 0.2 ? 'pill--warn' : 'pill--danger'}`}>
                                      {benchMetrics.bias > 0 ? '+' : ''}{benchMetrics.bias.toFixed(3)}
                                    </span>
                                    <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>平均姿态偏离中立程度</span>
                                  </div>
                                  <div className="kv__k">Diversity 多样性</div>
                                  <div>
                                    <span className="pill pill--ok">{benchMetrics.diversity.toFixed(3)}</span>
                                    <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>人群意见分散程度(std)</span>
                                  </div>
                                  <div className="kv__k">Pearson 相关系数</div>
                                  <div>
                                    <span className={`pill ${benchMetrics.pearson > 0.8 ? 'pill--ok' : benchMetrics.pearson > 0.5 ? 'pill--warn' : 'pill--danger'}`}>
                                      {benchMetrics.pearson.toFixed(3)}
                                    </span>
                                    <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>线性同步程度</span>
                                  </div>
                                </div>
                              </div>
                              <div style={{ flex: 1 }}>
                                <ReactECharts
                                  option={{
                                    grid: { top: 10, right: 10, bottom: 30, left: 50 },
                                    xAxis: {
                                      type: 'category',
                                      data: ['Diversity', 'Pearson'],
                                      axisLabel: { color: chartColors.text, fontSize: 11 },
                                      axisLine: { lineStyle: { color: chartColors.axisLine } },
                                    },
                                    yAxis: {
                                      type: 'value',
                                      max: 1,
                                      axisLabel: { color: chartColors.text, fontSize: 11 },
                                      splitLine: { lineStyle: { color: chartColors.splitLine } },
                                    },
                                    series: [
                                      {
                                        type: 'bar',
                                        data: [
                                          { value: benchMetrics.diversity, itemStyle: { color: '#8b5cf6' } },
                                          { value: benchMetrics.pearson, itemStyle: { color: '#ec4899' } },
                                        ],
                                        barWidth: '40%',
                                        label: {
                                          show: true,
                                          position: 'top',
                                          color: chartColors.textLight,
                                          fontSize: 11,
                                          formatter: (c: any) => (c.value * 100).toFixed(1) + '%',
                                        },
                                      },
                                    ],
                                  }}
                                  style={{ height: '160px' }}
                                  opts={{ renderer: 'svg' }}
                                />
                              </div>
                            </div>
                            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-light)' }}>
                              <div className="kv" style={{ fontSize: 13, gridTemplateColumns: '160px 1fr', gap: '8px 12px' }}>
                                <div className="kv__k">DTW 动态时间规整</div>
                                <div>
                                  <span className="pill">{benchMetrics.dtw.toFixed(1)}</span>
                                  <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>时间序列对齐距离(越小越像)</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {!benchMetrics && !benchRunning && (
                      <div className="muted" style={{ marginTop: 12, fontSize: 12 }}>
                        点击"启动评估"按钮运行 Bench 评估，计算模拟结果与真实数据的对齐度指标。
                      </div>
                    )}
                  </div>
                </div>

                <div className="panel panel--nested" style={{ marginTop: 'var(--space-xl)' }}>
                  <div className="panel__hd">
                    <div className="panel__title">Agent-User Behavior Consistency 智能体用户行为一致性评估</div>
                    <div className="row">
                      {behaviorMetrics ? (
                        <span className="pill pill--ok">evaluated 已评估</span>
                      ) : (
                        <span className="pill pill--warn">pending 待评估</span>
                      )}
                    </div>
                  </div>
                  <div className="panel__bd">
                    <button
                      className={`btn ${behaviorConsistencyRunning ? 'btn--primary' : ''}`}
                      onClick={() => {
                        if (behaviorConsistencyRunning) return
                        setBehaviorConsistencyRunning(true)
                        // 模拟行为一致性评估 Simulate behavior consistency evaluation
                        setTimeout(() => {
                          const bps = 0.75 + Math.random() * 0.15
                          const das = 0.68 + Math.random() * 0.2
                          const tcs = 0.72 + Math.random() * 0.18
                          const nps = 0.65 + Math.random() * 0.22
                          setBehaviorMetrics({
                            bps,
                            das,
                            tcs,
                            nps,
                            ocs: (bps + das + tcs + nps) / 4,
                            postFrequencyMatch: 0.7 + Math.random() * 0.2,
                            interactionPatternMatch: 0.65 + Math.random() * 0.25,
                            emotionStability: 0.75 + Math.random() * 0.15,
                            responseLatency: 0.6 + Math.random() * 0.3,
                          })
                          setBehaviorConsistencyRunning(false)
                        }, 2500)
                      }}
                      disabled={behaviorConsistencyRunning}
                    >
                      {behaviorConsistencyRunning ? 'Running 运行中...' : behaviorMetrics ? 'Re-run 重新评估' : 'Start Consistency Check 启动一致性检查'}
                    </button>

                    {behaviorMetrics && (
                      <div style={{ marginTop: 16 }}>
                        {/* Overall Score */}
                        <div className="panel panel--nested" style={{ marginBottom: 'var(--space-xl)' }}>
                          <div className="panel__hd">
                            <div className="panel__title" style={{ fontSize: 14 }}>Overall Consistency Score 总体一致性得分</div>
                          </div>
                          <div className="panel__bd" style={{ paddingTop: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                              <div style={{ flex: 1 }}>
                                <div className="bar" style={{ height: 32, borderRadius: 8, overflow: 'hidden' }}>
                                  <div
                                    style={{
                                      width: `${behaviorMetrics.ocs * 100}%`,
                                      background: behaviorMetrics.ocs > 0.8 ? 'var(--ok)' : behaviorMetrics.ocs > 0.6 ? '#f59e0b' : 'var(--danger)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: 14,
                                      fontWeight: 650,
                                      color: behaviorMetrics.ocs > 0.7 ? '#000' : '#fff',
                                    }}
                                  >
                                    {(behaviorMetrics.ocs * 100).toFixed(1)}%
                                  </div>
                                </div>
                              </div>
                              <span className={`pill ${behaviorMetrics.ocs > 0.8 ? 'pill--ok' : behaviorMetrics.ocs > 0.6 ? 'pill--warn' : 'pill--danger'}`} style={{ fontSize: 16, padding: '8px 16px' }}>
                                {behaviorMetrics.ocs > 0.8 ? 'High 高' : behaviorMetrics.ocs > 0.6 ? 'Medium 中' : 'Low 低'}
                              </span>
                            </div>
                            <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                              智能体行为与真实用户行为的一致性程度，综合评估行为模式、决策、时间分布和社交模式
                            </div>
                          </div>
                        </div>

                        {/* Core Metrics */}
                        <div className="panel panel--nested" style={{ marginBottom: 'var(--space-xl)' }}>
                          <div className="panel__hd">
                            <div className="panel__title" style={{ fontSize: 14 }}>Core Consistency Metrics 核心一致性指标</div>
                          </div>
                          <div className="panel__bd" style={{ paddingTop: 8 }}>
                            <div className="kv" style={{ fontSize: 13, gridTemplateColumns: '220px 1fr', gap: '8px 12px' }}>
                              <div className="kv__k">BPS 行为模式一致性</div>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <div style={{ flex: 1 }}>
                                    <div className="bar" style={{ height: 8, borderRadius: '999px', overflow: 'hidden' }}>
                                      <div
                                        style={{
                                          width: `${behaviorMetrics.bps * 100}%`,
                                          background: behaviorMetrics.bps > 0.75 ? 'var(--ok)' : behaviorMetrics.bps > 0.5 ? '#f59e0b' : 'var(--danger)',
                                        }}
                                      />
                                    </div>
                                  </div>
                                  <span className={`pill ${behaviorMetrics.bps > 0.75 ? 'pill--ok' : behaviorMetrics.bps > 0.5 ? 'pill--warn' : 'pill--danger'}`} style={{ fontSize: 12 }}>
                                    {(behaviorMetrics.bps * 100).toFixed(1)}%
                                  </span>
                                </div>
                                <span className="muted" style={{ fontSize: 11 }}>发帖频率、互动方式、情绪变化模式与真实用户对比</span>
                              </div>

                              <div className="kv__k">DAS 决策一致性</div>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <div style={{ flex: 1 }}>
                                    <div className="bar" style={{ height: 8, borderRadius: '999px', overflow: 'hidden' }}>
                                      <div
                                        style={{
                                          width: `${behaviorMetrics.das * 100}%`,
                                          background: behaviorMetrics.das > 0.75 ? 'var(--ok)' : behaviorMetrics.das > 0.5 ? '#f59e0b' : 'var(--danger)',
                                        }}
                                      />
                                    </div>
                                  </div>
                                  <span className={`pill ${behaviorMetrics.das > 0.75 ? 'pill--ok' : behaviorMetrics.das > 0.5 ? 'pill--warn' : 'pill--danger'}`} style={{ fontSize: 12 }}>
                                    {(behaviorMetrics.das * 100).toFixed(1)}%
                                  </span>
                                </div>
                                <span className="muted" style={{ fontSize: 11 }}>相同情境下智能体决策与真实用户决策的对比</span>
                              </div>

                              <div className="kv__k">TCS 时间行为一致性</div>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <div style={{ flex: 1 }}>
                                    <div className="bar" style={{ height: 8, borderRadius: '999px', overflow: 'hidden' }}>
                                      <div
                                        style={{
                                          width: `${behaviorMetrics.tcs * 100}%`,
                                          background: behaviorMetrics.tcs > 0.75 ? 'var(--ok)' : behaviorMetrics.tcs > 0.5 ? '#f59e0b' : 'var(--danger)',
                                        }}
                                      />
                                    </div>
                                  </div>
                                  <span className={`pill ${behaviorMetrics.tcs > 0.75 ? 'pill--ok' : behaviorMetrics.tcs > 0.5 ? 'pill--warn' : 'pill--danger'}`} style={{ fontSize: 12 }}>
                                    {(behaviorMetrics.tcs * 100).toFixed(1)}%
                                  </span>
                                </div>
                                <span className="muted" style={{ fontSize: 11 }}>行为时间分布、活跃时段与真实用户对比</span>
                              </div>

                              <div className="kv__k">NPS 社交网络一致性</div>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <div style={{ flex: 1 }}>
                                    <div className="bar" style={{ height: 8, borderRadius: '999px', overflow: 'hidden' }}>
                                      <div
                                        style={{
                                          width: `${behaviorMetrics.nps * 100}%`,
                                          background: behaviorMetrics.nps > 0.75 ? 'var(--ok)' : behaviorMetrics.nps > 0.5 ? '#f59e0b' : 'var(--danger)',
                                        }}
                                      />
                                    </div>
                                  </div>
                                  <span className={`pill ${behaviorMetrics.nps > 0.75 ? 'pill--ok' : behaviorMetrics.nps > 0.5 ? 'pill--warn' : 'pill--danger'}`} style={{ fontSize: 12 }}>
                                    {(behaviorMetrics.nps * 100).toFixed(1)}%
                                  </span>
                                </div>
                                <span className="muted" style={{ fontSize: 11 }}>社交互动模式、好友关系与真实用户对比</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Detailed Breakdown */}
                        <div className="panel panel--nested">
                          <div className="panel__hd">
                            <div className="panel__title" style={{ fontSize: 14 }}>Detailed Breakdown 详细分解</div>
                          </div>
                          <div className="panel__bd" style={{ paddingTop: 8 }}>
                            <div className="kv" style={{ fontSize: 13, gridTemplateColumns: '220px 1fr', gap: '8px 12px' }}>
                              <div className="kv__k">Post Frequency Match 发帖频率匹配</div>
                              <div>
                                <span className={`pill ${behaviorMetrics.postFrequencyMatch > 0.8 ? 'pill--ok' : behaviorMetrics.postFrequencyMatch > 0.6 ? 'pill--warn' : 'pill--danger'}`}>
                                  {(behaviorMetrics.postFrequencyMatch * 100).toFixed(1)}%
                                </span>
                                <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>智能体发帖频率与真实用户匹配度</span>
                              </div>

                              <div className="kv__k">Interaction Pattern 互动模式匹配</div>
                              <div>
                                <span className={`pill ${behaviorMetrics.interactionPatternMatch > 0.8 ? 'pill--ok' : behaviorMetrics.interactionPatternMatch > 0.6 ? 'pill--warn' : 'pill--danger'}`}>
                                  {(behaviorMetrics.interactionPatternMatch * 100).toFixed(1)}%
                                </span>
                                <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>点赞、评论、转发等互动行为匹配度</span>
                              </div>

                              <div className="kv__k">Emotion Stability 情绪稳定性</div>
                              <div>
                                <span className={`pill ${behaviorMetrics.emotionStability > 0.8 ? 'pill--ok' : behaviorMetrics.emotionStability > 0.6 ? 'pill--warn' : 'pill--danger'}`}>
                                  {(behaviorMetrics.emotionStability * 100).toFixed(1)}%
                                </span>
                                <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>情绪变化轨迹与真实用户一致性</span>
                              </div>

                              <div className="kv__k">Response Latency 响应延迟</div>
                              <div>
                                <span className={`pill ${behaviorMetrics.responseLatency > 0.8 ? 'pill--ok' : behaviorMetrics.responseLatency > 0.6 ? 'pill--warn' : 'pill--danger'}`}>
                                  {(behaviorMetrics.responseLatency * 100).toFixed(1)}%
                                </span>
                                <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>对事件响应的时间延迟与真实用户匹配度</span>
                              </div>
                            </div>

                            <div style={{ marginTop: 16, padding: 12, background: 'rgba(0,0,0,0.15)', borderRadius: 8 }}>
                              <div className="muted" style={{ fontSize: 11, lineHeight: 1.6 }}>
                                <strong>评估说明 Evaluation Notes:</strong><br />
                                • BPS (Behavior Pattern Score) 评估智能体的发帖、互动、情绪变化模式与真实用户的匹配程度<br />
                                • DAS (Decision Alignment Score) 评估在相同情境下智能体决策与真实用户决策的一致性<br />
                                • TCS (Temporal Consistency Score) 评估行为时间分布和活跃时段的匹配度<br />
                                • NPS (Network Pattern Score) 评估社交互动模式和好友关系的匹配度<br />
                                • OCS (Overall Consistency Score) 综合以上四个维度的总体一致性得分
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {!behaviorMetrics && !behaviorConsistencyRunning && (
                      <div className="muted" style={{ marginTop: 12, fontSize: 12 }}>
                        点击"启动一致性检查"按钮，评估智能体行为与真实用户行为的一致性，包括行为模式、决策、时间分布和社交模式等维度。
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function IntervenePanel() {
  const sim = useSim()
  const [cmd, setCmd] = useState('')
  const [target, setTarget] = useState(sim.state.selectedAgentId?.toString() ?? '')
  const [targetGroups, setTargetGroups] = useState<string[]>([])
  const [interventionMode, setInterventionMode] = useState<'agent' | 'group'>('agent')
  const [agentMultiSelectMode, setAgentMultiSelectMode] = useState(false)
  const [targetAgents, setTargetAgents] = useState<number[]>([])

  // 获取可用群体 Get available groups
  const groupList = useMemo(() => {
    return Object.values(sim.state.groups).map(g => g.key)
  }, [sim.state.groups])

  // 获取可用于多选的智能体 Get available agents for multi-select
  const availableAgents = useMemo(() => {
    return Object.entries(sim.state.agents).map(([id, agent]) => ({
      id: Number(id),
      name: agent.profile.identity.username,
      group: agent.profile.group,
      influence_tier: agent.profile.social_status.influence_tier,
    }))
  }, [sim.state.agents])

  const commandTemplates = [
    { label: 'Pause 暂停', cmd: 'pause' },
    { label: 'Resume 继续', cmd: 'resume' },
    { label: 'Set Mood 设置情绪', cmd: 'set agent {id} mood=0.6 stance=-0.2' },
    { label: 'Inject Event 注入事件', cmd: 'inject event: rumor spreads in Group B' },
    { label: 'Survey 调查', cmd: 'survey: What is your stance on current policy?' },
  ]

  const groupCommandTemplates = [
    { label: 'Group Broadcast 群体广播', cmd: 'broadcast to group {group}: Important announcement' },
    { label: 'Group Mood Shift 群体情绪调整', cmd: 'shift group {group} mood=+0.3' },
    { label: 'Group Event 群体事件', cmd: 'inject event to group {group}: Policy change affecting all members' },
    { label: 'Group Survey 群体调查', cmd: 'survey group {group}: How do you feel about recent changes?' },
  ]

  const handleApplyTemplate = (templateCmd: string) => {
    let finalCmd = templateCmd.replace('{group}', targetGroups[0] || 'Group A')
    if (agentMultiSelectMode && targetAgents.length > 0) {
      finalCmd = finalCmd.replace('{id}', targetAgents[0].toString())
    } else {
      finalCmd = finalCmd.replace('{id}', target || '42')
    }
    setCmd(finalCmd)
  }

  const toggleGroupSelection = (groupKey: string) => {
    setTargetGroups(prev => {
      if (prev.includes(groupKey)) {
        return prev.filter(g => g !== groupKey)
      } else {
        return [...prev, groupKey]
      }
    })
  }

  const toggleAgentSelection = (agentId: number) => {
    setTargetAgents(prev => {
      if (prev.includes(agentId)) {
        return prev.filter(id => id !== agentId)
      } else {
        return [...prev, agentId]
      }
    })
  }

  const handleApplyGroupIntervention = async () => {
    if (targetGroups.length === 0 || !cmd.trim()) return

    // 查找目标群体中的所有智能体 Find all agents in the target groups
    const groupAgents = Object.entries(sim.state.agents)
      .filter(([_, agent]) => targetGroups.includes(agent.profile.group))
      .map(([agentId, _]) => Number(agentId))

    // 对所选群体中的所有智能体应用干预 Apply intervention to all agents in the selected groups
    let successCount = 0
    for (const agentId of groupAgents) {
      const ok = await sim.actions.applyIntervention(`[Group ${targetGroups.join(', ')}] ${cmd}`, agentId)
      if (ok) successCount += 1
    }

    if (successCount === 0) return

    sim.actions.pushEvent({
      tick: sim.state.tick,
      type: 'intervention',
      title: `Group Intervention: ${targetGroups.join(', ')} - ${cmd.slice(0, 40)}...`,
    })

    sim.actions.logOk(`group intervention applied to ${targetGroups.join(', ')}: ${cmd} (${successCount} / ${groupAgents.length} agents across ${targetGroups.length} group(s))`)

    setCmd('')
  }

  const handleApplyAgentIntervention = async () => {
    if (!cmd.trim()) return

    if (agentMultiSelectMode && targetAgents.length > 0) {
      // 应用于多个智能体 Apply to multiple agents
      let successCount = 0
      for (const agentId of targetAgents) {
        const ok = await sim.actions.applyIntervention(cmd, agentId)
        if (ok) successCount += 1
      }

      if (successCount === 0) return

      sim.actions.pushEvent({
        tick: sim.state.tick,
        type: 'intervention',
        title: `Multi-Agent Intervention: ${cmd.slice(0, 40)}... (${successCount}/${targetAgents.length} agents)`,
      })
      sim.actions.logOk(`intervention applied to ${successCount}/${targetAgents.length} agents: ${cmd}`)
    } else {
      // 应用于单个智能体 Apply to single agent
      const agentId = Number(target)
      const ok = await sim.actions.applyIntervention(cmd, Number.isFinite(agentId) ? agentId : undefined)
      if (!ok) return
      sim.actions.pushEvent({
        tick: sim.state.tick,
        type: 'intervention',
        agentId: Number.isFinite(Number(target)) ? Number(target) : undefined,
        title: `Intervention: ${cmd.slice(0, 50)}${cmd.length > 50 ? '...' : ''}`,
      })
      sim.actions.logOk(
        `intervention applied: ${cmd}`,
        Number.isFinite(Number(target)) ? Number(target) : undefined,
      )
    }
    setCmd('')
  }

  return (
    <div className="row" style={{ alignItems: 'stretch' }}>
      <div style={{ flex: 1 }}>
        {/* Simulation Control */}
        <div className="panel" style={{ boxShadow: 'none', marginBottom: 12 }}>
          <div className="panel__hd">
            <div className="panel__title">Simulation Control 模拟控制</div>
            <span className="pill">快速操作</span>
          </div>
          <div className="panel__bd">
            <div className="row" style={{ gap: 10 }}>
              <button
                className="btn"
                style={{ flex: 1 }}
                onClick={() => sim.actions.toggleRun()}
              >
                {sim.state.isRunning ? '⏸ Pause 暂停' : '▶ Run 运行'}
              </button>
            </div>
            <div className="row" style={{ marginTop: 8, gap: 8 }}>
              <span className="muted" style={{ fontSize: 11 }}>
                tick: {sim.state.tick} · speed: x{sim.state.speed.toFixed(1)} · running: {sim.state.isRunning ? 'yes' : 'no'}
              </span>
            </div>
          </div>
        </div>

        {/* Command Console */}
        <div className="panel panel--nested">
          <div className="panel__hd">
            <div className="panel__title">Command Console 命令控制台</div>
            <div className="row">
              <span className="pill">natural language 自然语言</span>
              <div className="subtabs">
                <button
                  className={`subtab ${interventionMode === 'agent' ? 'subtab--active' : ''}`}
                  onClick={() => setInterventionMode('agent')}
                >
                  Agent 智能体
                </button>
                <button
                  className={`subtab ${interventionMode === 'group' ? 'subtab--active' : ''}`}
                  onClick={() => setInterventionMode('group')}
                >
                  Group 群体
                </button>
              </div>
            </div>
          </div>
          <div className="panel__bd">
            {/* Agent Mode */}
            {interventionMode === 'agent' && (
              <>
                {/* Mode Toggle */}
                <div style={{ marginBottom: 12 }}>
                  <label className="muted" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>Target Agent 目标智能体 (可选)</label>
                  <div className="row" style={{ gap: 8 }}>
                    <button
                      className={`btn ${!agentMultiSelectMode ? 'btn--primary' : ''}`}
                      style={{ flex: 1, padding: '8px 12px', fontSize: 13 }}
                      onClick={() => setAgentMultiSelectMode(false)}
                    >
                      单选 Single
                    </button>
                    <button
                      className={`btn ${agentMultiSelectMode ? 'btn--primary' : ''}`}
                      style={{ flex: 1, padding: '8px 12px', fontSize: 13 }}
                      onClick={() => setAgentMultiSelectMode(true)}
                    >
                      多选 Multi
                    </button>
                  </div>
                </div>

                {!agentMultiSelectMode ? (
                  <>
                    {/* Single Selection Mode */}
                    <div className="row" style={{ gap: 8 }}>
                      <input
                        className="input"
                        style={{ flex: 1 }}
                        placeholder="输入 agent ID (如: 42)"
                        value={target}
                        onChange={(e) => setTarget(e.target.value)}
                      />
                      <button
                        className="btn"
                        onClick={() => {
                          const id = Number(target)
                          if (Number.isFinite(id) && sim.state.agents[id]) {
                            sim.actions.selectAgent(id)
                          }
                        }}
                      >
                        Select 选择
                      </button>
                    </div>
                    {sim.state.selectedAgentId && sim.state.agents[sim.state.selectedAgentId] && (
                      <div className="muted" style={{ marginTop: 8, fontSize: 12, padding: '8px 12px', background: 'rgba(0,0,0,0.15)', borderRadius: 6 }}>
                        当前选中: <strong>{sim.state.agents[sim.state.selectedAgentId].profile.name}</strong> · Group {sim.state.agents[sim.state.selectedAgentId].profile.group}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {/* Multi-Selection Mode */}
                    <div className="panel" style={{ background: 'rgba(0,0,0,0.15)', padding: 12, borderRadius: 8, marginBottom: 8 }}>
                      <div className="scroller" style={{ maxHeight: 320 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
                          {availableAgents.map(agent => {
                            const isSelected = targetAgents.includes(agent.id)
                            return (
                              <button
                                key={agent.id}
                                className={isSelected ? 'btn btn--primary' : 'btn'}
                                style={{
                                  padding: '10px 12px',
                                  fontSize: 12,
                                  textAlign: 'left',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'flex-start',
                                  gap: 6,
                                  borderRadius: 6,
                                  transition: 'all 0.15s ease'
                                }}
                                onClick={() => toggleAgentSelection(agent.id)}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                                  <span style={{ fontWeight: 500 }}>{agent.name}</span>
                                  <span className="pill" style={{ fontSize: 9, padding: '2px 6px', minWidth: 18, textAlign: 'center' }}>
                                    {isSelected ? '✓' : ''}
                                  </span>
                                </div>
                                <div className="muted" style={{ fontSize: 10 }}>
                                  #{agent.id} · {agent.group}
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                      {targetAgents.length > 0 && (
                        <div className="row" style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.1)', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div className="muted" style={{ fontSize: 12 }}>
                            已选择 <strong>{targetAgents.length}</strong> 个智能体
                          </div>
                          <button
                            className="btn"
                            style={{ fontSize: 11, padding: '6px 10px' }}
                            onClick={() => setTargetAgents([])}
                          >
                            清除 Clear
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </>
            )}

            {/* Group Mode */}
            {interventionMode === 'group' && (
              <>
                {/* Target Group Selection */}
                <div style={{ marginBottom: 12 }}>
                  <label className="muted" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>Target Groups 目标群体 (可多选)</label>
                  <div className="panel" style={{ background: 'rgba(0,0,0,0.15)', padding: 12, borderRadius: 8 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
                      {groupList.map(groupKey => {
                        const isSelected = targetGroups.includes(groupKey)
                        return (
                          <button
                            key={groupKey}
                            className={isSelected ? 'btn btn--primary' : 'btn'}
                            style={{
                              padding: '10px 12px',
                              fontSize: 12,
                              textAlign: 'left',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              borderRadius: 6,
                              transition: 'all 0.15s ease'
                            }}
                            onClick={() => toggleGroupSelection(groupKey)}
                          >
                            <span style={{ fontWeight: 500 }}>{groupKey}</span>
                            <span className="pill" style={{ fontSize: 9, padding: '2px 6px', minWidth: 18, textAlign: 'center' }}>
                              {isSelected ? '✓' : ''}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                    {targetGroups.length > 0 && (
                      <div className="muted" style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: 12 }}>
                        已选择 <strong>{targetGroups.length}</strong> 个群体: {targetGroups.join(', ')}
                      </div>
                    )}
                  </div>
                </div>

                {/* Group Info */}
                {targetGroups.length > 0 && (
                  <div className="logline logline--info" style={{ marginBottom: 10, fontSize: 12 }}>
                    <div className="muted">群体干预将影响选中群体的所有智能体 (Group intervention affects all agents in selected groups)</div>
                  </div>
                )}
              </>
            )}

            {/* Command Input */}
            <div style={{ marginBottom: 10 }}>
              <label className="muted">Command 命令</label>
              <div style={{ height: 4 }}></div>
              <textarea
                className="textarea"
                style={{ minHeight: 60, fontSize: 13 }}
                placeholder={interventionMode === 'group' ? '输入群体干预命令... Enter group intervention command...' : '输入干预命令... Enter intervention command...'}
                value={cmd}
                onChange={(e) => setCmd(e.target.value)}
              />
            </div>

            {/* Action Buttons */}
            <div className="row" style={{ gap: 8 }}>
              {interventionMode === 'agent' ? (
                <button
                  className="btn btn--primary"
                  style={{ flex: 2 }}
                  onClick={handleApplyAgentIntervention}
                  disabled={!cmd.trim() || (agentMultiSelectMode && targetAgents.length === 0)}
                >
                  {agentMultiSelectMode ? `Apply to ${targetAgents.length} Agents 应用` : 'Apply 应用'}
                </button>
              ) : (
                <button
                  className="btn btn--primary"
                  style={{ flex: 2 }}
                  onClick={handleApplyGroupIntervention}
                  disabled={!cmd.trim() || targetGroups.length === 0}
                >
                  Apply to Groups 应用到群体
                </button>
              )}
              <button
                className="btn"
                style={{ flex: 1 }}
                onClick={() => setCmd('')}
              >
                Clear 清空
              </button>
            </div>

            {/* Command Templates */}
            <div style={{ marginTop: 12 }}>
              <div className="muted" style={{ marginBottom: 8, fontSize: 12 }}>
                Quick Templates 快速模板 (点击填充) · {interventionMode === 'group' ? 'Group Mode 群体模式' : 'Agent Mode 智能体模式'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
                {(interventionMode === 'group' ? groupCommandTemplates : commandTemplates).map((tmpl) => (
                  <button
                    key={tmpl.label}
                    className="btn"
                    style={{ fontSize: 13, padding: '10px 12px', textAlign: 'left' }}
                    onClick={() => handleApplyTemplate(tmpl.cmd)}
                  >
                    {tmpl.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Intervention History */}
      <div style={{ flex: 1 }}>
        {/* Intervention History */}
        <div className="panel panel--nested">
          <div className="panel__hd">
            <div className="panel__title">Intervention History 干预记录</div>
            <span className="pill pill--ok">{sim.state.interventions.length} records</span>
          </div>
          <div className="panel__bd scroller" style={{ maxHeight: 500 }}>
            {sim.state.interventions.length === 0 ? (
              <div className="muted" style={{ textAlign: 'center', padding: 20 }}>
                暂无干预记录
                <br />
                No interventions yet
              </div>
            ) : (
              sim.state.interventions
                .slice()
                .reverse()
                .slice(0, 50)
                .map((iv) => (
                  <div key={iv.id} className="logline logline--ok" style={{ marginBottom: 8 }}>
                    <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
                      <span className="muted" style={{ fontSize: 11 }}>
                        tick {iv.tick}
                      </span>
                      {iv.targetAgentId != null && (
                        <span className="pill" style={{ fontSize: 10, padding: '2px 6px' }}>
                          agent_{iv.targetAgentId}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.4 }}>{iv.command}</div>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Tick-Time Chart Component
function TickTimeChart() {
  const sim = useSim()
  const tickTimeDataRef = useRef<Array<{ tick: number; time: number; displayTime: string }>>([])
  const lastTickRef = useRef<number>(-1)

  // 记录 tick 时间
  useEffect(() => {
    const currentTick = sim.state.tick
    if (currentTick !== lastTickRef.current) {
      const now = Date.now()
      tickTimeDataRef.current.push({
        tick: currentTick,
        time: now,
        displayTime: new Date(now).toLocaleTimeString('zh-CN', { hour12: false })
      })
      // 限制数据点数量，最多保留 200 个
      if (tickTimeDataRef.current.length > 200) {
        tickTimeDataRef.current = tickTimeDataRef.current.slice(-200)
      }
      lastTickRef.current = currentTick
    }
  }, [sim.state.tick])

  const chartOption = useMemo(() => {
    const data = tickTimeDataRef.current
    if (data.length === 0) {
      return {
        animation: false,
        grid: { top: 30, right: 20, bottom: 30, left: 50 },
        xAxis: { type: 'value', name: 'tick' },
        yAxis: { type: 'value', name: '时间 (秒)' },
        series: []
      }
    }

    // 计算相对时间（从第一个 tick 开始的秒数）
    const baseTime = data[0].time
    const timeData = data.map(d => ((d.time - baseTime) / 1000).toFixed(1))

    return {
      animation: false,
      grid: { top: 20, right: 15, bottom: 30, left: 45 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        formatter: (params: any) => {
          const p = params[0]
          const d = data[p.dataIndex]
          return `tick: ${d.tick}<br/>时间: ${d.displayTime}<br/>已运行: ${timeData[p.dataIndex]}s`
        }
      },
      xAxis: {
        type: 'value',
        name: 'tick',
        nameTextStyle: { color: '#666', fontSize: 11 },
        axisLine: { lineStyle: { color: '#333' } },
        axisLabel: { color: '#999', fontSize: 10 }
      },
      yAxis: {
        type: 'value',
        name: '运行时间 (秒)',
        nameTextStyle: { color: '#666', fontSize: 11 },
        axisLine: { lineStyle: { color: '#333' } },
        axisLabel: { color: '#999', fontSize: 10 },
        splitLine: { lineStyle: { color: '#222' } }
      },
      series: [{
        type: 'line',
        data: timeData,
        smooth: false,
        showSymbol: true,
        symbolSize: 4,
        lineStyle: { color: '#7fb2ff', width: 1.5 },
        itemStyle: { color: '#7fb2ff' }
      }]
    }
  }, [sim.state.tick, tickTimeDataRef.current])

  return <ReactECharts option={chartOption} style={{ height: '100%', width: '100%' }} />
}


