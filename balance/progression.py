#!/usr/bin/env python3
"""Campaign cadence: does "one more bottle, one more upgrade" hold together?

Plays the whole game with a player-like model (default: at most one upgrade per
bottle) and prints, per island:

  * every bottle: dew/blooms earned, land gained, power, what was bought
  * what the shop was blocked on when nothing was affordable (which wallet)
  * island summary: first-buy run, dry runs, purchases/bottle, time

Modes:
    python balance/progression.py                 # 1 buy/bottle, whole campaign
    python balance/progression.py --greedy        # shop until empty each bottle
    python balance/progression.py --from-world 1  # skip the tutorial island
"""
from __future__ import annotations

import argparse

from game_constants import (
    BLOOM_COSTS,
    COSTS,
    MAXED,
    OVERHEAD_SEC,
    PRIORITY_UNIQUE,
    WORLD_MIN,
    WORLDS,
    bottle_seconds,
    max_liters,
    prereq,
    rain_radius,
    soak_per_tick,
)
from sim import WORLD_NAMES, cells_per_run, mask_count, new_state, next_buy


# Petal shop, same order and prices as src/game/petal.ts. Bought with leftover blooms
# after the tree, so cosmetics and Pressed Petals compete with island ranks.
PETAL_COSTS = [40, 100, 220, 480, 900, 1600, 120, 280, 600, 1200, 2400, 5000, 10000, 18000]


def buy_petals(blooms: float, petal_index: int) -> tuple[float, int]:
    while petal_index < len(PETAL_COSTS) and blooms >= PETAL_COSTS[petal_index]:
        blooms -= PETAL_COSTS[petal_index]
        petal_index += 1
    return blooms, petal_index


def simulate(max_buys_per_bottle: int | None, from_world: int):
    state = new_state()
    dew = 0.0
    blooms = 0.0
    petal_index = 0
    unlocked = from_world
    islands: list[dict] = []

    for world in range(from_world, len(WORLDS)):
        total = mask_count(world)
        per_run: list[dict] = []
        while len(per_run) < 1200:
            cells, earned, seconds = cells_per_run(state, world, 0.0)
            dew += earned
            blooms += cells

            # What is the shop waiting on this bottle? (first priority node not affordable)
            blocked = ""
            for node in PRIORITY_UNIQUE:
                level = state[node]
                if level >= MAXED[node] or not prereq(node, state):
                    continue
                if WORLD_MIN[node] > max(unlocked, world):
                    continue
                cost = COSTS[node][level]
                bloom_cost = BLOOM_COSTS[node][level]
                if dew >= cost and blooms >= bloom_cost:
                    break
                tag = f"{node}#{level}"
                if dew < cost and blooms < bloom_cost:
                    blocked = f"{tag} dew {dew:.0f}/{cost} blooms {blooms:.0f}/{bloom_cost}"
                elif dew < cost:
                    blocked = f"{tag} dew {dew:.0f}/{cost}"
                else:
                    blocked = f"{tag} blooms {blooms:.0f}/{bloom_cost}"
                break

            bought: list[str] = []
            while True:
                if max_buys_per_bottle is not None and len(bought) >= max_buys_per_bottle:
                    break
                node, cost, bloom_cost = next_buy(state, dew, blooms, max(unlocked, world))
                if node is None:
                    break
                dew -= cost
                blooms -= bloom_cost
                state[node] += 1
                bought.append(f"{node}{state[node]}")

            blooms, petal_index = buy_petals(blooms, petal_index)

            per_run.append(
                {
                    "run": len(per_run) + 1,
                    "earned": earned,
                    "dew": dew,
                    "blooms": blooms,
                    "land": cells / total * 100,
                    "radius": rain_radius(state),
                    "liters": max_liters(state),
                    "bottle_s": seconds,
                    "soak": soak_per_tick(state),
                    "bought": bought,
                    "blocked": "" if bought else blocked,
                }
            )
            if cells / total >= 0.98:
                break

        unlocked = max(unlocked, world)
        minutes = sum((e["bottle_s"] + OVERHEAD_SEC) / 60 for e in per_run)
        islands.append({"world": world, "per_run": per_run, "minutes": minutes, "unlocked": unlocked, "dew": dew, "blooms": blooms})

    return islands


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--greedy", action="store_true", help="shop until empty each bottle")
    parser.add_argument("--from-world", type=int, default=0)
    args = parser.parse_args()

    islands = simulate(None if args.greedy else 1, args.from_world)
    label = "greedy shop" if args.greedy else "1 buy/bottle"
    print(f"=== PROGRESSION CADENCE ({label}) ===")
    total_minutes = 0.0
    total_runs = 0
    for island in islands:
        world = island["world"]
        per_run = island["per_run"]
        total_minutes += island["minutes"]
        total_runs += len(per_run)
        print(f"\n-- {WORLD_NAMES[world]} (island {world + 1}) --")
        print("run  earned  dew  blooms  dLand%  radius  liters  bottle_s  soak  bought  blocked")
        for entry in per_run:
            print(
                f"{entry['run']:3}  {entry['earned']:6.0f}  {entry['dew']:4.0f}  {entry['blooms']:6.0f}  "
                f"{entry['land']:6.2f}  {entry['radius']:6.2f}  {entry['liters']:6.0f}L  "
                f"{entry['bottle_s']:6.1f}s  {entry['soak']:4.2f}  "
                f"{','.join(entry['bought']) if entry['bought'] else '-'}  {entry['blocked']}"
            )
        first_buy = next((e["run"] for e in per_run if e["bought"]), 0)
        dry = sum(1 for e in per_run if not e["bought"])
        avg = sum(len(e["bought"]) for e in per_run) / max(1, len(per_run))
        end = per_run[-1] if per_run else {"land": 0.0, "dew": 0.0, "blooms": 0.0}
        print(
            f"  {len(per_run)} bottles · {island['minutes']:.0f} min · first buy r{first_buy} · "
            f"dry {dry}/{len(per_run)} · buys/bottle {avg:.2f} · land {end['land']:.2f}% · "
            f"leftover dew {end['dew']:.0f} / blooms {end['blooms']:.0f}"
        )
    print(f"\ntotal: {total_runs} bottles, {total_minutes:.0f} min")


if __name__ == "__main__":
    main()
