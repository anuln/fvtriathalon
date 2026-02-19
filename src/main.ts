import { computeFinalScore, computeStageScore } from "./domain/scoring";
import { getStageBeatPulse } from "./domain/beatPulse";
import { computeRhythmSerpentGrid } from "./domain/rhythmSerpentLayout";
import { getStageIcon } from "./domain/stageIcons";
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
import { resolveRunTotalMs } from "./domain/runConfig";
import { refreshScores, submitScore, topScores } from "./leaderboard/leaderboardStore";
import { formatEmojiLine, isValidInitials, sanitizeInitials } from "./leaderboard/leaderboardFormat";
import { getDefaultTheme, listThemes } from "./theme/themeRegistry";
import type { ThemePack } from "./theme/themeTypes";
import { stepAutoFire } from "./games/amp-invaders/autoFire";
import { resolveEnemyBulletHit } from "./games/amp-invaders/collision";
import { buildPlayerVolley } from "./games/amp-invaders/spreadLadder";
import {
  STAGE3_V2_DEFAULT_CONFIG,
  type GenreId,
  type SpreadTier,
  getAggressionSpec,
  getWaveSpec
} from "./games/amp-invaders/stage3v2Config";
import { createWaveDirectorV2 } from "./games/amp-invaders/waveDirectorV2";
import { createEnemyDirector } from "./games/amp-invaders/enemyDirector";
import { createBossDirector } from "./games/amp-invaders/bossDirector";
import { getBossLaserColumns, planBossProjectiles } from "./games/amp-invaders/bossAttackPlanner";
import { computeEnemyDropDelta, getEnemyInvasionFloorY } from "./games/amp-invaders/invasionBounds";
import { formatAmpLivesHearts } from "./games/amp-invaders/livesHud";
import { createSpecialsState, updateSpecials } from "./games/amp-invaders/specials";
import { shouldEnterBossOnWaveClear } from "./games/amp-invaders/stageFlow";
import { pickWave1EnemyVariant, type Wave1EnemyVariant } from "./games/amp-invaders/wave1SpriteRoster";
import { getActiveMoshers, getStage2Pacing } from "./games/moshpit-pacman/moshPitEscalation";
import { getMosherGuardVariant, type MoshPitGuardVariant } from "./games/moshpit-pacman/moshPitSpriteRoster";
import { ZONE_LEVEL_STEP, computeZoneCompletionBonus, zonesReadyForRespawn } from "./games/moshpit-pacman/zoneCycle";
import { createZoneMusicState, updateZoneMusicState } from "./games/moshpit-pacman/zoneMusicState";
import {
  applyGuitarSoloScoreMultiplier,
  GUITAR_SOLO_BONUS_MS,
  GUITAR_SOLO_PALETTE,
  GUITAR_SOLO_POWER_KIND,
  GUITAR_SOLO_SCORE_MULTIPLIER,
  GUITAR_SOLO_SPRITE,
  getGuitarSoloSpawnAtMs,
  isRhythmGraceActive,
  type RhythmSerpentGraceTimers,
  type RhythmSerpentPowerKind
} from "./games/rhythm-serpent/guitarSoloPowerup";
import {
  createSnakeAudioDirector,
  resolveSnakeAudioMode,
  resolveSnakePhaseVisual,
  type SnakeAudioMode,
  type SnakeAudioState
} from "./games/rhythm-serpent/snakeAudioDirector";
import {
  bootCopy,
  deathChoiceCopy,
  deathPauseCopy,
  leaderboardCopy,
  resultsCopy,
  transitionCopy
} from "./ui/festivalUxCopy";

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
  isCleared?: () => boolean;
  isGraceActive?: () => boolean;
  getHudHint: () => string;
  debugState: () => unknown;
  forceWaveClearForTest?: () => void;
  forceBossDefeatForTest?: () => void;
};

const STAGE_IDS: StageId[] = ["rhythm-serpent", "moshpit-pacman", "amp-invaders"];
const STAGE_NAMES = ["Rhythm Serpent", "Mosh Pit Pac-Man", "Amp Invaders"];
const RUN_TOTAL_MS = resolveRunTotalMs(window.location.search);
const THEME_OVERRIDE_KEY = "festiverse.theme.override";
const THEME_CYCLE_KEY = "festiverse.theme.cycle";
const THEME_CYCLE_INDEX_KEY = "festiverse.theme.cycle.index";
const INITIALS_STORAGE_KEY = "festiverse.v1.initials";
const SNAKE_AUDIO_MODE = resolveSnakeAudioMode(window.location.search, "v2");
const FORCE_GUITAR_SOLO_POWER = new URLSearchParams(window.location.search).get("forceGuitarSoloPower") === "1";
const GUITAR_SOLO_SFX_URL = new URL("../assets/audio/lyria2/oneshot_guitar_solo.wav", import.meta.url).href;
const GUITAR_SOLO_SPRITE_URL = new URL("../assets/sprites/rhythm-serpent-guitar-solo.png", import.meta.url).href;
const AMP_WAVE1_ENEMY_BASELINE_URL = new URL("../assets/sprites/generated/wave1_enemy_test-transparent.png", import.meta.url).href;
const AMP_WAVE1_ENEMY_VARIANT2_URL = new URL("../assets/sprites/generated/wave1_enemy_variant2_test-transparent.png", import.meta.url).href;
const AMP_WAVE1_ENEMY_VARIANT3_URL = new URL("../assets/sprites/generated/wave1_enemy_variant3_test-transparent.png", import.meta.url).href;
const AMP_WAVE1_ENEMY_VARIANT4_URL = new URL("../assets/sprites/generated/wave1_enemy_variant4_test-transparent.png", import.meta.url).href;
const AMP_WAVE1_BULLET_URL = new URL("../assets/sprites/generated/wave1_bullet_test-transparent.png", import.meta.url).href;
const MOSHPIT_PLAYER_RUNNER_URL = new URL("../assets/sprites/generated/moshpit_player_runner_test-transparent.png", import.meta.url).href;
const MOSHPIT_GUARD_BOUNCER_URL = new URL("../assets/sprites/generated/moshpit_guard_bouncer_test-transparent.png", import.meta.url).href;
const MOSHPIT_GUARD_PUNKER_URL = new URL("../assets/sprites/generated/moshpit_guard_punker_test-transparent.png", import.meta.url).href;
const MOSHPIT_GUARD_RAVER_URL = new URL("../assets/sprites/generated/moshpit_guard_raver_test-transparent.png", import.meta.url).href;

function must<T>(value: T | null | undefined, message: string): T {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
  return value;
}

function createOptionalImage(src: string): HTMLImageElement {
  const image = new Image();
  image.src = src;
  return image;
}

function readStoredInitials(): string {
  if (typeof localStorage === "undefined") {
    return "";
  }
  const raw = localStorage.getItem(INITIALS_STORAGE_KEY);
  return sanitizeInitials(raw ?? "");
}

function writeStoredInitials(value: string): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  localStorage.setItem(INITIALS_STORAGE_KEY, sanitizeInitials(value));
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
    </header>
    <section class="canvas-wrap">
      <canvas id="game-canvas"></canvas>
      <div id="overlay" class="overlay"></div>
      <div id="admin-panel" class="admin-panel hidden"></div>
    </section>
    <footer class="action-rail">
      <div class="stage-meta">
        <span id="hud-score">Stage: 0 • Total: 0</span>
        <span id="hud-grace" class="grace-indicator hidden">GRACE</span>
        <span id="hud-lives" class="lives-indicator hidden">❤ ❤ ❤</span>
      </div>
      <button id="commit-btn" class="btn primary hidden">LOCK STAGE</button>
    </footer>
  </div>
`;

const canvas = must(document.querySelector<HTMLCanvasElement>("#game-canvas"), "Missing game canvas");
const overlay = must(document.querySelector<HTMLDivElement>("#overlay"), "Missing overlay container");
const adminPanel = must(document.querySelector<HTMLDivElement>("#admin-panel"), "Missing admin panel");
const hudTime = must(document.querySelector<HTMLDivElement>("#hud-time"), "Missing hud time");
const hudStage = must(document.querySelector<HTMLDivElement>("#hud-stage"), "Missing hud stage");
const hudScore = must(document.querySelector<HTMLSpanElement>("#hud-score"), "Missing hud score");
const hudGrace = must(document.querySelector<HTMLSpanElement>("#hud-grace"), "Missing hud grace");
const hudLives = must(document.querySelector<HTMLSpanElement>("#hud-lives"), "Missing hud lives");
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
let transitionTotalScore = 0;
let submittedScore = false;
let initialsDraft = readStoredInitials();
let lastSubmittedInitials = "";
let scoreSubmitPending = false;
let scoreSubmitError = "";
let leaderboardLoading = false;
let leaderboardSyncError = "";
let frameWidth = 960;
let frameHeight = 540;
let lastOverlayMarkup = "";

let secretArmed = false;
let secretTapCount = 0;
let secretTapDeadline = 0;
let secretHoldTimer = 0;
let isPointerHeldOnOverlay = false;
let cycleThemesOnRestart = readBool(THEME_CYCLE_KEY);
const guitarSoloSpriteImage = createOptionalImage(GUITAR_SOLO_SPRITE_URL);
const ampWave1EnemyImages: Record<Wave1EnemyVariant, HTMLImageElement> = {
  baseline: createOptionalImage(AMP_WAVE1_ENEMY_BASELINE_URL),
  variant2: createOptionalImage(AMP_WAVE1_ENEMY_VARIANT2_URL),
  variant3: createOptionalImage(AMP_WAVE1_ENEMY_VARIANT3_URL),
  variant4: createOptionalImage(AMP_WAVE1_ENEMY_VARIANT4_URL)
};
const ampWave1BulletImage = createOptionalImage(AMP_WAVE1_BULLET_URL);
const moshPitPlayerSpriteImage = createOptionalImage(MOSHPIT_PLAYER_RUNNER_URL);
const moshPitGuardSpriteImages: Record<MoshPitGuardVariant, HTMLImageElement> = {
  bouncer: createOptionalImage(MOSHPIT_GUARD_BOUNCER_URL),
  punker: createOptionalImage(MOSHPIT_GUARD_PUNKER_URL),
  raver: createOptionalImage(MOSHPIT_GUARD_RAVER_URL)
};

const input = createInputController(canvas);
input.setStage(STAGE_IDS[flow.currentStageIndex] ?? "rhythm-serpent");
void refreshScores();

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

overlay.addEventListener("input", (event) => {
  const target = event.target as HTMLInputElement;
  if (target.dataset.field !== "initials") {
    return;
  }
  const next = sanitizeInitials(target.value);
  if (target.value !== next) {
    target.value = next;
  }
  if (initialsDraft !== next) {
    initialsDraft = next;
    writeStoredInitials(initialsDraft);
  }
  if (scoreSubmitError) {
    scoreSubmitError = "";
  }
});

overlay.addEventListener("keydown", (event) => {
  const target = event.target as HTMLInputElement;
  if (target.dataset.field !== "initials") {
    return;
  }
  if (event.key === "Enter") {
    event.preventDefault();
    void submitCurrentRunScore();
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
    lastSubmittedInitials = "";
    scoreSubmitPending = false;
    scoreSubmitError = "";
    leaderboardLoading = false;
    leaderboardSyncError = "";
  } else if (action === "submit-score") {
    void submitCurrentRunScore();
  } else if (action === "open-leaderboard") {
    void openLeaderboardScreen();
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

function readSnakeAudioTelemetry(activeStage: StageRuntime): SnakeAudioTelemetry | null {
  if (activeStage.id !== "rhythm-serpent") {
    return null;
  }
  const debug = activeStage.debugState();
  if (!debug || typeof debug !== "object") {
    return null;
  }
  const payload = debug as Record<string, unknown>;
  const comboRaw = payload.combo;
  const snakeLengthRaw = payload.snakeLength;
  const openingGraceRaw = payload.openingGraceMs;
  const powerActiveRaw = payload.powerActive;
  const powerActive =
    powerActiveRaw && typeof powerActiveRaw === "object"
      ? (powerActiveRaw as Record<string, unknown>)
      : null;
  const timedGrace =
    (typeof openingGraceRaw === "number" && openingGraceRaw > 0) ||
    (typeof powerActive?.bassDropMs === "number" && powerActive.bassDropMs > 0) ||
    (typeof powerActive?.encoreMs === "number" && powerActive.encoreMs > 0) ||
    (typeof powerActive?.moshBurstMs === "number" && powerActive.moshBurstMs > 0) ||
    (typeof powerActive?.guitarSoloMs === "number" && powerActive.guitarSoloMs > 0);

  return {
    combo: Math.max(0, typeof comboRaw === "number" ? Math.round(comboRaw) : 0),
    snakeLength: Math.max(3, typeof snakeLengthRaw === "number" ? Math.round(snakeLengthRaw) : 3),
    graceActive: timedGrace
  };
}

function readAmpInvadersLives(activeStage: StageRuntime): number | null {
  if (activeStage.id !== "amp-invaders") {
    return null;
  }
  const debug = activeStage.debugState();
  if (!debug || typeof debug !== "object") {
    return null;
  }
  const payload = debug as Record<string, unknown>;
  const livesRaw = payload.lives;
  if (typeof livesRaw !== "number" || !Number.isFinite(livesRaw)) {
    return null;
  }
  return Math.max(0, Math.round(livesRaw));
}

function parseSnakeAudioState(value: unknown): SnakeAudioState | null {
  if (
    value === "intro" ||
    value === "build" ||
    value === "vibe" ||
    value === "hype" ||
    value === "drop" ||
    value === "breakdown" ||
    value === "flow"
  ) {
    return value;
  }
  return null;
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

    if (stage.isCleared?.()) {
      flow.commitUnlockedByStage[flow.currentStageIndex] = true;
      commitCurrentStage(true);
      return;
    }

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
  }

  if (runActive && globalElapsedMs >= RUN_TOTAL_MS && mode !== "results" && mode !== "leaderboard") {
    forceEndRunByClock();
  }

  audio.update({
    active: runActive && (mode === "playing" || mode === "deathPause" || mode === "deathChoice"),
    stage: STAGE_IDS[flow.currentStageIndex] ?? "rhythm-serpent",
    score: flow.stageRaw,
    stageElapsedMs: flow.elapsedInStageMs,
    danger: mode === "deathPause" || mode === "deathChoice",
    snakeTelemetry: readSnakeAudioTelemetry(stage)
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
  const compactHud = frameWidth <= 520;
  const summary = finalScoreSummary();
  const graceActive = mode === "playing" && (stage.isGraceActive?.() ?? false);
  const canShowAmpLives =
    stage.id === "amp-invaders" && (mode === "playing" || mode === "deathPause" || mode === "deathChoice");
  const ampLives = canShowAmpLives ? readAmpInvadersLives(stage) : null;
  const ampLivesText = ampLives === null ? "" : formatAmpLivesHearts(ampLives);
  hudTime.textContent = formatMs(leftMs);
  hudStage.textContent =
    mode === "results" || mode === "leaderboard"
      ? compactHud
        ? "Complete"
        : "Run Complete"
      : compactHud
      ? `S${flow.currentStageIndex + 1}/3`
      : `Stage ${flow.currentStageIndex + 1}/3`;
  hudScore.textContent =
    mode === "results" || mode === "leaderboard"
      ? `Set Total: ${summary.baseScore} • Final: ${summary.totalScore}`
      : `Stage: ${Math.round(flow.stageRaw)} • Total: ${totalBankedScore()}`;
  hudGrace.classList.toggle("hidden", !graceActive);
  hudGrace.textContent = graceActive ? "GRACE" : "";
  hudLives.classList.toggle("hidden", ampLivesText.length === 0);
  hudLives.textContent = ampLivesText;
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
        <h1 class="title-stack"><span>${bootCopy.titleTop}</span><span>${bootCopy.titleBottom}</span></h1>
        <p class="strap">${bootCopy.strap}</p>
        <p class="muted">${bootCopy.hint}</p>
        <button class="btn primary" data-testid="start" data-action="start-run">${bootCopy.startCta}</button>
        <div class="stage-pill-row">
          <span>${bootCopy.stageLabels[0]}</span>
          <span>${bootCopy.stageLabels[1]}</span>
          <span>${bootCopy.stageLabels[2]}</span>
        </div>
        <small>${bootCopy.rules}</small>
      </div>
    `;
  } else if (mode === "deathPause") {
    markup = `
      <div class="card compact">
        <h2>${deathPauseCopy.title}</h2>
        <p>${deathPauseCopy.subtitle}</p>
      </div>
    `;
  } else if (mode === "deathChoice") {
    markup = `
      <div class="card">
        <h2>${deathChoiceCopy.title}</h2>
        <p>${deathChoiceCopy.subtitle}</p>
        <div class="row">
          <button class="btn primary" data-action="retry">${deathChoiceCopy.primaryCta}</button>
          <button class="btn secondary" data-action="open-commit">${deathChoiceCopy.secondaryCta}</button>
        </div>
      </div>
    `;
  } else if (mode === "transition") {
    const nextLabel = flow.currentStageIndex >= STAGE_NAMES.length ? "Results" : STAGE_NAMES[flow.currentStageIndex];
    markup = `
      <div class="card">
        <h2>STAGE ${transitionCommittedStageIndex + 1} LOCKED</h2>
        <p>Banked: ${Math.round(transitionStageRawScore)}</p>
        <p>Set Total: ${transitionTotalScore}</p>
        <p class="muted">${transitionCopy.nextPrefix}: ${nextLabel}</p>
        <div class="row">
          <button class="btn primary" data-action="continue-stage">${transitionCopy.cta}</button>
        </div>
      </div>
    `;
  } else if (mode === "results") {
    const summary = finalScoreSummary();
    const initials = sanitizeInitials(initialsDraft);
    const submitCta = scoreSubmitPending
      ? resultsCopy.submitPendingCta
      : submittedScore
      ? resultsCopy.submittedCta
      : resultsCopy.submitCta;
    const emojiSplits = flow.bankedTri
      .map((value, idx) => {
        const emoji = getStageIcon(idx);
        return `<li><span>${emoji}</span><strong>${Math.round(value)}</strong></li>`;
      })
      .join("");
    markup = `
      <div class="card results tight-results">
        <h2>${resultsCopy.title}</h2>
        <p class="score">${summary.totalScore}</p>
        <p class="bonus-line"><span>${resultsCopy.timeBonusLabel}</span><strong>+${summary.timeBonus}</strong></p>
        <ul class="emoji-split-list">${emojiSplits}</ul>
        <label class="initials-entry">
          <span>${resultsCopy.initialsLabel}</span>
          <input
            data-field="initials"
            data-testid="initials-input"
            maxlength="3"
            inputmode="latin"
            autocapitalize="characters"
            autocomplete="off"
            spellcheck="false"
            value="${initials}"
            placeholder="AAA"
          />
          <small>${resultsCopy.initialsHint}</small>
        </label>
        <div class="row submit-row">
          <button
            class="btn primary ${submittedScore ? "is-locked" : ""} ${scoreSubmitPending ? "is-busy" : ""}"
            data-action="submit-score"
            ${scoreSubmitPending || submittedScore ? "disabled" : ""}
          >${submitCta}</button>
        </div>
        ${scoreSubmitError ? `<p class="error">${scoreSubmitError}</p>` : ""}
        <div class="row results-actions">
          <button class="btn secondary" data-action="open-leaderboard" ${scoreSubmitPending ? "disabled" : ""}>${resultsCopy.leaderboardCta}</button>
          <button class="btn tertiary" data-action="play-again" ${scoreSubmitPending ? "disabled" : ""}>${resultsCopy.playAgainCta}</button>
        </div>
      </div>
    `;
  } else if (mode === "leaderboard") {
    const highlightInitials = sanitizeInitials(lastSubmittedInitials || initialsDraft);
    const rows = topScores()
      .map((entry, index) => {
        const line = formatEmojiLine({
          rank: index + 1,
          initials: entry.player,
          splits: entry.splits,
          total: entry.total
        });
        const isYou = highlightInitials.length === 3 && entry.player === highlightInitials;
        return `
          <li class="leaderboard-row ${isYou ? "is-you" : ""}">
            <span>${line}</span>
          </li>
        `;
      })
      .join("");
    markup = `
      <div class="card results">
        <h2>${leaderboardCopy.title}</h2>
        ${leaderboardLoading ? `<p class="muted">${leaderboardCopy.loading}</p>` : ""}
        ${leaderboardSyncError ? `<p class="error">${leaderboardSyncError}</p>` : ""}
        ${submittedScore ? "" : `<p class="muted">${leaderboardCopy.pendingSubmitHint}</p>`}
        <ol class="leaderboard-list">${rows || `<li>${leaderboardCopy.empty}</li>`}</ol>
        <div class="row">
          <button class="btn tertiary" data-action="back-to-results">${leaderboardCopy.backCta}</button>
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
  lastSubmittedInitials = "";
  scoreSubmitPending = false;
  scoreSubmitError = "";
  leaderboardLoading = false;
  leaderboardSyncError = "";
  startStage(flow.currentStageIndex);
  mode = "playing";
}

function startStage(index: number): void {
  flow.currentStageIndex = index;
  flow.elapsedInStageMs = 0;
  flow.stageRaw = 0;
  stage = createStage(index);
  const stageId = STAGE_IDS[index] ?? "rhythm-serpent";
  input.setStage(stageId);
  audio.resetStage(stageId);
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
  const stageScore = computeStageScore(stageId, raw);
  flow.stageRaw = raw;
  const fromIndex = flow.currentStageIndex;

  advanceStage(flow, stageScore);
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
  transitionStageRawScore = stageScore;
  transitionTotalScore = totalBankedScore();
  transitionRemainingMs = 2000;
  mode = "transition";
}

function forceEndRunByClock(): void {
  const stageId = STAGE_IDS[flow.currentStageIndex];
  const raw = Math.max(0, stage.getRawScore());
  const stageScore = computeStageScore(stageId, raw);
  flow.stageRaw = raw;
  flow.bankedRaw[flow.currentStageIndex] = raw;
  flow.bankedTri[flow.currentStageIndex] = stageScore;
  runActive = false;
  mode = "results";
}

function totalBankedScore(): number {
  return flow.bankedTri.reduce((sum, score) => sum + score, 0);
}

function runMsLeft(): number {
  return Math.max(0, RUN_TOTAL_MS - globalElapsedMs);
}

function finalScoreSummary(): { baseScore: number; timeBonus: number; totalScore: number } {
  return computeFinalScore(flow.bankedTri, runMsLeft());
}

async function submitCurrentRunScore(): Promise<void> {
  if (submittedScore || scoreSubmitPending) {
    return;
  }
  const initials = sanitizeInitials(initialsDraft);
  if (!isValidInitials(initials)) {
    scoreSubmitError = resultsCopy.initialsHint;
    return;
  }
  const summary = finalScoreSummary();
  const splits = [...flow.bankedTri];
  scoreSubmitPending = true;
  scoreSubmitError = "";
  writeStoredInitials(initials);
  const submitResult = await submitScore({
    initials,
    total: summary.totalScore,
    splits
  });
  scoreSubmitPending = false;
  if (!submitResult.ok) {
    scoreSubmitError = submitResult.message || "Submit failed. Try again.";
    console.error("Leaderboard submit failed", submitResult);
    return;
  }
  audio.trigger("submit");
  submittedScore = true;
  initialsDraft = initials;
  lastSubmittedInitials = initials;
}

async function openLeaderboardScreen(): Promise<void> {
  mode = "leaderboard";
  leaderboardLoading = true;
  leaderboardSyncError = "";
  try {
    await refreshScores();
  } catch {
    leaderboardSyncError = leaderboardCopy.syncError;
  } finally {
    leaderboardLoading = false;
  }
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
  let nextSurvivalBonusMs = 9_000;
  let nextLengthMilestone = 6;
  let dead = false;
  let openingGraceMs = 5500;
  let combo = 0;
  let comboTimerMs = 0;
  let food = randomGridPoint(cols, rows);
  let foodIcon = instrumentIcons[Math.floor(Math.random() * instrumentIcons.length)];
  let power: { x: number; y: number; kind: RhythmSerpentPowerKind } | null = null;
  let powerIcon = "";
  let guitarSoloFxMs = 0;
  let forcedGuitarSpawned = false;
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
  const randomPowerKinds: RhythmSerpentPowerKind[] = ["bass-drop", "encore", "mosh-burst"];
  let nextGuitarSoloSpawnIndex = 0;

  if (FORCE_GUITAR_SOLO_POWER) {
    let forcedX = (spawnX + 4) % cols;
    let forcedY = spawnY;
    const occupied = (x: number, y: number) =>
      snake.some((segment) => segment.x === x && segment.y === y) || (food.x === x && food.y === y);
    for (let i = 0; i < cols * rows; i += 1) {
      if (!occupied(forcedX, forcedY)) {
        break;
      }
      forcedX = (forcedX + 1) % cols;
      if (forcedX === 0) {
        forcedY = (forcedY + 1) % rows;
      }
    }
    power = {
      x: forcedX,
      y: forcedY,
      kind: GUITAR_SOLO_POWER_KIND
    };
    powerIcon = iconForPower(power.kind);
    forcedGuitarSpawned = true;
  }

  function iconForPower(kind: RhythmSerpentPowerKind): string {
    if (kind === "bass-drop") return "🎸";
    if (kind === "encore") return "🎹";
    if (kind === GUITAR_SOLO_POWER_KIND) return "";
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
      power = {
        ...randomGridPoint(cols, rows, snake, null, food),
        kind: randomPowerKinds[Math.floor(Math.random() * randomPowerKinds.length)] ?? "bass-drop"
      };
      powerIcon = iconForPower(power.kind);
    }
  }

  function spawnGuitarSoloPower(): void {
    power = {
      ...randomGridPoint(cols, rows, snake, null, food),
      kind: GUITAR_SOLO_POWER_KIND
    };
    powerIcon = "";
    forcedGuitarSpawned = true;
  }

  function maybeSpawnCadencedGuitarSolo(): void {
    if (power) {
      return;
    }
    const dueAt = getGuitarSoloSpawnAtMs(nextGuitarSoloSpawnIndex);
    if (stageMs < dueAt) {
      return;
    }
    spawnGuitarSoloPower();
    nextGuitarSoloSpawnIndex += 1;
  }

  function drawGuitarSoloSprite(
    context: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    drawSize: number
  ): void {
    const half = drawSize * 0.5;
    const loaded = guitarSoloSpriteImage.complete && guitarSoloSpriteImage.naturalWidth > 0;
    context.save();
    context.imageSmoothingEnabled = false;
    if (loaded) {
      context.drawImage(guitarSoloSpriteImage, centerX - half, centerY - half, drawSize, drawSize);
      context.restore();
      return;
    }
    const px = drawSize / GUITAR_SOLO_SPRITE.length;
    for (let y = 0; y < GUITAR_SOLO_SPRITE.length; y += 1) {
      const row = GUITAR_SOLO_SPRITE[y] ?? "";
      for (let x = 0; x < row.length; x += 1) {
        const token = row[x] ?? ".";
        if (token === ".") continue;
        const color = GUITAR_SOLO_PALETTE[token];
        if (!color) continue;
        context.fillStyle = color;
        context.fillRect(centerX - half + x * px, centerY - half + y * px, px, px);
      }
    }
    context.restore();
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

  function addScore(delta: number): void {
    score += applyGuitarSoloScoreMultiplier(delta, guitarSoloFxMs);
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

      while (stageMs >= nextSurvivalBonusMs) {
        const sustainBonus = Math.max(18, 18 + Math.floor((snake.length - 3) * 2.8) + combo * 2);
        addScore(sustainBonus);
        nextSurvivalBonusMs += 9_000;
      }

      comboTimerMs -= dtMs;
      if (comboTimerMs <= 0) {
        combo = 0;
        lastBurstMilestone = 0;
      }
      timers.bassDropMs = Math.max(0, timers.bassDropMs - dtMs);
      timers.encoreMs = Math.max(0, timers.encoreMs - dtMs);
      timers.moshBurstMs = Math.max(0, timers.moshBurstMs - dtMs);
      guitarSoloFxMs = Math.max(0, guitarSoloFxMs - dtMs);
      if (!forcedGuitarSpawned && FORCE_GUITAR_SOLO_POWER && !power) {
        spawnGuitarSoloPower();
      }
      maybeSpawnCadencedGuitarSolo();

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
          const baseFoodScore = 22 + combo * 2;
          const lengthBoost = 1 + Math.max(0, snake.length - 3) * 0.1;
          addScore(Math.round(baseFoodScore * mult * lengthBoost));
          if (snake.length >= nextLengthMilestone) {
            addScore(nextLengthMilestone * 16);
            nextLengthMilestone += 3;
          }
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
          if (power.kind === GUITAR_SOLO_POWER_KIND) {
            guitarSoloFxMs = GUITAR_SOLO_BONUS_MS;
            addScore(124);
            audio.trigger("guitarSolo");
          } else if (power.kind === "bass-drop") {
            timers.bassDropMs = 4500;
            addScore(72);
          } else if (power.kind === "encore") {
            timers.encoreMs = 4000;
            addScore(88);
          } else {
            timers.moshBurstMs = 3500;
            addScore(64);
          }
          if (power.kind !== GUITAR_SOLO_POWER_KIND) {
            audio.trigger("pickup");
          }
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
      const audioDebug = audio.debugState?.();
      const phase = resolveSnakePhaseVisual({
        score,
        mode: audioDebug?.snakeAudioMode === "legacy" ? "legacy" : "v2",
        state: parseSnakeAudioState(audioDebug?.snakeAudioState)
      });
      const cell = Math.floor(Math.min(width / cols, height / rows));
      const fieldW = cols * cell;
      const fieldH = rows * cell;
      const offX = Math.floor((width - fieldW) / 2);
      const offY = Math.floor((height - fieldH) / 2);
      const beatBounce = Math.pow(0.2 + pulse * 0.8, 2);
      const now = performance.now();
      const progress = Math.max(0, Math.min(1, score / 360));
      const comboLift = Math.max(0, Math.min(1, combo / 10));
      const powerLift =
        guitarSoloFxMs > 0
          ? 0.22
          : timers.encoreMs > 0
          ? 0.2
          : timers.bassDropMs > 0
          ? 0.18
          : timers.moshBurstMs > 0
          ? 0.16
          : 0;
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
        context.fillStyle =
          power.kind === "encore"
            ? "#ffd447"
            : power.kind === "bass-drop"
            ? "#4dd6ff"
            : power.kind === GUITAR_SOLO_POWER_KIND
            ? "#6fe2ff"
            : "#ff7a34";
        context.beginPath();
        context.arc(powerX, powerY, cell * 0.55, 0, Math.PI * 2);
        context.fill();
        const powerGlow = context.createRadialGradient(powerX, powerY, cell * 0.12, powerX, powerY, cell * 0.98);
        const glowColor =
          power.kind === "encore"
            ? "#ffd447"
            : power.kind === "bass-drop"
            ? "#4dd6ff"
            : power.kind === GUITAR_SOLO_POWER_KIND
            ? "#7ef8ff"
            : "#ff7a34";
        powerGlow.addColorStop(0, withAlpha(glowColor, 0.82));
        powerGlow.addColorStop(1, withAlpha("#120018", 0));
        context.fillStyle = powerGlow;
        context.beginPath();
        context.arc(powerX, powerY, cell * 0.9, 0, Math.PI * 2);
        context.fill();
        if (power.kind === GUITAR_SOLO_POWER_KIND) {
          drawGuitarSoloSprite(context, powerX, powerY, cell * 1.9);
        } else {
          context.save();
          context.textAlign = "center";
          context.textBaseline = "middle";
          context.font = `${Math.max(14, Math.floor(cell * 0.72))}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
          context.fillText(powerIcon, powerX, powerY + 1);
          context.restore();
        }
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

      if (guitarSoloFxMs > 0) {
        const life = guitarSoloFxMs / GUITAR_SOLO_BONUS_MS;
        const fade = 1 - life;
        const head = snake[0];
        const hx = offX + (head?.x ?? 0) * cell + cell * 0.5;
        const hy = offY + (head?.y ?? 0) * cell + cell * 0.5;
        context.save();
        context.globalCompositeOperation = "screen";
        const ringCount = 3;
        for (let i = 0; i < ringCount; i += 1) {
          const p = (fade + i / ringCount) % 1;
          const radius = cell * (1.1 + p * 5.4);
          context.strokeStyle = withAlpha(i % 2 === 0 ? "#90f8ff" : "#ffc4ff", 0.26 * (1 - p));
          context.lineWidth = Math.max(1.2, cell * (0.08 - p * 0.04));
          context.beginPath();
          context.arc(hx, hy, radius, 0, Math.PI * 2);
          context.stroke();
        }
        for (let i = 0; i < 10; i += 1) {
          const angle = now * 0.008 + i * (Math.PI * 2 / 10);
          const length = cell * (2.5 + Math.sin(now * 0.01 + i) * 1.5);
          const x1 = hx + Math.cos(angle) * cell * 0.9;
          const y1 = hy + Math.sin(angle) * cell * 0.9;
          const x2 = hx + Math.cos(angle) * length;
          const y2 = hy + Math.sin(angle) * length;
          context.strokeStyle = withAlpha(i % 2 ? "#7fe2ff" : "#ffd2ef", 0.24 + beatBounce * 0.18);
          context.lineWidth = Math.max(1, cell * 0.08);
          context.beginPath();
          context.moveTo(x1, y1);
          context.lineTo(x2, y2);
          context.stroke();
        }
        context.fillStyle = withAlpha("#b8f8ff", 0.07 + beatBounce * 0.08);
        context.fillRect(offX, offY, fieldW, fieldH);
        context.restore();
      }

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
    isGraceActive() {
      const graceTimers: RhythmSerpentGraceTimers = {
        bassDropMs: timers.bassDropMs,
        encoreMs: timers.encoreMs,
        moshBurstMs: timers.moshBurstMs,
        guitarSoloMs: guitarSoloFxMs
      };
      return isRhythmGraceActive(openingGraceMs, graceTimers);
    },
    getHudHint() {
      const active =
        guitarSoloFxMs > 0
          ? `GUITAR SOLO ${GUITAR_SOLO_SCORE_MULTIPLIER}X`
          : timers.encoreMs > 0
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
        food: { x: food.x, y: food.y },
        power: power ? { x: power.x, y: power.y, kind: power.kind } : null,
        combo,
        snakeLength: snake.length,
        pendingPowerKind: power?.kind ?? null,
        openingGraceMs,
        nextGuitarSoloSpawnMs: getGuitarSoloSpawnAtMs(nextGuitarSoloSpawnIndex),
        powerActive: {
          ...timers,
          guitarSoloMs: guitarSoloFxMs,
          guitarSoloMultiplier: guitarSoloFxMs > 0 ? GUITAR_SOLO_SCORE_MULTIPLIER : 1
        },
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

  const playerSpawn = { x: 1, y: 1 };
  let player = { x: playerSpawn.x, y: playerSpawn.y, dir: "right" as Dir, want: "right" as Dir };
  let moveMs = 0;
  let guardMoveMs = 0;
  let stageMs = 0;
  let frightMs = 0;
  let score = 0;
  let dead = false;
  let level = 1;
  let guardChain = 0;
  let crowdSaveCharges = 1;
  let crowdSaveInvulnMs = 0;
  let zoneCompletionFlashMs = 0;
  let totalZoneCompletions = 0;
  const turnAssist = createMobileTurnAssistState({
    maxQueue: 3,
    ttlMs: 380,
    blockOppositeTurns: false
  });

  const guards: Array<{ x: number; y: number; dir: Dir; homeX: number; homeY: number; homeDir: Dir }> = [
    { x: cols - 2, y: 1, dir: "left", homeX: cols - 2, homeY: 1, homeDir: "left" },
    { x: cols - 2, y: rows - 2, dir: "up", homeX: cols - 2, homeY: rows - 2, homeDir: "up" },
    { x: 1, y: rows - 2, dir: "right", homeX: 1, homeY: rows - 2, homeDir: "right" }
  ];

  const zoneCollected = [0, 0, 0, 0, 0];
  const zoneTotals = [0, 0, 0, 0, 0];
  const zoneCompletions = [0, 0, 0, 0, 0];
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
      score += 12;
    } else {
      score += 55;
      frightMs = 4200;
      guardChain = 0;
    }
    audio.trigger("pickup");
    map[y][x] = " ";
  }

  function respawnZoneTiles(zone: number): void {
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        if (zoneIndex(x, y) !== zone) continue;
        if (mapTemplate[y][x] !== "." && mapTemplate[y][x] !== "o") continue;
        map[y][x] = mapTemplate[y][x];
      }
    }
    zoneCollected[zone] = 0;
    zoneMusic.milestonesByZone[zone] = 0;
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

  function moveGuard(guard: { x: number; y: number; dir: Dir; homeX: number; homeY: number; homeDir: Dir }): void {
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

  function resetAfterCrowdSave(): void {
    player = { x: playerSpawn.x, y: playerSpawn.y, dir: "right", want: "right" };
    moveMs = 0;
    guardMoveMs = 0;
    guardChain = 0;
    for (const guard of guards) {
      guard.x = guard.homeX;
      guard.y = guard.homeY;
      guard.dir = guard.homeDir;
    }
  }

  function awardAndRespawnCompletedZones(): void {
    const completed = zonesReadyForRespawn(zoneCollected, zoneTotals);
    for (const zone of completed) {
      const zoneTotal = Math.max(1, zoneTotals[zone] ?? 1);
      const completionCount = zoneCompletions[zone] ?? 0;
      score += computeZoneCompletionBonus(zoneTotal, completionCount);
      zoneCompletions[zone] = completionCount + 1;
      totalZoneCompletions += 1;
      zoneCompletionFlashMs = 950;
      audio.trigger("zone");
      respawnZoneTiles(zone);

      if (totalZoneCompletions % ZONE_LEVEL_STEP === 0) {
        level += 1;
        score += 90;
      }
    }
  }

  function activeMosherCount(): number {
    return getActiveMoshers(totalZoneCompletions, guards.length);
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
    if (crowdSaveInvulnMs > 0) {
      return;
    }
    const activeCount = activeMosherCount();
    for (let i = 0; i < activeCount; i += 1) {
      const guard = guards[i];
      if (!guard) continue;
      if (guard.x !== player.x || guard.y !== player.y) continue;
      if (frightMs > 0) {
        guardChain += 1;
        score += 140 * Math.pow(2, Math.min(2, guardChain - 1));
        audio.trigger("pickup");
        guard.x = guard.homeX;
        guard.y = guard.homeY;
        guard.dir = guard.homeDir;
      } else if (crowdSaveCharges > 0) {
        crowdSaveCharges -= 1;
        crowdSaveInvulnMs = 1400;
        zoneCompletionFlashMs = 700;
        audio.trigger("zone");
        resetAfterCrowdSave();
        return;
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
      crowdSaveInvulnMs = Math.max(0, crowdSaveInvulnMs - dtMs);
      zoneCompletionFlashMs = Math.max(0, zoneCompletionFlashMs - dtMs);
      moveMs += dtMs;
      guardMoveMs += dtMs;
      const pacing = getStage2Pacing(level, totalZoneCompletions, frightMs);
      const activeGuardCount = activeMosherCount();

      const playerStep = pacing.playerStepMs;
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

      const guardStep = pacing.guardStepMs;
      while (guardMoveMs >= guardStep) {
        guardMoveMs -= guardStep;
        for (let i = 0; i < activeGuardCount; i += 1) {
          const guard = guards[i];
          if (!guard) continue;
          moveGuard(guard);
        }
        checkGuardCollision();
      }

      awardAndRespawnCompletedZones();

      const nextZoneMusic = updateZoneMusicState(zoneMusic, zoneCollected, zoneTotals, frightMs);
      if (nextZoneMusic.pendingStingers > 0) {
        const burst = Math.min(2, nextZoneMusic.pendingStingers);
        for (let i = 0; i < burst; i += 1) {
          audio.trigger("zone");
        }
      }
      zoneMusic = nextZoneMusic;
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

      function spriteReady(image: HTMLImageElement): boolean {
        return image.complete && image.naturalWidth > 0;
      }

      function drawSpriteCentered(
        image: HTMLImageElement,
        centerX: number,
        centerY: number,
        drawSize: number,
        rotationRad = 0,
        alpha = 1
      ): void {
        const half = drawSize * 0.5;
        context.save();
        context.translate(centerX, centerY);
        if (rotationRad !== 0) {
          context.rotate(rotationRad);
        }
        context.globalAlpha *= alpha;
        context.imageSmoothingEnabled = false;
        context.drawImage(image, -half, -half, drawSize, drawSize);
        context.restore();
      }

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

      if (zoneCompletionFlashMs > 0) {
        const life = zoneCompletionFlashMs / 950;
        context.fillStyle = withAlpha("#ffe26d", 0.08 + life * 0.12);
        context.fillRect(offX, offY, fieldW, fieldH);
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
      if (spriteReady(moshPitPlayerSpriteImage)) {
        drawSpriteCentered(moshPitPlayerSpriteImage, playerCenterX, playerCenterY, unit * 1.15, facing + Math.PI / 2);
        if (frightMs > 0) {
          context.fillStyle = withAlpha("#5cf5d6", 0.12);
          context.beginPath();
          context.arc(playerCenterX, playerCenterY, unit * 0.58, 0, Math.PI * 2);
          context.fill();
        }
      } else {
        context.fillStyle = frightMs > 0 ? "#33ffd6" : "#ffe35f";
        context.beginPath();
        context.moveTo(playerCenterX, playerCenterY);
        context.arc(playerCenterX, playerCenterY, unit * 0.38, facing + 0.35, facing + Math.PI * 2 - 0.35);
        context.closePath();
        context.fill();
      }

      const activeGuardCount = activeMosherCount();
      guards.forEach((guard, index) => {
        const gx = offX + guard.x * cellX + cellX * 0.5;
        const gy = offY + guard.y * cellY + cellY * 0.5;
        const active = index < activeGuardCount;
        if (!active) {
          context.fillStyle = withAlpha("#b7a3d5", 0.24);
          context.beginPath();
          context.arc(gx, gy, unit * 0.28, 0, Math.PI * 2);
          context.fill();
          context.strokeStyle = withAlpha("#b7a3d5", 0.5);
          context.lineWidth = 1.1;
          context.beginPath();
          context.moveTo(gx - unit * 0.16, gy);
          context.lineTo(gx + unit * 0.16, gy);
          context.moveTo(gx, gy - unit * 0.16);
          context.lineTo(gx, gy + unit * 0.16);
          context.stroke();
          return;
        }
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

        const guardVariant = getMosherGuardVariant(index);
        const guardSprite = moshPitGuardSpriteImages[guardVariant];
        if (spriteReady(guardSprite)) {
          drawSpriteCentered(guardSprite, gx, gy, unit * 1.12);
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

      context.fillStyle = theme.palette.text;
      context.font = "10px monospace";
      context.textAlign = "right";
      const saveStatus = crowdSaveCharges > 0 ? "SAVE READY" : crowdSaveInvulnMs > 0 ? "RECOVERING" : "SAVE SPENT";
      context.fillText(`MOSH ${activeGuardCount}/${guards.length} • ${saveStatus}`, offX + fieldW - 2, zoneBarY - 4);
      context.textAlign = "left";
    },
    getRawScore() {
      return score;
    },
    isDead() {
      return dead;
    },
    getHudHint() {
      const active = activeMosherCount();
      const pace = getStage2Pacing(level, totalZoneCompletions, frightMs);
      if (frightMs > 0) {
        return `Backstage Pass Active • Moshers ${active}/${guards.length} • Guard Tempo ${pace.guardStepMs}ms`;
      }
      return `Clear zones to release moshers (${active}/${guards.length}) • Tempo ${pace.guardStepMs}ms`;
    },
    debugState() {
      const pace = getStage2Pacing(level, totalZoneCompletions, frightMs);
      return {
        level,
        frightMs,
        crowdSaveCharges,
        crowdSaveInvulnMs,
        pelletsRemaining: pelletCount(),
        zoneCompletions: [...zoneCompletions],
        totalZoneCompletions,
        activeMoshers: activeMosherCount(),
        pacing: pace,
        renderCoverageY,
        musicLayers: zoneMusic.activeLayers,
        musicIntensity: zoneMusic.intensity,
        playerDir: player.dir,
        playerWant: player.want,
        turnTelemetry: readTurnAssistTelemetry(turnAssist),
        player: { x: player.x, y: player.y },
        guards: guards.map((guard, index) => ({ x: guard.x, y: guard.y, active: index < activeMosherCount() }))
      };
    }
  };
}

function createAmpInvadersStage(): StageRuntime {
  type EnemySpriteVariant =
    | "w1_baseline"
    | "w1_variant2"
    | "w1_variant3"
    | "w1_variant4"
    | "w2_variant1"
    | "w2_variant2"
    | "w2_variant3"
    | "w3_variant1"
    | "w3_variant2"
    | "w3_variant3";
  type BulletSpriteKey = "w1_player" | "w1_enemy" | "w2_player" | "w2_enemy" | "w3_player" | "w3_enemy" | "w4_player" | "w4_enemy";
  type Enemy = {
    x: number;
    y: number;
    type: "basic" | "armored" | "elite";
    hp: number;
    alive: boolean;
    spriteVariant: EnemySpriteVariant | null;
  };
  type Bullet = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    damage: number;
    enemy: boolean;
    kind?: "standard" | "laser" | "seeker";
    steerStrength?: number;
  };
  const AMP_WAVE2_ENEMY_VARIANT1_URL = new URL("../assets/sprites/generated/wave2_enemy_variant1_test-transparent.png", import.meta.url).href;
  const AMP_WAVE2_ENEMY_VARIANT2_URL = new URL("../assets/sprites/generated/wave2_enemy_variant2_test-transparent.png", import.meta.url).href;
  const AMP_WAVE2_ENEMY_VARIANT3_URL = new URL("../assets/sprites/generated/wave2_enemy_variant3_test-transparent.png", import.meta.url).href;
  const AMP_WAVE3_ENEMY_VARIANT1_URL = new URL("../assets/sprites/generated/wave3_enemy_variant1_test-transparent.png", import.meta.url).href;
  const AMP_WAVE3_ENEMY_VARIANT2_URL = new URL("../assets/sprites/generated/wave3_enemy_variant2_test-transparent.png", import.meta.url).href;
  const AMP_WAVE3_ENEMY_VARIANT3_URL = new URL("../assets/sprites/generated/wave3_enemy_variant3_test-transparent.png", import.meta.url).href;
  const AMP_WAVE1_BULLET_ENEMY_URL = new URL("../assets/sprites/generated/wave1_bullet_enemy_test-transparent.png", import.meta.url).href;
  const AMP_WAVE2_BULLET_PLAYER_URL = new URL("../assets/sprites/generated/wave2_bullet_player_test-transparent.png", import.meta.url).href;
  const AMP_WAVE2_BULLET_ENEMY_URL = new URL("../assets/sprites/generated/wave2_bullet_enemy_test-transparent.png", import.meta.url).href;
  const AMP_WAVE3_BULLET_PLAYER_URL = new URL("../assets/sprites/generated/wave3_bullet_player_test-transparent.png", import.meta.url).href;
  const AMP_WAVE3_BULLET_ENEMY_URL = new URL("../assets/sprites/generated/wave3_bullet_enemy_test-transparent.png", import.meta.url).href;
  const AMP_WAVE4_BULLET_PLAYER_URL = new URL("../assets/sprites/generated/wave4_bullet_player_test-transparent.png", import.meta.url).href;
  const AMP_WAVE4_BULLET_ENEMY_URL = new URL("../assets/sprites/generated/wave4_bullet_enemy_test-transparent.png", import.meta.url).href;
  const AMP_WAVE4_BOSS_URL = new URL("../assets/sprites/generated/wave4_boss_test-transparent.png", import.meta.url).href;
  const ampEnemyImages: Record<EnemySpriteVariant, HTMLImageElement> = {
    w1_baseline: ampWave1EnemyImages.baseline,
    w1_variant2: ampWave1EnemyImages.variant2,
    w1_variant3: ampWave1EnemyImages.variant3,
    w1_variant4: ampWave1EnemyImages.variant4,
    w2_variant1: createOptionalImage(AMP_WAVE2_ENEMY_VARIANT1_URL),
    w2_variant2: createOptionalImage(AMP_WAVE2_ENEMY_VARIANT2_URL),
    w2_variant3: createOptionalImage(AMP_WAVE2_ENEMY_VARIANT3_URL),
    w3_variant1: createOptionalImage(AMP_WAVE3_ENEMY_VARIANT1_URL),
    w3_variant2: createOptionalImage(AMP_WAVE3_ENEMY_VARIANT2_URL),
    w3_variant3: createOptionalImage(AMP_WAVE3_ENEMY_VARIANT3_URL)
  };
  const ampBulletImages: Record<BulletSpriteKey, HTMLImageElement> = {
    w1_player: ampWave1BulletImage,
    w1_enemy: createOptionalImage(AMP_WAVE1_BULLET_ENEMY_URL),
    w2_player: createOptionalImage(AMP_WAVE2_BULLET_PLAYER_URL),
    w2_enemy: createOptionalImage(AMP_WAVE2_BULLET_ENEMY_URL),
    w3_player: createOptionalImage(AMP_WAVE3_BULLET_PLAYER_URL),
    w3_enemy: createOptionalImage(AMP_WAVE3_BULLET_ENEMY_URL),
    w4_player: createOptionalImage(AMP_WAVE4_BULLET_PLAYER_URL),
    w4_enemy: createOptionalImage(AMP_WAVE4_BULLET_ENEMY_URL)
  };
  const ampWave4BossImage = createOptionalImage(AMP_WAVE4_BOSS_URL);

  function getWaveCycleForSprites(value: number): 1 | 2 | 3 | 4 {
    const normalized = Math.max(1, Math.floor(value));
    return ((((normalized - 1) % 4) + 4) % 4) + 1 as 1 | 2 | 3 | 4;
  }

  function pickEnemyVariantForWaveLocal(level: number, slotIndex: number): EnemySpriteVariant | null {
    const cycle = getWaveCycleForSprites(level);
    if (cycle === 1) {
      const items: EnemySpriteVariant[] = ["w1_baseline", "w1_variant2", "w1_variant3", "w1_variant4"];
      return items[((slotIndex % items.length) + items.length) % items.length] ?? "w1_baseline";
    }
    if (cycle === 2) {
      const items: EnemySpriteVariant[] = ["w2_variant1", "w2_variant2", "w2_variant3"];
      return items[((slotIndex % items.length) + items.length) % items.length] ?? "w2_variant1";
    }
    if (cycle === 3) {
      const items: EnemySpriteVariant[] = ["w3_variant1", "w3_variant2", "w3_variant3"];
      return items[((slotIndex % items.length) + items.length) % items.length] ?? "w3_variant1";
    }
    return null;
  }

  function getBulletSpriteKeysForWaveLocal(level: number): { player: BulletSpriteKey; enemy: BulletSpriteKey } {
    const cycle = getWaveCycleForSprites(level);
    if (cycle === 1) return { player: "w1_player", enemy: "w1_enemy" };
    if (cycle === 2) return { player: "w2_player", enemy: "w2_enemy" };
    if (cycle === 3) return { player: "w3_player", enemy: "w3_enemy" };
    return { player: "w4_player", enemy: "w4_enemy" };
  }

  let score = 0;
  let dead = false;
  let cleared = false;
  let stageElapsedMs = 0;
  const waveDirector = createWaveDirectorV2(STAGE3_V2_DEFAULT_CONFIG);
  const enemyDirector = createEnemyDirector(STAGE3_V2_DEFAULT_CONFIG);
  const bossDirector = createBossDirector(STAGE3_V2_DEFAULT_CONFIG);
  const specialsState = createSpecialsState(STAGE3_V2_DEFAULT_CONFIG);
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
  let discoTimerMs = 8000;
  let disco: { active: boolean; x: number; y: number; vx: number } = { active: false, x: 0, y: 48, vx: 220 };
  const bullets: Bullet[] = [];
  const shields = [100, 100, 100];
  let enemyDir = 1;
  let enemySpeed = 40;
  let needsFormationFit = true;
  let lastFormationFitWidth = 0;
  let enemies: Enemy[] = spawnWave(wave);
  let totalShotsFired = 0;
  let totalEnemyShotsFired = 0;
  let lastEnemyPattern: "single" | "dual" | "burst" = "single";
  let inBoss = false;
  let bossX = 0;
  let bossY = 84;
  let bossDir = 1;
  let bossSpeed = 92;
  let bossDefeatAwarded = false;
  let lastSpecialKind: "diveBomber" | "shieldBreaker" | null = null;
  let stageWidth = 960;

  function spawnWave(level: number): Enemy[] {
    const waveSpec = getWaveSpec(STAGE3_V2_DEFAULT_CONFIG, level);
    const aggression = getAggressionSpec(STAGE3_V2_DEFAULT_CONFIG, level);
    const list: Enemy[] = [];
    const rows = waveSpec.rows;
    const cols = waveSpec.cols;
    const hpBoost = level >= 3 ? 1 : 0;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const type = r < waveSpec.eliteRows ? "elite" : r < waveSpec.eliteRows + waveSpec.armoredRows ? "armored" : "basic";
        const baseHp = type === "elite" ? 3 : type === "armored" ? 2 : 1;
        const slotIndex = r * cols + c;
        list.push({
          x: 120 + c * 68,
          y: 80 + r * 52,
          type,
          hp: Math.max(1, Math.round((baseHp + hpBoost) * Math.max(1, aggression.bulletSpeedScale * 0.92))),
          alive: true,
          spriteVariant: pickEnemyVariantForWaveLocal(level, slotIndex)
        });
      }
    }
    enemySpeed = (40 + level * 8) * waveSpec.speedScale;
    needsFormationFit = true;
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

  function ensureEnemyFormationFit(width: number): void {
    const widthChanged = Math.abs(width - lastFormationFitWidth) > 1;
    if (!needsFormationFit && !widthChanged) {
      return;
    }
    fitEnemyFormationToViewport(width);
    needsFormationFit = false;
    lastFormationFitWidth = width;
  }

  function spawnEnemyFirePattern(
    plan: { shots: number; pattern: "single" | "dual" | "burst"; speedScale: number },
    shooters: Enemy[],
    width: number
  ): number {
    if (shooters.length === 0) {
      return 0;
    }
    const spawned: Bullet[] = [];
    const baseSpeed = (280 + wave * 12) * plan.speedScale;
    const seed = Math.floor(stageElapsedMs / 180) + wave * 7 + shooters.length;
    const first = shooters[((seed % shooters.length) + shooters.length) % shooters.length];
    const second = shooters[((seed + Math.floor(shooters.length / 2) + 1) % shooters.length + shooters.length) % shooters.length];

    if (plan.pattern === "single") {
      spawned.push({ x: first.x, y: first.y + 12, vx: 0, vy: baseSpeed, damage: 1, enemy: true });
    } else if (plan.pattern === "dual") {
      spawned.push({ x: first.x, y: first.y + 12, vx: -42, vy: baseSpeed, damage: 1, enemy: true });
      spawned.push({ x: second.x, y: second.y + 12, vx: 42, vy: baseSpeed, damage: 1, enemy: true });
    } else {
      const vxSpread = [-120, -40, 40, 120];
      for (let i = 0; i < plan.shots; i += 1) {
        const vx = vxSpread[i % vxSpread.length] ?? 0;
        spawned.push({ x: first.x, y: first.y + 12, vx, vy: baseSpeed + Math.abs(vx) * 0.22, damage: 1, enemy: true });
      }
    }

    for (const bullet of spawned) {
      bullet.x = Math.max(20, Math.min(width - 20, bullet.x));
      bullets.push(bullet);
    }
    return spawned.length;
  }

  function spawnBossAttack(
    pattern: "sweep" | "volley" | "enrageBurst" | "verticalLaser" | "seekerSwarm",
    phase: 1 | 2 | 3,
    width: number,
    height: number
  ): number {
    const planned = planBossProjectiles({
      pattern,
      phase,
      width,
      height,
      bossX,
      bossY,
      playerX: playerX * width
    });
    const spawned: Bullet[] = planned.map((item) => ({
      x: item.x,
      y: item.y,
      vx: item.vx,
      vy: item.vy,
      damage: item.damage,
      enemy: true,
      kind: item.kind,
      steerStrength: item.kind === "seeker" ? (phase >= 3 ? 1.45 : 1.05) : undefined
    }));
    bullets.push(...spawned);
    return spawned.length;
  }

  return {
    id: "amp-invaders",
    update(dtMs, input, width, height) {
      if (dead || cleared) return;
      stageWidth = width;
      stageElapsedMs += dtMs;

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

      if (!inBoss) {
        ensureEnemyFormationFit(width);
      }

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
        score += 1;
        totalShotsFired += 1;
      }
      wasHoldingAction = input.actionHeld;
      if (!input.actionHeld) {
        chargeMs = 0;
      }

      if (!inBoss) {
        const alive = aliveEnemies();
        const minX = Math.min(...alive.map((enemy) => enemy.x));
        const maxX = Math.max(...alive.map((enemy) => enemy.x));
        const maxY = Math.max(...alive.map((enemy) => enemy.y));
        const invasionFloorY = getEnemyInvasionFloorY(height);
        const descentStep = computeEnemyDropDelta(maxY, 16, invasionFloorY);
        if (Number.isFinite(minX) && Number.isFinite(maxX)) {
          const edgePad = Math.max(20, Math.min(44, Math.floor(width * 0.08)));
          if (minX < edgePad && enemyDir < 0) {
            enemyDir = 1;
            if (descentStep > 0) {
              enemies.forEach((enemy) => {
                if (enemy.alive) {
                  enemy.y += descentStep;
                }
              });
            }
          } else if (maxX > width - edgePad && enemyDir > 0) {
            enemyDir = -1;
            if (descentStep > 0) {
              enemies.forEach((enemy) => {
                if (enemy.alive) {
                  enemy.y += descentStep;
                }
              });
            }
          }
        }

        enemies.forEach((enemy) => {
          if (!enemy.alive) return;
          enemy.x += enemyDir * enemySpeed * (dtMs / 1000);
        });
      } else {
        const bossState = bossDirector.getState();
        bossSpeed = bossState.phase === 1 ? 82 : bossState.phase === 2 ? 106 : 132;
        const bossPad = Math.max(96, width * 0.14);
        bossX += bossDir * bossSpeed * (dtMs / 1000);
        if (bossX < bossPad) {
          bossX = bossPad;
          bossDir = 1;
        } else if (bossX > width - bossPad) {
          bossX = width - bossPad;
          bossDir = -1;
        }
      }

      if (!inBoss && enemyFireCooldownMs <= 0) {
        const shooters = aliveEnemies();
        if (shooters.length > 0) {
          const plan = enemyDirector.computeFirePlan({
            wave,
            elapsedMs: stageElapsedMs,
            aliveEnemies: shooters.length
          });
          lastEnemyPattern = plan.pattern;
          const shotCount = spawnEnemyFirePattern(plan, shooters, width);
          totalEnemyShotsFired += shotCount;
          enemyFireCooldownMs = plan.cooldownMs;
        } else {
          enemyFireCooldownMs = 300;
        }
      } else if (inBoss) {
        const event = bossDirector.update(dtMs);
        if (event.attackFired && event.pattern && event.phase) {
          totalEnemyShotsFired += spawnBossAttack(event.pattern, event.phase, width, height);
        }
      }

      if (!inBoss && discoTimerMs <= 0 && !disco.active) {
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

      updateSpecials(specialsState, {
        dtMs,
        elapsedMs: stageElapsedMs,
        wave,
        width,
        height,
        bossActive: inBoss
      });
      lastSpecialKind = specialsState.lastSpawnKind;

      for (const bullet of bullets) {
        if (bullet.enemy && bullet.kind === "seeker") {
          const desiredVx = Math.max(-280, Math.min(280, (playerX * width - bullet.x) * 1.6));
          const steerBlend = Math.min(1, (dtMs / 180) * (bullet.steerStrength ?? 1));
          bullet.vx += (desiredVx - bullet.vx) * steerBlend;
        }
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
                score += enemy.type === "elite" ? 40 : enemy.type === "armored" ? 18 : 8;
                audio.trigger("pickup");
              }
              break;
            }
          }

          if (inBoss) {
            const inBossHitbox = Math.abs(bullet.x - bossX) < 66 && Math.abs(bullet.y - bossY) < 38;
            if (inBossHitbox) {
              bossDirector.applyDamage(Math.max(1, bullet.damage));
              bullet.y = -120;
              if (bossDirector.isDefeated() && !bossDefeatAwarded) {
                bossDefeatAwarded = true;
                score += 480;
                cleared = true;
              }
            }
          }

          if (disco.active && Math.abs(bullet.x - disco.x) < 24 && Math.abs(bullet.y - disco.y) < 16) {
            score += 120;
            disco.active = false;
            discoTimerMs = 10_000;
            audio.trigger("pickup");
            bullet.y = -100;
          }
        }
      }

      for (const special of specialsState.entities) {
        if (special.state !== "diving") {
          continue;
        }
        const hit = resolveEnemyBulletHit({
          bulletX: special.x,
          bulletY: special.y,
          width,
          height,
          playerXNorm: playerX,
          shields
        });
        if (hit.shieldIndex !== null) {
          const extra = special.kind === "shieldBreaker" ? 24 : 14;
          shields[hit.shieldIndex] = Math.max(0, shields[hit.shieldIndex] - extra);
          special.consumed = true;
        } else if (hit.playerHit) {
          lives -= 1;
          if (lives <= 0) {
            dead = true;
          }
          special.consumed = true;
        }
      }

      for (let i = bullets.length - 1; i >= 0; i -= 1) {
        if (bullets[i].y < -120 || bullets[i].y > height + 120) {
          bullets.splice(i, 1);
        }
      }

      if (!inBoss && aliveEnemies().length === 0) {
        if (shouldEnterBossOnWaveClear(wave, STAGE3_V2_DEFAULT_CONFIG.boss.entryWave)) {
          waveState = waveDirector.advanceOnWaveClear();
          wave = waveState.wave;
          genre = waveState.genre;
          spreadTier = waveState.spreadTier;
          nextUpgradeWave = waveState.nextUpgradeWave;
          inBoss = true;
          bossX = width * 0.5;
          bossY = 84;
          bossDir = 1;
          bossSpeed = 92;
          bossDirector.enter();
          specialsState.entities.length = 0;
          enemyFireCooldownMs = 420;
          score += 160;
        } else {
          waveState = waveDirector.advanceOnWaveClear();
          wave = waveState.wave;
          genre = waveState.genre;
          spreadTier = waveState.spreadTier;
          nextUpgradeWave = waveState.nextUpgradeWave;
          score += 70;
          enemies = spawnWave(wave);
          enemyDir = 1;
        }
      }

      // Stage 3 should be resolved by lives + bullet collisions, not by formation touching bottom.
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
        if (enemy.spriteVariant) {
          const sprite = ampEnemyImages[enemy.spriteVariant];
          if (sprite.complete && sprite.naturalWidth > 0 && sprite.naturalHeight > 0) {
            const spriteWidth = enemy.type === "elite" ? 52 : enemy.type === "armored" ? 48 : 44;
            const spriteHeight = enemy.type === "elite" ? 40 : enemy.type === "armored" ? 36 : 34;
            context.drawImage(sprite, ex - spriteWidth / 2, ey - spriteHeight / 2, spriteWidth, spriteHeight);
            return;
          }
        }
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

      for (const special of specialsState.entities) {
        if (special.state === "telegraph") {
          context.strokeStyle = withAlpha("#ffef86", 0.9);
          context.lineWidth = 2;
          context.beginPath();
          context.moveTo(special.x, 20);
          context.lineTo(special.x, height - 120);
          context.stroke();
          context.fillStyle = withAlpha("#ffef86", 0.92);
          context.fillRect(special.x - 9, 18, 18, 8);
          continue;
        }
        context.fillStyle = special.kind === "shieldBreaker" ? withAlpha("#ff8844", 0.95) : withAlpha("#ffd447", 0.95);
        context.beginPath();
        context.arc(special.x, special.y, special.kind === "shieldBreaker" ? 14 : 11, 0, Math.PI * 2);
        context.fill();
      }

      if (inBoss) {
        const bossState = bossDirector.getState();
        const canDrawBossSprite =
          ampWave4BossImage.complete && ampWave4BossImage.naturalWidth > 0 && ampWave4BossImage.naturalHeight > 0;
        if (canDrawBossSprite) {
          context.drawImage(ampWave4BossImage, bossX - 92, bossY - 58, 184, 118);
        } else {
          context.fillStyle = withAlpha("#1a1a24", 0.94);
          context.fillRect(bossX - 72, bossY - 24, 144, 48);
          context.strokeStyle = withAlpha("#ff7ce7", 0.8);
          context.lineWidth = 2;
          context.strokeRect(bossX - 72, bossY - 24, 144, 48);
        }
        context.fillStyle = withAlpha("#22ddff", 0.78);
        context.fillRect(bossX - 64, bossY - 16, 128 * (bossState.hp / bossState.maxHp), 8);
        context.fillStyle = withAlpha("#f7f7ff", 0.9);
        context.font = "12px monospace";
        context.fillText(`BOSS P${bossState.phase}`, bossX - 34, bossY + 18);
        if (bossState.telegraphActive) {
          if (bossState.telegraphPattern === "verticalLaser") {
            const columns = getBossLaserColumns({
              width,
              bossX,
              playerX: playerX * width,
              phase: bossState.phase
            });
            context.strokeStyle = withAlpha("#ff6a82", 0.9);
            context.lineWidth = 2;
            for (const x of columns) {
              context.beginPath();
              context.moveTo(x, 18);
              context.lineTo(x, height - 64);
              context.stroke();
            }
          } else if (bossState.telegraphPattern === "seekerSwarm") {
            context.strokeStyle = withAlpha("#ffc96f", 0.92);
            context.lineWidth = 2;
            const targetY = height - 78;
            const offsets = [-52, 0, 52];
            for (const offset of offsets) {
              context.beginPath();
              context.moveTo(bossX + offset, bossY + 24);
              context.lineTo(playerX * width + offset * 0.35, targetY);
              context.stroke();
            }
          } else {
            context.strokeStyle = withAlpha("#ff4a4a", 0.9);
            context.beginPath();
            context.moveTo(0, bossY + 36);
            context.lineTo(width, bossY + 36);
            context.stroke();
          }
        }
      }

      const bulletSpriteKeys = getBulletSpriteKeysForWaveLocal(wave);
      const playerBulletSprite = ampBulletImages[bulletSpriteKeys.player];
      const enemyBulletSprite = ampBulletImages[bulletSpriteKeys.enemy];
      const waveCycleForBulletSprites = getWaveCycleForSprites(wave);
      bullets.forEach((bullet) => {
        if (bullet.enemy && bullet.kind === "laser") {
          context.fillStyle = withAlpha("#ff547a", 0.45);
          context.fillRect(bullet.x - 3, bullet.y - 20, 6, 40);
          context.fillStyle = withAlpha("#ffe3ec", 0.92);
          context.fillRect(bullet.x - 1, bullet.y - 24, 2, 48);
          return;
        }
        if (bullet.enemy && bullet.kind === "seeker") {
          context.fillStyle = withAlpha("#ffb74d", 0.42);
          context.beginPath();
          context.arc(bullet.x, bullet.y, 8, 0, Math.PI * 2);
          context.fill();
          context.fillStyle = withAlpha("#ffdba8", 0.95);
          context.beginPath();
          context.arc(bullet.x, bullet.y, 4, 0, Math.PI * 2);
          context.fill();
          return;
        }
        const sprite = bullet.enemy ? enemyBulletSprite : playerBulletSprite;
        const canDrawBulletSprite = sprite.complete && sprite.naturalWidth > 0 && sprite.naturalHeight > 0;
        if (canDrawBulletSprite) {
          if (bullet.enemy && waveCycleForBulletSprites === 3) {
            context.fillStyle = withAlpha("#8be8ff", 0.34);
            context.beginPath();
            context.arc(bullet.x, bullet.y, 9, 0, Math.PI * 2);
            context.fill();
            context.strokeStyle = withAlpha("#d8fdff", 0.72);
            context.lineWidth = 1.5;
            context.beginPath();
            context.arc(bullet.x, bullet.y, 6.5, 0, Math.PI * 2);
            context.stroke();
          }
          const spriteHeight = bullet.enemy ? 20 : 26;
          const spriteWidth = bullet.enemy ? 14 : 16;
          context.drawImage(
            sprite,
            bullet.x - spriteWidth / 2,
            bullet.y - spriteHeight / 2,
            spriteWidth,
            spriteHeight
          );
          return;
        }

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
    isCleared() {
      return cleared;
    },
    getHudHint() {
      if (inBoss) {
        const boss = bossDirector.getState();
        return `BOSS PHASE ${boss.phase} • HP ${Math.max(0, Math.round(boss.hp))} • Lives ${lives}`;
      }
      const tierLabel = spreadTier === 1 ? "SINGLE" : spreadTier === 2 ? "DUAL" : spreadTier === 3 ? "TRIPLE" : "WIDE";
      return `Wave ${wave} • ${genre.toUpperCase()} • ${tierLabel} • Lives ${lives} • AUTO-FIRE`;
    },
    debugState() {
      const alive = aliveEnemies();
      const boss = bossDirector.getState();
      const enemyCenter =
        alive.length > 0
          ? alive.reduce((sum, enemy) => sum + enemy.x, 0) / alive.length
          : null;
      return {
        wave,
        genre,
        spreadTier,
        nextUpgradeWave,
        lives,
        totalEnemyShotsFired,
        lastEnemyPattern,
        totalSpecialSpawns: specialsState.totalSpawns,
        lastSpecialKind,
        activeSpecialCount: specialsState.entities.length,
        bossActive: inBoss,
        bossPhase: boss.phase,
        bossHp: boss.hp,
        bossTelegraph: boss.telegraphActive,
        bossTelegraphPattern: boss.telegraphPattern,
        playerX,
        controlTelemetry: {
          touchSteerActive,
          steerTargetX,
          steerError,
          steerMode
        },
        enemyMinY: alive.length ? Math.min(...alive.map((enemy) => enemy.y)) : null,
        enemyMaxY: alive.length ? Math.max(...alive.map((enemy) => enemy.y)) : null,
        enemyMinX: alive.length ? Math.min(...alive.map((enemy) => enemy.x)) : null,
        enemyMaxX: alive.length ? Math.max(...alive.map((enemy) => enemy.x)) : null,
        enemyCenterNorm: enemyCenter !== null ? enemyCenter / Math.max(1, stageWidth) : null,
        aliveEnemies: alive.length,
        totalShotsFired
      };
    },
    forceWaveClearForTest() {
      enemies.forEach((enemy) => {
        enemy.alive = false;
      });
    },
    forceBossDefeatForTest() {
      if (!inBoss) {
        return;
      }
      bossDirector.applyDamage(99_999);
      if (bossDirector.isDefeated()) {
        cleared = true;
      }
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
  root.style.setProperty("--font-display", `"${theme.typography.display}"`);
  root.style.setProperty("--font-body", `"${theme.typography.body}"`);
  root.style.setProperty("--font-mono", `"${theme.typography.mono}"`);
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
      --font-display: "Bebas Neue";
      --font-body: "Rajdhani";
      --font-mono: "JetBrains Mono";
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
      font-family: var(--font-body), "Rajdhani", sans-serif;
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
      grid-template-columns: 1fr auto;
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
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    #hud-time {
      display: flex;
      align-items: center;
      line-height: 1;
      font-family: var(--font-mono), "JetBrains Mono", "Consolas", monospace;
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.06em;
    }
    .hud-stage {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      line-height: 1;
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
    .card.attract {
      display: grid;
      gap: 10px;
      padding: 26px 24px 22px;
    }
    .card.compact {
      width: min(78vw, 420px);
    }
    .card h1, .card h2 {
      margin: 0 0 10px;
      font-family: var(--font-display), "Bebas Neue", "Impact", sans-serif;
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
      font-family: var(--font-mono), "JetBrains Mono", "Consolas", monospace;
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
    .results-actions {
      margin-top: 14px;
      gap: 10px;
    }
    .tight-results {
      display: grid;
      gap: 10px;
    }
    .submit-row {
      margin-top: 2px;
    }
    .submit-row .btn {
      width: min(100%, 260px);
    }
    .btn {
      border: 1px solid rgba(255, 255, 255, 0.25);
      background: #66179D;
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
      transition:
        transform 120ms ease,
        box-shadow 120ms ease,
        border-color 120ms ease,
        background-color 120ms ease,
        opacity 120ms ease,
        filter 120ms ease;
    }
    .btn.primary {
      background: #66179D;
      border-color: #d19ff0;
      box-shadow: 0 0 18px rgba(102, 23, 157, 0.58), inset 0 0 0 1px rgba(255, 255, 255, 0.12);
    }
    .btn.secondary {
      background: linear-gradient(180deg, rgba(102, 23, 157, 0.82), rgba(58, 16, 90, 0.92));
      border-color: rgba(209, 159, 240, 0.62);
      box-shadow: 0 0 10px rgba(102, 23, 157, 0.26);
    }
    .btn.tertiary {
      background: rgba(102, 23, 157, 0.32);
      border-color: rgba(209, 159, 240, 0.36);
      color: rgba(243, 244, 246, 0.88);
      box-shadow: none;
    }
    .btn.is-locked {
      cursor: default;
      filter: saturate(0.6);
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
    }
    .btn.is-busy {
      position: relative;
      border-color: #e1b8f8;
      box-shadow: 0 0 22px rgba(102, 23, 157, 0.7), inset 0 0 0 1px rgba(255, 255, 255, 0.15);
    }
    .btn:disabled {
      opacity: 0.82;
      transform: none;
    }
    .btn:disabled:not(.is-locked) {
      cursor: progress;
    }
    .btn:hover {
      transform: translateY(-1px);
      border-color: rgba(255, 255, 255, 0.58);
      background: #7526ac;
    }
    .btn:active {
      transform: translateY(0);
      box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.28);
    }
    .btn:focus-visible {
      outline: 2px solid color-mix(in srgb, var(--primary) 74%, white 26%);
      outline-offset: 2px;
      box-shadow: 0 0 0 4px color-mix(in srgb, var(--primary) 20%, transparent);
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
      font-size: 11px;
      text-shadow: 0 0 10px rgba(0, 230, 255, 0.22);
      min-width: 0;
      flex: 1;
    }
    .grace-indicator {
      align-self: end;
      width: fit-content;
      font-size: 10px;
      line-height: 1;
      letter-spacing: 0.14em;
      font-weight: 800;
      color: #ffe45a;
      text-shadow: 0 0 10px rgba(255, 228, 90, 0.8);
      animation: grace-blink 640ms steps(2, jump-none) infinite;
    }
    @keyframes grace-blink {
      0%, 49% {
        opacity: 1;
      }
      50%, 100% {
        opacity: 0.26;
      }
    }
    .lives-indicator {
      align-self: end;
      width: fit-content;
      font-size: 11px;
      line-height: 1;
      letter-spacing: 0.14em;
      color: #ff778f;
      text-shadow: 0 0 8px rgba(255, 119, 143, 0.48);
    }
    #hud-score {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .muted {
      opacity: 0.72;
      font-size: 12px;
    }
    .score-grid {
      display: grid;
      gap: 4px;
      margin: 0 auto 8px;
      width: min(100%, 300px);
      text-align: left;
    }
    .score-grid p {
      margin: 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 14px;
    }
    .score-grid strong {
      color: var(--primary);
      font-family: var(--font-mono), "JetBrains Mono", "Consolas", monospace;
    }
    .bonus-line {
      margin: -2px auto 0;
      width: fit-content;
      max-width: 100%;
      display: flex;
      justify-content: center;
      align-items: baseline;
      gap: 8px;
      font-size: 14px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      text-align: center;
    }
    .bonus-line strong {
      color: var(--primary);
      font-family: var(--font-mono), "JetBrains Mono", "Consolas", monospace;
      font-size: 18px;
    }
    .emoji-split-list {
      list-style: none;
      margin: 0 auto;
      padding: 0;
      width: min(100%, 270px);
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }
    .emoji-split-list li {
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 10px;
      background: rgba(10, 14, 28, 0.6);
      padding: 8px 6px 7px;
      display: grid;
      justify-items: center;
      gap: 4px;
    }
    .emoji-split-list span {
      font-size: 18px;
      line-height: 1;
    }
    .emoji-split-list strong {
      color: var(--primary);
      font-family: var(--font-mono), "JetBrains Mono", "Consolas", monospace;
      font-size: 13px;
    }
    .split-list {
      list-style: none;
      margin: 10px 0 0;
      padding: 0;
    }
    .split-list li {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      padding: 3px 0;
    }
    .split-list strong {
      color: var(--primary);
      font-family: var(--font-mono), "JetBrains Mono", "Consolas", monospace;
    }
    .initials-entry {
      margin: 2px auto 0;
      width: min(100%, 240px);
      display: grid;
      gap: 6px;
      text-align: left;
    }
    .initials-entry > span {
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      opacity: 0.86;
    }
    .initials-entry input {
      height: 42px;
      border-radius: 10px;
      border: 1px solid rgba(209, 159, 240, 0.58);
      background: rgba(9, 10, 22, 0.88);
      color: #f4f2fb;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 0.26em;
      font-size: 20px;
      font-family: var(--font-mono), "JetBrains Mono", "Consolas", monospace;
    }
    .initials-entry input:focus-visible {
      outline: 2px solid rgba(209, 159, 240, 0.8);
      outline-offset: 2px;
    }
    .initials-entry small {
      margin: 0;
      opacity: 0.7;
      font-size: 11px;
    }
    .error {
      margin: 0;
      color: #ff97be;
      font-size: 12px;
      letter-spacing: 0.02em;
    }
    .leaderboard-list {
      list-style: none;
      padding: 0;
      margin: 10px 0 0;
      text-align: left;
      max-height: min(42vh, 320px);
      overflow: auto;
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 10px;
      background: rgba(7, 8, 18, 0.42);
    }
    .leaderboard-row {
      padding: 7px 10px;
      margin: 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.12);
      font-size: 12px;
      font-family: var(--font-mono), "JetBrains Mono", "Consolas", monospace;
      letter-spacing: 0.03em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .leaderboard-row.is-you {
      background: rgba(23, 43, 70, 0.52);
      box-shadow: inset 3px 0 0 rgba(0, 229, 255, 0.7);
    }
    .leaderboard-row:last-child {
      border-bottom: 0;
    }
    .leaderboard-row.is-you span {
      color: #8ff7ff;
    }
    .attract .title-stack {
      display: grid;
      gap: 4px;
      margin: 0;
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
      margin: 0;
    }
    .stage-pill-row {
      margin-top: 2px;
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
    @media (max-width: 520px) {
      :root {
        --gutter: 6px;
        --hud-h: 42px;
        --rail-h: 48px;
      }
      .hud {
        gap: 4px;
        padding: 4px 8px;
      }
      .hud-item {
        font-size: 12px;
        letter-spacing: 0.02em;
      }
      #hud-time {
        letter-spacing: 0.04em;
      }
      .stage-meta {
        font-size: 10px;
      }
      .btn {
        min-width: 114px;
        padding: 8px 10px;
      }
      .card {
        width: min(95vw, 520px);
        padding: 14px;
      }
      .card.attract {
        gap: 8px;
        padding: 20px 16px 18px;
      }
    }
    @media (max-width: 389px) {
      .hud-item {
        font-size: 11px;
      }
      .stage-meta {
        font-size: 9px;
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
  stageElapsedMs: number;
  danger: boolean;
  snakeTelemetry: SnakeAudioTelemetry | null;
};

type AudioTrigger = "death" | "commit" | "submit" | "pickup" | "zone" | "guitarSolo";

type SnakeAudioTelemetry = {
  combo: number;
  snakeLength: number;
  graceActive: boolean;
};

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
  let guitarSoloBuffer: AudioBuffer | null = null;
  let guitarSoloLoad: Promise<void> | null = null;
  const snakeAudioMode: SnakeAudioMode = SNAKE_AUDIO_MODE;
  const snakeAudioDirector = createSnakeAudioDirector();
  let snakeAudioState: SnakeAudioState = snakeAudioDirector.getState();
  let snakeEnergyIndex = 0;
  let snakeScoreRate = 0;
  let snakeLastSampleAt = 0;
  let snakeLastScore = 0;
  let snakeLastCombo = 0;
  let snakeLastLength = 3;
  let snakeComboMilestoneAt = Number.NEGATIVE_INFINITY;
  let snakePickupEvents: number[] = [];

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

    if (!guitarSoloLoad) {
      guitarSoloLoad = loadOneShotBuffer(GUITAR_SOLO_SFX_URL).then((buffer) => {
        guitarSoloBuffer = buffer;
      });
    }
  }

  async function loadOneShotBuffer(url: string): Promise<AudioBuffer | null> {
    if (!audioContext) {
      return null;
    }
    try {
      const response = await fetch(url);
      if (!response.ok) {
        return null;
      }
      const arrayBuffer = await response.arrayBuffer();
      return await audioContext.decodeAudioData(arrayBuffer.slice(0));
    } catch {
      return null;
    }
  }

  type MusicProfile = {
    bpm: number;
    root: number;
    kick: number[];
    snare: number[];
    hat: number[];
    bass: Array<number | null>;
    chords: Array<[number, number, number] | null>;
    lead: Array<number | null>;
  };

  function snakeStateLayerFloor(state: SnakeAudioState): number {
    if (state === "intro") return 1;
    if (state === "build") return 2;
    if (state === "vibe") return 3;
    if (state === "hype") return 4;
    if (state === "drop") return 6;
    if (state === "breakdown") return 2;
    return 5;
  }

  function snakeV2Profile(state: SnakeAudioState): MusicProfile {
    if (state === "intro") {
      return {
        bpm: 118,
        root: 110,
        kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
        snare: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        hat: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
        bass: [0, null, null, null, null, null, 5, null, 0, null, null, null, null, null, 3, null],
        chords: [[0, 3, 7], null, null, null, null, null, null, null, [-2, 2, 5], null, null, null, null, null, null, null],
        lead: [null, null, null, null, 12, null, null, null, null, null, null, null, 14, null, null, null]
      };
    }
    if (state === "build") {
      return {
        bpm: 118,
        root: 110,
        kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
        snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        hat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
        bass: [0, null, 0, null, 3, null, 5, null, 0, null, 0, null, 7, null, 5, null],
        chords: [[0, 3, 7], null, null, null, [0, 3, 8], null, null, null, [-2, 2, 5], null, null, null, [0, 3, 7], null, null, null],
        lead: [null, null, 12, null, null, null, null, null, 14, null, null, null, null, 14, null, null]
      };
    }
    if (state === "vibe") {
      return {
        bpm: 118,
        root: 110,
        kick: [1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 1, 0],
        snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        hat: [1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1],
        bass: [0, null, 0, null, 3, null, 5, null, 0, null, 0, null, 7, null, 5, null],
        chords: [[0, 3, 7], null, null, null, [0, 3, 8], null, null, null, [-2, 2, 5], null, null, null, [0, 3, 7], null, null, null],
        lead: [null, 12, null, null, 14, null, null, 15, null, null, 17, null, null, 15, null, null]
      };
    }
    if (state === "hype") {
      return {
        bpm: 118,
        root: 110,
        kick: [1, 0, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 0, 1, 1],
        snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0],
        hat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        bass: [0, null, 0, 5, 3, null, 5, null, 0, null, 0, 7, 7, null, 5, null],
        chords: [[0, 3, 7], null, null, null, [0, 3, 8], null, null, null, [-2, 2, 5], null, null, null, [3, 7, 10], null, null, null],
        lead: [12, null, null, 14, null, null, 15, null, 17, null, null, 15, null, 14, null, 12]
      };
    }
    if (state === "drop") {
      return {
        bpm: 118,
        root: 110,
        kick: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
        snare: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
        hat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        bass: [0, 0, 7, 0, 5, 0, 7, 0, 0, 0, 7, 0, 5, 0, 3, 0],
        chords: [[0, 3, 7], null, [0, 3, 8], null, [-2, 2, 5], null, [0, 3, 7], null, [3, 7, 10], null, [0, 3, 8], null, [-2, 2, 5], null, [0, 3, 7], null],
        lead: [12, null, 15, null, 17, null, 19, null, 17, null, 15, null, 14, null, 12, null]
      };
    }
    if (state === "breakdown") {
      return {
        bpm: 118,
        root: 110,
        kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
        snare: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
        hat: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
        bass: [0, null, null, null, null, null, 5, null, 0, null, null, null, null, null, 3, null],
        chords: [[-2, 2, 5], null, null, null, null, null, null, null, [0, 3, 7], null, null, null, null, null, null, null],
        lead: [null, null, 12, null, null, null, null, null, null, null, 10, null, null, null, null, null]
      };
    }
    return {
      bpm: 118,
      root: 110,
      kick: [1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0],
      snare: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
      hat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      bass: [0, null, 0, null, 3, null, 5, null, 0, null, 0, null, 7, null, 5, null],
      chords: [[0, 3, 7], null, null, null, [0, 3, 8], null, null, null, [-2, 2, 5], null, null, null, [0, 3, 7], null, null, null],
      lead: [12, null, null, 14, null, null, 15, null, 17, null, null, 15, null, 14, null, 12]
    };
  }

  function legacyStageProfile(stage: StageId): MusicProfile {
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

  function stageProfile(stage: StageId): MusicProfile {
    if (stage === "rhythm-serpent" && snakeAudioMode === "v2") {
      return snakeV2Profile(snakeAudioState);
    }
    return legacyStageProfile(stage);
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

  function triggerSnakeHypeRiser(now: number): void {
    if (!audioContext || !sfxGain || !noiseBuffer) return;
    const src = audioContext.createBufferSource();
    src.buffer = noiseBuffer;
    const hp = audioContext.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.setValueAtTime(900, now);
    hp.frequency.exponentialRampToValueAtTime(5200, now + 0.5);
    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.32);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.52);
    src.connect(hp).connect(gain).connect(sfxGain);
    src.start(now);
    src.stop(now + 0.54);
  }

  function triggerSnakeDropImpact(now: number): void {
    if (!audioContext || !sfxGain || !drumGain || !noiseBuffer) return;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.22);
    scheduleEnvelope(gain, now, 0.002, 0.03, 0.22, 0.24);
    osc.connect(gain).connect(drumGain);
    osc.start(now);
    osc.stop(now + 0.26);

    const noise = audioContext.createBufferSource();
    noise.buffer = noiseBuffer;
    const bp = audioContext.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(1400, now);
    const noiseGain = audioContext.createGain();
    scheduleEnvelope(noiseGain, now, 0.001, 0.02, 0.14, 0.1);
    noise.connect(bp).connect(noiseGain).connect(sfxGain);
    noise.start(now);
    noise.stop(now + 0.2);
  }

  function triggerSnakeFlowLift(now: number): void {
    if (!audioContext || !sfxGain) return;
    const base = 329.63;
    for (const [idx, semi] of [0, 4, 7, 12].entries()) {
      const t = now + idx * 0.035;
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(toFreq(base, semi), t);
      scheduleEnvelope(gain, t, 0.002, 0.02, 0.12, 0.11);
      osc.connect(gain).connect(sfxGain);
      osc.start(t);
      osc.stop(t + 0.16);
    }
  }

  function scheduleStep(input: AudioUpdateInput): void {
    if (!audioContext || !musicGain || !drumGain || !sfxGain || !synthFilter) return;
    const stage = input.stage;
    const profile = stageProfile(stage);
    const step = step16 % 16;
    const time = nextStepAt;
    let dynamic = clamp(0.18, 0.22 + input.score / 2200 + (input.danger ? 0.1 : 0), 1);
    let layer = clamp(1, 1 + Math.floor(input.score / 260), 6);

    if (stage === "rhythm-serpent" && snakeAudioMode === "v2") {
      const pickupDensity = clamp(0, snakePickupEvents.length / 8, 1);
      const advance = snakeAudioDirector.advance({
        step16,
        nowSeconds: time,
        sample: {
          score: input.score,
          combo: snakeLastCombo,
          snakeLength: snakeLastLength,
          scoreRate: snakeScoreRate,
          pickupDensity,
          elapsedSeconds: Math.max(0, input.stageElapsedMs / 1000),
          danger: input.danger,
          comboMilestoneRecent: time - snakeComboMilestoneAt <= 10,
          hasPositiveMomentum: snakeScoreRate >= 18
        }
      });
      snakeAudioState = advance.state;
      snakeEnergyIndex = advance.energyIndex;

      if (advance.transitionEvent === "enter-hype") {
        triggerSnakeHypeRiser(time);
      } else if (advance.transitionEvent === "enter-drop") {
        triggerSnakeDropImpact(time);
      } else if (advance.transitionEvent === "enter-flow") {
        triggerSnakeFlowLift(time);
      }

      const stateBoost =
        snakeAudioState === "drop"
          ? 0.24
          : snakeAudioState === "hype"
          ? 0.12
          : snakeAudioState === "flow"
          ? 0.08
          : snakeAudioState === "breakdown"
          ? -0.1
          : 0;
      dynamic = clamp(0.18, dynamic + stateBoost, 1);
      const layerFloor = snakeStateLayerFloor(snakeAudioState);
      layer = Math.max(layer, layerFloor);
      if (snakeAudioState === "breakdown") {
        layer = Math.min(layer, 3);
      }
    } else {
      snakeAudioState = snakeAudioDirector.getState();
      snakeEnergyIndex = 0;
    }
    energy = dynamic;

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
      clamp(420, 900 + layer * 320 + dynamic * 600 + (stage === "amp-invaders" ? 380 : 0) + (input.danger ? 700 : 0), 8200),
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
    if (currentStage === "rhythm-serpent") {
      snakePickupEvents.push(now);
      snakePickupEvents = snakePickupEvents.filter((stamp) => now - stamp <= 10);
    }
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

  function triggerGuitarSolo(now: number): void {
    if (!audioContext || !sfxGain) return;
    const ctx = audioContext;
    if (guitarSoloBuffer) {
      const source = ctx.createBufferSource();
      source.buffer = guitarSoloBuffer;
      source.playbackRate.setValueAtTime(1, now);
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(1800, now);
      filter.Q.value = 0.6;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.36, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.22, now + Math.max(0.2, source.buffer.duration - 0.12));
      gain.gain.exponentialRampToValueAtTime(0.001, now + source.buffer.duration);
      source.connect(filter).connect(gain).connect(sfxGain);
      source.start(now);
      return;
    }

    // Fallback riff if sample generation has not run yet.
    const base = 329.63;
    const pattern = [0, 3, 7, 10, 12, 10, 7, 3, 0, 5, 7, 10];
    const stepDur = 0.125;
    const steps = Math.round(3 / stepDur);
    for (let i = 0; i < steps; i += 1) {
      const t = now + i * stepDur;
      const semitone = pattern[i % pattern.length] ?? 0;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = i % 3 === 0 ? "sawtooth" : "triangle";
      const freq = toFreq(base, semitone);
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * (i % 4 === 0 ? 1.04 : 1.01), t + 0.09);
      scheduleEnvelope(gain, t, 0.0015, 0.03, 0.08, i % 4 === 0 ? 0.16 : 0.11);
      osc.connect(gain).connect(sfxGain);
      osc.start(t);
      osc.stop(t + 0.12);
    }
  }

  function scheduleTransport(input: AudioUpdateInput): void {
    if (!audioContext) return;
    const profile = stageProfile(input.stage);
    const stepDur = 60 / profile.bpm / 4;
    while (nextStepAt < audioContext.currentTime + 0.22) {
      scheduleStep(input);
      nextStepAt += stepDur;
      step16 += 1;
    }
  }

  function resetSnakeRuntime(now: number, score: number): void {
    snakeAudioDirector.reset();
    snakeAudioState = snakeAudioDirector.getState();
    snakeEnergyIndex = 0;
    snakeScoreRate = 0;
    snakeLastSampleAt = now;
    snakeLastScore = score;
    snakeLastCombo = 0;
    snakeLastLength = 3;
    snakeComboMilestoneAt = Number.NEGATIVE_INFINITY;
    snakePickupEvents = [];
  }

  return {
    start(): void {
      ensureStarted();
    },
    resetStage(stage: StageId): void {
      currentStage = stage;
      step16 = 0;
      prevDanger = false;
      const now = audioContext?.currentTime ?? 0;
      nextStepAt = now + 0.03;
      resetSnakeRuntime(now, 0);
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
      if (kind === "guitarSolo") {
        triggerGuitarSolo(now);
        return;
      }
      triggerSubmit(now);
    },
    debugState() {
      return {
        snakeAudioMode,
        snakeAudioState: snakeAudioMode === "v2" ? snakeAudioState : "legacy",
        snakeEnergyIndex: snakeAudioMode === "v2" ? Number(snakeEnergyIndex.toFixed(3)) : null,
        snakeScoreRate: snakeAudioMode === "v2" ? Number(snakeScoreRate.toFixed(2)) : null
      };
    },
    update(input: AudioUpdateInput): void {
      if (!started || !audioContext || !masterGain || !musicGain || !duckGain || !drumGain || !sfxGain || !synthFilter) return;
      const now = audioContext.currentTime;

      if (audioContext.state === "suspended") {
        void audioContext.resume();
      }

      const targetMaster = input.active ? 0.38 : 0.0001;
      masterGain.gain.setTargetAtTime(targetMaster, now, 0.12);
      const snakeMusicBoost =
        input.stage === "rhythm-serpent" && snakeAudioMode === "v2"
          ? snakeAudioState === "drop"
            ? 0.08
            : snakeAudioState === "flow"
            ? 0.05
            : snakeAudioState === "breakdown"
            ? -0.06
            : 0
          : 0;
      const baseMusicLevel = clamp(0.42, 0.56 + input.score / 2600 + (input.danger ? 0.06 : 0) + snakeMusicBoost, 0.9);
      musicGain.gain.setTargetAtTime(input.active ? baseMusicLevel : 0.0001, now, 0.11);
      drumGain.gain.setTargetAtTime(input.active ? 0.84 : 0.0001, now, 0.08);
      sfxGain.gain.setTargetAtTime(input.active ? 0.5 : 0.0001, now, 0.08);
      duckGain.gain.setTargetAtTime(1, now, 0.09);
      synthFilter.frequency.setTargetAtTime(1200 + energy * 2200 + (input.stage === "amp-invaders" ? 500 : 0), now, 0.07);

      if (currentStage !== input.stage) {
        currentStage = input.stage;
        nextStepAt = now + 0.03;
        step16 = 0;
        resetSnakeRuntime(now, input.score);
      }

      if (input.stage === "rhythm-serpent") {
        const comboNow = Math.max(0, input.snakeTelemetry?.combo ?? snakeLastCombo);
        if (snakeLastCombo < 5 && comboNow >= 5) {
          snakeComboMilestoneAt = now;
        }
        snakeLastCombo = comboNow;
        snakeLastLength = Math.max(3, input.snakeTelemetry?.snakeLength ?? snakeLastLength);
        if (snakeLastSampleAt <= 0) {
          snakeLastSampleAt = now;
          snakeLastScore = input.score;
        }
        const dtSeconds = Math.max(0.001, now - snakeLastSampleAt);
        const scoreDelta = Math.max(0, input.score - snakeLastScore);
        const instantScoreRate = scoreDelta / dtSeconds;
        snakeScoreRate = snakeScoreRate * 0.72 + instantScoreRate * 0.28;
        snakeLastSampleAt = now;
        snakeLastScore = input.score;
        snakePickupEvents = snakePickupEvents.filter((stamp) => now - stamp <= 10);
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
  const summary = finalScoreSummary();
  return JSON.stringify({
    mode,
    stageIndex: flow.currentStageIndex,
    stageName: STAGE_NAMES[flow.currentStageIndex] ?? "complete",
    runMsLeft: runMsLeft(),
    canCommit: canCommitNow(flow),
    bankedRaw: [...flow.bankedRaw],
    bankedScores: [...flow.bankedTri],
    bankedTri: [...flow.bankedTri],
    stageRaw: Math.round(flow.stageRaw),
    stageScore: Math.round(flow.stageRaw),
    totalScore: totalBankedScore(),
    timeBonus: summary.timeBonus,
    finalScore: summary.totalScore,
    totalTri: totalBankedScore(),
    theme: activeTheme.id,
    stageState: stage.debugState(),
    audioState: audio.debugState?.()
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
    completeTransition();
    render();
    return;
  }
  if (mode === "playing" || mode === "deathChoice") {
    flow.commitUnlockedByStage[flow.currentStageIndex] = true;
    commitCurrentStage(true);
    render();
  }
}

function commitStageWithTransitionForTest(): void {
  if (mode === "boot") {
    startRun();
    render();
    return;
  }
  if (mode === "playing" || mode === "deathChoice") {
    flow.commitUnlockedByStage[flow.currentStageIndex] = true;
    commitCurrentStage(false);
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

function advanceAmpBossDefeatForTest(): void {
  if (mode !== "playing" || stage.id !== "amp-invaders") {
    return;
  }
  stage.forceBossDefeatForTest?.();
  tick(0);
  render();
}

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => void;
    advanceTriathlonForTest?: () => void;
    commitStageWithTransitionForTest?: () => void;
    advanceAmpWaveForTest?: () => void;
    advanceAmpBossDefeatForTest?: () => void;
  }
}

window.render_game_to_text = renderGameToText;
window.advanceTime = advanceTime;
window.advanceTriathlonForTest = advanceTriathlonForTest;
window.commitStageWithTransitionForTest = commitStageWithTransitionForTest;
window.advanceAmpWaveForTest = advanceAmpWaveForTest;
window.advanceAmpBossDefeatForTest = advanceAmpBossDefeatForTest;

// Keep the triathlon rules module hot in runtime for consistency checks.
computeStageOptions({ elapsedMs: 0, stageEnded: false });
