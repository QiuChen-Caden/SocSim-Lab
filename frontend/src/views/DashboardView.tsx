import { useMemo, useRef, useEffect } from 'react';
import { useSim } from '../app/SimulationProvider';
import { useAgentStats, useFeedStats } from '../hooks';
import ReactECharts from 'echarts-for-react';
import type { FeedPost, TimelineEvent } from '../types';

// ─── palette ───
const C = {
  text: '#a9b4e8',
  textDim: '#6b7394',
  accent: '#5b8def',
  positive: '#22c55e',
  negative: '#ef4444',
  warn: '#f59e0b',
  panel: 'rgba(17,20,38,0.82)',
  border: 'rgba(255,255,255,0.08)',
  gridLine: 'rgba(255,255,255,0.06)',
};

const panelStyle: React.CSSProperties = {
  background: C.panel, borderRadius: 10, padding: 16,
  border: `1px solid ${C.border}`, overflow: 'hidden', display: 'flex', flexDirection: 'column',
};

// ─── MetricCard ───
function MetricCard({ title, value, color, sub }: { title: string; value: string; color: string; sub?: string }) {
  return (
    <div style={{
      flex: 1, background: C.panel, borderRadius: 10, padding: '18px 20px',
      border: `1px solid ${C.border}`, minWidth: 140,
    }}>
      <div style={{ fontSize: 12, color: C.textDim, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ─── EmotionTrendChart ───
function EmotionTrendChart({ feed, tick }: { feed: FeedPost[]; tick: number }) {
  const option = useMemo(() => {
    const W = 30;
    const start = Math.max(0, tick - W);
    const ticks: number[] = [];
    const avgData: number[] = [];
    const posData: number[] = [];
    const negData: number[] = [];
    for (let t = start; t <= tick; t++) {
      ticks.push(t);
      const posts = feed.filter(p => p.tick === t);
      if (posts.length === 0) { avgData.push(0); posData.push(0); negData.push(0); continue; }
      avgData.push(+(posts.reduce((s, p) => s + p.emotion, 0) / posts.length).toFixed(3));
      posData.push(posts.filter(p => p.emotion > 0.2).length);
      negData.push(posts.filter(p => p.emotion < -0.2).length);
    }
    return {
      animation: false, backgroundColor: 'transparent',
      grid: { top: 40, right: 16, bottom: 24, left: 44 },
      tooltip: { trigger: 'axis' as const },
      legend: { data: ['Avg Emotion', 'Positive', 'Negative'], textStyle: { color: C.textDim, fontSize: 10 }, top: 4 },
      xAxis: { type: 'category' as const, data: ticks, axisLabel: { color: C.textDim, fontSize: 9 }, axisLine: { lineStyle: { color: C.gridLine } } },
      yAxis: { type: 'value' as const, axisLabel: { color: C.textDim, fontSize: 9 }, splitLine: { lineStyle: { color: C.gridLine } } },
      series: [
        { name: 'Avg Emotion', type: 'line', data: avgData, smooth: true, showSymbol: false, lineStyle: { color: C.accent, width: 2 }, itemStyle: { color: C.accent } },
        { name: 'Positive', type: 'bar', data: posData, itemStyle: { color: C.positive }, barMaxWidth: 8 },
        { name: 'Negative', type: 'bar', data: negData, itemStyle: { color: C.negative }, barMaxWidth: 8 },
      ],
    };
  }, [feed, tick]);
  return <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />;
}

// ─── OpinionHeatmap ───
function OpinionHeatmap({ agents, groups, tick }: {
  agents: Record<number, { profile: { group: string }; state: { mood: number } }>;
  groups: Record<string, { label: string }>;
  tick: number;
}) {
  const option = useMemo(() => {
    const W = 20;
    const start = Math.max(0, tick - W);
    const groupKeys = Object.keys(groups);
    const tickLabels: string[] = [];
    const data: [number, number, number][] = [];

    for (let ti = 0; ti <= W; ti++) {
      const t = start + ti;
      tickLabels.push(String(t));
      groupKeys.forEach((gk, gi) => {
        const members = Object.values(agents).filter(a => a.profile.group === gk);
        if (members.length === 0) { data.push([ti, gi, 0]); return; }
        const base = members.reduce((s, a) => s + a.state.mood, 0) / members.length;
        const drift = Math.sin(t / 15 + gi * 2) * 0.15;
        data.push([ti, gi, +((base + drift) as number).toFixed(2)]);
      });
    }

    return {
      animation: false, backgroundColor: 'transparent',
      grid: { top: 16, right: 16, bottom: 30, left: 80 },
      tooltip: { position: 'top' as const },
      xAxis: { type: 'category' as const, data: tickLabels, axisLabel: { color: C.textDim, fontSize: 9 }, axisLine: { lineStyle: { color: C.gridLine } } },
      yAxis: { type: 'category' as const, data: groupKeys.map(k => groups[k]?.label ?? k), axisLabel: { color: C.textDim, fontSize: 10 }, axisLine: { lineStyle: { color: C.gridLine } } },
      visualMap: { min: -1, max: 1, calculable: false, orient: 'horizontal' as const, left: 'center', bottom: 0, show: false, inRange: { color: ['#ef4444', '#f59e0b', '#22c55e'] } },
      series: [{ type: 'heatmap', data, label: { show: false }, emphasis: { itemStyle: { shadowBlur: 6, shadowColor: 'rgba(0,0,0,0.5)' } } }],
    };
  }, [agents, groups, tick]);

  return <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />;
}

// ─── NetworkGraph ───
function NetworkGraph({ agents }: {
  agents: Record<number, { profile: { id: number; name: string; group: string }; state: { mood: number } }>;
}) {
  const option = useMemo(() => {
    const list = Object.values(agents);
    const nodes = list.map(a => {
      const m = a.state.mood;
      const color = m > 0.3 ? C.positive : m < -0.3 ? C.negative : C.warn;
      return { id: String(a.profile.id), name: a.profile.name, symbolSize: 14, itemStyle: { color }, category: a.profile.group };
    });
    // generate deterministic edges based on group + id proximity
    const edges: { source: string; target: string }[] = [];
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        if (a.profile.group === b.profile.group) {
          edges.push({ source: String(a.profile.id), target: String(b.profile.id) });
        } else if ((a.profile.id * 7 + b.profile.id * 13) % 11 < 2) {
          edges.push({ source: String(a.profile.id), target: String(b.profile.id) });
        }
      }
    }
    const categories = [...new Set(list.map(a => a.profile.group))].map(g => ({ name: g }));
    return {
      animation: false, backgroundColor: 'transparent',
      tooltip: {},
      legend: { data: categories.map(c => c.name), textStyle: { color: C.textDim, fontSize: 10 }, top: 4, type: 'scroll' as const },
      series: [{
        type: 'graph', layout: 'force', data: nodes, links: edges, categories,
        roam: true, draggable: true,
        label: { show: false },
        force: { repulsion: 120, edgeLength: [40, 100], gravity: 0.15 },
        lineStyle: { color: 'rgba(255,255,255,0.1)', width: 1 },
        emphasis: { focus: 'adjacency' as const, lineStyle: { width: 3 } },
      }],
    };
  }, [agents]);

  return <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />;
}

// ─── LiveFeed ───
function LiveFeed({ feed, events }: { feed: FeedPost[]; events: TimelineEvent[] }) {
  const listRef = useRef<HTMLDivElement>(null);
  const items = useMemo(() => {
    const posts = feed.slice(-15).map(p => ({ kind: 'post' as const, tick: p.tick, text: `${p.authorName}: ${p.content}`, emotion: p.emotion, id: p.id }));
    const evts = events.slice(-10).map(e => ({ kind: 'event' as const, tick: e.tick, text: e.title, emotion: 0, id: e.id }));
    return [...posts, ...evts].sort((a, b) => b.tick - a.tick).slice(0, 20);
  }, [feed, events]);

  useEffect(() => { listRef.current?.scrollTo({ top: 0 }); }, [items]);

  return (
    <div ref={listRef} style={{ flex: 1, overflowY: 'auto', fontSize: 12 }}>
      {items.map(it => (
        <div key={it.id} style={{
          padding: '6px 0', borderBottom: `1px solid ${C.border}`,
          display: 'flex', gap: 8, alignItems: 'baseline',
        }}>
          <span style={{ color: C.textDim, fontSize: 10, flexShrink: 0 }}>t{it.tick}</span>
          <span style={{
            flexShrink: 0, fontSize: 9, padding: '1px 5px', borderRadius: 3,
            background: it.kind === 'post' ? 'rgba(91,141,239,0.18)' : 'rgba(245,158,11,0.18)',
            color: it.kind === 'post' ? C.accent : C.warn,
          }}>{it.kind === 'post' ? 'POST' : 'EVT'}</span>
          <span style={{ color: C.text, lineHeight: 1.35 }}>{it.text}</span>
        </div>
      ))}
      {items.length === 0 && <div style={{ color: C.textDim, padding: 16 }}>Waiting for data...</div>}
    </div>
  );
}

// ─── Main View ───
export function DashboardView() {
  const { state } = useSim();
  const agentStats = useAgentStats(state.agents);
  const feedStats = useFeedStats(state.feed);

  const agentList = useMemo(() => Object.values(state.agents), [state.agents]);

  // ── metrics ──
  const polarization = useMemo(() => {
    if (agentList.length < 2) return 0;
    const stances = agentList.map(a => a.state.stance);
    const mean = stances.reduce((s, v) => s + v, 0) / stances.length;
    const variance = stances.reduce((s, v) => s + (v - mean) ** 2, 0) / stances.length;
    return Math.min(1, Math.sqrt(variance) * 2);
  }, [agentList]);

  const spreadRate = useMemo(() => {
    const window = 5;
    const recent = state.feed.filter(p => p.tick > state.tick - window && p.tick <= state.tick);
    return recent.length / Math.max(1, window);
  }, [state.feed, state.tick]);

  const activity = useMemo(() => {
    if (agentList.length === 0) return 0;
    return agentList.filter(a => a.state.lastAction !== 'idle').length / agentList.length;
  }, [agentList]);

  const avgMood = agentStats?.avgMood ?? 0;

  return (
    <div style={{
      display: 'grid', gridTemplateRows: 'auto 1fr 1fr', gridTemplateColumns: '1fr 1fr',
      gap: 12, padding: 12, height: '100%', color: C.text, boxSizing: 'border-box',
    }}>
      {/* Row 1: Metric cards */}
      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <MetricCard title="Polarization 极化指数" value={polarization.toFixed(2)} color={polarization > 0.6 ? C.negative : polarization > 0.3 ? C.warn : C.positive} sub="stance std x2" />
        <MetricCard title="Spread Rate 传播速度" value={spreadRate.toFixed(1)} color={C.accent} sub="posts / tick (5t window)" />
        <MetricCard title="Activity 活跃度" value={`${(activity * 100).toFixed(0)}%`} color={activity > 0.5 ? C.positive : C.warn} sub={`${agentList.filter(a => a.state.lastAction !== 'idle').length} / ${agentList.length}`} />
        <MetricCard title="Avg Mood 平均情绪" value={avgMood.toFixed(2)} color={avgMood > 0.2 ? C.positive : avgMood < -0.2 ? C.negative : C.warn} sub={feedStats ? `feed avg: ${feedStats.avgEmotion.toFixed(2)}` : ''} />
      </div>
      {/* Row 2: Emotion trend + Heatmap */}
      <div style={panelStyle}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: C.text }}>Emotion Trend 情绪趋势</div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <EmotionTrendChart feed={state.feed} tick={state.tick} />
        </div>
      </div>
      <div style={panelStyle}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: C.text }}>Opinion Heatmap 舆论热力图</div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <OpinionHeatmap agents={state.agents as any} groups={state.groups} tick={state.tick} />
        </div>
      </div>

      {/* Row 3: Network + Live feed */}
      <div style={panelStyle}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: C.text }}>Network Topology 网络拓扑</div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <NetworkGraph agents={state.agents as any} />
        </div>
      </div>
      <div style={panelStyle}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: C.text }}>Live Feed 实时信息流</div>
        <LiveFeed feed={state.feed} events={state.events} />
      </div>
    </div>
  );
}
