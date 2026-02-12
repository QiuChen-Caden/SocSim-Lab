import type { PersonaStats } from '../../../../types';

interface StatsPanelProps {
  stats: PersonaStats;
}

export function StatsPanel({ stats }: StatsPanelProps) {
  return (
    <div style={{ marginTop: 12, padding: 12, border: '1px solid var(--border)', borderRadius: 10, background: 'rgba(0,0,0,0.2)' }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: 'var(--accent)' }}>
        生成统计 Generation Stats (Twitter Personas)
      </div>
      <div className="kv" style={{ fontSize: 13, gridTemplateColumns: '160px 1fr', lineHeight: 1.6 }}>
        <div className="kv__k">总智能体 Total Agents</div>
        <div>{stats.totalAgents}</div>

        <div className="kv__k">平均情绪 Avg Mood</div>
        <div>{stats.avgMood.toFixed(3)}</div>

        <div className="kv__k">平均立场 Avg Stance</div>
        <div>{stats.avgStance.toFixed(3)}</div>

        <div className="kv__k">平均资源 Avg Resources</div>
        <div>{stats.avgResources.toFixed(1)}</div>

        <div className="kv__k">平均文明度 Civility</div>
        <div>{stats.avgCivility.toFixed(3)}</div>

        <div className="kv__k">平均证据引用 Evidence</div>
        <div>{stats.avgEvidenceCitation.toFixed(3)}</div>

        <div className="kv__k" style={{ marginTop: 6, fontWeight: 600 }}>影响力层级 Influence Tier</div>
        <div style={{ marginTop: 6 }}>
          {Object.entries(stats.influenceTierDistribution).map(([k, v]) => (
            <span key={k} className="pill" style={{ marginRight: 6, marginBottom: 6, fontSize: 12, padding: '6px 10px' }}>
              {k}: {v}
            </span>
          ))}
        </div>

        <div className="kv__k" style={{ fontWeight: 600 }}>群体分布 Groups</div>
        <div>
          {Object.entries(stats.groupDistribution).slice(0, 4).map(([k, v]) => (
            <span key={k} className="pill pill--ok" style={{ marginRight: 6, marginBottom: 6, fontSize: 12, padding: '6px 10px' }}>
              {k}: {v}
            </span>
          ))}
        </div>

        <div className="kv__k" style={{ fontWeight: 600 }}>年龄分布 Age Bands</div>
        <div>
          {Object.entries(stats.ageBandDistribution).map(([k, v]) => (
            <span key={k} className="pill pill--warn" style={{ marginRight: 6, marginBottom: 6, fontSize: 12, padding: '6px 10px' }}>
              {k}: {v}
            </span>
          ))}
        </div>

        <div className="kv__k" style={{ fontWeight: 600 }}>性别分布 Gender</div>
        <div>
          {Object.entries(stats.genderDistribution).map(([k, v]) => (
            <span key={k} className="pill" style={{ marginRight: 6, marginBottom: 6, fontSize: 12, padding: '6px 10px' }}>
              {k}: {v}
            </span>
          ))}
        </div>

        <div className="kv__k" style={{ fontWeight: 600 }}>情绪分布 Sentiment</div>
        <div>
          {Object.entries(stats.sentimentDistribution).map(([k, v]) => (
            <span key={k} className="pill pill--info" style={{ marginRight: 6, marginBottom: 6, fontSize: 12, padding: '6px 10px' }}>
              {k}: {v}
            </span>
          ))}
        </div>

        <div className="kv__k" style={{ fontWeight: 600 }}>经济水平 Economic Band</div>
        <div>
          {Object.entries(stats.economicBandDistribution).map(([k, v]) => (
            <span key={k} className="pill pill--success" style={{ marginRight: 6, marginBottom: 6, fontSize: 12, padding: '6px 10px' }}>
              {k}: {v}
            </span>
          ))}
        </div>

        <div className="kv__k" style={{ fontWeight: 600 }}>热门议题 Top Topics</div>
        <div>
          {stats.topTopics.map(({ topic, count }) => (
            <span key={topic} className="pill pill--danger" style={{ marginRight: 6, marginBottom: 6, fontSize: 12, padding: '6px 10px' }}>
              {topic}: {count}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
