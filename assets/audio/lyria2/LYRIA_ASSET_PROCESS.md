# Lyria Asset Generation Process (Exact Workflow Used)

This document records the exact process used to generate the Lyria audio assets in this project.

## Scope

- 3 loop packs x 3 stems:
  - `stage1_118_{drums,bass,topline}`
  - `stage2_126_{drums,bass,topline}`
  - `stage3_136_{drums,bass,topline}`
- 4 one-shots:
  - `oneshot_{pickup,commit,death,submit}`

All outputs were written to:

- `assets/audio/lyria2/*.wav`

## Files Involved

- Generator script: `scripts/generate-lyria-assets.mjs`
- Prompt source: `assets/audio/lyria2-prompts.md`
- NPM command: `npm run audio:lyria`

## Prerequisites

1. Node dependencies installed (`npm install`).
2. Google API key with access to Gemini Live Music.
3. `@google/genai` installed:

```bash
npm install @google/genai
```

## Step-by-Step (As Executed)

### 1) Check env availability

```bash
if [ -n "$GEMINI_API_KEY" ]; then echo "GEMINI_API_KEY=present"; else echo "GEMINI_API_KEY=missing"; fi
if [ -n "$GOOGLE_CLOUD_PROJECT" ]; then echo "GOOGLE_CLOUD_PROJECT=$GOOGLE_CLOUD_PROJECT"; else echo "GOOGLE_CLOUD_PROJECT=missing"; fi
if [ -n "$GOOGLE_GENAI_USE_VERTEXAI" ]; then echo "GOOGLE_GENAI_USE_VERTEXAI=$GOOGLE_GENAI_USE_VERTEXAI"; else echo "GOOGLE_GENAI_USE_VERTEXAI=missing"; fi
```

### 2) Check model catalog and identify available music model

```bash
curl -sS "https://generativelanguage.googleapis.com/v1beta/models?key=$GEMINI_API_KEY"
curl -sS "https://generativelanguage.googleapis.com/v1alpha/models?key=$GEMINI_API_KEY"
```

Result used:

- `models/lyria-realtime-exp`
- method: `bidiGenerateMusic`
- API version required: `v1alpha`

### 3) Implement generator and prompts

Created/updated:

- `scripts/generate-lyria-assets.mjs`
- `assets/audio/lyria2-prompts.md`
- `package.json` script:
  - `"audio:lyria": "node scripts/generate-lyria-assets.mjs"`

### 4) Smoke test one asset

```bash
LYRIA_DEBUG=1 GEMINI_API_KEY='<YOUR_KEY>' node scripts/generate-lyria-assets.mjs --only=oneshot_pickup
```

Expected outcome:

- At least one `serverContent.audioChunks` message
- one file written: `assets/audio/lyria2/oneshot_pickup.wav`

### 5) Generate full batch

```bash
GEMINI_API_KEY='<YOUR_KEY>' npm run audio:lyria
```

### 6) Verify outputs

```bash
ls -lh assets/audio/lyria2
```

Duration verification (WAV header-based):

```bash
node -e "const fs=require('fs'); const path='assets/audio/lyria2'; const files=fs.readdirSync(path).filter(f=>f.endsWith('.wav')).sort(); for(const f of files){const b=fs.readFileSync(path+'/'+f); const sr=b.readUInt32LE(24); const ch=b.readUInt16LE(22); const bits=b.readUInt16LE(34); const data=b.readUInt32LE(40); const sec=(data/(sr*ch*(bits/8))).toFixed(3); console.log(f+'\t'+sec+'s');}"
```

## Key Implementation Details

1. Client/API mode:
   - Uses `@google/genai` Live Music API.
   - Forced API version to `v1alpha`.
2. Stream parsing:
   - Audio chunks are read from `message.serverContent.audioChunks[*].data`.
3. Prompting:
   - One prompt per contiguous output file.
4. Post-processing in script:
   - Loops trimmed to target bar duration (based on BPM).
   - One-shots trimmed to target milliseconds.
   - Fade/tail smoothing applied to improve loop/one-shot edges.
5. Output format:
   - WAV files written to `assets/audio/lyria2`.

## Troubleshooting Notes (From This Run)

1. `lyria-002` via Gemini `predict` returned 404 in this environment.
   - Resolution: use `lyria-realtime-exp` through Live Music (`v1alpha`).
2. Early no-audio runs happened when reading the wrong message shape.
   - Resolution: parse `serverContent.audioChunks` instead of only `modelTurn.parts`.
3. If session appears stuck:
   - Run with `LYRIA_DEBUG=1` and confirm setup + chunk events are arriving.

## Re-run Commands (Copy/Paste)

Single asset:

```bash
GEMINI_API_KEY='<YOUR_KEY>' node scripts/generate-lyria-assets.mjs --only=stage1_118_drums
```

Full batch:

```bash
GEMINI_API_KEY='<YOUR_KEY>' npm run audio:lyria
```

## Security

- Do not commit API keys to source control.
- Prefer shell env variables over `.env` checked into git.
- Rotate any key that was pasted into shared chat or terminal logs.
