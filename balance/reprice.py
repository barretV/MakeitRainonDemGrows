#!/usr/bin/env python3
"""Price the upgrade tree off a fresh island.

Each bottle starts from bare ground. The next ranks you can actually buy are
priced at most of that bottle's dew (and blooms, when the rank already costs
blooms), so the shop naturally sells about one upgrade per bottle.

    python balance/reprice.py           # print the curve
    python balance/reprice.py --write   # write costs back into src/game/tree.ts

Then run `npm run dump-upgrades` so balance/upgrades.json matches.
"""
from __future__ import annotations

import argparse
import math
import re
from pathlib import Path

from game_constants import (
    BLOOM_COSTS,
    COSTS,
    OVERHEAD_SEC,
    PRIORITY_UNIQUE,
    bottle_seconds,
)
from sim import cells_per_run, mask_count, new_state, next_buy

ROOT = Path(__file__).resolve().parents[1]
TREE = ROOT / "src" / "game" / "tree.ts"


def nice(value: float) -> int:
    """Round down so a bottle that earned `value/0.85` can still pay."""
    target = max(1.0, value)
    if target < 20:
        return max(1, int(target))
    exp = math.floor(math.log10(target))
    step = 10 ** (exp - 1)
    return max(1, int(target // step * step))


def enforce_one_buy(costs: dict[str, list[int]]) -> None:
    """Raise any rank that a greedy shop would buy as a second purchase."""
    for _pass in range(40):
        state = new_state()
        dew = 0.0
        bloom_wallet = 0.0
        changed = False
        for world in range(5):
            total = mask_count(world)
            for _ in range(500):
                cells, income, _seconds = cells_per_run(state, world, 0.0)
                if total <= 0 or cells / total >= 0.98:
                    break
                spendable = dew + income
                dew += income
                bloom_wallet += cells
                first_cost = None
                while True:
                    pick, cost, bloom_cost = next_buy(state, dew, bloom_wallet, world)
                    if pick is None:
                        break
                    if first_cost is None:
                        first_cost = cost
                        dew -= cost
                        bloom_wallet -= bloom_cost
                        state[pick] += 1
                        continue
                    level = state[pick]
                    need = math.floor(spendable - first_cost) + 1
                    if costs[pick][level] < need:
                        costs[pick][level] = int(need)
                        changed = True
                    break
        if not changed:
            return
    raise SystemExit("could not pin the shop to one upgrade per bottle")


def reprice():
    original_costs = {key: list(values) for key, values in COSTS.items()}
    original_blooms = {key: list(BLOOM_COSTS[key]) for key in COSTS}
    for key in COSTS:
        COSTS[key][:] = original_costs[key]
        BLOOM_COSTS[key][:] = original_blooms[key]
    costs = COSTS
    blooms = BLOOM_COSTS
    state = new_state()
    dew = 0.0
    bloom_wallet = 0.0
    report: list[dict] = []

    for world in range(5):
        for _ in range(400):
            cells, income, seconds = cells_per_run(state, world, 0.0)
            total = mask_count(world)
            if cells / total >= 0.98:
                report.append(
                    {
                        "world": world,
                        "cleared": True,
                        "cover": cells / total,
                        "buys": 0,
                        "seconds": seconds,
                        "income": income,
                    }
                )
                break
            node, _, _ = next_buy(state, 1e18, 1e18, world)
            if node is None:
                report.append(
                    {
                        "world": world,
                        "cleared": False,
                        "cover": cells / total,
                        "buys": 0,
                        "seconds": seconds,
                        "income": income,
                    }
                )
                break

            spendable_dew = dew + income
            spendable_blooms = bloom_wallet + cells
            dew_price = min(nice(income * 0.85), max(1, int(spendable_dew * 0.85)))
            bloom_price = min(nice(cells * 0.5), max(0, int(spendable_blooms * 0.55)))
            # Every rank on the shelf this bottle, not only the one we take.
            for candidate in PRIORITY_UNIQUE:
                level = state[candidate]
                if level >= len(costs[candidate]):
                    continue
                if next_buy({**state, candidate: level}, 1e18, 1e18, world)[0] != candidate and candidate != node:
                    # prereq / island gate closed — next_buy walks priority, so test directly
                    pass
                trial = dict(state)
                # Affordability probe: skip nodes that aren't the next legal one in a solo tree.
                solo = new_state()
                solo.update(state)
                # Use next_buy's own filters by asking if this node would be chosen
                # when it is the only one under the price we are about to set.
            legal = []
            saved = {key: list(costs[key]) for key in costs}
            saved_b = {key: list(blooms[key]) for key in blooms}
            for candidate in PRIORITY_UNIQUE:
                level = state[candidate]
                if level >= len(costs[candidate]):
                    continue
                costs[candidate][level] = 1
                blooms[candidate][level] = 0
                picked, _, _ = next_buy(state, 1e18, 1e18, world)
                costs[candidate][level] = saved[candidate][level]
                blooms[candidate][level] = saved_b[candidate][level]
                if picked == candidate:
                    legal.append(candidate)
                # Putting this one at 1 may have shadowed later nodes. Restore and
                # only keep candidates that are currently unlocked, re-checked below.

            legal = []
            for candidate in PRIORITY_UNIQUE:
                level = state[candidate]
                if level >= len(costs[candidate]):
                    continue
                snapshot_c = costs[candidate][level]
                snapshot_b = blooms[candidate][level]
                costs[candidate][level] = 1
                blooms[candidate][level] = 0
                # Hide every other unfinished node behind a price this probe can't pay,
                # then see if `candidate` itself is legal.
                hidden = []
                for other in PRIORITY_UNIQUE:
                    if other == candidate:
                        continue
                    olev = state[other]
                    if olev >= len(costs[other]):
                        continue
                    hidden.append((other, olev, costs[other][olev], blooms[other][olev]))
                    costs[other][olev] = 10**12
                    blooms[other][olev] = 10**12
                picked, _, _ = next_buy(state, 1e18, 1e18, world)
                costs[candidate][level] = snapshot_c
                blooms[candidate][level] = snapshot_b
                for other, olev, oc, ob in hidden:
                    costs[other][olev] = oc
                    blooms[other][olev] = ob
                if picked == candidate:
                    legal.append(candidate)

            if node not in legal:
                legal.insert(0, node)

            for candidate in legal:
                level = state[candidate]
                prev = costs[candidate][level - 1] if level else 0
                priced = dew_price
                if prev and priced < int(prev * 1.15):
                    priced = int(prev * 1.15)
                priced = min(priced, max(1, int(spendable_dew * 0.9)))
                costs[candidate][level] = max(1, priced)
                if original_blooms[candidate][level] > 0:
                    prev_b = blooms[candidate][level - 1] if level else 0
                    bpriced = bloom_price
                    if prev_b and bpriced < int(prev_b * 1.15):
                        bpriced = int(prev_b * 1.15)
                    bpriced = min(max(bpriced, 1), max(1, int(spendable_blooms * 0.9)))
                    blooms[candidate][level] = bpriced

            dew += income
            bloom_wallet += cells
            bought = 0
            bought_names: list[str] = []
            pick, cost, bloom_cost = next_buy(state, dew, bloom_wallet, world)
            if pick is not None:
                dew -= cost
                bloom_wallet -= bloom_cost
                state[pick] += 1
                bought = 1
                bought_names.append(f"{pick}{state[pick]}")
            report.append(
                {
                    "world": world,
                    "cleared": False,
                    "cover": cells / total,
                    "buys": bought,
                    "bought": bought_names,
                    "seconds": seconds,
                    "income": income,
                    "dew": dew,
                }
            )
        else:
            continue
        # break landed via cleared/stuck; keep going to the next world
    enforce_one_buy(costs)
    # Ranks we never reached should not be a bargain compared with the last price.
    for key, curve in costs.items():
        last = 0
        for index, price in enumerate(curve):
            if index < state[key]:
                last = price
                continue
            last = nice(max(price, last * 2.15))
            curve[index] = last
        for index in range(state[key], len(blooms[key])):
            if original_blooms[key][index] <= 0:
                blooms[key][index] = 0
                continue
            prev_b = blooms[key][index - 1] if index else 0
            blooms[key][index] = nice(max(blooms[key][index], (prev_b or 1) * 2.15))

    return state, costs, blooms, report


def write_tree(costs: dict[str, list[int]], blooms: dict[str, list[int]]) -> None:
    text = TREE.read_text(encoding="utf-8")
    for node_id, curve in costs.items():
        text, n = re.subn(
            rf"(id: '{node_id}',[\s\S]*?costs: )\[[^\]]*\]",
            lambda m, curve=curve: m.group(1) + "[" + ", ".join(str(v) for v in curve) + "]",
            text,
            count=1,
        )
        if n != 1:
            raise SystemExit(f"could not find costs for {node_id}")
        bloom_values = blooms.get(node_id) or []
        if not any(bloom_values):
            continue
        text, n = re.subn(
            rf"(id: '{node_id}',[\s\S]*?blooms: )\[[^\]]*\]",
            lambda m, bloom_values=bloom_values: m.group(1) + "[" + ", ".join(str(v) for v in bloom_values) + "]",
            text,
            count=1,
        )
        if n != 1:
            raise SystemExit(f"could not find blooms for {node_id}")
    TREE.write_text(text, encoding="utf-8")


def summarize(report: list[dict]) -> None:
    print("=== FRESH ISLAND CADENCE (prices follow one bottle of income) ===")
    minutes = 0.0
    for world in range(5):
        rows = [row for row in report if row["world"] == world]
        played = [row for row in rows if not row["cleared"]]
        buys = [row["buys"] for row in played]
        multi = sum(1 for n in buys if n >= 2)
        dry = sum(1 for n in buys if n == 0)
        minutes_w = sum((row["seconds"] + OVERHEAD_SEC) / 60 for row in played)
        minutes += minutes_w
        end = rows[-1]["cover"] if rows else 0
        print(
            f"world {world}: {len(played):3} bottles  {minutes_w:5.1f} min  "
            f"buys/bottle { (sum(buys)/len(buys) if buys else 0):.2f}  "
            f"multi {multi}  dry {dry}  end {100*end:.0f}%"
        )
    early = [row["buys"] for row in report if row["world"] == 0 and not row["cleared"]][:25]
    dry25 = sum(1 for n in early if n == 0)
    print(f"total {minutes:.0f} min")
    print(f"world 0 first 25 dry runs: {dry25}/25")
    print("sample world 0:", ", ".join(
        f"r{i+1}:{','.join(row['bought']) if row['bought'] else '-'}"
        for i, row in enumerate(row for row in report if row["world"] == 0 and not row["cleared"])
        if i < 12
    ))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    _state, costs, blooms, report = reprice()
    summarize(report)
    if args.write:
        write_tree(costs, blooms)
        print(f"wrote {TREE}")


if __name__ == "__main__":
    main()
