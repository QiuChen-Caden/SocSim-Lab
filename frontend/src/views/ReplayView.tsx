import { useMemo, useState } from 'react'
import { useSim } from '../app/SimulationProvider'

export function ReplayView() {
  const sim = useSim()
  const [levelFilter, setLevelFilter] = useState<'all' | 'info' | 'ok' | 'error' | 'warn'>('all')

  // 过滤系统日志
  const filteredSystemLogs = useMemo(() => {
    let logs = sim.state.systemLogs
    if (levelFilter !== 'all') {
      logs = logs.filter(log => log.level === levelFilter)
    }
    return logs.slice().reverse()
  }, [sim.state.systemLogs, levelFilter])

  // 统计各级别的日志数量
  const logCounts = useMemo(() => {
    return {
      all: sim.state.systemLogs.length,
      info: sim.state.systemLogs.filter(l => l.level === 'info').length,
      ok: sim.state.systemLogs.filter(l => l.level === 'ok').length,
      error: sim.state.systemLogs.filter(l => l.level === 'error').length,
      warn: sim.state.systemLogs.filter(l => l.level === 'warn').length,
    }
  }, [sim.state.systemLogs])

  // 格式化时间戳
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  return (
    <div className="grid">
      {/* 左侧：系统日志列表 */}
      <section className="panel">
        <div className="panel__hd">
          <div className="panel__title">System Logs 系统日志</div>
          <span className="pill">{filteredSystemLogs.length} 条</span>
        </div>
        <div className="panel__bd">
          {/* 过滤按钮 */}
          <div className="row" style={{ gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <button
              className={`btn ${levelFilter === 'all' ? 'btn--primary' : ''}`}
              onClick={() => setLevelFilter('all')}
            >
              全部 {logCounts.all}
            </button>
            <button
              className={`btn ${levelFilter === 'info' ? 'btn--primary' : ''}`}
              onClick={() => setLevelFilter('info')}
            >
              Info 信息 {logCounts.info}
            </button>
            <button
              className={`btn ${levelFilter === 'ok' ? 'btn--primary' : ''}`}
              onClick={() => setLevelFilter('ok')}
            >
              Ok 成功 {logCounts.ok}
            </button>
            <button
              className={`btn ${levelFilter === 'warn' ? 'btn--primary' : ''}`}
              onClick={() => setLevelFilter('warn')}
            >
              Warn 警告 {logCounts.warn}
            </button>
            <button
              className={`btn ${levelFilter === 'error' ? 'btn--primary' : ''}`}
              onClick={() => setLevelFilter('error')}
            >
              Error 错误 {logCounts.error}
            </button>
          </div>

          {/* 日志列表 */}
          {filteredSystemLogs.length === 0 ? (
            <div className="muted" style={{ textAlign: 'center', padding: 40, fontSize: 13 }}>
              {sim.state.systemLogs.length === 0
                ? '暂无系统日志，等待后端产生日志...'
                : '该级别暂无日志'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredSystemLogs.map((log) => (
                <div
                  key={log.id}
                  className={`logline ${
                    log.level === 'error' ? 'logline--error' :
                    log.level === 'ok' ? 'logline--ok' :
                    log.level === 'warn' ? 'logline--info' : 'logline--info'
                  }`}
                  style={{
                    marginBottom: 0,
                    padding: '8px 12px',
                    fontSize: 13,
                    borderLeft: `3px solid ${
                      log.level === 'error' ? 'var(--danger)' :
                      log.level === 'ok' ? 'var(--ok)' :
                      log.level === 'warn' ? '#f59e0b' : 'var(--border)'
                    }`
                  }}
                >
                  <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
                    <div className="row" style={{ gap: 8 }}>
                      <span className="pill" style={{
                        fontSize: 10,
                        padding: '2px 6px',
                        background: log.level === 'error' ? 'rgba(239, 68, 68, 0.2)' :
                                   log.level === 'ok' ? 'rgba(34, 197, 94, 0.2)' :
                                   log.level === 'warn' ? 'rgba(245, 158, 11, 0.2)' :
                                   'rgba(255, 255, 255, 0.1)'
                      }}>
                        {log.level.toUpperCase()}
                      </span>
                      <span className="muted" style={{ fontSize: 11 }}>
                        {log.category}
                      </span>
                    </div>
                    <span className="muted" style={{ fontSize: 11 }}>
                      {formatTime(log.timestamp)}
                    </span>
                  </div>
                  <div style={{ lineHeight: 1.4, wordBreak: 'break-word' }}>
                    {log.message}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 右侧：当前状态说明 */}
      <aside className="panel">
        <div className="panel__hd">
          <div className="panel__title">Backend Status 后端状态</div>
          <span className="pill">系统监控</span>
        </div>
        <div className="panel__bd" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 当前模拟状态 */}
          <div style={{ padding: 12, background: 'rgba(0,0,0,0.15)', borderRadius: 8 }}>
            <div className="muted" style={{ fontSize: 11, marginBottom: 8 }}>Current Simulation 当前模拟</div>
            <div className="kv" style={{ gridTemplateColumns: '140px 1fr' }}>
              <div className="kv__k">Tick 时间步</div>
              <div>{sim.state.tick}</div>
              <div className="kv__k">Running 运行中</div>
              <div>{sim.state.isRunning ? 'Yes' : 'No'}</div>
              <div className="kv__k">Speed 速度</div>
              <div>x{sim.state.speed.toFixed(1)}</div>
            </div>
          </div>

          {/* 日志统计 */}
          <div style={{ padding: 12, background: 'rgba(0,0,0,0.15)', borderRadius: 8 }}>
            <div className="muted" style={{ fontSize: 11, marginBottom: 8 }}>Log Statistics 日志统计</div>
            <div className="kv" style={{ gridTemplateColumns: '140px 1fr' }}>
              <div className="kv__k">Total Logs 总数</div>
              <div>{logCounts.all}</div>
              <div className="kv__k">Info 信息</div>
              <div style={{ color: '#7fb2ff' }}>{logCounts.info}</div>
              <div className="kv__k">Ok 成功</div>
              <div style={{ color: 'var(--ok)' }}>{logCounts.ok}</div>
              <div className="kv__k">Warn 警告</div>
              <div style={{ color: '#f59e0b' }}>{logCounts.warn}</div>
              <div className="kv__k">Error 错误</div>
              <div style={{ color: 'var(--danger)' }}>{logCounts.error}</div>
            </div>
          </div>

          {/* 说明 */}
          <div style={{ padding: 12, background: 'rgba(0,0,0,0.15)', borderRadius: 8 }}>
            <div className="muted" style={{ fontSize: 11, marginBottom: 8 }}>About 关于</div>
            <div style={{ fontSize: 12, lineHeight: 1.5, color: '#999' }}>
              系统日志显示后端服务器的运行状态、调试信息、错误报告等。
              包括 OASIS 模拟执行日志、LLM 调用记录、数据库操作、WebSocket 连接状态等。
            </div>
          </div>

          {/* 快速操作 */}
          <div>
            <div className="muted" style={{ fontSize: 11, marginBottom: 8 }}>Quick Actions 快速操作</div>
            <div className="row" style={{ gap: 8 }}>
              <button
                className="btn"
                style={{ flex: 1, fontSize: 12 }}
                onClick={() => sim.actions.logOk('System logs viewed @ ' + new Date().toLocaleTimeString())}
              >
                添加测试日志
              </button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}
