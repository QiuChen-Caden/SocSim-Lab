import { useSim } from '../../../../app/SimulationProvider';
import { useAgentStats, useFeedStats } from '../../../../hooks';
import { Panel, Pill } from '../../../../components/ui';

export function AnalyzeTab() {
  const sim = useSim();
  const agentStats = useAgentStats(sim.state.agents);
  const feedStats = useFeedStats(sim.state.feed);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      {/* Agent Stats */}
      <Panel title="Agent Analysis 智能体分析" actions={<Pill>统计</Pill>}>
        {agentStats ? (
          <div className="kv" style={{ gridTemplateColumns: '160px 1fr' }}>
            <div className="kv__k">Total Agents</div>
            <div>{agentStats.totalAgents}</div>
            <div className="kv__k">Avg Mood</div>
            <div>{agentStats.avgMood.toFixed(3)}</div>
            <div className="kv__k">Avg Stance</div>
            <div>{agentStats.avgStance.toFixed(3)}</div>
            <div className="kv__k">Avg Resources</div>
            <div>{agentStats.avgResources.toFixed(1)}</div>
            <div className="kv__k">Groups</div>
            <div>{Object.keys(agentStats.groupDistribution).length}</div>
          </div>
        ) : (
          <div className="muted" style={{ textAlign: 'center', padding: 20 }}>暂无数据</div>
        )}
      </Panel>

      {/* Feed Stats */}
      <Panel title="Feed Analysis 信息流分析" actions={<Pill>统计</Pill>}>
        {feedStats ? (
          <div className="kv" style={{ gridTemplateColumns: '160px 1fr' }}>
            <div className="kv__k">Total Posts</div>
            <div>{sim.state.feed.length}</div>
            <div className="kv__k">Avg Emotion</div>
            <div>{feedStats.avgEmotion.toFixed(3)}</div>
            <div className="kv__k">Total Likes</div>
            <div>{feedStats.totalLikes}</div>
            <div className="kv__k">Avg Likes</div>
            <div>{feedStats.avgLikes.toFixed(1)}</div>
            <div className="kv__k">Sentiment</div>
            <div>+{feedStats.positiveCount} / 0{feedStats.neutralCount} / -{feedStats.negativeCount}</div>
          </div>
        ) : (
          <div className="muted" style={{ textAlign: 'center', padding: 20 }}>暂无数据</div>
        )}
      </Panel>

      {/* Events Timeline */}
      <Panel title="Event Timeline 事件时间线" actions={<Pill>{sim.state.events.length} 条</Pill>} className="col-span-2">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflow: 'auto' }}>
          {sim.state.events.slice(-50).reverse().map((event) => (
            <div key={event.id} className={`logline logline--${event.type === 'alert' ? 'error' : 'info'}`}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span>{event.title}</span>
                <Pill>{event.type}</Pill>
              </div>
              <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>tick {event.tick}</div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
