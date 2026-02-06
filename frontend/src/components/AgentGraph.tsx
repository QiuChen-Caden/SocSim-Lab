import { useEffect, useMemo, useRef, useState } from 'react'
import type { AgentGraph } from '../app/agentGraph'
import { clamp, hash01 } from '../app/util'

type AgentGraphProps = {
  graph: AgentGraph
  focusId?: number | null
  onSelectAgent?: (agentId: number) => void
  height?: number
  canvasScale?: number
  onCanvasScaleChange?: (scale: number) => void
}

type Size = { w: number; h: number }

const GROUP_PALETTE = ['#6aa7ff', '#41d39f', '#ffc24b', '#ff5b7a', '#b48cff', '#7fb2ff', '#58d1ff']

function colorForGroup(group: string) {
  let acc = 0
  for (let i = 0; i < group.length; i++) acc = (acc * 31 + group.charCodeAt(i)) >>> 0
  return GROUP_PALETTE[acc % GROUP_PALETTE.length]
}

export function AgentGraphCanvas({ graph, focusId, onSelectAgent, height, canvasScale = 1.0, onCanvasScaleChange }: AgentGraphProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [size, setSize] = useState<Size>({ w: 0, h: 0 })
  const hoverRef = useRef<number | null>(null)
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null)
  const [localScale, setLocalScale] = useState(canvasScale)

  const indexById = useMemo(() => {
    const m = new Map<number, number>()
    for (let i = 0; i < graph.nodes.length; i++) m.set(graph.nodes[i].id, i)
    return m
  }, [graph.nodes])

  const simRef = useRef<{
    pos: Float32Array
    vel: Float32Array
    draggingIdx: number | null
    iterationsLeft: number
  } | null>(null)

  // resize
  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const apply = () => {
      const w = Math.max(1, Math.floor(host.clientWidth || 0))
      const h = Math.max(1, Math.floor(host.clientHeight || 0))
      setSize({ w, h })
    }

    apply()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => apply())
    ro.observe(host)
    return () => ro.disconnect()
  }, [])

  // init sim state when graph changes
  useEffect(() => {
    const n = graph.nodes.length
    const pos = new Float32Array(n * 2)
    const vel = new Float32Array(n * 2)

    const groups = Array.from(new Set(graph.nodes.map((x) => x.group))).sort()
    const groupIndex = new Map<string, number>()
    for (let i = 0; i < groups.length; i++) groupIndex.set(groups[i], i)

    for (let i = 0; i < n; i++) {
      const node = graph.nodes[i]
      const gi = groupIndex.get(node.group) ?? 0
      const t = (gi + 0.5) / Math.max(1, groups.length)
      const angle = t * Math.PI * 2 + (hash01(node.id * 13.7) - 0.5) * 0.55
      const r = 0.18 + (hash01(node.id * 3.1) - 0.5) * 0.10
      pos[i * 2] = Math.cos(angle) * r
      pos[i * 2 + 1] = Math.sin(angle) * r
      vel[i * 2] = 0
      vel[i * 2 + 1] = 0
    }

    simRef.current = { pos, vel, draggingIdx: null, iterationsLeft: 240 }
  }, [graph.nodes, graph.edges])

  // simulation + draw loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const n = graph.nodes.length
    if (n === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (size.w <= 0 || size.h <= 0) return

    const sim = simRef.current
    if (!sim) return

    let disposed = false
    let rafId = 0

    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1))
    canvas.width = Math.max(1, size.w * dpr)
    canvas.height = Math.max(1, size.h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const pad = 18
    const w = size.w
    const h = size.h
    const cx = w / 2
    const cy = h / 2
    const scale = Math.min(w, h) * 0.44 * localScale

    const edgesIdx = graph.edges
      .map((e) => {
        const s = indexById.get(e.source)
        const t = indexById.get(e.target)
        if (s == null || t == null) return null
        return { s, t, strength: e.strength, kind: e.kind }
      })
      .filter(Boolean) as Array<{ s: number; t: number; strength: number; kind: string }>

    const step = () => {
      if (disposed) return

      // physics in normalized space (-1..1), then mapped to canvas
      const pos = sim.pos
      const vel = sim.vel

      const repulse = n <= 220 ? 0.0035 : 0.0025
      const springK = 0.008
      const springLen = 0.26
      const centerK = 0.006
      const damp = 0.82

      if (sim.iterationsLeft > 0) {
        // repulsion
        for (let i = 0; i < n; i++) {
          for (let j = i + 1; j < n; j++) {
            const ix = i * 2
            const jx = j * 2
            const dx = pos[ix] - pos[jx]
            const dy = pos[ix + 1] - pos[jx + 1]
            const d2 = dx * dx + dy * dy + 0.0006
            const f = repulse / d2
            vel[ix] += dx * f
            vel[ix + 1] += dy * f
            vel[jx] -= dx * f
            vel[jx + 1] -= dy * f
          }
        }

        // springs along edges
        for (const e of edgesIdx) {
          const ia = e.s * 2
          const ib = e.t * 2
          const dx = pos[ib] - pos[ia]
          const dy = pos[ib + 1] - pos[ia + 1]
          const dist = Math.sqrt(dx * dx + dy * dy) + 0.0001
          const k = springK * (0.6 + e.strength)
          const f = (dist - springLen) * k
          const nx = dx / dist
          const ny = dy / dist
          vel[ia] += nx * f
          vel[ia + 1] += ny * f
          vel[ib] -= nx * f
          vel[ib + 1] -= ny * f
        }

        // center force + integrate
        for (let i = 0; i < n; i++) {
          const ix = i * 2
          vel[ix] += -pos[ix] * centerK
          vel[ix + 1] += -pos[ix + 1] * centerK

          // don't fight the user while dragging
          if (sim.draggingIdx === i) {
            vel[ix] = 0
            vel[ix + 1] = 0
            continue
          }

          vel[ix] *= damp
          vel[ix + 1] *= damp
          pos[ix] += vel[ix]
          pos[ix + 1] += vel[ix + 1]

          pos[ix] = clamp(pos[ix], -0.95, 0.95)
          pos[ix + 1] = clamp(pos[ix + 1], -0.95, 0.95)
        }

        sim.iterationsLeft -= 1
      }

      // draw
      ctx.clearRect(0, 0, w, h)

      // background
      ctx.fillStyle = 'rgba(0,0,0,0.12)'
      ctx.fillRect(0, 0, w, h)

      // edges
      ctx.lineCap = 'round'
      for (const e of edgesIdx) {
        const ia = e.s * 2
        const ib = e.t * 2
        const ax = cx + pos[ia] * scale
        const ay = cy + pos[ia + 1] * scale
        const bx = cx + pos[ib] * scale
        const by = cy + pos[ib + 1] * scale

        const alpha = e.kind === 'follow' ? 0.35 : e.kind === 'group' ? 0.25 : 0.18
        ctx.strokeStyle = `rgba(231,236,255,${alpha})`
        ctx.lineWidth = e.kind === 'follow' ? 1.4 : 0.9
        ctx.beginPath()

        // Use quadratic curve for Obsidian-like curved edges
        const midX = (ax + bx) / 2
        const midY = (ay + by) / 2
        // Add slight curve offset based on direction
        const dx = bx - ax
        const dy = by - ay
        const offsetX = -dy * 0.15
        const offsetY = dx * 0.15
        const ctrlX = midX + offsetX
        const ctrlY = midY + offsetY

        ctx.moveTo(ax, ay)
        ctx.quadraticCurveTo(ctrlX, ctrlY, bx, by)
        ctx.stroke()
      }

      // nodes
      for (let i = 0; i < n; i++) {
        const node = graph.nodes[i]
        const ix = i * 2
        const x = cx + pos[ix] * scale
        const y = cy + pos[ix + 1] * scale
        const isFocus = focusId != null && node.id === focusId
        const hoverNow = hoverRef.current
        const isHover = hoverNow != null && node.id === hoverNow

        const r = isFocus ? 7.5 : isHover ? 6.2 : 4.8

        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fillStyle = colorForGroup(node.group)
        ctx.fill()

        ctx.lineWidth = isFocus ? 2.2 : 1.2
        ctx.strokeStyle = isFocus ? 'rgba(255,255,255,0.92)' : 'rgba(11,16,32,0.75)'
        ctx.stroke()
      }

      // border
      ctx.strokeStyle = 'rgba(255,255,255,0.10)'
      ctx.lineWidth = 1
      ctx.strokeRect(pad / 2, pad / 2, w - pad, h - pad)

      rafId = window.requestAnimationFrame(step)
    }

    rafId = window.requestAnimationFrame(step)
    return () => {
      disposed = true
      if (rafId) window.cancelAnimationFrame(rafId)
    }
  }, [focusId, graph.edges, graph.nodes, indexById, size.h, size.w, localScale])

  const hitTest = (clientX: number, clientY: number) => {
    const host = hostRef.current
    const canvas = canvasRef.current
    const sim = simRef.current
    if (!host || !canvas || !sim) return null

    const rect = canvas.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top

    const w = Math.max(1, rect.width)
    const h = Math.max(1, rect.height)
    const cx = w / 2
    const cy = h / 2
    const scale = Math.min(w, h) * 0.44 * localScale

    let best: { idx: number; d2: number; sx: number; sy: number } | null = null
    for (let i = 0; i < graph.nodes.length; i++) {
      const ix = i * 2
      const sx = cx + sim.pos[ix] * scale
      const sy = cy + sim.pos[ix + 1] * scale
      const dx = sx - x
      const dy = sy - y
      const d2 = dx * dx + dy * dy
      const r = graph.nodes[i].id === focusId ? 8.5 : 6.5
      if (d2 <= r * r && (!best || d2 < best.d2)) best = { idx: i, d2, sx, sy }
    }

    if (!best) return null
    return { idx: best.idx, x, y, sx: best.sx, sy: best.sy, node: graph.nodes[best.idx] }
  }

  return (
    <div ref={hostRef} className="agentGraph" style={height ? { height } : undefined}>
      <canvas
        ref={canvasRef}
        className="agentGraph__canvas"
        onPointerMove={(e) => {
          const hit = hitTest(e.clientX, e.clientY)
          if (!hit) {
            hoverRef.current = null
            setTip(null)
            return
          }
          hoverRef.current = hit.node.id
          setTip({ x: hit.x + 10, y: hit.y + 10, text: `${hit.node.label} · ${hit.node.group} · id=${hit.node.id}` })
        }}
        onPointerLeave={() => {
          hoverRef.current = null
          setTip(null)
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return
          const hit = hitTest(e.clientX, e.clientY)
          if (!hit) return
          const sim = simRef.current
          if (!sim) return
          sim.draggingIdx = hit.idx
          ;(e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId)
        }}
        onPointerUp={(e) => {
          const sim = simRef.current
          if (!sim) return
          const wasDragging = sim.draggingIdx != null
          sim.draggingIdx = null
          try {
            ;(e.currentTarget as HTMLCanvasElement).releasePointerCapture(e.pointerId)
          } catch {
            // ignore
          }

          if (!wasDragging) return
          const hit = hitTest(e.clientX, e.clientY)
          if (hit && onSelectAgent) onSelectAgent(hit.node.id)
        }}
        onPointerCancel={(e) => {
          const sim = simRef.current
          if (sim) sim.draggingIdx = null
          try {
            ;(e.currentTarget as HTMLCanvasElement).releasePointerCapture(e.pointerId)
          } catch {
            // ignore
          }
        }}
        onPointerMoveCapture={(e) => {
          const sim = simRef.current
          if (!sim || sim.draggingIdx == null) return

          const canvas = canvasRef.current
          if (!canvas) return
          const rect = canvas.getBoundingClientRect()
          const px = e.clientX - rect.left
          const py = e.clientY - rect.top

          const w = Math.max(1, rect.width)
          const h = Math.max(1, rect.height)
          const cx = w / 2
          const cy = h / 2
          const scale = Math.min(w, h) * 0.44 * localScale

          const nx = clamp((px - cx) / scale, -0.95, 0.95)
          const ny = clamp((py - cy) / scale, -0.95, 0.95)

          const i = sim.draggingIdx
          sim.pos[i * 2] = nx
          sim.pos[i * 2 + 1] = ny
          sim.iterationsLeft = Math.max(sim.iterationsLeft, 60)
        }}
      />

      {tip && (
        <div className="agentGraph__tip" style={{ left: tip.x, top: tip.y }}>
          {tip.text}
        </div>
      )}

      <div style={{
        position: 'absolute',
        bottom: 8,
        left: 8,
        right: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        background: 'rgba(11, 16, 32, 0.85)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '10px',
        fontSize: 12,
      }}>
        <span className="muted" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>Zoom 缩放</span>
        <input
          type="range"
          min={0.5}
          max={2.0}
          step={0.05}
          value={localScale}
          onChange={(e) => {
            const newScale = Number(e.target.value)
            setLocalScale(newScale)
            if (onCanvasScaleChange) onCanvasScaleChange(newScale)
          }}
          style={{ flex: 1, minWidth: 60 }}
        />
        <span className="pill" style={{ fontSize: 11 }}>{localScale.toFixed(2)}x</span>
      </div>
    </div>
  )
}
