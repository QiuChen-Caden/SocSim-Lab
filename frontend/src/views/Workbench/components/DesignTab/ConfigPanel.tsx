import { useSim } from '../../../../app/SimulationProvider';
import { clamp } from '../../../../utils';




export function ConfigPanel() {
  const sim = useSim();
  const config = sim.state.config;

  return (
    <>
      <div className="kv kv--wide">
        <div className="kv__k">Seed 随机种子</div>
        <div className="kv__v">{config.seed}</div>

        <div className="kv__k">Agent Count 智能体数量</div>
        <div className="kv__v">{config.agentCount.toLocaleString()}</div>

        <div className="kv__k">World Size 世界大小</div>
        <div className="kv__v">{config.worldSize}px</div>

        <div className="kv__k">Ticks/sec 时间步/秒</div>
        <div className="kv__v">{config.ticksPerSecond}</div>

        <div className="kv__k">Viewport Mode 视口模式</div>
        <div className="kv__v">{config.viewportMode}</div>
      </div>

      <ConfigInput
        label="seed"
        type="number"
        value={config.seed}
        onChange={(v) => sim.actions.setConfig({ seed: clamp(v, 0, 9_999_999_999) })}
      />

      <ConfigInput
        label="ticks/sec"
        type="number"
        min={1}
        max={60}
        value={config.ticksPerSecond}
        onChange={(v) => sim.actions.setConfig({ ticksPerSecond: v })}
      />

      <ConfigInput
        label="world size"
        type="number"
        min={2000}
        max={20000}
        value={config.worldSize}
        onChange={(v) => sim.actions.setConfig({ worldSize: v })}
      />

      <ConfigInput
        label="sample agents (render)"
        type="number"
        min={200}
        max={50000}
        value={config.sampleAgents}
        onChange={(v) => sim.actions.setConfig({ sampleAgents: v })}
      />

      <div style={{ marginTop: 10 }}>
        <label className="muted">experiment name 实验名称</label>
        <input
          className="input"
          type="text"
          placeholder="输入本次实验的名称..."
          value={config.experimentName}
          onChange={(e) => sim.actions.setConfig({ experimentName: e.target.value })}
        />
      </div>

      <LLMConfig />
    </>
  );
}

function ConfigInput({ label, type, value, onChange, min, max }: {
  label: string;
  type: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div style={{ marginTop: 10 }}>
      <label className="muted">{label}</label>
      <input
        className="input"
        type={type}
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function LLMConfig() {
  const sim = useSim();
  const config = sim.state.config;

  return (
    <div style={{ marginTop: 14, padding: 10, border: '1px solid var(--border)', borderRadius: 10, background: 'rgba(255,255,255,0.02)' }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>LLM Runtime（DeepSeek）</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <ConfigSelect
          label="LLM enabled"
          value={config.llmEnabled ? 'true' : 'false'}
          options={[
            { value: 'true', label: 'true' },
            { value: 'false', label: 'false' },
          ]}
          onChange={(v) => sim.actions.setConfig({ llmEnabled: v === 'true' })}
        />
        <StringConfigInput label="provider" value={config.llmProvider} onChange={(v) => sim.actions.setConfig({ llmProvider: v })} />
        <StringConfigInput label="model" value={config.llmModel} onChange={(v) => sim.actions.setConfig({ llmModel: v })} />
        <ConfigInput label="active agents / tick" type="number" min={1} max={100} value={config.llmActiveAgents} onChange={(v) => sim.actions.setConfig({ llmActiveAgents: v })} />
        <ConfigInput label="timeout ms" type="number" min={1000} max={120000} value={config.llmTimeoutMs} onChange={(v) => sim.actions.setConfig({ llmTimeoutMs: v })} />
        <ConfigInput label="max retries" type="number" min={0} max={5} value={config.llmMaxRetries} onChange={(v) => sim.actions.setConfig({ llmMaxRetries: v })} />
        <ConfigInput label="retry backoff ms" type="number" min={0} max={5000} value={config.llmRetryBackoffMs} onChange={(v) => sim.actions.setConfig({ llmRetryBackoffMs: v })} />
        <ConfigInput label="max actions/min" type="number" min={1} max={5000} value={config.llmMaxActionsPerMinute} onChange={(v) => sim.actions.setConfig({ llmMaxActionsPerMinute: v })} />
        <ConfigSelect
          label="fallback on error"
          value={config.llmFallbackOnError ? 'true' : 'false'}
          options={[
            { value: 'true', label: 'true' },
            { value: 'false', label: 'false' },
          ]}
          onChange={(v) => sim.actions.setConfig({ llmFallbackOnError: v === 'true' })}
        />
      </div>
      <div style={{ marginTop: 8 }}>
        <label className="muted">base url</label>
        <input
          className="input"
          type="text"
          value={config.llmBaseUrl}
          onChange={(e) => sim.actions.setConfig({ llmBaseUrl: e.target.value })}
        />
      </div>
      <div style={{ marginTop: 8 }}>
        <label className="muted">api key</label>
        <input
          className="input"
          type="password"
          value={config.llmApiKey}
          onChange={(e) => sim.actions.setConfig({ llmApiKey: e.target.value })}
        />
      </div>
    </div>
  );
}

function ConfigSelect({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="muted">{label}</label>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

function StringConfigInput({ label, type = 'text', value, onChange, min, max }: {
  label: string;
  type?: string;
  value: string | number;
  onChange: (v: string) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div>
      <label className="muted">{label}</label>
      <input
        className="input"
        type={type}
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
