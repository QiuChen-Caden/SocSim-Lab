import { Graphics, Text, TextStyle, Container } from 'pixi.js';
import { ZONES, TOWN_WORLD_W, TOWN_WORLD_H } from './townLayout';

export function drawGround(container: Container) {
  const g = new Graphics();
  // Grass background
  g.rect(0, 0, TOWN_WORLD_W, TOWN_WORLD_H).fill({ color: 0x4a7c59, alpha: 1 });
  // Paths (horizontal and vertical between zones)
  const pathColor = 0xc8b88a;
  const gap = 80;
  // Horizontal path
  g.rect(0, TOWN_WORLD_H / 2 - gap / 2, TOWN_WORLD_W, gap).fill({ color: pathColor, alpha: 0.6 });
  // Vertical paths
  const col1x = gap + Math.floor((TOWN_WORLD_W - gap * 4) / 3) + gap / 2;
  const col2x = col1x + Math.floor((TOWN_WORLD_W - gap * 4) / 3) + gap;
  g.rect(col1x - gap / 2, 0, gap, TOWN_WORLD_H).fill({ color: pathColor, alpha: 0.6 });
  g.rect(col2x - gap / 2, 0, gap, TOWN_WORLD_H).fill({ color: pathColor, alpha: 0.6 });
  container.addChild(g);
}

export function drawZones(container: Container) {
  for (const zone of ZONES) {
    const { x, y, w, h } = zone.bounds;
    const g = new Graphics();
    // Zone floor
    g.rect(x, y, w, h).fill({ color: zone.color, alpha: 0.35 });
    g.rect(x, y, w, h).stroke({ width: 2, color: zone.color, alpha: 0.7 });
    container.addChild(g);
  }
}

export function drawBuildings(container: Container) {
  for (const zone of ZONES) {
    const { x, y, w } = zone.bounds;
    const g = new Graphics();
    // Simple building: rectangle + triangle roof
    const bx = x + w - 90;
    const by = y + 20;
    const bw = 60;
    const bh = 45;
    // Wall
    g.rect(bx, by, bw, bh).fill({ color: 0xfaf0e6, alpha: 0.7 });
    // Roof triangle
    g.moveTo(bx - 5, by).lineTo(bx + bw / 2, by - 20).lineTo(bx + bw + 5, by).closePath();
    g.fill({ color: 0xbc6c25, alpha: 0.8 });
    // Door
    g.rect(bx + bw / 2 - 6, by + bh - 16, 12, 16).fill({ color: 0x6b4226, alpha: 0.8 });
    container.addChild(g);
  }
  // Park trees
  const parkZone = ZONES.find(z => z.id === 'park');
  if (parkZone) {
    const { x, y, w, h } = parkZone.bounds;
    const g = new Graphics();
    const treePositions = [
      [x + 50, y + h - 60],
      [x + 140, y + h - 90],
      [x + w - 80, y + h - 50],
    ];
    for (const [tx, ty] of treePositions) {
      // Trunk
      g.rect(tx - 3, ty, 6, 14).fill({ color: 0x6b4226, alpha: 0.8 });
      // Canopy
      g.circle(tx, ty - 4, 16).fill({ color: 0x2d6a4f, alpha: 0.75 });
    }
    container.addChild(g);
  }
}

export function drawZoneLabels(container: Container) {
  const style = new TextStyle({
    fontFamily: 'monospace',
    fontSize: 16,
    fill: 0xffffff,
    fontWeight: 'bold',
    dropShadow: { color: 0x000000, alpha: 0.5, blur: 2, distance: 1 },
  });
  for (const zone of ZONES) {
    const { x, y, w } = zone.bounds;
    const label = new Text({ text: `${zone.label} ${zone.labelCn}`, style });
    label.x = x + w / 2;
    label.y = y + 10;
    label.anchor.set(0.5, 0);
    container.addChild(label);
  }
}
