#!/usr/bin/env python3
"""Bloom pacing: is the rare currency rare enough, and rich enough?

Blooms are earned one per tenth of an island you restore, plus one when the
island comes back to life. Ten per island, fifty over the campaign. This report
plays the campaign and shows what the bloom wallet looks like, what it buys and
what the player has to skip.
"""
from __future__ import annotations

from game_constants import BLOOM_COSTS, COSTS, PRIORITY_UNIQUE
from sim import WORLD_NAMES, cells_per_run, island_blooms, mask_count, new_state, next_buy

# Everything the bloom wallet can buy, in the order the tree offers it.
BLOOM_NODES = [
    node
    for node in PRIORITY_UNIQUE
    if any(BLOOM_COSTS[node][i] > 0 for i in range(len(BLOOM_COSTS[node])))
]


def main() -> None:
    state = new_state()
    dew = 0.0
    blooms = 0.0
    awarded = 0
    unlocked = 0
    total_blooms = 0
    print("=== BLOOM PACING (whole campaign, greedy shop) ===")
    print("island  blooms earned  banked  spent  still open")
    for world in range(len(WORLD_NAMES)):
        total = mask_count(world)
        restored = 0.0
        for _ in range(1200):
            ratio = restored / total if total else 0.0
            cells, income, _seconds = cells_per_run(state, world, ratio)
            restored = min(float(total), restored + cells)
            dew += income
            earned = island_blooms(restored, total)
            if earned > awarded:
                blooms += earned - awarded
                awarded = earned
            while True:
                node, cost, bloom_cost = next_buy(state, dew, blooms, max(unlocked, world))
                if node is None:
                    break
                dew -= cost
                blooms -= bloom_cost
                state[node] += 1
            if total <= 0 or restored / total >= 0.98:
                break
        unlocked = max(unlocked, world)
        spent = sum(BLOOM_COSTS[node][i] for node in BLOOM_NODES for i in range(state[node]))
        open_nodes = []
        for node in BLOOM_NODES:
            level = state[node]
            if level < len(BLOOM_COSTS[node]) and BLOOM_COSTS[node][level] > 0:
                open_nodes.append(f"{node}#{level}({BLOOM_COSTS[node][level]})")
        total_blooms += spent
        print(
            f"{WORLD_NAMES[world]:10}  {awarded:13}  {blooms:7.0f}  {spent:5}  "
            f"{' '.join(open_nodes[:6]) if open_nodes else 'nothing'}"
        )
    print(f"\nblooms spent over the campaign: {total_blooms}")
    print("bloom-only nodes cost no dew: they are the reward for restoring land")


if __name__ == "__main__":
    main()
