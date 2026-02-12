import { useMemo, useState } from 'react';
import { useSim } from '../app/SimulationProvider';
import { Panel, Pill } from '../components/ui';
import { formatTime } from '../utils';
import type { LogLevel } from '../types';

export function ReplayView() {
  const sim = useSim();
  const [levelFilter, setLevelFilter] = useState<LogLevel | 'all'>('all');

  const filteredSystemLogs = useMemo(() => {
    let logs = sim.state.systemLogs;
    if (levelFilter !== 'all') {
      logs = logs.filter((log) => log.level === levelFilter);
    }
    return logs.slice().reverse();
  }, [sim.state.systemLogs, levelFilter]);

  const logCounts = useMemo(() => {
    return {
      all: sim.state.systemLogs.length,
      info: sim.state.systemLogs.filter((l) => l.level === 'info').length,
      ok: sim.state.systemLogs.filter((l) => l.level === 'ok').length,
      error: sim.state.systemLogs.filter((l) => l.level === 'error').length,
      warn: sim.state.systemLogs.filter((l) => l.level === 'warn').length,
    };
  }, [sim.state.systemLogs]);

  return (
    <div className="grid">
      <Panel title="System Logs 系统日志" actions={<Pill>{filteredSystemLogs.length} 条</Pill>}>
        <div className="row" style={{ gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <FilterButton active={levelFilter === 'all'} onClick={() => setLevelFilter('all')} count={logCounts.all}>
            全部
          </FilterButton>
          <FilterButton active={levelFilter === 'info'} onClick={() => setLevelFilter('info')} count={logCounts.info}>
            Info 信息
          </FilterButton>
          <FilterButton active={levelFilter === 'ok'} onClick={() => setLevelFilter('ok')} count={logCounts.ok}>
            Ok 成功
          </FilterButton>
          <FilterButton active={levelFilter === 'warn'} onClick={() => setLevelFilter('warn')} count={logCounts.warn}>
            Warn 警告
          </FilterButton>
          <FilterButton active={levelFilter === 'error'} onClick={() => setLevelFilter('error')} count={logCounts.error}>
            Error 错误
          </FilterButton>
        </div>

        {filteredSystemLogs.length === 0 ? (
          <div className="muted" style={{ textAlign: 'center', padding: 40, fontSize: 13 }}>
            {sim.state.systemLogs.length === 0 ? '暂无系统日志，等待后端产生日志...' : '该级别暂无日志'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filteredSystemLogs.map((log) => (
              <LogItem key={log.id} log={log} />
            ))}
          </div>
        )}
      </Panel>

      <aside className="panel">
        <div className="panel__hd">
          <div className="panel__title">Backend Status 后端状态</div>
          <Pill>系统监控</Pill>
        </div>
        <div className="panel__bd" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <StatusCard title="Current Simulation 当前模拟">
            <div className="kv" style={{ gridTemplateColumns: '140px 1fr' }}>
              <div className="kv__k">Tick 时间步</div>
              <div>{sim.state.tick}</div>
              <div className="kv__k">Running 运行中</div>
              <div>{sim.state.isRunning ? 'Yes' : 'No'}</div>
              <div className="kv__k">Speed 速度</div>
              <div>x{sim.state.speed.toFixed(1)}</div>
            </div>
          </StatusCard>

          <StatusCard title="Log Statistics 日志统计">
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
          </StatusCard>

          <StatusCard title="About 关于">
            <div style={{ fontSize: 12, lineHeight: 1.5, color: '#999' }}>
              系统日志显示后端服务器的运行状态、调试信息、错误报告等。
              包括 OASIS 模拟执行日志、LLM 调用记录、数据库操作、WebSocket 连接状态等。
            </div>
          </StatusCard>

          <div>
            <div className="muted" style={{ fontSize: 11, marginBottom: 8 }}>
              Quick Actions 快速操作
            </div>
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
  );
}

function LogItem({ log }: { log: { id: string; level: LogLevel; category: string; timestamp: number; message: string } }) {
  const borderColor =
    log.level === 'error' ? 'var(--danger)' : log.level === 'ok' ? 'var(--ok)' : log.level === 'warn' ? '#f59e0b' : 'var(--border)';

  const bgColor =
    log.level === 'error'
      ? 'rgba(239, 68, 68, 0.2)'
      : log.level === 'ok'
      ? 'rgba(34, 197, 94, 0.2)'
      : log.level === 'warn'
      ? 'rgba(245, 158, 11, 0.2)'
      : 'rgba(255, 255, 255, 0.1)';

  return (
    <div
      className={`logline ${log.level === 'error' ? 'logline--error' : log.level === 'ok' ? 'logline--ok' : 'logline--info'}`}
      style={{
        marginBottom: 0,
        padding: '8px 12px',
        fontSize: 13,
        borderLeft: `3px solid ${borderColor}`,
      }}
    >
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
        <div className="row" style={{ gap: 8 }}>
          <span
            className="pill"
            style={{
              fontSize: 10,
              padding: '2px 6px',
              background: bgColor,
            }}
          >
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
      <div style={{ lineHeight: 1.4, wordBreak: 'break-word' }}>{log.message}</div>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
  count,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count: number;
}) {
  return (
    <button className={`btn ${active ? 'btn--primary' : ''}`} onClick={onClick}>
      {children} {count}
    </button>
  );
}

function StatusCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: 12, background: 'rgba(0,0,0,0.15)', borderRadius: 8 }}>
      <div className="muted" style={{ fontSize: 11, marginBottom: 8 }}>
        {title}
      </div>
      {children}
    </div>
  );
}
