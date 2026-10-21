#!/usr/bin/env python3
"""
Greedy bottle campaign. Paint stays on the island between bottles. A world
clears when the saved mask reaches ~98%. Upgrade prices keep the shop to
about one rank per bottle, and each island is about 20 minutes of raining.

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
    BLOOM_STEPS,
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
    land_cells,
    land_fraction,
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
    """The cells of an island that are land. The sea is not part of it."""
    return land_cells(world)


def playtest_factor(state, world: int) -> float:
    """Income is the real sit-and-pour. A rank-0 bottle finishes its patch and pays ~33 dew."""
    del state, world
    return 1.0


# Real play greens a good deal more than the rain disc alone. Water that lands on
# a finished patch spills outward and wakes the dry holes the patch gate skipped,
# so the effective area grows while the disc still has holes in it. Measured from
# dev builds with `scripts/dump-analytics.mjs`: a rank-0 bottle really finishes
# about 12 cells, not the 25 the disc alone predicts.
SPILL_GAIN = 0.9


def spill_multiplier(patch: float) -> float:
    """How much the spill chain widens the rained-on area."""
    return 1.0 + SPILL_GAIN * (1.0 - patch)


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
    # Only the land of the island can be restored.
    disc *= land_fraction(world)
    patch = patch_fraction(state)
    wet = max(1.0, disc * patch * spill_multiplier(patch))
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
        # Measured against dev builds: a spilled patch pays less than a whole one,
        # so the bleed is a quarter of a cell rather than half.
        dew += wet * 0.25 * pay * mult
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
    # The chain: each new patch this bottle pays a little more, up to x2.5.
    # The game pays the multiplier per patch, so a bottle averages half the ramp.
    dew *= min(2.5, 1.0 + cells / 400.0)
    remaining = mask_count(world) * (1.0 - filled_ratio)
    cells = min(remaining, cells)
    scale = playtest_factor(state, world)
    cells *= scale
    dew *= scale
    return cells, dew, seconds


def next_buy(state, dew, blooms, world_unlocked, costs=None, bloom_costs=None):
    """First node in priority order the player can actually buy (both wallets + island gate).

    The island you just reached comes first: its own powers are what the player
    is excited about, and the price of those powers is set by that island's
    income, so they have to be bought there or never.
    """
    costs = costs if costs is not None else COSTS
    bloom_costs = bloom_costs if bloom_costs is not None else BLOOM_COSTS
    order = PRIORITY_UNIQUE
    if world_unlocked > 0:
        fresh = [node for node in order if WORLD_MIN.get(node, 0) == world_unlocked]
        if fresh:
            order = fresh + [node for node in order if WORLD_MIN.get(node, 0) != world_unlocked]
    for node in order:
        level = state[node]
        if level >= MAXED[node]:
            continue
        if not prereq(node, state):
            continue
        if WORLD_MIN[node] > world_unlocked:
            continue
        cost = costs[node][level]
        bloom_cost = bloom_costs[node][level]
        if dew >= cost and blooms >= bloom_cost:
            return node, cost, bloom_cost
    return None, 0, 0


def buy_all_affordable(state, dew, blooms, world_unlocked=0, max_buys: int | None = None,
                       costs=None, bloom_costs=None):
    bought = []
    while True:
        if max_buys is not None and len(bought) >= max_buys:
            break
        node, cost, bloom_cost = next_buy(state, dew, blooms, world_unlocked, costs, bloom_costs)
        if node is None:
            break
        dew -= cost
        blooms -= bloom_cost
        state[node] += 1
        bought.append(f"{node}{state[node]}")
    return dew, blooms, bought


def island_blooms(restored, total):
    """Blooms are rare: one per tenth of the island restored, one more for the clear."""
    if total <= 0:
        return 0
    ratio = restored / total
    earned = min(BLOOM_STEPS - 1, int(ratio * BLOOM_STEPS))
    if ratio >= 0.98:
        earned += 1
    return earned


def clear_world(state, world, dew, blooms, world_unlocked, max_buys_per_run: int | None = None):
    """Growth stays on the island. Clear when the saved mask reaches ~98%."""
    total = mask_count(world)
    restored = 0.0
    minutes = 0.0
    runs = 0
    buys = []
    last_cells = 0.0
    dry_runs = 0
    unlocked = max(world_unlocked, world)
    awarded = 0
    for _ in range(1200):
        ratio = restored / total if total else 1.0
        cells, gained, seconds = cells_per_run(state, world, ratio)
        restored = min(float(total), restored + cells)
        last_cells = cells
        dew += gained
        earned = island_blooms(restored, total)
        if earned > awarded:
            blooms += earned - awarded
            awarded = earned
        minutes += (seconds + OVERHEAD_SEC) / 60
        runs += 1
        dew, blooms, bought = buy_all_affordable(state, dew, blooms, unlocked, max_buys=max_buys_per_run)
        if bought:
            buys.append((runs, ",".join(bought)))
        else:
            dry_runs += 1
        if total <= 0 or restored / total >= 0.98:
            return {
                "minutes": minutes,
                "runs": runs,
                "dew": dew,
                "blooms": blooms,
                "buys": buys,
                "cells": last_cells,
                "pct": restored / total if total else 1.0,
                "dry_runs": dry_runs,
            }
    return {
        "minutes": minutes,
        "runs": runs,
        "dew": dew,
        "blooms": blooms,
        "buys": buys,
        "cells": last_cells,
                "pct": restored / total if total else 0.0,
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
            f"{secs:7.1f}  {radius:6.2f}  {res['pct'] * 100:7.1f}%  {dew:8.0f}  {blooms:7.0f}  "
            f"enter {incoming:.0f}  dry {res['dry_runs']}/{res['runs']}"
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
