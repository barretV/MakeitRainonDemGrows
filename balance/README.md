# Balance tooling

**Costs & priority:** edit [`src/game/tree.ts`](../src/game/tree.ts), then run `npm run dump-upgrades` to refresh [`balance/upgrades.json`](upgrades.json). Python sims load costs, bloom costs, island gates, and the buy order from that file via `upgrade_loader.py`.

World tuning still lives in `game_constants.py` (`WORLDS`, `PUFF_STEP`, etc.). Keep its hp/pay/mask values in step with `src/game/balance.ts` + `maskOf()` in `src/game/tree.ts`.

## Commands

```bash
python balance/feel.py         # Early-run purchases + power stats
python balance/progression.py  # Bottle-by-bottle cadence for the whole campaign
python balance/diagnose.py     # Restoration curve + dead zones
python balance/bloom_feel.py   # Bloom earn vs what the bloom branch costs
python balance/analytics.py play.json   # Real play vs the simulator
python balance/sim.py          # Full campaign (greedy shop)
python balance/sim.py --one-buy     # Player-like single upgrade per bottle
python balance/tune.py --world 4    # Solve one island's hp for its target minutes
python balance/reprice.py --write   # Re-price the tree from the income curve
npm run balance:check          # Regression gate (feel + world 0 + per-island + sync)
npm run dump-upgrades          # Refresh upgrades.json from tree.ts
```

## Currencies

- **dew** buys tree ranks (earned from mask cells).
- **blooms** are the rare currency: **one per tenth of an island you restore, and
  one more when the island comes back to life**. Ten per island, fifty over the
  campaign, so a bloom is a real decision. The bloom branch of the tree (the
  cosmetics plus Pressed Petals) is bought with blooms only, and the storm
  powers ask for a few blooms on top of their dew.
- Powers also have an **island gate** (`worldMin`): the tree only offers them once
  that island is reached, so each island arrives with its own toys.

Most powerful ranks cost **both** currencies; cheap early ranks are dew-only.

## PASS criteria

- **feel.py:** ≤2 dry runs (no workshop purchase) in the first 25 runs on world 0.
- **progression.py:** early game buys roughly one rank per bottle (sometimes more), no long stalls.
- **sim.py:** greedy shop on a fresh island. Prices should hold the shop near one rank per bottle. `check_balance.py` checks each island's minute window (20–42 minutes for the first island, 24–46 for the rest).
- **tune.py:** solves `hp` for a target minute count; copy the printed hp into
  both `game_constants.py` and `src/game/balance.ts`. The curve is a staircase
  (below a threshold every cell fills in one bottle, above it every cell needs
  two), so the tuner scans a log grid instead of bisecting. The globe mask is
  much larger than the flat islands (800×120) so its per-run ability bonuses do
  not trivialise the finale; keep `maskOf()` and `WORLDS` in sync.

## Paint model

`cells_per_run()` assumes each wet mask cell in the rain disc receives full
`soak_per_tick` every 0.1s (same as `SaveState.paint()`), then multiplies the
area by the spill chain (`SPILL_GAIN`): real play greens far more than the disc
alone, because water that lands on a finished patch spills outward and wakes the
dry holes the patch gate skipped. That factor was measured against dev builds
(see below) and is what makes the simulator agree with the game.

`reprice.py --write` re-prices the tree from the income curve so one bottle's
income buys about one rank, then `enforce_one_buy` keeps the shop at one rank
per bottle. Bloom prices are hand designed: blooms are rare, not an income.

## Real play vs the simulator

A dev build records every bottle the player pours (island, seconds, dew, cells,
blooms, radius, what was bought). Dump it with:

```bash
node scripts/dump-analytics.mjs --world 0 --bottles 8 --out balance/play-world0.json
python balance/analytics.py balance/play-world0.json
```

The report lines the real ledger up against the model bottle by bottle and
prints the drift, the first rank bought per node and the run it landed on. Use
it whenever the economy changes: the simulator is only a model until a real
build says otherwise.
