import type { TownZone, TownZoneId } from '../../types';
import { hash01 } from '../../utils';

const GAP = 80;
const COLS = 3;
const ROWS = 2;
const WORLD_W = 2400;
const WORLD_H = 2000;
const ZONE_W = Math.floor((WORLD_W - GAP * (COLS + 1)) / COLS);
const ZONE_H = Math.floor((WORLD_H - GAP * (ROWS + 1)) / ROWS);

export const TOWN_WORLD_W = WORLD_W;
export const TOWN_WORLD_H = WORLD_H;

export const ZONES: TownZone[] = [
  { id: 'plaza',   label: 'Plaza',   labelCn: '广场',   bounds: { x: GAP,                   y: GAP,                   w: ZONE_W, h: ZONE_H }, color: 0xd4a373 },
  { id: 'cafe',    label: 'Cafe',    labelCn: '咖啡馆', bounds: { x: GAP * 2 + ZONE_W,      y: GAP,                   w: ZONE_W, h: ZONE_H }, color: 0xc9ada7 },
  { id: 'park',    label: 'Park',    labelCn: '公园',   bounds: { x: GAP * 3 + ZONE_W * 2,  y: GAP,                   w: ZONE_W, h: ZONE_H }, color: 0xa7c957 },
  { id: 'office',  label: 'Office',  labelCn: '办公室', bounds: { x: GAP,                   y: GAP * 2 + ZONE_H,     w: ZONE_W, h: ZONE_H }, color: 0x8ecae6 },
  { id: 'library', label: 'Library', labelCn: '图书馆', bounds: { x: GAP * 2 + ZONE_W,      y: GAP * 2 + ZONE_H,     w: ZONE_W, h: ZONE_H }, color: 0xe0aaff },
  { id: 'market',  label: 'Market',  labelCn: '市场',   bounds: { x: GAP * 3 + ZONE_W * 2,  y: GAP * 2 + ZONE_H,     w: ZONE_W, h: ZONE_H }, color: 0xffb703 },
];

const ZONE_MAP: Record<TownZoneId, TownZone> = {} as Record<TownZoneId, TownZone>;
for (const z of ZONES) ZONE_MAP[z.id] = z;
export { ZONE_MAP };

const GROUP_DEFAULT_ZONE: Record<string, TownZoneId> = {
  'Group A': 'plaza',
  'Group B': 'cafe',
  'Group C': 'park',
  'Group D': 'office',
  'Group E': 'library',
};

export function defaultZoneForAgent(agentId: number, group: string): TownZoneId {
  if (agentId === 31) return 'plaza';
  return GROUP_DEFAULT_ZONE[group] ?? 'plaza';
}

export function townPosAtTick(
  agentId: number,
  tick: number,
  zone: TownZone,
): { x: number; y: number } {
  const { x, y, w, h } = zone.bounds;
  const pad = 30;
  const cx = x + pad + (w - pad * 2) * hash01(agentId * 101 + 1);
  const cy = y + pad + (h - pad * 2) * hash01(agentId * 101 + 2);
  const speed = 0.002 + hash01(agentId * 17 + 9) * 0.003;
  const radius = 15 + hash01(agentId * 19 + 3) * 25;
  const px = cx + Math.cos((tick + agentId) * speed) * radius;
  const py = cy + Math.sin((tick + agentId) * speed) * radius;
  return {
    x: Math.max(x + pad, Math.min(x + w - pad, px)),
    y: Math.max(y + pad, Math.min(y + h - pad, py)),
  };
}

export function zoneAtPoint(wx: number, wy: number): TownZoneId | null {
  for (const z of ZONES) {
    const { x, y, w, h } = z.bounds;
    if (wx >= x && wx <= x + w && wy >= y && wy <= y + h) return z.id;
  }
  return null;
}

