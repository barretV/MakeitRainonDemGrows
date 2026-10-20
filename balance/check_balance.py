#!/usr/bin/env python3
"""Regression gate for balance simulators. Run: npm run balance:check"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FEEL_BASE = ROOT / "baseline_feel.txt"
WORLD0_BASE = ROOT / "baseline_world0.txt"
WORLD_NAMES = ["Dead Forest", "Frostbite", "Desert", "Toxic", "Globe"]
# Growth stays between bottles. Minutes include the pour plus a short shop.
# The first island is the short one, every island after it is a full session.
ISLAND_WINDOWS = {
    "Dead Forest": (20.0, 42.0),
    "Frostbite": (24.0, 46.0),
    "Desert": (24.0, 46.0),
    "Toxic": (24.0, 46.0),
    "Globe": (24.0, 46.0),
}


def run(cmd: list[str]) -> str:
    r = subprocess.run(cmd, cwd=ROOT.parent, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stdout, r.stderr, file=sys.stderr)
        raise SystemExit(r.returncode)
    return r.stdout


def check_feel() -> None:
    out = run([sys.executable, str(ROOT / "feel.py")])
    dry_m = re.search(r"dry runs \(no buy\), first 25: (\d+)/25", out)
    if not dry_m:
        raise SystemExit("feel.py: missing dry run summary")
    dry = int(dry_m.group(1))
    if dry > 2:
        raise SystemExit(f"feel.py FAIL: {dry} dry runs in first 25 (max 2)")
    avg_m = re.search(r"avg purchases/run \(first 25\): ([\d.]+)", out)
    if not avg_m:
        raise SystemExit("feel.py: missing purchases/run summary")
    avg = float(avg_m.group(1))
    if avg > 1.35:
        raise SystemExit(f"feel.py FAIL: {avg:.2f} buys/run in first 25 (max 1.35)")
    pass_m = re.search(r"target:.*-> (PASS|FAIL)", out)
    if pass_m and pass_m.group(1) == "FAIL":
        raise SystemExit("feel.py FAIL: target line")
    print("feel.py: PASS")


def check_world0() -> None:
    out = run([sys.executable, str(ROOT / "sim.py"), "--world", "0"])
    m = re.search(r"world 0: ([\d.]+) min, (\d+) runs", out)
    if not m:
        raise SystemExit(f"sim world0: unexpected output:\n{out}")
    minutes = float(m.group(1))
    if minutes < 18 or minutes > 40:
        raise SystemExit(f"sim world0 FAIL: {minutes:.1f} min (want 18–40)")
    print(f"sim world0: PASS ({minutes:.1f} min, {m.group(2)} runs)")


def check_campaign() -> None:
    """One buy per bottle across the whole campaign: every island must be a full arc."""
    out = run([sys.executable, str(ROOT / "sim.py")])
    for name in WORLD_NAMES:
        m = re.search(rf"^{re.escape(name)}\s+(\d+)\s+([\d.]+)", out, re.MULTILINE)
        if not m:
            raise SystemExit(f"sim campaign: missing row for {name}:\n{out}")
        runs = int(m.group(1))
        minutes = float(m.group(2))
        lo, hi = ISLAND_WINDOWS[name]
        if minutes < lo or minutes > hi:
            raise SystemExit(f"sim {name} FAIL: {minutes:.1f} min (want {lo:.0f}-{hi:.0f})")
        print(f"sim {name}: PASS ({minutes:.1f} min, {runs} runs)")


def check_sync() -> None:
    out = run([sys.executable, str(ROOT / "sync_prereq.py")])
    if "FAIL" in out:
        raise SystemExit(out)
    print("sync_prereq: PASS")


def main() -> None:
    check_sync()
    check_feel()
    check_world0()
    check_campaign()
    print("\n=== balance:check ALL PASS ===")


if __name__ == "__main__":
    main()
