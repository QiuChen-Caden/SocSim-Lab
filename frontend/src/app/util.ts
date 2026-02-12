import { clamp, hash01 } from '../utils';

export { clamp, hash01 };

/**
 * Generates a mock agent name from an ID.
 * Combines first and last name arrays for variety.
 * @param agentId - The agent ID to generate a name for
 * @returns A formatted agent name
 */
export function agentName(agentId: number): string {
  const first = ['Alex', 'Bo', 'Chen', 'Daria', 'Eli', 'Fatima', 'Gao', 'Hana', 'Iris', 'Jun', 'Kai', 'Lina'];
  const last = ['Wang', 'Zhang', 'Liu', 'Chen', 'Yang', 'Zhao', 'Huang', 'Wu', 'Xu', 'Sun', 'Ma', 'Zhou'];
  return `${first[agentId % first.length]} ${last[(agentId * 7) % last.length]}`;
}

/**
 * Gets the group assignment for an agent ID.
 * @param agentId - The agent ID
 * @returns The group name (A-E)
 */
export function agentGroup(agentId: number): string {
  const groups = ['Group A', 'Group B', 'Group C', 'Group D', 'Group E'];
  return groups[agentId % groups.length];
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
  const centerX = worldSize / 2;
  const centerY = worldSize / 2;
  const spread = worldSize * 0.15;

  const baseX = centerX + (hash01(agentId * 101 + 1) - 0.5) * spread;
  const baseY = centerY + (hash01(agentId * 101 + 2) - 0.5) * spread;

  const w = 0.002 + hash01(agentId * 17 + 9) * 0.004;
  const r = 20 + hash01(agentId * 19 + 3) * 40;

  const x = baseX + Math.cos((tick + agentId) * w) * r;
  const y = baseY + Math.sin((tick + agentId) * w) * r;

  return { x: clamp(x, 0, worldSize), y: clamp(y, 0, worldSize) };
}
