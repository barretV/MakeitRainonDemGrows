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
    pass_m = re.search(r"target:.*-> (PASS|FAIL)", out)
    if pass_m and pass_m.group(1) == "FAIL":
        raise SystemExit("feel.py FAIL: target line")
    print("feel.py: PASS")


def check_world0() -> None:
    out = run([sys.executable, str(ROOT / "sim.py"), "--world", "0", "--one-buy"])
    m = re.search(r"world 0: ([\d.]+) min, (\d+) runs", out)
    if not m:
        raise SystemExit(f"sim world0: unexpected output:\n{out}")
    minutes = float(m.group(1))
    if minutes < 24 or minutes > 42:
        raise SystemExit(f"sim world0 FAIL: {minutes:.1f} min (want 24–42)")
    print(f"sim world0: PASS ({minutes:.1f} min, {m.group(2)} runs)")


def check_sync() -> None:
    out = run([sys.executable, str(ROOT / "sync_prereq.py")])
    if "FAIL" in out:
        raise SystemExit(out)
    print("sync_prereq: PASS")


def main() -> None:
    check_sync()
    check_feel()
    check_world0()
    print("\n=== balance:check ALL PASS ===")


if __name__ == "__main__":
    main()
