# Balance tooling

**Costs & priority:** edit [`src/game/tree.ts`](../src/game/tree.ts), then run `npm run dump-upgrades` to refresh [`balance/upgrades.json`](upgrades.json). Python sims load costs from that file via `upgrade_loader.py`.

World tuning still lives in `game_constants.py` (`WORLDS`, `PUFF_STEP`, etc.).

## Commands

```bash
python balance/feel.py      # Early-run purchases + power stats (1 buy/run)
python balance/diagnose.py  # Restoration curve + dead zones
python balance/petal_feel.py  # Bloom earn vs petal shop
python balance/sim.py       # Full campaign (greedy shop)
python balance/sim.py --world 0 --one-buy   # Player-like single upgrade per bottle
npm run balance:check       # Regression gate (feel + world0 + sync)
npm run dump-upgrades       # Refresh upgrades.json from tree.ts
```

## PASS criteria

- **feel.py:** ≤2 dry runs (no workshop purchase) in the first 25 runs on world 0.
- **sim.py:** Each world should land near **30–40 minutes** to ~98% restored. If a world is far under/over, adjust that world’s `hp` / `pay` and re-run.

## Paint model

`cells_per_run()` assumes each wet mask cell in the rain disc receives full `soak_per_tick` every 0.1s (same as `SaveState.paint()`). Land **persists** between bottles (`filled_ratio` shrinks new cells as the island greens). When a bottle does not reach `hp`, partial progress uses the 22% micro-drip factor (matches `state.ts`).

`playtest_factor()` scales early world-0 earn so run 1 ≈ **4 whole dew** (sparse rank-0 rain), matching real playtests—not the optimistic full-disc completion model.
