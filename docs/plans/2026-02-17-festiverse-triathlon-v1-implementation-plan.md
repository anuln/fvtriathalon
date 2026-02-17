# Festiverse Arcade Retro Triathlon V1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a playable V1 web triathlon (Rhythm Serpent -> Mosh Pit Pac-Man -> Amp Invaders) with one global clock, one-way stage commits, parity scoring, hidden admin theme switching, and results/leaderboard flow.

**Architecture:** Use a PixiJS-first game shell with a shared triathlon state store, tokenized theme system, and independent stage modules mounted into a common HUD/screen framework. Keep all game logic deterministic and testable with pure domain modules (rules, scoring, eligibility), while UI/gameplay rendering stays in Pixi containers.

**Tech Stack:** TypeScript, Vite, PixiJS 8, Vitest, Playwright, ESLint, Prettier

---

Skills to apply during implementation: `@test-driven-development`, `@develop-web-game`, `@frontend-design`, `@verification-before-completion`.

### Task 1: Bootstrap Project and Test Harness

**Files:**
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/package.json`
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/tsconfig.json`
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/vite.config.ts`
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/vitest.config.ts`
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/index.html`
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/src/main.ts`
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/tests/smoke/app-smoke.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";

describe("app bootstrap", () => {
  it("exposes a root app mount point", () => {
    expect(document.querySelector("#app")).toBeTruthy();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/smoke/app-smoke.test.ts`  
Expected: FAIL before setup files are added.

**Step 3: Write minimal implementation**

Create Vite + TS app shell with `#app` in `index.html` and a minimal `src/main.ts`.

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/smoke/app-smoke.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add package.json tsconfig.json vite.config.ts vitest.config.ts index.html src/main.ts tests/smoke/app-smoke.test.ts
git commit -m "chore: bootstrap triathlon app with vitest harness"
```

### Task 2: Triathlon Rules Domain (Clock, Commit, Retry, Early Death)

**Files:**
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/src/domain/triathlonRules.ts`
- Test: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/tests/domain/triathlonRules.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { computeStageOptions } from "../../src/domain/triathlonRules";

describe("triathlon stage options", () => {
  it("unlocks commit at 60s or on early death", () => {
    expect(computeStageOptions({ elapsedMs: 59000, stageEnded: false }).canCommit).toBe(false);
    expect(computeStageOptions({ elapsedMs: 60000, stageEnded: false }).canCommit).toBe(true);
    expect(computeStageOptions({ elapsedMs: 12000, stageEnded: true }).canCommit).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/domain/triathlonRules.test.ts`  
Expected: FAIL (`computeStageOptions` missing).

**Step 3: Write minimal implementation**

Implement pure rule helpers:
- commit unlock threshold `60000ms`
- early death commit unlock when `stageEnded === true && elapsedMs < 60000`
- retry resets current stage only (domain return type includes `resetStageState: true`)

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/domain/triathlonRules.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/domain/triathlonRules.ts tests/domain/triathlonRules.test.ts
git commit -m "feat: add triathlon commit and early-death rule engine"
```

### Task 3: Parity Scoring Domain (TriPoints Conversion)

**Files:**
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/src/domain/scoring.ts`
- Test: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/tests/domain/scoring.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { toTriPoints, TOTAL_TRI_MAX } from "../../src/domain/scoring";

describe("tri points normalization", () => {
  it("uses diminishing returns and stays bounded", () => {
    const snake = toTriPoints("rhythm-serpent", 5000);
    const pac = toTriPoints("moshpit-pacman", 5000);
    const amp = toTriPoints("amp-invaders", 5000);
    expect(snake).toBeLessThanOrEqual(1200);
    expect(pac).toBeLessThanOrEqual(1200);
    expect(amp).toBeLessThanOrEqual(1200);
    expect(snake + pac + amp).toBeLessThanOrEqual(TOTAL_TRI_MAX);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/domain/scoring.test.ts`  
Expected: FAIL.

**Step 3: Write minimal implementation**

Implement:
- `K`: serpent `2400`, pacman `2100`, invaders `1900`
- `TriPoints = 1200 * (1 - Math.exp(-raw / K))`
- `TOTAL_TRI_MAX = 3600`

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/domain/scoring.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/domain/scoring.ts tests/domain/scoring.test.ts
git commit -m "feat: implement parity scoring normalization"
```

### Task 4: Theme Token Contract + Validator

**Files:**
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/src/theme/themeTypes.ts`
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/src/theme/themeValidator.ts`
- Test: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/tests/theme/themeValidator.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { validateThemePack } from "../../src/theme/themeValidator";

describe("theme validator", () => {
  it("requires semantic token completeness", () => {
    const result = validateThemePack({ id: "bad" } as never);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/theme/themeValidator.test.ts`  
Expected: FAIL.

**Step 3: Write minimal implementation**

Create theme type + key presence validator for all required palette/typography/motion/fx/audioMix fields.

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/theme/themeValidator.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/theme/themeTypes.ts src/theme/themeValidator.ts tests/theme/themeValidator.test.ts
git commit -m "feat: add theme token contract and validator"
```

### Task 5: Implement the 3 Theme Packs and Neon Default

**Files:**
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/src/theme/packs/neonTournament.ts`
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/src/theme/packs/ravePoster.ts`
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/src/theme/packs/vintageCrt.ts`
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/src/theme/themeRegistry.ts`
- Test: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/tests/theme/themeRegistry.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { getDefaultTheme, listThemes } from "../../src/theme/themeRegistry";

describe("theme registry", () => {
  it("defaults to neon tournament broadcast", () => {
    expect(getDefaultTheme().id).toBe("neon-tournament-broadcast");
    expect(listThemes().length).toBe(3);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/theme/themeRegistry.test.ts`  
Expected: FAIL.

**Step 3: Write minimal implementation**

Implement registry + three packs with locked default `neon-tournament-broadcast`.

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/theme/themeRegistry.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/theme/packs src/theme/themeRegistry.ts tests/theme/themeRegistry.test.ts
git commit -m "feat: add three launch themes with neon default"
```

### Task 6: Hidden Admin Theme Lab Gate

**Files:**
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/src/admin/themeLabAccess.ts`
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/src/admin/themeLabState.ts`
- Test: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/tests/admin/themeLabAccess.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { isThemeLabEnabled } from "../../src/admin/themeLabAccess";

describe("theme lab access", () => {
  it("is disabled in player mode by default", () => {
    expect(isThemeLabEnabled({ adminFlag: false, queryFlag: false })).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/admin/themeLabAccess.test.ts`  
Expected: FAIL.

**Step 3: Write minimal implementation**

Implement access logic:
- `ADMIN_THEME_TOOLS` gate
- hidden gesture unlock state
- optional non-prod query fallback `adminThemeLab=1`

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/admin/themeLabAccess.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/admin/themeLabAccess.ts src/admin/themeLabState.ts tests/admin/themeLabAccess.test.ts
git commit -m "feat: add hidden admin-only theme lab gating"
```

### Task 7: Global Run Store + Stage Lifecycle

**Files:**
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/src/state/runStore.ts`
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/src/state/runActions.ts`
- Test: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/tests/state/runStore.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { createRunStore } from "../../src/state/runStore";

describe("run store", () => {
  it("preserves prior stage bank on retry", () => {
    const store = createRunStore();
    store.bankStage("rhythm-serpent", 500);
    store.retryCurrentStage();
    expect(store.getState().banked.rhythmSerpent).toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/state/runStore.test.ts`  
Expected: FAIL.

**Step 3: Write minimal implementation**

Implement state for:
- global clock
- current stage
- banked stage raw + tri points
- commit eligibility
- retry reset current stage only

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/state/runStore.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/state/runStore.ts src/state/runActions.ts tests/state/runStore.test.ts
git commit -m "feat: implement triathlon run state lifecycle"
```

### Task 8: Core Screens and HUD Shell

**Files:**
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/src/ui/screens/BootScreen.ts`
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/src/ui/screens/AttractScreen.ts`
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/src/ui/screens/ResultsScreen.ts`
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/src/ui/HudShell.ts`
- Test: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/tests/ui/hudShell.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { formatHud } from "../../src/ui/HudShell";

describe("hud shell", () => {
  it("shows run time, stage label, and banked tri points", () => {
    const hud = formatHud({ msLeft: 540000, stageIndex: 0, triPoints: 321 });
    expect(hud).toContain("09:00");
    expect(hud).toContain("Stage 1/3");
    expect(hud).toContain("321");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/ui/hudShell.test.ts`  
Expected: FAIL.

**Step 3: Write minimal implementation**

Implement shell format helpers and screen scaffolds mapped to WF-00/WF-01/WF-06.

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/ui/hudShell.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/ui/screens src/ui/HudShell.ts tests/ui/hudShell.test.ts
git commit -m "feat: add core screens and persistent hud shell"
```

### Task 9: Rhythm Serpent V1 Module Integration

**Files:**
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/src/games/rhythm-serpent/RhythmSerpentGame.ts`
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/src/games/rhythm-serpent/rhythmSerpentConfig.ts`
- Test: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/tests/games/rhythm-serpent/rhythmSerpentRules.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { shouldUnlockCommit } from "../../../src/games/rhythm-serpent/rhythmSerpentConfig";

describe("rhythm serpent stage unlock", () => {
  it("unlocks at 60s", () => {
    expect(shouldUnlockCommit(60000)).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/games/rhythm-serpent/rhythmSerpentRules.test.ts`  
Expected: FAIL.

**Step 3: Write minimal implementation**

Implement stage 1 gameplay module with:
- power-ups (bass drop, encore, mosh burst)
- score output events
- stage end event for retry/commit flow

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/games/rhythm-serpent/rhythmSerpentRules.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/games/rhythm-serpent tests/games/rhythm-serpent/rhythmSerpentRules.test.ts
git commit -m "feat: implement rhythm serpent stage module"
```

### Task 10: Mosh Pit Pac-Man V1 Module Integration

**Files:**
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/src/games/moshpit-pacman/MoshpitPacmanGame.ts`
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/src/games/moshpit-pacman/zoneSystem.ts`
- Test: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/tests/games/moshpit-pacman/zoneSystem.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { zoneActive } from "../../../src/games/moshpit-pacman/zoneSystem";

describe("zone activation", () => {
  it("activates at 15 percent completion", () => {
    expect(zoneActive(15, 100)).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/games/moshpit-pacman/zoneSystem.test.ts`  
Expected: FAIL.

**Step 3: Write minimal implementation**

Implement stage 2 gameplay module with:
- zone meter instrumentation
- backstage power chase state
- guard chain scoring events

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/games/moshpit-pacman/zoneSystem.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/games/moshpit-pacman tests/games/moshpit-pacman/zoneSystem.test.ts
git commit -m "feat: implement mosh pit pacman stage module"
```

### Task 11: Amp Invaders V1 Module Integration

**Files:**
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/src/games/amp-invaders/AmpInvadersGame.ts`
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/src/games/amp-invaders/waveDirector.ts`
- Test: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/tests/games/amp-invaders/waveDirector.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { nextGenreBlock } from "../../../src/games/amp-invaders/waveDirector";

describe("genre progression", () => {
  it("cycles through jazz rock edm metal", () => {
    expect(nextGenreBlock("jazz")).toBe("rock");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/games/amp-invaders/waveDirector.test.ts`  
Expected: FAIL.

**Step 3: Write minimal implementation**

Implement stage 3 gameplay module with:
- wave and genre progression
- shield durability
- disco-ball bonus target
- end-run commit transition hook

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/games/amp-invaders/waveDirector.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/games/amp-invaders tests/games/amp-invaders/waveDirector.test.ts
git commit -m "feat: implement amp invaders stage module"
```

### Task 12: Stage Commit/Retry UI Flow (WF-03/WF-04/WF-05)

**Files:**
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/src/ui/overlays/CommitConfirmOverlay.ts`
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/src/ui/overlays/StageTransitionOverlay.ts`
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/src/ui/overlays/EarlyDeathOverlay.ts`
- Test: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/tests/ui/overlays/flowOverlay.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { deathChoices } from "../../../src/ui/overlays/EarlyDeathOverlay";

describe("early death options", () => {
  it("shows retry as primary action", () => {
    const options = deathChoices();
    expect(options.primary).toBe("RETRY HERE");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/ui/overlays/flowOverlay.test.ts`  
Expected: FAIL.

**Step 3: Write minimal implementation**

Implement overlays and button ordering per locked wireframes/copy.

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/ui/overlays/flowOverlay.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/ui/overlays tests/ui/overlays/flowOverlay.test.ts
git commit -m "feat: implement commit transition and early death overlays"
```

### Task 13: Results + Leaderboard (Local Persistence for V1)

**Files:**
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/src/leaderboard/leaderboardStore.ts`
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/src/ui/screens/LeaderboardScreen.ts`
- Test: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/tests/leaderboard/leaderboardStore.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { saveScore, topScores } from "../../src/leaderboard/leaderboardStore";

describe("leaderboard store", () => {
  it("sorts scores descending and keeps stage splits", () => {
    saveScore({ player: "A", total: 100, splits: [30, 30, 40] });
    saveScore({ player: "B", total: 200, splits: [50, 70, 80] });
    expect(topScores()[0].player).toBe("B");
    expect(topScores()[0].splits.length).toBe(3);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/leaderboard/leaderboardStore.test.ts`  
Expected: FAIL.

**Step 3: Write minimal implementation**

Implement local leaderboard store and results-to-leaderboard screen handoff.

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/leaderboard/leaderboardStore.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/leaderboard src/ui/screens/LeaderboardScreen.ts tests/leaderboard/leaderboardStore.test.ts
git commit -m "feat: add v1 local leaderboard with split display"
```

### Task 14: End-to-End Flow Verification + Performance Guardrails

**Files:**
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/e2e/triathlon-flow.spec.ts`
- Modify: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/package.json`
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/docs/plans/2026-02-17-v1-qa-checklist.md`

**Step 1: Write the failing test**

```ts
import { test, expect } from "@playwright/test";

test("player can complete full triathlon and see results", async ({ page }) => {
  await page.goto("/");
  await page.getByText("START").click();
  await expect(page.getByText("Stage 1/3")).toBeVisible();
  // simulate progression with helper hooks
  await expect(page.getByText("FINAL TRIPOINTS")).toBeVisible();
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:e2e -- e2e/triathlon-flow.spec.ts`  
Expected: FAIL before hooks/screens are fully wired.

**Step 3: Write minimal implementation**

Wire missing navigation hooks and test IDs needed for deterministic flow automation.

**Step 4: Run test to verify it passes**

Run: `npm run test:e2e -- e2e/triathlon-flow.spec.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add e2e/triathlon-flow.spec.ts package.json docs/plans/2026-02-17-v1-qa-checklist.md
git commit -m "test: add v1 e2e triathlon flow and qa checklist"
```

### Task 15: Final Verification and Handoff Notes

**Files:**
- Create: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/docs/plans/2026-02-17-v1-developer-handoff.md`

**Step 1: Write the failing check list**

Add checklist sections:
- feature completeness
- known issues
- performance metrics
- follow-up backlog

**Step 2: Run full verification**

Run: `npm run lint && npm run test && npm run test:e2e`  
Expected: all green.

**Step 3: Write minimal handoff implementation**

Document:
- what shipped
- what is deferred to V1.1
- exact commands to run locally

**Step 4: Validate handoff doc completeness**

Run: `rg -n "deferred|known issues|run locally" docs/plans/2026-02-17-v1-developer-handoff.md`  
Expected: all sections found.

**Step 5: Commit**

```bash
git add docs/plans/2026-02-17-v1-developer-handoff.md
git commit -m "docs: add v1 developer handoff package"
```

