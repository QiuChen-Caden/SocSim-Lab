import { agentGroup, agentName, hash01 } from './util'

export type AgentGraphNode = {
  id: number
  label: string
  group: string
}

export type AgentGraphEdge = {
  source: number
  target: number
  strength: number
  kind: 'group' | 'message' | 'follow'
}

export type AgentGraph = {
  nodes: AgentGraphNode[]
  edges: AgentGraphEdge[]
}

export type RelationEdgeInput = {
  source: number
  target: number
  strength?: number
  kind?: 'group' | 'message' | 'follow'
}

function uniqEdgeKey(a: number, b: number) {
  const x = a < b ? a : b
  const y = a < b ? b : a
  return `${x}-${y}`
}

function pickIdsDeterministic(opts: { seed: number; base: number; count: number; maxExclusive: number; exclude?: Set<number> }) {
  const ids: number[] = []
  const exclude = opts.exclude ?? new Set<number>()
  if (opts.maxExclusive <= 0) return ids

  for (let i = 0; i < opts.count * 8 && ids.length < opts.count; i++) {
    const id = Math.floor(hash01(opts.seed + opts.base * 1009 + i * 31) * opts.maxExclusive)
    if (exclude.has(id)) continue
    exclude.add(id)
    ids.push(id)
  }
  return ids
}

function nodeOf(agentId: number): AgentGraphNode {
  return { id: agentId, label: agentName(agentId), group: agentGroup(agentId) }
}

function normalizeRelationEdges(
  relationEdges: RelationEdgeInput[] | undefined,
  validIds?: Set<number>,
): AgentGraphEdge[] {
  if (!relationEdges || relationEdges.length === 0) return []
  const bestByKey = new Map<string, AgentGraphEdge>()

  for (const raw of relationEdges) {
    const source = Math.floor(raw.source)
    const target = Math.floor(raw.target)
    if (!Number.isFinite(source) || !Number.isFinite(target) || source === target) continue
    if (validIds && (!validIds.has(source) || !validIds.has(target))) continue
    const key = uniqEdgeKey(source, target)
    const edge: AgentGraphEdge = {
      source: source < target ? source : target,
      target: source < target ? target : source,
      strength: clampStrength(raw.strength ?? 0.6),
      kind: raw.kind ?? 'follow',
    }
    const existing = bestByKey.get(key)
    if (!existing || edge.strength > existing.strength) bestByKey.set(key, edge)
  }

  return Array.from(bestByKey.values())
}

function clampStrength(v: number): number {
  return Math.max(0.1, Math.min(1, v))
}

function filterConnected(nodes: AgentGraphNode[], edges: AgentGraphEdge[], forceKeepId?: number): AgentGraphNode[] {
  const connected = new Set<number>()
  for (const e of edges) {
    connected.add(e.source)
    connected.add(e.target)
  }
  return nodes.filter((n) => connected.has(n.id) || n.id === forceKeepId)
}

export function buildEgoAgentGraph(opts: {
  seed: number
  focusId: number
  sampleAgents: number
  maxNodes: number
  relationEdges?: RelationEdgeInput[]
  validAgentIds?: number[]
}): AgentGraph {
  const maxExclusive = Math.max(0, Math.floor(opts.sampleAgents))
  const maxNodes = Math.max(2, Math.floor(opts.maxNodes))
  const focusId = Math.max(0, Math.floor(opts.focusId))
  const validIdSet = opts.validAgentIds?.length ? new Set(opts.validAgentIds) : undefined

  const realEdges = normalizeRelationEdges(opts.relationEdges, validIdSet)
  if (realEdges.length > 0) {
    const adjacency = new Map<number, Array<{ id: number; strength: number }>>()
    for (const e of realEdges) {
      if (!adjacency.has(e.source)) adjacency.set(e.source, [])
      if (!adjacency.has(e.target)) adjacency.set(e.target, [])
      adjacency.get(e.source)!.push({ id: e.target, strength: e.strength })
      adjacency.get(e.target)!.push({ id: e.source, strength: e.strength })
    }
    for (const arr of adjacency.values()) arr.sort((a, b) => b.strength - a.strength)

    const picked = new Set<number>([focusId])
    const queue: number[] = [focusId]
    while (queue.length > 0 && picked.size < maxNodes) {
      const cur = queue.shift()!
      const neighbors = adjacency.get(cur) ?? []
      for (const n of neighbors) {
        if (picked.size >= maxNodes) break
        if (picked.has(n.id)) continue
        picked.add(n.id)
        queue.push(n.id)
      }
    }

    if (picked.size < maxNodes) {
      const byDegree = Array.from(adjacency.entries())
        .sort((a, b) => b[1].length - a[1].length)
        .map(([id]) => id)
      for (const id of byDegree) {
        if (picked.size >= maxNodes) break
        picked.add(id)
      }
    }

    const nodes = Array.from(picked).map(nodeOf)
    const nodeSet = new Set(nodes.map((n) => n.id))
    const edges = realEdges.filter((e) => nodeSet.has(e.source) && nodeSet.has(e.target))
    if (edges.length > 0) {
      return { nodes: filterConnected(nodes, edges, focusId), edges }
    }
  }

  const picked = new Set<number>([focusId])
  const nodes: AgentGraphNode[] = [nodeOf(focusId)]

  const directCount = Math.min(35, maxNodes - 1)
  const direct = pickIdsDeterministic({ seed: opts.seed, base: focusId, count: directCount, maxExclusive, exclude: picked })
  for (const id of direct) nodes.push(nodeOf(id))

  // 第二跳：添加一些邻居的邻居，使子图不那么星形 second hop: sprinkle a few neighbors-of-neighbors to make the subgraph less star-like
  const remaining = maxNodes - nodes.length
  if (remaining > 0) {
    const secondHopSeeds = direct.slice(0, Math.min(direct.length, 15))
    for (const base of secondHopSeeds) {
      if (nodes.length >= maxNodes) break
      const extra = pickIdsDeterministic({
        seed: opts.seed + 17,
        base,
        count: 2,
        maxExclusive,
        exclude: picked,
      })
      for (const id of extra) {
        if (nodes.length >= maxNodes) break
        nodes.push(nodeOf(id))
      }
    }
  }

  const nodeIdSet = new Set(nodes.map((n) => n.id))
  const edges: AgentGraphEdge[] = []
  const edgeSeen = new Set<string>()

  // 焦点 -> 直接邻居 focus -> direct neighbors
  for (let i = 1; i < Math.min(nodes.length, direct.length + 1); i++) {
    const a = focusId
    const b = nodes[i].id
    const key = uniqEdgeKey(a, b)
    edgeSeen.add(key)
    edges.push({ source: a, target: b, strength: 0.9, kind: 'follow' })
  }

  // 在采样集合内添加一些组内边 add a few intra-group edges inside the sampled set
  const ids = nodes.map((n) => n.id)
  for (const a of ids) {
    const groupA = agentGroup(a)
    const sameGroup = ids.filter((b) => b !== a && agentGroup(b) === groupA)
    const cross = ids.filter((b) => b !== a && agentGroup(b) !== groupA)

    const picksSame = pickIdsDeterministic({
      seed: opts.seed + 29,
      base: a,
      count: Math.min(3, sameGroup.length),
      maxExclusive: sameGroup.length,
    }).map((i) => sameGroup[i])

    const picksCross = pickIdsDeterministic({
      seed: opts.seed + 41,
      base: a,
      count: Math.min(1, cross.length),
      maxExclusive: cross.length,
    }).map((i) => cross[i])

    for (const b of [...picksSame, ...picksCross]) {
      if (!nodeIdSet.has(b)) continue
      const key = uniqEdgeKey(a, b)
      if (edgeSeen.has(key)) continue
      edgeSeen.add(key)
      edges.push({
        source: a,
        target: b,
        strength: agentGroup(a) === agentGroup(b) ? 0.55 : 0.35,
        kind: agentGroup(a) === agentGroup(b) ? 'group' : 'message',
      })
    }
  }

  return { nodes: filterConnected(nodes, edges, focusId), edges }
}

export function buildSampleAgentGraph(opts: {
  seed: number
  sampleAgents: number
  maxNodes: number
  ensureId?: number | null
  relationEdges?: RelationEdgeInput[]
  validAgentIds?: number[]
}): AgentGraph {
  const maxExclusive = Math.max(0, Math.floor(opts.sampleAgents))
  const maxNodes = Math.max(2, Math.floor(opts.maxNodes))
  const validIdSet = opts.validAgentIds?.length ? new Set(opts.validAgentIds) : undefined

  const realEdges = normalizeRelationEdges(opts.relationEdges, validIdSet)
  const ensureId = opts.ensureId == null ? null : Math.max(0, Math.floor(opts.ensureId))
  if (realEdges.length > 0) {
    const degree = new Map<number, number>()
    for (const e of realEdges) {
      degree.set(e.source, (degree.get(e.source) ?? 0) + 1)
      degree.set(e.target, (degree.get(e.target) ?? 0) + 1)
    }
    const ranked = Array.from(degree.entries()).sort((a, b) => b[1] - a[1]).map(([id]) => id)
    const picked: number[] = []
    const pickedSet = new Set<number>()

    if (ensureId != null) {
      picked.push(ensureId)
      pickedSet.add(ensureId)
    }
    for (const id of ranked) {
      if (picked.length >= maxNodes) break
      if (pickedSet.has(id)) continue
      picked.push(id)
      pickedSet.add(id)
    }

    if (picked.length < maxNodes) {
      const fillSource = opts.validAgentIds ?? Array.from({ length: maxExclusive }, (_, i) => i)
      for (const id of fillSource) {
        if (picked.length >= maxNodes) break
        if (pickedSet.has(id)) continue
        picked.push(id)
        pickedSet.add(id)
      }
    }

    const nodes = picked.map(nodeOf)
    const nodeSet = new Set(nodes.map((n) => n.id))
    const edges = realEdges.filter((e) => nodeSet.has(e.source) && nodeSet.has(e.target))
    if (edges.length > 0) {
      return { nodes: filterConnected(nodes, edges, ensureId ?? undefined), edges }
    }
  }

  const nodes: AgentGraphNode[] = []
  const n = Math.min(maxNodes, maxExclusive || maxNodes)

  for (let i = 0; i < n; i++) nodes.push(nodeOf(i))

  // 确保选中的智能体在采样图中可见（swap in） ensure selected agent is visible in the sample graph (swap in)
  if (ensureId != null && ensureId < maxExclusive && !nodes.some((x) => x.id === ensureId)) {
    nodes[nodes.length - 1] = nodeOf(ensureId)
  }

  const ids = nodes.map((x) => x.id)
  const edges: AgentGraphEdge[] = []
  const edgeSeen = new Set<string>()

  for (const a of ids) {
    const groupA = agentGroup(a)
    const same = ids.filter((b) => b !== a && agentGroup(b) === groupA)
    const cross = ids.filter((b) => b !== a && agentGroup(b) !== groupA)

    const picksSame = pickIdsDeterministic({
      seed: opts.seed + 101,
      base: a,
      count: Math.min(3, same.length),
      maxExclusive: same.length,
    }).map((i) => same[i])

    const picksCross = pickIdsDeterministic({
      seed: opts.seed + 131,
      base: a,
      count: Math.min(1, cross.length),
      maxExclusive: cross.length,
    }).map((i) => cross[i])

    for (const b of [...picksSame, ...picksCross]) {
      const key = uniqEdgeKey(a, b)
      if (edgeSeen.has(key)) continue
      edgeSeen.add(key)
      edges.push({
        source: a,
        target: b,
        strength: agentGroup(a) === agentGroup(b) ? 0.45 : 0.25,
        kind: agentGroup(a) === agentGroup(b) ? 'group' : 'message',
      })
    }
  }

  return { nodes: filterConnected(nodes, edges, ensureId ?? undefined), edges }
}
