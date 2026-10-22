#!/usr/bin/env python3
"""Price the upgrade tree off a fresh island.

The shop should sell about one upgrade per bottle, and there should always be
something in reach: a player who earns dew and has nothing to spend it on feels
like the game has stopped.

So the tree is priced like this:

1. Play the campaign as the player plays it: everything affordable gets bought.
   Every purchase is priced at 85% of the money in hand, so the shop always
   asks for about one bottle of income.
2. The ranks the campaign never reached are slotted in behind the rank they
   follow on their branch, and their price is interpolated between the
   purchases around them. That keeps the ladder dense: no stretch of income is
   left without a rung in reach, which is what makes an island feel like a
   stand-still.
3. The prices and the campaign depend on each other, so the tool plays the
   campaign, re-prices from what it bought, and plays again until the two agree.

    python balance/reprice.py           # print the curve
    python balance/reprice.py --write   # write costs back into src/game/tree.ts

Then run `npm run dump-upgrades` so balance/upgrades.json matches.
"""
from __future__ import annotations

import argparse
import math
import os
import re
from pathlib import Path

from upgrade_loader import build_maxes
from game_constants import (
    BLOOM_COSTS,
    COSTS,
    OVERHEAD_SEC,
    PRIORITY_UNIQUE,
    WORLD_MIN,
    bottle_seconds,
)
from sim import cells_per_run, island_blooms, mask_count, new_state, next_buy

# Nodes bought with blooms only: their dew price stays at zero.
BLOOM_ONLY = ("blush", "bow", "trail", "buddy", "sparkle", "hum", "press")

# How much an un-reached rank costs more than the last one of its branch, when
# there is no purchase around it to interpolate against.
TAIL_STEP = float(os.environ.get('TAIL_STEP', '1.12'))

# How much a rank costs more than the rank before it on the same branch.
RANK_STEP = float(os.environ.get('RANK_STEP', '1.15'))

# What share of the money in hand a purchase costs.
INCOME_SHARE = float(os.environ.get('INCOME_SHARE', '0.85'))

# How many times the campaign is played while the prices settle.
ITERATIONS = int(os.environ.get('ITERATIONS', '14'))

# How many ranks one bottle buys while the prices are being worked out. Set to
# 2–3 when repricing against golden playthrough cadence (see golden-world0.json).
BUYS_PER_BOTTLE = int(os.environ.get('BUYS_PER_BOTTLE', '1'))

# Price a rank against the best the island ever paid, or against the last bottle.
USE_PEAK = os.environ.get('USE_PEAK', '1') == '1'

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


class Entry:
    """One rank of one node, and where it sits in the ladder."""

    __slots__ = ("node", "rank", "anchor", "price")

    def __init__(self, node: str, rank: int, anchor: float | None):
        self.node = node
        self.rank = rank
        self.anchor = anchor
        self.price = 0.0


def play(costs, bloom_costs):
    """Play the campaign as the player plays it. One band of purchases per island."""
    state = new_state()
    dew = 0.0
    blooms = 0.0
    bloom_awarded = 0
    bands: list[list[Entry]] = [[] for _ in range(5)]
    bought: dict[str, int] = {node: 0 for node in COSTS}
    minutes = 0.0
    runs = 0
    dry = 0
    per_world = []

    for world in range(5):
        restored = 0.0
        total = mask_count(world)
        world_runs = 0
        world_dry = 0
        world_minutes = 0.0
        peak = 0.0
        entering = 0.0
        for _ in range(400):
            ratio = restored / total if total else 1.0
            cells, income, seconds = cells_per_run(state, world, ratio)
            restored = min(float(total), restored + cells)
            earned = island_blooms(restored, total)
            blooms += max(0, earned - bloom_awarded)
            bloom_awarded = earned
            dew += income
            world_runs += 1
            world_minutes += (seconds + OVERHEAD_SEC) / 60
            if entering <= 0:
                entering = income
            if total <= 0 or restored / total >= 0.98:
                break
            # The walk plays the way a player plays: it buys what it can
            # afford. The price of a rank is then about one bottle of income,
            # which is what the shop asks.
            taken = 0
            while True:
                if BUYS_PER_BOTTLE > 0 and taken >= BUYS_PER_BOTTLE:
                    break
                node, cost, bloom_cost = next_buy(state, dew, blooms, world, costs, bloom_costs)
                if node is None:
                    break
                # An island pays less and less as it fills up, so the price of
                # a rank follows the best the island ever paid, not the last
                # bottle. Otherwise the whole end of an island is priced at
                # almost nothing.
                peak = max(peak, income) if USE_PEAK else income
                price = peak
                if state[node] == 0 and WORLD_MIN.get(node, 0) == world:
                    # The power an island brings with it is priced at what the
                    # player has when they arrive, so it can be bought there.
                    price = entering
                bands[world].append(Entry(node, bought[node], nice(price * INCOME_SHARE)))
                bought[node] += 1
                state[node] += 1
                dew -= cost
                blooms -= bloom_cost
                taken += 1
            if taken == 0:
                world_dry += 1
        minutes += world_minutes
        runs += world_runs
        dry += world_dry
        per_world.append((world_runs, world_minutes, world_dry))
    return bands, bought, per_world


def fill_ladder(entries: list[Entry]) -> None:
    """Price the ladder: the purchases keep their price, the ranks the campaign
    never reached are interpolated between the purchases around them."""
    if not entries:
        return
    anchors = [index for index, entry in enumerate(entries) if entry.anchor is not None]
    for entry in entries:
        if entry.anchor is not None:
            entry.price = float(entry.anchor)

    for position in range(len(anchors) - 1):
        start = anchors[position]
        end = anchors[position + 1]
        gap = end - start - 1
        if gap <= 0:
            continue
        low = entries[start].price
        high = entries[end].price
        if high <= low:
            high = low * TAIL_STEP
        ratio = (high / low) ** (1.0 / (gap + 1))
        price = low
        for step in range(1, gap + 1):
            price *= ratio
            entries[start + step].price = price

    last = anchors[-1]
    price = entries[last].price
    for index in range(last + 1, len(entries)):
        price *= TAIL_STEP
        entries[index].price = price

    # The head: the ranks that come before the first purchase, priced down from
    # it. Without these a node the campaign never bought would be free.
    first = anchors[0]
    price = entries[first].price
    for index in range(first - 1, -1, -1):
        price /= TAIL_STEP
        entries[index].price = price


def first_anchor_price(entries: list[Entry]) -> dict[str, float]:
    """The price of the first rank of every node the campaign bought."""
    out: dict[str, float] = {}
    for entry in entries:
        if entry.anchor is None or entry.node in out:
            continue
        out[entry.node] = float(entry.anchor)
    return out


def build_costs(bands, bought):
    """The ladder becomes the price list of the tree."""
    # The purchases in the order they happened.
    entries: list[Entry] = []
    band_ranges: list[list[int]] = []
    for band in bands:
        start = len(entries)
        entries.extend(band)
        band_ranges.append([start, len(entries)])

    # The ranks the campaign never reached are bought later, so they belong to
    # the later islands. Spread them over those islands by how much each one
    # buys, or the late islands end up with a price list of their own and
    # nothing to spend it on.
    inserts: list[tuple[int, Entry]] = []
    for node, count in bought.items():
        missing = [rank for rank in range(count, len(COSTS[node]))]
        if not missing:
            continue
        home = len(band_ranges) - 1
        for index, (start, end) in enumerate(band_ranges):
            if any(e.node == node and e.anchor is not None for e in entries[start:end]):
                home = index
                break
        later = list(range(home, len(band_ranges))) or [home]
        sizes = [max(1, band_ranges[b][1] - band_ranges[b][0]) for b in later]
        total = sum(sizes)
        cursor = 0
        for b_index, size in zip(later, sizes):
            share = round(len(missing) * size / total)
            take = missing[cursor:cursor + share]
            cursor += share
            for offset, rank in enumerate(take):
                inserts.append((band_ranges[b_index][1] + offset, Entry(node, rank, None)))
        for rank in missing[cursor:]:
            inserts.append((len(entries), Entry(node, rank, None)))
    for at, entry in sorted(inserts, key=lambda pair: -pair[0]):
        entries.insert(min(at, len(entries)), entry)

    fill_ladder(entries)

    # An island's own powers climb gently from the price the player arrives
    # with. Their power is big, so the income jumps the moment they are bought;
    # pricing the next rank off that jump puts it out of reach.
    for node, first in first_anchor_price(entries).items():
        if WORLD_MIN.get(node, 0) <= 0:
            continue
        for rank in range(len(COSTS[node])):
            climb = first * (RANK_STEP**rank)
            for entry in entries:
                if entry.node == node and entry.rank == rank:
                    entry.price = max(entry.price, climb) if rank == 0 else climb
                    break

    maxes = build_maxes()
    costs: dict[str, list[int]] = {key: [0] * maxes[key] for key in COSTS}
    for entry in entries:
        if entry.node in BLOOM_ONLY:
            continue
        costs[entry.node][entry.rank] = max(1, nice(entry.price))
    # Every branch climbs: a rank never costs less than 15% more than the rank
    # before it, so a branch always reads as a climb.
    for key, curve in costs.items():
        for index in range(1, len(curve)):
            if curve[index - 1] and curve[index] < int(curve[index - 1] * RANK_STEP):
                curve[index] = int(curve[index - 1] * RANK_STEP)
    return costs, entries


def write_tree(costs: dict[str, list[int]]) -> None:
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
    TREE.write_text(text)


def summarize(bands, per_world) -> None:
    print("=== FRESH ISLAND CADENCE (prices follow one bottle of income) ===")
    total_minutes = 0.0
    for index, (runs, minutes, dry) in enumerate(per_world):
        total_minutes += minutes
        print(f"world {index}: {runs:3} bottles  {minutes:5.1f} min  dry {dry}/{runs}")
    print(f"total {total_minutes:.0f} min")
    rungs = sorted(entry.price for entry in bands if entry.price > 0)
    if len(rungs) > 1:
        biggest = max((rungs[i] / rungs[i - 1], rungs[i - 1], rungs[i]) for i in range(1, len(rungs)))
        print(f"ladder: {len(rungs)} rungs, biggest step x{biggest[0]:.2f} "
              f"({biggest[1]:.0f} -> {biggest[2]:.0f})")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()

    maxes = build_maxes()
    costs = {key: list(values) for key, values in COSTS.items()}
    for key, values in costs.items():
        while len(values) < maxes[key]:
            values.append(values[-1] if values else 0)
    for iteration in range(ITERATIONS):
        bands, bought, per_world = play(costs, BLOOM_COSTS)
        new_costs, entries = build_costs(bands, bought)
        # The prices and the campaign depend on each other, and the loop wants
        # to run away. Halve the step every round so it settles.
        if os.environ.get('DAMP', '1') == '1':
            blended: dict[str, list[int]] = {}
            for key, curve in new_costs.items():
                old = costs[key]
                blended[key] = [
                    int((old[index] + curve[index]) / 2) if curve[index] else old[index]
                    for index in range(len(curve))
                ]
        else:
            blended = new_costs
        if blended == costs:
            break
        costs = blended
    summarize(entries, per_world)
    if args.write:
        write_tree(costs)
        print(f"wrote {TREE}")


if __name__ == "__main__":
    main()
