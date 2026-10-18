# Balance tooling

Python constants in `game_constants.py` mirror `src/game/balance.ts` and `src/game/tree.ts`. Update both when tuning worlds or upgrade costs.

## Commands

```bash
python balance/feel.py      # Early-run purchases + power stats (1 buy/run)
python balance/diagnose.py  # Restoration curve + dead zones
python balance/sim.py       # Full campaign (greedy shop)
python balance/sim.py --world 0 --one-buy   # Player-like single upgrade per bottle
```

## PASS criteria

- **feel.py:** ≤2 dry runs (no workshop purchase) in the first 25 runs on world 0.
- **sim.py:** Each world should land near **30–40 minutes** to ~98% restored. If a world is far under/over, adjust that world’s `hp` / `pay` and re-run.

## Paint model

`cells_per_run()` assumes each wet mask cell in the rain disc receives full `soak_per_tick` every 0.1s (same as `SaveState.paint()`). Land **persists** between bottles (`filled_ratio` shrinks new cells as the island greens). When a bottle does not reach `hp`, partial progress uses the 22% micro-drip factor (matches `state.ts`).
