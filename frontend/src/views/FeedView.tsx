import { useEffect, useMemo, useState } from 'react'
import { useSim } from '../app/SimulationProvider'

type SortMode = 'time' | 'emotion' | 'likes'

// Example posts for demonstration (using real Twitter personas)
const EXAMPLE_POSTS = [
  {
    authorName: 'LeafChronicle',
    authorId: 1,
    content: 'Black Lives Matter. Justice for all. #BLM',
    emotion: 0.8,
    likes: 45,
  },
  {
    authorName: 'MikkiChandler',
    authorId: 2,
    content: 'MeToo movement matters. Survivors deserve to be heard.',
    emotion: 0.65,
    likes: 78,
  },
  {
    authorName: 'RuthanneSanch12',
    authorId: 3,
    content: 'Time to impeach. This cannot stand. #Resistance',
    emotion: -0.5,
    likes: 112,
  },
  {
    authorName: 'ea_fuzz',
    authorId: 4,
    content: 'Support our law enforcement. They put their lives on the line.',
    emotion: -0.3,
    likes: 89,
  },
  {
    authorName: 'amygamie',
    authorId: 5,
    content: 'Racial justice IS public health. Cannot separate the two.',
    emotion: 0.7,
    likes: 156,
  },
  {
    authorName: 'JSunNews',
    authorId: 6,
    content: 'Breaking: Community protests continue into second week. Full coverage.',
    emotion: 0.2,
    likes: 234,
  },
  {
    authorName: 'SSHobbs',
    authorId: 11,
    content: 'This administration must answer. #TheResistance',
    emotion: -0.6,
    likes: 67,
  },
  {
    authorName: 'PPact',
    authorId: 12,
    content: 'HIV prevention resources available. Get tested, know your status.',
    emotion: 0.4,
    likes: 92,
  },
  {
    authorName: 'RecoveryRat',
    authorId: 17,
    content: 'Blue Lives Matter too. Police protect our communities.',
    emotion: -0.4,
    likes: 55,
  },
  {
    authorName: 'rbeestweets',
    authorId: 21,
    content: 'Back the blue. Support our officers. #BlueLivesMatter',
    emotion: -0.55,
    likes: 123,
  },
]

export function FeedView() {
  const sim = useSim()
  const [mode, setMode] = useState<SortMode>('time')
  const [localSelectedId, setLocalSelectedId] = useState<number>(sim.state.selectedAgentId ?? 42)

  // Sync with sim state
  const selected = localSelectedId

  // Update local state when sim state changes (from other components)
  useEffect(() => {
    const next = sim.state.selectedAgentId
    if (next != null && next !== localSelectedId) setLocalSelectedId(next)
  }, [localSelectedId, sim.state.selectedAgentId])

  const feed = useMemo(() => {
    const arr = [...sim.state.feed]
    if (mode === 'emotion') arr.sort((a, b) => Math.abs(b.emotion) - Math.abs(a.emotion))
    else if (mode === 'likes') arr.sort((a, b) => b.likes - a.likes)
    else arr.sort((a, b) => b.tick - a.tick)
    return arr
  }, [mode, sim.state.feed])

  // Calculate feed statistics
  const feedStats = useMemo(() => {
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
  }, [feed])

  return (
    <div className="grid">
      <section className="panel">
        <div className="panel__hd">
          <div className="panel__title">Feed 信息流</div>
          <div className="row">
            <span className="pill">排序可切换 Sortable</span>
            <select className="select" style={{ width: 180 }} value={mode} onChange={(e) => setMode(e.target.value as SortMode)}>
              <option value="time">time order 时间顺序</option>
              <option value="emotion">emotion intensity 情绪强度</option>
              <option value="likes">most liked 最多点赞</option>
            </select>
          </div>
        </div>

        <div className="panel__bd">
          {feed.length === 0 ? (
            <>
              <div className="muted" style={{ marginBottom: 16 }}>暂无帖子（等模拟跑一会儿）。No posts yet - wait for simulation to generate content.</div>
              <div className="muted" style={{ marginBottom: 12, fontWeight: 650 }}>示例帖子 Example Posts:</div>
              {EXAMPLE_POSTS.map((p, i) => (
                <div key={`example-${i}`} className="post" style={{ opacity: 0.75 }}>
                  <div className="post__meta">
                    <div>
                      <b>{p.authorName}</b> <span className="muted">· agent 智能体_{p.authorId}</span>
                    </div>
                    <div><span className="pill pill--ok">example 示例</span></div>
                  </div>
                  <div className="post__content">{p.content}</div>
                  <div style={{ marginTop: 10 }}>
                    <div className="muted" style={{ marginBottom: 6 }}>
                      emotion intensity 情绪强度
                    </div>
                    <div className="bar">
                      <div style={{ width: `${Math.round(((Math.abs(p.emotion) + 0.001) / 1.001) * 100)}%` }} />
                    </div>
                  </div>
                  <div className="row" style={{ marginTop: 10, gap: 16 }}>
                    <span className="muted">❤️ {p.likes} likes</span>
                    <span className={`pill ${p.emotion > 0.2 ? 'pill--ok' : p.emotion < -0.2 ? 'pill--danger' : ''}`}>
                      {p.emotion > 0.2 ? 'positive 积极' : p.emotion < -0.2 ? 'negative 消极' : 'neutral 中性'}
                    </span>
                  </div>
                </div>
              ))}
            </>
          ) : (
            feed.slice(0, 60).map((p) => (
              <div key={p.id} className="post">
                <div className="post__meta">
                  <div>
                    <b>{p.authorName}</b> <span className="muted">· agent 智能体_{p.authorId}</span>
                  </div>
                  <div>tick 时间步 {p.tick}</div>
                </div>
                <div className="post__content">{p.content}</div>
                <div style={{ marginTop: 10 }}>
                  <div className="muted" style={{ marginBottom: 6 }}>
                    emotion intensity 情绪强度
                  </div>
                  <div className="bar">
                    <div style={{ width: `${Math.round(((Math.abs(p.emotion) + 0.001) / 1.001) * 100)}%` }} />
                  </div>
                </div>
                <div className="row" style={{ marginTop: 10, gap: 16 }}>
                  <span className="muted">❤️ {p.likes} likes</span>
                  <span className={`pill ${p.emotion > 0.2 ? 'pill--ok' : p.emotion < -0.2 ? 'pill--danger' : ''}`}>
                    {p.emotion > 0.2 ? 'positive 积极' : p.emotion < -0.2 ? 'negative 消极' : 'neutral 中性'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <aside className="panel">
        <div className="panel__hd">
          <div className="panel__title">Metrics Dashboard 指标仪表板</div>
        </div>
        <div className="panel__bd" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Basic Stats - Compact Grid */}
          <div className="panel panel--nested">
            <div className="panel__hd" style={{ paddingBottom: 8 }}>
              <div className="panel__title" style={{ fontSize: 14 }}>Basic Stats 基础统计</div>
            </div>
            <div className="panel__bd" style={{ paddingTop: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px 16px' }}>
                <div>
                  <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>total posts 总帖子</div>
                  <div style={{ fontSize: 18, fontWeight: 600 }}>{feed.length}</div>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>current tick 时间步</div>
                  <div style={{ fontSize: 18, fontWeight: 600 }}>{sim.state.tick}</div>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>sort mode 排序</div>
                  <div><span className="pill">{mode}</span></div>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>selected agent 选中</div>
                  <div><span className="pill">agent_{selected}</span></div>
                </div>
              </div>
            </div>
          </div>

          {feedStats && (
            <>
              {/* Engagement - Card Style */}
              <div className="panel panel--nested">
                <div className="panel__hd" style={{ paddingBottom: 8 }}>
                  <div className="panel__title" style={{ fontSize: 14 }}>Engagement 参与度</div>
                </div>
                <div className="panel__bd" style={{ paddingTop: 0 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px 16px' }}>
                    <div>
                      <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>total likes 总点赞</div>
                      <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--ok)' }}>{feedStats.totalLikes.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>avg likes 平均</div>
                      <div style={{ fontSize: 20, fontWeight: 600 }}>{feedStats.avgLikes.toFixed(1)}</div>
                    </div>
                  </div>
                  {feedStats.mostEngaged && (
                    <div style={{ marginTop: 16, padding: 12, background: 'rgba(0,0,0,0.15)', borderRadius: 8 }}>
                      <div className="muted" style={{ fontSize: 11, marginBottom: 8 }}>Most Engaged 最受关注</div>
                      <div className="logline logline--info" style={{ fontSize: 12 }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>{feedStats.mostEngaged.authorName}</div>
                        <div style={{ marginBottom: 4 }}>{feedStats.mostEngaged.content.slice(0, 60)}...</div>
                        <div className="muted">❤️ {feedStats.mostEngaged.likes} likes</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Sentiment Distribution - Visual Enhanced */}
              <div className="panel panel--nested">
                <div className="panel__hd" style={{ paddingBottom: 8 }}>
                  <div className="panel__title" style={{ fontSize: 14 }}>Sentiment Distribution 情绪分布</div>
                </div>
                <div className="panel__bd" style={{ paddingTop: 0 }}>
                  {/* Sentiment Bar - Large Visual */}
                  <div style={{ marginBottom: 16 }}>
                    <div className="muted" style={{ marginBottom: 8, fontSize: 12 }}>Sentiment Bar 情绪分布条</div>
                    <div style={{ display: 'flex', height: 32, borderRadius: '999px', overflow: 'hidden', border: '1px solid var(--border)', position: 'relative' }}>
                      <div
                        style={{
                          width: `${(feedStats.positiveCount / feed.length) * 100}%`,
                          background: 'linear-gradient(135deg, var(--ok) 0%, var(--ok-dark) 100%)',
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
                          width: `${(feedStats.neutralCount / feed.length) * 100}%`,
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
                          width: `${(feedStats.negativeCount / feed.length) * 100}%`,
                          background: 'linear-gradient(135deg, var(--danger) 0%, var(--danger-dark) 100%)',
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
                      <span className="muted" style={{ fontSize: 11 }}>positive 积极</span>
                      <span className="muted" style={{ fontSize: 11 }}>neutral 中性</span>
                      <span className="muted" style={{ fontSize: 11 }}>negative 消极</span>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                    <div style={{ padding: 12, background: 'rgba(34, 197, 94, 0.1)',
border: '1px solid rgba(34, 197, 94, 0.2)',
borderRadius: '8px' }}>
                      <div className="muted" style={{ fontSize: 11, marginBottom: 6 }}>positive 积极</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                        <span className="pill pill--ok" style={{ fontSize: 18, fontWeight: 600 }}>{feedStats.positiveCount}</span>
                        <span className="muted" style={{ fontSize: 13 }}>{((feedStats.positiveCount / feed.length) * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                    <div style={{ padding: 12, background: 'rgba(239, 68, 68, 0.1)', borderRadius: 8, border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                      <div className="muted" style={{ fontSize: 11, marginBottom: 6 }}>negative 消极</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                        <span className="pill pill--danger" style={{ fontSize: 18, fontWeight: 600 }}>{feedStats.negativeCount}</span>
                        <span className="muted" style={{ fontSize: 13 }}>{((feedStats.negativeCount / feed.length) * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: 12, padding: 12, background: 'rgba(0,0,0,0.1)', borderRadius: 8 }}>
                    <div className="muted" style={{ fontSize: 11, marginBottom: 6 }}>neutral 中性</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span className="pill" style={{ fontSize: 18, fontWeight: 600 }}>{feedStats.neutralCount}</span>
                      <span className="muted" style={{ fontSize: 13 }}>{((feedStats.neutralCount / feed.length) * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <div className="muted" style={{ fontSize: 11, marginBottom: 6 }}>avg emotion 平均情绪</div>
                    <span className={`pill ${feedStats.avgEmotion > 0.2 ? 'pill--ok' : feedStats.avgEmotion < -0.2 ? 'pill--danger' : ''}`} style={{ fontSize: 16 }}>
                      {feedStats.avgEmotion > 0 ? '+' : ''}{feedStats.avgEmotion.toFixed(3)}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Polarization Index - Enhanced Visual */}
          <div className="panel panel--nested">
            <div className="panel__hd" style={{ paddingBottom: 8 }}>
              <div className="panel__title" style={{ fontSize: 14 }}>Polarization Index 极化指数</div>
            </div>
            <div className="panel__bd" style={{ paddingTop: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <div className="muted" style={{ fontSize: 11, marginBottom: 6 }}>current index 当前指数</div>
                  <span className={`pill ${(0.5 + 0.5 * Math.sin(sim.state.tick / 18)) > 0.6 ? 'pill--danger' : 'pill--warn'}`} style={{ fontSize: 20, fontWeight: 600, padding: '8px 16px' }}>
                    {(0.5 + 0.5 * Math.sin(sim.state.tick / 18)).toFixed(3)}
                  </span>
                </div>
                <div className="muted" style={{ fontSize: 11, textAlign: 'right', maxWidth: 120 }}>
                  {(0.5 + 0.5 * Math.sin(sim.state.tick / 18)) > 0.6 ? '⚠️ 高极化' : (0.5 + 0.5 * Math.sin(sim.state.tick / 18)) > 0.4 ? '⚡ 中等' : '✓ 低极化'}
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div className="muted" style={{ marginBottom: 8, fontSize: 12 }}>polarization trend 极化趋势</div>
                <div className="bar" style={{ height: 12, borderRadius: '999px' }}>
                  <div style={{ width: `${((0.5 + 0.5 * Math.sin(sim.state.tick / 18)) * 100)}%`, height: '100%', borderRadius: '999px' }} />
                </div>
              </div>
              <div className="muted" style={{ fontSize: 11, lineHeight: 1.5, padding: 10, background: 'rgba(0,0,0,0.1)', borderRadius: 6 }}>
                极化指数反映群体观点分化程度，值越高表示对立越严重。基于帖子情绪分布计算 (mock)。
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}
