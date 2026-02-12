import { useMemo, useState } from 'react';
import { useSim } from '../app/SimulationProvider';
import { useFeedStats } from '../hooks';
import { Panel, Pill } from '../components/ui';
import type { StreamItem, SortMode, StreamFilter } from '../types/feed';
import ReactECharts from 'echarts-for-react';

const EXAMPLE_POSTS = [
  { authorName: 'LeafChronicle', authorId: 1, content: 'Black Lives Matter. Justice for all. #BLM', emotion: 0.8, likes: 45 },
  { authorName: 'MikkiChandler', authorId: 2, content: 'MeToo movement matters. Survivors deserve to be heard.', emotion: 0.65, likes: 78 },
];

export function FeedView() {
  const sim = useSim();
  const [mode] = useState<SortMode>('time');
  const [streamFilter, setStreamFilter] = useState<StreamFilter>('all');
  const [localSelectedId] = useState<number>(sim.state.selectedAgentId ?? 1);

  const selected = localSelectedId;

  const feed = useMemo(() => {
    const arr = [...sim.state.feed];
    if (mode === 'emotion') arr.sort((a, b) => Math.abs(b.emotion) - Math.abs(a.emotion));
    else if (mode === 'likes') arr.sort((a, b) => b.likes - a.likes);
    else arr.sort((a, b) => b.tick - a.tick);
    return arr;
  }, [mode, sim.state.feed]);

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
    }));

    const eventItems: StreamItem[] = sim.state.events
      .filter((e) => e.type === 'agent_action' || e.type === 'message' || e.type === 'intervention' || e.type === 'alert')
      .map((e) => ({
        kind: 'event',
        id: `event-${e.id}`,
        tick: e.tick,
        eventType: e.type,
        title: e.title,
        agentId: e.agentId,
      }));

    const logItems: StreamItem[] = sim.state.logs
      .filter((l) => l.text.includes('[Ticker]') || l.text.includes('[LLM]') || l.agentId != null)
      .map((l) => ({
        kind: 'log',
        id: `log-${l.id}`,
        tick: l.tick,
        level: l.level,
        text: l.text,
        agentId: l.agentId,
      }));

    return [...postItems, ...eventItems, ...logItems].sort((a, b) => b.tick - a.tick);
  }, [feed, sim.state.events, sim.state.logs]);

  const feedStats = useFeedStats(feed);

  const streamCounts = useMemo(() => {
    const counts = { post: 0, event: 0, log: 0, llm: 0 };
    for (const item of stream) {
      if (item.kind === 'log') {
        counts.log += 1;
        if (item.text?.includes('[LLM]')) {
          counts.llm += 1;
        }
      } else {
        counts[item.kind] += 1;
      }
    }
    return counts;
  }, [stream]);

  const filteredStream = useMemo(() => {
    if (streamFilter === 'all') return stream;
    if (streamFilter === 'llm') {
      return stream.filter((item) => item.kind === 'log' && item.text?.includes('[LLM]'));
    }
    return stream.filter((item) => item.kind === streamFilter);
  }, [stream, streamFilter]);

  const activityChartOption = useMemo(() => {
    const maxTick = sim.state.tick || 1;
    const tickData: number[] = [];
    const postData: number[] = [];
    const eventData: number[] = [];
    const logData: number[] = [];
    const totalData: number[] = [];
    const activeAgentsData: number[] = [];

    const feedByTick = new Map<number, typeof sim.state.feed>();
    const eventsByTick = new Map<number, typeof sim.state.events>();
    const logsByTick = new Map<number, typeof sim.state.logs>();

    for (const post of sim.state.feed) {
      if (!feedByTick.has(post.tick)) {
        feedByTick.set(post.tick, []);
      }
      feedByTick.get(post.tick)!.push(post);
    }

    for (const event of sim.state.events) {
      if (!eventsByTick.has(event.tick)) {
        eventsByTick.set(event.tick, []);
      }
      eventsByTick.get(event.tick)!.push(event);
    }

    for (const log of sim.state.logs) {
      if (!logsByTick.has(log.tick)) {
        logsByTick.set(log.tick, []);
      }
      logsByTick.get(log.tick)!.push(log);
    }

    for (let t = 0; t <= maxTick; t++) {
      tickData.push(t);

      const postsAtTick = feedByTick.get(t) ?? [];
      const postCount = postsAtTick.length;
      const eventCount = (eventsByTick.get(t) ?? []).length;
      const logCount = (logsByTick.get(t) ?? []).length;
      const total = postCount + eventCount + logCount;

      const activeAgentIds = new Set(postsAtTick.map((p) => p.authorId));
      const activeAgentsCount = activeAgentIds.size;

      postData.push(postCount);
      eventData.push(eventCount);
      logData.push(logCount);
      totalData.push(total);
      activeAgentsData.push(activeAgentsCount);
    }

    return {
      animation: false,
      grid: { top: 60, right: 20, bottom: 30, left: 50 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
      },
      legend: {
        data: ['Active Agents 活跃智能体', 'Posts', 'Events', 'Logs', 'Total'],
        textStyle: { color: '#999', fontSize: 11 },
        top: 5,
        itemWidth: 20,
        itemHeight: 10,
        itemGap: 12,
      },
      xAxis: {
        type: 'category',
        data: tickData,
        name: 'tick',
        nameTextStyle: { color: '#666' },
        axisLine: { lineStyle: { color: '#333' } },
        axisLabel: { color: '#999', fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        name: 'count',
        nameTextStyle: { color: '#666' },
        axisLine: { lineStyle: { color: '#333' } },
        axisLabel: { color: '#999', fontSize: 10 },
        splitLine: { lineStyle: { color: '#222' } },
      },
      series: [
        {
          name: 'Active Agents 活跃智能体',
          type: 'line',
          data: activeAgentsData,
          smooth: true,
          showSymbol: false,
          lineStyle: { color: '#ff6b6b', width: 2 },
          itemStyle: { color: '#ff6b6b' },
        },
        {
          name: 'Posts',
          type: 'line',
          data: postData,
          smooth: true,
          showSymbol: false,
          lineStyle: { color: '#44ff44', width: 1.5 },
          itemStyle: { color: '#44ff44' },
        },
        {
          name: 'Events',
          type: 'line',
          data: eventData,
          smooth: true,
          showSymbol: false,
          lineStyle: { color: '#ffcc00', width: 1.5 },
          itemStyle: { color: '#ffcc00' },
        },
        {
          name: 'Logs',
          type: 'line',
          data: logData,
          smooth: true,
          showSymbol: false,
          lineStyle: { color: '#7fb2ff', width: 1.5 },
          itemStyle: { color: '#7fb2ff' },
        },
        {
          name: 'Total',
          type: 'line',
          data: totalData,
          smooth: true,
          showSymbol: false,
          lineStyle: { color: '#ff44ff', width: 2 },
          itemStyle: { color: '#ff44ff' },
        },
      ],
    };
  }, [sim.state.feed, sim.state.events, sim.state.logs, sim.state.tick]);

  return (
    <div className="grid">
      <Panel
        title="Feed 信息流"
        actions={
          <div className="row" style={{ marginTop: 8, gap: 8, flexWrap: 'wrap' }}>
            <FilterButton active={streamFilter === 'all'} onClick={() => setStreamFilter('all')} count={stream.length}>
              全部
            </FilterButton>
            <FilterButton active={streamFilter === 'post'} onClick={() => setStreamFilter('post')} count={streamCounts.post}>
              帖子 Posts
            </FilterButton>
            <FilterButton active={streamFilter === 'event'} onClick={() => setStreamFilter('event')} count={streamCounts.event}>
              事件 Events
            </FilterButton>
            <FilterButton active={streamFilter === 'log'} onClick={() => setStreamFilter('log')} count={streamCounts.log}>
              日志 Logs
            </FilterButton>
            <FilterButton active={streamFilter === 'llm'} onClick={() => setStreamFilter('llm')} count={streamCounts.llm}>
              LLM
            </FilterButton>
          </div>
        }
      >
        {filteredStream.length === 0 ? (
          <>
            <div className="muted" style={{ marginBottom: 16 }}>
              暂无信息流，等待模拟产生内容。
            </div>
            <div className="muted" style={{ marginBottom: 12, fontWeight: 650 }}>
              示例帖子
            </div>
            {EXAMPLE_POSTS.map((p, i) => (
              <div key={`example-${i}`} className="post" style={{ opacity: 0.75 }}>
                <div className="post__meta">
                  <div>
                    <b>{p.authorName}</b> <span className="muted">- agent_{p.authorId}</span>
                  </div>
                  <div>
                    <Pill variant="ok">example</Pill>
                  </div>
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
                      <Pill variant="ok" style={{ marginRight: 6 }}>
                        Post
                      </Pill>
                      tick {item.tick}
                    </div>
                  </div>
                  <div className="post__content">{item.content}</div>
                </div>
              );
            }

            if (item.kind === 'event') {
              return (
                <div
                  key={item.id}
                  className="logline logline--info"
                  style={{ marginBottom: 10, borderLeft: '3px solid var(--warn)' }}
                >
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <Pill variant="warn">
                      Event · {item.eventType}
                    </Pill>
                    <span className="muted">tick {item.tick}</span>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 13 }}>{item.title}</div>
                  {item.agentId != null && <div className="muted" style={{ marginTop: 4 }}>agent_{item.agentId}</div>}
                </div>
              );
            }

            return (
              <div
                key={item.id}
                className={`logline ${item.level === 'error' ? 'logline--error' : item.level === 'ok' ? 'logline--ok' : 'logline--info'}`}
                style={{ marginBottom: 10, borderLeft: '3px solid var(--border)' }}
              >
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <Pill>
                    Log · {item.level}
                  </Pill>
                  <span className="muted">tick {item.tick}</span>
                </div>
                <div style={{ marginTop: 6, fontSize: 13 }}>{item.text}</div>
                {item.agentId != null && <div className="muted" style={{ marginTop: 4 }}>agent_{item.agentId}</div>}

                {item.text?.includes('[LLM]') && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--border)' }}>
                    <div className="muted" style={{ fontSize: 11, marginBottom: 6 }}>
                      LLM Generated Content 生成内容:
                    </div>
                    {sim.state.feed
                      .filter((p) => p.tick === item.tick && p.authorId !== 0)
                      .map((p) => (
                        <div
                          key={p.id}
                          style={{ marginBottom: 8, padding: 8, background: 'rgba(0,0,0,0.15)', borderRadius: 6 }}
                        >
                          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
                            <span className="muted" style={{ fontSize: 11 }}>
                              {p.authorName}
                            </span>
                            <Pill variant="ok" style={{ fontSize: 10, padding: '2px 6px' }}>
                              Post
                            </Pill>
                          </div>
                          <div style={{ fontSize: 13, lineHeight: 1.4 }}>{p.content}</div>
                          {p.emotion !== 0 && (
                            <div className="muted" style={{ marginTop: 4, fontSize: 10 }}>
                              emotion: {p.emotion > 0 ? '+' : ''}
                              {p.emotion.toFixed(2)}
                            </div>
                          )}
                        </div>
                      ))}
                    {sim.state.feed.filter((p) => p.tick === item.tick && p.authorId !== 0).length === 0 && (
                      <div className="muted" style={{ fontSize: 11, fontStyle: 'italic' }}>
                        该 tick 无生成内容
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </Panel>

      <aside style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        <Panel title="Metrics">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="kv" style={{ gridTemplateColumns: '180px 1fr' }}>
              <div className="kv__k">Selected Agent 选中智能体</div>
              <div>agent_{selected}</div>
              <div className="kv__k">Current Tick 当前时间步</div>
              <div>{sim.state.tick}</div>
              <div className="kv__k">Posts 帖子数</div>
              <div>{feed.length}</div>
              <div className="kv__k">Stream Items 信息流</div>
              <div>
                {filteredStream.length} / {stream.length}
              </div>
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
                <div>
                  +{feedStats.positiveCount} / 0{feedStats.neutralCount} / -{feedStats.negativeCount}
                </div>
              </div>
            )}
          </div>
        </Panel>

        <Panel title="Activity 信息量统计" actions={<Pill>per tick</Pill>} style={{ flex: 1, minHeight: 300 }}>
          <div style={{ height: 280, minHeight: 280 }}>
            <ReactECharts option={activityChartOption} style={{ height: '100%', width: '100%' }} />
          </div>
        </Panel>
      </aside>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
  count,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count: number;
}) {
  return (
    <button className={`btn ${active ? 'btn--primary' : ''}`} onClick={onClick}>
      {children} {count}
    </button>
  );
}
