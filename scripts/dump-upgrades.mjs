import { writeFileSync } from 'node:fs';
import { PRIORITY, allNodes, NODE_IDS } from '../src/game/tree.ts';

const nodes = allNodes().map((n) => ({
  id: n.id,
  parent: n.parent,
  kind: n.kind,
  max: n.max,
  costs: [...n.costs],
}));

const catalog = {
  version: 1,
  nodeIds: [...NODE_IDS],
  priority: [...PRIORITY],
  nodes,
};

writeFileSync('balance/upgrades.json', `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Wrote balance/upgrades.json (${nodes.length} nodes)`);
