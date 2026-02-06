import { createContext, useContext, useMemo, useReducer, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import type { AgentState, SimulationState } from './types'
import { initialState, reducer } from './state'
import type { Action } from './state'
import { clamp, id } from './util'
import api, { wsClient } from './api'

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
  applyIntervention: (command: string, targetAgentId?: number) => Promise<boolean>
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
  const hydratedRef = useRef(false)
  const hydrateInFlightRef = useRef(false)
  const configPatchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingConfigPatchRef = useRef<Partial<SimulationState['config']>>({})
  const seenFeedIdsRef = useRef<Set<string>>(new Set())
  const seenEventIdsRef = useRef<Set<string>>(new Set())
  const seenLogIdsRef = useRef<Set<string>>(new Set())
  const seenInterventionIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!USE_REAL_API) return

    const hydrateFromBackend = async () => {
      if (hydrateInFlightRef.current || hydratedRef.current) return
      hydrateInFlightRef.current = true

      try {
        const [agents, backendState, interventions, posts, events, logs] = await Promise.all([
          api.agents.getAll(),
          api.state.get(),
          api.interventions.getAll({ limit: 120 }),
          api.feed.getAll({ limit: 220 }),
          api.events.getAll({ limit: 350 }),
          api.logs.getAll({ limit: 450 }),
        ])

        for (const agent of agents) {
          dispatch({
            type: 'mutate_agent_state',
            agentId: agent.id,
            patch: {
              mood: 0,
              stance: 0,
              resources: 100,
              lastAction: 'idle',
              evidence: { memoryHits: [], reasoningSummary: '', toolCalls: [] },
            },
          })
        }

        dispatch({ type: 'set_tick', tick: backendState.tick })
        dispatch({ type: 'set_running', isRunning: backendState.isRunning })
        dispatch({ type: 'set_speed', speed: backendState.speed })
        dispatch({ type: 'set_config', patch: backendState.config })
        if (backendState.selectedAgentId !== null) {
          dispatch({ type: 'set_selected_agent', agentId: backendState.selectedAgentId })
        }

        const tickCap = backendState.tick

        interventions
          .slice()
          .reverse()
          .forEach((iv) => {
            if (seenInterventionIdsRef.current.has(iv.id)) return
            seenInterventionIdsRef.current.add(iv.id)
            dispatch({
              type: 'apply_intervention',
              tick: iv.tick,
              command: iv.command,
              targetAgentId: iv.targetAgentId,
            })
          })

        posts
          .filter(post => post.tick <= tickCap)
          .slice()
          .reverse()
          .forEach((post) => {
            if (seenFeedIdsRef.current.has(post.id)) return
            seenFeedIdsRef.current.add(post.id)
            dispatch({
              type: 'push_feed',
              tick: post.tick,
              authorId: post.authorId,
              authorName: post.authorName,
              content: post.content,
              emotion: post.emotion,
              likes: post.likes,
              postId: post.id,
            })
          })

        events
          .filter(event => event.tick <= tickCap)
          .slice()
          .reverse()
          .forEach((event) => {
            const eventId = event.id || id('evt')
            if (seenEventIdsRef.current.has(eventId)) return
            seenEventIdsRef.current.add(eventId)
            dispatch({ type: 'push_event', event: { ...event, id: eventId } })
          })

        logs
          .filter(log => log.tick <= tickCap)
          .slice()
          .reverse()
          .forEach((log) => {
            if (seenLogIdsRef.current.has(log.id)) return
            seenLogIdsRef.current.add(log.id)
            dispatch({ type: 'push_log', level: log.level, tick: log.tick, agentId: log.agentId, text: log.text })
          })

        hydratedRef.current = true
      } catch (err) {
        console.error('[SimulationProvider] Backend hydrate failed, will retry:', err)
      } finally {
        hydrateInFlightRef.current = false
      }
    }

    const syncStreamFromBackend = async () => {
      if (!hydratedRef.current) return
      try {
        const backendState = await api.state.get()
        const tickCap = backendState.tick
        const [posts, events, logs] = await Promise.all([
          api.feed.getAll({ limit: 220 }),
          api.events.getAll({ limit: 350 }),
          api.logs.getAll({ limit: 450 }),
        ])

        posts
          .filter(post => post.tick <= tickCap)
          .slice()
          .reverse()
          .forEach((post) => {
            if (seenFeedIdsRef.current.has(post.id)) return
            seenFeedIdsRef.current.add(post.id)
            dispatch({
              type: 'push_feed',
              tick: post.tick,
              authorId: post.authorId,
              authorName: post.authorName,
              content: post.content,
              emotion: post.emotion,
              likes: post.likes,
              postId: post.id,
            })
          })

        events
          .filter(event => event.tick <= tickCap)
          .slice()
          .reverse()
          .forEach((event) => {
            const eventId = event.id || id('evt')
            if (seenEventIdsRef.current.has(eventId)) return
            seenEventIdsRef.current.add(eventId)
            dispatch({ type: 'push_event', event: { ...event, id: eventId } })
          })

        logs
          .filter(log => log.tick <= tickCap)
          .slice()
          .reverse()
          .forEach((log) => {
            if (seenLogIdsRef.current.has(log.id)) return
            seenLogIdsRef.current.add(log.id)
            dispatch({ type: 'push_log', level: log.level, tick: log.tick, agentId: log.agentId, text: log.text })
          })
      } catch (err) {
        console.warn('[SimulationProvider] Stream sync failed:', err)
      }
    }

    hydrateFromBackend()

    const retryTimer = window.setInterval(() => {
      if (!hydratedRef.current) {
        hydrateFromBackend()
      }
    }, 3000)
    const streamSyncTimer = window.setInterval(() => {
      syncStreamFromBackend()
    }, 2500)

    wsClient.connect()
    wsClient.subscribe({ eventTypes: ['tick', 'post', 'event', 'log', 'state'] })

    const unsubscribe = wsClient.onMessage((message) => {
      if (message.type === 'tick_update') {
        dispatch({ type: 'set_tick', tick: message.tick })
        dispatch({ type: 'set_running', isRunning: message.isRunning })
        dispatch({ type: 'set_speed', speed: message.speed })
      } else if (message.type === 'post_created') {
        if (seenFeedIdsRef.current.has(message.post.id)) return
        seenFeedIdsRef.current.add(message.post.id)
        dispatch({
          type: 'push_feed',
          tick: message.post.tick,
          authorId: message.post.authorId,
          authorName: message.post.authorName,
          content: message.post.content,
          emotion: message.post.emotion,
          likes: message.post.likes,
          postId: message.post.id,
        })
      } else if (message.type === 'event_created') {
        const eventId = message.event.id || id('evt')
        if (seenEventIdsRef.current.has(eventId)) return
        seenEventIdsRef.current.add(eventId)
        dispatch({ type: 'push_event', event: { ...message.event, id: eventId } })
      } else if (message.type === 'log_added') {
        if (seenLogIdsRef.current.has(message.log.id)) return
        seenLogIdsRef.current.add(message.log.id)
        dispatch({ type: 'push_log', level: message.log.level, tick: message.log.tick, agentId: message.log.agentId, text: message.log.text })
      } else if (message.type === 'simulation_state') {
        dispatch({ type: 'set_tick', tick: message.state.tick })
        dispatch({ type: 'set_running', isRunning: message.state.isRunning })
        dispatch({ type: 'set_speed', speed: message.state.speed })
        dispatch({ type: 'set_config', patch: message.state.config })
        if (message.state.selectedAgentId !== null) {
          dispatch({ type: 'set_selected_agent', agentId: message.state.selectedAgentId })
        }
      } else if (message.type === 'connected') {
        if (!hydratedRef.current) {
          hydrateFromBackend()
        } else {
          syncStreamFromBackend()
        }
      }
    })

    return () => {
      window.clearInterval(retryTimer)
      window.clearInterval(streamSyncTimer)
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    return () => {
      if (configPatchTimerRef.current) {
        window.clearTimeout(configPatchTimerRef.current)
      }
    }
  }, [])

  const actions = useMemo<SimActions>(() => {
    return {
      toggleRun: async () => {
        if (!state.isRunning && !state.config.designReady) {
          dispatch({
            type: 'push_log',
            level: 'error',
            tick: state.tick,
            text: 'run blocked: complete Design and click "Save Changes" first',
          })
          return
        }

        const newRunningState = !state.isRunning
        dispatch({ type: 'toggle_run' })

        if (USE_REAL_API) {
          try {
            if (newRunningState) {
              await api.simulation.start()
            } else {
              await api.simulation.pause()
            }
          } catch (err) {
            console.error('[SimulationProvider] Failed to toggle run state:', err)
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
      applyIntervention: async (command, targetAgentId) => {
        if (USE_REAL_API) {
          try {
            await api.interventions.create({ tick: state.tick, command, targetAgentId })
            dispatch({ type: 'apply_intervention', tick: state.tick, command, targetAgentId })
            return true
          } catch (err) {
            console.error('[SimulationProvider] Failed to apply intervention:', err)
            dispatch({
              type: 'push_log',
              level: 'error',
              tick: state.tick,
              agentId: targetAgentId,
              text: `intervention failed: ${command}`,
            })
            return false
          }
        }

        dispatch({ type: 'apply_intervention', tick: state.tick, command, targetAgentId })
        return true
      },
      setConfig: (patch) => {
        const touchesDesignConfig = ['scenarioText', 'seed', 'ticksPerSecond', 'worldSize', 'sampleAgents', 'viewportMode', 'experimentName']
          .some((key) => key in patch)
        const normalizedPatch =
          touchesDesignConfig && !('designReady' in patch)
            ? { ...patch, designReady: false }
            : patch

        dispatch({ type: 'set_config', patch: normalizedPatch })

        if (!USE_REAL_API) return
        pendingConfigPatchRef.current = { ...pendingConfigPatchRef.current, ...normalizedPatch }

        if (configPatchTimerRef.current) {
          window.clearTimeout(configPatchTimerRef.current)
        }

        configPatchTimerRef.current = window.setTimeout(async () => {
          const configPatch = pendingConfigPatchRef.current
          pendingConfigPatchRef.current = {}
          configPatchTimerRef.current = null

          try {
            await api.state.patch({ config: configPatch })
          } catch (err) {
            console.error('[SimulationProvider] Failed to persist config:', err)
          }
        }, 500)
      },
      patchAgent: (agentId, patch) => dispatch({ type: 'mutate_agent_state', agentId, patch }),
      regeneratePersonas: () => dispatch({ type: 'regenerate_personas' }),
      createSnapshot: () => dispatch({ type: 'create_snapshot' }),
      loadSnapshot: (snapshotId) => dispatch({ type: 'load_snapshot', snapshotId }),
      deleteSnapshot: (snapshotId) => dispatch({ type: 'delete_snapshot', snapshotId }),
      clearSnapshots: () => dispatch({ type: 'clear_snapshots' }),
    }
  }, [state.tick, state.isRunning])

  const value = useMemo<SimContextValue>(() => ({ state, dispatch, actions }), [actions, state])

  return <SimContext.Provider value={value}>{children}</SimContext.Provider>
}

export function useSim(): SimContextValue {
  const ctx = useContext(SimContext)
  if (!ctx) throw new Error('useSim must be used within SimulationProvider')
  return ctx
}
