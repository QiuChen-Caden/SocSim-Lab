/**
 * Real API-based engine for OASIS simulation.
 *
 * This hook connects to the backend API service for real simulation
 * instead of using mock data.
 */
import { useEffect, useRef, useCallback } from 'react'
import { useSim } from './SimulationProvider'
import api, { wsClient, type WebSocketMessage } from './api'

// Whether to use real API or mock
const USE_REAL_API = import.meta.env.VITE_USE_REAL_API === 'true'

// 暂时禁用 WebSocket，使用 HTTP 轮询
const USE_WEBSOCKET = false

/**
 * Hook that uses the real backend API for simulation.
 * Replaces useMockEngine when the backend is available.
 */
export function useRealEngine() {
  const sim = useSim()
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const wsUnsubscribeRef = useRef<(() => void) | null>(null)
  const isInitializedRef = useRef(false)

  // Initialize simulation state from backend
  const initializeFromBackend = useCallback(async () => {
    try {
      // Get full simulation state
      const state = await api.state.get()

      // Get all agents
      const agents = await api.agents.getAll()

      // Fetch all agent states in parallel (much faster than sequential)
      const agentStatePromises = agents.map(agent =>
        api.agents.getState(agent.id).catch(err => {
          console.warn(`[RealEngine] Failed to get state for agent ${agent.id}:`, err)
          // Return default state on error
          return { mood: 0.5, stance: 0, resources: 0.5, lastAction: 'error' }
        })
      )
      const agentStates = await Promise.all(agentStatePromises)

      // Build agents map with real states
      const agentsMap: Record<number, { profile: typeof agents[0]; state: typeof agentStates[0] }> = {}
      for (let i = 0; i < agents.length; i++) {
        agentsMap[agents[i].id] = {
          profile: agents[i],
          state: agentStates[i],
        }
      }

      // Warm cache for core resources.
      await api.events.getAll({ limit: 350 })
      await api.logs.getAll({ limit: 450 })
      await api.feed.getAll({ limit: 220 })

      // Update simulation state
      sim.actions.setTick(state.tick)

      // Initialize agents in simulation with real states
      for (const [id, agent] of Object.entries(agentsMap)) {
        // patchAgent will ensure agent exists via ensureAgent
        sim.actions.patchAgent(Number(id), agent.state)
      }

      console.log('[RealEngine] Initialized from backend with real agent states')
      isInitializedRef.current = true
    } catch (error) {
      console.error('[RealEngine] Failed to initialize:', error)
    }
  }, [sim])

  // WebSocket message handler
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
        // Full state update - could trigger a re-init
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
        // Heartbeat response, ignore
        break

      default:
        console.log('[RealEngine] Unknown message type:', (message as { type: string }).type)
    }
  }, [sim])

  // Sync simulation state to backend periodically and poll for updates
  useEffect(() => {
    if (!isInitializedRef.current) {
      initializeFromBackend()
    }

    // Set up periodic sync and polling
    syncIntervalRef.current = setInterval(async () => {
      try {
        // Fetch latest state from backend
        const backendState = await api.state.get()

        // Update local state with backend values (only if different to avoid loops)
        sim.dispatch({ type: 'set_tick', tick: backendState.tick })

        // Sync isRunning - only toggle if different
        const currentIsRunning = sim.state.isRunning
        if (backendState.isRunning !== currentIsRunning) {
          sim.dispatch({ type: 'toggle_run' })
        }

        // Sync speed
        if (backendState.speed !== sim.state.speed) {
          sim.dispatch({ type: 'set_speed', speed: backendState.speed })
        }

        // Sync selectedAgentId (user selection) to backend
        await api.state.patch({
          selectedAgentId: sim.state.selectedAgentId,
        })
      } catch (error) {
        console.error('[RealEngine] Sync/poll failed:', error)
      }
    }, 2000) // Poll every 2 seconds to reduce load

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current)
      }
    }
  }, [sim.dispatch, sim.state.selectedAgentId, initializeFromBackend])

  // WebSocket connection (暂时禁用)
  useEffect(() => {
    if (!USE_WEBSOCKET) {
      console.log('[RealEngine] WebSocket disabled, using HTTP polling only')
      return
    }

    // Connect to WebSocket
    wsClient.connect()

    // Subscribe to relevant events
    wsClient.subscribe({
      eventTypes: ['tick', 'post', 'event', 'log', 'agent_update', 'state', 'error'],
    })

    // Set up message listener
    wsUnsubscribeRef.current = wsClient.onMessage(handleWebSocketMessage)

    // Ping every 30 seconds to keep connection alive
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

  // Handle simulation control actions (user-initiated only)
  // Don't trigger on polling updates - use a ref to track the source
  const lastIsRunningRef = useRef(false)

  useEffect(() => {
    // Check if this is a user-initiated change (not from polling)
    const isUserInitiated = sim.state.isRunning !== lastIsRunningRef.current
    lastIsRunningRef.current = sim.state.isRunning

    if (!isUserInitiated) {
      return // Skip if this change came from polling
    }

    // This effect responds to USER simulation control changes
    // and forwards them to the backend
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

    // Debounce control changes
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
