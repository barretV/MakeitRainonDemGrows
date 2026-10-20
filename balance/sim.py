#!/usr/bin/env python3
"""
Greedy bottle campaign. Each bottle starts on a bare island and clears it
only when that one bottle restores ~98%. Upgrade prices are what keep the
shop to about one rank per bottle.

    python balance/sim.py                  # full campaign, greedy shop
    python balance/sim.py --one-buy        # player-like: at most one upgrade per bottle
    python balance/sim.py --world 2        # single island

Two currencies are modelled:
  dew    - earned per finished (or partially soaked) mask cell, spent per rank
  blooms - earned per finished mask cell, spent only on bloom-costed island powers

Each upgrade also has an island gate (worldMin): the tree only offers it once
that island has been reached, so a world's signature toys arrive with the world.
"""
from __future__ import annotations

import argparse
import math

from game_constants import (
    BLOOM_COSTS,
    COSTS,
    GLOBE_WORLD,
    MAXED,
    OVERHEAD_SEC,
    PRIORITY_UNIQUE,
    TILE,
    WORLD_MIN,
    WORLDS,
    bottle_seconds,
    crit_chance,
    dew_multiplier,
    patch_fraction,
    pool_gain,
    prereq,
    rain_radius,
    soak_per_tick,
)

WORLD_NAMES = ["Dead Forest", "Frostbite", "Desert", "Toxic", "Globe"]


def new_state():
    return {key: 0 for key in COSTS}


def mask_count(world: int) -> int:
    _, _, mc, mr, _, _ = WORLDS[world]
    return mc * mr


def playtest_factor(state, world: int) -> float:
    """Income is the real sit-and-pour. A rank-0 bottle finishes its patch and pays ~33 dew."""
    del state, world
    return 1.0


def cells_per_run(state, world: int, filled_ratio: float = 0.0):
    """New mask cells finished this bottle; land persists between runs."""
    cols, rows, mc, mr, hp, pay = WORLDS[world]
    if world == GLOBE_WORLD:
        # Mirror state.reach(): the globe is painted in lon/lat units.
        radius = rain_radius(state) * 0.05
        cell_area = (2 * math.pi / mc) * (2.3 / mr)
    else:
        radius = rain_radius(state)
        cell_area = (cols * TILE / mc) * (rows * TILE / mr)
    disc = math.pi * radius * radius / cell_area
    wet = max(1.0, disc * patch_fraction(state))
    # Less untouched land under the cloud as the island greens. Meadow Spring keeps
    # water pooling on the green and seeping into the thirsty soil, holding the floor up.
    floor = 0.08 + 0.07 * state["spring"]
    untouched = max(floor, 1.0 - filled_ratio * 0.92)
    wet *= untouched
    seconds = bottle_seconds(state)
    ticks = seconds / 0.1
    soak_on_cell = ticks * soak_per_tick(state)
    mult = dew_multiplier(state)
    crit = 1 + crit_chance(state) * 2
    if soak_on_cell >= hp * 0.92:
        cells = wet
        dew = cells * pay * mult * crit
        # The rim and the bleed into neighbours pay on top of the finished patch.
        dew += wet * 0.5 * pay * mult
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
    if state["monsoon"] >= 1:
        bonus = mr * (8 + state["monsoon"] * 6) * 0.35
        cells += bonus
        dew += bonus * pay * mult * crit
    if state["spring"] >= 1 and filled_ratio > 0.1:
        # Standing pools on green ground feed the frontier.
        bonus = wet * filled_ratio * (0.06 * state["spring"]) * (1 + 0.5 * pool_gain(state))
        cells += bonus
        dew += bonus * pay * mult * crit
    remaining = mask_count(world) * (1.0 - filled_ratio)
    cells = min(remaining, cells)
    scale = playtest_factor(state, world)
    cells *= scale
    dew *= scale
    return cells, dew, seconds


def next_buy(state, dew, blooms, world_unlocked):
    """First node in priority order the player can actually buy (both wallets + island gate)."""
    for node in PRIORITY_UNIQUE:
        level = state[node]
        if level >= MAXED[node]:
            continue
        if not prereq(node, state):
            continue
        if WORLD_MIN[node] > world_unlocked:
            continue
        cost = COSTS[node][level]
        bloom_cost = BLOOM_COSTS[node][level]
        if dew >= cost and blooms >= bloom_cost:
            return node, cost, bloom_cost
    return None, 0, 0


def buy_all_affordable(state, dew, blooms, world_unlocked=0, max_buys: int | None = None):
    bought = []
    while True:
        if max_buys is not None and len(bought) >= max_buys:
            break
        node, cost, bloom_cost = next_buy(state, dew, blooms, world_unlocked)
        if node is None:
            break
        dew -= cost
        blooms -= bloom_cost
        state[node] += 1
        bought.append(f"{node}{state[node]}")
    return dew, blooms, bought


def clear_world(state, world, dew, blooms, world_unlocked, max_buys_per_run: int | None = None):
    """Fresh island every bottle. Clear when one bottle restores ~98%."""
    total = mask_count(world)
    minutes = 0.0
    runs = 0
    buys = []
    last_cells = 0.0
    dry_runs = 0
    unlocked = max(world_unlocked, world)
    for _ in range(1200):
        cells, gained, seconds = cells_per_run(state, world, 0.0)
        last_cells = cells
        dew += gained
        blooms += cells
        minutes += (seconds + OVERHEAD_SEC) / 60
        runs += 1
        dew, blooms, bought = buy_all_affordable(state, dew, blooms, unlocked, max_buys=max_buys_per_run)
        if bought:
            buys.append((runs, ",".join(bought)))
        else:
            dry_runs += 1
        if cells / total >= 0.98:
            return {
                "minutes": minutes,
                "runs": runs,
                "dew": dew,
                "blooms": blooms,
                "buys": buys,
                "cells": last_cells,
                "pct": cells / total,
                "dry_runs": dry_runs,
            }
    return {
        "minutes": minutes,
        "runs": runs,
        "dew": dew,
        "blooms": blooms,
        "buys": buys,
        "cells": last_cells,
                "pct": last_cells / total,
        "dry_runs": dry_runs,
    }


def report(max_buys_per_run: int | None = None):
    state = new_state()
    dew = 0.0
    blooms = 0.0
    unlocked = 0
    label = "1 buy/run" if max_buys_per_run == 1 else "greedy shop"
    print(f"=== CAMPAIGN ({label}) ===")
    print("world  runs  minutes  cells/run  bottle_s  radius  restored%  dew  blooms  enter")
    total_minutes = 0.0
    total_runs = 0
    for world in range(len(WORLDS)):
        incoming = cells_per_run(state, world, 0.0)[0]
        res = clear_world(state, world, dew, blooms, unlocked, max_buys_per_run)
        dew = res["dew"]
        blooms = res["blooms"]
        unlocked = max(unlocked, world)
        secs = bottle_seconds(state)
        radius = rain_radius(state)
        total_minutes += res["minutes"]
        total_runs += res["runs"]
        print(
            f"{WORLD_NAMES[world]:12} {res['runs']:4}  {res['minutes']:7.1f}  {res['cells']:8.0f}  "
            f"{secs:7.1f}  {radius:6.2f}  {res['pct'] * 100:7.1f}%  {dew:8.0f}  {blooms:7.0f}  enter {incoming:.0f}"
        )
        if res["runs"] >= 400:
            print("  DID NOT CLEAR. ranks:", {k: v for k, v in state.items() if v})
        else:
            shown = res["buys"][:10]
            extra = "" if len(res["buys"]) <= 10 else f" ... +{len(res['buys']) - 10} more"
            print("  buys:", ", ".join(f"r{run}:{what}" for run, what in shown) + extra)
    print(f"\ntotal: {total_minutes:.0f} min, {total_runs} bottles")
    print("island toys bought:", {k: state[k] for k in ("sprinkler", "lightning", "tornado", "flow", "spring") if state[k]})


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--world", type=int, default=-1)
    parser.add_argument("--one-buy", action="store_true", help="At most one upgrade per bottle (player-like)")
    args = parser.parse_args()
    max_buys = 1 if args.one_buy else None
    if args.world >= 0:
        res = clear_world(new_state(), args.world, 0.0, 0.0, args.world, max_buys)
        print(
            f"world {args.world}: {res['minutes']:.1f} min, {res['runs']} runs, "
            f"{res['pct'] * 100:.1f}% last pass, {res['cells']:.0f} cells, "
            f"{res['dew']:.0f} dew, {res['blooms']:.0f} blooms, {res['dry_runs']} dry runs"
        )
        return
    report(max_buys)


if __name__ == "__main__":
    main()
