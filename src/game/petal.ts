/** Meta upgrades bought with lifetime blooms (mask completions). Cosmetic / light buff only. */

export type PetalId = 'blush' | 'bow' | 'trail' | 'buddy' | 'sparkle' | 'hum';

export const PETAL_IDS: readonly PetalId[] = ['blush', 'bow', 'trail', 'buddy', 'sparkle', 'hum'];

export interface PetalNode {
  id: PetalId;
  name: string;
  desc: string;
  max: number;
  costs: readonly number[];
}

export type PetalRanks = Record<PetalId, number>;

const NODES: readonly PetalNode[] = [
  { id: 'blush', name: 'Rosy Cheeks', desc: 'The cloud blushes when it rains.', max: 1, costs: [4] },
  { id: 'bow', name: 'Rain Bow', desc: 'A little ribbon on your fluff.', max: 1, costs: [8] },
  { id: 'trail', name: 'Silver Drops', desc: 'Rain streaks catch the light.', max: 1, costs: [14] },
  { id: 'buddy', name: 'Meadow Friend', desc: '+1 critter wanders the green.', max: 1, costs: [22] },
  { id: 'sparkle', name: 'Bloom Sparkle', desc: 'Tiny glints when tiles pop green.', max: 1, costs: [35] },
  { id: 'hum', name: 'Happy Hum', desc: 'Soft hum while the bottle drains.', max: 1, costs: [50] },
];

export function emptyPetals(): PetalRanks {
  return { blush: 0, bow: 0, trail: 0, buddy: 0, sparkle: 0, hum: 0 };
}

export function petalNode(id: PetalId): PetalNode {
  const n = NODES.find((x) => x.id === id);
  if (!n) throw new Error(`Unknown petal ${id}`);
  return n;
}

export function petalCost(id: PetalId, level: number): number {
  const node = petalNode(id);
  return node.costs[level] ?? node.costs[node.costs.length - 1] ?? 0;
}

export function bloomsSpent(petals: PetalRanks): number {
  let sum = 0;
  for (const id of PETAL_IDS) {
    const node = petalNode(id);
    const lvl = petals[id];
    for (let i = 0; i < lvl; i += 1) sum += node.costs[i] ?? 0;
  }
  return sum;
}

export function spendableBlooms(totalBlooms: number, petals: PetalRanks): number {
  return Math.max(0, totalBlooms - bloomsSpent(petals));
}

export interface PetalNodeView {
  id: PetalId;
  name: string;
  desc: string;
  level: number;
  max: number;
  cost: number;
  afford: boolean;
  owned: boolean;
}

export function buildPetalTree(totalBlooms: number, petals: PetalRanks): PetalNodeView[] {
  const wallet = spendableBlooms(totalBlooms, petals);
  return NODES.map((node) => {
    const level = petals[node.id];
    const maxed = level >= node.max;
    const cost = petalCost(node.id, level);
    return {
      id: node.id,
      name: node.name,
      desc: node.desc,
      level,
      max: node.max,
      cost,
      afford: !maxed && wallet >= cost,
      owned: level > 0,
    };
  });
}

export const PETAL_PRIORITY: readonly PetalId[] = [...PETAL_IDS];
