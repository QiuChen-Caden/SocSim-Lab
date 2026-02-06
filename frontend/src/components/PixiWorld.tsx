import { Application, Graphics, Sprite, Texture } from 'pixi.js'
import { Viewport } from 'pixi-viewport'
import { useEffect, useRef } from 'react'
import { useSim } from '../app/SimulationProvider'
import { clamp, posAtTick, hash01 } from '../app/util'

// 将 mood 值 (-1 到 1) 映射到颜色
// -1 = 红色 (消极), 0 = 黄色 (中性), 1 = 绿色 (积极)
function moodToColor(mood: number): number {
  const clamped = clamp(mood, -1, 1)

  // 颜色定义 - 更鲜艳、对比度更高的颜色
  const negativeColor = { r: 255, g: 68, b: 68 }   // #ff4444 鲜红
  const neutralColor = { r: 255, g: 204, b: 0 }      // #ffcc00 亮黄
  const positiveColor = { r: 68, g: 255, b: 68 }    // #44ff44 鲜绿

  let r: number, g: number, b: number

  if (clamped < 0) {
    // 负值：从红色到黄色
    const t = (clamped + 1) / 1  // 0 到 1
    r = Math.round(negativeColor.r + (neutralColor.r - negativeColor.r) * t)
    g = Math.round(negativeColor.g + (neutralColor.g - negativeColor.g) * t)
    b = Math.round(negativeColor.b + (neutralColor.b - negativeColor.b) * t)
  } else {
    // 正值：从黄色到绿色
    const t = clamped / 1  // 0 到 1
    r = Math.round(neutralColor.r + (positiveColor.r - neutralColor.r) * t)
    g = Math.round(neutralColor.g + (positiveColor.g - neutralColor.g) * t)
    b = Math.round(neutralColor.b + (positiveColor.b - neutralColor.b) * t)
  }

  return (r << 16) | (g << 8) | b
}

// 计算智能体的 mood 值 - 让分布更丰富多样
function getAgentMood(agentId: number, tick: number): number {
  const seed = 20260121

  // 基础情绪：使用不同的种子获得更大差异
  const baseMood = clamp(hash01(seed + agentId * 13) * 2 - 1, -1, 1)

  // 多重变化因素，让情绪更动态
  // 1. 周期性变化（每个智能体不同频率）
  const cycle1 = Math.sin((tick + agentId * 17) / 30) * 0.4
  const cycle2 = Math.cos((tick + agentId * 23) / 50) * 0.3

  // 2. 随机波动（基于 tick 和 agentId 的伪随机）
  const randomFluctuation = (hash01(tick * 7 + agentId * 11) * 2 - 1) * 0.2

  // 3. 群体效应：相近 ID 的智能体情绪趋同
  const groupEffect = Math.sin((tick + Math.floor(agentId / 100) * 19) / 40) * 0.25

  // 组合所有因素
  const mood = baseMood * 0.3 + cycle1 + cycle2 + randomFluctuation + groupEffect

  return clamp(mood, -1, 1)
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
  const dotTextureRef = useRef<Texture | null>(null)
  const tickRef = useRef(0)
  const selectedRef = useRef<number | null>(null)
  const modeRef = useRef(sim.state.config.viewportMode)
  const worldSizeRef = useRef(sim.state.config.worldSize)

  useEffect(() => {
    tickRef.current = sim.state.tick
    selectedRef.current = sim.state.selectedAgentId
    modeRef.current = sim.state.config.viewportMode
    worldSizeRef.current = sim.state.config.worldSize
  }, [sim.state.config.viewportMode, sim.state.config.worldSize, sim.state.selectedAgentId, sim.state.tick])

  // 响应外部 zoomLevel 变化
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
        // 只在 init 之后 destroy，避免 Pixi 内部未构造完全导致的 destroy 崩溃
        if (initialized) {
          app.destroy({ removeView: true }, true)
        }
      } catch {
        // ignore
      }
    }

    ;(async () => {
      try {
        // host 已经不在 DOM（StrictMode / 切页时）则放弃初始化
        if (!host.isConnected) return

        // 避免 resizeTo 在 StrictMode/初始化阶段的竞态：用显式宽高初始化 + ResizeObserver 手动 resize
        const initWidth = Math.max(1, host.clientWidth || 0)
        const initHeight = Math.max(1, host.clientHeight || 0)

        await app.init({
          width: initWidth,
          height: initHeight,
          backgroundAlpha: 0,
          antialias: false,
        })
        initialized = true

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
        viewport.setZoom(0.35, true)
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
              // ignore resize errors during teardown
            }
          })
          resizeObserver.observe(host)
        }

        // 监听缩放变化，通知父组件
        viewport.on('zoomed', () => {
          if (onZoomChange) {
            externalZoomRef.current = viewport.scale.x
            onZoomChange(viewport.scale.x)
          }
        })

        // 背景格网（便于观察缩放）
        const grid = new Graphics()
        const step = 200
        for (let x = 0; x <= worldSize; x += step) grid.moveTo(x, 0).lineTo(x, worldSize)
        for (let y = 0; y <= worldSize; y += step) grid.moveTo(0, y).lineTo(worldSize, y)
        grid.stroke({ width: 1, color: 0xffffff, alpha: 0.04 })
        viewport.addChild(grid)

        // bins overlay（macro 模式）
        const bins = new Graphics()
        binsRef.current = bins
        viewport.addChild(bins)

        app.stage.addChild(viewport)

        // dot texture (生成一次，复用 sprite)
        const dotG = new Graphics()
        dotG.circle(0, 0, 3.2).fill({ color: 0x7fb2ff, alpha: 0.95 })
        dotG.circle(0, 0, 4.6).stroke({ width: 1, color: 0x0b1020, alpha: 0.55 })
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

        // 初始 sprites
        const n = sim.state.config.sampleAgents
        for (let i = 0; i < n; i++) {
          const agentId = i
          const s = new Sprite(dotTexture)
          s.anchor.set(0.5)
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
            for (const { id, sprite } of spritesRef.current) {
              const p = posAtTick(id, tick, worldSizeNow)
              sprite.x = p.x
              sprite.y = p.y

              // 根据情绪值设置颜色
              const mood = getAgentMood(id, tick)
              const isSelected = id === selectedNow

              // 选中的智能体用金色高亮，否则用情绪颜色
              sprite.tint = isSelected ? 0xffd700 : moodToColor(mood)
              sprite.scale.set(isSelected ? 1.6 : 1)
            }
          } else {
            bins.visible = true
            bins.clear()
            const gridSize = 60
            const cell = worldSizeNow / gridSize

            // 计算每个格子的平均情绪
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

                // 使用平均情绪值作为颜色
                const avgMood = moodSums[idx] / c
                const a = 0.02 + (c / max) * 0.18
                bins.rect(gx * cell, gy * cell, cell, cell).fill({ color: moodToColor(avgMood), alpha: a })
              }
            }
            bins.stroke({ width: 1, color: 0xffffff, alpha: 0.04 })
          }
        })
      } catch {
        // init failed or was cancelled
        if (initialized) safeDestroy()
      }
    })()

    return () => {
      cancelled = true
      viewportRef.current = null
      binsRef.current = null
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

  // 响应 sampleAgents 变化：重建采样 sprite
  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const dotTexture = dotTextureRef.current
    if (!dotTexture) return
    const existing = spritesRef.current.length
    if (existing === sim.state.config.sampleAgents) return

    for (const { sprite } of spritesRef.current) {
      viewport.removeChild(sprite)
      sprite.destroy()
    }
    spritesRef.current = []

    const n = sim.state.config.sampleAgents
    for (let i = 0; i < n; i++) {
      const agentId = i
      const s = new Sprite(dotTexture)
      s.anchor.set(0.5)
      const p = posAtTick(agentId, sim.state.tick, sim.state.config.worldSize)
      s.x = p.x
      s.y = p.y
      s.alpha = 0.85
      viewport.addChild(s)
      spritesRef.current.push({ id: agentId, sprite: s })
    }
  }, [sim.state.config.sampleAgents, sim.state.config.worldSize, sim.state.tick])

  // worldSize 改变：调整 viewport world bounds
  useEffect(() => {
    const v = viewportRef.current
    if (!v) return
    v.worldWidth = sim.state.config.worldSize
    v.worldHeight = sim.state.config.worldSize
  }, [sim.state.config.worldSize])

  return <div ref={hostRef} style={{ height: '100%', width: '100%', minHeight: 0 }} />
}
