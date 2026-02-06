import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { SimulationProvider, useSim } from './app/SimulationProvider'
import { useMockEngine } from './app/useMockEngine'
import { useRealEngine } from './app/useRealEngine'
import { FeedView } from './views/FeedView'
import { ReplayView } from './views/ReplayView'
import { WorkbenchView } from './views/WorkbenchView'
import { WorldView } from './views/WorldView'

// 是否使用真实后端 API
const USE_REAL_API = import.meta.env.VITE_USE_REAL_API === 'true'

type ViewKey = 'workbench' | 'world' | 'feed' | 'replay'
type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | null>(null)

function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeContext')
  return ctx
}

const NavigationContext = createContext<{
  activeView: ViewKey
  navigateTo: (view: ViewKey) => void
} | null>(null)

function useNavigation() {
  const ctx = useContext(NavigationContext)
  if (!ctx) throw new Error('useNavigation must be used within NavigationContext')
  return ctx
}

function ThemeToggleButton() {
  const { theme, toggleTheme } = useTheme()
  return (
    <button
      className="btn btn--theme"
      onClick={toggleTheme}
      title={theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'}
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  )
}

function Shell() {
  // 根据环境变量选择使用真实 API 或 Mock 引擎
  const engine = USE_REAL_API ? useRealEngine() : useMockEngine()
  const sim = useSim()
  const [active, setActive] = useState<ViewKey>('world')
  const [theme, setTheme] = useState<Theme>(() => {
    // 从 localStorage 读取保存的主题
    const saved = localStorage.getItem('theme') as Theme | null
    return saved || 'dark'
  })

  // 主题切换时保存到 localStorage 并更新 data-theme 属性
  const toggleTheme = () => {
    setTheme(prev => {
      const newTheme = prev === 'dark' ? 'light' : 'dark'
      localStorage.setItem('theme', newTheme)
      document.documentElement.setAttribute('data-theme', newTheme)
      return newTheme
    })
  }

  // 初始化时设置主题
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [])

  const status = useMemo(() => {
    const run = sim.state.isRunning ? 'RUNNING' : 'PAUSED'
    return `${run} · tick ${sim.state.tick} · x${sim.state.speed.toFixed(1)}`
  }, [sim.state.isRunning, sim.state.speed, sim.state.tick])

  const navigationValue = useMemo(() => ({
    activeView: active,
    navigateTo: setActive
  }), [active])

  const themeValue = useMemo(() => ({
    theme,
    toggleTheme
  }), [theme])

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
                <span className={`pill ${sim.state.isRunning ? 'pill--ok' : 'pill--warn'}`}>{status}</span>
                <ThemeToggleButton />
                <button className="btn" onClick={() => sim.actions.toggleRun()}>
                  {sim.state.isRunning ? 'Pause' : 'Run'}
                </button>
              </div>
            </div>

            <nav className="tabs">
              <button className={`tab ${active === 'workbench' ? 'tab--active' : ''}`} onClick={() => setActive('workbench')}>
                Workbench 工作台
              </button>
              <button className={`tab ${active === 'world' ? 'tab--active' : ''}`} onClick={() => setActive('world')}>
                World 世界视图
              </button>
              <button className={`tab ${active === 'feed' ? 'tab--active' : ''}`} onClick={() => setActive('feed')}>
                Feed 信息流
              </button>
              <button className={`tab ${active === 'replay' ? 'tab--active' : ''}`} onClick={() => setActive('replay')}>
                Replay 回放
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
  )
}

export { useNavigation, useTheme }
export default function App() {
  return (
    <SimulationProvider>
      <Shell />
    </SimulationProvider>
  )
}
