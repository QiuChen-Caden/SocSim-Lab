import { useEffect, useMemo, useState } from 'react';
import { useSim } from '../app/SimulationProvider';
import { buildEgoAgentGraph, buildSampleAgentGraph } from '../app/agentGraph';
import { clamp } from '../utils';
import api from '../api';
import { AgentGraphCanvasMemoized } from '../components/AgentGraph';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { PixiWorld } from '../components/PixiWorld';
import { Panel, Pill } from '../components/ui';

export function WorldView() {
  const sim = useSim();
  const selected = sim.state.selectedAgentId;
  const agent = selected != null ? sim.state.agents[selected] : null;
  const [search, setSearch] = useState(selected?.toString() ?? '1');
  const [pixiKey, setPixiKey] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(0.35);
  const [graphOpen, setGraphOpen] = useState(true);
  const [graphMode, setGraphMode] = useState<'ego' | 'sample'>('ego');
  const [realRelationEdges, setRealRelationEdges] = useState<
    Array<{ source: number; target: number; kind: 'follow' | 'group' | 'message'; strength: number }>
  >([]);

  const alerts = useMemo(
    () => sim.state.events.filter((e) => e.type === 'alert').slice(-3).reverse(),
    [sim.state.events]
  );

  useEffect(() => {
    let cancelled = false;
    const loadNetwork = async () => {
      try {
        const res = await api.visualization.getNetwork({ limit: 5000 });
        if (cancelled) return;
        if (Array.isArray(res.edges) && res.edges.length > 0) {
          setRealRelationEdges(res.edges);
        }
      } catch {
        // 保持回退图谱行为
      }
    };
    loadNetwork();
    const timer = window.setInterval(loadNetwork, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const groupProfile = useMemo(() => {
    if (!agent) return null;
    return sim.state.groups[agent.profile.group] ?? null;
  }, [agent, sim.state.groups]);

  const agentGraph = useMemo(() => {
    const maxNodes = 150;
    const sampleAgents = sim.state.config.sampleAgents;
    const seed = sim.state.config.seed;
    const focusId = selected ?? 1;
    const validAgentIds = Object.keys(sim.state.agents).map(Number);

    return graphMode === 'ego'
      ? buildEgoAgentGraph({ seed, focusId, sampleAgents, maxNodes, relationEdges: realRelationEdges, validAgentIds })
      : buildSampleAgentGraph({ seed, sampleAgents, maxNodes, ensureId: focusId, relationEdges: realRelationEdges, validAgentIds });
  }, [graphMode, selected, sim.state.agents, sim.state.config.sampleAgents, sim.state.config.seed, realRelationEdges]);

  const graphNodeMeta = useMemo(() => {
    const out: Record<number, { influenceTier?: string; mood?: number; stance?: number }> = {};
    for (const node of agentGraph.nodes) {
      const a = sim.state.agents[node.id];
      if (!a) continue;
      out[node.id] = {
        influenceTier: a.profile.social_status.influence_tier,
        mood: a.state.mood,
        stance: a.state.stance,
      };
    }
    return out;
  }, [agentGraph.nodes, sim.state.agents]);

  return (
    <div className="split">
      <section className="world">
        <Panel
          title="World View 世界视图"
          actions={
            <div className="row" style={{ alignItems: 'center' }}>
              <span className="pill">Legend 图例</span>
              <div
                aria-label="mood legend"
                style={{
                  width: 220,
                  height: 8,
                  background: 'linear-gradient(90deg, #ff4444 0%, #ffcc00 50%, #44ff44 100%)',
                  borderRadius: '999px',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              />
              <span className="muted" style={{ fontSize: 11 }}>
                mood: −1 消极 → +1 积极
              </span>
            </div>
          }
          className="world__canvas"
        >
          <div className="world__canvasBody">
            <ErrorBoundary title="World Canvas" onReset={() => setPixiKey((k) => k + 1)}>
              <PixiWorld key={pixiKey} zoomLevel={zoomLevel} onZoomChange={setZoomLevel} />
            </ErrorBoundary>
          </div>
        </Panel>

        {graphOpen && (
          <Panel
            title="Agent Graph 图谱（demo）"
            actions={<Pill>mode: {graphMode}</Pill>}
          >
            <div style={{ padding: 10 }}>
              <AgentGraphCanvasMemoized
                graph={agentGraph}
                focusId={selected ?? 1}
                nodeMetaById={graphNodeMeta}
                onSelectAgent={(id: number) => sim.actions.selectAgent(id)}
              />
              <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                click node to select · 说明：图谱为演示用，从采样中抽取最多 140 个节点，并生成确定性的 mock 连接。
              </div>
            </div>
          </Panel>
        )}

        <Panel
          title="Timeline 时间轴"
          actions={
            <div className="row">
              <button className="btn" onClick={() => sim.actions.toggleRun()}>
                {sim.state.isRunning ? 'Pause 暂停' : 'Run 运行'}
              </button>
              <button
                className="btn"
                onClick={() =>
                  sim.actions.pushEvent({
                    tick: sim.state.tick,
                    type: 'bookmark',
                    title: `Bookmark @tick ${sim.state.tick}`,
                  })
                }
              >
                Bookmark 书签
              </button>
              <select
                className="select"
                style={{ width: 120 }}
                value={sim.state.speed}
                onChange={(e) => sim.actions.setSpeed(Number(e.target.value))}
              >
                <option value={0.5}>x0.5</option>
                <option value={1}>x1</option>
                <option value={2}>x2</option>
                <option value={4}>x4</option>
                <option value={8}>x8</option>
              </select>
              <span className="pill">tick 时间步 {sim.state.tick}</span>
            </div>
          }
        >
          <input
            className="input"
            type="range"
            min={0}
            max={2000}
            step={1}
            value={clamp(sim.state.tick, 0, 2000)}
            onChange={(e) => sim.actions.setTick(Number(e.target.value))}
          />
        </Panel>
      </section>

      <aside className="panel">
        <div className="panel__hd">
          <div className="panel__title">Agent Inspector 智能体检查器</div>
          <div className="row">
            {alerts.length > 0 && <Pill variant="danger">alerts 警告: {alerts.length}</Pill>}
            {selected != null && <Pill>agent 智能体_{selected}</Pill>}
            <button className={`btn ${graphOpen ? 'btn--primary' : ''}`} onClick={() => setGraphOpen((v) => !v)}>
              {graphOpen ? 'Close 关闭' : 'Graph 图谱'}
            </button>
            {graphOpen && (
              <select
                className="select"
                style={{ width: 160 }}
                value={graphMode}
                onChange={(e) => setGraphMode(e.target.value === 'sample' ? 'sample' : 'ego')}
              >
                <option value="ego">ego network</option>
                <option value="sample">sample graph</option>
              </select>
            )}
          </div>
        </div>

        <div className="panel__bd">
          <Panel
            title="World Controls"
            actions={<Pill>把控件挪到右侧</Pill>}
            variant="nested"
            className="mb-md"
          >
            <div className="row">
              <div style={{ width: 210 }}>
                <label className="muted">mode</label>
                <select
                  className="select"
                  value={sim.state.config.viewportMode}
                  onChange={(e) => sim.actions.setConfig({ viewportMode: e.target.value as 'micro' | 'macro' })}
                >
                  <option value="micro">micro 微观 (sprites)</option>
                  <option value="macro">macro 宏观 (bins)</option>
                </select>
              </div>
              <div style={{ width: 210 }}>
                <label className="muted">sample</label>
                <select
                  className="select"
                  value={sim.state.config.sampleAgents}
                  onChange={(e) => sim.actions.setConfig({ sampleAgents: Number(e.target.value) })}
                >
                  <option value={1000}>1,000</option>
                  <option value={6000}>6,000</option>
                  <option value={20000}>20,000</option>
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <label className="muted">zoom</label>
                  <Pill>x{zoomLevel.toFixed(2)}</Pill>
                </div>
                <input
                  className="input"
                  type="range"
                  min={0.05}
                  max={5}
                  step={0.01}
                  value={zoomLevel}
                  onChange={(e) => setZoomLevel(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn" onClick={() => setPixiKey((k) => k + 1)}>
                Reset canvas
              </button>
              <button className="btn" onClick={() => setZoomLevel(0.35)}>
                Reset zoom
              </button>
            </div>
          </Panel>

          {selected == null || !agent ? (
            <div className="muted">
              点击世界中的实体，或在下方输入 agentId 进行选择。Click an entity in the world or enter agentId below to select.
            </div>
          ) : (
            <>
              <Panel
                title="Agent Profile 智能体画像"
                actions={
                  <div className="row">
                    <Pill>#{selected}</Pill>
                    <input
                      className="input"
                      style={{ width: 120, fontSize: 12 }}
                      placeholder="Jump to ID"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    <button
                      className="btn"
                      style={{ fontSize: 11, padding: '4px 10px' }}
                      onClick={() => {
                        const id = Number(search);
                        if (Number.isFinite(id)) sim.actions.selectAgent(id);
                      }}
                    >
                      跳转 Jump
                    </button>
                  </div>
                }
                variant="nested"
                className="mb-md"
              >
                <div style={{ paddingTop: 0 }}>
                  <div className="kv" style={{ marginBottom: 0, gridTemplateColumns: '160px 1fr', rowGap: '6px' }}>
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
                    <div>
                      {agent.profile.identity.location.country}, {agent.profile.identity.location.region_city}
                    </div>
                    <div className="kv__k">domains 专业领域</div>
                    <div>{agent.profile.identity.domain_of_expertise.join(', ')}</div>
                    <div className="kv__k">influence_tier 影响力</div>
                    <div>
                      <Pill variant="ok">{agent.profile.social_status.influence_tier}</Pill>
                    </div>
                    <div className="kv__k">economic_band 经济水平</div>
                    <div>{agent.profile.social_status.economic_band}</div>
                    <div className="kv__k">network_proxy 网络规模</div>
                    <div>{agent.profile.social_status.social_capital.network_size_proxy}</div>
                    <div className="kv__k">mood 情绪值</div>
                    <div>{agent.state.mood.toFixed(2)}</div>
                    <div className="kv__k">stance 立场</div>
                    <div>{agent.state.stance.toFixed(2)}</div>
                    <div className="kv__k">resources 资源</div>
                    <div>{agent.state.resources}</div>
                    <div className="kv__k">last action 最近行动</div>
                    <div>{agent.state.lastAction}</div>
                  </div>
                </div>
              </Panel>

              <Panel title="Psychometrics 心理测量" variant="nested" className="mb-md">
                <div className="muted" style={{ marginBottom: 8 }}>
                  Big Five Personality 大五人格（0..1）
                </div>
                {(
                  [
                    ['Openness (O) 开放性', agent.profile.psychometrics.personality.big_five.O],
                    ['Conscientiousness (C) 尽责性', agent.profile.psychometrics.personality.big_five.C],
                    ['Extraversion (E) 外向性', agent.profile.psychometrics.personality.big_five.E],
                    ['Agreeableness (A) 宜人性', agent.profile.psychometrics.personality.big_five.A],
                    ['Neuroticism (N) 神经质', agent.profile.psychometrics.personality.big_five.N],
                  ] as const
                ).map(([k, v]) => (
                  <div
                    key={k}
                    style={{ display: 'grid', gridTemplateColumns: '180px 1fr 38px', gap: 8, alignItems: 'center', marginBottom: 6 }}
                  >
                    <div className="muted" style={{ fontSize: 12 }}>
                      {k}
                    </div>
                    <div className="bar">
                      <div style={{ width: `${Math.round(clamp(v, 0, 1) * 100)}%` }} />
                    </div>
                    <div className="muted" style={{ fontSize: 12, textAlign: 'right' }}>
                      {v.toFixed(2)}
                    </div>
                  </div>
                ))}

                <div className="muted" style={{ margin: '15px 0 8px' }}>
                  Moral Foundations 道德基础（0..1）
                </div>
                {(
                  [
                    ['Care 关怀', agent.profile.psychometrics.values.moral_foundations.care],
                    ['Fairness 公平', agent.profile.psychometrics.values.moral_foundations.fairness],
                    ['Loyalty 忠诚', agent.profile.psychometrics.values.moral_foundations.loyalty],
                    ['Authority 权威', agent.profile.psychometrics.values.moral_foundations.authority],
                    ['Sanctity 神圣', agent.profile.psychometrics.values.moral_foundations.sanctity],
                  ] as const
                ).map(([k, v]) => (
                  <div
                    key={k}
                    style={{ display: 'grid', gridTemplateColumns: '140px 1fr 38px', gap: 8, alignItems: 'center', marginBottom: 6 }}
                  >
                    <div className="muted" style={{ fontSize: 12 }}>
                      {k}
                    </div>
                    <div className="bar">
                      <div style={{ width: `${Math.round(clamp(v, 0, 1) * 100)}%` }} />
                    </div>
                    <div className="muted" style={{ fontSize: 12, textAlign: 'right' }}>
                      {v.toFixed(2)}
                    </div>
                  </div>
                ))}
              </Panel>

              <Panel
                title="Cognitive State 认知状态"
                actions={<Pill variant="warn">{agent.profile.cognitive_state.core_affect.sentiment}</Pill>}
                variant="nested"
                className="mb-md"
              >
                <div className="kv" style={{ gridTemplateColumns: '140px 1fr', marginBottom: 10 }}>
                  <div className="kv__k">arousal 唤醒度</div>
                  <div>{agent.profile.cognitive_state.core_affect.arousal.toFixed(3)}</div>
                </div>

                {agent.profile.cognitive_state.issue_stances.length > 0 && (
                  <>
                    <div className="muted" style={{ margin: '10px 0 6px' }}>
                      Issue Stances 议题立场
                    </div>
                    {agent.profile.cognitive_state.issue_stances.map((stance, i) => (
                      <div key={i} className="logline logline--info" style={{ marginBottom: 6 }}>
                        {stance.topic}: support={stance.support.toFixed(2)}, certainty={stance.certainty.toFixed(2)}
                      </div>
                    ))}
                  </>
                )}
              </Panel>

              <Panel title="Behavior Profile 行为画像" variant="nested" className="mb-md">
                <div className="kv" style={{ gridTemplateColumns: '140px 1fr', marginBottom: 10 }}>
                  <div className="kv__k">posts_per_day 日发帖</div>
                  <div>{agent.profile.behavior_profile.posting_cadence.posts_per_day.toFixed(2)}</div>
                  <div className="kv__k">diurnal_pattern 时段</div>
                  <div>{agent.profile.behavior_profile.posting_cadence.diurnal_pattern.join(', ')}</div>
                  <div className="kv__k">civility 文明度</div>
                  <div>{agent.profile.behavior_profile.rhetoric_style.civility.toFixed(3)}</div>
                  <div className="kv__k">evidence_citation 证据</div>
                  <div>{agent.profile.behavior_profile.rhetoric_style.evidence_citation.toFixed(3)}</div>
                </div>
              </Panel>

              {groupProfile && (
                <Panel
                  title="Group Profile 群体画像"
                  actions={<Pill>{groupProfile.label}</Pill>}
                  variant="nested"
                  className="mb-md"
                >
                  <div className="kv" style={{ marginBottom: 8, gridTemplateColumns: '170px 1fr' }}>
                    <div className="kv__k">dominant stratum 主导阶层</div>
                    <div>{groupProfile.dominantStratum}</div>
                    <div className="kv__k">cohesion 凝聚力</div>
                    <div>{groupProfile.cohesion.toFixed(2)}</div>
                    <div className="kv__k">polarization 极化度</div>
                    <div>{groupProfile.polarization.toFixed(2)}</div>
                    <div className="kv__k">trust climate 信任氛围</div>
                    <div>{groupProfile.trustClimate.toFixed(2)}</div>
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {groupProfile.normSummary}
                  </div>
                </Panel>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
