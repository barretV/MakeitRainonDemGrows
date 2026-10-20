#!/usr/bin/env python3
"""Verify upgrades.json matches game_constants prereq + priority + currency data."""
from __future__ import annotations

import json
from pathlib import Path

from game_constants import BLOOM_COSTS, COSTS, WORLD_MIN, prereq
from upgrade_loader import build_costs, build_priority_unique, node_ids

ROOT = Path(__file__).resolve().parent


def main() -> None:
    costs = build_costs()
    py_ids = set(costs.keys())
    catalog = json.loads((ROOT / "upgrades.json").read_text(encoding="utf-8"))
    json_ids = {n["id"] for n in catalog["nodes"]}
    if py_ids != json_ids:
        missing = json_ids - py_ids
        extra = py_ids - json_ids
        raise SystemExit(f"FAIL id mismatch missing={missing} extra={extra}")

    state = {k: 0 for k in node_ids()}
    # smoke prereq for each node at level 0
    for nid in node_ids():
        prereq(nid, state)

    priority = build_priority_unique()
    cat_priority = []
    seen = set()
    for x in catalog["priority"]:
        if x not in seen:
            seen.add(x)
            cat_priority.append(x)
    if priority != cat_priority:
        raise SystemExit(f"FAIL priority mismatch\npy={priority}\njson={cat_priority}")

    # dual-currency catalog must be complete: every node has bloom + gate rows.
    for node in catalog["nodes"]:
        nid = node["id"]
        if nid not in BLOOM_COSTS:
            raise SystemExit(f"FAIL {nid}: missing bloom costs")
        if len(BLOOM_COSTS[nid]) != len(node["costs"]):
            raise SystemExit(f"FAIL {nid}: bloom list length {len(BLOOM_COSTS[nid])} != {len(node['costs'])}")
        blooms = node.get("blooms") or []
        if blooms and len(blooms) != len(node["costs"]):
            raise SystemExit(f"FAIL {nid}: raw bloom list {len(blooms)} != costs {len(node['costs'])}")
        gate = int(node.get("worldMin", 0))
        if WORLD_MIN.get(nid) != gate:
            raise SystemExit(f"FAIL {nid}: worldMin mismatch")
        if gate < 0 or gate > 4:
            raise SystemExit(f"FAIL {nid}: worldMin {gate} out of range")

    dual = [n["id"] for n in catalog["nodes"] if n.get("blooms")]
    gated = [n["id"] for n in catalog["nodes"] if n.get("worldMin", 0) > 0]
    print(f"OK upgrades.json synced · {len(costs)} nodes · {len(dual)} dual-currency · {len(gated)} island-gated")
    print(f"   dual: {', '.join(dual)}")
    print(f"   gated: {', '.join(gated)}")


if __name__ == "__main__":
    main()
