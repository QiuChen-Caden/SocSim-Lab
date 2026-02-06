import { useEffect, useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import type { AgentGraph } from '../app/agentGraph'
import { clamp } from '../app/util'

type AgentGraphProps = {
  graph: AgentGraph
  focusId?: number | null
  nodeMetaById?: Record<number, { influenceTier?: string; mood?: number; stance?: number }>
  onSelectAgent?: (agentId: number) => void
  height?: number
  canvasScale?: number
  onCanvasScaleChange?: (scale: number) => void
}

const GROUP_PALETTE = ['#6aa7ff', '#41d39f', '#ffc24b', '#ff5b7a', '#b48cff', '#7fb2ff', '#58d1ff']

function colorForGroup(group: string) {
  let acc = 0
  for (let i = 0; i < group.length; i++) acc = (acc * 31 + group.charCodeAt(i)) >>> 0
  return GROUP_PALETTE[acc % GROUP_PALETTE.length]
}

function edgeStyleForKind(kind: string) {
  if (kind === 'follow') return { width: 1.7, opacity: 0.56, color: '#8bb4ff' }
  if (kind === 'group') return { width: 1.2, opacity: 0.4, color: '#6ed4aa' }
  return { width: 1.0, opacity: 0.28, color: '#b8c3dd' }
}

function influenceToWeight(tier?: string) {
  if (tier === 'elite') return 1.0
  if (tier === 'opinion_leader') return 0.72
  if (tier === 'ordinary_user') return 0.45
  return 0.55
}

function moodBorderColor(mood?: number) {
  if (mood == null) return 'rgba(255,255,255,0.45)'
  if (mood > 0.2) return '#4ade80'
  if (mood < -0.2) return '#f87171'
  return '#facc15'
}

export function AgentGraphCanvas({
  graph,
  focusId,
  nodeMetaById,
  onSelectAgent,
  height,
  canvasScale = 1.0,
  onCanvasScaleChange,
}: AgentGraphProps) {
  const [localScale, setLocalScale] = useState(canvasScale)
  const [showLabels, setShowLabels] = useState(false)
  const [sizeMetric, setSizeMetric] = useState<'degree' | 'influence'>('degree')

  useEffect(() => {
    setLocalScale(canvasScale)
  }, [canvasScale])

  const option = useMemo<EChartsOption>(() => {
    const degreeById = new Map<number, number>()
    for (const node of graph.nodes) degreeById.set(node.id, 0)
    for (const edge of graph.edges) {
      degreeById.set(edge.source, (degreeById.get(edge.source) ?? 0) + 1)
      degreeById.set(edge.target, (degreeById.get(edge.target) ?? 0) + 1)
    }

    const degreeValues = Array.from(degreeById.values()).sort((a, b) => b - a)
    const topDegreeThreshold = degreeValues[Math.max(0, Math.floor(degreeValues.length * 0.12) - 1)] ?? 0

    const categories = Array.from(new Set(graph.nodes.map((n) => n.group))).map((name) => ({
      name,
      itemStyle: { color: colorForGroup(name) },
    }))
    const categoryIndex = new Map(categories.map((c, i) => [c.name, i]))

    const nodes = graph.nodes.map((node) => {
      const isFocus = focusId != null && node.id === focusId
      const meta = nodeMetaById?.[node.id]
      const degree = degreeById.get(node.id) ?? 0
      const influenceWeight = influenceToWeight(meta?.influenceTier)
      const sizeFromDegree = clamp(11 + degree * 1.9, 11, 34)
      const sizeFromInfluence = clamp(12 + influenceWeight * 16, 12, 30)
      const symbolSize = isFocus ? 34 : sizeMetric === 'influence' ? sizeFromInfluence : sizeFromDegree
      const shouldShowLabel = isFocus || showLabels || degree >= Math.max(3, topDegreeThreshold)

      return {
        id: String(node.id),
        name: node.label,
        value: node.id,
        category: categoryIndex.get(node.group) ?? 0,
        degree,
        influenceTier: meta?.influenceTier ?? 'unknown',
        mood: meta?.mood,
        stance: meta?.stance,
        symbolSize,
        itemStyle: {
          color: colorForGroup(node.group),
          borderColor: isFocus ? '#ffd95e' : moodBorderColor(meta?.mood),
          borderWidth: isFocus ? 3 : 1,
        },
        label: {
          show: shouldShowLabel,
          color: '#ffffff',
          fontSize: 11,
          formatter: `{name|${node.label}}`,
          rich: {
            name: {
              backgroundColor: 'rgba(0,0,0,0.55)',
              padding: [3, 6],
              borderRadius: 5,
            },
          },
        },
      }
    })

    const links = graph.edges.map((edge) => {
      const style = edgeStyleForKind(edge.kind)
      return {
        source: String(edge.source),
        target: String(edge.target),
        value: edge.strength,
        lineStyle: {
          color: style.color,
          width: style.width + edge.strength,
          opacity: style.opacity,
          curveness: edge.kind === 'message' ? 0.08 : 0,
        },
      }
    })

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          if (params.dataType === 'edge') {
            return `link: ${params.data.source} -> ${params.data.target}`
          }
          const node = params.data
          const groupName = categories[node.category]?.name ?? 'unknown'
          const mood = typeof node.mood === 'number' ? node.mood.toFixed(2) : '-'
          const stance = typeof node.stance === 'number' ? node.stance.toFixed(2) : '-'
          return [
            `${node.name}`,
            `group: ${groupName}`,
            `id: ${node.value}`,
            `degree: ${node.degree ?? 0}`,
            `influence: ${node.influenceTier ?? 'unknown'}`,
            `mood: ${mood}`,
            `stance: ${stance}`,
          ].join('<br/>')
        },
      },
      animationDuration: 450,
      animationDurationUpdate: 250,
      legend: [
        {
          bottom: 38,
          left: 'center',
          textStyle: { color: 'rgba(220,230,255,0.72)', fontSize: 11 },
        },
      ],
      series: [
        {
          type: 'graph',
          layout: 'force',
          data: nodes,
          links,
          categories,
          roam: true,
          zoom: localScale,
          draggable: true,
          focusNodeAdjacency: true,
          force: {
            repulsion: 190,
            gravity: 0.12,
            edgeLength: [55, 120],
            friction: 0.18,
          },
          lineStyle: {
            opacity: 0.35,
          },
          label: {
            position: 'right',
            show: false,
          },
          emphasis: {
            focus: 'adjacency',
            label: {
              show: true,
              color: '#fff',
            },
            lineStyle: {
              width: 2.2,
              opacity: 0.85,
            },
          },
        },
      ],
    }
  }, [focusId, graph.edges, graph.nodes, localScale, nodeMetaById, showLabels, sizeMetric])

  return (
    <div className="agentGraph" style={height ? { height } : undefined}>
      <ReactECharts
        option={option}
        style={{ width: '100%', height: '100%' }}
        opts={{ renderer: 'canvas' }}
        notMerge
        onEvents={{
          click: (params: any) => {
            if (params?.dataType !== 'node' || !onSelectAgent) return
            const rawId = params.data?.id ?? params.data?.value
            const agentId = Number(rawId)
            if (Number.isFinite(agentId)) onSelectAgent(agentId)
          },
          graphRoam: (params: any) => {
            if (typeof params?.zoom !== 'number') return
            const nextScale = clamp(params.zoom, 0.5, 2.0)
            setLocalScale(nextScale)
            if (onCanvasScaleChange) onCanvasScaleChange(nextScale)
          },
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: 8,
          left: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px',
          background: 'rgba(11, 16, 32, 0.82)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '10px',
          fontSize: 11,
          zIndex: 2,
        }}
      >
        <span className="muted">size</span>
        <select
          className="select"
          value={sizeMetric}
          onChange={(e) => setSizeMetric(e.target.value === 'influence' ? 'influence' : 'degree')}
          style={{ width: 120, fontSize: 11, padding: '2px 6px' }}
        >
          <option value="degree">degree</option>
          <option value="influence">influence</option>
        </select>
        <label className="muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
          <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} />
          labels
        </label>
      </div>

      <div
        style={{
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
          zIndex: 2,
        }}
      >
        <span className="muted" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>edge</span>
        <span className="pill" style={{ fontSize: 10 }}>follow</span>
        <span className="pill" style={{ fontSize: 10 }}>group</span>
        <span className="pill" style={{ fontSize: 10 }}>message</span>
        <span className="muted" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>Zoom</span>
        <input
          type="range"
          min={0.5}
          max={2.0}
          step={0.05}
          value={localScale}
          onChange={(e) => {
            const nextScale = Number(e.target.value)
            setLocalScale(nextScale)
            if (onCanvasScaleChange) onCanvasScaleChange(nextScale)
          }}
          style={{ flex: 1, minWidth: 60 }}
        />
        <span className="pill" style={{ fontSize: 11 }}>{localScale.toFixed(2)}x</span>
      </div>
    </div>
  )
}
