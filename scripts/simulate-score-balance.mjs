#!/usr/bin/env node
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const DEFAULT_URL = "http://127.0.0.1:4173";
const DEFAULT_RUNS = 12;
const DEFAULT_STEP_MS = 220;

const PROFILE_PRESETS = {
  balanced: {
    stageWeights: [1, 1, 1],
    maxRetries: [1, 1, 1],
    retryThresholdRaw: [220, 320, 520],
    snakeTargetBias: 0.7,
    snakeMistakeChance: 0.08,
    pacTurnChance: 0.32,
    pacMistakeChance: 0.12,
    ampMoveChance: 0.8,
    ampMistakeChance: 0.08,
    ampChargeChance: 0.06
  },
  casual: {
    stageWeights: [0.9, 0.9, 0.9],
    maxRetries: [0, 0, 0],
    retryThresholdRaw: [180, 260, 420],
    snakeTargetBias: 0.5,
    snakeMistakeChance: 0.2,
    pacTurnChance: 0.25,
    pacMistakeChance: 0.2,
    ampMoveChance: 0.6,
    ampMistakeChance: 0.2,
    ampChargeChance: 0.03
  },
  "snake-specialist": {
    stageWeights: [1.35, 0.85, 0.8],
    maxRetries: [2, 1, 0],
    retryThresholdRaw: [320, 260, 420],
    snakeTargetBias: 0.9,
    snakeMistakeChance: 0.04,
    pacTurnChance: 0.28,
    pacMistakeChance: 0.16,
    ampMoveChance: 0.65,
    ampMistakeChance: 0.14,
    ampChargeChance: 0.04
  },
  "pac-specialist": {
    stageWeights: [0.85, 1.35, 0.8],
    maxRetries: [1, 2, 0],
    retryThresholdRaw: [220, 420, 420],
    snakeTargetBias: 0.62,
    snakeMistakeChance: 0.14,
    pacTurnChance: 0.48,
    pacMistakeChance: 0.05,
    ampMoveChance: 0.68,
    ampMistakeChance: 0.14,
    ampChargeChance: 0.05
  },
  "amp-specialist": {
    stageWeights: [0.85, 0.8, 1.35],
    maxRetries: [0, 1, 2],
    retryThresholdRaw: [180, 260, 760],
    snakeTargetBias: 0.62,
    snakeMistakeChance: 0.14,
    pacTurnChance: 0.28,
    pacMistakeChance: 0.16,
    ampMoveChance: 0.95,
    ampMistakeChance: 0.04,
    ampChargeChance: 0.12
  }
};

const KEY_BY_DIR = {
  left: "ArrowLeft",
  right: "ArrowRight",
  up: "ArrowUp",
  down: "ArrowDown"
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = args.url ?? DEFAULT_URL;
  const runs = toInt(args.runs, DEFAULT_RUNS);
  const runMinutes = toNumber(args["run-minutes"], 9);
  const stepMs = toInt(args["step-ms"], DEFAULT_STEP_MS);
  const seed = toInt(args.seed, 1337);
  const profiles = resolveProfiles(args);
  const outPath = args.out ?? defaultOutputPath();

  if (profiles.length === 0) {
    throw new Error("No valid profile selected. Use --profile or --profiles.");
  }

  const browser = await chromium.launch({ headless: true });
  const records = [];

  try {
    for (const profileName of profiles) {
      for (let i = 0; i < runs; i += 1) {
        const runSeed = seed + i * 17 + hashString(profileName);
        const record = await simulateRun({
          browser,
          baseUrl: withRunMinutes(url, runMinutes),
          runMinutes,
          profileName,
          profile: PROFILE_PRESETS[profileName],
          runIndex: i,
          seed: runSeed,
          stepMs
        });
        records.push(record);
        process.stdout.write(`sim ${profileName} #${i + 1}/${runs} totalTri=${record.totalTri}\n`);
      }
    }
  } finally {
    await browser.close();
  }

  const payload = {
    createdAt: new Date().toISOString(),
    config: {
      url,
      runsPerProfile: runs,
      runMinutes,
      stepMs,
      seed,
      profiles
    },
    summary: summarizeRecords(records),
    records
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
  process.stdout.write(`saved ${outPath}\n`);
}

async function simulateRun({ browser, baseUrl, runMinutes, profileName, profile, runIndex, seed, stepMs }) {
  const rng = mulberry32(seed);
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  try {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => typeof window.render_game_to_text === "function");

    // Starts run from boot, continues transitions, and banks stage in death-choice mode.
    await page.evaluate(() => window.advanceTriathlonForTest?.());

    const firstState = await readState(page);
    const runTotalMs = Math.max(1, Number(firstState.runMsLeft ?? Math.round(runMinutes * 60_000)));
    const stageTargets = buildStageTargets(runTotalMs, profile.stageWeights, rng);

    let activeKeys = new Set();
    let stageStartMsLeft = new Map();
    let prevBankedTri = [0, 0, 0];
    const retriesUsed = [0, 0, 0];
    const bankEvents = [];

    for (let safety = 0; safety < 6000; safety += 1) {
      const state = await readState(page);
      const mode = state.mode;
      const stageIndex = Number(state.stageIndex ?? 0);
      const bankedTri = Array.isArray(state.bankedTri) ? state.bankedTri : [0, 0, 0];
      const bankedRaw = Array.isArray(state.bankedRaw) ? state.bankedRaw : [0, 0, 0];

      for (let i = 0; i < 3; i += 1) {
        if ((bankedTri[i] ?? 0) !== (prevBankedTri[i] ?? 0)) {
          bankEvents.push({
            stageIndex: i,
            tri: Math.round(bankedTri[i] ?? 0),
            raw: Math.round(bankedRaw[i] ?? 0),
            runMsLeft: Math.round(Number(state.runMsLeft ?? 0))
          });
        }
      }
      prevBankedTri = [...bankedTri];

      if (mode === "results") {
        await syncKeys(page, activeKeys, new Set());
        const baseScore = Math.round(Number(state.totalScore ?? state.totalTri ?? 0));
        const finalScore = Math.round(Number(state.finalScore ?? baseScore));
        const endedByClock = Number(state.runMsLeft ?? 0) <= 0;

        return {
          profile: profileName,
          runIndex,
          seed,
          runMinutes,
          totalTri: baseScore,
          totalScore: baseScore,
          finalScore,
          endedByClock,
          bankedRaw: bankedRaw.map((n) => Math.round(Number(n ?? 0))),
          bankedTri: bankedTri.map((n) => Math.round(Number(n ?? 0))),
          bankEvents
        };
      }

      if (mode === "transition") {
        await syncKeys(page, activeKeys, new Set());
        await page.evaluate(() => window.advanceTriathlonForTest?.());
        continue;
      }

      if (mode === "deathPause") {
        await syncKeys(page, activeKeys, new Set());
        await advance(page, 1000);
        continue;
      }

      if (mode === "deathChoice") {
        await syncKeys(page, activeKeys, new Set());
        const retryAllowed = profile.maxRetries?.[stageIndex] ?? 0;
        const retryThreshold = profile.retryThresholdRaw?.[stageIndex] ?? 0;
        const stageRaw = Number(state.stageRaw ?? 0);
        const runMsLeft = Number(state.runMsLeft ?? 0);
        if (retriesUsed[stageIndex] < retryAllowed && stageRaw < retryThreshold && runMsLeft > 90_000) {
          retriesUsed[stageIndex] += 1;
          await page.keyboard.press("r");
          continue;
        }
        await page.evaluate(() => window.advanceTriathlonForTest?.());
        continue;
      }

      if (mode !== "playing") {
        await syncKeys(page, activeKeys, new Set());
        await advance(page, stepMs);
        continue;
      }

      if (!stageStartMsLeft.has(stageIndex)) {
        stageStartMsLeft.set(stageIndex, Number(state.runMsLeft ?? runTotalMs));
      }
      const elapsedInStage = Number(stageStartMsLeft.get(stageIndex) ?? runTotalMs) - Number(state.runMsLeft ?? runTotalMs);
      const targetMs = stageTargets[stageIndex] ?? 75_000;
      if (state.canCommit && elapsedInStage >= targetMs) {
        await syncKeys(page, activeKeys, new Set());
        await page.evaluate(() => window.advanceTriathlonForTest?.());
        continue;
      }

      const desiredKeys = chooseKeysForState(state, profile, rng);
      await syncKeys(page, activeKeys, desiredKeys);
      await advance(page, stepMs);
    }

    throw new Error("Simulation exceeded safety loop budget");
  } finally {
    await context.close();
  }
}

function chooseKeysForState(state, profile, rng) {
  const stageName = String(state.stageName ?? "").toLowerCase();
  if (stageName.includes("serpent")) {
    return chooseSnakeKeys(state, profile, rng);
  }
  if (stageName.includes("pac")) {
    return choosePacKeys(state, profile, rng);
  }
  if (stageName.includes("amp")) {
    return chooseAmpKeys(state, profile, rng);
  }
  return new Set();
}

function chooseSnakeKeys(state, profile, rng) {
  const s = state.stageState ?? {};
  const current = s.currentDir ?? "right";
  const player = s.playerHead;
  const food = s.food;

  let nextDir = current;
  if (food && player && rng() < profile.snakeTargetBias) {
    const dx = Number(food.x ?? 0) - Number(player.x ?? 0);
    const dy = Number(food.y ?? 0) - Number(player.y ?? 0);
    if (Math.abs(dx) >= Math.abs(dy)) {
      nextDir = dx >= 0 ? "right" : "left";
    } else {
      nextDir = dy >= 0 ? "down" : "up";
    }
    if (isOpposite(nextDir, current)) {
      nextDir = dy >= 0 ? "down" : "up";
      if (isOpposite(nextDir, current)) {
        nextDir = current;
      }
    }
  } else if (rng() < 0.25) {
    nextDir = randomDir(rng);
  }

  if (rng() < profile.snakeMistakeChance) {
    nextDir = randomDir(rng);
  }

  return new Set([KEY_BY_DIR[nextDir] ?? "ArrowRight"]);
}

function choosePacKeys(state, profile, rng) {
  const s = state.stageState ?? {};
  const current = s.playerWant ?? s.playerDir ?? "right";
  let nextDir = current;

  const guards = Array.isArray(s.guards) ? s.guards : [];
  const player = s.player;
  const frightMs = Number(s.frightMs ?? 0);

  if (player && guards.length > 0 && frightMs <= 0 && rng() < 0.6) {
    let nearest = null;
    let nearestDist = Number.POSITIVE_INFINITY;
    for (const guard of guards) {
      const dist = Math.abs(Number(guard.x ?? 0) - Number(player.x ?? 0)) + Math.abs(Number(guard.y ?? 0) - Number(player.y ?? 0));
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = guard;
      }
    }
    if (nearest) {
      const dx = Number(player.x ?? 0) - Number(nearest.x ?? 0);
      const dy = Number(player.y ?? 0) - Number(nearest.y ?? 0);
      if (Math.abs(dx) >= Math.abs(dy)) {
        nextDir = dx >= 0 ? "right" : "left";
      } else {
        nextDir = dy >= 0 ? "down" : "up";
      }
    }
  }

  if (rng() < profile.pacTurnChance) {
    nextDir = randomDir(rng);
  }
  if (rng() < profile.pacMistakeChance) {
    nextDir = randomDir(rng);
  }

  return new Set([KEY_BY_DIR[nextDir] ?? "ArrowRight"]);
}

function chooseAmpKeys(state, profile, rng) {
  const s = state.stageState ?? {};
  const keys = new Set();

  if (rng() < profile.ampMoveChance) {
    const center = Number(s.enemyCenterNorm ?? 0.5);
    const playerX = Number(s.playerX ?? 0.5);
    if (center > playerX + 0.035) {
      keys.add("ArrowRight");
    } else if (center < playerX - 0.035) {
      keys.add("ArrowLeft");
    } else if (rng() < 0.5) {
      keys.add(rng() < 0.5 ? "ArrowLeft" : "ArrowRight");
    }
  }

  if (rng() < profile.ampChargeChance) {
    keys.add("Space");
  }

  if (rng() < profile.ampMistakeChance) {
    keys.delete("ArrowLeft");
    keys.delete("ArrowRight");
  }

  return keys;
}

function isOpposite(a, b) {
  return (
    (a === "left" && b === "right") ||
    (a === "right" && b === "left") ||
    (a === "up" && b === "down") ||
    (a === "down" && b === "up")
  );
}

function randomDir(rng) {
  const dirs = ["left", "right", "up", "down"];
  return dirs[Math.floor(rng() * dirs.length)] ?? "right";
}

async function syncKeys(page, active, desired) {
  for (const key of [...active]) {
    if (!desired.has(key)) {
      await page.keyboard.up(key);
      active.delete(key);
    }
  }

  for (const key of desired) {
    if (!active.has(key)) {
      await page.keyboard.down(key);
      active.add(key);
    }
  }
}

async function advance(page, ms) {
  await withContextRetry(page, () =>
    page.evaluate((stepMs) => {
      window.advanceTime?.(stepMs);
    }, ms)
  );
}

async function readState(page) {
  return withContextRetry(page, () =>
    page.evaluate(() => {
      const raw = window.render_game_to_text?.() ?? "{}";
      try {
        return JSON.parse(raw);
      } catch {
        return {};
      }
    })
  );
}

async function withContextRetry(page, task) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      const message = String(error instanceof Error ? error.message : error);
      if (!message.includes("Execution context was destroyed") || attempt === 1) {
        throw error;
      }
      await page.waitForLoadState("domcontentloaded");
    }
  }
  return {};
}

function buildStageTargets(runTotalMs, weights, rng) {
  const normalized = normalizeWeights(weights);
  const base = runTotalMs * 0.82;
  return normalized.map((weight) => {
    const jitter = 0.92 + rng() * 0.16;
    const target = Math.max(62_000, Math.round(base * weight * jitter));
    return target;
  });
}

function normalizeWeights(weights) {
  const safe = Array.isArray(weights) && weights.length === 3 ? weights : [1, 1, 1];
  const sum = Math.max(0.0001, safe.reduce((a, b) => a + Math.max(0.1, Number(b)), 0));
  return safe.map((w) => Math.max(0.1, Number(w)) / sum);
}

function summarizeRecords(records) {
  const byProfile = {};
  for (const record of records) {
    const key = record.profile;
    byProfile[key] ??= [];
    byProfile[key].push(record);
  }

  const summary = {};
  for (const [profile, list] of Object.entries(byProfile)) {
    const baseTotals = list.map((r) => r.totalScore ?? r.totalTri);
    const finalTotals = list.map((r) => r.finalScore ?? r.totalTri);
    const stageRaw = [0, 1, 2].map((idx) => list.map((r) => Number(r.bankedRaw[idx] ?? 0)));
    const stageTri = [0, 1, 2].map((idx) => list.map((r) => Number(r.bankedTri[idx] ?? 0)));

    summary[profile] = {
      runs: list.length,
      baseScore: stats(baseTotals),
      finalScore: stats(finalTotals),
      endedByClockRate: round(list.filter((r) => r.endedByClock).length / Math.max(1, list.length), 4),
      stageRawAvg: stageRaw.map((vals) => round(mean(vals), 2)),
      stageTriAvg: stageTri.map((vals) => round(mean(vals), 2)),
      stageTriShareAvg: [0, 1, 2].map((idx) => {
        const shares = list.map((r) => {
          const total = Math.max(1, Number(r.totalScore ?? r.totalTri));
          return Number(r.bankedTri[idx] ?? 0) / total;
        });
        return round(mean(shares), 4);
      })
    };
  }

  return summary;
}

function stats(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    mean: round(mean(values), 2),
    min: sorted[0] ?? 0,
    p50: percentile(sorted, 0.5),
    p90: percentile(sorted, 0.9),
    max: sorted[sorted.length - 1] ?? 0
  };
}

function percentile(sortedValues, p) {
  if (sortedValues.length === 0) return 0;
  const idx = Math.min(sortedValues.length - 1, Math.max(0, Math.floor((sortedValues.length - 1) * p)));
  return sortedValues[idx] ?? 0;
}

function mean(values) {
  if (values.length === 0) return 0;
  const total = values.reduce((sum, value) => sum + Number(value || 0), 0);
  return total / values.length;
}

function round(value, places) {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

function resolveProfiles(args) {
  const requested = args.profiles
    ? String(args.profiles)
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    : args.profile
    ? [String(args.profile)]
    : ["balanced"];

  return requested.filter((name) => PROFILE_PRESETS[name]);
}

function withRunMinutes(url, runMinutes) {
  const parsed = new URL(url);
  parsed.searchParams.set("runMinutes", String(runMinutes));
  return parsed.toString();
}

function defaultOutputPath() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join("output", "simulations", `score-balance-${stamp}.json`);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      args[key] = true;
      continue;
    }
    args[key] = value;
    i += 1;
  }
  return args;
}

function toInt(value, fallback) {
  const n = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) ? n : fallback;
}

function toNumber(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function hashString(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function mulberry32(a) {
  return function next() {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
