/**
 * 基于 OASIS 模拟的真实 API 引擎 Real API-based engine for OASIS simulation.
 *
 * 此 Hook 连接到后端 API 服务进行真实模拟 This hook connects to the backend API service for real simulation
 * 而不是使用模拟数据 instead of using mock data.
 */
import { useEffect, useRef, useCallback } from 'react'
import { useSim } from './SimulationProvider'
import api, { wsClient } from '../api'
import type { WebSocketMessage } from '../types'

// 是否使用真实 API 或模拟 Whether to use real API or mock
const USE_REAL_API = import.meta.env.VITE_USE_REAL_API === 'true'

// 暂时禁用 WebSocket，使用 HTTP 轮询
const USE_WEBSOCKET = false

/**
 * 使用真实后端 API 进行模拟的 Hook Hook that uses the real backend API for simulation.
 * 当后端可用时替换 useMockEngine Replaces useMockEngine when the backend is available.
 */
export function useRealEngine() {
  const sim = useSim()
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const wsUnsubscribeRef = useRef<(() => void) | null>(null)
  const isInitializedRef = useRef(false)

  // 从后端初始化模拟状态 Initialize simulation state from backend
  const initializeFromBackend = useCallback(async () => {
    try {
      // 获取完整模拟状态 Get full simulation state
      const state = await api.state.get()

      // 获取所有智能体 Get all agents
      const agents = await api.agents.getAll()

      // 并行获取所有智能体状态（比顺序快得多） Fetch all agent states in parallel (much faster than sequential)
      const agentStatePromises = agents.map(agent =>
        api.agents.getState(agent.id).catch(err => {
          console.warn(`[RealEngine] Failed to get state for agent ${agent.id}:`, err)
          // 错误时返回默认状态 Return default state on error
          return { mood: 0.5, stance: 0, resources: 0.5, lastAction: 'error' }
        })
      )
      const agentStates = await Promise.all(agentStatePromises)

      // 使用真实状态构建智能体映射 Build agents map with real states
      const agentsMap: Record<number, { profile: typeof agents[0]; state: typeof agentStates[0] }> = {}
      for (let i = 0; i < agents.length; i++) {
        agentsMap[agents[i].id] = {
          profile: agents[i],
          state: agentStates[i],
        }
      }

      // 预热核心资源缓存 Warm cache for core resources.
      await api.events.getAll({ limit: 350 })
      await api.logs.getAll({ limit: 450 })
      await api.feed.getAll({ limit: 220 })

      // 更新模拟状态 Update simulation state
      sim.actions.setTick(state.tick)

      // 使用真实状态在模拟中初始化智能体 Initialize agents in simulation with real states
      for (const [id, agent] of Object.entries(agentsMap)) {
        // patchAgent 将通过 ensureAgent 确保智能体存在 patchAgent will ensure agent exists via ensureAgent
        sim.actions.patchAgent(Number(id), agent.state)
      }

      console.log('[RealEngine] Initialized from backend with real agent states')
      isInitializedRef.current = true
    } catch (error) {
      console.error('[RealEngine] Failed to initialize:', error)
    }
  }, [sim])

  // WebSocket 消息处理器 WebSocket message handler
  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case 'tick_update':
        sim.actions.setTick(message.tick)
        if (message.isRunning !== sim.state.isRunning) {
          sim.actions.toggleRun()
        }
        if (message.speed !== sim.state.speed) {
          sim.actions.setSpeed(message.speed)
        }
        break

      case 'agent_update': {
        const { agentId, state } = message
        sim.actions.patchAgent(agentId, state)
        break
      }

      case 'post_created': {
        const { post } = message
        sim.actions.pushFeed(post.authorId, post.content, post.emotion)
        break
      }

      case 'event_created': {
        const { event } = message
        sim.actions.pushEvent(event)
        break
      }

      case 'log_added': {
        const { log } = message
        sim.dispatch({ type: 'push_log', level: log.level, tick: log.tick, agentId: log.agentId, text: log.text })
        break
      }

      case 'simulation_state': {
        // 完整状态更新 - 可能触发重新初始化 Full state update - could trigger a re-init
        console.log('[RealEngine] Received full state update')
        break
      }

      case 'error': {
        console.error('[RealEngine] Server error:', message.error)
        sim.dispatch({ type: 'push_log', level: 'error', tick: sim.state.tick, text: `Server: ${message.error}` })
        break
      }

      case 'connected':
        console.log('[RealEngine] WebSocket connected, client ID:', message.clientId)
        break

      case 'pong':
        // 心跳响应，忽略 Heartbeat response, ignore
        break

      default:
        console.log('[RealEngine] Unknown message type:', (message as { type: string }).type)
    }
  }, [sim])

  // 定期同步模拟状态到后端并轮询更新 Sync simulation state to backend periodically and poll for updates
  useEffect(() => {
    if (!isInitializedRef.current) {
      initializeFromBackend()
    }

    // 设置定期同步和轮询 Set up periodic sync and polling
    syncIntervalRef.current = setInterval(async () => {
      try {
        // 从后端获取最新状态 Fetch latest state from backend
        const backendState = await api.state.get()

        // 使用后端值更新本地状态（仅当不同时以避免循环） Update local state with backend values (only if different to avoid loops)
        sim.dispatch({ type: 'set_tick', tick: backendState.tick })

        // 同步 isRunning - 仅当不同时切换 Sync isRunning - only toggle if different
        const currentIsRunning = sim.state.isRunning
        if (backendState.isRunning !== currentIsRunning) {
          sim.dispatch({ type: 'toggle_run' })
        }

        // 同步速度 Sync speed
        if (backendState.speed !== sim.state.speed) {
          sim.dispatch({ type: 'set_speed', speed: backendState.speed })
        }

        // 将 selectedAgentId（用户选择）同步到后端 Sync selectedAgentId (user selection) to backend
        await api.state.patch({
          selectedAgentId: sim.state.selectedAgentId,
        })
      } catch (error) {
        console.error('[RealEngine] Sync/poll failed:', error)
      }
    }, 2000) // 每 2 秒轮询一次以减少负载 Poll every 2 seconds to reduce load

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current)
      }
    }
  }, [sim.dispatch, sim.state.selectedAgentId, initializeFromBackend, USE_WEBSOCKET])

  // WebSocket 连接（暂时禁用） WebSocket connection (temporarily disabled)
  useEffect(() => {
    if (!USE_WEBSOCKET) {
      console.log('[RealEngine] WebSocket disabled, using HTTP polling only')
      return
    }

    // 连接到 WebSocket Connect to WebSocket
    wsClient.connect()

    // 订阅相关事件 Subscribe to relevant events
    wsClient.subscribe({
      eventTypes: ['tick', 'post', 'event', 'log', 'agent_update', 'state', 'error'],
    })

    // 设置消息监听器 Set up message listener
    wsUnsubscribeRef.current = wsClient.onMessage(handleWebSocketMessage)

    // 每 30 秒发送一次 ping 以保持连接 Ping every 30 seconds to keep connection alive
    const pingInterval = setInterval(() => {
      wsClient.ping()
    }, 30000)

    return () => {
      if (wsUnsubscribeRef.current) {
        wsUnsubscribeRef.current()
      }
      clearInterval(pingInterval)
      wsClient.disconnect()
    }
  }, [handleWebSocketMessage])

  // 处理模拟控制操作（仅限用户发起） Handle simulation control actions (user-initiated only)
  // 不要在轮询更新时触发 - 使用 ref 来跟踪来源 Don't trigger on polling updates - use a ref to track the source
  const lastIsRunningRef = useRef(false)

  useEffect(() => {
    // 检查这是否是用户发起的更改（不是来自轮询） Check if this is a user-initiated change (not from polling)
    const isUserInitiated = sim.state.isRunning !== lastIsRunningRef.current
    lastIsRunningRef.current = sim.state.isRunning

    if (!isUserInitiated) {
      return // 如果此更改来自轮询则跳过 Skip if this change came from polling
    }

    // 此效果响应用户模拟控制更改 This effect responds to USER simulation control changes
    // 并将它们转发到后端 and forwards them to the backend
    const controlSimulation = async () => {
      try {
        if (sim.state.isRunning) {
          await api.simulation.start(sim.state.speed)
        } else {
          await api.simulation.stop()
        }
      } catch (error) {
        console.error('[RealEngine] Control failed:', error)
      }
    }

    // 防抖控制更改 Debounce control changes
    const timeoutId = setTimeout(controlSimulation, 100)
    return () => clearTimeout(timeoutId)
  }, [sim.state.isRunning, sim.state.speed])

  return {
    isInitialized: isInitializedRef.current,
    isConnected: wsClient.isConnected(),
    clientId: wsClient.getClientId(),
  }
}

/**
 * 条件 Hook：如果可用则使用真实 API，否则回退到模拟
 * Conditional hook that uses real API if available, otherwise falls back to mock.
 */
export function useEngine() {
  const realEngine = useRealEngine()

  // Import mock engine dynamically
  useEffect(() => {
    if (!USE_REAL_API) {
      console.log('[Engine] Using mock engine (VITE_USE_REAL_API is not set)')
    } else {
      console.log('[Engine] Using real API backend')
    }
  }, [])

  return {
    ...realEngine,
    useRealApi: USE_REAL_API,
  }
}

export default useRealEngine
