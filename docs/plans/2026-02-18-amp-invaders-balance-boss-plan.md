# Amp Invaders Stage 3 v2 Balance + Boss Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebalance Amp Invaders so Stage 3 remains threatening after player spread upgrades by adding progressive enemy aggression, special fly-down threats, and a boss encounter after wave 4.

**Architecture:** Keep spread-tier progression strictly wave-clear based, but introduce a parallel enemy pressure system driven by config: fire density, shot patterns, special unit cadence, and wave-specific role mix. After completing wave 4, transition to a deterministic boss state machine with telegraphed attack phases.

**Tech Stack:** TypeScript, Canvas2D runtime (`src/main.ts`), config modules in `src/games/amp-invaders`, Vitest, Playwright.

---

## Design Summary (MDA)

### Mechanics
- Player upgrades: unchanged rule, only on wave clear (`tier 1 -> 4`).
- Enemy scaling: per-wave aggression multipliers + pattern unlocks.
- Specials: periodic fly-down units with explicit telegraph windows.
- Boss: 3-phase fight after wave 4 with weak-point windows.

### Dynamics
- Early waves stay readable, but sustained positioning and shield management become mandatory by wave 3.
- Spread power feels strong, but enemy behaviors counter static lane camping.
- Boss acts as conversion test: can the player apply spread pressure while dodging mixed threats?

### Aesthetics
- Stage 3 should feel like escalation to a finale, not a victory lap.
- Tension curve: control confidence -> pressure stacking -> survival scramble -> boss showdown.

---

## Approach Options

1. **Director-based escalation + boss (Recommended)**
- Add a lightweight enemy director that scales cadence, burst patterns, and special spawns by wave and elapsed time.
- Pros: highest control over fairness/readability and easiest tuning.
- Cons: needs more config/test surface.

2. **Pure stat ramp**
- Only increase enemy HP, speed, and fire rate.
- Pros: fastest to implement.
- Cons: often feels unfair/boring and does not solve pattern variety.

3. **Boss-only patch**
- Keep waves mostly as-is, add strong boss.
- Pros: quick headline feature.
- Cons: main imbalance in waves remains unresolved.

---

## Recommended Difficulty Curve

- **Wave 1 (Pop):** onboarding pressure.
  - Fire interval baseline, low burst chance, no specials.
- **Wave 2 (EDM):** crossfire begins.
  - +20% effective fire pressure, occasional synchronized dual shot.
- **Wave 3 (Hip-hop):** lane denial.
  - +35% pressure, introduce `DiveBomber` fly-down every ~10-14s.
- **Wave 4 (Rock):** overload prep.
  - +55% pressure, introduce `ShieldBreaker` special every ~12-16s and denser elite rows.
- **Boss (Headliner Rig):** appears immediately after wave 4 clear.
  - Phase A (100-70% HP): sweeping barrages + adds.
  - Phase B (70-35% HP): alternating lane locks + fast volleys.
  - Phase C (35-0% HP): short enrage bursts with clear 600-800ms telegraphs.

### Special Units
- `DiveBomber`: vertical drop lane marker, then fast dive; punish idle center play.
- `ShieldBreaker`: slower projectile arc that heavily damages shields, low direct player damage.
- `SpotlightDrone` (optional if needed): marks safe/unsafe lanes briefly and boosts other enemy fire.

### Fairness Rules
- No unavoidable overlap patterns.
- Minimum telegraph window before lethal events.
- At most one high-threat special active at once until boss phase C.

---

## Success Metrics (Balance Targets)

- Stage 3 survival-to-boss rate target: 45-60% for median players.
- Boss clear rate target: 25-40% for median players.
- "Too easy" signal guardrail: if >65% of runs clear boss in first tuning pass, raise pressure.
- Death clarity: at least one obvious cause in final 1.5s replay state.
- Mobile parity: no >10% survival delta vs desktop in automated scenarios.

---

## Implementation Plan

### Task 1: Expand Stage 3 Balance Config

**Files:**
- Modify: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/src/games/amp-invaders/stage3v2Config.ts`
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/tests/games/amp-invaders/stage3v2BalanceConfig.test.ts`

**Step 1: Write failing tests**
- Verify per-wave aggression config exists for waves 1-4.
- Verify spread progression remains wave-clear only.
- Verify boss config exists (hp, phases, telegraph timings).

**Step 2: Run test to verify it fails**
Run: `npm run test -- tests/games/amp-invaders/stage3v2BalanceConfig.test.ts`
Expected: FAIL (missing config fields).

**Step 3: Add minimal config**
- Add `aggressionByWave`, `specialSpawnRules`, `bossConfig`.
- Keep `spread.progression = "wave-clear"` unchanged.

**Step 4: Run test to verify it passes**
Run: `npm run test -- tests/games/amp-invaders/stage3v2BalanceConfig.test.ts`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/games/amp-invaders/stage3v2Config.ts tests/games/amp-invaders/stage3v2BalanceConfig.test.ts
git commit -m "feat: add amp invaders balance and boss config"
```

---

### Task 2: Enemy Aggression Director

**Files:**
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/src/games/amp-invaders/enemyDirector.ts`
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/tests/games/amp-invaders/enemyDirector.test.ts`

**Step 1: Write failing tests**
- Fire cadence shortens by wave index and elapsed pressure.
- Burst fire unlocks from wave 2 onward.
- Director output is deterministic for same input.

**Step 2: Run test to verify it fails**
Run: `npm run test -- tests/games/amp-invaders/enemyDirector.test.ts`
Expected: FAIL.

**Step 3: Implement minimal director**
- `computeEnemyFirePlan({ wave, elapsedMs, aliveCount, rngSeed })`.
- Outputs cooldown and shot pattern type (`single`, `dual`, `burst`).

**Step 4: Run test to verify it passes**
Run: `npm run test -- tests/games/amp-invaders/enemyDirector.test.ts`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/games/amp-invaders/enemyDirector.ts tests/games/amp-invaders/enemyDirector.test.ts
git commit -m "feat: add amp invaders enemy aggression director"
```

---

### Task 3: Special Fly-Down Threat System

**Files:**
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/src/games/amp-invaders/specials.ts`
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/tests/games/amp-invaders/specials.test.ts`

**Step 1: Write failing tests**
- Wave 3 can spawn `DiveBomber` only after configured cooldown.
- Wave 4 can spawn `ShieldBreaker` with telegraph first.
- Only one high-threat special active at once pre-boss.

**Step 2: Run test to verify it fails**
Run: `npm run test -- tests/games/amp-invaders/specials.test.ts`
Expected: FAIL.

**Step 3: Implement minimal specials module**
- `updateSpecialSpawns(...)`, `updateSpecialEntities(...)`, `resolveSpecialHits(...)`.

**Step 4: Run test to verify it passes**
Run: `npm run test -- tests/games/amp-invaders/specials.test.ts`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/games/amp-invaders/specials.ts tests/games/amp-invaders/specials.test.ts
git commit -m "feat: add amp invaders fly-down specials"
```

---

### Task 4: Boss State Machine

**Files:**
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/src/games/amp-invaders/bossDirector.ts`
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/tests/games/amp-invaders/bossDirector.test.ts`

**Step 1: Write failing tests**
- Boss activates after wave 4 clear.
- Boss phases transition at configured HP thresholds.
- Boss telegraph timings are enforced before damage windows.

**Step 2: Run test to verify it fails**
Run: `npm run test -- tests/games/amp-invaders/bossDirector.test.ts`
Expected: FAIL.

**Step 3: Implement minimal boss logic**
- `createBossDirector(config)` with phase and attack scheduling.
- Provide deterministic debug state for E2E assertions.

**Step 4: Run test to verify it passes**
Run: `npm run test -- tests/games/amp-invaders/bossDirector.test.ts`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/games/amp-invaders/bossDirector.ts tests/games/amp-invaders/bossDirector.test.ts
git commit -m "feat: add amp invaders boss director"
```

---

### Task 5: Runtime Integration in Stage 3

**Files:**
- Modify: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/src/main.ts`
- Modify: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/src/games/amp-invaders/collision.ts`
- Modify: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/e2e/amp-autofire.spec.ts`

**Step 1: Write failing E2E tests**
- Enemy fire pressure grows by wave.
- Special entities appear in waves 3-4 with telegraph state.
- Boss spawns after wave 4 and exposes `bossPhase` in debug state.

**Step 2: Run tests to verify they fail**
Run: `npm run test:e2e -- e2e/amp-autofire.spec.ts`
Expected: FAIL.

**Step 3: Implement runtime integration**
- Wire `enemyDirector`, `specials`, and `bossDirector` into `createAmpInvadersStage()`.
- Keep current mobile steering and shield collision fairness behavior.

**Step 4: Run tests to verify pass**
Run: `npm run test:e2e -- e2e/amp-autofire.spec.ts`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/main.ts src/games/amp-invaders/collision.ts e2e/amp-autofire.spec.ts
git commit -m "feat: integrate stage3 enemy escalation and boss flow"
```

---

### Task 6: Balance Tuning Pass (Config-Only)

**Files:**
- Modify: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/src/games/amp-invaders/stage3v2Config.ts`
- Modify: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/e2e/amp-autofire.spec.ts`
- Modify: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/progress.md`

**Step 1: Add strict tuning assertions**
- Add checks for not-too-easy pacing proxies (time-to-wave-clear, survival under pressure windows).

**Step 2: Run test to observe failure/threshold misses**
Run: `npm run test:e2e -- e2e/amp-autofire.spec.ts`
Expected: FAIL until tuned.

**Step 3: Tune only config knobs**
- Adjust fire cadence scales, special intervals, boss HP/phase timings.

**Step 4: Verify full suite**
Run: `npm run lint`
Run: `npm run build`
Run: `npm run test`
Run: `npm run test:e2e -- e2e/mobile-smoke.spec.ts e2e/mobile-hit-target.spec.ts e2e/mobile-controls.spec.ts e2e/stage-flow.spec.ts e2e/triathlon-flow.spec.ts e2e/amp-autofire.spec.ts`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/games/amp-invaders/stage3v2Config.ts e2e/amp-autofire.spec.ts progress.md
git commit -m "chore: tune amp invaders escalation and boss balance"
```

---

## Dependency Order

1. Lock config schema first (Task 1).
2. Implement director systems before runtime wiring (Tasks 2-4).
3. Integrate runtime after tests exist (Task 5).
4. Tune with config-only changes last (Task 6).

---

## Risk Controls

- Keep spread-tier upgrades strictly wave-clear based (no pickup-based spread boosts).
- Preserve deterministic test hooks for stage and wave advancement.
- Maintain mobile-safe readability by enforcing telegraphs before high-threat attacks.
- If boss significantly increases stage duration, revalidate run timer and commit flow behavior.

---

Plan complete and saved to `docs/plans/2026-02-18-amp-invaders-balance-boss-plan.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
