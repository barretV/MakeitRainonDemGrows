"""Load upgrade costs, bloom costs, island gates and priority from balance/upgrades.json.

Run: npm run dump-upgrades   (after editing src/game/tree.ts)
"""
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


def build_bloom_costs() -> dict[str, list[int]]:
    """Bloom petals per rank. Empty list / zeros = dew-only node."""
    data = load_catalog()
    blooms: dict[str, list[int]] = {}
    for node in data["nodes"]:
        raw = list(node.get("blooms") or [])
        padded = raw + [0] * (len(node["costs"]) - len(raw))
        blooms[node["id"]] = padded[: len(node["costs"])]
    return blooms


def build_world_min() -> dict[str, int]:
    data = load_catalog()
    return {node["id"]: int(node.get("worldMin", 0)) for node in data["nodes"]}


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


def build_maxes() -> dict[str, int]:
    """How many ranks each node has."""
    data = load_catalog()
    return {node["id"]: int(node["max"]) for node in data["nodes"]}


def node_ids() -> list[str]:
    return list(load_catalog()["nodeIds"])
