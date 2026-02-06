import { useEffect, useMemo, useState } from 'react'
import { useSim } from '../app/SimulationProvider'

type SortMode = 'time' | 'emotion' | 'likes'
type StreamFilter = 'all' | 'post' | 'event' | 'log'

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
  const [mode, setMode] = useState<SortMode>('time')
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
    const counts = { post: 0, event: 0, log: 0 }
    for (const item of stream) {
      counts[item.kind] += 1
    }
    return counts
  }, [stream])

  const filteredStream = useMemo(() => {
    if (streamFilter === 'all') return stream
    return stream.filter((item) => item.kind === streamFilter)
  }, [stream, streamFilter])

  return (
    <div className="grid">
      <section className="panel">
        <div className="panel__hd">
          <div className="panel__title">Feed 信息流</div>
          <div className="row">
            <span className="pill">Mixed Stream</span>
            <select className="select" style={{ width: 180 }} value={mode} onChange={(e) => setMode(e.target.value as SortMode)}>
              <option value="time">time order</option>
              <option value="emotion">emotion intensity</option>
              <option value="likes">most liked</option>
            </select>
          </div>
          <div className="row" style={{ marginTop: 8, gap: 8, flexWrap: 'wrap' }}>
            <button className={`btn ${streamFilter === 'all' ? 'btn--primary' : ''}`} onClick={() => setStreamFilter('all')}>
              All {stream.length}
            </button>
            <button className={`btn ${streamFilter === 'post' ? 'btn--primary' : ''}`} onClick={() => setStreamFilter('post')}>
              Posts {streamCounts.post}
            </button>
            <button className={`btn ${streamFilter === 'event' ? 'btn--primary' : ''}`} onClick={() => setStreamFilter('event')}>
              Events {streamCounts.event}
            </button>
            <button className={`btn ${streamFilter === 'log' ? 'btn--primary' : ''}`} onClick={() => setStreamFilter('log')}>
              Logs {streamCounts.log}
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
                    <div className="row" style={{ marginTop: 10, gap: 16 }}>
                      <span className="muted">❤️ {item.likes} likes</span>
                      <span className={`pill ${item.emotion > 0.2 ? 'pill--ok' : item.emotion < -0.2 ? 'pill--danger' : ''}`}>
                        {item.emotion > 0.2 ? 'positive' : item.emotion < -0.2 ? 'negative' : 'neutral'}
                      </span>
                    </div>
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
                </div>
              )
            })
          )}
        </div>
      </section>

      <aside className="panel">
        <div className="panel__hd">
          <div className="panel__title">Metrics</div>
        </div>
        <div className="panel__bd" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="kv" style={{ gridTemplateColumns: '140px 1fr' }}>
            <div className="kv__k">Selected Agent</div>
            <div>agent_{selected}</div>
            <div className="kv__k">Current Tick</div>
            <div>{sim.state.tick}</div>
            <div className="kv__k">Posts</div>
            <div>{feed.length}</div>
            <div className="kv__k">Stream Items</div>
            <div>{filteredStream.length} / {stream.length}</div>
          </div>

          {feedStats && (
            <div className="kv" style={{ gridTemplateColumns: '140px 1fr' }}>
              <div className="kv__k">Avg Emotion</div>
              <div>{feedStats.avgEmotion.toFixed(3)}</div>
              <div className="kv__k">Total Likes</div>
              <div>{feedStats.totalLikes}</div>
              <div className="kv__k">Avg Likes</div>
              <div>{feedStats.avgLikes.toFixed(1)}</div>
              <div className="kv__k">Sentiment Split</div>
              <div>+{feedStats.positiveCount} / 0{feedStats.neutralCount} / -{feedStats.negativeCount}</div>
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}
