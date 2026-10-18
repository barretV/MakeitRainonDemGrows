import { useRef, useState } from 'react';
import type { RainGame } from '../game/RainGame';
import { BRANCH_COLORS, TREE_CANVAS, type NodeId, type TreeNodeView } from '../game/tree';
import { formatDew, type HudModel } from '../game/state';
import { DewWallet } from './DewWallet';
import { TreeNodeCloud } from './TreeNodeCloud';

const MIN_ZOOM = 0.42;
const MAX_ZOOM = 1.35;

function WorkshopStatus({ node }: { node: TreeNodeView }) {
  let kind = 'owned';
  let text = 'Owned';
  if (node.ghost) {
    kind = 'lock';
    text = 'Locked · unlock parent first';
  } else if (node.maxed) {
    kind = 'max';
    text = 'Maxed';
  } else if (node.afford) {
    kind = 'buy';
    text = 'Ready to purchase';
  } else if (node.level === 0) {
    kind = 'lock';
    text = 'Need more dew';
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

export function UpgradeTree({ model, game }: { model: HudModel; game: RainGame }) {
  const shown = model.tree.filter((node) => node.visible || node.ghost);
  const [picked, setPicked] = useState<NodeId>('puff');
  const selected = model.tree.find((node) => node.id === picked) ?? shown[0];

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const layerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef({ x: 0, y: 0, s: 0.82 });
  const panStart = useRef<{ vx: number; vy: number; cx: number; cy: number } | null>(null);
  const moved = useRef(false);
  const fitted = useRef(false);

  const applyTransform = () => {
    const layer = layerRef.current;
    if (!layer) return;
    const { x, y, s } = viewRef.current;
    layer.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
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
  };

  const bindCanvas = (el: HTMLDivElement | null) => {
    canvasRef.current = el;
    if (!el || fitted.current) return;
    fitted.current = true;
    requestAnimationFrame(() => fitView(el));
  };

  const pointerPos = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    moved.current = false;
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
    panStart.current = null;
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
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
  };

  const nodesById = new Map(model.tree.map((n) => [n.id, n]));

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
          if (!moved.current) setPicked('puff');
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
              const color = BRANCH_COLORS[node.branch];
              return (
                <path
                  key={`${parent.id}-${node.id}`}
                  d={vinePath(parent.x, parent.y, node.x, node.y)}
                  fill="none"
                  stroke={node.ghost ? '#5a5668' : color}
                  strokeWidth={node.ghost ? 2.5 : 3.5}
                  strokeLinecap="round"
                  opacity={node.ghost ? 0.35 : 0.55}
                  strokeDasharray={node.ghost ? '6 9' : undefined}
                />
              );
            })}
          </svg>
          <div
            className="workshop-nodes"
            style={{ width: TREE_CANVAS.w, height: TREE_CANVAS.h }}
          >
            {shown.map((node) => (
              <TreeNodeCloud
                key={node.id}
                node={node}
                picked={picked === node.id}
                onPick={() => setPicked(node.id)}
              />
            ))}
          </div>
        </div>
      </div>

      {selected && (
        <aside className="workshop-panel">
          <WorkshopStatus node={selected} />
          <div className="workshop-panel__title pixel">{selected.name}</div>
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
            onClick={() => game.buy(selected.id)}
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
          <button type="button" onClick={() => game.showResults()} className="workshop-back pixel">
            Back to results
          </button>
        </aside>
      )}
    </div>
  );
}
