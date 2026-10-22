import type { ReactNode } from 'react';
import type { Branch, NodeId, TreeNodeView } from '../game/tree';
import { BRANCH_COLORS } from '../game/tree';

const CLOUD =
  'M18 36c-5 0-9-4-9-9 0-4 2-7 6-8-1-6 5-10 11-10 3 0 6 1 8 4 2-1 4-2 6-2 6 0 11 4 11 10 0 1 0 2-1 3 4 2 7 6 7 11 0 7-6 12-13 12H22c-7 0-13-5-13-11z';

const DROP =
  'M24 2c-11 0-15 11-15 22 0 14 15 34 15 34s15-20 15-34C39 13 35 2 24 2z';

type NodeShape = 'cloud' | 'drop';
type Visual = 'ghost' | 'maxed' | 'ready' | 'owned' | 'locked';

/** Rain and fortune read as drops; everything else is a little cloud. */
function nodeShape(branch: Branch): NodeShape {
  if (branch === 'rain' || branch === 'fortune') return 'drop';
  return 'cloud';
}

function nodeVisual(node: TreeNodeView): Visual {
  if (node.ghost) return 'ghost';
  if (node.maxed) return 'maxed';
  if (node.afford) return 'ready';
  if (node.level > 0) return 'owned';
  if (!node.visible) return 'ghost';
  return 'locked';
}

function stateLabel(node: TreeNodeView): string | null {
  if (node.worldReq != null) return `World ${node.worldReq + 1}`;
  if (node.afford) return 'Buy';
  if (node.ghost || !node.visible) return 'Locked';
  if (node.maxed) return 'Max';
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
  const paper = muted ? '#e4e7f0' : '#fffdf8';
  const ink = muted ? '#4e5566' : '#241c30';
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <circle className="tree-node__icon-plate" r={14.5} />
      <g fill={paper} stroke={ink} strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round">
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
        <rect x={-5} y={-1.5} width={10} height={8} rx={1.6} />
        <path d="M-3.6 -1.5v-2.6a3.6 3.6 0 0 1 7.2 0v2.6" fill="none" strokeWidth={1.7} />
      </SymbolWrap>
    );
  }

  const icons: Record<NodeId, ReactNode> = {
    puff: (
      <>
        <circle cx={0} cy={0} r={3.1} />
        <path d="M0 -8.2v3.2M0 5v3.2M-8.2 0h3.2M5 0h3.2" fill="none" strokeWidth={2.4} />
      </>
    ),
    bottle: <path d="M-2.2 -8h4.4v2.6h1.8v1.6h-8v-1.6h1.8zM-4.2 -2.2h8.4v9.2h-8.4z" />,
    flask: (
      <>
        <path d="M-2.4 -8h4.8v2.4l4.6 9.2h-14z" />
        <path d="M-5.2 3.4h10.4" fill="none" stroke="#241c30" strokeWidth={1.3} />
      </>
    ),
    reservoir: (
      <>
        <rect x={-6.4} y={-2.2} width={12.8} height={8.6} rx={1.4} />
        <rect x={-3.4} y={-6.6} width={6.8} height={3.2} rx={0.8} />
        <path d="M-4.6 1.2h9.2M-4.6 3.6h9.2" fill="none" stroke="#241c30" strokeWidth={1.2} />
      </>
    ),
    linger: <path d="M-6.2 -7.4h12.4L1.1 0 6.2 7.4h-12.4L-1.1 0z" />,
    glacier: (
      <>
        <path d="M0 -8.2L6.4 0 0 8.2-6.4 0z" />
        <path d="M0 -4.2v8.4M-3.2 0h6.4" fill="none" stroke="#241c30" strokeWidth={1.2} />
      </>
    ),
    drizzle: <path d="M0 -8c2.4 4.2 4.2 6.4 4.2 8.2a4.2 4.2 0 1 1-8.4 0C-4.2 -1.6-2.4 -3.8 0 -8z" />,
    specks: (
      <>
        <circle cx={-4.4} cy={-3.2} r={2.3} />
        <circle cx={3.6} cy={-4.4} r={1.7} />
        <circle cx={1.2} cy={3.4} r={2.6} />
      </>
    ),
    mist: (
      <>
        <path d="M-8 -2.4c2.2-2.6 4.2-2.6 6.2 0s4 2.6 6.2 0" fill="none" strokeWidth={2.3} />
        <path d="M-8 2.2c2.2-2.6 4.2-2.6 6.2 0s4 2.6 6.2 0" fill="none" strokeWidth={2.3} />
      </>
    ),
    soak: (
      <>
        <ellipse cx={0} cy={5.4} rx={7.4} ry={2.5} />
        <path d="M0 -8c1.8 3.2 3.2 5 3.2 6.6a3.2 3.2 0 1 1-6.4 0C-3.2 -3-1.8 -4.8 0 -8z" />
      </>
    ),
    downpour: (
      <>
        <path d="M-7.4 -6.4h14.8v3.4h-14.8z" />
        <path d="M-4.6 -1.2c.8 2.4 1.4 3.6 1.4 4.6a1.4 1.4 0 1 1-2.8 0c0-1 .6-2.2 1.4-4.6z" />
        <path d="M0 -2.2c.8 2.4 1.4 3.6 1.4 4.6a1.4 1.4 0 1 1-2.8 0c0-1 .6-2.2 1.4-4.6z" />
        <path d="M4.6 -1.2c.8 2.4 1.4 3.6 1.4 4.6a1.4 1.4 0 1 1-2.8 0c0-1 .6-2.2 1.4-4.6z" />
      </>
    ),
    flow: (
      <>
        <path d="M-5 -7.6c1.2 3 1.6 5 1.6 6.4a1.6 1.6 0 1 1-3.2 0c0-1.4.4-3.4 1.6-6.4z" />
        <path d="M0 -7.6c1.2 3 1.6 5 1.6 6.4a1.6 1.6 0 1 1-3.2 0c0-1.4.4-3.4 1.6-6.4z" />
        <path d="M5 -7.6c1.2 3 1.6 5 1.6 6.4a1.6 1.6 0 1 1-3.2 0c0-1.4.4-3.4 1.6-6.4z" />
      </>
    ),
    spring: (
      <>
        <path d="M0 7.4V1.2" fill="none" strokeWidth={2} />
        <path d="M0 1.2C-5.4 1.2-6.6 -4.2-2.2 -5.2-2.2 -2.2 0 1.2 0 1.2 0 1.2 2.2 -2.2 2.2 -5.2 6.6 -4.2 5.4 1.2 0 1.2z" />
        <ellipse cx={0} cy={7.2} rx={6.4} ry={1.7} />
      </>
    ),
    reach: (
      <path
        fillRule="evenodd"
        d="M0 -7.2a7.2 7.2 0 1 0 0.01 0zM0 -3.1a3.1 3.1 0 1 1 -0.01 0z"
      />
    ),
    circle: (
      <>
        <circle cx={0} cy={0} r={7} />
        <circle cx={0} cy={0} r={3.3} fill="#241c30" stroke="none" />
      </>
    ),
    wide: <ellipse cx={0} cy={0} rx={8.2} ry={4.4} />,
    horizon: (
      <>
        <path d="M-6.4 2.4a6.4 6.4 0 0 1 12.8 0z" />
        <rect x={-8.2} y={2.6} width={16.4} height={2.3} rx={1} />
      </>
    ),
    waterbomb: (
      <>
        <circle cx={0} cy={1.4} r={5.4} />
        <rect x={-0.9} y={-8} width={1.8} height={3.2} rx={0.6} />
        <circle cx={2.4} cy={-6.2} r={1.5} />
      </>
    ),
    mirage: (
      <>
        <path d="M-8 -2.2c2.2-2.4 4-2.4 6.2 0s4 2.4 6.2 0" fill="none" strokeWidth={2.4} />
        <path d="M-8 2.8c2.2-2.4 4-2.4 6.2 0s4 2.4 6.2 0" fill="none" strokeWidth={2.4} />
      </>
    ),
    tide: (
      <path d="M-8.4 1.2c1.6-3.2 3.4-3.2 5 0s3.4 3.2 5 0 3.4-3.2 5 0v5.4H-8.4z" />
    ),
    charm: <path d="M0 6.6C-6.6 -1.2-6.4 -7.2 0 -3.6 6.4 -7.2 6.6 -1.2 0 6.6z" />,
    dew: (
      <>
        <path d="M-1.2 -6.4c1.8 3.2 3.2 5 3.2 6.6a3.2 3.2 0 1 1-6.4 0c0-1.6 1.4-3.4 3.2-6.6z" />
        <path d="M5.2 -6.6l1 2.4 2.4 1-2.4 1-1 2.4-1-2.4-2.4-1 2.4-1z" />
      </>
    ),
    bounty: (
      <>
        <circle cx={0} cy={0} r={6.6} />
        <path d="M0 -3.4v6.8M-3.4 0h6.8" fill="none" stroke="#241c30" strokeWidth={1.6} />
      </>
    ),
    crit: <path d="M0 -8.2l1.8 5.2h5.4l-4.4 3.4 1.7 5.2L0 2.6l-4.5 3 1.7-5.2-4.4-3.4h5.4z" />,
    harvest: (
      <path d="M0 7.2V0C-6.4 0-7.6 -6.2-2.4 -7.4-2.4 -3.2 0 0 0 0 0 0 2.4 -3.2 2.4 -7.4 7.6 -6.2 6.4 0 0 0z" />
    ),
    purify: (
      <>
        <path d="M0 -7.6c2.2 3.6 3.8 5.6 3.8 7.4a3.8 3.8 0 1 1-7.6 0c0-1.8 1.6-3.8 3.8-7.4z" />
        <path d="M0 -1.4v5.2M-2.4 1.2h4.8" fill="none" stroke="#241c30" strokeWidth={1.4} />
      </>
    ),
    sprinkler: (
      <>
        <circle cx={0} cy={0} r={2.5} />
        <circle cx={0} cy={-6.4} r={1.7} />
        <circle cx={0} cy={6.4} r={1.7} />
        <circle cx={-6.4} cy={0} r={1.7} />
        <circle cx={6.4} cy={0} r={1.7} />
      </>
    ),
    spin: (
      <>
        <path d="M6.4 -2.2A6.6 6.6 0 1 0 2.2 6.4" fill="none" strokeWidth={2.3} />
        <path d="M6.6 1.2L2.2 6.4 7.6 7.2z" />
      </>
    ),
    drone: (
      <>
        <ellipse cx={-3.6} cy={0.4} rx={4.2} ry={2.7} />
        <ellipse cx={3.8} cy={-1.2} rx={3.4} ry={2.2} />
        <path d="M-3.6 3v2.6M3.8 1v2.6" fill="none" strokeWidth={1.6} />
      </>
    ),
    lightning: <path d="M2.6 -8.2L-3.6 1.2h4.2L-1.2 8.2 6.4 -1.6H2.2z" />,
    zap: (
      <>
        <path d="M-1.4 -7.4L-5.2 0h2.8l-1.4 5.6 4.6-6.4H-1z" />
        <path d="M4.2 -5.6L0.6 1.2h2.6L2 6.2l4.2-5.8H4.6z" />
      </>
    ),
    tornado: <path d="M-7.2 -7.2h14.4l-2.6 4.2h-9.2l2.2 3.6H-4.2L-2.4 4.2h4.8L0 8.2z" />,
    twist: (
      <>
        <path d="M-6.4 -7.2c8 2.4 8 8.4 0 11" fill="none" strokeWidth={2.3} />
        <path d="M6.4 7.2c-8 -2.4-8 -8.4 0 -11" fill="none" strokeWidth={2.3} />
      </>
    ),
    geyser: (
      <>
        <ellipse cx={0} cy={5.6} rx={6.6} ry={2.2} />
        <path d="M-2.2 4.8L0 -7.6 2.2 4.8z" />
        <path d="M-4.6 -1.2L0 -6.4 4.6 -1.2" fill="none" strokeWidth={1.6} />
      </>
    ),
    spore: (
      <>
        <circle cx={0} cy={0} r={3.1} />
        <circle cx={0} cy={-6.2} r={1.5} />
        <circle cx={5.4} cy={-3.1} r={1.5} />
        <circle cx={5.4} cy={3.1} r={1.5} />
        <circle cx={0} cy={6.2} r={1.5} />
        <circle cx={-5.4} cy={3.1} r={1.5} />
        <circle cx={-5.4} cy={-3.1} r={1.5} />
      </>
    ),
    rainbow: (
      <>
        <path d="M-8 4.2a8 8 0 0 1 16 0" fill="none" strokeWidth={2.5} />
        <path d="M-4.6 4.2a4.6 4.6 0 0 1 9.2 0" fill="none" strokeWidth={2.2} />
      </>
    ),
    hail: (
      <>
        <path d="M-4.6 -6.4l2.3 3.6-2.3 3.6-2.3-3.6z" />
        <path d="M4.8 -4.2l2.1 3.2-2.1 3.2-2.1-3.2z" />
        <path d="M0 1.2l2.3 3.6L0 8.4l-2.3-3.6z" />
      </>
    ),
    monsoon: (
      <>
        <path d="M-7.2 -1.2a3.4 3.4 0 0 1 3.2-4.2 3.6 3.6 0 0 1 6.6 1.2 3 3 0 0 1 2.6 3.2z" />
        <path d="M-4.2 2.4c.7 2 1.2 3 1.2 3.8a1.2 1.2 0 1 1-2.4 0c0-.8.5-1.8 1.2-3.8z" />
        <path d="M0 1.6c.7 2 1.2 3 1.2 3.8a1.2 1.2 0 1 1-2.4 0c0-.8.5-1.8 1.2-3.8z" />
        <path d="M4.2 2.4c.7 2 1.2 3 1.2 3.8a1.2 1.2 0 1 1-2.4 0c0-.8.5-1.8 1.2-3.8z" />
      </>
    ),
    blush: (
      <>
        <circle cx={-3.6} cy={1.4} r={2.3} />
        <circle cx={3.6} cy={1.4} r={2.3} />
        <path d="M-3.2 -4.2c2-2.6 4.4-2.6 6.4 0" fill="none" strokeWidth={1.7} />
      </>
    ),
    bow: <path d="M0 -0.4C-7.4 -6.4-8.4 4.2 0 -0.4 8.4 4.2 7.4 -6.4 0 -0.4zM-1.3 -3.4h2.6v6.8h-2.6z" />,
    trail: (
      <>
        <path d="M-3.2 -7.4c1.4 2.6 2.2 4.2 2.2 5.4a2.2 2.2 0 1 1-4.4 0c0-1.2.8-2.8 2.2-5.4z" />
        <path d="M3.4 -2.2c1.4 2.6 2.2 4.2 2.2 5.4a2.2 2.2 0 1 1-4.4 0c0-1.2.8-2.8 2.2-5.4z" />
      </>
    ),
    buddy: (
      <>
        <circle cx={0} cy={1.2} r={4.6} />
        <circle cx={-4.6} cy={-2.6} r={2} />
        <circle cx={4.6} cy={-2.6} r={2} />
        <circle cx={-1.6} cy={0.6} r={0.7} fill="#241c30" stroke="none" />
        <circle cx={1.6} cy={0.6} r={0.7} fill="#241c30" stroke="none" />
      </>
    ),
    sparkle: <path d="M0 -8.4l1.6 5.2 5.6 1.6-5.6 1.6L0 8.4l-1.6-5.2L-7.2 -1.6l5.6-1.6z" />,
    hum: (
      <>
        <path d="M-1.2 4.8V-5.2l7.2-2.2v7.6" fill="none" strokeWidth={1.8} />
        <circle cx={-3.2} cy={5.6} r={2.3} />
        <circle cx={4.2} cy={-0.6} r={2.3} />
      </>
    ),
    press: (
      <>
        <path d="M0 7.6V1.4" fill="none" strokeWidth={1.8} />
        <path d="M0 1.4C-6.2 1.4-7.2 -5.2-2.2 -6.2-2.2 -2.4 0 1.4 0 1.4 0 1.4 2.2 -2.4 2.2 -6.2 7.2 -5.2 6.2 1.4 0 1.4z" />
        <path d="M-6.4 7.4h12.8" fill="none" strokeWidth={1.8} />
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
  reveal,
  buyPop,
  affordPing,
  onRevealEnd,
  onAffordPingEnd,
  onPick,
  onBuy,
  ignoreTap,
}: {
  node: TreeNodeView;
  picked: boolean;
  reveal?: boolean;
  buyPop?: number;
  affordPing?: boolean;
  onRevealEnd?: () => void;
  onAffordPingEnd?: () => void;
  onPick: () => void;
  onBuy: () => void;
  /** True when the player was panning — ignore tap-to-select. */
  ignoreTap?: () => boolean;
}) {
  const state = nodeVisual(node);
  const shape = nodeShape(node.branch);
  const branchColor = BRANCH_COLORS[node.branch];
  const { w, h } = nodeSize(node, shape);
  const gateOpen = node.kind !== 'gate' || node.level > 0 || node.afford;
  const mutedIcon = state === 'ghost' || state === 'locked';
  const badge = stateLabel(node);
  const showRank = node.max > 1 && !node.maxed;

  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPick();
        }
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (ignoreTap?.()) return;
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
      {affordPing && (
        <span
          className="workshop-afford-aura"
          aria-hidden
          onAnimationEnd={onAffordPingEnd}
        />
      )}
      <div
        className={`tree-node__inner${reveal ? ' tree-node__inner--reveal' : ''}${buyPop ? ' tree-node__inner--buy' : ''}${affordPing ? ' tree-node__inner--ping' : ''}`}
        key={buyPop ? `buy-${buyPop}` : undefined}
        onAnimationEnd={() => {
          if (reveal) onRevealEnd?.();
        }}
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
      </div>
      {badge && (
        <span
          role={state === 'ready' ? 'button' : undefined}
          tabIndex={state === 'ready' ? 0 : undefined}
          className={`tree-node__badge tree-node__badge--${state === 'ghost' ? 'locked' : state}${
            node.worldReq != null ? ' tree-node__badge--world' : ''
          }`}
          onClick={(e) => {
            e.stopPropagation();
            if (state === 'ready') onBuy();
          }}
          onKeyDown={(e) => {
            if (state === 'ready' && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              e.stopPropagation();
              onBuy();
            }
          }}
        >
          {badge}
        </span>
      )}
      {showRank && <span className="tree-node__rank">{node.level}/{node.max}</span>}
    </div>
  );
}
