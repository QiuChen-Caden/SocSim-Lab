export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function hash01(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

export function id(prefix: string): string {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`
}

export function agentName(agentId: number): string {
  const first = ['Alex', 'Bo', 'Chen', 'Daria', 'Eli', 'Fatima', 'Gao', 'Hana', 'Iris', 'Jun', 'Kai', 'Lina']
  const last = ['Wang', 'Zhang', 'Liu', 'Chen', 'Yang', 'Zhao', 'Huang', 'Wu', 'Xu', 'Sun', 'Ma', 'Zhou']
  return `${first[agentId % first.length]} ${last[(agentId * 7) % last.length]}`
}

export function agentGroup(agentId: number): string {
  const groups = ['Group A', 'Group B', 'Group C', 'Group D', 'Group E']
  return groups[agentId % groups.length]
}

export function posAtTick(agentId: number, tick: number, worldSize: number): { x: number; y: number } {
  const baseX = hash01(agentId * 101 + 1) * worldSize
  const baseY = hash01(agentId * 101 + 2) * worldSize

  const w = 0.002 + hash01(agentId * 17 + 9) * 0.004
  const r = 40 + hash01(agentId * 19 + 3) * 160

  const x = baseX + Math.cos((tick + agentId) * w) * r
  const y = baseY + Math.sin((tick + agentId) * w) * r

  return { x: clamp(x, 0, worldSize), y: clamp(y, 0, worldSize) }
}
