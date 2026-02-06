import { useMemo, useState } from 'react'
import { useSim } from '../app/SimulationProvider'

export function ReplayView() {
  const sim = useSim()
  const [tickInput, setTickInput] = useState('')

  // 根据选择的快照过滤事件
  const bookmarks = useMemo(() => {
    return [...sim.state.events].filter(e => e.type === 'bookmark').sort((a, b) => b.tick - a.tick)
  }, [sim.state.events])

  // 获取当前加载的快照
  const currentSnapshot = sim.state.snapshots.find(s => s.id === sim.state.currentSnapshotId)

  const maxTick = Math.max(sim.state.tick, 100)

  const handleJumpToTick = () => {
    const tick = Number(tickInput)
    if (!isNaN(tick) && tick >= 0) {
      sim.actions.setTick(tick)
      setTickInput('')
    }
  }

  return (
    <div className="grid">
      {/* 左侧：Replay 回放控制 */}
      <section className="panel">
        <div className="panel__hd">
          <div className="panel__title">Replay 回放</div>
          <span className="pill">tick {sim.state.tick}</span>
        </div>
        <div className="panel__bd">
          {/* 当前状态 */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, padding: 12, background: 'rgba(0,0,0,0.15)', borderRadius: 8 }}>
            <div style={{ flex: 1 }}>
              <div className="muted" style={{ fontSize: 10 }}>当前 tick</div>
              <div style={{ fontSize: 20, fontWeight: 600 }}>{sim.state.tick}</div>
            </div>
            <div style={{ flex: 1 }}>
              <div className="muted" style={{ fontSize: 10 }}>速度</div>
              <div style={{ fontSize: 20, fontWeight: 600 }}>{sim.state.speed.toFixed(1)}x</div>
            </div>
            <div style={{ flex: 1 }}>
              <div className="muted" style={{ fontSize: 10 }}>书签数</div>
              <div style={{ fontSize: 20, fontWeight: 600 }}>{bookmarks.length}</div>
            </div>
          </div>

          {/* 时间轴滑块 */}
          <div style={{ marginBottom: 16 }}>
            <div className="muted" style={{ marginBottom: 8, fontSize: 12 }}>Timeline 时间轴</div>
            <input
              className="input"
              type="range"
              min={0}
              max={maxTick}
              value={sim.state.tick}
              onChange={(e) => sim.actions.setTick(Number(e.target.value))}
              style={{ width: '100%' }}
            />
            <div className="row" style={{ justifyContent: 'space-between', marginTop: 4 }}>
              <span className="muted" style={{ fontSize: 11 }}>0</span>
              <span className="muted" style={{ fontSize: 11 }}>{maxTick}</span>
            </div>
          </div>

          {/* 播放控制 */}
          <div className="row" style={{ gap: 8, marginBottom: 16 }}>
            <button className="btn" style={{ flex: 1 }} onClick={() => sim.actions.setTick(0)}>
              ⏮ 起点
            </button>
            <button className="btn" style={{ flex: 1 }} onClick={() => sim.actions.setTick(Math.max(0, sim.state.tick - 50))}>
              ⏪ -50
            </button>
            <button className="btn btn--primary" style={{ flex: 1.5 }} onClick={() => sim.actions.toggleRun()}>
              {sim.state.isRunning ? '⏸ 暂停' : '▶ 播放'}
            </button>
            <button className="btn" style={{ flex: 1 }} onClick={() => sim.actions.setTick(sim.state.tick + 50)}>
              ⏩ +50
            </button>
          </div>

          {/* 跳转 + 速度 */}
          <div className="row" style={{ gap: 8, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <label className="muted" style={{ fontSize: 11 }}>跳转到 tick</label>
              <div className="row" style={{ gap: 6, marginTop: 4 }}>
                <input
                  className="input"
                  style={{ flex: 1 }}
                  type="number"
                  placeholder="输入 tick"
                  value={tickInput}
                  onChange={(e) => setTickInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleJumpToTick()}
                />
                <button className="btn" onClick={handleJumpToTick}>跳转</button>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <label className="muted" style={{ fontSize: 11 }}>播放速度</label>
              <div className="row" style={{ alignItems: 'center', gap: 8, marginTop: 4 }}>
                <input
                  className="input"
                  type="range"
                  min={0.5}
                  max={4}
                  step={0.5}
                  value={sim.state.speed}
                  onChange={(e) => sim.actions.setSpeed(Number(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span className="pill" style={{ fontSize: 11 }}>{sim.state.speed.toFixed(1)}x</span>
              </div>
            </div>
          </div>

          {/* 当前加载的快照 */}
          {currentSnapshot && (
            <div style={{ padding: 12, background: 'rgba(34, 197, 94, 0.1)', borderRadius: 8, border: '1px solid rgba(34, 197, 94, 0.3)' }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{currentSnapshot.experimentName}</span>
                <span className="pill pill--ok" style={{ fontSize: 10 }}>已加载</span>
              </div>
              <div className="muted" style={{ fontSize: 11 }}>最终 tick: {currentSnapshot.finalTick}</div>
            </div>
          )}
        </div>
      </section>

      {/* 右侧：Experiment Records 实验记录 */}
      <aside className="panel">
        <div className="panel__hd">
          <div className="panel__title">Experiment Records 实验记录</div>
          <button
            className="btn btn--primary"
            style={{ fontSize: 12, padding: '4px 12px' }}
            onClick={() => {
              sim.actions.createSnapshot()
              sim.actions.logOk(`Simulation recorded: ${sim.state.config.experimentName} @ tick ${sim.state.tick}`)
            }}
          >
            记录 Record
          </button>
        </div>
        <div className="panel__bd">
          {/* 模拟记录列表 */}
          <div style={{ marginBottom: 16 }}>
            <div className="muted" style={{ marginBottom: 8, fontSize: 12 }}>Simulation Records 模拟记录</div>
            {sim.state.snapshots.length === 0 ? (
              <div className="muted" style={{ textAlign: 'center', padding: 16, fontSize: 11 }}>
                暂无记录
              </div>
            ) : (
              <div style={{ maxHeight: 200, overflow: 'auto' }}>
                {[...sim.state.snapshots].reverse().slice(0, 8).map((snapshot) => (
                  <div
                    key={snapshot.id}
                    className="logline logline--info"
                    style={{
                      marginBottom: 6,
                      padding: '8px 10px',
                      cursor: 'pointer',
                      background: sim.state.currentSnapshotId === snapshot.id ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                      border: sim.state.currentSnapshotId === snapshot.id ? '1px solid var(--ok)' : 'none'
                    }}
                    onClick={() => {
                      sim.actions.loadSnapshot(snapshot.id)
                      sim.actions.logOk(`Loaded: ${snapshot.experimentName}`)
                    }}
                  >
                    <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 500, fontSize: 12 }}>{snapshot.experimentName}</span>
                      <span className="pill" style={{ fontSize: 10 }}>#{snapshot.runNumber}</span>
                    </div>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <span className="muted" style={{ fontSize: 10 }}>tick {snapshot.finalTick}</span>
                      <span className="muted" style={{ fontSize: 10 }}>
                        {Object.keys(snapshot.data.agents).length} agents
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 书签列表 */}
          <div>
            <div className="muted" style={{ marginBottom: 8, fontSize: 12 }}>Bookmarks 书签列表</div>
            {bookmarks.length === 0 ? (
              <div className="muted" style={{ textAlign: 'center', padding: 16, fontSize: 11 }}>
                暂无书签
              </div>
            ) : (
              <div style={{ maxHeight: 200, overflow: 'auto' }}>
                {bookmarks.slice(0, 10).map((bm) => (
                  <div
                    key={bm.id}
                    className="logline logline--info"
                    style={{
                      marginBottom: 4,
                      padding: '6px 8px',
                      cursor: 'pointer',
                      fontSize: 12
                    }}
                    onClick={() => sim.actions.setTick(bm.tick)}
                  >
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <span className="muted" style={{ fontSize: 10 }}>tick {bm.tick}</span>
                      <span style={{ fontSize: 11 }}>{bm.title}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  )
}
