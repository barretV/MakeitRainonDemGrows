#!/usr/bin/env python3
"""Runs with no workshop purchase — should be rare in the first ~40 runs."""
from __future__ import annotations

from game_constants import OVERHEAD_SEC
from sim import cells_per_run, new_state, next_buy


def early_purchase_report(max_runs: int = 50) -> None:
    state = new_state()
    dew = 0.0
    dry_streak = 0
    dry_zones: list[tuple[int, int]] = []
    purchases_per_run: list[int] = []

    print(f"=== EARLY RUN FEEL (first {max_runs} runs, world 0) ===")
    print("run   dew/run  bank   bought")
    for run in range(1, max_runs + 1):
        cells, gained, seconds = cells_per_run(state, 0)
        dew += gained
        bought: list[str] = []
        while True:
            node, cost = next_buy(state, dew)
            if node is None:
                break
            dew -= cost
            state[node] += 1
            bought.append(f"{node}{state[node]}")
        n = len(bought)
        purchases_per_run.append(n)
        print(f"{run:3}   {gained:6.1f}  {dew:5.0f}   {','.join(bought) if bought else '-'}")
        if n == 0:
            dry_streak += 1
            if dry_streak == 1:
                zone_start = run
            if dry_streak >= 2:
                dry_zones.append((zone_start, run))
        else:
            dry_streak = 0

    window = purchases_per_run[:25]
    dry_runs = sum(1 for n in window if n == 0)
    avg_buy = sum(window) / len(window)
    print()
    print(f"dry runs (no buy), first 25 runs: {dry_runs}/25")
    print(f"avg purchases/run (first 25): {avg_buy:.2f}")
    early_zones = [(a, b) for a, b in dry_zones if b <= 25]
    if early_zones:
        print("dry zones in first 25:", ", ".join(f"r{a}-r{b}" for a, b in early_zones))
    else:
        print("dry zones in first 25: none")
    print("target: <=2 dry runs in first 25 ->", "PASS" if dry_runs <= 2 else "FAIL")


def main() -> None:
    early_purchase_report(30)


if __name__ == "__main__":
    main()
