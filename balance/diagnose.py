#!/usr/bin/env python3
"""Upgrade cadence, power curve, gate shocks, restoration (Chimney Fisher style).

    python balance/diagnose.py --runs 60 --max-buys 1

Tracks both wallets so bloom-starved stalls show up as dead zones too.
"""
from __future__ import annotations

import argparse

from game_constants import bottle_seconds, max_liters, rain_radius, soak_per_tick
from sim import buy_all_affordable, cells_per_run, mask_count, new_state

GATE_NODES = ("bottle", "drizzle", "reach", "charm")


def run_campaign(runs: int, max_buys_per_run: int):
    state = new_state()
    dew = 0.0
    blooms = 0.0
    restored = 0.0
    total = mask_count(0)
    history = []
    purchases: list[tuple[int, str, int]] = []

    prev_land = 0.0
    for run in range(1, runs + 1):
        filled_ratio = restored / total
        cells, gained, seconds = cells_per_run(state, 0, filled_ratio)
        restored += cells
        land_pct = restored / total
        dew += gained
        blooms += cells
        dew, blooms, bought = buy_all_affordable(state, dew, blooms, 0, max_buys=max_buys_per_run)
        for tag in bought:
            node = tag.rstrip("0123456789")
            lvl = state[node]
            purchases.append((run, node, lvl))
        history.append(
            {
                "run": run,
                "dew": gained,
                "bank": dew,
                "blooms": blooms,
                "land_pct": land_pct,
                "land_delta": (land_pct - prev_land) * 100,
                "radius": rain_radius(state),
                "liters": max_liters(state),
                "bottle_s": bottle_seconds(state),
                "soak": soak_per_tick(state),
                "bought": bought,
            }
        )
        prev_land = land_pct

    return state, history, purchases


def dead_zones(runs: int, purchased_runs: set[int]) -> list[tuple[int, int]]:
    zones = []
    in_dead = False
    dead_start = 0
    for r in range(1, runs + 1):
        if r not in purchased_runs and not in_dead:
            in_dead = True
            dead_start = r
        elif r in purchased_runs and in_dead:
            if r - dead_start >= 3:
                zones.append((dead_start, r - 1))
            in_dead = False
    return zones


def gate_shocks(purchases: list[tuple[int, str, int]], history: list[dict]) -> None:
    print("\n  gate shock (land delta %/run, 3 before vs 3 after first rank-1 buy):")
    by_run = {h["run"]: h for h in history}
    for gate in GATE_NODES:
        unlock_run = next((r for r, n, lvl in purchases if n == gate and lvl == 1), None)
        if unlock_run is None:
            print(f"    {gate:8} not unlocked in sim window")
            continue
        before = [by_run[r]["land_delta"] for r in range(max(1, unlock_run - 3), unlock_run) if r in by_run]
        after = [by_run[r]["land_delta"] for r in range(unlock_run, unlock_run + 3) if r in by_run]
        if not before or not after:
            continue
        b = sum(before) / len(before)
        a = sum(after) / len(after)
        flag = "DIP" if a < b * 0.85 else "ok"
        print(f"    {gate:8} run {unlock_run:3}  dLand {b:5.2f}% -> {a:5.2f}%  [{flag}]")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--runs", type=int, default=60)
    parser.add_argument("--max-buys", type=int, default=1)
    args = parser.parse_args()

    state, history, purchases = run_campaign(args.runs, args.max_buys)
    purchased_runs = {r for r, _, _ in purchases}
    zones = dead_zones(args.runs, purchased_runs)
    land_curve = [h["land_pct"] * 100 for h in history]

    print("=" * 76)
    print(f"  PROGRESSION DIAGNOSTIC  (world 0, {args.runs} runs, max {args.max_buys} buy/run)")
    print("=" * 76)
    print(f"  upgrades bought     : {len(purchases)}")
    print(f"  land restored       : {land_curve[-1]:.1f}%")
    print(f"  dead zones (3+ runs): {zones[:5] or 'none'}")
    early_dead = [z for z in zones if z[0] <= 30]
    if early_dead:
        print(f"  WARNING early dead  : {early_dead}")

    print("\n  power sample (first 12 runs):")
    print("  run   dew  bank  blooms  dLand%  radius  liters  bottle_s  soak  bought")
    for h in history[:12]:
        print(
            f"  {h['run']:3}  {h['dew']:4.0f}  {h['bank']:4.0f}  {h['blooms']:6.0f}  {h['land_delta']:6.2f}  "
            f"{h['radius']:5.2f}  {h['liters']:5.0f}L  {h['bottle_s']:6.1f}s  {h['soak']:4.2f}  "
            f"{','.join(h['bought']) if h['bought'] else '-'}"
        )

    print("\n  land % spark (each char ~1 run):")
    blocks = " .:-=+*#"
    vals = land_curve
    mn, mx = min(vals), max(vals) or 1
    width = min(60, len(vals))
    step = len(vals) / width
    spark = "".join(
        blocks[min(7, int((vals[int(i * step)] - mn) / max(0.001, mx - mn) * 7))] for i in range(width)
    )
    print(f"  {spark}")

    gate_shocks(purchases, history)

    print("\n  last 12 purchases:")
    for run, node, lvl in purchases[-12:]:
        print(f"    run {run:3}: {node} -> {lvl}")


if __name__ == "__main__":
    main()
