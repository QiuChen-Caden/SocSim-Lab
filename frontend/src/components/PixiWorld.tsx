import { Application, Graphics, Sprite, Texture } from 'pixi.js'
import { Viewport } from 'pixi-viewport'
import { useEffect, useRef } from 'react'
import { useSim } from '../app/SimulationProvider'
import { clamp, hash01, posAtTick } from '../app/util'

function moodToColor(mood: number): number {
  const clamped = clamp(mood, -1, 1)

  const negativeColor = { r: 255, g: 68, b: 68 }
  const neutralColor = { r: 255, g: 204, b: 0 }
  const positiveColor = { r: 68, g: 255, b: 68 }

  let r: number
  let g: number
  let b: number

  if (clamped < 0) {
    const t = clamped + 1
    r = Math.round(negativeColor.r + (neutralColor.r - negativeColor.r) * t)
    g = Math.round(negativeColor.g + (neutralColor.g - negativeColor.g) * t)
    b = Math.round(negativeColor.b + (neutralColor.b - negativeColor.b) * t)
  } else {
    const t = clamped
    r = Math.round(neutralColor.r + (positiveColor.r - neutralColor.r) * t)
    g = Math.round(neutralColor.g + (positiveColor.g - neutralColor.g) * t)
    b = Math.round(neutralColor.b + (positiveColor.b - neutralColor.b) * t)
  }

  return (r << 16) | (g << 8) | b
}

function getAgentMood(agentId: number, tick: number): number {
  const seed = 20260121
  const baseMood = clamp(hash01(seed + agentId * 13) * 2 - 1, -1, 1)
  const cycle1 = Math.sin((tick + agentId * 17) / 30) * 0.4
  const cycle2 = Math.cos((tick + agentId * 23) / 50) * 0.3
  const randomFluctuation = (hash01(tick * 7 + agentId * 11) * 2 - 1) * 0.2
  const groupEffect = Math.sin((tick + Math.floor(agentId / 100) * 19) / 40) * 0.25
  return clamp(baseMood * 0.3 + cycle1 + cycle2 + randomFluctuation + groupEffect, -1, 1)
}

function influenceSize(tier?: string): number {
  if (tier === 'elite') return 1.35
  if (tier === 'opinion_leader') return 1.15
  return 0.95
}

function stanceAlpha(stance?: number): number {
  if (typeof stance !== 'number') return 0.82
  return clamp(0.68 + Math.abs(stance) * 0.28, 0.68, 0.96)
}

type PixiWorldProps = {
  zoomLevel?: number
  onZoomChange?: (zoom: number) => void
}

export function PixiWorld({ zoomLevel, onZoomChange }: PixiWorldProps) {
  const sim = useSim()
  const externalZoomRef = useRef<number | undefined>(zoomLevel)
  const hostRef = useRef<HTMLDivElement | null>(null)
  const viewportRef = useRef<Viewport | null>(null)
  const spritesRef = useRef<Array<{ id: number; sprite: Sprite }>>([])
  const binsRef = useRef<Graphics | null>(null)
  const focusOverlayRef = useRef<Graphics | null>(null)
  const dotTextureRef = useRef<Texture | null>(null)
  const tickRef = useRef(0)
  const selectedRef = useRef<number | null>(null)
  const modeRef = useRef(sim.state.config.viewportMode)
  const worldSizeRef = useRef(sim.state.config.worldSize)
  const agentMetaRef = useRef<Record<number, { tier?: string; stance?: number }>>({})

  useEffect(() => {
    tickRef.current = sim.state.tick
    selectedRef.current = sim.state.selectedAgentId
    modeRef.current = sim.state.config.viewportMode
    worldSizeRef.current = sim.state.config.worldSize
  }, [sim.state.config.viewportMode, sim.state.config.worldSize, sim.state.selectedAgentId, sim.state.tick])

  useEffect(() => {
    const meta: Record<number, { tier?: string; stance?: number }> = {}
    for (const [idText, agent] of Object.entries(sim.state.agents)) {
      const id = Number(idText)
      meta[id] = {
        tier: agent.profile.social_status.influence_tier,
        stance: agent.state.stance,
      }
    }
    agentMetaRef.current = meta
  }, [sim.state.agents])

  useEffect(() => {
    const viewport = viewportRef.current
    if (viewport && zoomLevel !== undefined && zoomLevel !== externalZoomRef.current) {
      externalZoomRef.current = zoomLevel
      viewport.setZoom(clamp(zoomLevel, 0.05, 5), true)
    }
  }, [zoomLevel])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const app = new Application()
    let cancelled = false
    let initialized = false
    let resizeObserver: ResizeObserver | null = null

    const safeDestroy = () => {
      try {
        if (initialized) app.destroy({ removeView: true }, true)
      } catch {
        // ignore
      }
    }

    ;(async () => {
      try {
        if (!host.isConnected) return

        const initWidth = Math.max(1, host.clientWidth || 0)
        const initHeight = Math.max(1, host.clientHeight || 0)

        await app.init({
          width: initWidth,
          height: initHeight,
          backgroundAlpha: 0,
          antialias: true,
          resolution: Math.max(2, window.devicePixelRatio || 1),
          autoDensity: true,
        })
        initialized = true
        app.canvas.style.imageRendering = 'auto'

        if (cancelled || !host.isConnected) {
          safeDestroy()
          return
        }

        host.appendChild(app.canvas)
        app.canvas.style.width = '100%'
        app.canvas.style.height = '100%'
        app.canvas.style.display = 'block'

        const worldSize = sim.state.config.worldSize
        const viewport = new Viewport({
          screenWidth: initWidth,
          screenHeight: initHeight,
          worldWidth: worldSize,
          worldHeight: worldSize,
          events: app.renderer.events,
        })

        viewportRef.current = viewport

        viewport.drag().pinch().wheel().decelerate()
        viewport.setZoom(3.5, true)
        viewport.moveCenter(worldSize / 2, worldSize / 2)

        if (typeof ResizeObserver !== 'undefined') {
          resizeObserver = new ResizeObserver(() => {
            if (cancelled || !initialized) return
            const w = Math.max(1, host.clientWidth || 0)
            const h = Math.max(1, host.clientHeight || 0)
            try {
              app.renderer.resize(w, h)
              viewport.resize(w, h, viewport.worldWidth, viewport.worldHeight)
            } catch {
              // ignore
            }
          })
          resizeObserver.observe(host)
        }

        viewport.on('zoomed', () => {
          if (!onZoomChange) return
          externalZoomRef.current = viewport.scale.x
          onZoomChange(viewport.scale.x)
        })

        const grid = new Graphics()
        const step = 200
        for (let x = 0; x <= worldSize; x += step) grid.moveTo(x, 0).lineTo(x, worldSize)
        for (let y = 0; y <= worldSize; y += step) grid.moveTo(0, y).lineTo(worldSize, y)
        grid.stroke({ width: 1, color: 0xffffff, alpha: 0.04 })
        viewport.addChild(grid)

        const bins = new Graphics()
        binsRef.current = bins
        viewport.addChild(bins)

        const focusOverlay = new Graphics()
        focusOverlayRef.current = focusOverlay
        viewport.addChild(focusOverlay)

        app.stage.addChild(viewport)

        const dotG = new Graphics()
        dotG.circle(0, 0, 4.4).fill({ color: 0x9bc1ff, alpha: 1 })
        dotG.circle(0, 0, 5.6).stroke({ width: 1.4, color: 0x07101e, alpha: 0.9 })
        const dotTexture = app.renderer.generateTexture(dotG)
        dotTextureRef.current = dotTexture

        function selectNearest(worldX: number, worldY: number) {
          const sample = spritesRef.current
          if (sample.length === 0) return
          let bestId = sample[0].id
          let bestD2 = Infinity
          for (let i = 0; i < sample.length; i++) {
            const s = sample[i]
            const dx = s.sprite.x - worldX
            const dy = s.sprite.y - worldY
            const d2 = dx * dx + dy * dy
            if (d2 < bestD2) {
              bestD2 = d2
              bestId = s.id
            }
          }
          sim.dispatch({ type: 'set_selected_agent', agentId: bestId })
        }

        viewport.eventMode = 'static'
        viewport.on('pointertap', (ev: any) => {
          const p = viewport.toWorld(ev.global)
          selectNearest(p.x, p.y)
        })

        const agentIds = Object.keys(sim.state.agents).map(Number)
        for (const agentId of agentIds) {
          const s = new Sprite(dotTexture)
          s.anchor.set(0.5)
          s.roundPixels = true
          const p = posAtTick(agentId, sim.state.tick, sim.state.config.worldSize)
          s.x = p.x
          s.y = p.y
          s.alpha = 0.85
          viewport.addChild(s)
          spritesRef.current.push({ id: agentId, sprite: s })
        }

        let lastTick = -1
        app.ticker.add(() => {
          if (cancelled) return
          const tick = tickRef.current
          if (tick === lastTick) return
          lastTick = tick

          const mode = modeRef.current
          const worldSizeNow = worldSizeRef.current
          const selectedNow = selectedRef.current

          if (mode === 'micro') {
            bins.visible = false
            focusOverlay.visible = true
            focusOverlay.clear()

            const selectedEntry =
              selectedNow == null ? null : spritesRef.current.find((x) => x.id === selectedNow) ?? null
            const nearest: Array<{ x: number; y: number; d2: number }> = []

            for (const { id, sprite } of spritesRef.current) {
              const p = posAtTick(id, tick, worldSizeNow)
              sprite.x = p.x
              sprite.y = p.y

              const mood = getAgentMood(id, tick)
              const isSelected = id === selectedNow
              const meta = agentMetaRef.current[id]
              const baseScale = influenceSize(meta?.tier)

              sprite.tint = isSelected ? 0xffd700 : moodToColor(mood)
              sprite.alpha = isSelected ? 1 : clamp(stanceAlpha(meta?.stance) + 0.06, 0.74, 0.98)
              sprite.scale.set(isSelected ? baseScale * 1.65 : baseScale)

              if (selectedEntry && !isSelected) {
                const dx = sprite.x - selectedEntry.sprite.x
                const dy = sprite.y - selectedEntry.sprite.y
                const d2 = dx * dx + dy * dy
                if (nearest.length < 6) {
                  nearest.push({ x: sprite.x, y: sprite.y, d2 })
                } else {
                  let farthest = 0
                  for (let i = 1; i < nearest.length; i++) {
                    if (nearest[i].d2 > nearest[farthest].d2) farthest = i
                  }
                  if (d2 < nearest[farthest].d2) nearest[farthest] = { x: sprite.x, y: sprite.y, d2 }
                }
              }
            }

            if (selectedEntry) {
              const cx = selectedEntry.sprite.x
              const cy = selectedEntry.sprite.y
              const pulse = 9 + Math.sin(tick / 6) * 1.8

              for (const n of nearest) {
                const opacity = clamp(0.26 + (1 - Math.sqrt(n.d2) / 420) * 0.4, 0.16, 0.6)
                focusOverlay.moveTo(cx, cy).lineTo(n.x, n.y)
                focusOverlay.stroke({ width: 1, color: 0xffffff, alpha: opacity })
              }

              focusOverlay.circle(cx, cy, pulse).stroke({ width: 2, color: 0xffd700, alpha: 0.72 })
              focusOverlay.circle(cx, cy, pulse + 6).stroke({ width: 1, color: 0xffd700, alpha: 0.34 })
            }
          } else {
            bins.visible = true
            focusOverlay.visible = false
            focusOverlay.clear()
            bins.clear()

            const gridSize = 60
            const cell = worldSizeNow / gridSize
            const moodSums = new Array(gridSize * gridSize).fill(0)
            const counts = new Array(gridSize * gridSize).fill(0)

            for (const { id } of spritesRef.current) {
              const p = posAtTick(id, tick, worldSizeNow)
              const gx = clamp(Math.floor(p.x / cell), 0, gridSize - 1)
              const gy = clamp(Math.floor(p.y / cell), 0, gridSize - 1)
              const idx = gy * gridSize + gx
              moodSums[idx] += getAgentMood(id, tick)
              counts[idx] += 1
            }

            const max = Math.max(1, ...counts)
            for (let gy = 0; gy < gridSize; gy++) {
              for (let gx = 0; gx < gridSize; gx++) {
                const idx = gy * gridSize + gx
                const c = counts[idx]
                if (c === 0) continue
                const avgMood = moodSums[idx] / c
                const a = 0.02 + (c / max) * 0.18
                bins.rect(gx * cell, gy * cell, cell, cell).fill({ color: moodToColor(avgMood), alpha: a })
              }
            }
            bins.stroke({ width: 1, color: 0xffffff, alpha: 0.04 })
          }
        })
      } catch {
        if (initialized) safeDestroy()
      }
    })()

    return () => {
      cancelled = true
      viewportRef.current = null
      binsRef.current = null
      focusOverlayRef.current = null
      dotTextureRef.current = null
      spritesRef.current = []
      try {
        resizeObserver?.disconnect()
      } catch {
        // ignore
      }
      safeDestroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const dotTexture = dotTextureRef.current
    if (!dotTexture) return

    const agentIds = Object.keys(sim.state.agents).map(Number)
    const existing = spritesRef.current.length
    if (existing === agentIds.length) return

    for (const { sprite } of spritesRef.current) {
      viewport.removeChild(sprite)
      sprite.destroy()
    }
    spritesRef.current = []

    for (const agentId of agentIds) {
      const s = new Sprite(dotTexture)
      s.anchor.set(0.5)
      s.roundPixels = true
      const p = posAtTick(agentId, sim.state.tick, sim.state.config.worldSize)
      s.x = p.x
      s.y = p.y
      s.alpha = 0.85
      viewport.addChild(s)
      spritesRef.current.push({ id: agentId, sprite: s })
    }
  }, [sim.state.agents, sim.state.config.worldSize, sim.state.tick])

  useEffect(() => {
    const v = viewportRef.current
    if (!v) return
    v.worldWidth = sim.state.config.worldSize
    v.worldHeight = sim.state.config.worldSize
  }, [sim.state.config.worldSize])

  return <div ref={hostRef} style={{ height: '100%', width: '100%', minHeight: 0 }} />
}
