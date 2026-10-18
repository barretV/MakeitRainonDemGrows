"""Mirrors src/game/tree.ts and src/game/balance.ts. Keep the two in step."""

TILE = 3.2

# cols, rows, mask cols, mask rows, cell hp, dew per cell
WORLDS = [
    (8, 6, 100, 75, 72, 3),
    (13, 9, 130, 90, 720, 2),
    (15, 11, 150, 110, 820, 3),
    (17, 12, 170, 120, 680, 4),
    (14, 9, 140, 90, 680, 4),
]

BASE_SCALE = 0.48
PUFF_STEP = 0.075
OVERHEAD_SEC = 8

COSTS = {
    # Early ranks are cheap so almost every run buys something (see balance/feel.py).
    "puff": [6, 11, 26, 62, 145, 340, 780, 1750],
    "bottle": [8],
    "flask": [12, 30, 72, 165, 380],
    "reservoir": [38, 95, 220, 500, 1150],
    "linger": [48, 115, 265, 620, 1450],
    "glacier": [180, 420, 980, 2200],
    "drizzle": [9],
    "specks": [14, 34, 82, 190, 440],
    "mist": [52, 125, 290, 670, 1550],
    "soak": [18, 44, 105, 245, 560],
    "downpour": [4200, 10500, 24000, 52000],
    "reach": [10],
    "circle": [16, 40, 95, 220, 510],
    "wide": [58, 140, 325, 7500, 18500],
    "horizon": [13500, 30000, 58000, 100000],
    "charm": [11],
    "dew": [15, 38, 90, 210, 480],
    "bounty": [72, 180, 420, 960],
    "crit": [78, 195, 450, 1050],
    "sprinkler": [18000],
    "spin": [24000, 52000, 110000],
    "lightning": [40000],
    "zap": [48000, 100000, 200000],
    "tornado": [120000],
    "twist": [140000, 260000, 480000],
}

MAXED = {key: len(costs) for key, costs in COSTS.items()}

PRIORITY = [
    "puff", "bottle", "drizzle", "reach", "charm",
    "flask", "specks", "circle", "dew", "soak",
    "reservoir", "mist", "wide", "bounty", "linger",
    "crit", "downpour", "horizon", "glacier",
    "sprinkler", "spin", "lightning", "zap", "tornado", "twist",
]


def prereq(node, state):
    puff = state["puff"]
    if node == "puff":
        return True
    if node in ("bottle", "drizzle", "reach", "charm"):
        return puff >= 1
    checks = {
        "flask": state["bottle"] >= 1,
        "reservoir": state["flask"] >= 1,
        "linger": state["reservoir"] >= 1,
        "glacier": state["linger"] >= 2,
        "specks": state["drizzle"] >= 1,
        "mist": state["specks"] >= 1,
        "soak": state["mist"] >= 1,
        "downpour": state["soak"] >= 2,
        "circle": state["reach"] >= 1,
        "wide": state["circle"] >= 1,
        "horizon": state["wide"] >= 2,
        "dew": state["charm"] >= 1,
        "bounty": state["dew"] >= 1,
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


def max_liters(state):
    return 260 * (1.22 ** state["flask"]) * (1.18 ** state["reservoir"])


def drain_per_sec(state):
    return 46 / (1.1 ** state["linger"]) / (1.08 ** state["glacier"])


def bottle_seconds(state):
    return max_liters(state) / drain_per_sec(state)


def rain_radius(state):
    grown = cloud_scale(state) / BASE_SCALE
    reach = (1 + 0.18 * state["circle"]) * (1 + 0.16 * state["wide"]) * (1 + 0.14 * state["horizon"])
    return 0.92 * grown * reach


def soak_per_tick(state):
    return 1.35 * (1.28 ** state["soak"]) * (1.22 ** state["downpour"])


def patch_fraction(state):
    return min(0.84, 0.15 + state["specks"] * 0.05 + state["mist"] * 0.045)


def crit_chance(state):
    return min(0.4, state["crit"] * 0.06)


def dew_multiplier(state):
    return (1.22 ** state["dew"]) * (1.18 ** state["bounty"])
