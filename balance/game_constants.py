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
PUFF_STEP = 0.085
OVERHEAD_SEC = 10

# Costs tuned for ~1–2 workshop buys per run early (see balance/diagnose.py).
COSTS = {
    "puff": [4, 8, 22, 55, 130, 300, 690, 1550],
    "bottle": [9],
    "flask": [11, 26, 60, 138, 320],
    "reservoir": [42, 100, 230, 530, 1220],
    "linger": [52, 125, 290, 670, 1550],
    "glacier": [200, 460, 1050, 2400],
    "drizzle": [10],
    "specks": [13, 32, 75, 172, 400],
    "mist": [55, 132, 305, 700, 1620],
    "soak": [20, 48, 112, 260, 600],
    "downpour": [4500, 11200, 25500, 55000],
    "reach": [12],
    "circle": [14, 34, 78, 180, 415],
    "wide": [62, 148, 340, 7800, 19200],
    "horizon": [14000, 31000, 60000, 105000],
    "charm": [13],
    "dew": [15, 36, 84, 195, 450],
    "bounty": [78, 188, 435, 1000],
    "crit": [85, 205, 475, 1100],
    "sprinkler": [19000],
    "spin": [25000, 54000, 115000],
    "lightning": [42000],
    "zap": [50000, 105000, 210000],
    "tornado": [125000],
    "twist": [145000, 270000, 500000],
}

MAXED = {key: len(costs) for key, costs in COSTS.items()}

# Greedy shop: first affordable in this order (interleaved branches).
PRIORITY_UNIQUE = [
    "puff",
    "bottle",
    "flask",
    "reach",
    "circle",
    "drizzle",
    "specks",
    "charm",
    "dew",
    "soak",
    "reservoir",
    "mist",
    "wide",
    "bounty",
    "linger",
    "crit",
    "downpour",
    "horizon",
    "glacier",
    "sprinkler",
    "spin",
    "lightning",
    "zap",
    "tornado",
    "twist",
]


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
