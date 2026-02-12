import { useSim } from '../../../../app/SimulationProvider';

interface GroupsPanelProps {
  onBack: () => void;
}

export function GroupsPanel({ onBack }: GroupsPanelProps) {
  const sim = useSim();

  return (
    <>
      <div className="row" style={{ marginBottom: 10, justifyContent: 'space-between' }}>
        <span className="pill">{Object.keys(sim.state.groups).length} groups</span>
        <button className="btn btn--primary" onClick={onBack}>
          ← Back to Pipeline
        </button>
      </div>
      {Object.values(sim.state.groups).map((g) => (
        <div key={g.key} className="logline logline--info" style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ fontWeight: 700 }}>{g.key}</div>
            <div className="muted" style={{ fontSize: 12 }}>{g.dominantStratum}</div>
          </div>
          <div style={{ marginTop: 4, fontSize: 12 }}>{g.label}</div>
          <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>{g.normSummary}</div>
        </div>
      ))}
    </>
  );
}
