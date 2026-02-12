import { useState } from 'react';
import { useSim } from '../../../../app/SimulationProvider';
import { Panel, Pill } from '../../../../components/ui';

export function InterveneTab() {
  const sim = useSim();
  const [command, setCommand] = useState('');
  const [targetAgentId, setTargetAgentId] = useState('');

  const handleApply = async () => {
    if (!command.trim()) return;
    const success = await sim.actions.applyIntervention(
      command,
      targetAgentId ? Number(targetAgentId) : undefined
    );
    if (success) {
      setCommand('');
      setTargetAgentId('');
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      {/* Intervention Input */}
      <Panel title="Apply Intervention 应用干预" actions={<Pill>实时</Pill>}>
        <div style={{ marginBottom: 12 }}>
          <label className="muted">Command 命令</label>
          <input
            className="input"
            placeholder="输入干预命令 (如: boost_sentiment, reduce_polarization)"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label className="muted">Target Agent 目标智能体 (可选)</label>
          <input
            className="input"
            type="number"
            placeholder="输入 agent ID，留空为全局"
            value={targetAgentId}
            onChange={(e) => setTargetAgentId(e.target.value)}
          />
        </div>
        <button className="btn btn--primary" onClick={handleApply} disabled={!command.trim()}>
          执行干预 Execute
        </button>
      </Panel>

      {/* Recent Interventions */}
      <Panel title="Recent Interventions 最近干预" actions={<Pill>{sim.state.interventions.length} 条</Pill>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflow: 'auto' }}>
          {sim.state.interventions.length === 0 ? (
            <div className="muted" style={{ textAlign: 'center', padding: 20 }}>暂无干预记录</div>
          ) : (
            [...sim.state.interventions].reverse().slice(0, 20).map((iv) => (
              <div key={iv.id} className="logline logline--info">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span>{iv.command}</span>
                  <Pill>tick {iv.tick}</Pill>
                </div>
                {iv.targetAgentId && (
                  <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                    Target: agent_{iv.targetAgentId}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </Panel>
    </div>
  );
}
