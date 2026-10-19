#!/usr/bin/env python3
"""Bloom earn rate vs petal shop costs (world 0, 1 buy/run)."""
from __future__ import annotations

from sim import buy_all_affordable, cells_per_run, mask_count, new_state

# Mirrors src/game/petal.ts: cosmetics, then Pressed Petals ranks.
PETAL_COSTS = [40, 100, 220, 480, 900, 1600, 120, 280, 600, 1200, 2400, 5000, 10000, 18000]


def main() -> None:
    state = new_state()
    dew = 0.0
    restored = 0.0
    total = mask_count(0)
    blooms = 0.0
    print("=== PETAL SHOP PACING (world 0) ===")
    print("run  blooms/run  total  next_petal_cost")
    next_idx = 0
    for run in range(1, 41):
        filled_ratio = restored / total
        cells, gained, _ = cells_per_run(state, 0, filled_ratio)
        restored += cells
        blooms += cells
        dew += gained
        dew, blooms, _ = buy_all_affordable(state, dew, blooms, 0, max_buys=1)
        next_cost = PETAL_COSTS[next_idx] if next_idx < len(PETAL_COSTS) else 0
        if next_cost and blooms >= next_cost:
            blooms -= next_cost
            next_idx += 1
        print(f"{run:3}  {cells:9.1f}  {blooms:5.0f}  {next_cost or '-'}")
    print(f"\nfirst petal (~{PETAL_COSTS[0]} blooms) target: once a bottle finishes a few dozen cells")


if __name__ == "__main__":
    main()
