/**
 * Clamps a value between min and max (inclusive).
 * @param value - The value to clamp
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @returns The clamped value
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * Generates a deterministic hash value in [0, 1] range from a number.
 * Uses sine function for pseudo-random distribution.
 * @param n - Input number to hash
 * @returns A value between 0 and 1
 */
export function hash01(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

/**
 * Generates a unique identifier with a prefix.
 * Combines random hex string with timestamp for uniqueness.
 * @param prefix - Prefix for the ID (e.g., 'evt', 'log')
 * @returns A unique string identifier
 */
export function id(prefix: string): string {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`
}

/**
 * Generates a mock agent name from an ID.
 * Combines first and last name arrays for variety.
 * @param agentId - The agent ID to generate a name for
 * @returns A formatted agent name
 */
export function agentName(agentId: number): string {
  const first = ['Alex', 'Bo', 'Chen', 'Daria', 'Eli', 'Fatima', 'Gao', 'Hana', 'Iris', 'Jun', 'Kai', 'Lina']
  const last = ['Wang', 'Zhang', 'Liu', 'Chen', 'Yang', 'Zhao', 'Huang', 'Wu', 'Xu', 'Sun', 'Ma', 'Zhou']
  return `${first[agentId % first.length]} ${last[(agentId * 7) % last.length]}`
}

/**
 * Gets the group assignment for an agent ID.
 * @param agentId - The agent ID
 * @returns The group name (A-E)
 */
export function agentGroup(agentId: number): string {
  const groups = ['Group A', 'Group B', 'Group C', 'Group D', 'Group E']
  return groups[agentId % groups.length]
}

/**
 * Calculates agent position at a given tick in the world.
 * Agents move in circular patterns based on their ID and tick.
 * @param agentId - The agent ID
 * @param tick - Current simulation tick
 * @param worldSize - Size of the world (width/height)
 * @returns {x, y} position clamped to world bounds
 */
export function posAtTick(agentId: number, tick: number, worldSize: number): { x: number; y: number } {
  // 让30个agent紧凑分布在世界中心区域
  const centerX = worldSize / 2
  const centerY = worldSize / 2
  const spread = worldSize * 0.15  // 分布范围缩小到15%

  const baseX = centerX + (hash01(agentId * 101 + 1) - 0.5) * spread
  const baseY = centerY + (hash01(agentId * 101 + 2) - 0.5) * spread

  const w = 0.002 + hash01(agentId * 17 + 9) * 0.004
  const r = 20 + hash01(agentId * 19 + 3) * 40  // 运动半径也缩小

  const x = baseX + Math.cos((tick + agentId) * w) * r
  const y = baseY + Math.sin((tick + agentId) * w) * r

  return { x: clamp(x, 0, worldSize), y: clamp(y, 0, worldSize) }
}
