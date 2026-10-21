#!/usr/bin/env python3
"""Tune the islands so every one of them takes about the right time.

The time an island takes is roughly the cell hp times the number of cells,
divided by how fast the cloud works. Raise the hp and the island takes
longer. The two files that hold the numbers (the game and the balance
mirror) are written together so they cannot drift.

    python balance/tune_hp.py            # print what it would do
    python balance/tune_hp.py --write    # write the new numbers
"""
from __future__ import annotations

import argparse
import io
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GAME = ROOT / "src" / "game" / "balance.ts"
MIRROR = ROOT / "balance" / "game_constants.py"

# Minutes an island should take. The first island teaches, the rest grow.
TARGET_MINUTES = [20.0, 26.0, 24.0, 26.0, 28.0]
MINUTES = 8.0
MAX_MINUTES = 60.0


def sim_times() -> list[float]:
    out = subprocess.run(
        [sys.executable, str(ROOT / "balance" / "sim.py")],
        capture_output=True,
        text=True,
        cwd=ROOT / "balance",
    )
    if out.returncode != 0:
        raise SystemExit(out.stdout + out.stderr)
    times = []
    for line in out.stdout.splitlines():
        match = re.match(r"^\S.*?\s{2,}(\d+)\s+([\d.]+)\s", line)
        if match:
            times.append(float(match.group(2)))
    return times


def read_hp() -> list[int]:
    text = io.open(GAME, encoding="utf-8").read()
    return [int(v) for v in re.findall(r"hp: (\d+),", text)]


def read_pay() -> list[int]:
    text = io.open(GAME, encoding="utf-8").read()
    return [int(v) for v in re.findall(r"pay: (\d+),", text)]


def write_hp(hp: list[int], pay: list[int]) -> None:
    text = io.open(GAME, encoding="utf-8").read()
    index = 0

    def swap(match):
        nonlocal index
        value = hp[index]
        index += 1
        return match.group(1) + str(value) + match.group(3)

    text = re.sub(r"(hp: )(\d+)(,)", swap, text)
    if index != len(hp):
        raise SystemExit("the game file has a different number of islands")
    index = 0

    def swap_pay(match):
        nonlocal index
        value = pay[index]
        index += 1
        return match.group(1) + str(value) + match.group(3)

    text = re.sub(r"(pay: )(\d+)(,)", swap_pay, text)
    io.open(GAME, "w", encoding="utf-8", newline="").write(text)

    mirror = io.open(MIRROR, encoding="utf-8").read()
    lines = mirror.splitlines()
    out = []
    world = 0
    for line in lines:
        match = re.match(r"^(\s*)\((\d+), (\d+), (\d+), (\d+), (\d+), (\d+)\),$", line)
        if match:
            cols, rows, mc, mr, old, old_pay = match.group(2), match.group(3), match.group(4), match.group(5), match.group(6), match.group(7)
            out.append(f"{match.group(1)}({cols}, {rows}, {mc}, {mr}, {hp[world]}, {pay[world]}),")
            world += 1
        else:
            out.append(line)
    io.open(MIRROR, "w", encoding="utf-8", newline="").write("\n".join(out) + "\n")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--rounds", type=int, default=4)
    args = parser.parse_args()

    hp = read_hp()
    pay = read_pay()
    # A tougher cell pays less, because a cell is only finished when it has
    # been soaked through. The reward per cell follows the toughness so the
    # income of an island stays the same no matter how long it takes.
    pay_per_hp = pay[0] / hp[0]
    for round_index in range(args.rounds):
        times = sim_times()
        if len(times) != len(hp):
            raise SystemExit("the sim and the game disagree about the islands")
        new_hp = []
        for value, minutes, target in zip(hp, times, TARGET_MINUTES):
            scale = target / max(0.5, minutes)
            # The prices follow the income and the income follows the islands,
            # so a big jump in one round makes the next round wrong. Move in
            # small steps and let it settle.
            scale = min(1.25, max(0.8, scale))
            scaled = max(1, int(round(value * scale)))
            new_hp.append(scaled)
        new_pay = list(pay)
        print(
            f"round {round_index}: "
            + ", ".join(
                f"{m:.1f}->{t:.0f}min hp {v}->{n} pay {p}->{q}"
                for m, t, v, n, p, q in zip(times, TARGET_MINUTES, hp, new_hp, pay, new_pay)
            )
        )
        if new_hp == hp and new_pay == pay:
            break
        hp = new_hp
        pay = new_pay
        if args.write:
            write_hp(hp, pay)
    if args.write:
        print("wrote the new island numbers")


if __name__ == "__main__":
    main()
