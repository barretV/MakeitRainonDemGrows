#!/usr/bin/env python3
"""Upgrade cadence + restoration curve (Chimney Fisher style)."""
from __future__ import annotations

import argparse

from game_constants import OVERHEAD_SEC, PRIORITY_UNIQUE
from sim import buy_all_affordable, cells_per_run, mask_count, new_state


def run_campaign(runs: int, max_buys_per_run: int):
    state = new_state()
    dew = 0.0
    restored = 0.0
    total = mask_count(0)
    history = []
    purchases: list[tuple[int, str, int]] = []

    for run in range(1, runs + 1):
        filled_ratio = restored / total
        cells, gained, seconds = cells_per_run(state, 0, filled_ratio)
        restored += cells
        dew += gained
        before = {k: state[k] for k in state}
        dew, bought = buy_all_affordable(state, dew, max_buys=max_buys_per_run)
        for tag in bought:
            node = tag.rstrip("0123456789")
            lvl = state[node]
            purchases.append((run, node, lvl))
        history.append(
            {
                "run": run,
                "dew": gained,
                "bank": dew,
                "land_pct": restored / total,
                "bought": bought,
            }
        )

    return state, history, purchases


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--runs", type=int, default=60)
    parser.add_argument("--max-buys", type=int, default=1)
    args = parser.parse_args()

    state, history, purchases = run_campaign(args.runs, args.max_buys)
    purchased_runs = sorted({r for r, _, _ in purchases})

    dead_zones = []
    run_has = set(purchased_runs)
    in_dead = False
    dead_start = 0
    for r in range(1, args.runs + 1):
        if r not in run_has and not in_dead:
            in_dead = True
            dead_start = r
        elif r in run_has and in_dead:
            if r - dead_start >= 3:
                dead_zones.append((dead_start, r - 1))
            in_dead = False

    land_curve = [h["land_pct"] * 100 for h in history]

    print("=" * 72)
    print(f"  PROGRESSION DIAGNOSTIC  ({args.runs} runs, max {args.max_buys} buy/run)")
    print("=" * 72)
    print(f"  upgrades bought     : {len(purchases)}")
    print(f"  land restored       : {land_curve[-1]:.1f}%")
    print(f"  dead zones (3+ runs): {dead_zones[:5] or 'none'}")
    print()
    print("  land % spark (each char ~1 run):")
    blocks = " .:-=+*#"
    vals = land_curve
    mn, mx = min(vals), max(vals) or 1
    width = min(60, len(vals))
    step = len(vals) / width
    spark = "".join(
        blocks[min(7, int((vals[int(i * step)] - mn) / max(0.001, mx - mn) * 7))] for i in range(width)
    )
    print(f"  {spark}")
    print()
    print("  last 15 purchases:")
    for run, node, lvl in purchases[-15:]:
        print(f"    run {run:3}: {node} -> {lvl}")


if __name__ == "__main__":
    main()
