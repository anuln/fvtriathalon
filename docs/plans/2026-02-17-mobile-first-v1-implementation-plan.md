# Festiverse Mobile-First Portrait V1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver a production-ready portrait-only mobile experience for the full Festiverse Arcade Retro Triathlon (all 3 games + run flow + leaderboard).

**Architecture:** Keep current single-canvas runtime and triathlon flow, but add a mobile platform layer around layout, touch input, performance tiering, and mobile-safe audio lifecycle. Gameplay rules and scoring parity stay unchanged.

**Tech Stack:** TypeScript, Vite, Canvas2D runtime (`src/main.ts`), Vitest, Playwright E2E.

---

## Phase Gates (Must Pass in Order)

| Phase | Scope | Exit Criteria |
|---|---|---|
| P0 | Baseline + instrumentation | Mobile baseline documented (FPS, touch latency, known issues) |
| P1 | Portrait foundation | Portrait safe-area layout stable on 320–430w; no clipped HUD |
| P2 | Mobile controls | All 3 games playable one-handed; no blocked progression |
| P3 | Mobile UI/HUD | 44px+ targets; overlays readable and non-blocking |
| P4 | Perf + audio hardening | 55+ FPS target on mid-tier; no audio lockups on resume |
| P5 | QA + release gate | E2E + device checklist pass on iOS Safari + Android Chrome |

---

### Task 1: Establish Mobile Baseline and Acceptance Metrics (P0)

**Files:**
- Modify: `progress.md`
- Create: `docs/plans/2026-02-17-mobile-first-v1-qa-matrix.md`
- Create: `e2e/mobile-smoke.spec.ts`

**Step 1: Write failing E2E smoke test (portrait viewport + start + stage visibility).**

**Step 2: Run the E2E test to confirm failure.**
Run: `npm run test:e2e -- e2e/mobile-smoke.spec.ts`
Expected: FAIL (test not implemented yet / selectors missing)

**Step 3: Implement minimal smoke test.**
- Use portrait viewport (e.g., 390x844)
- Assert `START` -> `Stage 1/3` visible
- Assert no blocking overlay after start

**Step 4: Run test to pass.**
Run: `npm run test:e2e -- e2e/mobile-smoke.spec.ts`
Expected: PASS

**Step 5: Document baseline metrics and known mobile issues.**
- Add fps/latency targets and current measured values in `docs/plans/2026-02-17-mobile-first-v1-qa-matrix.md`

**Acceptance Criteria:**
- Portrait smoke test exists and passes.
- Baseline metrics and risk list documented.

---

### Task 2: Portrait Safe-Area and Canvas Mapping Foundation (P1)

**Files:**
- Modify: `src/main.ts`
- Test: `tests/smoke/app-smoke.test.ts`
- Test: `e2e/mobile-smoke.spec.ts`

**Step 1: Write failing tests for portrait constraints and safe-area shell behavior.**
- Add assertions for portrait-only UI sizing rules (unit/smoke)
- Add E2E checks that HUD and action rail remain visible at 320w

**Step 2: Run tests to confirm failure.**
Run: `npm run test -- tests/smoke/app-smoke.test.ts`
Run: `npm run test:e2e -- e2e/mobile-smoke.spec.ts`
Expected: FAIL

**Step 3: Implement portrait-only foundation in `src/main.ts`.**
- Safe area paddings via CSS env vars
- Stable canvas scaling with DPR clamp for mobile
- Input coordinate mapping tied to canvas bounds after resize
- Prevent accidental landscape assumptions in layout math

**Step 4: Re-run tests.**
Expected: PASS

**Acceptance Criteria:**
- No HUD clipping on 320x568, 375x812, 390x844, 430x932.
- Canvas input mapping remains accurate after resize/orientation events.

---

### Task 3: Mobile Input Abstraction Layer (P2)

**Files:**
- Modify: `src/main.ts`
- Create: `tests/domain/mobileInputProfile.test.ts`

**Step 1: Write failing unit tests for mobile input profile mapping.**
- swipe threshold behavior
- drag steering normalization
- tap/hold disambiguation

**Step 2: Run tests to confirm failure.**
Run: `npm run test -- tests/domain/mobileInputProfile.test.ts`
Expected: FAIL

**Step 3: Implement minimal mobile input profile logic.**
- Single-touch primary input path
- Per-stage strategy flags (swipe, drag-steer, hold)
- Dead-zone and edge clamps to reduce jitter

**Step 4: Re-run tests.**
Expected: PASS

**Acceptance Criteria:**
- Input profile deterministic in tests.
- No accidental double-trigger between tap and swipe.

---

### Task 4: Per-Game Mobile Control Tuning (P2)

**Files:**
- Modify: `src/main.ts`
- Test: `e2e/triathlon-flow.spec.ts`
- Test: `e2e/amp-autofire.spec.ts`
- Create: `e2e/mobile-controls.spec.ts`

**Step 1: Write failing E2E tests for mobile control outcomes per stage.**
- Rhythm Serpent: repeated swipes turn reliably
- Mosh Pit Pac-Man: corner turns are reliable with swipe queue
- Amp Invaders: drag steer + always-fire remains active

**Step 2: Run E2E to confirm failure.**
Run: `npm run test:e2e -- e2e/mobile-controls.spec.ts`
Expected: FAIL

**Step 3: Implement tuning in stage update/input handling.**
- Rhythm: turn buffer + opposite-direction guard
- Pac-Man: turn intent buffer window at junctions
- Amp: smooth steering interpolation + clamped acceleration

**Step 4: Re-run mobile and existing E2E tests.**
Run: `npm run test:e2e -- e2e/mobile-controls.spec.ts e2e/triathlon-flow.spec.ts e2e/amp-autofire.spec.ts`
Expected: PASS

**Acceptance Criteria:**
- All 3 games complete-able on portrait touch only.
- No regression in triathlon progression or amp auto-fire behavior.

---

### Task 5: Mobile-First HUD and Overlay Usability (P3)

**Files:**
- Modify: `src/main.ts`
- Test: `tests/ui/hudShell.test.ts`
- Test: `tests/ui/overlays/flowOverlay.test.ts`
- Test: `e2e/mobile-smoke.spec.ts`

**Step 1: Write failing tests for tap target sizes and overlay behavior.**
- Minimum button height 44px
- Overlay actions not hidden behind safe-area zones

**Step 2: Run tests to confirm failure.**

**Step 3: Implement mobile UI adjustments.**
- Increase actionable control hit area
- Reduce persistent text during play
- Keep primary actions in thumb zone
- Ensure commit/retry/submit buttons are never off-screen
- Apply compact chrome rules to maximize playfield:
  - Collapse top HUD height (target 44-48px)
  - Collapse bottom rail to single-row metadata + primary action
  - Hide non-critical labels while `mode === playing` and restore in overlays
  - Move secondary actions into sheets/modals instead of persistent rows
  - Use dynamic spacing tokens by width bucket (`320-359`, `360-389`, `390+`)

**Step 4: Re-run tests.**

**Acceptance Criteria:**
- All actionable controls are 44px+ height.
- Commit/retry/leaderboard actions reachable on small phones.
- Active gameplay canvas occupies at least ~72% of viewport height on 390x844.
- Active gameplay canvas occupies at least ~68% of viewport height on 320x568.
- No vertical scroll is required in any in-run screen state.

---

### Task 5A: Mobile Real-Estate Layout Contract (P3)

**Files:**
- Modify: `src/main.ts` (layout CSS in `injectStyles()` and HUD render rules)
- Create: `tests/ui/mobileLayoutContract.test.ts`
- Test: `e2e/mobile-smoke.spec.ts`

**Step 1: Write failing tests for layout contract.**
- Assert no screen state causes body/page scroll.
- Assert compact HUD/rail sizes in playing state.
- Assert overlay cards fit within viewport with safe-area padding.

**Step 2: Run tests to confirm failure.**
Run: `npm run test -- tests/ui/mobileLayoutContract.test.ts`
Expected: FAIL

**Step 3: Implement layout contract.**
- Introduce portrait mobile CSS vars:
  - `--hud-h`, `--rail-h`, `--safe-top`, `--safe-bottom`, `--gutter`
- Use playing-mode class toggles to compress non-essential UI.
- Switch verbose copy to icon/short-label variants in-run.
- Ensure overlays use max-height with internal scroll, never page scroll.

**Step 4: Re-run tests and E2E.**
Run: `npm run test -- tests/ui/mobileLayoutContract.test.ts`
Run: `npm run test:e2e -- e2e/mobile-smoke.spec.ts`
Expected: PASS

**Acceptance Criteria:**
- No viewport overflow in portrait mode across all core states.
- Playfield stays dominant and unobstructed during active gameplay.
- Overlay interaction remains fully accessible without clipping.

---

### Task 6: Adaptive Performance Tiering for Mobile (P4)

**Files:**
- Modify: `src/main.ts`
- Create: `src/domain/perfTier.ts`
- Create: `tests/domain/perfTier.test.ts`

**Step 1: Write failing tests for tier selection logic.**
- Tier based on device hints + frame budget fallback

**Step 2: Run failing test.**
Run: `npm run test -- tests/domain/perfTier.test.ts`
Expected: FAIL

**Step 3: Implement minimal performance tier module and integration.**
- Tier 0: full FX
- Tier 1: reduced particles/glow layers
- Tier 2: minimal FX + lower expensive redraw frequency

**Step 4: Re-run tests/build.**
Run: `npm run test -- tests/domain/perfTier.test.ts`
Run: `npm run build`
Expected: PASS

**Acceptance Criteria:**
- FPS remains stable under target conditions on mobile mid-tier.
- Gameplay logic unchanged across tiers.

---

### Task 7: Mobile Audio Lifecycle Hardening (P4)

**Files:**
- Modify: `src/main.ts` (audio engine and lifecycle hooks)
- Create: `tests/domain/audioLifecycle.test.ts`

**Step 1: Write failing tests for lifecycle transitions.**
- User gesture unlock required
- Pause/resume on visibility change
- No duplicate audio graph creation

**Step 2: Run failing test.**
Run: `npm run test -- tests/domain/audioLifecycle.test.ts`
Expected: FAIL

**Step 3: Implement lifecycle handling.**
- `visibilitychange` + `pagehide/pageshow` hooks
- Resume context gracefully
- Ensure one-time graph construction and idempotent start

**Step 4: Re-run tests.**

**Acceptance Criteria:**
- Audio resumes after app background/foreground on mobile.
- No distorted layering from duplicate nodes.

---

### Task 8: Mobile QA Matrix, Regression Suite, and Release Gate (P5)

**Files:**
- Modify: `docs/plans/2026-02-17-mobile-first-v1-qa-matrix.md`
- Modify: `progress.md`
- Test: `e2e/mobile-smoke.spec.ts`
- Test: `e2e/mobile-controls.spec.ts`
- Test: `e2e/triathlon-flow.spec.ts`
- Test: `e2e/amp-autofire.spec.ts`

**Step 1: Expand QA matrix with exact device/browser checks.**
- iPhone Safari portrait
- Android Chrome portrait
- 320/375/390/430 widths

**Step 2: Execute full verification suite.**
Run: `npm run test`
Run: `npm run lint`
Run: `npm run build`
Run: `npm run test:e2e -- e2e/mobile-smoke.spec.ts e2e/mobile-controls.spec.ts e2e/triathlon-flow.spec.ts e2e/amp-autofire.spec.ts`

**Step 3: Record results + remaining defects.**
- Update QA matrix with pass/fail by scenario
- Update `progress.md` with open risks and next steps

**Acceptance Criteria:**
- Full suite passes.
- All phase gates P0-P5 marked complete.
- Remaining issues (if any) are explicitly documented and prioritized.

---

## File-Level Change List (Expected)

- `src/main.ts` (portrait shell, safe area, input tuning, performance tier hooks, audio lifecycle)
- `src/domain/perfTier.ts` (new)
- `src/domain/mobileInputProfile.ts` (optional extraction if `main.ts` gets too large)
- `tests/domain/perfTier.test.ts` (new)
- `tests/domain/mobileInputProfile.test.ts` (new)
- `tests/domain/audioLifecycle.test.ts` (new)
- `e2e/mobile-smoke.spec.ts` (new)
- `e2e/mobile-controls.spec.ts` (new)
- `docs/plans/2026-02-17-mobile-first-v1-qa-matrix.md` (new)
- `progress.md` (update)

---

## Definition of Done (Mobile Portrait V1)

1. Full triathlon run is touch-playable in portrait-only mode.
2. No blocked progression due to control or UI constraints.
3. Safe-area correctness on modern iOS + Android portrait devices.
4. Audio stays stable across foreground/background transitions.
5. Verification suite and QA matrix are complete and green.
6. UI contract guarantees maximum practical playfield on portrait mobile without losing critical controls.
