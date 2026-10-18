#!/usr/bin/env python3
"""
Greedy bottle campaign. One run is one bottle on a dead land.

  python balance/sim.py
  python balance/sim.py --world 1

Each run restores new mask cells (land resets between runs, like the game).
Prints runs and minutes until the world hits ~98% restored.
"""
from __future__ import annotations

import argparse

from game_constants import (
    COSTS,
    MAXED,
    OVERHEAD_SEC,
    PRIORITY,
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


def mask_count(world):
    cols, rows, mc, mr, hp, pay = WORLDS[world]
    return mc * mr


def cells_per_run(state, world):
    cols, rows, mc, mr, hp, pay = WORLDS[world]
    cell_area = (cols * TILE / mc) * (rows * TILE / mr)
    radius = rain_radius(state)
    disc = 3.1415926535 * radius * radius / cell_area
    wet = max(1.0, disc * patch_fraction(state))
    soak_per_sec = (soak_per_tick(state) / 0.1) * 0.68
    seconds = bottle_seconds(state)
    fill_t = hp / max(0.01, soak_per_sec)
    cells = min(mc * mr, wet * (seconds / fill_t))
    if state["sprinkler"] >= 1:
        cells += (14 + state["spin"] * 8) * (seconds / 11)
    if state["lightning"] >= 1:
        cells += (18 + state["zap"] * 12) * (seconds / 16)
    if state["tornado"] >= 1:
        cells += (5 + state["twist"] * 3) * (3.4 / 0.12)
    cells = min(mc * mr, cells)
    dew = cells * pay * dew_multiplier(state) * (1 + crit_chance(state) * 2)
    return cells, dew, seconds


def next_buy(state, dew):
    for node in PRIORITY:
        level = state[node]
        if level >= MAXED[node]:
            continue
        if not prereq(node, state):
            continue
        cost = COSTS[node][level]
        if dew >= cost:
            return node, cost
    return None, 0


def clear_world(state, world, dew):
    """Play until cumulative restored cells cover the mask. Returns minutes, runs, dew left."""
    target = mask_count(world) * 0.98
    minutes = 0.0
    runs = 0
    buys = []
    restored = 0.0
    last_cells = 0.0
    for _ in range(800):
        cells, gained, seconds = cells_per_run(state, world)
        last_cells = cells
        restored += cells
        dew += gained
        minutes += (seconds + OVERHEAD_SEC) / 60
        runs += 1
        bought = []
        while True:
            node, cost = next_buy(state, dew)
            if node is None:
                break
            dew -= cost
            state[node] += 1
            bought.append(f"{node}{state[node]}")
        if bought:
            buys.append((runs, ",".join(bought)))
        if restored >= target:
            return minutes, runs, dew, buys, last_cells
    return minutes, runs, dew, buys, last_cells


def report():
    state = new_state()
    dew = 0.0
    print("world  runs  minutes  cells/run  bottle_s  radius  dew")
    for world in range(len(WORLDS)):
        incoming = cells_per_run(state, world)[0]
        minutes, runs, dew, buys, cells = clear_world(state, world, dew)
        secs = bottle_seconds(state)
        radius = rain_radius(state)
        name = ["Dead Forest", "Frostbite", "Desert", "Toxic", "Globe"][world]
        print(f"{name:12} {runs:4}  {minutes:7.1f}  {cells:8.0f}  {secs:7.1f}  {radius:6.2f}  {dew:8.0f}  enter {incoming:.0f}")
        if runs >= 400:
            print("  DID NOT CLEAR. ranks:", {k: v for k, v in state.items() if v})
        else:
            shown = buys[:8]
            extra = "" if len(buys) <= 8 else f" ... +{len(buys) - 8} more buys"
            print("  buys:", ", ".join(f"r{run}:{what}" for run, what in shown) + extra)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--world", type=int, default=-1, help="Only simulate this world index from a fresh cloud")
    args = parser.parse_args()
    if args.world >= 0:
        minutes, runs, dew, buys, cells = clear_world(new_state(), args.world, 0)
        print(f"world {args.world}: {minutes:.1f} min, {runs} runs, {cells:.0f} cells, {dew:.0f} dew")
        return
    report()


if __name__ == "__main__":
    main()
