import { useReducer, useRef, useState } from 'react';
import type { RainGame } from '../game/RainGame';
import {
  BRANCH_COLORS,
  PRIORITY,
  TREE_CANVAS,
  nodesUnlockedSince,
  type NodeId,
  type TreeNodeView,
} from '../game/tree';
import { formatDew, type HudModel } from '../game/state';
import { DewWallet } from './DewWallet';
import { PetalShop } from './PetalShop';
import { TreeNodeCloud } from './TreeNodeCloud';

const MIN_ZOOM = 0.42;
const MAX_ZOOM = 1.35;
const COMFORT_ZOOM = 0.9;

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

let savedWorkshopView: View | null = null;
let lastWorkshopFocusId: NodeId = 'puff';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function WorkshopStatus({ node, onBuy }: { node: TreeNodeView; onBuy: () => void }) {
  let kind = 'owned';
  let text = 'Owned';
  if (node.ghost) {
    kind = 'lock';
    text =
      node.parent === 'puff' && node.level === 0
        ? 'Locked · buy Cloud Puff first'
        : 'Locked · unlock parent first';
  } else if (node.maxed) {
    kind = 'max';
    text = 'Maxed';
  } else if (node.afford) {
    kind = 'buy';
    text = 'Tap to buy';
  } else if (node.level === 0) {
    kind = 'lock';
    text = 'Need more dew';
  }
  if (node.afford && !node.maxed && !node.ghost) {
    return (
      <button type="button" className={`workshop-status workshop-status--${kind} pixel`} onClick={onBuy}>
        {text}
      </button>
    );
  }
  return <div className={`workshop-status workshop-status--${kind} pixel`}>{text}</div>;
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
  const [tab, setTab] = useState<'power' | 'petals'>('power');
  const [affordPingIds, setAffordPingIds] = useState<Set<NodeId>>(() => new Set());
  const pickedId = shown.some((n) => n.id === picked) ? picked : (nextBuy?.id ?? shown[0]?.id ?? 'puff');
  const selected = model.tree.find((node) => node.id === pickedId) ?? shown[0];

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const layerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<View>(savedWorkshopView ?? { x: 0, y: 0, s: 0.82 });
  const tweenRef = useRef<View | null>(null);
  const tweenRafRef = useRef<number | null>(null);
  const panStart = useRef<{ vx: number; vy: number; cx: number; cy: number } | null>(null);
  const moved = useRef(false);
  const fitted = useRef(false);
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
    const side = 268;
    const w = canvas.clientWidth - side;
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

  const scheduleEntryPulse = () => {
    if (entryPulseRef.current) return;
    entryPulseRef.current = true;
    window.setTimeout(() => {
      focusNode(pickFocusId(model.tree), true, savedWorkshopView ? viewRef.current.s : COMFORT_ZOOM);
      window.setTimeout(() => triggerAffordPing(), 520);
    }, 120);
  };

  const fitView = (el: HTMLDivElement) => {
    const pad = 12;
    const side = 268;
    const w = el.clientWidth - side;
    const h = el.clientHeight;
    const s = Math.min(w / TREE_CANVAS.w, h / TREE_CANVAS.h, 0.95) * 0.92;
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, s));
    viewRef.current = {
      x: pad + (w - TREE_CANVAS.w * clamped) / 2,
      y: (h - TREE_CANVAS.h * clamped) / 2,
      s: clamped,
    };
    applyTransform();
    persistView();
  };

  const bindCanvas = (el: HTMLDivElement | null) => {
    if (!el) {
      if (tweenRafRef.current != null) cancelAnimationFrame(tweenRafRef.current);
      tweenRafRef.current = null;
      if (affordTimerRef.current != null) window.clearTimeout(affordTimerRef.current);
      persistView();
      lastWorkshopFocusId = pickedRef.current;
      canvasRef.current = null;
      return;
    }
    canvasRef.current = el;
    if (savedWorkshopView) {
      viewRef.current = { ...savedWorkshopView };
      applyTransform();
    } else if (!fitted.current) {
      fitted.current = true;
      requestAnimationFrame(() => fitView(el));
    }
    scheduleEntryPulse();
  };

  const pointerPos = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('.tree-node, .workshop-panel, .workshop-wallet, button, a')) return;
    moved.current = false;
    tweenRef.current = null;
    const p = pointerPos(e.clientX, e.clientY);
    panStart.current = { vx: viewRef.current.x, vy: viewRef.current.y, cx: p.x, cy: p.y };
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!panStart.current) return;
    const p = pointerPos(e.clientX, e.clientY);
    const dx = p.x - panStart.current.cx;
    const dy = p.y - panStart.current.cy;
    if (Math.hypot(dx, dy) > 4) moved.current = true;
    viewRef.current = {
      ...viewRef.current,
      x: panStart.current.vx + dx,
      y: panStart.current.vy + dy,
    };
    applyTransform();
  };

  const onPointerUp = () => {
    if (panStart.current) persistView();
    panStart.current = null;
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    tweenRef.current = null;
    const p = pointerPos(e.clientX, e.clientY);
    const factor = e.deltaY < 0 ? 1.1 : 0.91;
    const v = viewRef.current;
    const nextS = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, v.s * factor));
    const wx = (p.x - v.x) / v.s;
    const wy = (p.y - v.y) / v.s;
    viewRef.current = {
      x: p.x - wx * nextS,
      y: p.y - wy * nextS,
      s: nextS,
    };
    applyTransform();
    persistView();
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
    const ranksAfter = game.getRanks();
    if (!ranksAfter) return;

    lastWorkshopFocusId = id;
    setPicked(id);
    buyPopRef.current[id] = (buyPopRef.current[id] ?? 0) + 1;

    const revealed = nodesUnlockedSince(ranksBefore, ranksAfter);
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
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        onClick={() => {
          if (!moved.current) {
            const id = pickFocusId(model.tree);
            setPicked(id);
            focusNode(id, true, viewRef.current.s);
          }
        }}
      >
        <DewWallet amount={model.dew} />
        <div className="workshop-legend pixel">
          <span className="workshop-legend__item workshop-legend__item--buy">Can buy</span>
          <span className="workshop-legend__item workshop-legend__item--owned">Owned</span>
          <span className="workshop-legend__item workshop-legend__item--lock">Locked</span>
        </div>
        <div className="workshop-hint pixel">Drag to pan · scroll to zoom</div>
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
              return (
                <path
                  key={`${parent.id}-${node.id}`}
                  d={vinePath(parent.x, parent.y, node.x, node.y)}
                  fill="none"
                  stroke={node.ghost && !drawing ? '#5a5668' : color}
                  strokeWidth={node.ghost && !drawing ? 2.5 : 3.5}
                  strokeLinecap="round"
                  opacity={node.ghost && !drawing ? 0.35 : drawing ? 0.85 : 0.55}
                  strokeDasharray={node.ghost && !drawing ? '6 9' : undefined}
                  pathLength={drawing ? 1 : undefined}
                  className={drawing ? 'workshop-vine--draw' : undefined}
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
              />
            ))}
          </div>
        </div>
      </div>

      {selected && (
        <aside className="workshop-panel">
          <div className="workshop-tabs pixel">
            <button
              type="button"
              className={`workshop-tabs__btn${tab === 'power' ? ' workshop-tabs__btn--on' : ''}`}
              onClick={() => setTab('power')}
            >
              Power
            </button>
            <button
              type="button"
              className={`workshop-tabs__btn${tab === 'petals' ? ' workshop-tabs__btn--on' : ''}`}
              onClick={() => setTab('petals')}
            >
              Petals
            </button>
          </div>
          {tab === 'petals' ? (
            <PetalShop model={model} game={game} />
          ) : (
            <>
              {nextBuy && (
                <button
                  type="button"
                  className="workshop-next workshop-next--buy pixel"
                  onClick={() => purchase(nextBuy.id)}
                >
                  {nextBuy.id === selected.id ? 'Buy now' : 'Next up'}: <span>{nextBuy.name}</span> ·{' '}
                  {formatDew(nextBuy.cost)} dew
                </button>
              )}
              <WorkshopStatus node={selected} onBuy={() => purchase(selected.id)} />
              <div className="workshop-panel__title pixel">{selected.name}</div>
              {totalRanks === 0 && (
                <p className="workshop-panel__desc pixel">Rain first. Bloom a patch. Spend dew on Cloud Puff to grow.</p>
              )}
              <p className="workshop-panel__desc">{selected.desc}</p>
              <p className="workshop-panel__effect">{selected.effect}</p>
              {!selected.maxed && !selected.ghost && (
                <p className="workshop-panel__cost pixel">
                  Cost <span>{formatDew(selected.cost)}</span> dew
                </p>
              )}
              <button
                type="button"
                disabled={!selected.afford}
                onClick={() => purchase(selected.id)}
                className={`workshop-buy pixel${selected.afford ? ' workshop-buy--go' : ''}`}
              >
                {selected.maxed
                  ? 'Maxed out'
                  : selected.ghost
                    ? 'Not unlocked yet'
                    : selected.kind === 'gate'
                      ? `Unlock`
                      : `Rank up`}
              </button>
          <button type="button" onClick={() => game.returnFromWorkshop()} className="workshop-back pixel">
            Back to rain
          </button>
            </>
          )}
        </aside>
      )}
    </div>
  );
}
