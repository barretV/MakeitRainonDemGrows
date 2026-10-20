#!/usr/bin/env python3
"""Compare real play against the balance simulator.

The simulator is a model. This reads a ledger exported from a dev build
(`window.__rain.analytics()`), shows what the game really paid out bottle by
bottle, and lines it up against the model so the drift is visible.

    python balance/analytics.py play.json
    python balance/analytics.py play.json --world 0

The ledger is written by scripts/dump-analytics.mjs.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from game_constants import PRIORITY_UNIQUE, bottle_seconds, rain_radius
from sim import WORLD_NAMES, cells_per_run, mask_count, new_state


def load(path: str):
    with open(path, "r", encoding="utf-8") as handle:
        data = json.load(handle)
    if isinstance(data, list):
        return data
    return data.get("runs", [])


def model_runs(world: int):
    """What the simulator thinks one island is worth, bottle by bottle."""
    state = new_state()
    total = mask_count(world)
    restored = 0.0
    rows = []
    for run in range(1, 1201):
        ratio = restored / total if total else 0.0
        cells, dew, seconds = cells_per_run(state, world, ratio)
        restored = min(float(total), restored + cells)
        rows.append(
            {
                "run": run,
                "seconds": seconds,
                "dew": dew,
                "cells": cells,
                "radius": rain_radius(state),
                "ratio": restored / total if total else 1.0,
            }
        )
        if total <= 0 or restored / total >= 0.98:
            break
    return rows


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("ledger", help="JSON exported from a dev build")
    parser.add_argument("--world", type=int, default=None, help="only this island")
    parser.add_argument("--rows", type=int, default=12, help="how many bottles to print")
    args = parser.parse_args()

    path = Path(args.ledger)
    if not path.exists():
        print(f"no ledger at {path}")
        sys.exit(1)
    runs = load(str(path))
    if not runs:
        print("ledger is empty")
        return

    worlds = sorted({int(run["world"]) for run in runs})
    if args.world is not None:
        worlds = [args.world]

    print("=== REAL PLAY vs SIMULATOR ===")
    for world in worlds:
        real = [run for run in runs if int(run["world"]) == world]
        model = model_runs(world)
        name = WORLD_NAMES[world] if world < len(WORLD_NAMES) else f"world {world}"
        print(f"\n-- {name} (island {world + 1}) --")
        print("  real: %d bottles, %.1f min, %d dew, %d cells, %d blooms" % (
            len(real),
            sum(run["seconds"] for run in real) / 60,
            sum(run["dew"] for run in real),
            sum(run["cells"] for run in real),
            sum(run["blooms"] for run in real),
        ))
        model_dew = sum(row["dew"] for row in model)
        model_minutes = sum(row["seconds"] for row in model) / 60
        print("  sim : %d bottles, %.1f min, %d dew, %d cells" % (
            len(model), model_minutes, model_dew, sum(row["cells"] for row in model)
        ))
        if model_dew > 0:
            drift = (sum(run["dew"] for run in real) - model_dew) / model_dew * 100
            print(f"  dew drift: {drift:+.1f}%  (real minus model)")
        print("  run   real dew / cells      model dew / cells     radius real/model")
        for index in range(min(args.rows, len(real))):
            row = real[index]
            model_row = model[index] if index < len(model) else {"dew": 0, "cells": 0, "radius": 0}
            print(
                "  %3d   %8.0f / %5d        %8.0f / %5d        %5.2f / %5.2f"
                % (
                    row["run"],
                    row["dew"],
                    row["cells"],
                    model_row["dew"],
                    model_row["cells"],
                    row["radius"],
                    model_row["radius"],
                )
            )
        unlocks = []
        for row in real:
            for buy in row.get("buys", []):
                unlocks.append((row["run"], buy))
        if unlocks:
            print("  unlocks (run, node):", ", ".join(f"r{run}:{what}" for run, what in unlocks[:24]))
            first = {}
            for run, what in unlocks:
                node = "".join(ch for ch in what if not ch.isdigit())
                first.setdefault(node, run)
            print("  first rank per node:", ", ".join(f"{node}@r{run}" for node, run in list(first.items())[:24]))


if __name__ == "__main__":
    main()
