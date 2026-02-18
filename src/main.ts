import { toTriPoints } from "./domain/scoring";
import { getStageBeatPulse } from "./domain/beatPulse";
import { computeRhythmSerpentGrid } from "./domain/rhythmSerpentLayout";
import {
  classifyTouchGesture,
  getMobileInputProfile,
  normalizeSteerX
} from "./domain/mobileInputProfile";
import {
  consumeTurnIntent,
  createMobileTurnAssistState,
  enqueueTurnIntent,
  readTurnAssistTelemetry
} from "./domain/mobileTurnAssist";
import {
  advanceStage,
  canCommitNow,
  createFlowState,
  markCommitUnlockedIfEligible,
  retryStage,
  type FlowState
} from "./domain/runFlow";
import { computeStageOptions } from "./domain/triathlonRules";
import { saveScore, topScores } from "./leaderboard/leaderboardStore";
import { getDefaultTheme, listThemes } from "./theme/themeRegistry";
import type { ThemePack } from "./theme/themeTypes";
import { stepAutoFire } from "./games/amp-invaders/autoFire";
import { resolveEnemyBulletHit } from "./games/amp-invaders/collision";
import { buildPlayerVolley } from "./games/amp-invaders/spreadLadder";
import {
  STAGE3_V2_DEFAULT_CONFIG,
  type GenreId,
  type SpreadTier,
  getWaveSpec
} from "./games/amp-invaders/stage3v2Config";
import { createWaveDirectorV2 } from "./games/amp-invaders/waveDirectorV2";
import { createZoneMusicState, updateZoneMusicState } from "./games/moshpit-pacman/zoneMusicState";

type StageId = "rhythm-serpent" | "moshpit-pacman" | "amp-invaders";
type Dir = "up" | "down" | "left" | "right";
type Mode =
  | "boot"
  | "playing"
  | "deathPause"
  | "deathChoice"
  | "transition"
  | "results"
  | "leaderboard";

type InputFrame = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  actionHeld: boolean;
  actionPressed: boolean;
  steerX: number;
  steerAimX: number | null;
  touchSteerActive: boolean;
  consumeSwipe: () => Dir | null;
};

type StageRuntime = {
  id: StageId;
  update: (dtMs: number, input: InputFrame, width: number, height: number) => void;
  draw: (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    theme: ThemePack,
    pulse: number
  ) => void;
  getRawScore: () => number;
  isDead: () => boolean;
  getHudHint: () => string;
  debugState: () => unknown;
  forceWaveClearForTest?: () => void;
};

const STAGE_IDS: StageId[] = ["rhythm-serpent", "moshpit-pacman", "amp-invaders"];
const STAGE_NAMES = ["Rhythm Serpent", "Mosh Pit Pac-Man", "Amp Invaders"];
const RUN_TOTAL_MS = 9 * 60_000;
const THEME_OVERRIDE_KEY = "festiverse.theme.override";
const THEME_CYCLE_KEY = "festiverse.theme.cycle";
const THEME_CYCLE_INDEX_KEY = "festiverse.theme.cycle.index";

function must<T>(value: T | null | undefined, message: string): T {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
  return value;
}

const app = must(document.querySelector<HTMLDivElement>("#app"), "Missing #app container");

document.title = "Festiverse Arcade Triathlon";
ensureMobileViewportMeta();

injectStyles();

app.innerHTML = `
  <div class="tri-root">
    <header class="hud">
      <div class="hud-item" id="hud-time">09:00</div>
      <div class="hud-item hud-stage" id="hud-stage">Stage 1/3</div>
      <div class="hud-item" id="hud-bank">Triathalon Score: 0</div>
    </header>
    <section class="canvas-wrap">
      <canvas id="game-canvas"></canvas>
      <div id="overlay" class="overlay"></div>
      <div id="admin-panel" class="admin-panel hidden"></div>
    </section>
    <footer class="action-rail">
      <div class="stage-meta">
        <span id="hud-score">Score: 0</span>
        <span id="hud-hint"></span>
      </div>
      <button id="commit-btn" class="btn primary hidden">Finish Stage</button>
    </footer>
  </div>
`;

const canvas = must(document.querySelector<HTMLCanvasElement>("#game-canvas"), "Missing game canvas");
const overlay = must(document.querySelector<HTMLDivElement>("#overlay"), "Missing overlay container");
const adminPanel = must(document.querySelector<HTMLDivElement>("#admin-panel"), "Missing admin panel");
const hudTime = must(document.querySelector<HTMLDivElement>("#hud-time"), "Missing hud time");
const hudStage = must(document.querySelector<HTMLDivElement>("#hud-stage"), "Missing hud stage");
const hudBank = must(document.querySelector<HTMLDivElement>("#hud-bank"), "Missing hud bank");
const hudScore = must(document.querySelector<HTMLSpanElement>("#hud-score"), "Missing hud score");
const hudHint = must(document.querySelector<HTMLSpanElement>("#hud-hint"), "Missing hud hint");
const commitBtn = must(document.querySelector<HTMLButtonElement>("#commit-btn"), "Missing commit button");

const ctx = must(canvas.getContext("2d"), "2D canvas context unavailable");

const themes = listThemes();
let activeTheme = resolveInitialTheme(themes);
applyTheme(activeTheme);
const audio = createAudioEngine();

let flow: FlowState = createFlowState();
let mode: Mode = "boot";
let runActive = false;
let globalElapsedMs = 0;
let stageAttemptStartMs = 0;
let stage: StageRuntime = createStage(flow.currentStageIndex);
let deathPauseRemainingMs = 0;
let transitionRemainingMs = 0;
let transitionCommittedStageIndex = 0;
let transitionStageRawScore = 0;
let transitionStageBankedScore = 0;
let transitionTotalScore = 0;
let submittedScore = false;
let frameWidth = 960;
let frameHeight = 540;
let lastOverlayMarkup = "";

let secretArmed = false;
let secretTapCount = 0;
let secretTapDeadline = 0;
let secretHoldTimer = 0;
let isPointerHeldOnOverlay = false;
let cycleThemesOnRestart = readBool(THEME_CYCLE_KEY);

const input = createInputController(canvas);
input.setStage(STAGE_IDS[flow.currentStageIndex] ?? "rhythm-serpent");

overlay.addEventListener("pointerdown", (event) => {
  const target = event.target as HTMLElement;
  if (target.dataset.secretHold === "true") {
    isPointerHeldOnOverlay = true;
    secretHoldTimer = 3000;
  }
});

window.addEventListener("pointerup", (event) => {
  if (isPointerHeldOnOverlay) {
    isPointerHeldOnOverlay = false;
    secretHoldTimer = 0;
  }

  if (!secretArmed) {
    return;
  }

  if (Date.now() > secretTapDeadline) {
    secretTapCount = 0;
    secretArmed = false;
    return;
  }

  if (event.clientX < 80 && event.clientY < 80) {
    secretTapCount += 1;
    if (secretTapCount >= 3) {
      toggleAdminPanel(true);
      secretTapCount = 0;
      secretArmed = false;
    }
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key === "r" || event.key === "R") {
    if (mode === "deathChoice") {
      onRetry();
    }
  }
  if (event.key === "c" || event.key === "C") {
    if (mode === "deathChoice" || (mode === "playing" && canCommitNow(flow))) {
      commitCurrentStage(false);
    }
  }
  if (event.key === "Escape") {
    if (!adminPanel.classList.contains("hidden")) {
      toggleAdminPanel(false);
    }
  }
});

overlay.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const actionNode = target.closest<HTMLElement>("[data-action]");
  if (!actionNode) {
    return;
  }

  const action = actionNode.dataset.action;
  if (action === "start-run") {
    startRun();
  } else if (action === "retry") {
    onRetry();
  } else if (action === "open-commit") {
    commitCurrentStage(false);
  } else if (action === "continue-stage") {
    completeTransition();
  } else if (action === "play-again") {
    mode = "boot";
    runActive = false;
    submittedScore = false;
  } else if (action === "submit-score") {
    submitCurrentRunScore();
  } else if (action === "open-leaderboard") {
    mode = "leaderboard";
  } else if (action === "back-to-results") {
    mode = "results";
  } else if (action === "open-admin") {
    toggleAdminPanel(true);
  }
});

commitBtn.addEventListener("click", () => commitCurrentStage(false));

adminPanel.addEventListener("change", (event) => {
  const target = event.target as HTMLInputElement | HTMLSelectElement;
  if (target.id === "admin-theme-select") {
    const picked = themes.find((item) => item.id === target.value);
    if (picked) {
      activeTheme = picked;
      applyTheme(activeTheme);
      localStorage.setItem(THEME_OVERRIDE_KEY, picked.id);
    }
  }
  if (target.id === "admin-persist-cycle") {
    cycleThemesOnRestart = (target as HTMLInputElement).checked;
    localStorage.setItem(THEME_CYCLE_KEY, String(cycleThemesOnRestart));
  }
});

adminPanel.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const actionNode = target.closest<HTMLElement>("[data-admin-action]");
  if (!actionNode) {
    return;
  }
  const action = actionNode.dataset.adminAction;
  if (action === "close") {
    toggleAdminPanel(false);
  } else if (action === "reset-theme") {
    activeTheme = getDefaultTheme();
    applyTheme(activeTheme);
    localStorage.removeItem(THEME_OVERRIDE_KEY);
    syncAdminPanel();
  }
});

if (new URLSearchParams(window.location.search).get("adminThemeLab") === "1") {
  toggleAdminPanel(true);
}

let previousTs = performance.now();
function animate(ts: number): void {
  const dtMs = Math.min(64, Math.max(0, ts - previousTs));
  previousTs = ts;
  tick(dtMs);
  render();
  requestAnimationFrame(animate);
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();
render();
requestAnimationFrame(animate);

function tick(dtMs: number): void {
  if (isPointerHeldOnOverlay && mode === "boot") {
    secretHoldTimer -= dtMs;
    if (secretHoldTimer <= 0) {
      secretArmed = true;
      secretTapCount = 0;
      secretTapDeadline = Date.now() + 2000;
      isPointerHeldOnOverlay = false;
      secretHoldTimer = 0;
    }
  }

  if (runActive) {
    globalElapsedMs += dtMs;
  }

  const inputFrame = input.consumeFrame();

  if (mode === "playing") {
    flow.elapsedInStageMs = globalElapsedMs - stageAttemptStartMs;
    stage.update(dtMs, inputFrame, frameWidth, frameHeight);
    flow.stageRaw = stage.getRawScore();
    markCommitUnlockedIfEligible(flow, false);

    if (stage.isDead()) {
      markCommitUnlockedIfEligible(flow, true);
      mode = "deathPause";
      deathPauseRemainingMs = 1500;
      audio.trigger("death");
    }
  } else if (mode === "deathPause") {
    deathPauseRemainingMs -= dtMs;
    if (deathPauseRemainingMs <= 0) {
      mode = "deathChoice";
    }
  } else if (mode === "transition") {
    transitionRemainingMs -= dtMs;
    if (transitionRemainingMs <= 0) {
      completeTransition();
    }
  }

  if (runActive && globalElapsedMs >= RUN_TOTAL_MS && mode !== "results" && mode !== "leaderboard") {
    forceEndRunByClock();
  }

  audio.update({
    active: runActive && (mode === "playing" || mode === "deathPause" || mode === "deathChoice"),
    stage: STAGE_IDS[flow.currentStageIndex] ?? "rhythm-serpent",
    score: flow.stageRaw,
    danger: mode === "deathPause" || mode === "deathChoice"
  });
}

function render(): void {
  const stageId = STAGE_IDS[flow.currentStageIndex] ?? "rhythm-serpent";
  const pulse = Math.min(
    1,
    0.28 + (runActive ? getStageBeatPulse(stageId, globalElapsedMs) : getStageBeatPulse("rhythm-serpent", performance.now())) * 0.95
  );

  ctx.clearRect(0, 0, frameWidth, frameHeight);
  drawBaseBackground(
    ctx,
    frameWidth,
    frameHeight,
    activeTheme,
    pulse,
    stageId,
    mode
  );

  if (mode === "playing" || mode === "deathPause" || mode === "deathChoice") {
    stage.draw(ctx, frameWidth, frameHeight, activeTheme, pulse);
  } else {
    drawIdleBackdrop(ctx, frameWidth, frameHeight, activeTheme, pulse);
  }

  syncHud();
  syncCommitButton();
  syncOverlay();
  syncAdminPanel();
}

function syncHud(): void {
  const leftMs = Math.max(0, RUN_TOTAL_MS - globalElapsedMs);
  hudTime.textContent = formatMs(leftMs);
  hudStage.textContent = mode === "results" || mode === "leaderboard" ? "Run Complete" : `Stage ${flow.currentStageIndex + 1}/3`;
  hudBank.textContent = `Triathalon Score: ${totalBankedTri()}`;
  hudScore.textContent = `Score: ${Math.round(flow.stageRaw)}`;
  hudHint.textContent = stage.getHudHint();
}

function syncCommitButton(): void {
  const show = mode === "playing" && canCommitNow(flow);
  commitBtn.classList.toggle("hidden", !show);
}

function syncOverlay(): void {
  let markup = "";

  if (mode === "boot") {
    markup = `
      <div class="card attract" data-secret-hold="true">
        <p class="eyebrow">NEON TOURNAMENT BROADCAST</p>
        <h1 class="title-stack"><span>FESTIVERSE</span><span>ARCADE TRIATHLON</span></h1>
        <p class="strap">3 games. One clock. One total score.</p>
        <p class="muted">Tap to enable audio and begin the set.</p>
        <button class="btn primary" data-testid="start" data-action="start-run">START</button>
        <div class="stage-pill-row">
          <span>RHYTHM SERPENT</span>
          <span>MOSH PIT PAC-MAN</span>
          <span>AMP INVADERS</span>
        </div>
        <small>Move forward after 60s. No backtracking once committed.</small>
      </div>
    `;
  } else if (mode === "deathPause") {
    markup = `
      <div class="card compact">
        <h2>Stage Impact</h2>
        <p>Hold for the drop...</p>
      </div>
    `;
  } else if (mode === "deathChoice") {
    markup = `
      <div class="card">
        <h2>Stage Ended</h2>
        <p>Retry here or bank this stage score and continue.</p>
        <div class="row">
          <button class="btn primary" data-action="retry">RETRY HERE</button>
          <button class="btn secondary" data-action="open-commit">BANK SCORE & CONTINUE</button>
        </div>
      </div>
    `;
  } else if (mode === "transition") {
    const nextLabel = flow.currentStageIndex >= STAGE_NAMES.length ? "Results" : STAGE_NAMES[flow.currentStageIndex];
    markup = `
      <div class="card">
        <h2>Stage ${transitionCommittedStageIndex + 1} Complete</h2>
        <p>Stage Score: ${Math.round(transitionStageRawScore)}</p>
        <p>Score Earned: +${transitionStageBankedScore}</p>
        <p>Triathalon Score: ${transitionTotalScore}</p>
        <p class="muted">Next: ${nextLabel}</p>
        <div class="row">
          <button class="btn primary" data-action="continue-stage">CONTINUE</button>
        </div>
      </div>
    `;
  } else if (mode === "results") {
    const splits = flow.bankedTri.map((value, idx) => `<li>${STAGE_NAMES[idx]}: ${value}</li>`).join("");
    markup = `
      <div class="card results">
        <h2>FINAL TRIATHALON SCORE</h2>
        <p class="score">${totalBankedTri()}</p>
        <ul>${splits}</ul>
        <div class="row">
          <button class="btn primary" data-action="submit-score">${submittedScore ? "SUBMITTED" : "SUBMIT TO LEADERBOARD"}</button>
          <button class="btn secondary" data-action="open-leaderboard">LEADERBOARD</button>
          <button class="btn secondary" data-action="play-again">PLAY AGAIN</button>
        </div>
      </div>
    `;
  } else if (mode === "leaderboard") {
    const rows = topScores()
      .map((entry, index) => `<li>#${index + 1} ${entry.player} · ${entry.total} · ${entry.splits.join("/")}</li>`)
      .join("");
    markup = `
      <div class="card results">
        <h2>LEADERBOARD</h2>
        <ol>${rows || "<li>No scores yet.</li>"}</ol>
        <div class="row">
          <button class="btn secondary" data-action="back-to-results">BACK</button>
        </div>
      </div>
    `;
  }

  if (markup !== lastOverlayMarkup) {
    overlay.innerHTML = markup;
    lastOverlayMarkup = markup;
  }
  overlay.classList.toggle("is-interactive", markup.trim().length > 0);
}

function syncAdminPanel(): void {
  const isOpen = !adminPanel.classList.contains("hidden");
  if (!isOpen) {
    return;
  }

  const options = themes
    .map((theme) => {
      const selected = theme.id === activeTheme.id ? "selected" : "";
      return `<option value="${theme.id}" ${selected}>${theme.id}</option>`;
    })
    .join("");

  adminPanel.innerHTML = `
    <h3>Theme Lab (Admin)</h3>
    <label>Active Theme
      <select id="admin-theme-select">${options}</select>
    </label>
    <label class="check">
      <input id="admin-persist-cycle" type="checkbox" ${cycleThemesOnRestart ? "checked" : ""} />
      Cycle Theme On Restart
    </label>
    <div class="row">
      <button class="btn secondary" data-admin-action="reset-theme">Reset Default</button>
      <button class="btn secondary" data-admin-action="close">Close</button>
    </div>
  `;
}

function toggleAdminPanel(open: boolean): void {
  adminPanel.classList.toggle("hidden", !open);
}

function startRun(): void {
  audio.start();
  if (cycleThemesOnRestart) {
    rotateTheme();
  }

  flow = createFlowState();
  globalElapsedMs = 0;
  stageAttemptStartMs = 0;
  runActive = true;
  submittedScore = false;
  startStage(flow.currentStageIndex);
  mode = "playing";
}

function startStage(index: number): void {
  flow.currentStageIndex = index;
  flow.elapsedInStageMs = 0;
  flow.stageRaw = 0;
  stage = createStage(index);
  input.setStage(STAGE_IDS[index] ?? "rhythm-serpent");
  stageAttemptStartMs = globalElapsedMs;
}

function onRetry(): void {
  retryStage(flow);
  startStage(flow.currentStageIndex);
  mode = "playing";
}

function completeTransition(): void {
  if (mode !== "transition") {
    return;
  }
  startStage(flow.currentStageIndex);
  mode = "playing";
}

function commitCurrentStage(skipTransition: boolean): void {
  if (!canCommitNow(flow)) {
    return;
  }
  const stageId = STAGE_IDS[flow.currentStageIndex];
  const raw = Math.max(0, stage.getRawScore());
  const tri = Math.round(toTriPoints(stageId, raw));
  flow.stageRaw = raw;
  const fromIndex = flow.currentStageIndex;

  advanceStage(flow, tri);
  audio.trigger("commit");

  if (fromIndex >= STAGE_IDS.length - 1) {
    runActive = false;
    mode = "results";
    return;
  }

  if (skipTransition) {
    startStage(flow.currentStageIndex);
    mode = "playing";
    return;
  }

  transitionCommittedStageIndex = fromIndex;
  transitionStageRawScore = raw;
  transitionStageBankedScore = tri;
  transitionTotalScore = totalBankedTri();
  transitionRemainingMs = 2000;
  mode = "transition";
}

function forceEndRunByClock(): void {
  const stageId = STAGE_IDS[flow.currentStageIndex];
  const raw = Math.max(0, stage.getRawScore());
  const tri = Math.round(toTriPoints(stageId, raw));
  flow.stageRaw = raw;
  flow.bankedRaw[flow.currentStageIndex] = raw;
  flow.bankedTri[flow.currentStageIndex] = tri;
  runActive = false;
  mode = "results";
}

function totalBankedTri(): number {
  return flow.bankedTri.reduce((sum, score) => sum + score, 0);
}

function submitCurrentRunScore(): void {
  if (submittedScore) {
    return;
  }
  const splits = [...flow.bankedTri];
  saveScore({
    player: "YOU",
    total: totalBankedTri(),
    splits
  });
  audio.trigger("submit");
  submittedScore = true;
}

function createStage(index: number): StageRuntime {
  if (index === 0) {
    return createRhythmSerpentStage();
  }
  if (index === 1) {
    return createMoshPitPacmanStage();
  }
  return createAmpInvadersStage();
}

function createRhythmSerpentStage(): StageRuntime {
  const grid = computeRhythmSerpentGrid(window.innerWidth, window.innerHeight);
  const cols = grid.cols;
  const rows = grid.rows;
  const instrumentIcons = ["🎸", "🎹", "🥁", "🎷", "🎺", "🎻"] as const;
  const spawnX = Math.max(2, Math.floor(cols * 0.5));
  const spawnY = Math.max(2, Math.floor(rows * 0.5));
  const snake: Array<{ x: number; y: number }> = [
    { x: spawnX, y: spawnY },
    { x: spawnX - 1, y: spawnY },
    { x: spawnX - 2, y: spawnY }
  ];
  let dir: Dir = "right";
  let moveMs = 0;
  let stageMs = 0;
  let score = 0;
  let dead = false;
  let openingGraceMs = 5500;
  let combo = 0;
  let comboTimerMs = 0;
  let food = randomGridPoint(cols, rows);
  let foodIcon = instrumentIcons[Math.floor(Math.random() * instrumentIcons.length)];
  let power: { x: number; y: number; kind: "bass-drop" | "encore" | "mosh-burst" } | null = null;
  let powerIcon = "";
  const trail: Array<{ x: number; y: number; bornMs: number; strength: number }> = [];
  const headGhosts: Array<{ x: number; y: number; bornMs: number; strength: number; color: string }> = [];
  const comboBursts: Array<{ bornMs: number; strength: number; color: string }> = [];
  let lastMoveDir: Dir = dir;
  let lastBurstMilestone = 0;
  const turnAssist = createMobileTurnAssistState({
    maxQueue: 3,
    ttlMs: 430,
    blockOppositeTurns: true
  });
  const timers = {
    bassDropMs: 0,
    encoreMs: 0,
    moshBurstMs: 0
  };

  function iconForPower(kind: "bass-drop" | "encore" | "mosh-burst"): string {
    if (kind === "bass-drop") return "🎸";
    if (kind === "encore") return "🎹";
    return "🥁";
  }

  function emitComboBurst(milestone: number): void {
    comboBursts.unshift({
      bornMs: stageMs,
      strength: Math.min(1, 0.42 + milestone * 0.055),
      color: milestone >= 8 ? "#ff2266" : milestone >= 5 ? "#ff44aa" : "#00e5ff"
    });
    if (comboBursts.length > 12) {
      comboBursts.length = 12;
    }
  }

  function spawnFoodAndMaybePower(): void {
    food = randomGridPoint(cols, rows, snake, power);
    foodIcon = instrumentIcons[Math.floor(Math.random() * instrumentIcons.length)];
    if (!power && Math.random() < 0.18) {
      const kinds: Array<"bass-drop" | "encore" | "mosh-burst"> = ["bass-drop", "encore", "mosh-burst"];
      power = {
        ...randomGridPoint(cols, rows, snake, null, food),
        kind: kinds[Math.floor(Math.random() * kinds.length)]
      };
      powerIcon = iconForPower(power.kind);
    }
  }

  function enqueueTurnInputs(input: InputFrame): void {
    let swipe = input.consumeSwipe();
    while (swipe) {
      enqueueTurnIntent(turnAssist, swipe, stageMs);
      swipe = input.consumeSwipe();
    }
    if (input.left) enqueueTurnIntent(turnAssist, "left", stageMs);
    if (input.right) enqueueTurnIntent(turnAssist, "right", stageMs);
    if (input.up) enqueueTurnIntent(turnAssist, "up", stageMs);
    if (input.down) enqueueTurnIntent(turnAssist, "down", stageMs);
  }

  return {
    id: "rhythm-serpent",
    update(dtMs, input) {
      if (dead) {
        return;
      }
      stageMs += dtMs;
      openingGraceMs = Math.max(0, openingGraceMs - dtMs);
      enqueueTurnInputs(input);

      comboTimerMs -= dtMs;
      if (comboTimerMs <= 0) {
        combo = 0;
        lastBurstMilestone = 0;
      }
      timers.bassDropMs = Math.max(0, timers.bassDropMs - dtMs);
      timers.encoreMs = Math.max(0, timers.encoreMs - dtMs);
      timers.moshBurstMs = Math.max(0, timers.moshBurstMs - dtMs);

      const baseTick = 150 - Math.min(56, snake.length * 2);
      let tick = baseTick;
      if (timers.bassDropMs > 0) tick *= 1.5;
      if (timers.moshBurstMs > 0) tick *= 0.72;

      moveMs += dtMs;
      while (moveMs >= tick) {
        moveMs -= tick;
        const assistedTurn = consumeTurnIntent(turnAssist, stageMs, dir, () => true);
        if (assistedTurn) {
          dir = assistedTurn;
        }
        const next = { ...snake[0] };
        if (dir === "left") next.x -= 1;
        if (dir === "right") next.x += 1;
        if (dir === "up") next.y -= 1;
        if (dir === "down") next.y += 1;

        const hitsWall = next.x < 0 || next.y < 0 || next.x >= cols || next.y >= rows;
        const hitsSelf = snake.some((segment) => segment.x === next.x && segment.y === next.y);
        if ((hitsWall || hitsSelf) && timers.encoreMs <= 0 && openingGraceMs <= 0) {
          dead = true;
          return;
        }

        if (hitsWall && (timers.encoreMs > 0 || openingGraceMs > 0)) {
          next.x = (next.x + cols) % cols;
          next.y = (next.y + rows) % rows;
        }

        const wasDir = lastMoveDir;
        snake.unshift(next);
        trail.unshift({
          x: next.x + 0.5,
          y: next.y + 0.5,
          bornMs: stageMs,
          strength: Math.min(1, 0.42 + combo * 0.08)
        });
        if (trail.length > 160) {
          trail.length = 160;
        }
        if (dir !== wasDir) {
          headGhosts.unshift({
            x: next.x + 0.5,
            y: next.y + 0.5,
            bornMs: stageMs,
            strength: Math.min(1.2, 0.5 + combo * 0.08),
            color: combo >= 6 ? "#ff2266" : "#ff6ec7"
          });
          if (headGhosts.length > 42) {
            headGhosts.length = 42;
          }
        }
        lastMoveDir = dir;

        const ateFood = next.x === food.x && next.y === food.y;
        let grew = false;
        if (ateFood) {
          combo = Math.max(1, combo + 1);
          comboTimerMs = 3000;
          const mult = combo >= 8 ? 2.5 : combo >= 5 ? 2 : combo >= 3 ? 1.5 : 1;
          score += Math.round(12 * mult);
          audio.trigger("pickup");
          grew = true;
          for (const milestone of [3, 5, 8, 12]) {
            if (combo >= milestone && lastBurstMilestone < milestone) {
              emitComboBurst(milestone);
              lastBurstMilestone = milestone;
            }
          }
          spawnFoodAndMaybePower();
        }

        if (power && next.x === power.x && next.y === power.y) {
          if (power.kind === "bass-drop") {
            timers.bassDropMs = 4500;
            score += 35;
          } else if (power.kind === "encore") {
            timers.encoreMs = 4000;
            score += 45;
          } else {
            timers.moshBurstMs = 3500;
            score += 30;
          }
          audio.trigger("pickup");
          emitComboBurst(combo >= 8 ? 8 : 5);
          power = null;
          powerIcon = "";
        }

        if (!grew) {
          snake.pop();
        }
      }

      while (trail.length && stageMs - trail[trail.length - 1].bornMs > 880) {
        trail.pop();
      }
      while (headGhosts.length && stageMs - headGhosts[headGhosts.length - 1].bornMs > 560) {
        headGhosts.pop();
      }
      while (comboBursts.length && stageMs - comboBursts[comboBursts.length - 1].bornMs > 980) {
        comboBursts.pop();
      }
    },
    draw(context, width, height, theme, pulse) {
      const phase =
        score >= 220
          ? { label: "THE DROP", accent: "#ff2266", gridAlpha: 0.34 }
          : score >= 90
          ? { label: "BUILD-UP", accent: "#ff44aa", gridAlpha: 0.26 }
          : { label: "OPENING", accent: "#ff6ec7", gridAlpha: 0.18 };
      const cell = Math.floor(Math.min(width / cols, height / rows));
      const fieldW = cols * cell;
      const fieldH = rows * cell;
      const offX = Math.floor((width - fieldW) / 2);
      const offY = Math.floor((height - fieldH) / 2);
      const beatBounce = Math.pow(0.2 + pulse * 0.8, 2);
      const now = performance.now();
      const progress = Math.max(0, Math.min(1, score / 360));
      const comboLift = Math.max(0, Math.min(1, combo / 10));
      const powerLift = timers.encoreMs > 0 ? 0.2 : timers.bassDropMs > 0 ? 0.18 : timers.moshBurstMs > 0 ? 0.16 : 0;
      const energy = Math.max(0.12, Math.min(1, progress * 0.72 + comboLift * 0.24 + powerLift));
      const shakeBase = energy > 0.55 ? (energy - 0.55) * 3.6 : 0;
      const shakePower = timers.moshBurstMs > 0 ? 2.8 : timers.bassDropMs > 0 ? 2.1 : timers.encoreMs > 0 ? 1.5 : 0;
      const shakeAmp = shakeBase + shakePower;
      const shakeX =
        Math.sin(now * 0.038 + combo * 0.13) * shakeAmp +
        Math.sin(now * 0.012 + score * 0.015) * shakeAmp * 0.45;
      const shakeY = Math.cos(now * 0.044 + 0.7) * shakeAmp * 0.72;

      if (shakeAmp > 0.05) {
        context.save();
        context.translate(shakeX, shakeY);
      }

      context.save();
      context.globalAlpha = 0.2;
      context.fillStyle = "#090013";
      context.fillRect(offX - 12, offY - 12, fieldW + 24, fieldH + 24);
      context.restore();

      const aura = context.createRadialGradient(
        offX + fieldW * 0.5,
        offY + fieldH * 0.5,
        cell * 2,
        offX + fieldW * 0.5,
        offY + fieldH * 0.5,
        cell * (8.8 + energy * 7.6)
      );
      aura.addColorStop(0, withAlpha(phase.accent, 0.08 + energy * 0.16 + beatBounce * 0.08));
      aura.addColorStop(1, withAlpha(phase.accent, 0));
      context.fillStyle = aura;
      context.fillRect(offX - cell * 4, offY - cell * 4, fieldW + cell * 8, fieldH + cell * 8);

      context.fillStyle = withAlpha("#05000a", 0.9);
      context.fillRect(offX, offY, fieldW, fieldH);

      const sweepCount = 2 + Math.floor(energy * 4);
      for (let i = 0; i < sweepCount; i += 1) {
        const p = ((now * (0.00004 + energy * 0.00009) + i * 0.19) % 1 + 1) % 1;
        const x = offX + p * fieldW;
        const sweep = context.createLinearGradient(x, offY, x + cell * 0.9, offY + fieldH);
        sweep.addColorStop(0, withAlpha(phase.accent, 0.06 + energy * 0.12));
        sweep.addColorStop(1, withAlpha("#00e5ff", 0));
        context.fillStyle = sweep;
        context.fillRect(x - cell * 0.45, offY, cell * 1.1, fieldH);
      }

      context.strokeStyle = withAlpha("#00e5ff", phase.gridAlpha);
      context.lineWidth = 1.1;
      for (let x = 0; x <= cols; x += 1) {
        context.beginPath();
        context.moveTo(offX + x * cell, offY);
        context.lineTo(offX + x * cell, offY + fieldH);
        context.stroke();
      }
      for (let y = 0; y <= rows; y += 1) {
        context.beginPath();
        context.moveTo(offX, offY + y * cell);
        context.lineTo(offX + fieldW, offY + y * cell);
        context.stroke();
      }

      context.fillStyle = withAlpha("#220044", 0.78);
      for (let y = 0; y < rows; y += 3) {
        const barY = offY + y * cell + 2;
        const dynamic = Math.sin(now * 0.01 + y * 0.8) * (2 + energy * 6);
        const barH = Math.max(8, cell * 2 - 4 + dynamic + beatBounce * 5);
        context.fillRect(offX - 8, barY, 6, barH);
        context.fillRect(offX + fieldW + 2, barY, 6, barH);
      }

      const foodX = offX + food.x * cell + cell * 0.5;
      const foodY = offY + food.y * cell + cell * 0.5;
      const foodGlow = context.createRadialGradient(foodX, foodY, cell * 0.06, foodX, foodY, cell * 0.86);
      foodGlow.addColorStop(0, withAlpha("#00e5ff", 0.7 + beatBounce * 0.18));
      foodGlow.addColorStop(1, withAlpha("#00e5ff", 0));
      context.fillStyle = foodGlow;
      context.fillRect(foodX - cell, foodY - cell, cell * 2, cell * 2);
      context.fillStyle = withAlpha(theme.palette.accent, 0.8);
      context.beginPath();
      context.arc(foodX, foodY, cell * (0.16 + beatBounce * 0.06), 0, Math.PI * 2);
      context.fill();
      context.save();
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.font = `${Math.max(14, Math.floor(cell * 0.72))}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
      context.fillText(foodIcon, foodX, foodY + 1);
      context.restore();

      if (power) {
        const powerX = offX + power.x * cell + cell * 0.5;
        const powerY = offY + power.y * cell + cell * 0.5;
        context.fillStyle = power.kind === "encore" ? "#ffd447" : power.kind === "bass-drop" ? "#4dd6ff" : "#ff7a34";
        context.beginPath();
        context.arc(powerX, powerY, cell * 0.55, 0, Math.PI * 2);
        context.fill();
        const powerGlow = context.createRadialGradient(powerX, powerY, cell * 0.12, powerX, powerY, cell * 0.98);
        powerGlow.addColorStop(0, withAlpha(power.kind === "encore" ? "#ffd447" : power.kind === "bass-drop" ? "#4dd6ff" : "#ff7a34", 0.82));
        powerGlow.addColorStop(1, withAlpha("#120018", 0));
        context.fillStyle = powerGlow;
        context.beginPath();
        context.arc(powerX, powerY, cell * 0.9, 0, Math.PI * 2);
        context.fill();
        context.save();
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.font = `${Math.max(14, Math.floor(cell * 0.72))}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
        context.fillText(powerIcon, powerX, powerY + 1);
        context.restore();
      }

      for (let i = trail.length - 1; i >= 0; i -= 1) {
        const point = trail[i];
        const life = 1 - (stageMs - point.bornMs) / 880;
        if (life <= 0) {
          continue;
        }
        const tx = offX + point.x * cell;
        const ty = offY + point.y * cell;
        const radius = cell * (0.2 + life * 0.48 + energy * 0.09);
        const glow = context.createRadialGradient(tx, ty, cell * 0.03, tx, ty, radius);
        glow.addColorStop(0, withAlpha(phase.accent, life * (0.16 + point.strength * 0.12)));
        glow.addColorStop(1, withAlpha("#00e5ff", 0));
        context.fillStyle = glow;
        context.fillRect(tx - radius, ty - radius, radius * 2, radius * 2);
      }

      for (let i = headGhosts.length - 1; i >= 0; i -= 1) {
        const ghost = headGhosts[i];
        const life = 1 - (stageMs - ghost.bornMs) / 560;
        if (life <= 0) {
          continue;
        }
        const gx = offX + ghost.x * cell;
        const gy = offY + ghost.y * cell;
        const spread = cell * (0.22 + (1 - life) * 0.4);
        context.fillStyle = withAlpha(ghost.color, life * (0.14 + ghost.strength * 0.08));
        context.fillRect(gx - spread * 0.5, gy - spread * 0.5, spread, spread);
        context.strokeStyle = withAlpha("#ffffff", life * 0.16);
        context.lineWidth = 1.2;
        context.strokeRect(gx - spread * 0.42, gy - spread * 0.42, spread * 0.84, spread * 0.84);
      }

      snake.forEach((segment, index) => {
        const ratio = 1 - index / Math.max(1, snake.length - 1);
        const sx = offX + segment.x * cell;
        const sy = offY + segment.y * cell;
        if (index === 0) {
          const headGlow = context.createRadialGradient(
            sx + cell * 0.5,
            sy + cell * 0.5,
            cell * 0.1,
            sx + cell * 0.5,
            sy + cell * 0.5,
            cell * 0.9
          );
          headGlow.addColorStop(0, withAlpha(phase.accent, 0.6 + beatBounce * 0.28));
          headGlow.addColorStop(1, withAlpha(phase.accent, 0));
          context.fillStyle = headGlow;
          context.fillRect(sx - cell * 0.7, sy - cell * 0.7, cell * 2.4, cell * 2.4);
        } else if (index % 2 === 0) {
          context.fillStyle = withAlpha("#ff2d95", 0.18 - ratio * 0.08 + beatBounce * 0.04);
          context.fillRect(sx - 1, sy - 1, cell + 2, cell + 2);
        }
        context.fillStyle = index === 0 ? "#ff2d95" : lerpColor("#ff6ec7", "#00e5ff", ratio);
        context.fillRect(sx + 1, sy + 1, cell - 2, cell - 2);
        if (index === 0) {
          context.fillStyle = withAlpha("#ffffff", 0.45 + beatBounce * 0.2);
          context.fillRect(sx + cell * 0.58, sy + cell * 0.18, cell * 0.16, cell * 0.16);
        }
      });

      const crowdY = offY + fieldH + 8;
      context.fillStyle = withAlpha("#311044", 0.6);
      for (let i = 0; i < 22; i += 1) {
        const personX = offX + (i / 21) * fieldW;
        const bob = Math.sin(now * 0.004 + i) * (2 + beatBounce * 4);
        context.beginPath();
        context.arc(personX, crowdY + bob, 3 + (i % 3), 0, Math.PI * 2);
        context.fill();
        context.fillRect(personX - 2, crowdY + bob + 3, 4, 8);
      }

      if (energy > 0.62) {
        const ambientLasers = 1 + Math.floor((energy - 0.62) * 7);
        for (let i = 0; i < ambientLasers; i += 1) {
          const phase = ((now * (0.00004 + energy * 0.00006) + i * 0.17) % 1 + 1) % 1;
          const lx = offX + phase * fieldW;
          const beamW = cell * (0.15 + energy * 0.18);
          const beam = context.createLinearGradient(lx, crowdY + 10, lx, offY - cell * 1.4);
          beam.addColorStop(0, withAlpha("#ff2d95", 0.18 + energy * 0.22));
          beam.addColorStop(1, withAlpha("#00e5ff", 0));
          context.fillStyle = beam;
          context.fillRect(lx - beamW * 0.5, offY - cell * 1.4, beamW, crowdY - offY + cell * 1.4);
        }
      }

      for (let i = comboBursts.length - 1; i >= 0; i -= 1) {
        const burst = comboBursts[i];
        const life = 1 - (stageMs - burst.bornMs) / 980;
        if (life <= 0) {
          continue;
        }
        const beams = 3 + Math.floor(burst.strength * 5);
        for (let j = 0; j < beams; j += 1) {
          const phase = ((j / beams + burst.bornMs * 0.00015) % 1 + 1) % 1;
          const bx = offX + phase * fieldW;
          const beamW = cell * (0.18 + burst.strength * 0.32) * (0.35 + life);
          const beam = context.createLinearGradient(bx, crowdY + 8, bx, offY - cell * 1.8);
          beam.addColorStop(0, withAlpha(burst.color, life * 0.36));
          beam.addColorStop(1, withAlpha("#ffffff", life * 0.03));
          context.fillStyle = beam;
          context.fillRect(bx - beamW * 0.5, offY - cell * 1.8, beamW, crowdY - offY + cell * 1.8);
        }
        context.fillStyle = withAlpha(burst.color, life * 0.06);
        context.fillRect(offX, offY, fieldW, fieldH);
      }

      context.strokeStyle = withAlpha(phase.accent, 0.92);
      context.lineWidth = 2.5;
      context.strokeRect(offX - 2, offY - 2, fieldW + 4, fieldH + 4);
      context.fillStyle = withAlpha("#ffddff", 0.78);
      context.font = `bold ${Math.max(10, Math.floor(cell * 0.46))}px "Courier New", monospace`;
      context.textAlign = "left";
      context.textBaseline = "alphabetic";
      context.fillText(phase.label, offX + 10, offY + fieldH - 8);
      context.textAlign = "right";
      context.fillText(`ENERGY ${Math.round(energy * 100)}%`, offX + fieldW - 10, offY + fieldH - 8);

      if (shakeAmp > 0.05) {
        context.restore();
      }
    },
    getRawScore() {
      return score;
    },
    isDead() {
      return dead;
    },
    getHudHint() {
      const active =
        timers.encoreMs > 0
          ? "ENCORE"
          : timers.bassDropMs > 0
          ? "BASS DROP"
          : timers.moshBurstMs > 0
          ? "MOSH BURST"
          : "Collect notes. Build combo.";
      return `Combo x${Math.max(1, combo)} • ${active}`;
    },
    debugState() {
      return {
        currentDir: dir,
        grid: { cols, rows },
        playerHead: { x: snake[0].x, y: snake[0].y },
        combo,
        snakeLength: snake.length,
        powerActive: { ...timers },
        turnTelemetry: readTurnAssistTelemetry(turnAssist)
      };
    }
  };
}

function createMoshPitPacmanStage(): StageRuntime {
  const mapTemplate = [
    "###################",
    "#........#........#",
    "#.###.##.#.##.###.#",
    "#o###.##.#.##.###o#",
    "#.................#",
    "#.###.#.###.#.###.#",
    "#.....#...#.#.....#",
    "#####.### #.#####.#",
    "#.....#...#.......#",
    "#.###.#.###.#.###.#",
    "#........#........#",
    "###.##.##.#.##.##.#",
    "#o..##.... ....##o#",
    "#.#########.#####.#",
    "#.................#",
    "###################"
  ];
  const map = mapTemplate.map((row) => row.split(""));
  const rows = map.length;
  const cols = map[0].length;

  let player = { x: 1, y: 1, dir: "right" as Dir, want: "right" as Dir };
  let moveMs = 0;
  let guardMoveMs = 0;
  let stageMs = 0;
  let frightMs = 0;
  let score = 0;
  let dead = false;
  let level = 1;
  let guardChain = 0;
  const turnAssist = createMobileTurnAssistState({
    maxQueue: 3,
    ttlMs: 380,
    blockOppositeTurns: false
  });

  const guards: Array<{ x: number; y: number; dir: Dir; homeX: number; homeY: number }> = [
    { x: cols - 2, y: 1, dir: "left", homeX: cols - 2, homeY: 1 },
    { x: cols - 2, y: rows - 2, dir: "up", homeX: cols - 2, homeY: rows - 2 },
    { x: 1, y: rows - 2, dir: "right", homeX: 1, homeY: rows - 2 }
  ];

  const zoneCollected = [0, 0, 0, 0, 0];
  const zoneTotals = [0, 0, 0, 0, 0];
  let zoneMusic = createZoneMusicState(zoneTotals.length);
  let renderCoverageY = 0;
  recomputeZoneTotals();

  function zoneIndex(x: number, y: number): number {
    const centerX = Math.floor(cols / 2);
    const centerY = Math.floor(rows / 2);
    if (y < centerY - 2 && x < centerX - 1) return 0;
    if (y < centerY - 2 && x > centerX + 1) return 1;
    if (y > centerY + 1 && x < centerX - 1) return 2;
    if (y > centerY + 1 && x > centerX + 1) return 3;
    return 4;
  }

  function recomputeZoneTotals(): void {
    zoneTotals.fill(0);
    zoneCollected.fill(0);
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        if (map[y][x] === "." || map[y][x] === "o") {
          zoneTotals[zoneIndex(x, y)] += 1;
        }
      }
    }
    zoneMusic = createZoneMusicState(zoneTotals.length);
  }

  function canMove(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= cols || y >= rows) return false;
    return map[y][x] !== "#";
  }

  function dirDelta(direction: Dir): { x: number; y: number } {
    if (direction === "left") return { x: -1, y: 0 };
    if (direction === "right") return { x: 1, y: 0 };
    if (direction === "up") return { x: 0, y: -1 };
    return { x: 0, y: 1 };
  }

  function maybeCollectCell(x: number, y: number): void {
    const cell = map[y][x];
    if (cell !== "." && cell !== "o") return;
    const zone = zoneIndex(x, y);
    zoneCollected[zone] += 1;
    if (cell === ".") {
      score += 10;
    } else {
      score += 50;
      frightMs = 6000;
      guardChain = 0;
    }
    audio.trigger("pickup");
    map[y][x] = " ";
  }

  function refillPellets(): void {
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        if (mapTemplate[y][x] === "." || mapTemplate[y][x] === "o") {
          map[y][x] = mapTemplate[y][x];
        }
      }
    }
    level += 1;
    score += 300;
    recomputeZoneTotals();
  }

  function pelletCount(): number {
    let count = 0;
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        if (map[y][x] === "." || map[y][x] === "o") {
          count += 1;
        }
      }
    }
    return count;
  }

  function moveGuard(guard: { x: number; y: number; dir: Dir; homeX: number; homeY: number }): void {
    const dirs: Dir[] = ["left", "right", "up", "down"];
    const reverse: Record<Dir, Dir> = { left: "right", right: "left", up: "down", down: "up" };
    const options = dirs.filter((direction) => {
      const delta = dirDelta(direction);
      const nx = guard.x + delta.x;
      const ny = guard.y + delta.y;
      if (!canMove(nx, ny)) return false;
      if (optionsAt(guard.x, guard.y) > 1 && direction === reverse[guard.dir]) return false;
      return true;
    });

    if (options.length === 0) {
      return;
    }

    let chosen = options[0];
    if (frightMs > 0) {
      chosen = options[Math.floor(Math.random() * options.length)];
    } else {
      let best = Number.POSITIVE_INFINITY;
      for (const direction of options) {
        const delta = dirDelta(direction);
        const nx = guard.x + delta.x;
        const ny = guard.y + delta.y;
        const dist = Math.abs(nx - player.x) + Math.abs(ny - player.y);
        if (dist < best) {
          best = dist;
          chosen = direction;
        }
      }
    }

    guard.dir = chosen;
    const move = dirDelta(chosen);
    guard.x += move.x;
    guard.y += move.y;
  }

  function optionsAt(x: number, y: number): number {
    let count = 0;
    const dirs: Dir[] = ["left", "right", "up", "down"];
    for (const direction of dirs) {
      const delta = dirDelta(direction);
      if (canMove(x + delta.x, y + delta.y)) count += 1;
    }
    return count;
  }

  function checkGuardCollision(): void {
    for (const guard of guards) {
      if (guard.x !== player.x || guard.y !== player.y) continue;
      if (frightMs > 0) {
        guardChain += 1;
        score += 200 * Math.pow(2, Math.min(3, guardChain - 1));
        audio.trigger("pickup");
        guard.x = guard.homeX;
        guard.y = guard.homeY;
        guard.dir = "left";
      } else {
        dead = true;
      }
    }
  }

  function enqueueTurnInputs(input: InputFrame): void {
    let swipe = input.consumeSwipe();
    while (swipe) {
      enqueueTurnIntent(turnAssist, swipe, stageMs);
      swipe = input.consumeSwipe();
    }
    if (input.left) enqueueTurnIntent(turnAssist, "left", stageMs);
    if (input.right) enqueueTurnIntent(turnAssist, "right", stageMs);
    if (input.up) enqueueTurnIntent(turnAssist, "up", stageMs);
    if (input.down) enqueueTurnIntent(turnAssist, "down", stageMs);
  }

  return {
    id: "moshpit-pacman",
    update(dtMs, input) {
      if (dead) return;
      stageMs += dtMs;
      enqueueTurnInputs(input);

      frightMs = Math.max(0, frightMs - dtMs);
      moveMs += dtMs;
      guardMoveMs += dtMs;

      const playerStep = Math.max(72, 130 - level * 5);
      while (moveMs >= playerStep) {
        moveMs -= playerStep;
        const assistedTurn = consumeTurnIntent(turnAssist, stageMs, player.dir, (candidate) => {
          const delta = dirDelta(candidate);
          return canMove(player.x + delta.x, player.y + delta.y);
        });
        if (assistedTurn) {
          player.want = assistedTurn;
        }
        const wantedDelta = dirDelta(player.want);
        if (canMove(player.x + wantedDelta.x, player.y + wantedDelta.y)) {
          player.dir = player.want;
        }
        const step = dirDelta(player.dir);
        if (canMove(player.x + step.x, player.y + step.y)) {
          player.x += step.x;
          player.y += step.y;
        }
        maybeCollectCell(player.x, player.y);
        checkGuardCollision();
      }

      const guardStep = Math.max(90, 156 - level * 4) + (frightMs > 0 ? 24 : 0);
      while (guardMoveMs >= guardStep) {
        guardMoveMs -= guardStep;
        for (const guard of guards) {
          moveGuard(guard);
        }
        checkGuardCollision();
      }

      const nextZoneMusic = updateZoneMusicState(zoneMusic, zoneCollected, zoneTotals, frightMs);
      if (nextZoneMusic.pendingStingers > 0) {
        const burst = Math.min(2, nextZoneMusic.pendingStingers);
        for (let i = 0; i < burst; i += 1) {
          audio.trigger("zone");
        }
      }
      zoneMusic = nextZoneMusic;

      if (pelletCount() === 0) {
        refillPellets();
      }
    },
    draw(context, width, height, theme) {
      const zoneColors = ["#ff4444", "#ff8833", "#44ddff", "#cc44ff", "#ffdd44"];
      const isPortrait = height / Math.max(1, width) > 1.35;
      const cellX = Math.max(10, Math.floor(width / cols));
      const targetFieldH = isPortrait ? height * 0.72 : height * 0.58;
      const cellY = Math.max(cellX, Math.floor(targetFieldH / rows));
      const fieldW = cols * cellX;
      const fieldH = rows * cellY;
      const offX = Math.floor((width - fieldW) / 2);
      const offY = Math.floor((height - fieldH) / 2);
      renderCoverageY = fieldH / Math.max(1, height);
      const unit = Math.min(cellX, cellY);
      const beatPulseRaw = 0.5 + Math.sin(performance.now() * 0.008) * 0.5;
      const beatPulse = Math.max(0, Math.min(1, beatPulseRaw * 0.8 + zoneMusic.intensity * 0.24));

      function drawZoneNoteGlyph(zone: number, x: number, y: number, size: number, color: string): void {
        context.fillStyle = color;
        context.strokeStyle = color;
        context.lineWidth = 1.6;
        if (zone === 0) {
          context.beginPath();
          context.moveTo(x - size, y - size);
          context.lineTo(x + size, y + size);
          context.moveTo(x + size, y - size);
          context.lineTo(x - size, y + size);
          context.stroke();
          return;
        }
        if (zone === 1) {
          context.beginPath();
          context.arc(x - size * 0.2, y + size * 0.25, size * 0.62, 0, Math.PI * 2);
          context.fill();
          context.fillRect(x + size * 0.25, y - size * 1.5, size * 0.24, size * 1.8);
          return;
        }
        if (zone === 2) {
          context.beginPath();
          context.moveTo(x, y - size);
          context.lineTo(x + size, y);
          context.lineTo(x, y + size);
          context.lineTo(x - size, y);
          context.closePath();
          context.fill();
          return;
        }
        if (zone === 3) {
          context.beginPath();
          context.arc(x - size * 0.5, y + size * 0.15, size * 0.44, 0, Math.PI * 2);
          context.arc(x + size * 0.5, y + size * 0.05, size * 0.44, 0, Math.PI * 2);
          context.fill();
          context.fillRect(x - size * 0.15, y - size * 1.4, size * 0.22, size * 1.6);
          context.fillRect(x + size * 0.8, y - size * 1.4, size * 0.22, size * 1.3);
          context.fillRect(x - size * 0.15, y - size * 1.4, size * 1.2, size * 0.2);
          return;
        }
        context.beginPath();
        context.arc(x, y, size * 0.58, 0, Math.PI * 2);
        context.fill();
      }

      context.fillStyle = withAlpha("#08001a", 0.8);
      context.fillRect(offX - 10, offY - 10, fieldW + 20, fieldH + 20);

      const corners = [
        [0.08, 0.12, "#ff2244"],
        [0.92, 0.12, "#2266ff"],
        [0.08, 0.88, "#22ff88"],
        [0.92, 0.88, "#ffcc22"]
      ] as const;
      for (const [cx, cy, color] of corners) {
        const glow = context.createRadialGradient(width * cx, height * cy, 8, width * cx, height * cy, width * 0.23);
        glow.addColorStop(0, withAlpha(color, 0.2 + beatPulse * 0.08));
        glow.addColorStop(1, withAlpha(color, 0));
        context.fillStyle = glow;
        context.fillRect(0, 0, width, height);
      }

      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < cols; x += 1) {
          const cellType = map[y][x];
          const px = offX + x * cellX;
          const py = offY + y * cellY;
          const zone = zoneIndex(x, y);
          context.fillStyle = withAlpha(zoneColors[zone], 0.04);
          context.fillRect(px, py, cellX, cellY);

          if (cellType === "#") {
            context.fillStyle = withAlpha("#160828", 0.95);
            context.fillRect(px, py, cellX, cellY);
            const edgeColor = frightMs > 0 ? "#00ddaa" : zoneColors[zone];
            context.strokeStyle = withAlpha(edgeColor, 0.72 + zoneMusic.intensity * 0.14);
            context.lineWidth = 1.2;
            if (y === 0 || map[y - 1][x] !== "#") {
              context.beginPath();
              context.moveTo(px, py + 1);
              context.lineTo(px + cellX, py + 1);
              context.stroke();
            }
            if (y === rows - 1 || map[y + 1][x] !== "#") {
              context.beginPath();
              context.moveTo(px, py + cellY - 1);
              context.lineTo(px + cellX, py + cellY - 1);
              context.stroke();
            }
            if (x === 0 || map[y][x - 1] !== "#") {
              context.beginPath();
              context.moveTo(px + 1, py);
              context.lineTo(px + 1, py + cellY);
              context.stroke();
            }
            if (x === cols - 1 || map[y][x + 1] !== "#") {
              context.beginPath();
              context.moveTo(px + cellX - 1, py);
              context.lineTo(px + cellX - 1, py + cellY);
              context.stroke();
            }
          } else if (cellType === "." || cellType === "o") {
            const centerX = px + cellX * 0.5;
            const centerY = py + cellY * 0.5;
            if (cellType === ".") {
              drawZoneNoteGlyph(zone, centerX, centerY, unit * (0.12 + beatPulse * 0.03), zoneColors[zone]);
            } else {
              context.beginPath();
              context.arc(centerX, centerY, unit * (0.26 + beatPulse * 0.05), 0, Math.PI * 2);
              context.fillStyle = withAlpha("#00ddaa", 0.24 + beatPulse * 0.15);
              context.fill();
              context.beginPath();
              context.arc(centerX, centerY, unit * 0.15, 0, Math.PI * 2);
              context.fillStyle = "#00ddaa";
              context.fill();
            }
          }
        }
      }

      const playerCenterX = offX + player.x * cellX + cellX * 0.5;
      const playerCenterY = offY + player.y * cellY + cellY * 0.5;
      const playerGlow = context.createRadialGradient(
        playerCenterX,
        playerCenterY,
        unit * 0.1,
        playerCenterX,
        playerCenterY,
        unit * 1.2
      );
      playerGlow.addColorStop(0, withAlpha(frightMs > 0 ? "#00ffcc" : "#ffcc33", 0.38));
      playerGlow.addColorStop(1, withAlpha(frightMs > 0 ? "#00ffcc" : "#ffcc33", 0));
      context.fillStyle = playerGlow;
      context.fillRect(playerCenterX - unit * 1.2, playerCenterY - unit * 1.2, unit * 2.4, unit * 2.4);

      const angleMap: Record<Dir, number> = { right: 0, left: Math.PI, up: -Math.PI / 2, down: Math.PI / 2 };
      const facing = angleMap[player.dir];
      context.fillStyle = frightMs > 0 ? "#33ffd6" : "#ffe35f";
      context.beginPath();
      context.moveTo(playerCenterX, playerCenterY);
      context.arc(playerCenterX, playerCenterY, unit * 0.38, facing + 0.35, facing + Math.PI * 2 - 0.35);
      context.closePath();
      context.fill();

      guards.forEach((guard, index) => {
        const gx = offX + guard.x * cellX + cellX * 0.5;
        const gy = offY + guard.y * cellY + cellY * 0.5;
        if (frightMs > 0) {
          context.fillStyle = "#4aa8ff";
          context.beginPath();
          context.arc(gx, gy, unit * 0.34, 0, Math.PI * 2);
          context.fill();
          context.strokeStyle = withAlpha("#ffffff", 0.8);
          context.lineWidth = 1.2;
          context.beginPath();
          context.moveTo(gx - unit * 0.2, gy + unit * 0.12);
          context.lineTo(gx - unit * 0.05, gy + unit * 0.24);
          context.lineTo(gx + unit * 0.1, gy + unit * 0.12);
          context.lineTo(gx + unit * 0.25, gy + unit * 0.24);
          context.stroke();
          return;
        }

        const character = index % 3;
        if (character === 0) {
          context.fillStyle = "#ff3344";
          context.fillRect(gx - cellX * 0.32, gy - cellY * 0.3, cellX * 0.64, cellY * 0.62);
          context.fillStyle = "#111111";
          context.fillRect(gx - cellX * 0.2, gy - cellY * 0.16, cellX * 0.4, cellY * 0.14);
          context.fillStyle = "#ffd447";
          context.fillRect(gx - cellX * 0.24, gy + cellY * 0.1, cellX * 0.48, cellY * 0.08);
        } else if (character === 1) {
          context.fillStyle = "#ff77cc";
          context.beginPath();
          context.arc(gx, gy - unit * 0.02, unit * 0.3, 0, Math.PI * 2);
          context.fill();
          context.fillStyle = "#262626";
          context.fillRect(gx - cellX * 0.2, gy + cellY * 0.14, cellX * 0.38, cellY * 0.2);
          context.fillStyle = "#88aaff";
          context.beginPath();
          context.arc(gx - unit * 0.02, gy + unit * 0.24, unit * 0.08, 0, Math.PI * 2);
          context.fill();
        } else {
          context.fillStyle = "#44aaff";
          context.fillRect(gx - cellX * 0.32, gy - cellY * 0.18, cellX * 0.64, cellY * 0.35);
          context.fillStyle = "#222222";
          context.beginPath();
          context.arc(gx - unit * 0.2, gy + unit * 0.24, unit * 0.08, 0, Math.PI * 2);
          context.arc(gx + unit * 0.2, gy + unit * 0.24, unit * 0.08, 0, Math.PI * 2);
          context.fill();
          context.fillStyle = "#ffaa00";
          context.fillRect(gx - cellX * 0.18, gy - cellY * 0.3, cellX * 0.36, cellY * 0.06);
        }
      });

      const zoneNames = ["D", "B", "S", "L", "V"];
      const zoneBarY = Math.max(8, offY - 18);
      for (let i = 0; i < zoneNames.length; i += 1) {
        const total = Math.max(1, zoneTotals[i]);
        const pct = zoneCollected[i] / total;
        const x = offX + (i / zoneNames.length) * fieldW;
        const w = fieldW / zoneNames.length - 4;
        context.fillStyle = withAlpha(zoneColors[i], 0.22 + zoneMusic.intensity * 0.1);
        context.fillRect(x + 2, zoneBarY, w, 10);
        context.fillStyle = withAlpha(zoneColors[i], 0.92);
        context.fillRect(x + 2, zoneBarY, w * Math.min(1, pct), 10);
        context.fillStyle = theme.palette.text;
        context.font = "10px monospace";
        context.fillText(zoneNames[i], x + 4, zoneBarY - 4);
      }
    },
    getRawScore() {
      return score;
    },
    isDead() {
      return dead;
    },
    getHudHint() {
      if (frightMs > 0) {
        return `Backstage Pass Active • Chase security • Groove ${Math.round(zoneMusic.intensity * 100)}%`;
      }
      return `Collect picks. Clear zones. Groove ${Math.round(zoneMusic.intensity * 100)}%`;
    },
    debugState() {
      return {
        level,
        frightMs,
        renderCoverageY,
        musicLayers: zoneMusic.activeLayers,
        musicIntensity: zoneMusic.intensity,
        playerDir: player.dir,
        playerWant: player.want,
        turnTelemetry: readTurnAssistTelemetry(turnAssist),
        player: { x: player.x, y: player.y },
        guards: guards.map((guard) => ({ x: guard.x, y: guard.y }))
      };
    }
  };
}

function createAmpInvadersStage(): StageRuntime {
  type Enemy = { x: number; y: number; type: "basic" | "armored" | "elite"; hp: number; alive: boolean };
  type Bullet = { x: number; y: number; vx: number; vy: number; damage: number; enemy: boolean };

  let score = 0;
  let dead = false;
  const waveDirector = createWaveDirectorV2(STAGE3_V2_DEFAULT_CONFIG);
  let waveState = waveDirector.getState();
  let wave = waveState.wave;
  let lives = 3;
  let genre: GenreId = waveState.genre;
  let spreadTier: SpreadTier = waveState.spreadTier;
  let nextUpgradeWave: number | null = waveState.nextUpgradeWave;
  let playerX = 0.5;
  let playerVelX = 0;
  let steerTargetX: number | null = null;
  let steerError = 0;
  let touchSteerActive = false;
  let steerMode: "velocity" | "thumb-aim" = "velocity";
  let autoFireCooldownMs = 0;
  let chargeMs = 0;
  let wasHoldingAction = false;
  let enemyFireCooldownMs = 900;
  let enemyFireCadenceScale = 1;
  let discoTimerMs = 8000;
  let disco: { active: boolean; x: number; y: number; vx: number } = { active: false, x: 0, y: 48, vx: 220 };
  const bullets: Bullet[] = [];
  const shields = [100, 100, 100];
  let enemyDir = 1;
  let enemySpeed = 40;
  let enemies: Enemy[] = spawnWave(wave);
  let totalShotsFired = 0;

  function spawnWave(level: number): Enemy[] {
    const waveSpec = getWaveSpec(STAGE3_V2_DEFAULT_CONFIG, level);
    const list: Enemy[] = [];
    const rows = waveSpec.rows;
    const cols = waveSpec.cols;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const type = r < waveSpec.eliteRows ? "elite" : r < waveSpec.eliteRows + waveSpec.armoredRows ? "armored" : "basic";
        list.push({
          x: 120 + c * 68,
          y: 80 + r * 52,
          type,
          hp: type === "elite" ? 3 : type === "armored" ? 2 : 1,
          alive: true
        });
      }
    }
    enemySpeed = (40 + level * 8) * waveSpec.speedScale;
    enemyFireCadenceScale = waveSpec.fireCadenceScale;
    return list;
  }

  function aliveEnemies(): Enemy[] {
    return enemies.filter((enemy) => enemy.alive);
  }

  function fitEnemyFormationToViewport(width: number): void {
    const alive = aliveEnemies();
    if (alive.length === 0) {
      return;
    }
    const minX = Math.min(...alive.map((enemy) => enemy.x));
    const maxX = Math.max(...alive.map((enemy) => enemy.x));
    const span = Math.max(1, maxX - minX);
    const pad = Math.max(24, Math.min(56, Math.floor(width * 0.1)));
    const maxSpan = Math.max(120, width - pad * 2);
    const scale = span > maxSpan ? maxSpan / span : 1;
    const sourceCenter = (minX + maxX) * 0.5;
    const targetCenter = width * 0.5;
    const needsCentering = Math.abs(sourceCenter - targetCenter) > 2;
    if (scale >= 0.999 && !needsCentering) {
      return;
    }
    const applyScale = Math.min(1, Math.max(0.1, scale));
    enemies.forEach((enemy) => {
      if (!enemy.alive) {
        return;
      }
      enemy.x = targetCenter + (enemy.x - sourceCenter) * applyScale;
      enemy.x = Math.max(pad, Math.min(width - pad, enemy.x));
    });
  }

  function stageBottomReached(height: number): boolean {
    return aliveEnemies().some((enemy) => enemy.y > height - 120);
  }

  return {
    id: "amp-invaders",
    update(dtMs, input, width, height) {
      if (dead) return;

      enemyFireCooldownMs -= dtMs;
      discoTimerMs -= dtMs;

      const thumbAimActive = input.touchSteerActive && input.steerAimX !== null;
      touchSteerActive = thumbAimActive;
      if (thumbAimActive) {
        steerMode = "thumb-aim";
        steerTargetX = Math.max(0.06, Math.min(0.94, input.steerAimX ?? playerX));
        const delta = steerTargetX - playerX;
        const targetVelX = Math.max(-2.45, Math.min(2.45, delta * 10.4));
        const steerResponse = Math.min(1, dtMs / 24);
        playerVelX += (targetVelX - playerVelX) * steerResponse;
      } else {
        steerMode = "velocity";
        steerTargetX = null;
        let steer = 0;
        if (input.left) steer -= 1;
        if (input.right) steer += 1;
        steer += input.steerX;
        steer = Math.max(-1, Math.min(1, steer));
        const targetVelX = steer * 0.72;
        const steerResponse = Math.min(1, dtMs / 56);
        playerVelX += (targetVelX - playerVelX) * steerResponse;
        if (Math.abs(steer) < 0.025) {
          const driftDamping = Math.max(0, 1 - dtMs * 0.01);
          playerVelX *= driftDamping;
        }
      }
      playerX += playerVelX * (dtMs / 1000);
      if (playerX <= 0.06 || playerX >= 0.94) {
        playerVelX = 0;
      }
      playerX = Math.max(0.06, Math.min(0.94, playerX));
      steerError = steerTargetX === null ? 0 : Math.abs(steerTargetX - playerX);
      while (input.consumeSwipe()) {
        // Stage 3 does not use swipe turns; consume queued gestures so stale swipes do not leak across stages.
      }

      fitEnemyFormationToViewport(width);

      const fireInterval = Math.max(95, 185 - wave * 3);
      const auto = stepAutoFire(autoFireCooldownMs, dtMs, fireInterval);
      autoFireCooldownMs = auto.cooldownMs;
      for (let i = 0; i < auto.shots; i += 1) {
        const volley = buildPlayerVolley(spreadTier, playerX * width, height - 72);
        bullets.push(...volley);
        totalShotsFired += volley.length;
      }

      if (input.actionHeld) {
        chargeMs = Math.min(1200, chargeMs + dtMs);
      }
      if (wasHoldingAction && !input.actionHeld && chargeMs >= 350) {
        bullets.push({
          x: playerX * width,
          y: height - 74,
          vx: 0,
          vy: -760,
          damage: chargeMs >= 900 ? 4 : 3,
          enemy: false
        });
        score += 5;
        totalShotsFired += 1;
      }
      wasHoldingAction = input.actionHeld;
      if (!input.actionHeld) {
        chargeMs = 0;
      }

      const alive = aliveEnemies();
      const minX = Math.min(...alive.map((enemy) => enemy.x));
      const maxX = Math.max(...alive.map((enemy) => enemy.x));
      if (Number.isFinite(minX) && Number.isFinite(maxX)) {
        const edgePad = Math.max(20, Math.min(44, Math.floor(width * 0.08)));
        if (minX < edgePad && enemyDir < 0) {
          enemyDir = 1;
          enemies.forEach((enemy) => (enemy.y += 16));
        } else if (maxX > width - edgePad && enemyDir > 0) {
          enemyDir = -1;
          enemies.forEach((enemy) => (enemy.y += 16));
        }
      }

      enemies.forEach((enemy) => {
        if (!enemy.alive) return;
        enemy.x += enemyDir * enemySpeed * (dtMs / 1000);
      });

      if (enemyFireCooldownMs <= 0) {
        const shooters = aliveEnemies();
        if (shooters.length > 0) {
          const shooter = shooters[Math.floor(Math.random() * shooters.length)];
          bullets.push({ x: shooter.x, y: shooter.y + 12, vx: 0, vy: 280 + wave * 12, damage: 1, enemy: true });
        }
        enemyFireCooldownMs = Math.max(320, (900 - wave * 30) * enemyFireCadenceScale);
      }

      if (discoTimerMs <= 0 && !disco.active) {
        disco.active = true;
        disco.x = -40;
        disco.y = 52;
        disco.vx = 220 + wave * 8;
      }

      if (disco.active) {
        disco.x += disco.vx * (dtMs / 1000);
        if (disco.x > width + 40) {
          disco.active = false;
          discoTimerMs = 10_000;
        }
      }

      for (const bullet of bullets) {
        bullet.x += bullet.vx * (dtMs / 1000);
        bullet.y += bullet.vy * (dtMs / 1000);
      }

      for (const bullet of bullets) {
        if (bullet.enemy) {
          const hit = resolveEnemyBulletHit({
            bulletX: bullet.x,
            bulletY: bullet.y,
            width,
            height,
            playerXNorm: playerX,
            shields
          });
          if (hit.shieldIndex !== null && hit.shieldDamage > 0) {
            shields[hit.shieldIndex] = Math.max(0, shields[hit.shieldIndex] - hit.shieldDamage);
          }
          if (hit.playerHit) {
            lives -= 1;
            if (lives <= 0) {
              dead = true;
            }
          }
          if (hit.consumed) {
            bullet.y = height + 100;
          }
        } else {
          for (const enemy of enemies) {
            if (!enemy.alive) continue;
            if (Math.abs(bullet.x - enemy.x) < 24 && Math.abs(bullet.y - enemy.y) < 18) {
              enemy.hp -= bullet.damage;
              bullet.y = -100;
              if (enemy.hp <= 0) {
                enemy.alive = false;
                score += enemy.type === "elite" ? 60 : enemy.type === "armored" ? 30 : 15;
                audio.trigger("pickup");
              }
              break;
            }
          }

          if (disco.active && Math.abs(bullet.x - disco.x) < 24 && Math.abs(bullet.y - disco.y) < 16) {
            score += 220;
            disco.active = false;
            discoTimerMs = 10_000;
            audio.trigger("pickup");
            bullet.y = -100;
          }
        }
      }

      for (let i = bullets.length - 1; i >= 0; i -= 1) {
        if (bullets[i].y < -120 || bullets[i].y > height + 120) {
          bullets.splice(i, 1);
        }
      }

      if (aliveEnemies().length === 0) {
        waveState = waveDirector.advanceOnWaveClear();
        wave = waveState.wave;
        genre = waveState.genre;
        spreadTier = waveState.spreadTier;
        nextUpgradeWave = waveState.nextUpgradeWave;
        score += 120;
        enemies = spawnWave(wave);
        enemyDir = 1;
      }

      if (stageBottomReached(height)) {
        dead = true;
      }
    },
    draw(context, width, height, theme, pulse) {
      const stagePalettes: Record<typeof genre, { top: string; bottom: string; line: string }> = {
        pop: { top: "#2c0834", bottom: "#130017", line: "#ff7ce7" },
        edm: { top: "#07182f", bottom: "#020710", line: "#29d8ff" },
        hiphop: { top: "#17120a", bottom: "#080602", line: "#f7b733" },
        rock: { top: "#1f0414", bottom: "#080010", line: "#ff3a7a" },
      };
      const palette = stagePalettes[genre];
      const gradient = context.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, withAlpha(palette.top, 0.98));
      gradient.addColorStop(1, withAlpha(palette.bottom, 0.98));
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);

      context.strokeStyle = withAlpha(palette.line, 0.1 + pulse * 0.06);
      context.lineWidth = 1;
      for (let y = height * 0.2; y < height; y += 34) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(width, y);
        context.stroke();
      }

      for (let i = 0; i < shields.length; i += 1) {
        const hp = shields[i];
        const x = ((i + 0.5) * width) / 3;
        const y = height - 150;
        const alive = hp > 0;
        context.fillStyle = alive ? withAlpha("#2a1738", 0.8) : withAlpha("#222222", 0.4);
        context.beginPath();
        context.moveTo(x - 60, y + 22);
        context.lineTo(x, y - 30);
        context.lineTo(x + 60, y + 22);
        context.closePath();
        context.fill();
        context.strokeStyle = alive ? withAlpha(palette.line, 0.8) : withAlpha("#888888", 0.45);
        context.lineWidth = 2;
        context.stroke();
        context.fillStyle = alive ? withAlpha("#f9f2ff", 0.65) : withAlpha("#666666", 0.5);
        context.fillRect(x - 20, y - 6, 40 * Math.max(0.25, hp / 100), 6);
      }

      const playerY = height - 70;
      const boothX = playerX * width;
      const boothGlow = context.createRadialGradient(boothX, playerY, 8, boothX, playerY, 66);
      boothGlow.addColorStop(0, withAlpha(theme.palette.accent, 0.45));
      boothGlow.addColorStop(1, withAlpha(theme.palette.accent, 0));
      context.fillStyle = boothGlow;
      context.fillRect(boothX - 68, playerY - 68, 136, 136);
      context.fillStyle = withAlpha("#0f0f18", 0.9);
      context.fillRect(boothX - 28, playerY - 18, 56, 30);
      context.strokeStyle = withAlpha(theme.palette.accent, 0.9);
      context.strokeRect(boothX - 28, playerY - 18, 56, 30);
      context.fillStyle = withAlpha(theme.palette.primary, 0.85);
      context.beginPath();
      context.arc(boothX - 10, playerY - 4, 5, 0, Math.PI * 2);
      context.arc(boothX + 10, playerY - 4, 5, 0, Math.PI * 2);
      context.fill();
      context.fillRect(boothX - 2, playerY - 22, 4, 10);

      enemies.forEach((enemy) => {
        if (!enemy.alive) return;
        const ex = enemy.x;
        const ey = enemy.y;
        if (enemy.type === "elite") {
          context.fillStyle = "#ffd447";
          context.fillRect(ex - 20, ey - 12, 40, 24);
          context.fillStyle = "#2a2140";
          context.fillRect(ex - 14, ey - 8, 28, 16);
          context.fillStyle = withAlpha("#ffffff", 0.82);
          context.fillRect(ex - 10, ey - 4, 20, 2);
          context.fillRect(ex - 10, ey + 2, 20, 2);
        } else if (enemy.type === "armored") {
          context.fillStyle = withAlpha(theme.palette.accent, 0.95);
          context.fillRect(ex - 19, ey - 12, 38, 24);
          context.fillStyle = withAlpha("#2a0e1e", 0.8);
          context.fillRect(ex - 13, ey - 7, 26, 14);
          context.fillStyle = withAlpha("#ffffff", 0.5);
          context.fillRect(ex - 16, ey - 10, 4, 20);
          context.fillRect(ex + 12, ey - 10, 4, 20);
        } else {
          context.fillStyle = withAlpha(theme.palette.primary, 0.9);
          context.fillRect(ex - 16, ey - 10, 32, 20);
          context.fillStyle = withAlpha("#032833", 0.7);
          context.fillRect(ex - 10, ey - 5, 20, 10);
        }
      });

      bullets.forEach((bullet) => {
        context.fillStyle = bullet.enemy ? "#ff5a36" : "#ccfff2";
        context.fillRect(bullet.x - 2, bullet.y - 9, 4, 18);
        if (!bullet.enemy) {
          context.fillStyle = withAlpha("#ccfff2", 0.35);
          context.fillRect(bullet.x - 1, bullet.y - 17, 2, 8);
        }
      });

      if (disco.active) {
        context.fillStyle = withAlpha("#ffd447", 0.65 + pulse * 0.35);
        context.beginPath();
        context.arc(disco.x, disco.y, 14, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = withAlpha("#ffffff", 0.55);
        context.beginPath();
        context.arc(disco.x, disco.y, 10, 0, Math.PI * 2);
        context.stroke();
      }
    },
    getRawScore() {
      return score;
    },
    isDead() {
      return dead;
    },
    getHudHint() {
      const tierLabel = spreadTier === 1 ? "SINGLE" : spreadTier === 2 ? "DUAL" : spreadTier === 3 ? "TRIPLE" : "WIDE";
      return `Wave ${wave} • ${genre.toUpperCase()} • ${tierLabel} • Lives ${lives} • AUTO-FIRE`;
    },
    debugState() {
      const alive = aliveEnemies();
      return {
        wave,
        genre,
        spreadTier,
        nextUpgradeWave,
        lives,
        playerX,
        controlTelemetry: {
          touchSteerActive,
          steerTargetX,
          steerError,
          steerMode
        },
        enemyMinY: alive.length ? Math.min(...alive.map((enemy) => enemy.y)) : null,
        enemyMaxY: alive.length ? Math.max(...alive.map((enemy) => enemy.y)) : null,
        aliveEnemies: alive.length,
        totalShotsFired
      };
    },
    forceWaveClearForTest() {
      enemies.forEach((enemy) => {
        enemy.alive = false;
      });
    }
  };
}

function createInputController(target: HTMLCanvasElement) {
  const keys = new Set<string>();
  const swipeQueue: Dir[] = [];
  let actionPressed = false;
  let actionHeld = false;
  let steerX = 0;
  let steerAimX: number | null = null;
  let touchSteerActive = false;
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartedAt = 0;
  let touchMoved = false;
  let activePointerId: number | null = null;
  let lastPointerTouchAt = Number.NEGATIVE_INFINITY;
  let activeStage: StageId = "rhythm-serpent";
  let bounds = target.getBoundingClientRect();

  const refreshBounds = () => {
    bounds = target.getBoundingClientRect();
  };

  window.addEventListener("keydown", (event) => {
    if (!keys.has(event.code) && (event.code === "Space" || event.code === "Enter")) {
      actionPressed = true;
    }
    keys.add(event.code);
    if (event.code === "Space" || event.code === "Enter") {
      actionHeld = true;
    }
  });

  window.addEventListener("keyup", (event) => {
    keys.delete(event.code);
    if (event.code === "Space" || event.code === "Enter") {
      actionHeld = false;
    }
  });

  const beginTouchGesture = (clientX: number, clientY: number) => {
    touchStartX = clientX;
    touchStartY = clientY;
    touchStartedAt = performance.now();
    touchMoved = false;
    actionHeld = true;
    touchSteerActive = true;
    refreshBounds();
    const profile = getMobileInputProfile(activeStage);
    steerX = normalizeSteerX(clientX, bounds.left, bounds.width, profile);
    steerAimX = Math.max(0, Math.min(1, (clientX - bounds.left) / Math.max(1, bounds.width)));
  };

  const moveTouchGesture = (clientX: number, clientY: number) => {
    const dx = clientX - touchStartX;
    const dy = clientY - touchStartY;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
      touchMoved = true;
    }
    const profile = getMobileInputProfile(activeStage);
    steerX = normalizeSteerX(clientX, bounds.left, bounds.width, profile);
    steerAimX = Math.max(0, Math.min(1, (clientX - bounds.left) / Math.max(1, bounds.width)));
    const moveGesture = classifyTouchGesture({
      startX: touchStartX,
      startY: touchStartY,
      endX: clientX,
      endY: clientY,
      durationMs: performance.now() - touchStartedAt,
      touchMoved,
      profile
    });
    if (moveGesture.kind === "swipe") {
      swipeQueue.push(moveGesture.dir);
      touchStartX = clientX;
      touchStartY = clientY;
      touchStartedAt = performance.now();
      touchMoved = false;
    }
  };

  const endTouchGesture = (clientX: number, clientY: number) => {
    const profile = getMobileInputProfile(activeStage);
    const gesture = classifyTouchGesture({
      startX: touchStartX,
      startY: touchStartY,
      endX: clientX,
      endY: clientY,
      durationMs: performance.now() - touchStartedAt,
      touchMoved,
      profile
    });
    if (gesture.kind === "swipe") {
      swipeQueue.push(gesture.dir);
    } else if (gesture.kind === "tap") {
      actionPressed = true;
    }
    actionHeld = false;
    steerX = 0;
    steerAimX = null;
    touchSteerActive = false;
    touchMoved = false;
  };

  const cancelTouchGesture = () => {
    actionHeld = false;
    steerX = 0;
    steerAimX = null;
    touchSteerActive = false;
    touchMoved = false;
  };

  const TOUCH_POINTER_DEDUP_MS = 450;
  const isTouchLikePointer = (event: PointerEvent): boolean => event.pointerType !== "mouse";
  const markPointerTouch = () => {
    lastPointerTouchAt = performance.now();
  };
  const shouldIgnoreTouchEvent = () => performance.now() - lastPointerTouchAt < TOUCH_POINTER_DEDUP_MS;

  const supportsPointerEvents = typeof window !== "undefined" && "PointerEvent" in window;
  if (supportsPointerEvents) {
    target.addEventListener("pointerdown", (event) => {
      if (!isTouchLikePointer(event)) {
        return;
      }
      if (event.cancelable) {
        event.preventDefault();
      }
      markPointerTouch();
      activePointerId = event.pointerId;
      beginTouchGesture(event.clientX, event.clientY);
      try {
        target.setPointerCapture(event.pointerId);
      } catch {
        // Some mobile browsers may reject pointer capture for touch pointers.
      }
    }, { passive: false });

    target.addEventListener("pointermove", (event) => {
      if (activePointerId === null || event.pointerId !== activePointerId) {
        return;
      }
      if (!isTouchLikePointer(event)) {
        return;
      }
      if (event.cancelable) {
        event.preventDefault();
      }
      markPointerTouch();
      moveTouchGesture(event.clientX, event.clientY);
    }, { passive: false });

    target.addEventListener("pointerup", (event) => {
      if (activePointerId === null || event.pointerId !== activePointerId) {
        return;
      }
      if (!isTouchLikePointer(event)) {
        return;
      }
      if (event.cancelable) {
        event.preventDefault();
      }
      markPointerTouch();
      endTouchGesture(event.clientX, event.clientY);
      try {
        if (target.hasPointerCapture(event.pointerId)) {
          target.releasePointerCapture(event.pointerId);
        }
      } catch {
        // Ignore release failures on browsers with partial pointer-capture support.
      }
      activePointerId = null;
    }, { passive: false });

    target.addEventListener("pointercancel", (event) => {
      if (activePointerId === null || event.pointerId !== activePointerId) {
        return;
      }
      if (!isTouchLikePointer(event)) {
        return;
      }
      markPointerTouch();
      cancelTouchGesture();
      try {
        if (target.hasPointerCapture(event.pointerId)) {
          target.releasePointerCapture(event.pointerId);
        }
      } catch {
        // Ignore release failures on browsers with partial pointer-capture support.
      }
      activePointerId = null;
    }, { passive: true });
  }

  target.addEventListener("touchstart", (event) => {
    if (shouldIgnoreTouchEvent()) {
      return;
    }
    if (event.cancelable) {
      event.preventDefault();
    }
    const touch = event.changedTouches[0];
    if (!touch) {
      return;
    }
    beginTouchGesture(touch.clientX, touch.clientY);
  }, { passive: false });

  target.addEventListener("touchmove", (event) => {
    if (shouldIgnoreTouchEvent()) {
      return;
    }
    if (event.cancelable) {
      event.preventDefault();
    }
    const touch = event.changedTouches[0];
    if (!touch) {
      return;
    }
    moveTouchGesture(touch.clientX, touch.clientY);
  }, { passive: false });

  target.addEventListener("touchend", (event) => {
    if (shouldIgnoreTouchEvent()) {
      return;
    }
    if (event.cancelable) {
      event.preventDefault();
    }
    const touch = event.changedTouches[0];
    if (!touch) {
      cancelTouchGesture();
      return;
    }
    endTouchGesture(touch.clientX, touch.clientY);
  }, { passive: false });

  target.addEventListener("touchcancel", () => {
    if (shouldIgnoreTouchEvent()) {
      return;
    }
    cancelTouchGesture();
  }, { passive: true });

  window.addEventListener("resize", refreshBounds, { passive: true });
  window.addEventListener("orientationchange", refreshBounds);

  return {
    refreshBounds,
    setStage(stageId: StageId) {
      activeStage = stageId;
      swipeQueue.length = 0;
      steerX = 0;
      steerAimX = null;
      touchSteerActive = false;
    },
    consumeFrame(): InputFrame {
      const left = keys.has("ArrowLeft") || keys.has("KeyA");
      const right = keys.has("ArrowRight") || keys.has("KeyD");
      const up = keys.has("ArrowUp") || keys.has("KeyW");
      const down = keys.has("ArrowDown") || keys.has("KeyS");
      const pressed = actionPressed;
      actionPressed = false;
      return {
        up,
        down,
        left,
        right,
        actionHeld,
        actionPressed: pressed,
        steerX,
        steerAimX,
        touchSteerActive,
        consumeSwipe: () => swipeQueue.shift() ?? null
      };
    }
  };
}

function resolveInitialTheme(allThemes: ThemePack[]): ThemePack {
  const stored = localStorage.getItem(THEME_OVERRIDE_KEY);
  const fromStore = allThemes.find((item) => item.id === stored);
  if (fromStore) {
    return fromStore;
  }
  return getDefaultTheme();
}

function rotateTheme(): void {
  const start = Number.parseInt(localStorage.getItem(THEME_CYCLE_INDEX_KEY) ?? "0", 10);
  const nextIndex = Number.isFinite(start) ? (start + 1) % themes.length : 0;
  localStorage.setItem(THEME_CYCLE_INDEX_KEY, String(nextIndex));
  activeTheme = themes[nextIndex];
  localStorage.setItem(THEME_OVERRIDE_KEY, activeTheme.id);
  applyTheme(activeTheme);
}

function applyTheme(theme: ThemePack): void {
  const root = document.documentElement;
  root.style.setProperty("--bg", theme.palette.background);
  root.style.setProperty("--surface", theme.palette.surface);
  root.style.setProperty("--primary", theme.palette.primary);
  root.style.setProperty("--accent", theme.palette.accent);
  root.style.setProperty("--text", theme.palette.text);
}

function resizeCanvas(): void {
  const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  const bounds = canvas.getBoundingClientRect();
  frameWidth = Math.max(240, Math.floor(bounds.width || window.innerWidth));
  frameHeight = Math.max(200, Math.floor(bounds.height || window.innerHeight * 0.64));
  canvas.width = Math.floor(frameWidth * dpr);
  canvas.height = Math.floor(frameHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  input.refreshBounds();
}

function drawBaseBackground(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  theme: ThemePack,
  pulse: number,
  stageId: StageId,
  modeNow: Mode
): void {
  const now = performance.now();
  const top =
    stageId === "rhythm-serpent" ? "#1a0533" : stageId === "moshpit-pacman" ? "#06000e" : "#09040f";
  const mid =
    stageId === "rhythm-serpent" ? "#3a0845" : stageId === "moshpit-pacman" ? "#0d0620" : "#19072a";
  const bottom = stageId === "amp-invaders" ? "#110014" : theme.palette.background;

  const g = context.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, withAlpha(top, 1));
  g.addColorStop(0.55, withAlpha(mid, 0.98));
  g.addColorStop(1, withAlpha(bottom, 1));
  context.fillStyle = g;
  context.fillRect(0, 0, width, height);

  if (stageId === "rhythm-serpent" || modeNow === "boot") {
    const sunY = height * 0.28;
    const sunR = Math.min(width, height) * 0.18;
    const sun = context.createRadialGradient(width * 0.5, sunY, sunR * 0.2, width * 0.5, sunY, sunR);
    sun.addColorStop(0, withAlpha("#ffb347", 0.75));
    sun.addColorStop(0.45, withAlpha("#ff6633", 0.55));
    sun.addColorStop(1, withAlpha("#ff2266", 0));
    context.fillStyle = sun;
    context.beginPath();
    context.arc(width * 0.5, sunY, sunR, 0, Math.PI * 2);
    context.fill();

    // CRT-style sun bands for stronger synthwave identity.
    context.save();
    context.beginPath();
    context.arc(width * 0.5, sunY, sunR * 0.94, 0, Math.PI * 2);
    context.clip();
    context.fillStyle = withAlpha("#4f102b", 0.3);
    const stripeH = Math.max(3, Math.floor(sunR * 0.08));
    for (let y = sunY - sunR; y <= sunY + sunR; y += stripeH * 2) {
      context.fillRect(width * 0.5 - sunR, y, sunR * 2, stripeH);
    }
    context.restore();

    context.fillStyle = withAlpha("#220044", 0.48);
    context.beginPath();
    context.moveTo(width * 0.38, height * 0.66);
    context.lineTo(width * 0.5, height * 0.6);
    context.lineTo(width * 0.62, height * 0.66);
    context.closePath();
    context.fill();
  }

  const spacing = stageId === "moshpit-pacman" ? 30 : 28;
  const horizonY = height * 0.66;
  const gridScroll = (now * 0.035) % spacing;
  context.strokeStyle = withAlpha(stageId === "moshpit-pacman" ? "#442277" : "#00d8ff", 0.1 + pulse * 0.06);
  context.lineWidth = 1;
  for (let y = horizonY; y < height + spacing; y += spacing) {
    const yy = y + gridScroll;
    context.beginPath();
    context.moveTo(0, yy);
    context.lineTo(width, yy);
    context.stroke();
  }

  for (let x = -width * 0.2; x <= width * 1.2; x += 42) {
    context.beginPath();
    context.moveTo(width / 2, horizonY);
    context.lineTo(x, height);
    context.stroke();
  }

  if (stageId === "amp-invaders") {
    for (let i = 0; i < 7; i += 1) {
      const x = ((i + 0.5) * width) / 7;
      const beam = context.createLinearGradient(x, 0, x, height * 0.5);
      beam.addColorStop(0, withAlpha(i % 2 === 0 ? "#ff5a36" : "#00e6ff", 0.2 + pulse * 0.12));
      beam.addColorStop(1, withAlpha("#000000", 0));
      context.fillStyle = beam;
      context.fillRect(x - 14, 0, 28, height * 0.5);
    }
  }

  if (stageId === "moshpit-pacman") {
    const corners = [
      [0.08, 0.12, "#ff2244"],
      [0.92, 0.12, "#2266ff"],
      [0.08, 0.88, "#22ff88"],
      [0.92, 0.88, "#ffcc22"]
    ] as const;
    for (const [cx, cy, color] of corners) {
      const glow = context.createRadialGradient(width * cx, height * cy, 8, width * cx, height * cy, width * 0.25);
      glow.addColorStop(0, withAlpha(color, 0.25 + pulse * 0.08));
      glow.addColorStop(1, withAlpha(color, 0));
      context.fillStyle = glow;
      context.fillRect(0, 0, width, height);
    }
  }

  context.strokeStyle = withAlpha(stageId === "moshpit-pacman" ? "#ffdd44" : "#ff44aa", 0.28 + pulse * 0.16);
  context.lineWidth = 2;
  context.strokeRect(4, 4, width - 8, height - 8);

  // Screen-space polish inspired by the reference games.
  context.save();
  context.strokeStyle = withAlpha("#000000", 0.08);
  context.lineWidth = 1;
  for (let y = 0; y < height; y += 3) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
  context.restore();

  const vig = context.createRadialGradient(width * 0.5, height * 0.48, width * 0.2, width * 0.5, height * 0.48, width * 0.9);
  vig.addColorStop(0, withAlpha("#000000", 0));
  vig.addColorStop(1, withAlpha("#000000", 0.4));
  context.fillStyle = vig;
  context.fillRect(0, 0, width, height);
}

function drawIdleBackdrop(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  theme: ThemePack,
  pulse: number
): void {
  context.save();
  context.fillStyle = withAlpha(theme.palette.accent, 0.16 + pulse * 0.08);
  context.fillRect(width * 0.1, height * 0.14, width * 0.8, height * 0.7);
  context.restore();
}

function readBool(key: string): boolean {
  return localStorage.getItem(key) === "true";
}

function randomGridPoint(
  cols: number,
  rows: number,
  snake: Array<{ x: number; y: number }> = [],
  power: { x: number; y: number } | null = null,
  avoid: { x: number; y: number } | null = null
): { x: number; y: number } {
  for (let tries = 0; tries < 2000; tries += 1) {
    const point = { x: Math.floor(Math.random() * cols), y: Math.floor(Math.random() * rows) };
    const blockedBySnake = snake.some((segment) => segment.x === point.x && segment.y === point.y);
    const blockedByPower = !!power && power.x === point.x && power.y === point.y;
    const blockedByAvoid = !!avoid && avoid.x === point.x && avoid.y === point.y;
    if (!blockedBySnake && !blockedByPower && !blockedByAvoid) {
      return point;
    }
  }
  return { x: 0, y: 0 };
}

function withAlpha(colorHex: string, alpha: number): string {
  const normalized = colorHex.replace("#", "");
  if (normalized.length !== 6) return colorHex;
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

function lerpColor(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  if (!ca || !cb) return a;
  const mix = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `rgb(${mix(ca.r, cb.r)}, ${mix(ca.g, cb.g)}, ${mix(ca.b, cb.b)})`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return null;
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16)
  };
}

function formatMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const m = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const s = String(totalSeconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function injectStyles(): void {
  const style = document.createElement("style");
  style.textContent = `
    :root {
      --bg: #090b10;
      --surface: #111827;
      --primary: #00e7d4;
      --accent: #ff5a36;
      --text: #f3f4f6;
      --safe-top: env(safe-area-inset-top, 0px);
      --safe-bottom: env(safe-area-inset-bottom, 0px);
      --safe-left: env(safe-area-inset-left, 0px);
      --safe-right: env(safe-area-inset-right, 0px);
      --gutter: 8px;
      --hud-h: 48px;
      --rail-h: 52px;
    }
    * {
      box-sizing: border-box;
    }
    html, body, #app {
      margin: 0;
      width: 100vw;
      height: 100vh;
      min-height: 100vh;
      min-height: 100dvh;
      background: var(--bg);
      color: var(--text);
      font-family: "Courier New", "Rajdhani", monospace;
      overflow: hidden;
      touch-action: none;
      overscroll-behavior: none;
    }
    .tri-root {
      position: fixed;
      inset: 0;
      width: 100vw;
      height: 100vh;
      min-height: 100vh;
      height: 100dvh;
      min-height: 100dvh;
      display: grid;
      grid-template-rows: var(--hud-h) minmax(0, 1fr) var(--rail-h);
      gap: max(4px, calc(var(--gutter) - 2px));
      padding-top: calc(var(--safe-top) + var(--gutter));
      padding-bottom: calc(var(--safe-bottom) + var(--gutter));
      padding-left: calc(var(--safe-left) + var(--gutter));
      padding-right: calc(var(--safe-right) + var(--gutter));
      background: radial-gradient(circle at 20% 10%, rgba(255, 90, 54, 0.15), transparent 42%),
        radial-gradient(circle at 80% 15%, rgba(0, 231, 212, 0.15), transparent 44%),
        var(--bg);
    }
    .hud {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 12px;
      background: color-mix(in srgb, var(--surface) 78%, black 22%);
      box-shadow: inset 0 0 22px rgba(0, 229, 255, 0.12), 0 0 18px rgba(255, 68, 170, 0.12);
    }
    .hud-item {
      font-size: 16px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-shadow: 0 0 10px rgba(255, 96, 214, 0.35);
    }
    .hud-stage {
      justify-self: center;
    }
    #hud-bank {
      justify-self: end;
    }
    .canvas-wrap {
      position: relative;
      border-radius: 14px;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.16);
      background: color-mix(in srgb, var(--surface) 82%, black 18%);
      height: 100%;
      min-height: 0;
    }
    #game-canvas {
      width: 100%;
      height: 100%;
      display: block;
      image-rendering: pixelated;
      touch-action: none;
    }
    .overlay {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      pointer-events: none;
    }
    .overlay.is-interactive {
      pointer-events: auto;
    }
    .card {
      width: min(92vw, 560px);
      padding: 20px;
      max-height: calc(100dvh - var(--safe-top) - var(--safe-bottom) - 24px);
      overflow: auto;
      border-radius: 14px;
      border: 1px solid rgba(255, 255, 255, 0.26);
      background: linear-gradient(180deg, rgba(18, 10, 36, 0.9), rgba(7, 8, 18, 0.88));
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.45), 0 0 32px rgba(255, 63, 183, 0.14);
      text-align: center;
    }
    .card.compact {
      width: min(78vw, 420px);
    }
    .card h1, .card h2 {
      margin: 0 0 10px;
      font-family: "Bebas Neue", "Impact", sans-serif;
      letter-spacing: 0.08em;
      text-shadow: 0 0 16px rgba(255, 87, 204, 0.46);
    }
    .card p, .card small {
      margin: 6px 0;
      opacity: 0.95;
    }
    .card .score {
      font-size: 48px;
      margin: 6px 0 10px;
      font-family: "JetBrains Mono", "Consolas", monospace;
      font-weight: 800;
      color: var(--primary);
    }
    .row {
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
    }
    .btn {
      border: 1px solid rgba(255, 255, 255, 0.25);
      background: transparent;
      color: var(--text);
      border-radius: 10px;
      padding: 10px 14px;
      min-height: 44px;
      min-width: 132px;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.05em;
      cursor: pointer;
      text-transform: uppercase;
    }
    .btn.primary {
      background: color-mix(in srgb, var(--primary) 25%, transparent);
      border-color: color-mix(in srgb, var(--primary) 58%, white 8%);
      box-shadow: 0 0 14px rgba(0, 229, 255, 0.24);
    }
    .btn.secondary {
      background: color-mix(in srgb, var(--surface) 50%, transparent);
    }
    .hidden {
      display: none !important;
    }
    .action-rail {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      padding: 4px 8px;
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      background: color-mix(in srgb, var(--surface) 70%, black 30%);
      min-height: var(--rail-h);
    }
    .stage-meta {
      display: grid;
      gap: 3px;
      font-size: 13px;
      text-shadow: 0 0 10px rgba(0, 230, 255, 0.22);
    }
    .muted {
      opacity: 0.72;
      font-size: 12px;
    }
    .attract .eyebrow {
      margin: 0 0 6px;
      font-size: 11px;
      letter-spacing: 0.24em;
      color: #8fe9ff;
      text-transform: uppercase;
      text-shadow: 0 0 10px rgba(0, 229, 255, 0.6);
    }
    .attract .title-stack {
      display: grid;
      gap: 2px;
      margin-bottom: 10px;
      line-height: 0.92;
    }
    .attract .title-stack span:first-child {
      color: #ff59b8;
      text-shadow: 0 0 16px rgba(255, 89, 184, 0.7);
      font-size: clamp(34px, 6vw, 44px);
    }
    .attract .title-stack span:last-child {
      color: #6ee8ff;
      text-shadow: 0 0 16px rgba(110, 232, 255, 0.62);
      font-size: clamp(24px, 4.4vw, 32px);
    }
    .attract .strap {
      font-size: 13px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #e6f0ff;
    }
    .stage-pill-row {
      margin-top: 12px;
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 6px;
    }
    .stage-pill-row span {
      font-size: 10px;
      letter-spacing: 0.08em;
      padding: 5px 7px;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.22);
      background: rgba(10, 16, 34, 0.72);
      box-shadow: 0 0 10px rgba(0, 229, 255, 0.2);
    }
    .admin-panel {
      position: absolute;
      right: 10px;
      top: 10px;
      width: 280px;
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      background: rgba(0, 0, 0, 0.78);
      padding: 12px;
      z-index: 3;
      display: grid;
      gap: 8px;
    }
    .admin-panel label {
      display: grid;
      gap: 4px;
      font-size: 12px;
    }
    .admin-panel select {
      height: 34px;
      border-radius: 8px;
      background: #09111f;
      color: var(--text);
      border: 1px solid rgba(255, 255, 255, 0.16);
      padding: 0 6px;
    }
    .check {
      display: flex !important;
      align-items: center;
      gap: 6px;
    }
    ol, ul {
      text-align: left;
      margin: 10px 0 0;
      padding-left: 20px;
      max-height: 220px;
      overflow: auto;
    }
    @media (max-width: 389px) {
      :root {
        --gutter: 6px;
        --hud-h: 44px;
        --rail-h: 48px;
      }
      .hud {
        gap: 6px;
      }
      .hud-item {
        font-size: 13px;
      }
      .stage-meta {
        font-size: 12px;
      }
      .btn {
        min-width: 114px;
        padding: 8px 10px;
      }
      .card {
        width: min(95vw, 520px);
        padding: 14px;
      }
    }
  `;
  document.head.appendChild(style);
}

function ensureMobileViewportMeta(): void {
  const head = document.head;
  if (!head) {
    return;
  }
  let viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (!viewport) {
    viewport = document.createElement("meta");
    viewport.name = "viewport";
    head.appendChild(viewport);
  }
  viewport.content =
    "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover";
}

type AudioUpdateInput = {
  active: boolean;
  stage: StageId;
  score: number;
  danger: boolean;
};

type AudioTrigger = "death" | "commit" | "submit" | "pickup" | "zone";

function createAudioEngine() {
  let started = false;
  let audioContext: AudioContext | null = null;
  let masterGain: GainNode | null = null;
  let musicGain: GainNode | null = null;
  let duckGain: GainNode | null = null;
  let drumGain: GainNode | null = null;
  let sfxGain: GainNode | null = null;
  let compressor: DynamicsCompressorNode | null = null;
  let synthFilter: BiquadFilterNode | null = null;
  let noiseBuffer: AudioBuffer | null = null;
  let nextStepAt = 0;
  let currentStage: StageId = "rhythm-serpent";
  let step16 = 0;
  let energy = 0.32;
  let prevPickupAt = 0;
  let prevDanger = false;

  function clamp(min: number, value: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  function ensureStarted(): void {
    if (started) {
      if (audioContext?.state === "suspended") {
        void audioContext.resume();
      }
      return;
    }

    const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) {
      return;
    }

    audioContext = new Ctx();
    masterGain = audioContext.createGain();
    musicGain = audioContext.createGain();
    duckGain = audioContext.createGain();
    drumGain = audioContext.createGain();
    sfxGain = audioContext.createGain();
    compressor = audioContext.createDynamicsCompressor();
    synthFilter = audioContext.createBiquadFilter();

    synthFilter.type = "lowpass";
    synthFilter.frequency.value = 1800;
    synthFilter.Q.value = 0.9;

    masterGain.gain.value = 0.0001;
    musicGain.gain.value = 0.0001;
    duckGain.gain.value = 1;
    drumGain.gain.value = 0.0001;
    sfxGain.gain.value = 0.0001;

    compressor.threshold.value = -20;
    compressor.knee.value = 12;
    compressor.ratio.value = 3.4;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.16;

    musicGain.connect(synthFilter).connect(duckGain).connect(masterGain);
    drumGain.connect(masterGain);
    sfxGain.connect(masterGain);
    masterGain.connect(compressor).connect(audioContext.destination);

    const length = audioContext.sampleRate;
    noiseBuffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
    const channel = noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      channel[i] = Math.random() * 2 - 1;
    }

    nextStepAt = audioContext.currentTime + 0.05;
    step16 = 0;
    started = true;
  }

  function stageProfile(stage: StageId): {
    bpm: number;
    root: number;
    kick: number[];
    snare: number[];
    hat: number[];
    bass: Array<number | null>;
    chords: Array<[number, number, number] | null>;
    lead: Array<number | null>;
  } {
    if (stage === "rhythm-serpent") {
      return {
        bpm: 118,
        root: 110,
        kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0],
        snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        hat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0],
        bass: [0, null, 0, null, 3, null, 5, null, 0, null, 0, null, 7, null, 5, null],
        chords: [[0, 3, 7], null, null, null, [0, 3, 8], null, null, null, [-2, 2, 5], null, null, null, [0, 3, 7], null, null, null],
        lead: [null, null, 12, null, null, 15, null, null, 17, null, null, 15, null, 14, null, null]
      };
    }
    if (stage === "moshpit-pacman") {
      return {
        bpm: 126,
        root: 98,
        kick: [1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 1, 0],
        snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        hat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        bass: [0, null, 0, null, 5, null, 7, null, 0, null, 0, null, 7, null, 5, null],
        chords: [[0, 3, 7], null, null, null, [5, 8, 12], null, null, null, [7, 10, 14], null, null, null, [0, 3, 7], null, null, null],
        lead: [null, 12, null, null, 14, null, null, 15, null, null, 17, null, null, 15, null, null]
      };
    }
    return {
      bpm: 136,
      root: 123.47,
      kick: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
      snare: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
      hat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      bass: [0, null, 0, null, -2, null, 0, null, 5, null, 7, null, 5, null, 3, null],
      chords: [[0, 3, 7], null, null, null, [-2, 1, 5], null, null, null, [5, 8, 12], null, null, null, [3, 7, 10], null, null, null],
      lead: [12, null, 15, null, 17, null, 15, null, 19, null, 17, null, 15, null, 14, null]
    };
  }

  function toFreq(root: number, semitoneOffset: number): number {
    return root * Math.pow(2, semitoneOffset / 12);
  }

  function scheduleEnvelope(
    gain: GainNode,
    time: number,
    attack: number,
    hold: number,
    release: number,
    peak: number
  ): void {
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), time + attack);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * 0.82), time + attack + hold);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + attack + hold + release);
  }

  function playOscVoice(
    time: number,
    destination: AudioNode,
    type: OscillatorType,
    frequency: number,
    duration: number,
    gainValue: number,
    detune = 0
  ): void {
    if (!audioContext) return;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, time);
    osc.detune.setValueAtTime(detune, time);
    scheduleEnvelope(gain, time, 0.003, duration * 0.25, duration * 0.75, gainValue);
    osc.connect(gain).connect(destination);
    osc.start(time);
    osc.stop(time + duration + 0.01);
  }

  function scheduleKick(time: number, stage: StageId, intensity: number): void {
    if (!audioContext || !drumGain || !duckGain) return;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(stage === "amp-invaders" ? 260 : 180, time);

    osc.type = stage === "amp-invaders" ? "triangle" : "sine";
    osc.frequency.setValueAtTime(stage === "amp-invaders" ? 150 : 125, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.12);

    scheduleEnvelope(gain, time, 0.002, 0.016, 0.12, 0.66 + intensity * 0.22);
    osc.connect(filter).connect(gain).connect(drumGain);
    osc.start(time);
    osc.stop(time + 0.16);

    duckGain.gain.cancelScheduledValues(time);
    duckGain.gain.setValueAtTime(1, time);
    duckGain.gain.exponentialRampToValueAtTime(0.63, time + 0.014);
    duckGain.gain.exponentialRampToValueAtTime(1, time + 0.19);
  }

  function scheduleSnare(time: number, intensity: number): void {
    if (!audioContext || !drumGain || !noiseBuffer) return;
    const src = audioContext.createBufferSource();
    src.buffer = noiseBuffer;
    const bp = audioContext.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(1900, time);
    bp.Q.value = 0.8;
    const noiseGain = audioContext.createGain();
    scheduleEnvelope(noiseGain, time, 0.001, 0.012, 0.1, 0.28 + intensity * 0.1);
    src.connect(bp).connect(noiseGain).connect(drumGain);
    src.start(time);
    src.stop(time + 0.14);

    const bodyOsc = audioContext.createOscillator();
    const bodyGain = audioContext.createGain();
    bodyOsc.type = "triangle";
    bodyOsc.frequency.setValueAtTime(220, time);
    bodyOsc.frequency.exponentialRampToValueAtTime(140, time + 0.09);
    scheduleEnvelope(bodyGain, time, 0.001, 0.008, 0.1, 0.12 + intensity * 0.05);
    bodyOsc.connect(bodyGain).connect(drumGain);
    bodyOsc.start(time);
    bodyOsc.stop(time + 0.12);
  }

  function scheduleHat(time: number, intensity: number, open = false): void {
    if (!audioContext || !drumGain || !noiseBuffer) return;
    const src = audioContext.createBufferSource();
    src.buffer = noiseBuffer;
    const hp = audioContext.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.setValueAtTime(open ? 5200 : 7600, time);
    const hatGain = audioContext.createGain();
    scheduleEnvelope(hatGain, time, 0.0005, 0.003, open ? 0.12 : 0.034, 0.09 + intensity * 0.06);
    src.connect(hp).connect(hatGain).connect(drumGain);
    src.start(time);
    src.stop(time + (open ? 0.16 : 0.05));
  }

  function scheduleBass(time: number, root: number, semitone: number, intensity: number): void {
    if (!audioContext || !musicGain) return;
    const filter = audioContext.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(320 + intensity * 420, time);
    filter.Q.value = 0.9;
    playOscVoice(time, filter, "sawtooth", toFreq(root, semitone), 0.2, 0.09 + intensity * 0.04);
    filter.connect(musicGain);
  }

  function scheduleChord(time: number, root: number, notes: [number, number, number], intensity: number): void {
    if (!musicGain) return;
    const level = 0.024 + intensity * 0.014;
    for (const n of notes) {
      const f = toFreq(root * 2, n);
      playOscVoice(time, musicGain, "triangle", f, 0.35, level, -7);
      playOscVoice(time, musicGain, "triangle", f, 0.35, level, 7);
    }
  }

  function scheduleLead(time: number, root: number, semitone: number, intensity: number, stage: StageId): void {
    if (!musicGain) return;
    const type: OscillatorType = stage === "amp-invaders" ? "sawtooth" : "square";
    playOscVoice(time, musicGain, type, toFreq(root * 4, semitone), 0.12, 0.028 + intensity * 0.02);
  }

  function scheduleStep(stage: StageId, score: number, danger: boolean): void {
    if (!audioContext || !musicGain || !drumGain || !sfxGain || !synthFilter) return;
    const profile = stageProfile(stage);
    const step = step16 % 16;
    const time = nextStepAt;
    const dynamic = clamp(0.18, 0.22 + score / 2200 + (danger ? 0.1 : 0), 1);
    energy = dynamic;

    const layer = clamp(1, 1 + Math.floor(score / 260), 6);

    if (profile.kick[step]) scheduleKick(time, stage, dynamic);
    if (profile.snare[step] && layer >= 2) scheduleSnare(time, dynamic);
    if (profile.hat[step] && layer >= 2) {
      scheduleHat(time, dynamic, stage === "amp-invaders" && step % 8 === 7);
    }

    const bassNote = profile.bass[step];
    if (bassNote !== null) scheduleBass(time, profile.root, bassNote, dynamic);

    const chord = profile.chords[step];
    if (chord && layer >= 3) scheduleChord(time + 0.01, profile.root, chord, dynamic);

    const lead = profile.lead[step];
    if (lead !== null && layer >= 4) scheduleLead(time + 0.02, profile.root, lead, dynamic, stage);

    synthFilter.frequency.setTargetAtTime(
      clamp(420, 900 + layer * 320 + dynamic * 600 + (stage === "amp-invaders" ? 380 : 0) + (danger ? 700 : 0), 8200),
      time,
      0.05
    );
  }

  function triggerPickup(now: number): void {
    if (!audioContext || !sfxGain) return;
    const ctx = audioContext;
    const sfx = sfxGain;
    if (now - prevPickupAt < 0.055) return;
    prevPickupAt = now;
    const base = currentStage === "amp-invaders" ? 523.25 : currentStage === "moshpit-pacman" ? 587.33 : 659.25;
    const intervals = [0, 3, 7];
    intervals.forEach((offset, index) => {
      const t = now + index * 0.018;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(toFreq(base, offset), t);
      scheduleEnvelope(gain, t, 0.001, 0.01, 0.06, 0.09);
      osc.connect(gain).connect(sfx);
      osc.start(t);
      osc.stop(t + 0.08);
    });
  }

  function triggerCommit(now: number): void {
    if (!audioContext || !sfxGain) return;
    const ctx = audioContext;
    const sfx = sfxGain;
    const seq = [220, 277.18, 329.63, 440];
    seq.forEach((freq, index) => {
      const t = now + index * 0.045;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t);
      scheduleEnvelope(gain, t, 0.003, 0.03, 0.12, 0.13);
      osc.connect(gain).connect(sfx);
      osc.start(t);
      osc.stop(t + 0.16);
    });
  }

  function triggerDeath(now: number): void {
    if (!audioContext || !sfxGain || !noiseBuffer) return;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.24);
    scheduleEnvelope(gain, now, 0.001, 0.02, 0.24, 0.2);
    osc.connect(gain).connect(sfxGain);
    osc.start(now);
    osc.stop(now + 0.28);

    const noise = audioContext.createBufferSource();
    noise.buffer = noiseBuffer;
    const bp = audioContext.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(1200, now);
    bp.frequency.exponentialRampToValueAtTime(320, now + 0.2);
    const noiseGain = audioContext.createGain();
    scheduleEnvelope(noiseGain, now, 0.001, 0.01, 0.2, 0.11);
    noise.connect(bp).connect(noiseGain).connect(sfxGain);
    noise.start(now);
    noise.stop(now + 0.24);
  }

  function triggerSubmit(now: number): void {
    if (!audioContext || !sfxGain) return;
    const ctx = audioContext;
    const sfx = sfxGain;
    const notes = [261.63, 329.63, 392, 523.25];
    notes.forEach((n, i) => {
      const t = now + i * 0.05;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(n, t);
      scheduleEnvelope(gain, t, 0.004, 0.04, 0.16, 0.15);
      osc.connect(gain).connect(sfx);
      osc.start(t);
      osc.stop(t + 0.22);
    });
  }

  function triggerZone(now: number): void {
    if (!audioContext || !sfxGain) return;
    const ctx = audioContext;
    const sfx = sfxGain;
    const notes = [392, 493.88, 587.33];
    notes.forEach((n, i) => {
      const t = now + i * 0.03;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(n, t);
      scheduleEnvelope(gain, t, 0.001, 0.02, 0.08, 0.08);
      osc.connect(gain).connect(sfx);
      osc.start(t);
      osc.stop(t + 0.11);
    });
  }

  function scheduleTransport(input: AudioUpdateInput): void {
    if (!audioContext) return;
    const profile = stageProfile(input.stage);
    const stepDur = 60 / profile.bpm / 4;
    while (nextStepAt < audioContext.currentTime + 0.22) {
      scheduleStep(input.stage, input.score, input.danger);
      nextStepAt += stepDur;
      step16 += 1;
    }
  }

  return {
    start(): void {
      ensureStarted();
    },
    trigger(kind: AudioTrigger): void {
      if (!started || !audioContext || !sfxGain) return;
      const now = audioContext.currentTime;
      if (kind === "pickup") {
        triggerPickup(now);
        return;
      }
      if (kind === "commit") {
        triggerCommit(now);
        return;
      }
      if (kind === "death") {
        triggerDeath(now);
        return;
      }
      if (kind === "zone") {
        triggerZone(now);
        return;
      }
      triggerSubmit(now);
    },
    update(input: AudioUpdateInput): void {
      if (!started || !audioContext || !masterGain || !musicGain || !duckGain || !drumGain || !sfxGain || !synthFilter) return;
      const now = audioContext.currentTime;

      if (audioContext.state === "suspended") {
        void audioContext.resume();
      }

      const targetMaster = input.active ? 0.38 : 0.0001;
      masterGain.gain.setTargetAtTime(targetMaster, now, 0.12);
      const baseMusicLevel = clamp(0.42, 0.56 + input.score / 2600 + (input.danger ? 0.06 : 0), 0.86);
      musicGain.gain.setTargetAtTime(input.active ? baseMusicLevel : 0.0001, now, 0.11);
      drumGain.gain.setTargetAtTime(input.active ? 0.84 : 0.0001, now, 0.08);
      sfxGain.gain.setTargetAtTime(input.active ? 0.5 : 0.0001, now, 0.08);
      duckGain.gain.setTargetAtTime(1, now, 0.09);
      synthFilter.frequency.setTargetAtTime(1200 + energy * 2200 + (input.stage === "amp-invaders" ? 500 : 0), now, 0.07);

      if (currentStage !== input.stage) {
        currentStage = input.stage;
        nextStepAt = now + 0.03;
        step16 = 0;
      }

      if (!prevDanger && input.danger) {
        triggerDeath(now);
      }
      prevDanger = input.danger;

      if (!input.active) {
        return;
      }

      scheduleTransport(input);
    }
  };
}
function renderGameToText(): string {
  return JSON.stringify({
    mode,
    stageIndex: flow.currentStageIndex,
    stageName: STAGE_NAMES[flow.currentStageIndex] ?? "complete",
    runMsLeft: Math.max(0, RUN_TOTAL_MS - globalElapsedMs),
    canCommit: canCommitNow(flow),
    bankedTri: [...flow.bankedTri],
    stageRaw: Math.round(flow.stageRaw),
    totalTri: totalBankedTri(),
    theme: activeTheme.id,
    stageState: stage.debugState()
  });
}

function advanceTime(ms: number): void {
  const steps = Math.max(1, Math.round(ms / (1000 / 60)));
  const dt = ms / steps;
  for (let i = 0; i < steps; i += 1) {
    tick(dt);
  }
  render();
}

function advanceTriathlonForTest(): void {
  if (mode === "boot") {
    startRun();
    render();
    return;
  }
  if (mode === "transition") {
    transitionRemainingMs = 0;
    tick(0);
    render();
    return;
  }
  if (mode === "playing" || mode === "deathChoice") {
    flow.commitUnlockedByStage[flow.currentStageIndex] = true;
    commitCurrentStage(true);
    render();
  }
}

function advanceAmpWaveForTest(): void {
  if (mode !== "playing" || stage.id !== "amp-invaders") {
    return;
  }
  stage.forceWaveClearForTest?.();
  tick(0);
  render();
}

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => void;
    advanceTriathlonForTest?: () => void;
    advanceAmpWaveForTest?: () => void;
  }
}

window.render_game_to_text = renderGameToText;
window.advanceTime = advanceTime;
window.advanceTriathlonForTest = advanceTriathlonForTest;
window.advanceAmpWaveForTest = advanceAmpWaveForTest;

// Keep the triathlon rules module hot in runtime for consistency checks.
computeStageOptions({ elapsedMs: 0, stageEnded: false });
