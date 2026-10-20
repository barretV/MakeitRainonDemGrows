#!/usr/bin/env python3
"""Early-run dopamine: purchases, power jumps, and restoration per bottle (world 0).

Checks the "one more run, one more upgrade" cadence: how often a bottle ends with
no affordable upgrade (a dry run) and how many buys a player gets per bottle.
"""
from __future__ import annotations

from game_constants import BLOOM_COSTS, COSTS, OVERHEAD_SEC, bottle_seconds, cloud_scale, max_liters, rain_radius, soak_per_tick
from sim import buy_all_affordable, cells_per_run, island_blooms, mask_count, new_state


def early_purchase_report(max_runs: int = 40, max_buys_per_run: int | None = None) -> None:
    state = new_state()
    dew = 0.0
    blooms = 0.0
    awarded = 0
    total = mask_count(0)
    dry_streak = 0
    dry_zones: list[tuple[int, int]] = []
    purchases_per_run: list[int] = []
    best_cover = 0.0

    label = "shop until the wallet stops" if max_buys_per_run is None else f"{max_buys_per_run} buy/run"
    print(f"=== EARLY RUN FEEL (world 0, saved growth, {label}, {max_runs} runs) ===")
    print("run  dew  bank  blooms  +land%  radius  liters  soak  bought")
    restored = 0.0
    for run in range(1, max_runs + 1):
        cells, gained, seconds = cells_per_run(state, 0, restored / total if total else 0.0)
        restored = min(float(total), restored + cells)
        land_pct = cells / total * 100
        best_cover = max(best_cover, restored / total * 100 if total else 0.0)
        dew += gained
        earned = island_blooms(restored, total)
        if earned > awarded:
            blooms += earned - awarded
            awarded = earned
        dew, blooms, bought = buy_all_affordable(state, dew, blooms, 0, max_buys=max_buys_per_run)
        n = len(bought)
        purchases_per_run.append(n)
        liters = max_liters(state)
        radius = rain_radius(state)
        print(
            f"{run:3}  {gained:4.0f}  {dew:4.0f}  {blooms:6.0f}  {land_pct:5.2f}%  {radius:5.2f}  "
            f"{liters:5.0f}L  {soak_per_tick(state):4.2f}  {','.join(bought) if bought else '-'}"
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
    print(f"best single bottle after {max_runs} runs: {best_cover:.1f}%")
    print(f"dry runs (no buy), first 25: {dry_runs}/25")
    print(f"avg purchases/run (first 25): {avg_buy:.2f}")
    early_zones = [(a, b) for a, b in dry_zones if b <= 25]
    if early_zones:
        print("dry zones in first 25:", ", ".join(f"r{a}-r{b}" for a, b in early_zones))
    else:
        print("dry zones in first 25: none")
    print("target: <=2 dry runs in first 25 ->", "PASS" if dry_runs <= 2 else "FAIL")
    print(f"cloud scale end: {cloud_scale(state):.2f} (start {0.48:.2f})")

    # Where did the wallet go? (both currencies)
    dew_spent = sum(COSTS[k][i] for k in COSTS for i in range(state[k]))
    blooms_spent = sum(BLOOM_COSTS[k][i] for k in COSTS for i in range(state[k]))
    print(f"dew spent {dew_spent:.0f} · blooms spent {blooms_spent:.0f} · blooms banked {blooms:.0f}")
    print(f"bottle time now {bottle_seconds(state):.1f}s")


def main() -> None:
    early_purchase_report(40, max_buys_per_run=None)


if __name__ == "__main__":
    main()
