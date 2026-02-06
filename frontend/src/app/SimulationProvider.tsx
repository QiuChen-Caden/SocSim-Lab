import { createContext, useContext, useMemo, useReducer, useEffect } from 'react'
import type { ReactNode } from 'react'
import type { AgentState, SimulationState } from './types'
import { initialState, reducer } from './state'
import type { Action } from './state'
import { clamp, id } from './util'
import api, { wsClient } from './api'

// 是否使用真实后端 API
const USE_REAL_API = import.meta.env.VITE_USE_REAL_API === 'true'

type SimActions = {
  toggleRun: () => void
  setSpeed: (speed: number) => void
  setTick: (tick: number) => void
  selectAgent: (agentId: number | null) => void
  logInfo: (text: string, agentId?: number) => void
  logOk: (text: string, agentId?: number) => void
  logError: (text: string, agentId?: number) => void
  pushEvent: (event: { tick: number; type: any; title: string; agentId?: number; payload?: Record<string, unknown> }) => void
  pushFeed: (authorId: number, content: string, emotion: number) => void
  applyIntervention: (command: string, targetAgentId?: number) => void
  setConfig: (patch: Partial<SimulationState['config']>) => void
  patchAgent: (agentId: number, patch: Partial<AgentState>) => void
  regeneratePersonas: () => void
  createSnapshot: () => void
  loadSnapshot: (snapshotId: string) => void
  deleteSnapshot: (snapshotId: string) => void
  clearSnapshots: () => void
}

type SimContextValue = {
  state: SimulationState
  dispatch: (action: Action) => void
  actions: SimActions
}

const SimContext = createContext<SimContextValue | null>(null)

function makeEvent(input: { tick: number; type: any; title: string; agentId?: number; payload?: Record<string, unknown> }) {
  return { id: id('evt'), ...input }
}

export function SimulationProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)

  // 从后端加载数据（如果启用真实 API）
  useEffect(() => {
    if (USE_REAL_API) {
      // 从后端加载智能体数据
      api.agents.getAll().then(agents => {
        // 更新本地状态中的 agents
        for (const agent of agents) {
          // 为每个 agent 初始化一个默认状态
          dispatch({
            type: 'mutate_agent_state',
            agentId: agent.id,
            patch: {
              mood: 0,
              stance: 0,
              resources: 100,
              lastAction: 'idle',
              evidence: { memoryHits: [], reasoningSummary: '', toolCalls: [] }
            }
          })
        }
      }).catch(err => {
        console.error('[SimulationProvider] Failed to load agents from backend:', err)
      })

      // 从后端加载模拟状态
      api.state.get().then(backendState => {
        dispatch({ type: 'set_tick', tick: backendState.tick })
        // 直接设置后端的运行状态，不要 toggle
        dispatch({ type: 'set_running', isRunning: backendState.isRunning })
        dispatch({ type: 'set_speed', speed: backendState.speed })
        if (backendState.selectedAgentId !== null) {
          dispatch({ type: 'set_selected_agent', agentId: backendState.selectedAgentId })
        }
      }).catch(err => {
        console.error('[SimulationProvider] Failed to load state from backend:', err)
      })

      // 连接 WebSocket 并订阅实时更新
      wsClient.connect()
      wsClient.subscribe({ eventTypes: ['tick', 'post', 'event', 'log', 'state'] })

      // 监听 WebSocket 消息
      const unsubscribe = wsClient.onMessage((message) => {
        if (message.type === 'tick_update') {
          dispatch({ type: 'set_tick', tick: message.tick })
          dispatch({ type: 'set_running', isRunning: message.isRunning })
          dispatch({ type: 'set_speed', speed: message.speed })
        } else if (message.type === 'post_created') {
          dispatch({ type: 'push_feed', tick: message.post.tick, authorId: message.post.authorId, content: message.post.content, emotion: message.post.emotion })
        } else if (message.type === 'event_created') {
          dispatch({ type: 'push_event', event: { ...message.event, id: message.event.id || id('evt') } })
        } else if (message.type === 'log_added') {
          dispatch({ type: 'push_log', level: message.log.level, tick: message.log.tick, agentId: message.log.agentId, text: message.log.text })
        } else if (message.type === 'simulation_state') {
          // 完整的状态更新
          dispatch({ type: 'set_tick', tick: message.state.tick })
          dispatch({ type: 'set_running', isRunning: message.state.isRunning })
          dispatch({ type: 'set_speed', speed: message.state.speed })
          if (message.state.selectedAgentId !== null) {
            dispatch({ type: 'set_selected_agent', agentId: message.state.selectedAgentId })
          }
        }
      })

      // 清理函数
      return () => {
        unsubscribe()
        // 注意：不在这里断开 WebSocket，因为其他组件可能也在使用
      }
    }
  }, []) // 只在挂载时执行一次

  const actions = useMemo<SimActions>(() => {
    return {
      toggleRun: async () => {
        const newRunningState = !state.isRunning
        // 先更新本地状态以获得即时响应
        dispatch({ type: 'toggle_run' })

        // 如果使用真实API，同步到后端
        if (USE_REAL_API) {
          try {
            if (newRunningState) {
              await api.simulation.start()
            } else {
              await api.simulation.pause()
            }
          } catch (err) {
            console.error('[SimulationProvider] Failed to toggle run state:', err)
            // 如果API调用失败，恢复本地状态
            dispatch({ type: 'toggle_run' })
          }
        }
      },
      setSpeed: async (speed) => {
        dispatch({ type: 'set_speed', speed })
        if (USE_REAL_API) {
          try {
            await api.simulation.setSpeed(speed)
          } catch (err) {
            console.error('[SimulationProvider] Failed to set speed:', err)
          }
        }
      },
      setTick: async (tick) => {
        dispatch({ type: 'set_tick', tick })
        if (USE_REAL_API) {
          try {
            await api.simulation.setTick(tick)
          } catch (err) {
            console.error('[SimulationProvider] Failed to set tick:', err)
          }
        }
      },
      selectAgent: (agentId) => dispatch({ type: 'set_selected_agent', agentId }),
      logInfo: (text, agentId) => dispatch({ type: 'push_log', level: 'info', tick: state.tick, agentId, text }),
      logOk: (text, agentId) => dispatch({ type: 'push_log', level: 'ok', tick: state.tick, agentId, text }),
      logError: (text, agentId) => dispatch({ type: 'push_log', level: 'error', tick: state.tick, agentId, text }),
      pushEvent: (e) => dispatch({ type: 'push_event', event: makeEvent({ ...e, tick: e.tick }) }),
      pushFeed: (authorId, content, emotion) =>
        dispatch({ type: 'push_feed', tick: state.tick, authorId, content, emotion: clamp(emotion, -1, 1) }),
      applyIntervention: (command, targetAgentId) =>
        dispatch({ type: 'apply_intervention', tick: state.tick, command, targetAgentId }),
      setConfig: (patch) => dispatch({ type: 'set_config', patch }),
      patchAgent: (agentId, patch) => dispatch({ type: 'mutate_agent_state', agentId, patch }),
      regeneratePersonas: () => dispatch({ type: 'regenerate_personas' }),
      createSnapshot: () => dispatch({ type: 'create_snapshot' }),
      loadSnapshot: (snapshotId) => dispatch({ type: 'load_snapshot', snapshotId }),
      deleteSnapshot: (snapshotId) => dispatch({ type: 'delete_snapshot', snapshotId }),
      clearSnapshots: () => dispatch({ type: 'clear_snapshots' }),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.tick, state.isRunning])

  const value = useMemo<SimContextValue>(() => ({ state, dispatch, actions }), [actions, state])

  return <SimContext.Provider value={value}>{children}</SimContext.Provider>
}

export function useSim(): SimContextValue {
  const ctx = useContext(SimContext)
  if (!ctx) throw new Error('useSim must be used within SimulationProvider')
  return ctx
}
