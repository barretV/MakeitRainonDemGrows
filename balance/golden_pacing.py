#!/usr/bin/env python3
"""Compare live golden world 0 to the balance sim (Shell Diver pacing target).

    python balance/golden_pacing.py
    python balance/golden_pacing.py balance/golden-world0.json
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from game_constants import WORLDS, land_cells, soak_per_tick, bottle_seconds
from sim import new_state, clear_world, cells_per_run

ROOT = Path(__file__).resolve().parent
GOLDEN = ROOT / "golden-world0.json"


def load_golden(path: Path) -> list[dict]:
    data = json.loads(path.read_text(encoding="utf-8"))
    return [b for b in data.get("bottles", []) if b.get("world") == 0]


def main() -> None:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else GOLDEN
    if not path.exists():
        print(f"missing {path}")
        sys.exit(1)
    bottles = load_golden(path)
    if not bottles:
        print("no world 0 bottles in ledger")
        sys.exit(1)
    total_land = land_cells(0)
    print("=== GOLDEN WORLD 0 (Dead Forest) ===")
    print(f"bottles: {len(bottles)}  cleared: {bottles[-1].get('reason') == 'cleared'}")
    print(f"final ranks: {bottles[-1].get('rankTotal')}  wallet: {bottles[-1].get('dewWallet')} dew")
    print()
    print("bottle  dew/run  cells  peak%  ranks  puff")
    for b in bottles:
        print(
            f"  {b.get('globalBottle', b.get('run')):2d}   "
            f"{b.get('dew', 0):6d}  {b.get('cells', 0):4d}  "
            f"{100 * b.get('peak', 0):5.1f}  {b.get('rankTotal', 0):3d}  "
            f"{b.get('ranks', {}).get('puff', 0)}"
        )
    avg_ranks = bottles[-1].get("rankTotal", 0) / len(bottles)
    print(f"\n~{avg_ranks:.1f} ranks/bottle on island 0 (spread later islands via pricing + gates).")

    st = new_state()
    r = clear_world(st, 0, 0, 0, 0, None)
    print("\n=== SIM world 0 (greedy) ===")
    print(f"{r['runs']} bottles  {r['minutes']:.1f} min  ranks {sum(st.values())}  dry {r['dry_runs']}")

    st = new_state()
    clear_world(st, 0, 0, 0, 0, None)
    soak = soak_per_tick(st) * (bottle_seconds(st) / 0.1)
    one_shot = int(soak / 0.92)
    hp1 = WORLDS[1][4]
    cells, _, _ = cells_per_run(st, 1, 0.0)
    pct = 100 * cells / land_cells(1)
    print("\n=== WORLD 1 ARRIVAL (after sim clears world 0) ===")
    print(f"soak/bottle ~{soak:.0f}  one-shot hp <= {one_shot}  current hp={hp1}")
    print(f"first bottle greens ~{cells:.0f} cells ({pct:.2f}% of Frostbite)")
    if hp1 > one_shot:
        print("WARNING: hp above one-shot — expect multi-pass slog unless pour power rises.")


if __name__ == "__main__":
    main()
