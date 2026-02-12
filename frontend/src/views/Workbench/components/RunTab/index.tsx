import { useSim } from '../../../../app/SimulationProvider';
import { Pill } from '../../../../components/ui';

export function RunTab() {
  const sim = useSim();

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 12, maxHeight: 'calc(100vh - 200px)' }}>
      {/* Console */}
      <div className="panel panel--nested" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="panel__hd">
          <div className="panel__title">Console 控制台</div>
          <Pill variant={sim.state.isRunning ? 'ok' : 'default'}>
            {sim.state.isRunning ? '运行中' : '已暂停'}
          </Pill>
        </div>
        <div className="panel__bd" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Status Cards */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <StatusCard label="tick" value={sim.state.tick} />
            <StatusCard label="速度" value={`${sim.state.speed.toFixed(1)}x`} />
            <StatusCard label="智能体" value={sim.state.selectedAgentId ?? '-'} />
          </div>

          {/* Controls */}
          <div className="row" style={{ gap: 8, marginBottom: 12 }}>
            <button className="btn btn--primary" style={{ flex: 1 }} onClick={() => sim.actions.toggleRun()}>
              {sim.state.isRunning ? '⏸ 暂停' : '▶ 运行'}
            </button>
            <button
              className="btn"
              style={{ flex: 1 }}
              onClick={() =>
                sim.actions.pushEvent({ tick: sim.state.tick, type: 'bookmark', title: 'Bookmark' })
              }
            >
              🔖 书签
            </button>
          </div>

          {/* Speed Control */}
          <div style={{ marginTop: 'auto' }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
              <span className="muted">Speed 速度</span>
              <Pill>x{sim.state.speed.toFixed(1)}</Pill>
            </div>
            <input
              className="input"
              type="range"
              min={0.1}
              max={20}
              step={0.1}
              value={sim.state.speed}
              onChange={(e) => sim.actions.setSpeed(Number(e.target.value))}
            />
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="panel panel--nested" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="panel__hd">
          <div className="panel__title">Metrics 指标</div>
          <Pill>运行时</Pill>
        </div>
        <div className="panel__bd">
          <div className="kv" style={{ gridTemplateColumns: '140px 1fr', fontSize: 13 }}>
            <div className="kv__k">Agents</div>
            <div>{Object.keys(sim.state.agents).length}</div>
            <div className="kv__k">Events</div>
            <div>{sim.state.events.length}</div>
            <div className="kv__k">Feed Posts</div>
            <div>{sim.state.feed.length}</div>
            <div className="kv__k">Interventions</div>
            <div>{sim.state.interventions.length}</div>
            <div className="kv__k">Logs</div>
            <div>{sim.state.logs.length}</div>
          </div>
        </div>
      </div>

      {/* Bookmarks */}
      <div className="panel panel--nested" style={{ display: 'flex', flexDirection: 'column', gridColumn: 'span 2' }}>
        <div className="panel__hd">
          <div className="panel__title">Bookmarks 书签</div>
          <Pill>{sim.state.events.filter((e) => e.type === 'bookmark').length} 个</Pill>
        </div>
        <div className="panel__bd">
          <BookmarkList />
        </div>
      </div>
    </div>
  );
}

function StatusCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ flex: 1, padding: 10, background: 'rgba(0,0,0,0.15)', borderRadius: 8 }}>
      <div className="muted" style={{ fontSize: 10 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function BookmarkList() {
  const sim = useSim();
  const bookmarks = sim.state.events
    .filter((e) => e.type === 'bookmark')
    .sort((a, b) => b.tick - a.tick);

  if (bookmarks.length === 0) {
    return <div className="muted" style={{ textAlign: 'center', padding: 20 }}>暂无书签</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 200, overflow: 'auto' }}>
      {bookmarks.map((bookmark) => (
        <div
          key={bookmark.id}
          className="logline logline--info"
          style={{ cursor: 'pointer' }}
          onClick={() => sim.actions.setTick(bookmark.tick)}
        >
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span>{bookmark.title}</span>
            <Pill>tick {bookmark.tick}</Pill>
          </div>
        </div>
      ))}
    </div>
  );
}
