# Scoring Simulation Playbook

## Purpose
Use seeded Playwright simulations to compare triathlon scoring spread by profile and run duration.

## Command Examples

Quick baseline (balanced profile, 8 runs, 9 minutes):

```bash
npm run sim:quick -- --url http://127.0.0.1:4173
```

Batch profile spread (balanced + specialists + casual, 20 runs/profile):

```bash
npm run sim:batch -- --url http://127.0.0.1:4173 --runs 20
```

Duration comparison pass (same profile, different run lengths):

```bash
npm run sim:quick -- --url http://127.0.0.1:4173 --run-minutes 6
npm run sim:quick -- --url http://127.0.0.1:4173 --run-minutes 7.5
npm run sim:quick -- --url http://127.0.0.1:4173 --run-minutes 9
```

## Output
By default, results write to:

- `output/simulations/score-balance-<timestamp>.json`

Each file includes:

- run config
- per-profile summary (mean/p50/p90 totals)
- per-stage raw average and tri-point average
- per-stage tri share averages
- per-run records (raw, tri, total, endedByClock)

## Balancing Loop

1. Run baseline (`sim:batch`) with current scoring constants.
2. Compare stage tri share averages:
- target near even spread for balanced profile
- specialist profile should skew toward its specialty, but not collapse the run
3. If one stage dominates:
- increase its `K` in `src/domain/scoring.ts` (dampen conversion)
4. If one stage under-rewards:
- decrease its `K` (boost conversion)
5. Re-run `sim:batch` and compare deltas.
6. Re-check duration with 6/7.5/9 minute runs and pick the shortest setting that preserves clear stage differentiation and completion rates.
