# Triathlon Scoring Balance + Simulation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebalance cross-stage scoring fairness, remove raw-vs-tri score confusion, and add a Playwright simulation harness to evaluate stage balance and run duration (including alternatives to 9 minutes).

**Architecture:** Keep per-stage raw scoring intact, tune normalization in `src/domain/scoring.ts`, and make the UI/debug payload explicit about raw vs tri points. Add a deterministic Playwright batch simulator that drives gameplay with seeded variability profiles and writes structured artifacts for iterative balancing.

**Tech Stack:** TypeScript, Vite runtime hooks (`window.advanceTime`, `window.render_game_to_text`), Playwright, Vitest.

---

### Task 1: Clarify Scoring Units in UI + Debug State

**Files:**
- Modify: `src/main.ts`
- Test: `e2e/stage-flow.spec.ts`

**Step 1: Write failing E2E expectation updates**
- Update score-label assertions in `e2e/stage-flow.spec.ts` to expect explicit raw/tri wording.

**Step 2: Run test to verify it fails**
- Run: `npm run test:e2e -- e2e/stage-flow.spec.ts`
- Expected: FAIL until runtime labels are updated.

**Step 3: Implement minimal runtime changes**
- Add helper(s) for current-stage tri preview and projected tri total.
- Update HUD and transition/results text to label raw vs tri clearly.
- Include `bankedRaw` and tri preview fields in `render_game_to_text`.

**Step 4: Re-run test to verify pass**
- Run: `npm run test:e2e -- e2e/stage-flow.spec.ts`
- Expected: PASS.

### Task 2: Rebalance Normalization Constants with TDD

**Files:**
- Modify: `src/domain/scoring.ts`
- Modify: `tests/domain/scoring.test.ts`

**Step 1: Write failing scoring tests first**
- Add tests asserting:
- Snake conversion is more favorable than before for same raw.
- Pac/Amp conversion are more damped than before for same raw.
- Stage max and total max bounds still hold.

**Step 2: Run test to verify RED**
- Run: `npm run test -- tests/domain/scoring.test.ts`
- Expected: FAIL with old constants.

**Step 3: Minimal implementation**
- Update stage normalization constants in `src/domain/scoring.ts`.
- Keep conversion function shape unchanged for now (diminishing returns retained).

**Step 4: Verify GREEN**
- Run: `npm run test -- tests/domain/scoring.test.ts`
- Expected: PASS.

### Task 3: Add Run-Duration Override for Simulation

**Files:**
- Create: `src/domain/runConfig.ts`
- Create: `tests/domain/runConfig.test.ts`
- Modify: `src/main.ts`

**Step 1: Write failing tests first**
- Add parser tests for `?runMinutes=6`, `?runMinutes=7.5`, invalid values fallback to default 9.

**Step 2: Run RED**
- Run: `npm run test -- tests/domain/runConfig.test.ts`
- Expected: FAIL (module missing).

**Step 3: Implement parser + wire runtime**
- Add pure parser helper in `src/domain/runConfig.ts`.
- Replace hardcoded `RUN_TOTAL_MS` with parsed value from `window.location.search`.

**Step 4: Verify GREEN**
- Run: `npm run test -- tests/domain/runConfig.test.ts`
- Expected: PASS.

### Task 4: Playwright Simulation Harness

**Files:**
- Create: `scripts/simulate-score-balance.mjs`
- Modify: `package.json`
- Create: `docs/plans/2026-02-18-scoring-sim-playbook.md`

**Step 1: Add failing smoke test for harness contract (optional lightweight)**
- Add a small validation in script startup (e.g., reject missing URL) and exercise in a unit-friendly way if feasible.

**Step 2: Implement harness**
- Script inputs: `--url`, `--runs`, `--seed`, `--profile`, `--run-minutes`, `--out`.
- Profiles: `balanced`, `snake-specialist`, `pac-specialist`, `amp-specialist`, `casual`.
- For each run:
- start game, drive deterministic input bursts per stage, commit progression via test hooks.
- collect stage raw/tri, totals, elapsed ms, deaths/clears.
- Emit aggregate summary + per-run rows to JSON.

**Step 3: Wire npm scripts**
- Add `sim:quick` and `sim:batch` scripts in `package.json`.

**Step 4: Verify harness execution**
- Run quick batch command against local app and confirm artifact generation.

### Task 5: Verification + Reporting

**Files:**
- Modify: `progress.md`

**Step 1: Full verification commands**
- `npm run test`
- `npm run lint`
- `npm run build`
- `npm run test:e2e -- e2e/stage-flow.spec.ts e2e/triathlon-flow.spec.ts`
- `npm run sim:quick -- --url http://127.0.0.1:4173`

**Step 2: Record outputs**
- Append concise findings and follow-up tuning TODOs into `progress.md`.

**Step 3: Frequent commit checkpoints**
- Commit after Task 1+2, Task 3, Task 4+5.

