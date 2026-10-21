"""Mirrors src/game/tree.ts and src/game/balance.ts. Keep the two in step."""

import math

TILE = 3.2
GLOBE_WORLD = 4

# cols, rows, mask cols, mask rows, cell hp, dew per cell.
# Each island is a full arc: the mask is big, and hp sets how many bottles a cell needs.
# A fresh bottle lasts 10s and Flask/Reservoir stretch it toward 20s.
# hp is tuned so that pour still takes about twenty minutes to finish an island.
WORLDS = [
    (11, 8, 133, 97, 76, 3),
    (18, 16, 244, 217, 3070, 2),
    (31, 24, 355, 275, 2400, 3),
    (34, 26, 340, 260, 13700, 5),
    (14, 9, 800, 120, 1120000, 300),
]

BASE_SCALE = 0.48
PUFF_STEP = 0.085
OVERHEAD_SEC = 15


# How much of its board an island fills.
ISLAND_FILL = [0.47, 0.5, 0.5, 0.5]


def island_radius(world: int, width: float, depth: float) -> float:
    fill = ISLAND_FILL[world] if world < len(ISLAND_FILL) else 0.47
    return min(width, depth) * fill


def island_shore(world: int, dx: float, dz: float, radius: float) -> float:
    """How far outside an island a point is. Mirrors islandShore() in balance.ts."""
    r = math.hypot(dx, dz) / radius
    ang = math.atan2(dz, dx)
    if world == 1:
        # Frostbite: a six-armed snowflake.
        spike = abs(math.cos(3 * ang))
        return r - (0.72 + 0.3 * spike**0.5)
    if world == 2:
        # The desert: a ring of land with a dry lake in the middle.
        outer = math.hypot(dx, dz) / radius
        hollow = math.hypot(dx, dz) / (radius * 0.34)
        return max(outer - 1.02, -(hollow - 1))
    if world == 3:
        # The sludge dump: an archipelago.
        main = math.hypot(dx, dz) / radius - 0.64
        islet_a = math.hypot(dx - radius * 0.72, dz - radius * 0.46) / (radius * 0.34) - 1
        islet_b = math.hypot(dx + radius * 0.78, dz - radius * 0.04) / (radius * 0.28) - 1
        islet_c = math.hypot(dx - radius * 0.06, dz + radius * 0.78) / (radius * 0.24) - 1
        return min(main, islet_a, islet_b, islet_c)
    # The first island: a soft round shape with a cove.
    lobe = (
        1
        + 0.13 * math.sin(ang * 3 + 0.7)
        + 0.08 * math.sin(ang * 5 - 1.2)
        + 0.06 * math.cos(ang * 2 + 0.4)
    )
    cove = max(0.0, 1 - math.hypot(dx + radius * 0.52, dz - radius * 0.34) / (radius * 0.62))
    return r - lobe + cove * 0.55


_LAND_CACHE: dict[int, int] = {}
_LAND_FRACTION: dict[int, float] = {}


def land_cells(world: int) -> int:
    """How many cells of an island are land. The sea is not part of the island."""
    if world in _LAND_CACHE:
        return _LAND_CACHE[world]
    cols, rows, mc, mr, hp, pay = WORLDS[world]
    if world == GLOBE_WORLD:
        _LAND_CACHE[world] = mc * mr
        _LAND_FRACTION[world] = 1.0
        return mc * mr
    w = cols * TILE
    h = rows * TILE
    radius = island_radius(world, w, h)
    cx = -TILE / 2 + w * 0.5
    cz = -TILE / 2 + h * 0.5
    count = 0
    for r in range(mr):
        for c in range(mc):
            x = ((c + 0.5) / mc) * w - TILE / 2
            z = ((r + 0.5) / mr) * h - TILE / 2
            if island_shore(world, x - cx, z - cz, radius) < 0:
                count += 1
    _LAND_CACHE[world] = count
    _LAND_FRACTION[world] = count / float(mc * mr)
    return count


def land_fraction(world: int) -> float:
    """How much of an island's board is land."""
    land_cells(world)
    return _LAND_FRACTION.get(world, 1.0)

# Blooms are the rare currency: one for every tenth of an island you restore
# and one more when the island comes back to life. Ten per island.
BLOOM_STEPS = 10

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
        "sprinkler": state["drizzle"] >= 1,
        "spin": state["sprinkler"] >= 1,
        "lightning": state["sprinkler"] >= 1 and state["specks"] >= 2,
        "zap": state["lightning"] >= 1,
        "tornado": state["lightning"] >= 1 and state["zap"] >= 1,
        "twist": state["tornado"] >= 1,
        "blush": puff >= 1,
        "bow": state["blush"] >= 1,
        "trail": state["bow"] >= 1,
        "buddy": state["trail"] >= 1,
        "sparkle": state["buddy"] >= 1,
        "hum": state["sparkle"] >= 1,
        "press": state["blush"] >= 1,
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
        (1 + 0.12 * state["circle"])
        * (1 + 0.11 * state["wide"])
        * (1 + 0.1 * state["horizon"])
        * (1 + 0.008 * state["harvest"])
        * (1 + 0.16 * state["sprinkler"])
        * (1 + 0.06 * state["spin"])
        * (1 + 0.12 * state["lightning"])
        * (1 + 0.04 * state["zap"])
        * (1 + 0.12 * state["tornado"])
        * (1 + 0.04 * state["twist"])
        * (1 + 0.12 * state["monsoon"])
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
    return (1.22 ** state["dew"]) * (1.18 ** state["bounty"]) * (1 + 0.04 * state["press"])
