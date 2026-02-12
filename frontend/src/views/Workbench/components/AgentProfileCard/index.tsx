import type { AgentProfile, AgentState, GroupProfile } from '../../../../types';

interface AgentProfileCardProps {
  agent: { profile: AgentProfile; state: AgentState };
  agentId: number;
  group: GroupProfile | null;
}

export function AgentProfileCard({ agent, agentId, group }: AgentProfileCardProps) {
  const { profile, state } = agent;

  return (
    <div>
      {/* Header */}
      <div className="panel" style={{ background: 'linear-gradient(135deg, rgba(65, 211, 159, 0.15) 0%, rgba(59, 130, 246, 0.15) 100%)', padding: '16px 20px', borderRadius: 8, marginBottom: 16, border: '1px solid rgba(65, 211, 159, 0.3)' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>
              @{profile.identity.username}
            </div>
            <div className="muted" style={{ fontSize: 12 }}>完整画像 Full Profile</div>
          </div>
          <span className="pill pill--ok" style={{ fontSize: 13, padding: '6px 14px', fontWeight: 600 }}>ID: {agentId}</span>
        </div>
      </div>

      {/* Identity */}
      <Section title="📋 Identity 身份信息" color="var(--ok)">
        <div className="kv" style={{ fontSize: 12, gridTemplateColumns: '150px 1fr', rowGap: '6px' }}>
          <div className="kv__k">username 用户名</div>
          <div>@{profile.identity.username}</div>
          <div className="kv__k">group 群体</div>
          <div>{profile.group}</div>
          <div className="kv__k">age_band 年龄段</div>
          <div>{profile.identity.age_band}</div>
          <div className="kv__k">gender 性别</div>
          <div>{profile.identity.gender}</div>
          <div className="kv__k">profession 职业</div>
          <div>{profile.identity.profession}</div>
          <div className="kv__k">location 地点</div>
          <div>{profile.identity.location.country}, {profile.identity.location.region_city}</div>
          <div className="kv__k">domains 专业领域</div>
          <div>{profile.identity.domain_of_expertise.join(', ')}</div>
        </div>
      </Section>

      {/* Psychometrics */}
      <Section title="🧠 Psychometrics 心理测量" color="var(--warn)">
        <div className="kv" style={{ fontSize: 12, gridTemplateColumns: '150px 1fr', rowGap: '6px' }}>
          <div className="kv__k">Big Five O 开放性</div>
          <div>{profile.psychometrics.personality.big_five.O.toFixed(3)}</div>
          <div className="kv__k">Big Five C 尽责性</div>
          <div>{profile.psychometrics.personality.big_five.C.toFixed(3)}</div>
          <div className="kv__k">Big Five E 外向性</div>
          <div>{profile.psychometrics.personality.big_five.E.toFixed(3)}</div>
          <div className="kv__k">Big Five A 宜人性</div>
          <div>{profile.psychometrics.personality.big_five.A.toFixed(3)}</div>
          <div className="kv__k">Big Five N 神经质</div>
          <div>{profile.psychometrics.personality.big_five.N.toFixed(3)}</div>
          <div className="kv__k">Moral: Care 关怀</div>
          <div>{profile.psychometrics.values.moral_foundations.care.toFixed(3)}</div>
          <div className="kv__k">Moral: Fairness 公平</div>
          <div>{profile.psychometrics.values.moral_foundations.fairness.toFixed(3)}</div>
          <div className="kv__k">Moral: Loyalty 忠诚</div>
          <div>{profile.psychometrics.values.moral_foundations.loyalty.toFixed(3)}</div>
        </div>
      </Section>

      {/* Social Status */}
      <Section title="👑 Social Status 社会地位" color="var(--info)">
        <div className="kv" style={{ fontSize: 12, gridTemplateColumns: '150px 1fr', rowGap: '6px' }}>
          <div className="kv__k">influence_tier 影响力</div>
          <div><span className="pill pill--ok">{profile.social_status.influence_tier}</span></div>
          <div className="kv__k">economic_band 经济</div>
          <div><span className="pill">{profile.social_status.economic_band}</span></div>
          <div className="kv__k">network_size_proxy 网络</div>
          <div>{profile.social_status.social_capital.network_size_proxy}</div>
        </div>
      </Section>

      {/* Behavior Profile */}
      <Section title="📊 Behavior Profile 行为画像" color="#a855f7">
        <div className="kv" style={{ fontSize: 12, gridTemplateColumns: '150px 1fr', rowGap: '6px' }}>
          <div className="kv__k">posts_per_day 日发帖</div>
          <div>{profile.behavior_profile.posting_cadence.posts_per_day.toFixed(2)}</div>
          <div className="kv__k">diurnal_pattern 时段</div>
          <div>{profile.behavior_profile.posting_cadence.diurnal_pattern.join(', ')}</div>
          <div className="kv__k">civility 文明度</div>
          <div>{profile.behavior_profile.rhetoric_style.civility.toFixed(3)}</div>
          <div className="kv__k">evidence_citation 证据</div>
          <div>{profile.behavior_profile.rhetoric_style.evidence_citation.toFixed(3)}</div>
        </div>
      </Section>

      {/* Cognitive State */}
      <Section title="💭 Cognitive State 认知状态" color="#f97316">
        <div className="kv" style={{ fontSize: 12, gridTemplateColumns: '150px 1fr', rowGap: '6px' }}>
          <div className="kv__k">sentiment 情绪</div>
          <div><span className="pill pill--warn">{profile.cognitive_state.core_affect.sentiment}</span></div>
          <div className="kv__k">arousal 唤醒度</div>
          <div>{profile.cognitive_state.core_affect.arousal.toFixed(3)}</div>
          <div className="kv__k">mood 情绪值</div>
          <div>{state.mood.toFixed(2)}</div>
          <div className="kv__k">stance 立场</div>
          <div>{state.stance.toFixed(2)}</div>
          <div className="kv__k">resources 资源</div>
          <div>{state.resources}</div>
        </div>
      </Section>

      {/* Issue Stances */}
      <Section title="🎯 Issue Stances 议题立场" color="#ef4444">
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {profile.cognitive_state.issue_stances.map((stance) => (
            <span key={stance.topic} className="pill pill--danger" style={{ fontSize: 11 }}>
              {stance.topic}: {stance.support.toFixed(2)} (c={stance.certainty.toFixed(2)})
            </span>
          ))}
        </div>
      </Section>

      {/* Group */}
      {group && (
        <div className="panel" style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%)', padding: '14px 16px', borderRadius: 8, border: '1px solid rgba(99, 102, 241, 0.3)' }}>
          <div style={{ fontSize: 14, fontWeight: 650, color: '#818cf8', marginBottom: 10 }}>
            🏛️ 所属群体 Group Profile
          </div>
          <div className="row" style={{ gap: 10, alignItems: 'center' }}>
            <span className="pill pill--ok" style={{ fontSize: 13 }}>{group.label}</span>
            <span className="muted" style={{ fontSize: 12 }}>凝聚力: {group.cohesion.toFixed(2)}</span>
            <span className="muted" style={{ fontSize: 12 }}>极化度: {group.polarization.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div className="panel" style={{ background: 'rgba(0,0,0,0.25)', padding: '14px 16px', borderRadius: 8, marginBottom: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ fontSize: 14, fontWeight: 650, color, marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        {title}
      </div>
      {children}
    </div>
  );
}
