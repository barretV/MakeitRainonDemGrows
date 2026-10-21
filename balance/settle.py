#!/usr/bin/env python3
"""Settle the balance: re-price the shop, then tune the islands, until both
agree. The prices follow the income and the income follows the islands, so the
two have to be worked out together.

    python balance/settle.py --rounds 4
"""
from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BAL = ROOT / "balance"
NPX = shutil.which("npx.cmd") or shutil.which("npx") or "npx"


def run(args, cwd=ROOT):
    out = subprocess.run(args, capture_output=True, text=True, cwd=str(cwd))
    if out.returncode != 0:
        raise SystemExit(out.stdout + out.stderr)
    return out.stdout


def sim_line() -> str:
    out = run([sys.executable, str(BAL / "sim.py")], cwd=BAL)
    for line in out.splitlines():
        if line.startswith("Dead Forest"):
            return line
    return ""


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--rounds", type=int, default=4)
    args = parser.parse_args()
    for index in range(args.rounds):
        run([sys.executable, str(BAL / "reprice.py"), "--write"], cwd=BAL)
        run([NPX, "tsx", str(ROOT / "scripts" / "dump-upgrades.mjs")], cwd=ROOT)
        run([sys.executable, str(BAL / "tune_hp.py"), "--write", "--rounds", "1"], cwd=BAL)
        print(f"--- round {index} ---")
        print(sim_line())
        print(run([sys.executable, str(BAL / "sim.py")], cwd=BAL).split("total:")[-1].strip())


if __name__ == "__main__":
    main()
