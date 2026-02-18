# Mosh Pit Pac-Man Mobile + Musicality Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve Stage 2 mobile feel and readability, and add stronger music-reactive gameplay feedback without changing core scoring/rules.

**Architecture:** Keep the current single-canvas Stage 2 runtime in `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/src/main.ts`, but split new behavior into small domain helpers for turn-assist and zone-music state so logic is testable. Layer the new feedback on top of existing movement/audio pipelines with minimal API surface changes.

**Tech Stack:** TypeScript, Canvas2D runtime, Vitest, Playwright E2E.

---

### Task 1: Baseline Simulation + Stage 2 Telemetry Contract

**Files:**
- Modify: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/e2e/mobile-controls.spec.ts`
- Modify: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/e2e/mobile-hit-target.spec.ts`
- Modify: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/src/main.ts`

**Step 1: Write failing E2E for Stage 2 mobile turn quality**
- Add a test that performs repeated swipe sequences at corners and asserts player does not stall for >2 move ticks.

**Step 2: Run to verify RED**
- Run: `npm run test:e2e -- e2e/mobile-controls.spec.ts`
- Expected: FAIL on the new Stage 2 turn-quality assertion.

**Step 3: Add minimal debug telemetry**
- Extend Stage 2 `debugState()` with `player.dir`, `player.want`, and recent turn acceptance counters.

**Step 4: Re-run baseline suite**
- Run: `npm run test:e2e -- e2e/mobile-controls.spec.ts e2e/mobile-hit-target.spec.ts`
- Expected: PASS for existing tests; new quality test still failing until Task 2.

---

### Task 2: Mobile Turn Assist (One-Thumb Reliability)

**Files:**
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/src/games/moshpit-pacman/mobileTurnAssist.ts`
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/tests/games/moshpit-pacman/mobileTurnAssist.test.ts`
- Modify: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/src/main.ts`
- Test: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/e2e/mobile-controls.spec.ts`

**Step 1: Write failing unit tests**
- Cover:
- buffered swipe retention until junction,
- one-tile pre-turn acceptance window,
- opposite-direction guard.

**Step 2: Run to verify RED**
- Run: `npm run test -- tests/games/moshpit-pacman/mobileTurnAssist.test.ts`
- Expected: FAIL.

**Step 3: Implement minimal turn-assist helper**
- Add deterministic helper with inputs:
- current tile, desired dir, map walkability, previous dir, buffered age.
- Return accepted direction + remaining buffer.

**Step 4: Integrate helper into Stage 2 update loop**
- Replace direct `player.want` checks with helper-driven accept/hold behavior.

**Step 5: Verify GREEN**
- Run: `npm run test -- tests/games/moshpit-pacman/mobileTurnAssist.test.ts`
- Run: `npm run test:e2e -- e2e/mobile-controls.spec.ts`
- Expected: PASS.

---

### Task 3: Mobile Readability and Playfield Occupancy

**Files:**
- Modify: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/src/main.ts`
- Modify: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/e2e/mobile-smoke.spec.ts`

**Step 1: Write failing Stage 2 viewport assertion**
- Add E2E assertion that Stage 2 active field covers at least ~70% of canvas height on `390x844`.

**Step 2: Run to verify RED**
- Run: `npm run test:e2e -- e2e/mobile-smoke.spec.ts`
- Expected: FAIL.

**Step 3: Implement minimal visual scaling adjustments**
- Increase Stage 2 effective cell size on portrait by:
- using stage-specific draw scaling or compact top zone bars,
- preserving wall/path collision grid semantics.

**Step 4: Verify GREEN**
- Run: `npm run test:e2e -- e2e/mobile-smoke.spec.ts e2e/mobile-controls.spec.ts`
- Expected: PASS.

---

### Task 4: Inject Stronger Musical Theme in Stage 2

**Files:**
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/src/games/moshpit-pacman/zoneMusicState.ts`
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/tests/games/moshpit-pacman/zoneMusicState.test.ts`
- Modify: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/src/main.ts`

**Step 1: Write failing unit tests for zone music state**
- Cover:
- zone-completion thresholds (25/50/75/100),
- stinger trigger-once semantics,
- fright mode temporary layer boost.

**Step 2: Run to verify RED**
- Run: `npm run test -- tests/games/moshpit-pacman/zoneMusicState.test.ts`
- Expected: FAIL.

**Step 3: Implement minimal zone music state helper**
- Track per-zone progress and return:
- `activeLayers`, `pendingStinger`, `intensity`.

**Step 4: Integrate into runtime/audio hooks**
- In Stage 2:
- trigger short musical stingers on zone milestones,
- brighten pulse/background accents from zone intensity,
- keep current global audio engine API intact.

**Step 5: Verify GREEN**
- Run: `npm run test -- tests/games/moshpit-pacman/zoneMusicState.test.ts`
- Run: `npm run test:e2e -- e2e/mobile-controls.spec.ts e2e/triathlon-flow.spec.ts`
- Expected: PASS.

---

### Task 5: Final Verification + Documentation

**Files:**
- Modify: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/progress.md`
- Optional modify: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/docs/plans/2026-02-17-mobile-first-v1-qa-matrix.md`

**Step 1: Run full verification**
- Run: `npm run test`
- Run: `npm run lint`
- Run: `npm run build`
- Run: `npm run test:e2e -- e2e/mobile-smoke.spec.ts e2e/mobile-hit-target.spec.ts e2e/mobile-controls.spec.ts e2e/stage-flow.spec.ts e2e/triathlon-flow.spec.ts e2e/amp-autofire.spec.ts`
- Expected: PASS.

**Step 2: Record evidence**
- Append simulation outcomes, before/after behavior notes, and residual risks to `progress.md`.

**Step 3: Commit**
- Run:
```bash
git add /Users/anubhav.mehrotra/Documents/codex/Retro\ Arcade/src/main.ts \
  /Users/anubhav.mehrotra/Documents/codex/Retro\ Arcade/src/games/moshpit-pacman/mobileTurnAssist.ts \
  /Users/anubhav.mehrotra/Documents/codex/Retro\ Arcade/src/games/moshpit-pacman/zoneMusicState.ts \
  /Users/anubhav.mehrotra/Documents/codex/Retro\ Arcade/tests/games/moshpit-pacman/mobileTurnAssist.test.ts \
  /Users/anubhav.mehrotra/Documents/codex/Retro\ Arcade/tests/games/moshpit-pacman/zoneMusicState.test.ts \
  /Users/anubhav.mehrotra/Documents/codex/Retro\ Arcade/e2e/mobile-controls.spec.ts \
  /Users/anubhav.mehrotra/Documents/codex/Retro\ Arcade/e2e/mobile-smoke.spec.ts \
  /Users/anubhav.mehrotra/Documents/codex/Retro\ Arcade/progress.md
git commit -m "Improve mosh pit pac-man mobile feel and musical feedback"
```

