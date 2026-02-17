#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import util from "node:util";
import { GoogleGenAI, Modality } from "@google/genai";

const SAMPLE_RATE = 48_000;
const CHANNELS = 2;
const BITS_PER_SAMPLE = 16;
const FRAME_BYTES = CHANNELS * (BITS_PER_SAMPLE / 8);

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("Missing GEMINI_API_KEY in environment.");
  process.exit(1);
}

const model = process.env.LYRIA_MODEL ?? "lyria-realtime-exp";
const outDir = process.env.LYRIA_OUT_DIR ?? "assets/audio/lyria2";
const only = process.argv.find((arg) => arg.startsWith("--only="))?.slice("--only=".length);

const loopTargetMs = (bpm, bars = 8) => Math.round((60_000 / bpm) * 4 * bars);

const tasks = [
  {
    id: "stage1_118_drums",
    kind: "loop",
    bpm: 118,
    targetMs: loopTargetMs(118),
    captureMs: 24_000,
    prompt:
      "118 BPM. Create an 8-bar seamless drum-only loop for an arcade opener. Tight kick and snare, crisp hats, light percussive sparkle. No bass, no melody, no vocals. Punchy and clean.",
  },
  {
    id: "stage1_118_bass",
    kind: "loop",
    bpm: 118,
    targetMs: loopTargetMs(118),
    captureMs: 24_000,
    prompt:
      "118 BPM. Create an 8-bar seamless bass-only loop for electro-funk arcade gameplay. Round synth bass groove with clear rhythm. No drums, no chords, no lead, no vocals.",
  },
  {
    id: "stage1_118_topline",
    kind: "loop",
    bpm: 118,
    targetMs: loopTargetMs(118),
    captureMs: 24_000,
    prompt:
      "118 BPM. Create an 8-bar seamless music/topline stem only: bright synth chords and hook fragments for playful neon arcade energy. No drums, no bass, no vocals.",
  },
  {
    id: "stage2_126_drums",
    kind: "loop",
    bpm: 126,
    targetMs: loopTargetMs(126),
    captureMs: 24_000,
    prompt:
      "126 BPM. Create an 8-bar seamless drum-only loop with rising urgency. Driving kick, snappy clap/snare, energetic hats and percussion. No bass, no melody, no vocals.",
  },
  {
    id: "stage2_126_bass",
    kind: "loop",
    bpm: 126,
    targetMs: loopTargetMs(126),
    captureMs: 24_000,
    prompt:
      "126 BPM. Create an 8-bar seamless bass-only loop for a high-pressure arcade mid-stage. Gritty rhythmic synth bass with motion and sidechain feel. No drums, no melody, no vocals.",
  },
  {
    id: "stage2_126_topline",
    kind: "loop",
    bpm: 126,
    targetMs: loopTargetMs(126),
    captureMs: 24_000,
    prompt:
      "126 BPM. Create an 8-bar seamless music/topline stem only: tense synth stabs, rhythmic chords, short hook motifs. No drums, no bass, no vocals.",
  },
  {
    id: "stage3_136_drums",
    kind: "loop",
    bpm: 136,
    targetMs: loopTargetMs(136),
    captureMs: 24_000,
    prompt:
      "136 BPM. Create an 8-bar seamless drum-only finale loop. High-energy, crisp transients, powerful groove, controlled low end. No bass, no melody, no vocals.",
  },
  {
    id: "stage3_136_bass",
    kind: "loop",
    bpm: 136,
    targetMs: loopTargetMs(136),
    captureMs: 24_000,
    prompt:
      "136 BPM. Create an 8-bar seamless bass-only finale loop. Aggressive synth bass with rhythmic drive and controlled distortion edge. No drums, no melody, no vocals.",
  },
  {
    id: "stage3_136_topline",
    kind: "loop",
    bpm: 136,
    targetMs: loopTargetMs(136),
    captureMs: 24_000,
    prompt:
      "136 BPM. Create an 8-bar seamless music/topline stem only for a climax. Bright anthemic synth fragments and harmonic lift. No drums, no bass, no vocals.",
  },
  {
    id: "oneshot_pickup",
    kind: "oneshot",
    bpm: 126,
    targetMs: 220,
    captureMs: 6_000,
    prompt:
      "Create a very short collectible pickup one-shot. Positive pluck/chime, immediate transient, modern arcade tone, no vocals.",
  },
  {
    id: "oneshot_commit",
    kind: "oneshot",
    bpm: 126,
    targetMs: 650,
    captureMs: 6_000,
    prompt:
      "Create a commit confirmation one-shot. Decisive layered transient, short upward motion, firm ending hit. No vocals.",
  },
  {
    id: "oneshot_death",
    kind: "oneshot",
    bpm: 126,
    targetMs: 900,
    captureMs: 6_000,
    prompt:
      "Create a death one-shot: impact plus downward pitch movement and brief noise decay. Dramatic but not horror. No vocals.",
  },
  {
    id: "oneshot_submit",
    kind: "oneshot",
    bpm: 126,
    targetMs: 750,
    captureMs: 6_000,
    prompt:
      "Create a submit-score one-shot. Upward flourish and clean confirm hit, polished modern arcade feel, no vocals.",
  },
];

const selectedTasks = only ? tasks.filter((task) => task.id.includes(only)) : tasks;
if (selectedTasks.length === 0) {
  console.error(`No tasks matched --only=${only}`);
  process.exit(1);
}

await fs.mkdir(outDir, { recursive: true });

const ai = new GoogleGenAI({
  apiKey,
  httpOptions: { apiVersion: "v1alpha" },
});

for (const task of selectedTasks) {
  console.log(`\n[lyria] generating ${task.id}...`);
  const raw = await capturePcm(ai, task);
  if (!raw.length) {
    console.warn(`[lyria] no audio bytes for ${task.id}, skipping`);
    continue;
  }

  const trimmed = trimToTarget(raw, task.targetMs);
  const processed = task.kind === "loop" ? applyLoopTailMatch(trimmed, 8) : applyOneshotFade(trimmed);
  const wav = pcm16StereoToWav(processed);
  const output = path.join(outDir, `${task.id}.wav`);
  await fs.writeFile(output, wav);
  console.log(`[lyria] wrote ${output} (${processed.length} pcm bytes)`);
}

console.log("\n[lyria] done.");

async function capturePcm(aiClient, task) {
  const chunks = [];
  let callbackError = null;
  let debugMessageCount = 0;

  const session = await aiClient.live.music.connect({
    model,
    config: {
      responseModalities: [Modality.AUDIO],
    },
    callbacks: {
      onmessage: (message) => {
        if (process.env.LYRIA_DEBUG === "1" && debugMessageCount < 6) {
          debugMessageCount += 1;
          const firstPart = message?.serverContent?.modelTurn?.parts?.[0];
          const firstAudioChunk = Array.isArray(message?.serverContent?.audioChunks)
            ? message.serverContent.audioChunks[0]
            : undefined;
          console.log(
            "[lyria:msg]",
            JSON.stringify({
              keys: Object.keys(message ?? {}),
              serverContentKeys: Object.keys(message?.serverContent ?? {}),
              modelTurnKeys: Object.keys(message?.serverContent?.modelTurn ?? {}),
              partKeys: firstPart ? Object.keys(firstPart) : [],
              audioChunkKeys: firstAudioChunk ? Object.keys(firstAudioChunk) : [],
              setupComplete: Boolean(message?.setupComplete),
            }),
          );
        }
        const parts = message?.serverContent?.modelTurn?.parts ?? [];
        for (const part of parts) {
          const b64 = part?.inlineData?.data ?? part?.musicData?.data;
          if (typeof b64 === "string" && b64.length > 0) {
            chunks.push(Buffer.from(b64, "base64"));
          }
        }
        const audioChunks = message?.serverContent?.audioChunks ?? [];
        for (const chunk of audioChunks) {
          const b64 = chunk?.data;
          if (typeof b64 === "string" && b64.length > 0) {
            chunks.push(Buffer.from(b64, "base64"));
          }
        }
      },
      onerror: (err) => {
        const inner = err?.error ?? err;
        callbackError =
          inner instanceof Error ? inner : new Error(`Lyria socket error: ${util.inspect(inner, { depth: 4 })}`);
      },
    },
  });

  await session.setMusicGenerationConfig({
    musicGenerationConfig: {
      bpm: task.bpm,
      musicGenerationMode: "QUALITY",
      temperature: 1.0,
    },
  });
  await session.setWeightedPrompts({
    weightedPrompts: [{ text: task.prompt, weight: 1.0 }],
  });
  await session.play();

  await sleep(task.captureMs);
  await session.close();
  await sleep(400);

  if (callbackError) {
    throw callbackError;
  }

  return Buffer.concat(chunks);
}

function trimToTarget(pcm, targetMs) {
  const frames = Math.max(1, Math.round((SAMPLE_RATE * targetMs) / 1000));
  const targetBytes = frames * FRAME_BYTES;
  return pcm.length >= targetBytes ? pcm.subarray(0, targetBytes) : pcm;
}

function applyLoopTailMatch(pcm, fadeMs) {
  const fadeFrames = Math.max(1, Math.round((SAMPLE_RATE * fadeMs) / 1000));
  const totalFrames = Math.floor(pcm.length / FRAME_BYTES);
  const framesToUse = Math.min(fadeFrames, Math.floor(totalFrames / 4));
  if (framesToUse < 1) return pcm;

  const out = Buffer.from(pcm);
  for (let i = 0; i < framesToUse; i += 1) {
    const mix = i / framesToUse;
    const endFrame = totalFrames - framesToUse + i;
    for (let ch = 0; ch < CHANNELS; ch += 1) {
      const startOffset = (i * CHANNELS + ch) * 2;
      const endOffset = (endFrame * CHANNELS + ch) * 2;
      const start = out.readInt16LE(startOffset);
      const end = out.readInt16LE(endOffset);
      const blended = Math.round(end * (1 - mix) + start * mix);
      out.writeInt16LE(clamp16(blended), endOffset);
    }
  }
  return out;
}

function applyOneshotFade(pcm) {
  const out = Buffer.from(pcm);
  const totalFrames = Math.floor(out.length / FRAME_BYTES);
  const fadeInFrames = Math.min(totalFrames, Math.max(1, Math.round((SAMPLE_RATE * 4) / 1000)));
  const fadeOutFrames = Math.min(totalFrames, Math.max(1, Math.round((SAMPLE_RATE * 20) / 1000)));

  for (let i = 0; i < fadeInFrames; i += 1) {
    const gain = i / fadeInFrames;
    for (let ch = 0; ch < CHANNELS; ch += 1) {
      const offset = (i * CHANNELS + ch) * 2;
      const sample = out.readInt16LE(offset);
      out.writeInt16LE(clamp16(Math.round(sample * gain)), offset);
    }
  }

  for (let i = 0; i < fadeOutFrames; i += 1) {
    const gain = 1 - i / fadeOutFrames;
    const frame = totalFrames - fadeOutFrames + i;
    for (let ch = 0; ch < CHANNELS; ch += 1) {
      const offset = (frame * CHANNELS + ch) * 2;
      const sample = out.readInt16LE(offset);
      out.writeInt16LE(clamp16(Math.round(sample * gain)), offset);
    }
  }
  return out;
}

function pcm16StereoToWav(pcm) {
  const dataSize = pcm.length;
  const byteRate = SAMPLE_RATE * CHANNELS * (BITS_PER_SAMPLE / 8);
  const blockAlign = CHANNELS * (BITS_PER_SAMPLE / 8);
  const wav = Buffer.alloc(44 + dataSize);

  wav.write("RIFF", 0, 4, "ascii");
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write("WAVE", 8, 4, "ascii");
  wav.write("fmt ", 12, 4, "ascii");
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(CHANNELS, 22);
  wav.writeUInt32LE(SAMPLE_RATE, 24);
  wav.writeUInt32LE(byteRate, 28);
  wav.writeUInt16LE(blockAlign, 32);
  wav.writeUInt16LE(BITS_PER_SAMPLE, 34);
  wav.write("data", 36, 4, "ascii");
  wav.writeUInt32LE(dataSize, 40);
  pcm.copy(wav, 44);
  return wav;
}

function clamp16(n) {
  return Math.max(-32768, Math.min(32767, n));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
