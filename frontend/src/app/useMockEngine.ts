import { useEffect, useRef } from 'react'
import { useSim } from './SimulationProvider'
import { agentName, clamp, hash01 } from './util'

export function useMockEngine() {
  const sim = useSim()
  const lastTsRef = useRef<number | null>(null)
  const tickAccRef = useRef<number>(sim.state.tick)
  const currentTickRef = useRef<number>(sim.state.tick)
  const streamRef = useRef<{ cancel: () => void } | null>(null)

  useEffect(() => {
    tickAccRef.current = sim.state.tick
    currentTickRef.current = sim.state.tick
  }, [sim.state.tick])

  useEffect(() => {
    function maybeStreamThink(agentId: number, tick: number) {
      if (streamRef.current) streamRef.current.cancel()

      let alive = true
      const base =
        `agent_${agentId} thinking @tick ${tick}:\n` +
        `- goal: maximize social + resources\n` +
        `- constraints: keep stance stable\n` +
        `- decision: post + ping one neighbor\n` +
        `- evidence: memory_hits + tool_trace\n`

      let i = 0
      const timer = window.setInterval(() => {
        if (!alive) return
        i += 3
        sim.actions.logInfo(base.slice(0, Math.min(base.length, i)), agentId)
        if (i >= base.length) {
          window.clearInterval(timer)
          sim.actions.logOk(`agent_${agentId}: done`, agentId)
        }
      }, 40)

      streamRef.current = {
        cancel: () => {
          alive = false
          window.clearInterval(timer)
        },
      }
    }

    const timer = window.setInterval(() => {
      const now = performance.now()
      const last = lastTsRef.current ?? now
      lastTsRef.current = now

      if (!sim.state.isRunning) return

      const dt = Math.max(0, now - last) / 1000
      const tps = sim.state.config.ticksPerSecond
      const nextAcc = tickAccRef.current + dt * tps * sim.state.speed
      const nextTick = Math.floor(nextAcc)
      tickAccRef.current = nextAcc

      if (nextTick === currentTickRef.current) return
      currentTickRef.current = nextTick
      sim.actions.setTick(nextTick)

      // 每 tick 都随机更新一些智能体的状态
      const sampleAgents = sim.state.config.sampleAgents
      const numAgentsToUpdate = Math.max(5, Math.floor(sampleAgents / 200))
      for (let i = 0; i < numAgentsToUpdate; i++) {
        const randomAgentId = Math.floor(hash01(nextTick * 11 + i * 7) * sampleAgents)
        const emotion = clamp(hash01(randomAgentId * 97 + nextTick * 3) * 2 - 1, -1, 1)

        // 更新智能体的 mood（让它动态变化）
        sim.actions.patchAgent(randomAgentId, {
          mood: clamp(emotion + (Math.sin(nextTick / 20 + randomAgentId) * 0.3), -1, 1),
          lastAction: emotion > 0.4 ? 'celebrate' : emotion < -0.4 ? 'complain' : 'observe',
        })
      }

      if (nextTick % 7 === 0) {
        const agentId = sim.state.selectedAgentId ?? 42
        const emotion = clamp(hash01(agentId * 97 + nextTick) * 2 - 1, -1, 1)
        const action = emotion > 0.35 ? 'share news' : emotion < -0.35 ? 'argue' : 'chat'

        sim.actions.pushEvent({
          tick: nextTick,
          type: 'agent_action',
          agentId,
          title: `agent_${agentId} action: ${action}`,
          payload: { emotion, action },
        })

        sim.actions.patchAgent(agentId, { lastAction: action })

        if (nextTick % 14 === 0) {
          sim.actions.pushFeed(agentId, `(${agentName(agentId)}) ${action} · tick=${nextTick}（mock post）`, emotion)
        }

        maybeStreamThink(agentId, nextTick)
      }

      if (nextTick % 31 === 0) {
        const agentId = sim.state.selectedAgentId ?? 42
        if (hash01(agentId * 13 + nextTick) > 0.88) {
          sim.actions.pushEvent({
            tick: nextTick,
            type: 'alert',
            agentId,
            title: `tool call timeout (mock)`,
            payload: { tool: 'call_world_api', timeoutMs: 3000 },
          })
          sim.actions.logError(`agent_${agentId}: tool call timeout (mock)`, agentId)
        }
      }
    }, 60)

    return () => {
      window.clearInterval(timer)
      if (streamRef.current) streamRef.current.cancel()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sim.state.config.ticksPerSecond, sim.state.isRunning, sim.state.selectedAgentId, sim.state.speed])

  useEffect(() => {
    sim.actions.pushEvent({
      tick: sim.state.tick,
      type: 'bookmark',
      title: 'UI connected (mock)',
      payload: { agentCount: sim.state.config.agentCount },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
