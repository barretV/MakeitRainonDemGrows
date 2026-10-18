"""Load upgrade costs and priority from balance/upgrades.json (run: npm run dump-upgrades)."""
from __future__ import annotations

import json
from pathlib import Path

_ROOT = Path(__file__).resolve().parent
_CATALOG = _ROOT / "upgrades.json"


def load_catalog() -> dict:
    with _CATALOG.open(encoding="utf-8") as f:
        return json.load(f)


def build_costs() -> dict[str, list[int]]:
    data = load_catalog()
    costs: dict[str, list[int]] = {}
    for node in data["nodes"]:
        costs[node["id"]] = list(node["costs"])
    return costs


def build_priority_unique() -> list[str]:
    data = load_catalog()
    seen: set[str] = set()
    order: list[str] = []
    for node_id in data["priority"]:
        if node_id in seen:
            continue
        seen.add(node_id)
        order.append(node_id)
    return order


def node_ids() -> list[str]:
    return list(load_catalog()["nodeIds"])
