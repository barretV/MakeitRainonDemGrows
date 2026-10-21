import { useReducer, useRef, useState, type WheelEvent as ReactWheelEvent } from 'react';
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import type { RainGame } from '../game/RainGame';
import { worldDef } from '../game/balance';
import {
  BRANCH_COLORS,
  PRIORITY,
  TREE_CANVAS,
  nodesUnlockedSince,
  type NodeId,
  type TreeNodeView,
} from '../game/tree';
import { formatDew, walletDew, type HudModel } from '../game/state';
import { DewWallet } from './DewWallet';
import { TreeNodeCloud } from './TreeNodeCloud';

const BRANCH_LABELS: Record<string, string> = {
  core: 'Cloud',
  pour: 'Pour',
  rain: 'Rain',
  reach: 'Reach',
  fortune: 'Fortune',
  storm: 'Storm',
  spark: 'Spark',
  bloom: 'Bloom',
};

const BRANCH_HINTS: Record<string, string> = {
  core: 'Everything starts with size.',
  pour: 'How long the bottle pours.',
  rain: 'How hard the rain lands.',
  reach: 'How much land one pour covers.',
  fortune: 'What every finished patch pays.',
  storm: 'Abilities that fire on their own.',
  spark: 'Small wonders that trigger themselves.',
  bloom: 'Rare bloom upgrades.',
};

const MIN_ZOOM = 0.42;
const MAX_ZOOM = 1.7;
const COMFORT_ZOOM = 1.05;
/** Zoom that fits the whole upgrade web on screen. */
const WEB_ZOOM = 0.95;
const WORKSHOP_VIEW_KEY = 'mir-workshop-view-v1';

type View = { x: number; y: number; s: number };

type FlyingSeed = {
  id: number;
  childId: NodeId;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  start: number;
  dur: number;
};

let seedUid = 0;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function parseWorkshopView(raw: string | null): View | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as View;
    if (typeof v.x !== 'number' || typeof v.y !== 'number' || typeof v.s !== 'number') return null;
    return { x: v.x, y: v.y, s: clamp(v.s, MIN_ZOOM, MAX_ZOOM) };
  } catch {
    return null;
  }
}

function writeStoredWorkshopView(view: View): void {
  void RundotGameAPI.deviceCache.setItem(WORKSHOP_VIEW_KEY, JSON.stringify(view)).catch(() => undefined);
}

let savedWorkshopView: View | null = null;
void RundotGameAPI.deviceCache.getItem(WORKSHOP_VIEW_KEY).then((raw) => {
  const stored = parseWorkshopView(raw);
  if (stored && !savedWorkshopView) savedWorkshopView = stored;
}).catch(() => undefined);
let lastWorkshopFocusId: NodeId = 'puff';

function stillNeed(node: TreeNodeView, dew: number, blooms: number): string {
  const dewShort = Math.max(0, Math.ceil(node.cost - dew));
  const bloomShort = Math.max(0, Math.ceil(node.blooms - blooms));
  if (dewShort > 0 && bloomShort > 0) return `Need ${formatDew(dewShort)} dew + ${bloomShort} blooms`;
  if (bloomShort > 0) return `Need ${bloomShort} more blooms`;
  if (dewShort > 0) return `Need ${formatDew(dewShort)} more dew`;
  return 'Need more dew';
}

function statusBadge(node: TreeNodeView, dew: number, blooms: number): { kind: string; text: string } {
  if (node.worldReq != null) {
    return { kind: 'lock', text: `Locked · ${worldDef(node.worldReq).name}` };
  }
  if (node.ghost) {
    return {
      kind: 'lock',
      text:
        node.parent === 'puff' && node.level === 0 ? 'Locked · puff first' : 'Locked · parent first',
    };
  }
  if (node.maxed) return { kind: 'max', text: 'Max rank' };
  if (node.afford) return { kind: 'buy', text: 'Ready' };
  if (node.level > 0) return { kind: 'owned', text: `Rank ${node.level}/${node.max}` };
  return { kind: 'lock', text: stillNeed(node, dew, blooms) };
}

function costLabel(node: TreeNodeView): string {
  const parts = [`${formatDew(node.cost)} dew`];
  if (node.blooms > 0) parts.push(`${node.blooms} blooms`);
  return parts.join(' + ');
}

function primaryBuyLabel(node: TreeNodeView, dew: number, blooms: number): string {
  if (node.maxed) return 'Maxed out';
  if (node.worldReq != null) return `Reach ${worldDef(node.worldReq).name}`;
  if (node.ghost) return 'Not unlocked yet';
  if (!node.afford) return stillNeed(node, dew, blooms);
  const cost = costLabel(node);
  if (node.kind === 'gate') return `Unlock · ${cost}`;
  if (node.level === 0) return `Buy · ${cost}`;
  return `Rank ${node.level + 1} · ${cost}`;
}

function vinePath(x1: number, y1: number, x2: number, y2: number): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * Math.min(48, len * 0.22);
  const ny = (dx / len) * Math.min(48, len * 0.22);
  return `M ${x1} ${y1} Q ${mx + nx} ${my + ny} ${x2} ${y2}`;
}

function pickFocusId(tree: TreeNodeView[]): NodeId {
  const byId = new Map(tree.map((n) => [n.id, n]));
  for (const id of PRIORITY) {
    const node = byId.get(id);
    if (node?.afford) return id;
  }
  for (const id of PRIORITY) {
    const node = byId.get(id);
    if (node && node.visible && !node.ghost && !node.maxed) return id;
  }
  return lastWorkshopFocusId;
}

export function UpgradeTree({ model, game }: { model: HudModel; game: RainGame }) {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const puffLevel = model.tree.find((node) => node.id === 'puff')?.level ?? 0;
  const totalRanks = model.tree.reduce((sum, node) => sum + node.level, 0);
  const shown = model.tree.filter((node) => {
    if (totalRanks === 0) return node.id === 'puff';
    return node.visible || (node.ghost && puffLevel >= 1);
  });
  const nextBuy = PRIORITY.map((id) => model.tree.find((node) => node.id === id)).find(
    (node) => node && node.afford,
  );
  const [picked, setPicked] = useState<NodeId>('puff');
  const [buyPulse, setBuyPulse] = useState(0);
  const [affordPingIds, setAffordPingIds] = useState<Set<NodeId>>(() => new Set());
  const pickedId = shown.some((n) => n.id === picked) ? picked : (nextBuy?.id ?? shown[0]?.id ?? 'puff');
  const selected = model.tree.find((node) => node.id === pickedId) ?? shown[0];
  const purse = walletDew(model.dew);
  const blooms = model.spendableBlooms;
  const badge = selected ? statusBadge(selected, purse, blooms) : { kind: 'owned', text: '' };

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const layerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<View>(savedWorkshopView ?? { x: 0, y: 0, s: 0.82 });
  const tweenRef = useRef<View | null>(null);
  const tweenRafRef = useRef<number | null>(null);
  const panStart = useRef<{ vx: number; vy: number; cx: number; cy: number } | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ dist: number; midX: number; midY: number; view: View } | null>(null);
  const moved = useRef(false);
  const rectRef = useRef({ w: 360, h: 480, left: 0, top: 0 });
  const canvasResizeRef = useRef<ResizeObserver | null>(null);
  const gestureCleanupRef = useRef<(() => void) | null>(null);
  const modelRef = useRef(model);
  modelRef.current = model;
  const entryPulseRef = useRef(false);
  const revealRef = useRef<Set<NodeId>>(new Set());
  const edgeAnimRef = useRef<Set<NodeId>>(new Set());
  const buyPopRef = useRef<Partial<Record<NodeId, number>>>({});
  const affordTimerRef = useRef<number | null>(null);
  const seedRef = useRef<FlyingSeed[]>([]);
  const [seeds, setSeeds] = useState<FlyingSeed[]>([]);
  const pickedRef = useRef(pickedId);
  pickedRef.current = pickedId;

  const nodesById = new Map(model.tree.map((n) => [n.id, n]));

  const applyTransform = () => {
    const layer = layerRef.current;
    if (!layer) return;
    const { x, y, s } = viewRef.current;
    layer.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
  };

  const persistView = () => {
    savedWorkshopView = { ...viewRef.current };
    writeStoredWorkshopView(savedWorkshopView);
  };

  const landSeed = (seed: FlyingSeed) => {
    revealRef.current.add(seed.childId);
    edgeAnimRef.current.add(seed.childId);
    bump();
  };

  const ensureTweenLoop = () => {
    if (tweenRafRef.current != null) return;
    const loop = (now: number) => {
      tweenRafRef.current = null;
      let active = false;

      const target = tweenRef.current;
      if (target) {
        const v = viewRef.current;
        const nx = lerp(v.x, target.x, 0.18);
        const ny = lerp(v.y, target.y, 0.18);
        const ns = lerp(v.s, target.s, 0.18);
        if (
          Math.abs(nx - target.x) < 0.6 &&
          Math.abs(ny - target.y) < 0.6 &&
          Math.abs(ns - target.s) < 0.003
        ) {
          viewRef.current = target;
          tweenRef.current = null;
          persistView();
        } else {
          viewRef.current = { x: nx, y: ny, s: ns };
          active = true;
        }
        applyTransform();
      }

      if (seedRef.current.length) {
        const live: FlyingSeed[] = [];
        for (const seed of seedRef.current) {
          const t = (now - seed.start) / seed.dur;
          if (t >= 1) landSeed(seed);
          else live.push(seed);
        }
        seedRef.current = live;
        setSeeds([...live]);
        if (live.length) active = true;
      }

      if (active) tweenRafRef.current = requestAnimationFrame(loop);
    };
    tweenRafRef.current = requestAnimationFrame(loop);
  };

  const launchReveal = (childId: NodeId) => {
    const child = nodesById.get(childId);
    const parent = child?.parent ? nodesById.get(child.parent) : null;
    if (!child || !parent) {
      revealRef.current.add(childId);
      edgeAnimRef.current.add(childId);
      bump();
      return;
    }
    const dist = Math.hypot(child.x - parent.x, child.y - parent.y);
    const seed: FlyingSeed = {
      id: seedUid++,
      childId,
      fromX: parent.x,
      fromY: parent.y,
      toX: child.x,
      toY: child.y,
      start: performance.now(),
      dur: 620 + dist * 0.35,
    };
    seedRef.current = [...seedRef.current, seed];
    setSeeds([...seedRef.current]);
    ensureTweenLoop();
  };

  const focusNode = (id: NodeId, animate = true, zoom?: number) => {
    const node = nodesById.get(id);
    const canvas = canvasRef.current;
    if (!node || !canvas) return;
    lastWorkshopFocusId = id;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const centerY = h * 0.46;
    const s = clamp(zoom ?? viewRef.current.s, MIN_ZOOM, MAX_ZOOM);
    const target: View = { x: w / 2 - node.x * s, y: centerY - node.y * s, s };
    if (animate) {
      tweenRef.current = target;
      ensureTweenLoop();
    } else {
      viewRef.current = target;
      persistView();
      applyTransform();
    }
  };

  const triggerAffordPing = () => {
    const ids = model.tree.filter((n) => n.afford).map((n) => n.id);
    if (!ids.length) return;
    setAffordPingIds(new Set(ids));
    if (affordTimerRef.current != null) window.clearTimeout(affordTimerRef.current);
    affordTimerRef.current = window.setTimeout(() => {
      setAffordPingIds(new Set());
      affordTimerRef.current = null;
    }, 1400);
  };

  const scheduleWorkshopEntry = (restoreSavedView: boolean) => {
    if (entryPulseRef.current) return;
    entryPulseRef.current = true;
    window.setTimeout(() => {
      if (restoreSavedView) {
        triggerAffordPing();
        return;
      }
      // First look: the whole web, hub in the middle. The panel points at the
      // next purchase from there.
      focusNode('puff', true, WEB_ZOOM);
      window.setTimeout(() => triggerAffordPing(), 520);
    }, 120);
  };

  const measureCanvasRect = (el: HTMLDivElement) => {
    const r = el.getBoundingClientRect();
    rectRef.current = { w: r.width, h: r.height, left: r.left, top: r.top };
  };

  const localPt = (clientX: number, clientY: number) => ({
    x: clientX - rectRef.current.left,
    y: clientY - rectRef.current.top,
  });

  const blocksPan = (target: EventTarget | null) =>
    target instanceof Element &&
    !!target.closest('.workshop-panel, .workshop-wallet, .workshop-jump, .workshop-buy, .workshop-back');

  const zoomAt = (px: number, py: number, nextS: number) => {
    const v = viewRef.current;
    const s = clamp(nextS, MIN_ZOOM, MAX_ZOOM);
    const wx = (px - v.x) / v.s;
    const wy = (py - v.y) / v.s;
    viewRef.current = { x: px - wx * s, y: py - wy * s, s };
    applyTransform();
  };

  const attachCanvasGestures = (el: HTMLDivElement) => {
    const onDown = (e: PointerEvent) => {
      if (blocksPan(e.target)) return;
      if (e.pointerType === 'touch' || e.pointerType === 'pen') e.preventDefault();
      measureCanvasRect(el);
      const p = localPt(e.clientX, e.clientY);
      pointersRef.current.set(e.pointerId, p);
      moved.current = false;
      tweenRef.current = null;
      if (pointersRef.current.size === 1) {
        panStart.current = { vx: viewRef.current.x, vy: viewRef.current.y, cx: p.x, cy: p.y };
        pinchStart.current = null;
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          /* ignored */
        }
      } else if (pointersRef.current.size === 2) {
        const pts = [...pointersRef.current.values()];
        const a = pts[0];
        const b = pts[1];
        if (!a || !b) return;
        pinchStart.current = {
          dist: Math.hypot(a.x - b.x, a.y - b.y),
          midX: (a.x + b.x) / 2,
          midY: (a.y + b.y) / 2,
          view: { ...viewRef.current },
        };
        panStart.current = null;
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          /* ignored */
        }
      }
    };

    const onMove = (e: PointerEvent) => {
      if (!pointersRef.current.has(e.pointerId)) return;
      if (e.pointerType === 'touch' || e.pointerType === 'pen') e.preventDefault();
      measureCanvasRect(el);
      const p = localPt(e.clientX, e.clientY);
      pointersRef.current.set(e.pointerId, p);
      if (pointersRef.current.size >= 2 && pinchStart.current) {
        const pts = [...pointersRef.current.values()];
        const a = pts[0];
        const b = pts[1];
        if (!a || !b) return;
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2;
        const ps = pinchStart.current;
        const ns = clamp(ps.view.s * (dist / ps.dist), MIN_ZOOM, MAX_ZOOM);
        const tx = (ps.midX - ps.view.x) / ps.view.s;
        const ty = (ps.midY - ps.view.y) / ps.view.s;
        viewRef.current = { x: midX - tx * ns, y: midY - ty * ns, s: ns };
        applyTransform();
        moved.current = true;
      } else if (panStart.current) {
        const dx = p.x - panStart.current.cx;
        const dy = p.y - panStart.current.cy;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved.current = true;
        viewRef.current = {
          x: panStart.current.vx + dx,
          y: panStart.current.vy + dy,
          s: viewRef.current.s,
        };
        applyTransform();
      }
    };

    const onUp = (e: PointerEvent) => {
      if (el.hasPointerCapture(e.pointerId)) {
        try {
          el.releasePointerCapture(e.pointerId);
        } catch {
          /* ignored */
        }
      }
      pointersRef.current.delete(e.pointerId);
      if (pointersRef.current.size < 2) pinchStart.current = null;
      if (pointersRef.current.size === 0) {
        panStart.current = null;
        persistView();
      }
    };

    const passiveFalse = { passive: false } as const;
    el.addEventListener('pointerdown', onDown, passiveFalse);
    el.addEventListener('pointermove', onMove, passiveFalse);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    window.addEventListener('pointermove', onMove, passiveFalse);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    const onResize = () => measureCanvasRect(el);
    window.addEventListener('resize', onResize);

    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('resize', onResize);
    };
  };

  const onWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    tweenRef.current = null;
    const canvas = canvasRef.current;
    if (canvas) measureCanvasRect(canvas);
    const p = localPt(e.clientX, e.clientY);
    zoomAt(p.x, p.y, viewRef.current.s * (e.deltaY < 0 ? 1.1 : 0.91));
    persistView();
  };

  const bindCanvas = (el: HTMLDivElement | null) => {
    gestureCleanupRef.current?.();
    gestureCleanupRef.current = null;
    canvasResizeRef.current?.disconnect();
    canvasResizeRef.current = null;
    if (!el) {
      if (tweenRafRef.current != null) cancelAnimationFrame(tweenRafRef.current);
      tweenRafRef.current = null;
      if (affordTimerRef.current != null) window.clearTimeout(affordTimerRef.current);
      persistView();
      lastWorkshopFocusId = pickedRef.current;
      entryPulseRef.current = false;
      pointersRef.current.clear();
      panStart.current = null;
      pinchStart.current = null;
      canvasRef.current = null;
      return;
    }
    canvasRef.current = el;
    const measure = () => measureCanvasRect(el);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    canvasResizeRef.current = ro;
    gestureCleanupRef.current = attachCanvasGestures(el);

    const restoreSavedView = savedWorkshopView != null;
    if (restoreSavedView) {
      viewRef.current = { ...savedWorkshopView! };
      applyTransform();
    }
    scheduleWorkshopEntry(restoreSavedView);
  };

  const clearAffordPingId = (id: NodeId) => {
    setAffordPingIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const onEdgeDrawEnd = (childId: NodeId) => {
    edgeAnimRef.current.delete(childId);
    bump();
  };

  const onRevealEnd = (id: NodeId) => {
    revealRef.current.delete(id);
    bump();
  };

  const purchase = (id: NodeId) => {
    const ranksBefore = game.getRanks();
    if (!ranksBefore) return;
    if (!game.buy(id)) return;
    setBuyPulse((n) => n + 1);
    const ranksAfter = game.getRanks();
    if (!ranksAfter) return;

    lastWorkshopFocusId = id;
    setPicked(id);
    buyPopRef.current[id] = (buyPopRef.current[id] ?? 0) + 1;

    const revealed = nodesUnlockedSince(ranksBefore, ranksAfter, game.getUnlocked());
    for (const rid of revealed) launchReveal(rid);

    if (revealed.length > 0) {
      const first = revealed[0]!;
      window.setTimeout(() => focusNode(first, true, viewRef.current.s), 120);
      window.setTimeout(() => triggerAffordPing(), 1100);
    } else {
      focusNode(id, true, COMFORT_ZOOM);
      window.setTimeout(() => triggerAffordPing(), 380);
    }
  };

  return (
    <div className="workshop pointer-events-auto absolute inset-0 flex text-[#e8f0ff]">
      <div
        ref={bindCanvas}
        className="workshop-canvas relative min-h-0 min-w-0 flex-1 touch-none select-none"
        style={{ touchAction: 'none', cursor: 'grab' }}
        onWheel={onWheel}
        onClick={() => {
          if (moved.current) return;
          const id = pickFocusId(modelRef.current.tree);
          setPicked(id);
          focusNode(id, true, viewRef.current.s);
        }}
      >
        <DewWallet amount={model.dew} blooms={model.spendableBlooms} />
        <div className="workshop-legend pixel">
          <span className="workshop-legend__item workshop-legend__item--buy">Can buy</span>
          <span className="workshop-legend__item workshop-legend__item--owned">Owned</span>
          <span className="workshop-legend__item workshop-legend__item--lock">Locked</span>
        </div>
        <div className="workshop-hint pixel">Drag to pan · pinch or scroll to zoom</div>
        <div ref={layerRef} className="workshop-layer">
          <svg
            className="workshop-vines"
            width={TREE_CANVAS.w}
            height={TREE_CANVAS.h}
            viewBox={`0 0 ${TREE_CANVAS.w} ${TREE_CANVAS.h}`}
          >
            {shown.map((node) => {
              if (!node.parent) return null;
              const parent = nodesById.get(node.parent);
              if (!parent || (!parent.visible && !parent.ghost)) return null;
              const drawing = edgeAnimRef.current.has(node.id);
              const showEdge = !node.ghost || drawing;
              if (!showEdge && node.ghost) return null;
              const color = BRANCH_COLORS[node.branch];
              const hot = !node.ghost && (node.afford || parent.afford);
              return (
                <path
                  key={`${parent.id}-${node.id}`}
                  d={vinePath(parent.x, parent.y, node.x, node.y)}
                  fill="none"
                  stroke={node.ghost && !drawing ? '#5a5668' : color}
                  strokeWidth={node.ghost && !drawing ? 2.5 : hot ? 4.5 : 3.5}
                  strokeLinecap="round"
                  opacity={node.ghost && !drawing ? 0.35 : drawing ? 0.9 : hot ? 0.78 : 0.52}
                  strokeDasharray={node.ghost && !drawing ? '6 9' : undefined}
                  pathLength={drawing ? 1 : undefined}
                  className={
                    drawing ? 'workshop-vine--draw' : hot ? 'workshop-vine--hot' : undefined
                  }
                  onAnimationEnd={drawing ? () => onEdgeDrawEnd(node.id) : undefined}
                />
              );
            })}
          </svg>
          {seeds.map((seed) => {
            const t = Math.min(1, (performance.now() - seed.start) / seed.dur);
            const ease = 1 - (1 - t) * (1 - t);
            const arc = Math.sin(t * Math.PI) * 36;
            const x = seed.fromX + (seed.toX - seed.fromX) * ease;
            const y = seed.fromY + (seed.toY - seed.fromY) * ease - arc;
            return (
              <div
                key={seed.id}
                className="workshop-seed"
                style={{ left: x, top: y }}
                aria-hidden
              />
            );
          })}
          <div
            className="workshop-nodes"
            style={{ width: TREE_CANVAS.w, height: TREE_CANVAS.h }}
          >
            {shown.map((node) => (
              <TreeNodeCloud
                key={node.id}
                node={node}
                picked={pickedId === node.id}
                reveal={revealRef.current.has(node.id)}
                buyPop={buyPopRef.current[node.id] ?? 0}
                affordPing={affordPingIds.has(node.id)}
                onRevealEnd={() => onRevealEnd(node.id)}
                onAffordPingEnd={() => clearAffordPingId(node.id)}
                onPick={() => {
                  setPicked(node.id);
                  lastWorkshopFocusId = node.id;
                  focusNode(node.id, true, viewRef.current.s);
                }}
                onBuy={() => purchase(node.id)}
                ignoreTap={() => moved.current}
              />
            ))}
          </div>
        </div>
      </div>

      {selected && (
        <aside
          className="workshop-panel"
          style={{ ['--panel-branch' as string]: BRANCH_COLORS[selected.branch] }}
        >
          <div className="workshop-branch-head pixel">
            <span className="workshop-branch-head__name">{BRANCH_LABELS[selected.branch]}</span>
            <span className="workshop-branch-head__hint">{BRANCH_HINTS[selected.branch]}</span>
          </div>
          <>
              {nextBuy && nextBuy.id !== selected.id && (
                <button
                  type="button"
                  className="workshop-jump pixel"
                  onClick={() => {
                    setPicked(nextBuy.id);
                    focusNode(nextBuy.id, true, viewRef.current.s);
                  }}
                >
                  <span className="workshop-jump__label">Recommended</span>
                  <span className="workshop-jump__name">{nextBuy.name}</span>
                  <span className="workshop-jump__cost">{costLabel(nextBuy)}</span>
                </button>
              )}
              <div className="workshop-panel__head">
                <div className="workshop-panel__title pixel">{selected.name}</div>
                <span className={`workshop-status workshop-status--${badge.kind} pixel`}>{badge.text}</span>
              </div>
              {selected.max > 1 && (
                <div className="workshop-rank-meter" aria-hidden>
                  <div
                    className="workshop-rank-meter__fill"
                    style={{ width: `${(selected.level / selected.max) * 100}%` }}
                  />
                  <span className="workshop-rank-meter__text tabular-nums">
                    {selected.level}/{selected.max}
                  </span>
                </div>
              )}
              {totalRanks === 0 && (
                <p className="workshop-panel__desc pixel">Rain first. Bloom a patch. Spend dew on Cloud Puff to grow.</p>
              )}
              <p className="workshop-panel__desc">{selected.desc}</p>
              <p className="workshop-panel__effect">{selected.effect}</p>
              <button
                type="button"
                disabled={!selected.afford}
                onClick={() => purchase(selected.id)}
                className={`workshop-buy pixel${selected.afford ? ' workshop-buy--go' : ''}${buyPulse ? ' workshop-buy--pulse' : ''}`}
                key={buyPulse ? `buy-${buyPulse}` : 'buy'}
              >
                {primaryBuyLabel(selected, purse, blooms)}
              </button>
              <button type="button" onClick={() => game.returnFromWorkshop()} className="workshop-back pixel">
                Back to rain
              </button>
          </>
        </aside>
      )}
    </div>
  );
}
