import type { ReactNode } from 'react';
import type { Branch, NodeId, TreeNodeView } from '../game/tree';
import { BRANCH_COLORS } from '../game/tree';

const CLOUD =
  'M18 36c-5 0-9-4-9-9 0-4 2-7 6-8-1-6 5-10 11-10 3 0 6 1 8 4 2-1 4-2 6-2 6 0 11 4 11 10 0 1 0 2-1 3 4 2 7 6 7 11 0 7-6 12-13 12H22c-7 0-13-5-13-11z';

const DROP =
  'M24 2c-11 0-15 11-15 22 0 14 15 34 15 34s15-20 15-34C39 13 35 2 24 2z';

type NodeShape = 'cloud' | 'drop';
type Visual = 'ghost' | 'maxed' | 'ready' | 'owned' | 'locked';

/** Bottle + reach + core = fluffy clouds; drizzle + charm = rain drops. */
function nodeShape(branch: Branch): NodeShape {
  if (branch === 'drizzle' || branch === 'charm') return 'drop';
  return 'cloud';
}

function nodeVisual(node: TreeNodeView): Visual {
  if (node.ghost) return 'ghost';
  if (node.maxed) return 'maxed';
  if (node.afford) return 'ready';
  if (node.level > 0) return 'owned';
  return 'locked';
}

function stateLabel(state: Visual): string | null {
  if (state === 'ready') return 'Buy';
  if (state === 'ghost' || state === 'locked') return 'Locked';
  if (state === 'maxed') return 'Max';
  return null;
}

function nodeSize(node: TreeNodeView, shape: NodeShape): { w: number; h: number } {
  if (node.id === 'puff') return { w: 88, h: 58 };
  if (node.kind === 'gate') return shape === 'drop' ? { w: 58, h: 74 } : { w: 66, h: 46 };
  return shape === 'drop' ? { w: 54, h: 70 } : { w: 60, h: 42 };
}

function SymbolWrap({
  cx,
  cy,
  muted,
  children,
}: {
  cx: number;
  cy: number;
  muted?: boolean;
  children: ReactNode;
}) {
  const ink = muted ? '#9aa3b8' : '#1e3050';
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <circle className="tree-node__icon-plate" r={12} />
      <g
        transform="scale(0.88)"
        fill={ink}
        stroke={ink}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </g>
    </g>
  );
}

function NodeSymbol({
  id,
  gateOpen,
  shape,
  muted,
}: {
  id: NodeId;
  gateOpen: boolean;
  shape: NodeShape;
  muted?: boolean;
}) {
  const center = shape === 'drop' ? { cx: 24, cy: 30 } : { cx: 36, cy: 27 };

  if (!gateOpen) {
    return (
      <SymbolWrap cx={center.cx} cy={center.cy} muted>
        <rect x={-5} y={-2} width={10} height={8} rx={1.5} fill="none" />
        <path d="M -4 -2 v -3 a 4 4 0 0 1 8 0 v 3" fill="none" />
      </SymbolWrap>
    );
  }

  const icons: Record<NodeId, ReactNode> = {
    puff: (
      <>
        <circle cx={0} cy={0} r={5.5} fill="none" />
        <path d="M0 -8v16M-8 0h16" fill="none" />
      </>
    ),
    bottle: <path d="M-3 -7h6v3c0 2-5 2-5 5v7h-2v-7c0-3-5-3-5-5v-3h6" fill="none" />,
    flask: (
      <>
        <path d="M-3 -8h6v4l5 10H-8l5-10v-4" fill="none" />
        <path d="M-5 6h10" fill="none" />
      </>
    ),
    reservoir: (
      <>
        <path d="M-7 4h14M-7 0h14M-7 -4h14" fill="none" />
        <rect x={-5} y={-9} width={10} height={4} rx={1} fill="none" />
      </>
    ),
    linger: (
      <>
        <path d="M-6 -6h12v12H-6z" fill="none" />
        <path d="M-2 -2v5M2 -4v7" fill="none" />
      </>
    ),
    glacier: (
      <>
        <path d="M0 -9L7 7H-7L0 -9z" fill="none" />
        <path d="M-3 2h6M-1 -2h2" fill="none" />
      </>
    ),
    drizzle: <path d="M0 -7c2 4 3 6 3 8a3 3 0 1 1-6 0c0-2 1-4 3-8z" fill="none" />,
    specks: (
      <>
        <circle cx={-5} cy={-3} r={1.8} />
        <circle cx={4} cy={-5} r={1.8} />
        <circle cx={0} cy={4} r={1.8} />
      </>
    ),
    mist: (
      <>
        <path d="M-8 0q4-4 8 0t8 0" fill="none" />
        <path d="M-8 5q4-4 8 0t8 0" fill="none" />
      </>
    ),
    soak: (
      <>
        <ellipse cx={0} cy={4} rx={8} ry={2.5} fill="none" />
        <path d="M0 -7c2 3 3 6 3 8a3 3 0 1 1-6 0c0-2 1-5 3-8z" fill="none" />
      </>
    ),
    downpour: (
      <>
        <path d="M-3 -8h6v2H-3z" fill="none" />
        <path d="M-5 0l2 6M0 -1l2 7M5 0l2 6" fill="none" />
      </>
    ),
    reach: (
      <>
        <circle cx={0} cy={0} r={7} fill="none" />
        <circle cx={0} cy={0} r={2.5} />
      </>
    ),
    circle: (
      <>
        <circle cx={0} cy={0} r={8} fill="none" />
        <circle cx={0} cy={0} r={4} fill="none" />
      </>
    ),
    wide: (
      <>
        <ellipse cx={0} cy={0} rx={10} ry={6} fill="none" />
        <ellipse cx={0} cy={0} rx={5} ry={3} fill="none" />
      </>
    ),
    horizon: (
      <>
        <path d="M-10 4h20" fill="none" />
        <path d="M-8 0h16M-5 -4h10" fill="none" />
      </>
    ),
    charm: <path d="M0 7C-8-2-8-8 0-4c8-4 8 2 0 11z" fill="none" />,
    dew: (
      <>
        <path d="M0 -7c2 3 3 6 3 8a3 3 0 1 1-6 0c0-2 1-4 3-8z" fill="none" />
        <path d="M6 -5l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" fill="none" strokeWidth={1.2} />
      </>
    ),
    bounty: (
      <>
        <circle cx={0} cy={0} r={7} fill="none" />
        <path d="M0 -4v8M-4 0h8" fill="none" />
      </>
    ),
    crit: <path d="M0 -9l2 6h6l-5 4 2 6-5-4-5 4 2-6-5-4h6z" fill="none" />,
    sprinkler: (
      <>
        <circle cx={0} cy={0} r={3} fill="none" />
        <path d="M0 -8v4M0 4v4M-8 0h4M4 0h4" fill="none" />
      </>
    ),
    spin: (
      <>
        <path d="M6 -6A8 8 0 0 1 6 6" fill="none" />
        <path d="M6 6l-3-1 1-3" fill="none" />
      </>
    ),
    lightning: <path d="M3 -9L-4 2h5l-2 9 9-11h-5z" fill="none" />,
    zap: (
      <>
        <path d="M3 -8L-3 1h4l-2 7 6-9h-4z" fill="none" transform="translate(-3 0) scale(0.9)" />
        <path d="M3 -8L-3 1h4l-2 7 6-9h-4z" fill="none" transform="translate(3 0) scale(0.9)" />
      </>
    ),
    tornado: (
      <>
        <path d="M-8 -6q8 4 0 8t0 8" fill="none" />
        <path d="M-5 -2q5 3 0 6" fill="none" />
      </>
    ),
    twist: (
      <>
        <path d="M-7 -7c10 4 10 14 0 18" fill="none" />
        <path d="M7 7c-10-4-10-14 0-18" fill="none" />
      </>
    ),
  };

  return (
    <SymbolWrap cx={center.cx} cy={center.cy} muted={muted}>
      {icons[id]}
    </SymbolWrap>
  );
}

export function TreeNodeCloud({
  node,
  picked,
  onPick,
}: {
  node: TreeNodeView;
  picked: boolean;
  onPick: () => void;
}) {
  const state = nodeVisual(node);
  const shape = nodeShape(node.branch);
  const branchColor = BRANCH_COLORS[node.branch];
  const { w, h } = nodeSize(node, shape);
  const gateOpen = node.kind !== 'gate' || node.level > 0;
  const mutedIcon = state === 'ghost' || state === 'locked';
  const badge = stateLabel(state);
  const showRank = node.max > 1 && !node.maxed;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onPick();
      }}
      className={`tree-node tree-node--${state} tree-node--${shape}${picked ? ' tree-node--picked' : ''}${node.id === 'puff' ? ' tree-node--center' : ''}`}
      style={{
        left: node.x,
        top: node.y,
        width: w,
        height: h,
        ['--node-color' as string]: node.color,
        ['--branch-color' as string]: branchColor,
      }}
      aria-label={node.name}
    >
      {shape === 'cloud' ? (
        <svg className="tree-node__svg" viewBox="0 0 72 48" aria-hidden>
          <path className="tree-node__body tree-node__cloud" d={CLOUD} />
          <NodeSymbol id={node.id} gateOpen={gateOpen && state !== 'ghost'} shape="cloud" muted={mutedIcon} />
        </svg>
      ) : (
        <svg className="tree-node__svg tree-node__svg--drop" viewBox="0 0 48 60" aria-hidden>
          <path className="tree-node__body tree-node__drop" d={DROP} />
          <ellipse className="tree-node__shine" cx={18} cy={16} rx={6} ry={4} />
          <NodeSymbol id={node.id} gateOpen={gateOpen && state !== 'ghost'} shape="drop" muted={mutedIcon} />
        </svg>
      )}
      {badge && (
        <span className={`tree-node__badge tree-node__badge--${state === 'ghost' ? 'locked' : state}`}>{badge}</span>
      )}
      {showRank && <span className="tree-node__rank">{node.level}/{node.max}</span>}
    </button>
  );
}
