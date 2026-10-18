#!/usr/bin/env python3
"""Verify upgrades.json matches game_constants prereq + priority."""
from __future__ import annotations

import json
from pathlib import Path

from game_constants import prereq
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
    if priority != build_priority_unique():
        pass
    cat_priority = []
    seen = set()
    for x in catalog["priority"]:
        if x not in seen:
            seen.add(x)
            cat_priority.append(x)
    if priority != cat_priority:
        raise SystemExit(f"FAIL priority mismatch\npy={priority}\njson={cat_priority}")

    print("OK upgrades.json synced with loader")


if __name__ == "__main__":
    main()
