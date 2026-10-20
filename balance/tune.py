#!/usr/bin/env python3
"""Solve island size so every island is a real arc ("one more bottle" pacing).

Arrives at island N with the power earned by playing islands 0..N-1 as a player
does (default: one upgrade per bottle), then bisects the island's cell hp until
it lands inside the target wall-clock window.

    python balance/tune.py                 # every island
    python balance/tune.py --world 1       # cracked desert only
    python balance/tune.py --greedy        # power-shopper model instead
    python balance/tune.py --minutes 34 --tol 4

Copy the printed hp values into balance/game_constants.py WORLDS.
"""
from __future__ import annotations

import argparse

import sim
from game_constants import WORLDS

TARGETS = {0: 35.0, 1: 31.0, 2: 32.0, 3: 34.0, 4: 35.0}


def play_prefix(world: int, max_buys: int | None):
    """Play islands 0..world-1 and return (state, dew, blooms, unlocked)."""
    state = sim.new_state()
    dew = 0.0
    blooms = 0.0
    unlocked = 0
    for w in range(world):
        res = sim.clear_world(state, w, dew, blooms, unlocked, max_buys)
        dew, blooms = res["dew"], res["blooms"]
        unlocked = max(unlocked, w)
    return state, dew, blooms, unlocked


def set_hp(world: int, hp: float) -> None:
    cols, rows, mc, mr, _hp, pay = WORLDS[world]
    WORLDS[world] = (cols, rows, mc, mr, int(round(hp)), pay)


def measure(world: int, prefix, max_buys: int | None):
    state, dew, blooms, unlocked = prefix
    res = sim.clear_world(dict(state), world, dew, blooms, unlocked, max_buys)
    return res


def scan_world(world: int, target: float, tol: float, max_buys: int | None):
    """Find the hp that lands the island on the target.

    The curve is a staircase, not a smooth line: below a threshold every cell
    fills in one bottle, above it every cell needs two. A bisection lands on the
    step, so scan a log grid and then refine around the best step.
    """
    cols, rows, mc, mr, hp0, pay = WORLDS[world]
    prefix = play_prefix(world, max_buys)

    def minutes_at(mult: float) -> float:
        set_hp(world, hp0 * mult)
        return measure(world, prefix, max_buys)["minutes"]

    grid = [0.05 * (1.35 ** step) for step in range(46)]
    scored = []
    for mult in grid:
        minutes = minutes_at(mult)
        scored.append((abs(minutes - target), minutes, mult))
    scored.sort()
    _best, best_minutes, best_mult = scored[0]
    # Refine inside the step that is closest to the target.
    step = 0
    for index, (_score, minutes, mult) in enumerate(scored):
        if minutes >= target:
            step = index
            break
    else:
        step = len(scored) - 1
    low = grid[max(0, step - 2)]
    high = grid[min(len(grid) - 1, step + 2)]
    for _ in range(18):
        mid = (low + high) / 2
        minutes = minutes_at(mid)
        if minutes < target:
            low = mid
        else:
            high = mid
        if abs(minutes - target) <= tol * 0.15:
            break
    for mult in (low, high, best_mult):
        minutes = minutes_at(mult)
        if abs(minutes - target) < abs(best_minutes - target):
            best_minutes = minutes
            best_mult = mult
    set_hp(world, hp0 * best_mult)
    res = measure(world, prefix, max_buys)
    return {
        "hp": int(round(hp0 * best_mult)),
        "mult": best_mult,
        "minutes": res["minutes"],
        "runs": res["runs"],
        "cells": res["cells"],
        "dew": res["dew"],
        "blooms": res["blooms"],
    }


def tune_world(world: int, target: float, tol: float, max_buys: int | None) -> None:
    hp0 = WORLDS[world][4]
    result = scan_world(world, target, tol, max_buys)
    print(
        f"island {world} ({sim.WORLD_NAMES[world]}): hp {hp0} -> {result['hp']} "
        f"(x{result['mult']:.2f}) · {result['minutes']:.1f} min · {result['runs']} bottles · "
        f"98% at {result['cells']:.0f} cells/bottle · leftover dew {result['dew']:.0f} / "
        f"blooms {result['blooms']:.0f}"
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--world", type=int, default=-1)
    parser.add_argument("--minutes", type=float, default=0.0)
    parser.add_argument("--tol", type=float, default=4.0)
    parser.add_argument("--greedy", action="store_true")
    args = parser.parse_args()
    max_buys = None if args.greedy else 1
    worlds = [args.world] if args.world >= 0 else list(range(len(WORLDS)))
    print(f"=== ISLAND SIZE TUNE ({'greedy shop' if args.greedy else '1 buy/bottle'}) ===")
    for w in worlds:
        target = args.minutes or TARGETS.get(w, 32.0)
        tune_world(w, target, args.tol, max_buys)
    print("\nsuggested WORLDS (cols, rows, mask cols, mask rows, hp, pay):")
    for i, row in enumerate(WORLDS):
        print(f"  {sim.WORLD_NAMES[i]:12} {tuple(row)}")


if __name__ == "__main__":
    main()
