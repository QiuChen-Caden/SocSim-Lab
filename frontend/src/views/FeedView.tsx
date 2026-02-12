import { useEffect, useMemo, useState } from 'react'
import { useSim } from '../app/SimulationProvider'
import ReactECharts from 'echarts-for-react'

type SortMode = 'time' | 'emotion' | 'likes'
type StreamFilter = 'all' | 'post' | 'event' | 'log' | 'llm'

type StreamItem =
  | {
      kind: 'post'
      id: string
      tick: number
      authorName: string
      authorId: number
      content: string
      emotion: number
      likes: number
    }
  | {
      kind: 'event'
      id: string
      tick: number
      eventType: string
      title: string
      agentId?: number
    }
  | {
      kind: 'log'
      id: string
      tick: number
      level: 'info' | 'ok' | 'error'
      text: string
      agentId?: number
    }

const EXAMPLE_POSTS = [
  { authorName: 'LeafChronicle', authorId: 1, content: 'Black Lives Matter. Justice for all. #BLM', emotion: 0.8, likes: 45 },
  { authorName: 'MikkiChandler', authorId: 2, content: 'MeToo movement matters. Survivors deserve to be heard.', emotion: 0.65, likes: 78 },
]

export function FeedView() {
  const sim = useSim()
  const [mode] = useState<SortMode>('time')
  const [streamFilter, setStreamFilter] = useState<StreamFilter>('all')
  const [localSelectedId, setLocalSelectedId] = useState<number>(sim.state.selectedAgentId ?? 42)

  const selected = localSelectedId

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

  const stream = useMemo<StreamItem[]>(() => {
    const postItems: StreamItem[] = feed.map((p) => ({
      kind: 'post',
      id: `post-${p.id}`,
      tick: p.tick,
      authorName: p.authorName,
      authorId: p.authorId,
      content: p.content,
      emotion: p.emotion,
      likes: p.likes,
    }))

    const eventItems: StreamItem[] = sim.state.events
      .filter((e) => e.type === 'agent_action' || e.type === 'message' || e.type === 'intervention' || e.type === 'alert')
      .map((e) => ({
        kind: 'event',
        id: `event-${e.id}`,
        tick: e.tick,
        eventType: e.type,
        title: e.title,
        agentId: e.agentId,
      }))

    const logItems: StreamItem[] = sim.state.logs
      .filter((l) => l.text.includes('[Ticker]') || l.text.includes('[LLM]') || l.agentId != null)
      .map((l) => ({
        kind: 'log',
        id: `log-${l.id}`,
        tick: l.tick,
        level: l.level,
        text: l.text,
        agentId: l.agentId,
      }))

    return [...postItems, ...eventItems, ...logItems].sort((a, b) => b.tick - a.tick)
  }, [feed, sim.state.events, sim.state.logs])

  const feedStats = useMemo(() => {
    if (feed.length === 0) return null
    const emotions = feed.map((p) => p.emotion)
    const avgEmotion = emotions.reduce((a, b) => a + b, 0) / emotions.length
    const positiveCount = emotions.filter((e) => e > 0.2).length
    const negativeCount = emotions.filter((e) => e < -0.2).length
    const neutralCount = feed.length - positiveCount - negativeCount
    const totalLikes = feed.reduce((sum, p) => sum + p.likes, 0)
    const avgLikes = totalLikes / feed.length

    return { avgEmotion, positiveCount, negativeCount, neutralCount, totalLikes, avgLikes }
  }, [feed])

  const streamCounts = useMemo(() => {
    const counts = { post: 0, event: 0, log: 0, llm: 0 }
    for (const item of stream) {
      if (item.kind === 'log') {
        counts.log += 1
        if (item.text.includes('[LLM]')) {
          counts.llm += 1
        }
      } else {
        counts[item.kind] += 1
      }
    }
    return counts
  }, [stream])

  const filteredStream = useMemo(() => {
    if (streamFilter === 'all') return stream
    if (streamFilter === 'llm') {
      return stream.filter((item) => item.kind === 'log' && item.text.includes('[LLM]'))
    }
    return stream.filter((item) => item.kind === streamFilter)
  }, [stream, streamFilter])

  // 计算每个 tick 的信息量 - Optimized with pre-computed maps
  const activityChartOption = useMemo(() => {
    const maxTick = sim.state.tick || 1
    const tickData: number[] = []
    const postData: number[] = []
    const eventData: number[] = []
    const logData: number[] = []
    const totalData: number[] = []
    const activeAgentsData: number[] = []

    // Pre-compute tick-based maps for O(1) lookups instead of O(n) filters
    const feedByTick = new Map<number, typeof sim.state.feed>()
    const eventsByTick = new Map<number, typeof sim.state.events>()
    const logsByTick = new Map<number, typeof sim.state.logs>()

    // Build lookup maps
    for (const post of sim.state.feed) {
      if (!feedByTick.has(post.tick)) {
        feedByTick.set(post.tick, [])
      }
      feedByTick.get(post.tick)!.push(post)
    }

    for (const event of sim.state.events) {
      if (!eventsByTick.has(event.tick)) {
        eventsByTick.set(event.tick, [])
      }
      eventsByTick.get(event.tick)!.push(event)
    }

    for (const log of sim.state.logs) {
      if (!logsByTick.has(log.tick)) {
        logsByTick.set(log.tick, [])
      }
      logsByTick.get(log.tick)!.push(log)
    }

    // 统计每个 tick 的信息量 using O(1) lookups
    for (let t = 0; t <= maxTick; t++) {
      tickData.push(t)

      const postsAtTick = feedByTick.get(t) ?? []
      const postCount = postsAtTick.length
      const eventCount = (eventsByTick.get(t) ?? []).length
      const logCount = (logsByTick.get(t) ?? []).length
      const total = postCount + eventCount + logCount

      // 统计活跃 agents（该 tick 有发帖的 agents）
      const activeAgentIds = new Set(postsAtTick.map(p => p.authorId))
      const activeAgentsCount = activeAgentIds.size

      postData.push(postCount)
      eventData.push(eventCount)
      logData.push(logCount)
      totalData.push(total)
      activeAgentsData.push(activeAgentsCount)
    }

    return {
      animation: false,
      grid: { top: 60, right: 20, bottom: 30, left: 50 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' }
      },
      legend: {
        data: ['Active Agents 活跃智能体', 'Posts', 'Events', 'Logs', 'Total'],
        textStyle: { color: '#999', fontSize: 11 },
        top: 5,
        itemWidth: 20,
        itemHeight: 10,
        itemGap: 12
      },
      xAxis: {
        type: 'category',
        data: tickData,
        name: 'tick',
        nameTextStyle: { color: '#666' },
        axisLine: { lineStyle: { color: '#333' } },
        axisLabel: { color: '#999', fontSize: 10 }
      },
      yAxis: {
        type: 'value',
        name: 'count',
        nameTextStyle: { color: '#666' },
        axisLine: { lineStyle: { color: '#333' } },
        axisLabel: { color: '#999', fontSize: 10 },
        splitLine: { lineStyle: { color: '#222' } }
      },
      series: [
        {
          name: 'Active Agents 活跃智能体',
          type: 'line',
          data: activeAgentsData,
          smooth: true,
          showSymbol: false,
          lineStyle: { color: '#ff6b6b', width: 2 },
          itemStyle: { color: '#ff6b6b' }
        },
        {
          name: 'Posts',
          type: 'line',
          data: postData,
          smooth: true,
          showSymbol: false,
          lineStyle: { color: '#44ff44', width: 1.5 },
          itemStyle: { color: '#44ff44' }
        },
        {
          name: 'Events',
          type: 'line',
          data: eventData,
          smooth: true,
          showSymbol: false,
          lineStyle: { color: '#ffcc00', width: 1.5 },
          itemStyle: { color: '#ffcc00' }
        },
        {
          name: 'Logs',
          type: 'line',
          data: logData,
          smooth: true,
          showSymbol: false,
          lineStyle: { color: '#7fb2ff', width: 1.5 },
          itemStyle: { color: '#7fb2ff' }
        },
        {
          name: 'Total',
          type: 'line',
          data: totalData,
          smooth: true,
          showSymbol: false,
          lineStyle: { color: '#ff44ff', width: 2 },
          itemStyle: { color: '#ff44ff' }
        }
      ]
    }
  }, [sim.state.feed, sim.state.events, sim.state.logs, sim.state.tick])

  return (
    <div className="grid">
      <section className="panel">
        <div className="panel__hd">
          <div className="panel__title">Feed 信息流</div>
          <div className="row" style={{ marginTop: 8, gap: 8, flexWrap: 'wrap' }}>
            <button className={`btn ${streamFilter === 'all' ? 'btn--primary' : ''}`} onClick={() => setStreamFilter('all')}>
              全部 {stream.length}
            </button>
            <button className={`btn ${streamFilter === 'post' ? 'btn--primary' : ''}`} onClick={() => setStreamFilter('post')}>
              帖子 Posts {streamCounts.post}
            </button>
            <button className={`btn ${streamFilter === 'event' ? 'btn--primary' : ''}`} onClick={() => setStreamFilter('event')}>
              事件 Events {streamCounts.event}
            </button>
            <button className={`btn ${streamFilter === 'log' ? 'btn--primary' : ''}`} onClick={() => setStreamFilter('log')}>
              日志 Logs {streamCounts.log}
            </button>
            <button className={`btn ${streamFilter === 'llm' ? 'btn--primary' : ''}`} onClick={() => setStreamFilter('llm')}>
              LLM {streamCounts.llm}
            </button>
          </div>
        </div>

        <div className="panel__bd">
          {filteredStream.length === 0 ? (
            <>
              <div className="muted" style={{ marginBottom: 16 }}>暂无信息流，等待模拟产生内容。</div>
              <div className="muted" style={{ marginBottom: 12, fontWeight: 650 }}>示例帖子</div>
              {EXAMPLE_POSTS.map((p, i) => (
                <div key={`example-${i}`} className="post" style={{ opacity: 0.75 }}>
                  <div className="post__meta">
                    <div>
                      <b>{p.authorName}</b> <span className="muted">- agent_{p.authorId}</span>
                    </div>
                    <div><span className="pill pill--ok">example</span></div>
                  </div>
                  <div className="post__content">{p.content}</div>
                </div>
              ))}
            </>
          ) : (
            filteredStream.slice(0, 400).map((item) => {
              if (item.kind === 'post') {
                return (
                  <div key={item.id} className="post">
                    <div className="post__meta">
                      <div>
                        <b>{item.authorName}</b> <span className="muted">- agent_{item.authorId}</span>
                      </div>
                      <div>
                        <span className="pill pill--ok" style={{ marginRight: 6 }}>Post</span>
                        tick {item.tick}
                      </div>
                    </div>
                    <div className="post__content">{item.content}</div>
                  </div>
                )
              }

              if (item.kind === 'event') {
                return (
                  <div key={item.id} className="logline logline--info" style={{ marginBottom: 10, borderLeft: '3px solid var(--warn)' }}>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <span className="pill pill--warn">Event · {item.eventType}</span>
                      <span className="muted">tick {item.tick}</span>
                    </div>
                    <div style={{ marginTop: 6, fontSize: 13 }}>{item.title}</div>
                    {item.agentId != null && <div className="muted" style={{ marginTop: 4 }}>agent_{item.agentId}</div>}
                  </div>
                )
              }

              return (
                <div key={item.id} className={`logline ${item.level === 'error' ? 'logline--error' : item.level === 'ok' ? 'logline--ok' : 'logline--info'}`} style={{ marginBottom: 10, borderLeft: '3px solid var(--border)' }}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span className="pill">Log · {item.level}</span>
                    <span className="muted">tick {item.tick}</span>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 13 }}>{item.text}</div>
                  {item.agentId != null && <div className="muted" style={{ marginTop: 4 }}>agent_{item.agentId}</div>}

                  {/* 如果是 LLM 日志，显示该 tick 生成的帖子内容 */}
                  {item.text.includes('[LLM]') && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--border)' }}>
                      <div className="muted" style={{ fontSize: 11, marginBottom: 6 }}>LLM Generated Content 生成内容:</div>
                      {sim.state.feed
                        .filter(p => p.tick === item.tick && p.authorId !== 0) // 过滤掉 LLM Engine 自己的日志
                        .map(p => (
                          <div key={p.id} style={{ marginBottom: 8, padding: 8, background: 'rgba(0,0,0,0.15)', borderRadius: 6 }}>
                            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
                              <span className="muted" style={{ fontSize: 11 }}>{p.authorName}</span>
                              <span className="pill pill--ok" style={{ fontSize: 10, padding: '2px 6px' }}>Post</span>
                            </div>
                            <div style={{ fontSize: 13, lineHeight: 1.4 }}>{p.content}</div>
                            {p.emotion !== 0 && (
                              <div className="muted" style={{ marginTop: 4, fontSize: 10 }}>
                                emotion: {p.emotion > 0 ? '+' : ''}{p.emotion.toFixed(2)}
                              </div>
                            )}
                          </div>
                        ))}
                      {sim.state.feed.filter(p => p.tick === item.tick && p.authorId !== 0).length === 0 && (
                        <div className="muted" style={{ fontSize: 11, fontStyle: 'italic' }}>该 tick 无生成内容</div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </section>

      <aside style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        <div className="panel">
          <div className="panel__hd">
            <div className="panel__title">Metrics</div>
          </div>
          <div className="panel__bd" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="kv" style={{ gridTemplateColumns: '180px 1fr' }}>
              <div className="kv__k">Selected Agent 选中智能体</div>
              <div>agent_{selected}</div>
              <div className="kv__k">Current Tick 当前时间步</div>
              <div>{sim.state.tick}</div>
              <div className="kv__k">Posts 帖子数</div>
              <div>{feed.length}</div>
              <div className="kv__k">Stream Items 信息流</div>
              <div>{filteredStream.length} / {stream.length}</div>
            </div>

            {feedStats && (
              <div className="kv" style={{ gridTemplateColumns: '180px 1fr' }}>
                <div className="kv__k">Avg Emotion 平均情绪</div>
                <div>{feedStats.avgEmotion.toFixed(3)}</div>
                <div className="kv__k">Total Likes 总点赞</div>
                <div>{feedStats.totalLikes}</div>
                <div className="kv__k">Avg Likes 平均点赞</div>
                <div>{feedStats.avgLikes.toFixed(1)}</div>
                <div className="kv__k">Sentiment Split 情感分布</div>
                <div>+{feedStats.positiveCount} / 0{feedStats.neutralCount} / -{feedStats.negativeCount}</div>
              </div>
            )}
          </div>
        </div>

        <div className="panel" style={{ flex: 1, minHeight: 300 }}>
          <div className="panel__hd">
            <div className="panel__title">Activity 信息量统计</div>
            <span className="pill">per tick</span>
          </div>
          <div className="panel__bd" style={{ height: 280, minHeight: 280 }}>
            <ReactECharts option={activityChartOption} style={{ height: '100%', width: '100%' }} />
          </div>
        </div>
      </aside>
    </div>
  )
}
