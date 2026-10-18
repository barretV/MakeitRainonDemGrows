#!/usr/bin/env python3
"""
Greedy bottle campaign with persistent land (mask progress carries between bottles).

  python balance/sim.py
  python balance/sim.py --world 0

Prints runs and minutes until the world hits ~98% restored.
"""
from __future__ import annotations

import argparse

from game_constants import (
    COSTS,
    MAXED,
    OVERHEAD_SEC,
    PRIORITY_UNIQUE,
    TILE,
    WORLDS,
    bottle_seconds,
    crit_chance,
    dew_multiplier,
    patch_fraction,
    prereq,
    rain_radius,
    soak_per_tick,
)


def new_state():
    return {key: 0 for key in COSTS}


def mask_count(world: int) -> int:
    _, _, mc, mr, _, _ = WORLDS[world]
    return mc * mr


def cells_per_run(state, world: int, filled_ratio: float = 0.0):
    """New mask cells finished this bottle; land persists between runs."""
    cols, rows, mc, mr, hp, pay = WORLDS[world]
    cell_area = (cols * TILE / mc) * (rows * TILE / mr)
    radius = rain_radius(state)
    disc = 3.1415926535 * radius * radius / cell_area
    wet = max(1.0, disc * patch_fraction(state))
    # Less untouched land under the cloud as the island greens.
    untouched = max(0.08, 1.0 - filled_ratio * 0.92)
    wet *= untouched
    seconds = bottle_seconds(state)
    ticks = seconds / 0.1
    soak_on_cell = ticks * soak_per_tick(state)
    mult = dew_multiplier(state)
    crit = 1 + crit_chance(state) * 2
    if soak_on_cell >= hp:
        cells = wet
        dew = cells * pay * mult * crit
    else:
        frac = soak_on_cell / hp
        cells = wet * frac
        dew = wet * frac * pay * mult * 0.22
    if state["sprinkler"] >= 1:
        bonus = (14 + state["spin"] * 8) * (seconds / 11)
        cells += bonus
        dew += bonus * pay * mult * crit
    if state["lightning"] >= 1:
        bonus = (18 + state["zap"] * 12) * (seconds / 16)
        cells += bonus
        dew += bonus * pay * mult * crit
    if state["tornado"] >= 1:
        bonus = (5 + state["twist"] * 3) * (3.4 / 0.12)
        cells += bonus
        dew += bonus * pay * mult * crit
    remaining = mask_count(world) * (1.0 - filled_ratio)
    cells = min(remaining, cells)
    return cells, dew, seconds


def next_buy(state, dew):
    for node in PRIORITY_UNIQUE:
        level = state[node]
        if level >= MAXED[node]:
            continue
        if not prereq(node, state):
            continue
        cost = COSTS[node][level]
        if dew >= cost:
            return node, cost
    return None, 0


def buy_all_affordable(state, dew, max_buys: int | None = None):
    bought = []
    while True:
        if max_buys is not None and len(bought) >= max_buys:
            break
        node, cost = next_buy(state, dew)
        if node is None:
            break
        dew -= cost
        state[node] += 1
        bought.append(f"{node}{state[node]}")
    return dew, bought


def clear_world(state, world, dew, max_buys_per_run: int | None = None):
    target = mask_count(world) * 0.98
    minutes = 0.0
    runs = 0
    buys = []
    restored = 0.0
    last_cells = 0.0
    for _ in range(800):
        filled_ratio = restored / mask_count(world)
        cells, gained, seconds = cells_per_run(state, world, filled_ratio)
        last_cells = cells
        restored += cells
        dew += gained
        minutes += (seconds + OVERHEAD_SEC) / 60
        runs += 1
        dew, bought = buy_all_affordable(state, dew, max_buys=max_buys_per_run)
        if bought:
            buys.append((runs, ",".join(bought)))
        if restored >= target:
            return minutes, runs, dew, buys, last_cells, restored / mask_count(world)
    return minutes, runs, dew, buys, last_cells, restored / mask_count(world)


def report(max_buys_per_run: int | None = None):
    state = new_state()
    dew = 0.0
    label = "1 buy/run" if max_buys_per_run == 1 else "greedy shop"
    print(f"=== CAMPAIGN ({label}) ===")
    print("world  runs  minutes  cells/run  bottle_s  radius  restored%  dew")
    for world in range(len(WORLDS)):
        incoming = cells_per_run(state, world, 0.0)[0]
        minutes, runs, dew, buys, cells, pct = clear_world(state, world, dew, max_buys_per_run)
        secs = bottle_seconds(state)
        radius = rain_radius(state)
        name = ["Dead Forest", "Frostbite", "Desert", "Toxic", "Globe"][world]
        print(
            f"{name:12} {runs:4}  {minutes:7.1f}  {cells:8.0f}  {secs:7.1f}  {radius:6.2f}  {pct * 100:7.1f}%  {dew:8.0f}  enter {incoming:.0f}"
        )
        if runs >= 400:
            print("  DID NOT CLEAR. ranks:", {k: v for k, v in state.items() if v})
        else:
            shown = buys[:10]
            extra = "" if len(buys) <= 10 else f" ... +{len(buys) - 10} more"
            print("  buys:", ", ".join(f"r{run}:{what}" for run, what in shown) + extra)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--world", type=int, default=-1)
    parser.add_argument("--one-buy", action="store_true", help="At most one upgrade per bottle (player-like)")
    args = parser.parse_args()
    max_buys = 1 if args.one_buy else None
    if args.world >= 0:
        minutes, runs, dew, buys, cells, pct = clear_world(new_state(), args.world, 0, max_buys)
        print(f"world {args.world}: {minutes:.1f} min, {runs} runs, {pct*100:.1f}% last pass, {cells:.0f} cells, {dew:.0f} dew")
        return
    report(max_buys)


if __name__ == "__main__":
    main()
