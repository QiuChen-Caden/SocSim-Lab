import { Application, Container, Graphics, Sprite, Text, TextStyle, FederatedPointerEvent } from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import { useEffect, useRef } from 'react';
import { useSim } from '../../app/SimulationProvider';
import { clamp } from '../../utils';
import { ZONE_MAP, TOWN_WORLD_W, TOWN_WORLD_H, townPosAtTick, zoneAtPoint } from './townLayout';
import { drawGround, drawZones, drawBuildings, drawZoneLabels } from './townRenderer';
import type { TownZoneId, ChatBubble } from '../../types';

function moodToColor(mood: number): number {
  const c = clamp(mood, -1, 1);
  if (c < 0) {
    // mood -1 → red (255,68,68), mood 0 → yellow (255,204,0)
    const t = c + 1; // 0..1
    return ((255) << 16) | ((Math.round(68 + (204 - 68) * t)) << 8) | Math.round(68 + (0 - 68) * t);
  }
  // mood 0 → yellow (255,204,0), mood 1 → green (68,255,68)
  const t = c;
  return ((Math.round(255 + (68 - 255) * t)) << 16) | ((Math.round(204 + (255 - 204) * t)) << 8) | Math.round(0 + (68 - 0) * t);
}

interface PixiTownProps {
  onSelectAgent: (agentId: number, screenX: number, screenY: number) => void;
  onAgentDrop: (agentId: number, zoneId: TownZoneId) => void;
}

export function PixiTown({ onSelectAgent, onAgentDrop }: PixiTownProps) {
  const sim = useSim();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const tickRef = useRef(0);
  const agentZonesRef = useRef<Record<number, TownZoneId>>({});
  const bubblesRef = useRef<ChatBubble[]>([]);
  const causeChainRef = useRef(sim.state.playground.causeChain);
  const agentsRef = useRef(sim.state.agents);
  const selectedAgentIdRef = useRef(sim.state.selectedAgentId);
  const onSelectAgentRef = useRef(onSelectAgent);
  const onAgentDropRef = useRef(onAgentDrop);

  useEffect(() => {
    tickRef.current = sim.state.tick;
    agentZonesRef.current = sim.state.playground.agentZones;
    bubblesRef.current = sim.state.playground.chatBubbles;
    causeChainRef.current = sim.state.playground.causeChain;
    agentsRef.current = sim.state.agents;
    selectedAgentIdRef.current = sim.state.selectedAgentId;
  }, [sim.state.tick, sim.state.playground, sim.state.agents, sim.state.selectedAgentId]);

  useEffect(() => {
    onSelectAgentRef.current = onSelectAgent;
    onAgentDropRef.current = onAgentDrop;
  }, [onSelectAgent, onAgentDrop]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const app = new Application();
    let cancelled = false;
    let initialized = false;
    let resizeObserver: ResizeObserver | null = null;

    const safeDestroy = () => {
      try { if (initialized) app.destroy({ removeView: true }, true); } catch { /* ignore */ }
    };

    (async () => {
      try {
        if (!host.isConnected) return;
        const initW = Math.max(1, host.clientWidth || 0);
        const initH = Math.max(1, host.clientHeight || 0);

        await app.init({
          width: initW, height: initH,
          backgroundAlpha: 0, antialias: true,
          resolution: Math.max(2, window.devicePixelRatio || 1),
          autoDensity: true,
        });
        initialized = true;
        if (cancelled || !host.isConnected) { safeDestroy(); return; }

        host.appendChild(app.canvas);
        app.canvas.style.width = '100%';
        app.canvas.style.height = '100%';
        app.canvas.style.display = 'block';

        const viewport = new Viewport({
          screenWidth: initW, screenHeight: initH,
          worldWidth: TOWN_WORLD_W, worldHeight: TOWN_WORLD_H,
          events: app.renderer.events,
        });
        viewport.drag().pinch().wheel().decelerate().clampZoom({ minScale: 0.3, maxScale: 4 });
        viewport.setZoom(0.7, true);
        viewport.moveCenter(TOWN_WORLD_W / 2, TOWN_WORLD_H / 2);
        app.stage.addChild(viewport);

        if (typeof ResizeObserver !== 'undefined') {
          resizeObserver = new ResizeObserver(() => {
            if (cancelled || !initialized) return;
            const w = Math.max(1, host.clientWidth || 0);
            const h = Math.max(1, host.clientHeight || 0);
            try { app.renderer.resize(w, h); viewport.resize(w, h, TOWN_WORLD_W, TOWN_WORLD_H); } catch { /* */ }
          });
          resizeObserver.observe(host);
        }

        // Static layers
        const groundLayer = new Container();
        const zoneLayer = new Container();
        const buildingLayer = new Container();
        const labelLayer = new Container();
        drawGround(groundLayer);
        drawZones(zoneLayer);
        drawBuildings(buildingLayer);
        drawZoneLabels(labelLayer);
        viewport.addChild(groundLayer, zoneLayer, buildingLayer, labelLayer);

        // Dynamic layers
        const agentLayer = new Container();
        const bubbleLayer = new Container();
        const causeLayer = new Graphics();
        const highlightLayer = new Graphics();
        const dropHighlight = new Graphics();
        viewport.addChild(agentLayer, bubbleLayer, causeLayer, highlightLayer, dropHighlight);

        // Generate agent textures
        const agentG = new Graphics();
        agentG.rect(-4, -6, 8, 12).fill({ color: 0xffffff });
        agentG.circle(0, -10, 4).fill({ color: 0xffdab9 });
        agentG.ellipse(0, 7, 5, 2).fill({ color: 0x000000, alpha: 0.3 });
        const agentTexture = app.renderer.generateTexture(agentG);

        const userG = new Graphics();
        userG.rect(-5, -7, 10, 14).fill({ color: 0xffffff });
        userG.circle(0, -11, 5).fill({ color: 0xffdab9 });
        userG.rect(-6, -8, 12, 16).stroke({ width: 2, color: 0xffd700 });
        userG.ellipse(0, 8, 6, 2).fill({ color: 0x000000, alpha: 0.3 });
        const userTexture = app.renderer.generateTexture(userG);

        // Create sprites
        const sprites: Array<{ id: number; sprite: Sprite }> = [];
        const agentIds = Object.keys(sim.state.agents).map(Number);

        for (const agentId of agentIds) {
          const isUser = agentId === 31;
          const s = new Sprite(isUser ? userTexture : agentTexture);
          s.anchor.set(0.5);
          s.scale.set(isUser ? 1.3 : 1);
          s.eventMode = 'static';
          s.cursor = 'pointer';
          agentLayer.addChild(s);
          sprites.push({ id: agentId, sprite: s });

          // Drag support
          let dragging = false;

          s.on('pointerdown', () => {
            dragging = true;
            s.alpha = 0.6;
            s.zIndex = 1000;
            viewport.plugins.pause('drag');
          });

          s.on('globalpointermove', (e: FederatedPointerEvent) => {
            if (!dragging) return;
            const worldPos = viewport.toWorld(e.global);
            s.x = worldPos.x;
            s.y = worldPos.y;
            // Highlight drop zone
            dropHighlight.clear();
            const hz = zoneAtPoint(worldPos.x, worldPos.y);
            if (hz) {
              const zb = ZONE_MAP[hz].bounds;
              dropHighlight.rect(zb.x, zb.y, zb.w, zb.h).fill({ color: 0xffd700, alpha: 0.15 });
              dropHighlight.rect(zb.x, zb.y, zb.w, zb.h).stroke({ width: 3, color: 0xffd700, alpha: 0.6 });
            }
          });

          s.on('pointerup', (e: FederatedPointerEvent) => {
            if (!dragging) return;
            dragging = false;
            s.alpha = 1;
            s.zIndex = 0;
            dropHighlight.clear();
            viewport.plugins.resume('drag');
            const worldPos = viewport.toWorld(e.global);
            const targetZone = zoneAtPoint(worldPos.x, worldPos.y);
            if (targetZone) onAgentDropRef.current(agentId, targetZone);
          });

          s.on('pointerupoutside', () => {
            if (!dragging) return;
            dragging = false;
            s.alpha = 1;
            s.zIndex = 0;
            dropHighlight.clear();
            viewport.plugins.resume('drag');
          });
        }

        // Click to select
        viewport.eventMode = 'static';
        viewport.on('pointertap', (ev: FederatedPointerEvent) => {
          const p = viewport.toWorld(ev.global);
          let bestId = -1;
          let bestD2 = Infinity;
          for (const { id, sprite } of sprites) {
            const dx = sprite.x - p.x;
            const dy = sprite.y - p.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < bestD2) { bestD2 = d2; bestId = id; }
          }
          if (bestId >= 0 && bestD2 < 900) {
            onSelectAgentRef.current(bestId, ev.global.x, ev.global.y);
          }
        });

        // Bubble containers cache
        const bubbleContainers = new Map<string, { container: Container; createdFrame: number }>();

        // Ticker loop
        app.ticker.add(() => {
          if (cancelled) return;
          const tick = tickRef.current;
          const zones = agentZonesRef.current;
          const bubbles = bubblesRef.current;
          const chain = causeChainRef.current;

          // Update agent positions
          for (const { id: agentId, sprite } of sprites) {
            const zoneId = zones[agentId];
            const zone = zoneId ? ZONE_MAP[zoneId] : null;
            if (zone) {
              const pos = townPosAtTick(agentId, tick, zone);
              sprite.x = pos.x;
              sprite.y = pos.y;
            }
            // Tint by mood
            const agent = agentsRef.current[agentId];
            if (agent) {
              sprite.tint = agentId === 31 ? 0xffd700 : moodToColor(agent.state.mood);
            }
          }

          // Update bubbles
          const activeBubbleIds = new Set<string>();
          for (const b of bubbles) {
            activeBubbleIds.add(b.id);
            if (!bubbleContainers.has(b.id)) {
              const bc = new Container();
              const bg = new Graphics();
              const truncText = b.text.length > 30 ? b.text.slice(0, 30) + '...' : b.text;
              const textObj = new Text({
                text: truncText,
                style: new TextStyle({ fontFamily: 'monospace', fontSize: 11, fill: 0x1e1e2e, wordWrap: true, wordWrapWidth: 140 }),
              });
              const pw = textObj.width + 12;
              const ph = textObj.height + 8;
              bg.roundRect(-pw / 2, -ph - 8, pw, ph, 6).fill({ color: 0xffffff, alpha: 0.9 });
              // Triangle pointer
              bg.moveTo(-4, -8).lineTo(0, 0).lineTo(4, -8).closePath().fill({ color: 0xffffff, alpha: 0.9 });
              textObj.x = -pw / 2 + 6;
              textObj.y = -ph - 4;
              bc.addChild(bg, textObj);
              bubbleLayer.addChild(bc);
              bubbleContainers.set(b.id, { container: bc, createdFrame: tick });
            }
            // Position bubble above agent
            const agentSprite = sprites.find(s => s.id === b.agentId);
            const bc = bubbleContainers.get(b.id)!;
            if (agentSprite) {
              bc.container.x = agentSprite.sprite.x;
              bc.container.y = agentSprite.sprite.y - 22;
            }
            // Fade in/out
            const age = tick - b.tick;
            const remaining = b.expiresAtTick - tick;
            if (age < 5) bc.container.alpha = age / 5;
            else if (remaining < 10) bc.container.alpha = Math.max(0, remaining / 10);
            else bc.container.alpha = 1;
          }
          // Remove expired bubble containers
          for (const [bid, bc] of bubbleContainers) {
            if (!activeBubbleIds.has(bid)) {
              bubbleLayer.removeChild(bc.container);
              bc.container.destroy({ children: true });
              bubbleContainers.delete(bid);
            }
          }

          // Cause chain animation
          causeLayer.clear();
          if (chain) {
            const elapsed = tick - chain.startTick;
            const progress = clamp(elapsed / chain.waveDurationTicks, 0, 1);
            const sourceSprite = sprites.find(s => s.id === chain.sourceAgentId);
            if (sourceSprite && progress < 1) {
              const sx = sourceSprite.sprite.x;
              const sy = sourceSprite.sprite.y;
              // Expanding ring
              const ringR = 20 + progress * 200;
              causeLayer.circle(sx, sy, ringR).stroke({ width: 2, color: 0xffd700, alpha: 0.6 * (1 - progress) });
              // Lines to affected agents
              for (const aid of chain.affectedAgentIds) {
                const target = sprites.find(s => s.id === aid);
                if (!target) continue;
                const tx = target.sprite.x;
                const ty = target.sprite.y;
                const dist = Math.sqrt((tx - sx) ** 2 + (ty - sy) ** 2);
                const lineProgress = clamp((progress * 300 - 20) / dist, 0, 1);
                if (lineProgress > 0) {
                  const lx = sx + (tx - sx) * lineProgress;
                  const ly = sy + (ty - sy) * lineProgress;
                  causeLayer.moveTo(sx, sy).lineTo(lx, ly);
                  causeLayer.stroke({ width: 1.5, color: 0x89b4fa, alpha: 0.5 * (1 - progress) });
                  if (lineProgress >= 1) {
                    causeLayer.circle(tx, ty, 8 + Math.sin(elapsed * 0.3) * 3).stroke({ width: 2, color: 0xa6e3a1, alpha: 0.6 * (1 - progress) });
                  }
                }
              }
            }
          }

          // Selected highlight
          highlightLayer.clear();
          const selId = selectedAgentIdRef.current;
          if (selId != null) {
            const selSprite = sprites.find(s => s.id === selId);
            if (selSprite) {
              const pulse = 10 + Math.sin(tick / 6) * 2;
              highlightLayer.circle(selSprite.sprite.x, selSprite.sprite.y, pulse).stroke({ width: 2, color: 0xffd700, alpha: 0.7 });
            }
          }
        });
      } catch {
        if (initialized) safeDestroy();
      }
    })();

    return () => {
      cancelled = true;
      try { resizeObserver?.disconnect(); } catch { /* */ }
      safeDestroy();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={hostRef} style={{ height: '100%', width: '100%', minHeight: 0 }} />;
}
