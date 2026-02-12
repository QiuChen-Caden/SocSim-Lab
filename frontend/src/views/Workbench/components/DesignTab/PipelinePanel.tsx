import { useState } from 'react';
import { useSim } from '../../../../app/SimulationProvider';
import { useAgentStats } from '../../../../hooks';
import { Panel, Pill } from '../../../../components/ui';
import { StatsPanel } from '../StatsPanel';
import { AgentProfileCard } from '../AgentProfileCard';

export function PipelinePanel() {
  const sim = useSim();
  const [reviewAgentId, setReviewAgentId] = useState<number>(1);
  const [agentSearchInput, setAgentSearchInput] = useState('1');
  const [showStats, setShowStats] = useState(false);
  const personaStats = useAgentStats(sim.state.agents);

  const handleRegenerate = () => {
    sim.actions.regeneratePersonas();
    sim.actions.pushEvent({
      tick: sim.state.tick,
      type: 'intervention',
      title: 'Regenerate personas (Twitter-based)',
    });
    sim.actions.logInfo('(user) regenerate personas (Twitter-based)');
    setShowStats(true);
  };

  const handleSearch = () => {
    const id = Number(agentSearchInput);
    if (Number.isFinite(id) && sim.state.agents[id]) {
      setReviewAgentId(id);
      sim.actions.selectAgent(id);
    }
  };

  return (
    <>
      <div className="muted" style={{ marginBottom: 10 }}>
        工作流程：按"导入 → 个人画像 → 分群 → 审阅/冻结版本"推进
      </div>

      {/* Import */}
      <Panel
        title="1) Import 导入"
        actions={<Pill variant="warn">pending 待开发</Pill>}
        variant="nested"
        className="mb-md"
      >
        <div className="muted" style={{ fontSize: 12, lineHeight: 1.35 }}>
          导入聊天记录/事件流/互动边（推荐含 agentId、时间戳、关系边），作为画像证据与分群特征。
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn" disabled>Import Chat Logs (todo)</button>
          <Pill>evidence 可追溯</Pill>
        </div>
      </Panel>

      {/* Individual Personas */}
      <Panel
        title="2) Individual Personas 个人画像"
        actions={<Pill variant="ok">ready 就绪</Pill>}
        variant="nested"
        className="mb-md"
      >
        <div className="muted" style={{ fontSize: 12, lineHeight: 1.35 }}>
          LLM/规则抽取个人维度：社会层级、职业、兴趣 + 认知画像（性格/偏差/媒介素养等）。
        </div>
        <div className="row" style={{ marginTop: 10, justifyContent: 'space-between' }}>
          <button className="btn btn--primary" onClick={handleRegenerate}>
            Regenerate Personas
          </button>
          <Pill>cognitive 认知画像</Pill>
        </div>

        {showStats && personaStats && <StatsPanel stats={personaStats} />}
      </Panel>

      {/* Group Builder */}
      <Panel
        title="3) Group Builder 分群"
        actions={<Pill variant="ok">ready 就绪</Pill>}
        variant="nested"
        className="mb-md"
      >
        <div className="muted" style={{ fontSize: 12, lineHeight: 1.35 }}>
          先按硬约束（社会层级/组织/地理）切分，再结合画像/关系图特征做聚类，产出群体规范与叙事。
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn">View Group Personas →</button>
          <Pill>{Object.keys(sim.state.groups).length} groups</Pill>
        </div>
      </Panel>

      {/* Review & Freeze */}
      <Panel
        title="4) Review & Freeze 审阅/冻结"
        actions={<Pill variant="ok">ready 就绪</Pill>}
        variant="nested"
      >
        <div className="muted" style={{ fontSize: 12, lineHeight: 1.35, marginBottom: 12 }}>
          审阅代表性 agent 的画像证据，合并/拆分群体，最后冻结为 Scenario 版本快照供 Run/Replay 复用。
        </div>

        {/* Agent Search */}
        <div className="panel panel--nested" style={{ marginBottom: 'var(--space-md)', background: 'rgba(0,0,0,0.15)', padding: 'var(--space-md)', borderRadius: 'var(--radius-sm)' }}>
          <div style={{ fontSize: 13, fontWeight: 650, marginBottom: 10, color: 'var(--accent)' }}>
            代表性 Agent 审阅 Representative Agents
          </div>
          <div className="row" style={{ gap: 8, marginBottom: 12 }}>
            <input
              className="input"
              style={{ flex: 1 }}
              placeholder="输入 agent ID 搜索 (如: 1)"
              value={agentSearchInput}
              onChange={(e) => setAgentSearchInput(e.target.value)}
            />
            <button className="btn btn--primary" onClick={handleSearch} disabled={!agentSearchInput.trim()}>
              搜索 Search
            </button>
          </div>

          {sim.state.agents[reviewAgentId] ? (
            <AgentProfileCard agent={sim.state.agents[reviewAgentId]} agentId={reviewAgentId} group={sim.state.groups[sim.state.agents[reviewAgentId].profile.group]} />
          ) : (
            <div className="muted" style={{ textAlign: 'center', padding: 16, fontSize: 12 }}>
              未找到 ID 为 {reviewAgentId} 的智能体
              <br />
              Agent with ID {reviewAgentId} not found
            </div>
          )}
        </div>
      </Panel>
    </>
  );
}
