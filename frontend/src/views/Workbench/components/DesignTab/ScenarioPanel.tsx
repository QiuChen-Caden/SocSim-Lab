import { useSim } from '../../../../app/SimulationProvider';

export function ScenarioPanel() {
  const sim = useSim();

  return (
    <>
      <div className="muted" style={{ marginBottom: 10 }}>
        定义场景描述和约束条件，作为智能体行为的基础。
      </div>
      <textarea
        className="textarea"
        style={{ minHeight: 300, fontSize: 13 }}
        value={sim.state.config.scenarioText}
        onChange={(e) => sim.actions.setConfig({ scenarioText: e.target.value })}
        placeholder="在此描述场景背景、社会环境、约束规则等..."
      />
      <div className="row" style={{ marginTop: 10, justifyContent: 'space-between' }}>
        <span className="muted" style={{ fontSize: 12 }}>
          字符数: {sim.state.config.scenarioText.length}
        </span>
        <button
          className="btn"
          onClick={() => {
            sim.actions.setConfig({ designReady: true });
            sim.actions.logInfo('(user) updated scenario text');
            sim.actions.logOk('(system) design marked ready');
            sim.actions.pushEvent({
              tick: sim.state.tick,
              type: 'intervention',
              title: 'Design saved and unlocked for run',
            });
          }}
        >
          保存变更 Save Changes
        </button>
      </div>
    </>
  );
}
