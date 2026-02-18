# Amp Invaders Stage 3 v2 Systems-First Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship Stage 3 v2 for Amp Invaders with wave-clear progression, deterministic wave/upgrade systems, placeholder-first visuals/audio, and an asset/music pipeline that can be swapped to final festival content without reworking gameplay code.

**Architecture:** Move Stage 3 behavior to config-driven modules under `src/games/amp-invaders`, then wire one runtime adapter into `src/main.ts`. Lock gameplay semantics first (wave schema, tier ladder, retry reset), then attach placeholder rendering/audio state, then add conversion and final asset/music mapping.

**Tech Stack:** TypeScript, Canvas2D runtime, Vitest, Playwright, Node.js scripts.

---

## Locked Product Decisions

- Progression model: wave-clear upgrades.
- Genre order: `pop -> edm -> hip-hop -> rock`.
- Spread tiers: `1..4` (`single -> dual -> triple -> wide`).
- Death behavior: full Stage 3 retry from Tier 1.
- Default asset handoff path (assumption until user overrides): `assets/source/amp-invaders-v2`.
- Asset delivery model: batched over time (`bullets -> enemies -> UI`).

---

### Task 1: Define Stage 3 v2 Config Model

**Files:**
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/src/games/amp-invaders/stage3v2Config.ts`
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/tests/games/amp-invaders/stage3v2Config.test.ts`

**Step 1: Write failing config tests.**
- Assert genre sequence, spread tier count, wave-clear upgrade rule, and retry reset rule.

**Step 2: Run tests to confirm failure.**
Run: `npm run test -- tests/games/amp-invaders/stage3v2Config.test.ts`
Expected: FAIL (`Cannot find module .../stage3v2Config`).

**Step 3: Implement minimal config model.**
- Export typed `GenreId`, `SpreadTier`, `WaveSpec`, `Stage3V2Config`, and `STAGE3_V2_DEFAULT_CONFIG`.

**Step 4: Re-run test.**
Run: `npm run test -- tests/games/amp-invaders/stage3v2Config.test.ts`
Expected: PASS.

**Step 5: Commit.**
```bash
git add tests/games/amp-invaders/stage3v2Config.test.ts src/games/amp-invaders/stage3v2Config.ts
git commit -m "feat: add amp invaders stage3 v2 config model"
```

---

### Task 2: Implement Deterministic Wave Director v2

**Files:**
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/src/games/amp-invaders/waveDirectorV2.ts`
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/tests/games/amp-invaders/waveDirectorV2.test.ts`

**Step 1: Write failing tests for deterministic wave progression.**
- Verify same config + same starting state always yields same next wave.
- Verify genre transitions follow `pop -> edm -> hip-hop -> rock`.

**Step 2: Run tests to confirm failure.**
Run: `npm run test -- tests/games/amp-invaders/waveDirectorV2.test.ts`
Expected: FAIL.

**Step 3: Implement wave director.**
- Add `createWaveDirectorV2(config)` with `start()`, `advanceOnWaveClear()`, and `resetOnRetry()`.

**Step 4: Re-run tests.**
Run: `npm run test -- tests/games/amp-invaders/waveDirectorV2.test.ts`
Expected: PASS.

**Step 5: Commit.**
```bash
git add tests/games/amp-invaders/waveDirectorV2.test.ts src/games/amp-invaders/waveDirectorV2.ts
git commit -m "feat: add deterministic amp invaders wave director v2"
```

---

### Task 3: Implement Spread Ladder (Tier 1-4)

**Files:**
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/src/games/amp-invaders/spreadLadder.ts`
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/tests/games/amp-invaders/spreadLadder.test.ts`

**Step 1: Write failing tests for each tier bullet pattern.**
- Tier 1: 1 projectile.
- Tier 2: 2 projectiles.
- Tier 3: 3 projectiles.
- Tier 4: wide spread with largest angle span.

**Step 2: Run tests to confirm failure.**
Run: `npm run test -- tests/games/amp-invaders/spreadLadder.test.ts`
Expected: FAIL.

**Step 3: Implement ladder math.**
- Export `buildPlayerVolley(tier, originX, originY)` with deterministic lane offsets/angles.

**Step 4: Re-run tests.**
Run: `npm run test -- tests/games/amp-invaders/spreadLadder.test.ts`
Expected: PASS.

**Step 5: Commit.**
```bash
git add tests/games/amp-invaders/spreadLadder.test.ts src/games/amp-invaders/spreadLadder.ts
git commit -m "feat: add amp invaders spread ladder tiers"
```

---

### Task 4: Implement Power-Up Spawn and Collect Loop

**Files:**
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/src/games/amp-invaders/powerUps.ts`
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/tests/games/amp-invaders/powerUps.test.ts`

**Step 1: Write failing tests for spawn cadence and collect behavior.**
- Spawn rolls deterministic by wave index.
- Collecting spread upgrade increments max tier by +1.
- Tier never exceeds 4.

**Step 2: Run tests to confirm failure.**
Run: `npm run test -- tests/games/amp-invaders/powerUps.test.ts`
Expected: FAIL.

**Step 3: Implement power-up state helpers.**
- Add `rollPowerUpSpawn`, `applyPowerUpCollect`, `resetPowerUpsOnRetry`.

**Step 4: Re-run tests.**
Run: `npm run test -- tests/games/amp-invaders/powerUps.test.ts`
Expected: PASS.

**Step 5: Commit.**
```bash
git add tests/games/amp-invaders/powerUps.test.ts src/games/amp-invaders/powerUps.ts
git commit -m "feat: add amp invaders power-up loop"
```

---

### Task 5: Integrate Stage 3 v2 Systems into Runtime

**Files:**
- Modify: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/src/main.ts`
- Modify: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/src/games/amp-invaders/collision.ts`
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/tests/games/amp-invaders/runtimeV2.test.ts`
- Modify: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/e2e/amp-autofire.spec.ts`

**Step 1: Write failing runtime tests.**
- Wave clear promotes spread tier.
- Death retry resets tier to 1.
- HUD/debug state exposes `genre`, `wave`, `spreadTier`, `nextUpgradeAt`.

**Step 2: Run tests to confirm failure.**
Run: `npm run test -- tests/games/amp-invaders/runtimeV2.test.ts`
Expected: FAIL.

**Step 3: Wire v2 systems in Stage 3 update loop.**
- Use `stage3v2Config`, `waveDirectorV2`, `spreadLadder`, and `powerUps` in `createAmpInvadersStage`.
- Preserve existing mobile steering and collision fairness behavior.

**Step 4: Re-run unit + E2E checks.**
Run: `npm run test -- tests/games/amp-invaders/runtimeV2.test.ts tests/games/amp-invaders/collision.test.ts`
Run: `npm run test:e2e -- e2e/amp-autofire.spec.ts`
Expected: PASS.

**Step 5: Commit.**
```bash
git add src/main.ts src/games/amp-invaders/collision.ts tests/games/amp-invaders/runtimeV2.test.ts e2e/amp-autofire.spec.ts
git commit -m "feat: integrate amp invaders stage3 v2 gameplay systems"
```

---

### Task 6: Add Placeholder Art + Tier-Evolving Projectile Visuals

**Files:**
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/src/games/amp-invaders/spritePlaceholders.ts`
- Modify: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/src/main.ts`
- Modify: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/e2e/amp-autofire.spec.ts`

**Step 1: Write failing visual-state test.**
- Assert rendered debug state includes `projectileVisualTier` and `enemyVisualSet` per genre.

**Step 2: Run targeted test to confirm failure.**
Run: `npm run test:e2e -- e2e/amp-autofire.spec.ts`
Expected: FAIL (missing state keys/assertions).

**Step 3: Implement placeholder sprite map and renderer hooks.**
- Map tier 1-4 projectile silhouettes.
- Map enemy placeholder silhouettes by genre block.

**Step 4: Re-run E2E check.**
Run: `npm run test:e2e -- e2e/amp-autofire.spec.ts`
Expected: PASS.

**Step 5: Commit.**
```bash
git add src/games/amp-invaders/spritePlaceholders.ts src/main.ts e2e/amp-autofire.spec.ts
git commit -m "feat: add amp invaders placeholder tier visuals"
```

---

### Task 7: Build Asset Conversion Pipeline (Pixelize + Palette + Normalize + Atlas)

**Files:**
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/scripts/convert-amp-assets.mjs`
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/scripts/amp-asset-config.json`
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/assets/source/amp-invaders-v2/.gitkeep`
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/assets/sprites/amp-invaders/v2/.gitkeep`
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/docs/plans/2026-02-18-amp-invaders-asset-import-guide.md`

**Step 1: Write failing script smoke test.**
- Add a minimal check in `tests/smoke/app-smoke.test.ts` for config readability and output folder creation command expectation.

**Step 2: Run smoke test to confirm failure.**
Run: `npm run test -- tests/smoke/app-smoke.test.ts`
Expected: FAIL.

**Step 3: Implement conversion script + config.**
- Input: `assets/source/amp-invaders-v2`
- Output: `assets/sprites/amp-invaders/v2`
- Include pixel scale, max palette, size normalization, atlas metadata json.

**Step 4: Re-run smoke test and script dry run.**
Run: `npm run test -- tests/smoke/app-smoke.test.ts`
Run: `node scripts/convert-amp-assets.mjs --dry-run`
Expected: PASS and dry-run summary printed.

**Step 5: Commit.**
```bash
git add scripts/convert-amp-assets.mjs scripts/amp-asset-config.json assets/source/amp-invaders-v2/.gitkeep assets/sprites/amp-invaders/v2/.gitkeep docs/plans/2026-02-18-amp-invaders-asset-import-guide.md tests/smoke/app-smoke.test.ts
git commit -m "feat: add amp invaders asset conversion pipeline"
```

---

### Task 8: Swap Final Assets + Readability Tuning

**Files:**
- Modify: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/src/main.ts`
- Modify: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/src/games/amp-invaders/spritePlaceholders.ts`
- Modify: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/e2e/amp-autofire.spec.ts`

**Step 1: Write failing readability assertions.**
- Add checks for danger telegraph state and shield readability state in Stage 3 debug JSON.

**Step 2: Run E2E to confirm failure.**
Run: `npm run test:e2e -- e2e/amp-autofire.spec.ts`
Expected: FAIL.

**Step 3: Implement final sprite bindings + readability tuning.**
- Replace placeholder lookups with converted atlas metadata.
- Tighten hit flash, projectile silhouettes, and lane-danger cues.
- Apply in three passes as batches arrive:
  - Batch A: projectile atlas only, verify tier silhouette clarity.
  - Batch B: enemy atlas, verify per-genre readability under dense waves.
  - Batch C: UI/HUD atlas, verify telegraph and shield-state readability.

**Step 4: Re-run E2E checks.**
Run: `npm run test:e2e -- e2e/amp-autofire.spec.ts`
Expected: PASS.

**Step 5: Commit.**
```bash
git add src/main.ts src/games/amp-invaders/spritePlaceholders.ts e2e/amp-autofire.spec.ts
git commit -m "feat: swap final amp invaders sprites and readability cues"
```

---

### Task 9: Implement Lyria Wave-Layer Music Map

**Files:**
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/src/games/amp-invaders/musicMap.ts`
- Modify: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/src/main.ts`
- Modify: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/scripts/generate-lyria-assets.mjs`
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/tests/games/amp-invaders/musicMap.test.ts`

**Step 1: Write failing tests for genre/wave -> mix-state mapping.**
- Verify `normal`, `danger`, `overdrive`, `cleanup` stem sets are selected deterministically.

**Step 2: Run tests to confirm failure.**
Run: `npm run test -- tests/games/amp-invaders/musicMap.test.ts`
Expected: FAIL.

**Step 3: Implement music map and runtime hooks.**
- Add mix-state resolver by wave + lives + streak.
- Add Lyria task presets for stage3 stems in `scripts/generate-lyria-assets.mjs`.

**Step 4: Re-run tests and lint.**
Run: `npm run test -- tests/games/amp-invaders/musicMap.test.ts`
Run: `npm run lint`
Expected: PASS.

**Step 5: Commit.**
```bash
git add src/games/amp-invaders/musicMap.ts src/main.ts scripts/generate-lyria-assets.mjs tests/games/amp-invaders/musicMap.test.ts
git commit -m "feat: add amp invaders lyria layering map"
```

---

### Task 10: QA, Balance, and Performance Gate

**Files:**
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/docs/plans/2026-02-18-amp-invaders-stage3-v2-qa-checklist.md`
- Modify: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/e2e/amp-autofire.spec.ts`
- Modify: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/progress.md`

**Step 1: Add failing/strict E2E balance checks.**
- Mobile and desktop scenarios for fairness, retry reset semantics, and survival pacing.

**Step 2: Run E2E to capture baseline failures.**
Run: `npm run test:e2e -- e2e/amp-autofire.spec.ts`
Expected: FAIL until tuning complete.

**Step 3: Tune config values only (no rule changes).**
- Adjust wave hp/density, drop cadence, power-up frequency, and tier pacing in `stage3v2Config.ts`.

**Step 4: Run full verification gate.**
Run: `npm run test`
Run: `npm run lint`
Run: `npm run build`
Run: `npm run test:e2e -- e2e/mobile-smoke.spec.ts e2e/mobile-hit-target.spec.ts e2e/mobile-controls.spec.ts e2e/stage-flow.spec.ts e2e/triathlon-flow.spec.ts e2e/amp-autofire.spec.ts`
Expected: PASS.

**Step 5: Commit.**
```bash
git add docs/plans/2026-02-18-amp-invaders-stage3-v2-qa-checklist.md e2e/amp-autofire.spec.ts src/games/amp-invaders/stage3v2Config.ts progress.md
git commit -m "chore: qa and balance pass for amp invaders stage3 v2"
```

---

## Dependency Enforcement Checklist

1. Do not start Task 8 (final sprite swap) before Tasks 1-7 are complete.
2. Do not run bulk asset ingestion until Task 7 conversion config is frozen.
3. Do not finalize Lyria arrangement before Task 5 wave timing is stable.
4. If wave/tier rules change after Task 5, rerun Tasks 8-10 in order.
5. Keep gameplay tuning unblocked if later asset batches are missing by retaining placeholder fallback for unset atlas keys.

---

Plan complete and saved to `docs/plans/2026-02-18-amp-invaders-stage3-v2-implementation-plan.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
