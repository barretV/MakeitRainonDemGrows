#!/usr/bin/env python3
"""Early-run dopamine: purchases, power jumps, and restoration per bottle (world 0)."""
from __future__ import annotations

from game_constants import OVERHEAD_SEC, bottle_seconds, cloud_scale, max_liters, rain_radius
from sim import buy_all_affordable, cells_per_run, mask_count, new_state


def early_purchase_report(max_runs: int = 40, max_buys_per_run: int = 1) -> None:
    state = new_state()
    dew = 0.0
    restored = 0.0
    total = mask_count(0)
    dry_streak = 0
    dry_zones: list[tuple[int, int]] = []
    purchases_per_run: list[int] = []

    print(f"=== EARLY RUN FEEL (world 0, {max_buys_per_run} buy/run, {max_runs} runs) ===")
    print("run  dew  bank  +land%  radius  liters  bought")
    for run in range(1, max_runs + 1):
        filled_ratio = restored / total
        cells, gained, seconds = cells_per_run(state, 0, filled_ratio)
        restored += cells
        land_pct = cells / total * 100
        dew += gained
        dew, bought = buy_all_affordable(state, dew, max_buys=max_buys_per_run)
        n = len(bought)
        purchases_per_run.append(n)
        liters = max_liters(state)
        radius = rain_radius(state)
        print(
            f"{run:3}  {gained:4.0f}  {dew:4.0f}  {land_pct:5.2f}%  {radius:5.2f}  {liters:5.0f}L  {','.join(bought) if bought else '-'}"
        )
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
    print(f"restored after {max_runs} runs: {restored / total * 100:.1f}%")
    print(f"dry runs (no buy), first 25: {dry_runs}/25")
    print(f"avg purchases/run (first 25): {avg_buy:.2f}")
    early_zones = [(a, b) for a, b in dry_zones if b <= 25]
    if early_zones:
        print("dry zones in first 25:", ", ".join(f"r{a}-r{b}" for a, b in early_zones))
    else:
        print("dry zones in first 25: none")
    print("target: <=2 dry runs in first 25 ->", "PASS" if dry_runs <= 2 else "FAIL")
    print(f"cloud scale end: {cloud_scale(state):.2f} (start {0.48:.2f})")


def main() -> None:
    early_purchase_report(40, max_buys_per_run=1)


if __name__ == "__main__":
    main()
