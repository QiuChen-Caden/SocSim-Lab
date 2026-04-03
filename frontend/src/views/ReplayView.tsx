import { useMemo, useState } from 'react';
import { useSim } from '../app/SimulationProvider';
import { Panel, Pill } from '../components/ui';
import { formatTime } from '../utils';
import type { LogLevel, LogLine, TimelineEvent } from '../types';

type ReplayTab = 'system' | 'sim' | 'events';

export function ReplayView() {
  const sim = useSim();
  const [activeTab, setActiveTab] = useState<ReplayTab>('system');
  const [levelFilter, setLevelFilter] = useState<LogLevel | 'all'>('all');
  const [searchText, setSearchText] = useState('');
  const [agentFilter, setAgentFilter] = useState('');

  const agentId = agentFilter.trim() ? parseInt(agentFilter.trim(), 10) : NaN;
  const query = searchText.trim().toLowerCase();

  // System logs (existing behavior)
  const filteredSystemLogs = useMemo(() => {
    let logs = sim.state.systemLogs;
    if (levelFilter !== 'all') {
      logs = logs.filter((log) => log.level === levelFilter);
    }
    if (query) {
      logs = logs.filter((log) => log.message.toLowerCase().includes(query));
    }
    return logs.slice().reverse();
  }, [sim.state.systemLogs, levelFilter, query]);

  // Sim logs (LogLine[])
  const filteredSimLogs = useMemo(() => {
    let logs = [...sim.state.logs];
    if (levelFilter !== 'all') {
      logs = logs.filter((l) => l.level === levelFilter);
    }
    if (!isNaN(agentId)) {
      logs = logs.filter((l) => l.agentId === agentId);
    }
    if (query) {
      logs = logs.filter((l) => l.text.toLowerCase().includes(query));
    }
    return logs.sort((a, b) => b.tick - a.tick);
  }, [sim.state.logs, levelFilter, agentId, query]);

  // Events (TimelineEvent[])
  const filteredEvents = useMemo(() => {
    let events = [...sim.state.events];
    if (!isNaN(agentId)) {
      events = events.filter((e) => e.agentId === agentId);
    }
    if (query) {
      events = events.filter((e) => e.title.toLowerCase().includes(query));
    }
    return events.sort((a, b) => b.tick - a.tick);
  }, [sim.state.events, agentId, query]);

  const logCounts = useMemo(() => ({
    system: sim.state.systemLogs.length,
    sim: sim.state.logs.length,
    events: sim.state.events.length,
  }), [sim.state.systemLogs.length, sim.state.logs.length, sim.state.events.length]);
  const currentCount = activeTab === 'system' ? filteredSystemLogs.length : activeTab === 'sim' ? filteredSimLogs.length : filteredEvents.length;

  return (
    <div className="grid">
      <Panel
        title="Replay 回放日志"
        actions={<Pill>{currentCount} 条</Pill>}
      >
        <div className="row" style={{ gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <TabButton active={activeTab === 'system'} onClick={() => setActiveTab('system')} count={logCounts.system}>
            系统日志 System
          </TabButton>
          <TabButton active={activeTab === 'sim'} onClick={() => setActiveTab('sim')} count={logCounts.sim}>
            仿真日志 Sim
          </TabButton>
          <TabButton active={activeTab === 'events'} onClick={() => setActiveTab('events')} count={logCounts.events}>
            事件 Events
          </TabButton>
        </div>

        <div className="row" style={{ gap: 8, marginBottom: 12 }}>
          <input
            type="text"
            placeholder="Search 搜索..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ flex: 1, padding: '4px 8px', fontSize: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', borderRadius: 4, color: 'inherit' }}
          />
          {activeTab !== 'system' && (
            <input
              type="text"
              placeholder="Agent ID"
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              style={{ width: 80, padding: '4px 8px', fontSize: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', borderRadius: 4, color: 'inherit' }}
            />
          )}
        </div>

        {activeTab === 'system' && (
          <>
            <div className="row" style={{ gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              {(['all', 'info', 'ok', 'warn', 'error'] as const).map((lv) => (
                <FilterButton key={lv} active={levelFilter === lv} onClick={() => setLevelFilter(lv)}
                  count={lv === 'all' ? logCounts.system : sim.state.systemLogs.filter((l) => l.level === lv).length}>
                  {lv === 'all' ? '全部' : lv}
                </FilterButton>
              ))}
            </div>
            {filteredSystemLogs.length === 0 ? (
              <div className="muted" style={{ textAlign: 'center', padding: 40, fontSize: 13 }}>
                {sim.state.systemLogs.length === 0 ? '暂无系统日志...' : '无匹配日志'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filteredSystemLogs.map((log) => (
                  <SystemLogItem key={log.id} log={log} />
                ))}
              </div>
            )}
          </>
        )}
        {activeTab === 'sim' && (
          <>
            <div className="row" style={{ gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              {(['all', 'info', 'ok', 'warn', 'error'] as const).map((lv) => (
                <FilterButton key={lv} active={levelFilter === lv} onClick={() => setLevelFilter(lv)}
                  count={lv === 'all' ? sim.state.logs.length : sim.state.logs.filter((l) => l.level === lv).length}>
                  {lv === 'all' ? '全部' : lv}
                </FilterButton>
              ))}
            </div>
            {filteredSimLogs.length === 0 ? (
              <div className="muted" style={{ textAlign: 'center', padding: 40, fontSize: 13 }}>无匹配仿真日志</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filteredSimLogs.slice(0, 500).map((log) => (
                  <SimLogItem key={log.id} log={log} />
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'events' && (
          filteredEvents.length === 0 ? (
            <div className="muted" style={{ textAlign: 'center', padding: 40, fontSize: 13 }}>无匹配事件</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredEvents.slice(0, 500).map((ev) => (
                <EventItem key={ev.id} event={ev} />
              ))}
            </div>
          )
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
              <div className="kv__k">System Logs 系统</div>
              <div>{logCounts.system}</div>
              <div className="kv__k">Sim Logs 仿真</div>
              <div>{logCounts.sim}</div>
              <div className="kv__k">Events 事件</div>
              <div>{logCounts.events}</div>
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

function SystemLogItem({ log }: { log: { id: string; level: string; category: string; timestamp: number; message: string } }) {
  const borderColor =
    log.level === 'error' ? 'var(--danger)' : log.level === 'ok' ? 'var(--ok)' : log.level === 'warn' ? '#f59e0b' : 'var(--border)';
  const bgColor =
    log.level === 'error' ? 'rgba(239,68,68,0.2)' : log.level === 'ok' ? 'rgba(34,197,94,0.2)' : log.level === 'warn' ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.1)';

  return (
    <div className={`logline ${log.level === 'error' ? 'logline--error' : log.level === 'ok' ? 'logline--ok' : 'logline--info'}`}
      style={{ marginBottom: 0, padding: '8px 12px', fontSize: 13, borderLeft: `3px solid ${borderColor}` }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
        <div className="row" style={{ gap: 8 }}>
          <span className="pill" style={{ fontSize: 10, padding: '2px 6px', background: bgColor }}>{log.level.toUpperCase()}</span>
          <span className="muted" style={{ fontSize: 11 }}>{log.category}</span>
        </div>
        <span className="muted" style={{ fontSize: 11 }}>{formatTime(log.timestamp)}</span>
      </div>
      <div style={{ lineHeight: 1.4, wordBreak: 'break-word' }}>{log.message}</div>
    </div>
  );
}

function SimLogItem({ log }: { log: LogLine }) {
  const borderColor =
    log.level === 'error' ? 'var(--danger)' : log.level === 'ok' ? 'var(--ok)' : log.level === 'warn' ? '#f59e0b' : 'var(--border)';

  return (
    <div className={`logline ${log.level === 'error' ? 'logline--error' : log.level === 'ok' ? 'logline--ok' : 'logline--info'}`}
      style={{ marginBottom: 0, padding: '8px 12px', fontSize: 13, borderLeft: `3px solid ${borderColor}` }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
        <div className="row" style={{ gap: 8 }}>
          <span className="pill" style={{ fontSize: 10, padding: '2px 6px' }}>{log.level.toUpperCase()}</span>
          {log.agentId != null && <span className="muted" style={{ fontSize: 11 }}>agent_{log.agentId}</span>}
        </div>
        <span className="muted" style={{ fontSize: 11 }}>tick {log.tick}</span>
      </div>
      <div style={{ lineHeight: 1.4, wordBreak: 'break-word' }}>{log.text}</div>
    </div>
  );
}

function EventItem({ event }: { event: TimelineEvent }) {
  const typeColors: Record<string, string> = {
    agent_action: '#7fb2ff',
    message: '#44ff44',
    intervention: '#ff6b6b',
    alert: '#f59e0b',
    bookmark: '#c084fc',
  };
  const color = typeColors[event.type] ?? 'var(--border)';

  return (
    <div className="logline logline--info"
      style={{ marginBottom: 0, padding: '8px 12px', fontSize: 13, borderLeft: `3px solid ${color}` }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
        <div className="row" style={{ gap: 8 }}>
          <Pill variant={event.type === 'intervention' ? 'danger' : event.type === 'alert' ? 'warn' : 'ok'}>
            {event.type}
          </Pill>
          {event.agentId != null && <span className="muted" style={{ fontSize: 11 }}>agent_{event.agentId}</span>}
        </div>
        <span className="muted" style={{ fontSize: 11 }}>tick {event.tick}</span>
      </div>
      <div style={{ lineHeight: 1.4, wordBreak: 'break-word' }}>{event.title}</div>
    </div>
  );
}

function TabButton({ active, onClick, children, count }: { active: boolean; onClick: () => void; children: React.ReactNode; count: number }) {
  return (
    <button className={`btn ${active ? 'btn--primary' : ''}`} onClick={onClick}>
      {children} {count}
    </button>
  );
}

function FilterButton({ active, onClick, children, count }: { active: boolean; onClick: () => void; children: React.ReactNode; count: number }) {
  return (
    <button className={`btn ${active ? 'btn--primary' : ''}`} onClick={onClick} style={{ fontSize: 11 }}>
      {children} {count}
    </button>
  );
}

function StatusCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: 12, background: 'rgba(0,0,0,0.15)', borderRadius: 8 }}>
      <div className="muted" style={{ fontSize: 11, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}
