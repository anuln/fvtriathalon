# Amp Stage 3 Score Reduction Plan

**Goal:** Reduce Stage 3 (Amp Invaders) score dominance so total tri points are less skewed, without changing run duration yet.

## Targets
- Bring Amp average tri share for balanced profile toward `0.45-0.55` (currently much higher in smoke runs).
- Keep Amp as a viable specialist path, but avoid it eclipsing Stage 1/2 in normal play.
- Preserve Stage 3 pacing and difficulty feel; only score economy changes in this pass.

## Scope for this pass
- In scope: Stage 3 raw point economy and conversion tuning.
- Out of scope: Run duration (`runMinutes`) tuning and stage timer changes.

## Step-by-step implementation

### 1) Add score source instrumentation (Amp only)
- File: `src/main.ts` (Amp stage runtime block)
- Track per-source raw contributions:
- enemy kills
- disco pickups
- wave clear bonus
- boss transition bonus
- boss defeat bonus
- charge-shot bonus
- Expose these counters in `debugState()` for deterministic review.

### 2) Reduce high-leverage raw rewards
- File: `src/main.ts` (Amp stage runtime block)
- Apply first-pass reductions:
- Wave clear bonus: `120 -> 80`
- Boss entry bonus: `300 -> 180`
- Boss defeat bonus: `900 -> 520`
- Disco bonus: `220 -> 140`
- Keep basic kill rewards initially unchanged to preserve moment-to-moment feedback.

### 3) Add soft anti-snowball scaling after wave 2
- File: `src/main.ts`
- Introduce a wave-based multiplier for bonus sources only (not basic kills), e.g.:
- wave 1-2: `1.00`
- wave 3: `0.88`
- wave 4: `0.80`
- boss phase: `0.74`
- This dampens late-run bonus spikes while maintaining progression identity.

### 4) Keep Amp normalization conservative
- File: `src/domain/scoring.ts`
- Keep (or increase slightly) Amp `K` relative to other stages if needed after raw reductions.
- Principle: fix raw economy first, normalization second.

### 5) Validation loop (no duration experiments)
- Run only `9-minute` baseline simulations while tuning:
- `npm run sim:quick -- --url http://127.0.0.1:4173`
- `npm run sim:batch -- --url http://127.0.0.1:4173 --profiles balanced,snake-specialist,pac-specialist,amp-specialist`
- Compare:
- stage tri share averages
- p50/p90 total tri
- Amp specialist delta vs balanced
- Stop when Amp share target band is met and specialist identity remains visible.

## Acceptance criteria
- Balanced profile: Amp stage tri share average in `0.45-0.55`.
- Amp specialist profile remains highest on Amp, but balanced total is not overwhelmingly Amp-driven.
- Existing tests still pass:
- `npm run test`
- `npm run lint`
- `npm run build`
- `npm run test:e2e -- e2e/stage-flow.spec.ts e2e/triathlon-flow.spec.ts`

