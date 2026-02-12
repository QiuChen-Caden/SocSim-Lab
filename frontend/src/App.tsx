import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { SimulationProvider, useSim } from './app/SimulationProvider';
import { useMockEngine } from './app/useMockEngine';
import { useTheme, ThemeContext, useThemeContext } from './hooks';
import { WorkbenchView } from './views/Workbench';
import { WorldView } from './views/WorldView';
import { FeedView } from './views/FeedView';
import { ReplayView } from './views/ReplayView';


const USE_REAL_API = import.meta.env.VITE_USE_REAL_API === 'true';

type ViewKey = 'workbench' | 'world' | 'feed' | 'replay';

interface NavigationContextType {
  activeView: ViewKey;
  navigateTo: (view: ViewKey) => void;
}

const NavigationContext = createContext<NavigationContextType | null>(null);

function useNavigation() {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error('useNavigation must be used within NavigationContext');
  return ctx;
}

function ThemeToggleButton() {
  const { theme, toggleTheme } = useThemeContext();
  return (
    <button
      className="btn btn--theme"
      onClick={toggleTheme}
      title={theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'}
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}

function Shell() {
  if (!USE_REAL_API) useMockEngine();
  const sim = useSim();
  const { theme, toggleTheme } = useTheme();
  const [active, setActive] = useState<ViewKey>('world');

  // Initialize theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, []);

  const status = useMemo(() => {
    const run = sim.state.isRunning ? 'RUNNING' : 'PAUSED';
    return `${run} · tick ${sim.state.tick} · x${sim.state.speed.toFixed(1)}`;
  }, [sim.state.isRunning, sim.state.speed, sim.state.tick]);

  const navigationValue = useMemo(
    () => ({
      activeView: active,
      navigateTo: setActive,
    }),
    [active]
  );

  const themeValue = useMemo(
    () => ({
      theme,
      toggleTheme,
    }),
    [theme, toggleTheme]
  );

  return (
    <NavigationContext.Provider value={navigationValue}>
      <ThemeContext.Provider value={themeValue}>
        <div className="app-shell">
          <header className="topbar">
            <div className="topbar__row">
              <div className="brand">
                <div className="brand__title">SocSim Lab (Interactive Demo)</div>
                <div className="brand__subtitle">
                  百万量级前端交互样例：多级缩放 · 流式日志 · 干预 · 时间轴回放（Mock 数据）
                </div>
              </div>

              <div className="status">
                <span className={`pill ${sim.state.isRunning ? 'pill--ok' : 'pill--warn'}`}>
                  {status}
                </span>
                <ThemeToggleButton />
                <button className="btn" onClick={() => sim.actions.toggleRun()}>
                  {sim.state.isRunning ? 'Pause' : 'Run'}
                </button>
              </div>
            </div>

            <nav className="tabs">
              <button
                className={`tab ${active === 'workbench' ? 'tab--active' : ''}`}
                onClick={() => setActive('workbench')}
              >
                Workbench 工作台
              </button>
              <button
                className={`tab ${active === 'world' ? 'tab--active' : ''}`}
                onClick={() => setActive('world')}
              >
                World 世界视图
              </button>
              <button
                className={`tab ${active === 'feed' ? 'tab--active' : ''}`}
                onClick={() => setActive('feed')}
              >
                Feed 信息流
              </button>
              <button
                className={`tab ${active === 'replay' ? 'tab--active' : ''}`}
                onClick={() => setActive('replay')}
              >
                System Log 系统日志
              </button>
            </nav>
          </header>

          <main className="content">
            {active === 'workbench' && <WorkbenchView />}
            {active === 'world' && <WorldView />}
            {active === 'feed' && <FeedView />}
            {active === 'replay' && <ReplayView />}
          </main>
        </div>
      </ThemeContext.Provider>
    </NavigationContext.Provider>
  );
}

export { useNavigation, useThemeContext };
export default function App() {
  return (
    <SimulationProvider>
      <Shell />
    </SimulationProvider>
  );
}
