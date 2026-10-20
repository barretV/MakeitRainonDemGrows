"""Mirrors src/game/tree.ts and src/game/balance.ts. Keep the two in step."""

import math

TILE = 3.2
GLOBE_WORLD = 4

# cols, rows, mask cols, mask rows, cell hp, dew per cell.
# Each island is a full arc: the mask is big, and hp sets how many bottles a cell needs.
# A fresh bottle lasts 10s and Flask/Reservoir stretch it toward 20s.
# hp is tuned so that pour still takes about twenty minutes to finish an island.
WORLDS = [
    (8, 6, 100, 75, 76, 3),
    (18, 16, 180, 160, 1134, 2),
    (31, 24, 310, 240, 1000, 3),
    (34, 26, 340, 260, 11312, 4),
    (14, 9, 800, 120, 47919, 4),
]

BASE_SCALE = 0.48
PUFF_STEP = 0.085
OVERHEAD_SEC = 15

from upgrade_loader import (
    build_bloom_costs,
    build_costs,
    build_priority_unique,
    build_world_min,
)

# From balance/upgrades.json — run `npm run dump-upgrades` after editing src/game/tree.ts
COSTS = build_costs()
BLOOM_COSTS = build_bloom_costs()
WORLD_MIN = build_world_min()
MAXED = {key: len(costs) for key, costs in COSTS.items()}
PRIORITY_UNIQUE = build_priority_unique()


def prereq(node, state):
    puff = state["puff"]
    if node == "puff":
        return True
    if node == "bottle":
        return puff >= 1
    if node == "drizzle":
        return state["bottle"] >= 1
    if node == "reach":
        return state["drizzle"] >= 1
    if node == "charm":
        return state["reach"] >= 1
    checks = {
        "flask": state["bottle"] >= 1,
        "reservoir": state["flask"] >= 1,
        "linger": state["reservoir"] >= 1,
        "glacier": state["linger"] >= 2,
        "specks": state["drizzle"] >= 1,
        "mist": state["specks"] >= 1,
        "soak": state["mist"] >= 1,
        "downpour": state["soak"] >= 2,
        "geyser": state["soak"] >= 1,
        "spore": state["specks"] >= 1,
        "hail": state["mist"] >= 1,
        "monsoon": state["downpour"] >= 1,
        "flow": state["soak"] >= 2,
        "spring": state["mist"] >= 2,
        "circle": state["reach"] >= 1,
        "waterbomb": state["circle"] >= 1,
        "wide": state["circle"] >= 1,
        "horizon": state["wide"] >= 2,
        "mirage": state["wide"] >= 1,
        "rainbow": state["charm"] >= 1,
        "dew": state["charm"] >= 1,
        "bounty": state["dew"] >= 1,
        "purify": state["bounty"] >= 1,
        "harvest": state["bounty"] >= 4,
        "crit": state["bounty"] >= 1,
        "sprinkler": state["crit"] >= 2,
        "spin": state["sprinkler"] >= 1,
        "lightning": state["sprinkler"] >= 1 and state["crit"] >= 3,
        "zap": state["lightning"] >= 1,
        "tornado": state["lightning"] >= 1 and state["zap"] >= 2,
        "twist": state["tornado"] >= 1,
    }
    return checks[node]


def cloud_scale(state):
    return BASE_SCALE + state["puff"] * PUFF_STEP


def bottle_seconds(state):
    """10s at rank 0. Each Flask or Reservoir rank is +1s. Linger/Glacier add a short sip."""
    stretch = (state["flask"] + state["reservoir"]) * 1.25
    sip = state["linger"] * 0.35 + state["glacier"] * 0.25
    return 10 + stretch + sip


def drain_per_sec(state):
    """Pour rate is steady. Cascade sinks harder via soak_per_tick, it does not shorten the bottle."""
    del state
    return 46


def max_liters(state):
    return drain_per_sec(state) * bottle_seconds(state)


def rain_radius(state):
    grown = cloud_scale(state) / BASE_SCALE
    reach = (
        (1 + 0.23 * state["circle"])
        * (1 + 0.21 * state["wide"])
        * (1 + 0.19 * state["horizon"])
        * (1 + 0.12 * state["harvest"])
        * (1 + 0.16 * state["sprinkler"])
        * (1 + 0.06 * state["spin"])
        * (1 + 0.12 * state["lightning"])
        * (1 + 0.04 * state["zap"])
        * (1 + 0.12 * state["tornado"])
        * (1 + 0.04 * state["twist"])
        * (1 + 0.7 * state["monsoon"])
    )
    return 0.92 * grown * reach


def soak_per_tick(state):
    return 1.35 * (1.28 ** state["soak"]) * (1.22 ** state["downpour"]) * (1.3 ** state["flow"])


def pool_gain(state):
    """Fraction of spilled rain that pools on finished ground (Meadow Spring)."""
    return 0.72 + 0.22 * state["spring"]


def pool_flow(state):
    """How much of a standing pool seeps into its neighbour each step."""
    return 0.9 + 0.12 * state["spring"]


def patch_fraction(state):
    return min(1.0, 0.18 + state["specks"] * 0.09 + state["mist"] * 0.075)


def crit_chance(state):
    return min(0.4, state["crit"] * 0.06)


def dew_multiplier(state):
    return (1.22 ** state["dew"]) * (1.18 ** state["bounty"])
