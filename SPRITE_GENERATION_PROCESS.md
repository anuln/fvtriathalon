# Sprite Generation Process (Gemini -> Transparent Runtime Assets)

This is the exact workflow used in this repo to generate Stage 3 sprites, clean backgrounds, and wire assets into gameplay.

## Scope
- Generate enemy, bullet, and boss sprite candidates with Gemini image generation.
- Convert generated outputs to transparent PNGs.
- Wire sprites into `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/src/main.ts`.
- Verify with tests and build.

## Prerequisites
- `GEMINI_API_KEY` is set.
- Dependencies installed (`npm install`).
- Scripts present:
  - `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/scripts/generate-gemini-sprite.mjs`
  - `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/scripts/make-sprites-transparent.mjs`

## Directory Layout
- Prompts: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/assets/sprites/generated/prompts/`
- Raw generated images: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/assets/sprites/generated/*_test.png`
- Transparent runtime images: `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/assets/sprites/generated/*-transparent.png`

## Step 1: Write Prompt Files
Create one prompt `.txt` per asset in `assets/sprites/generated/prompts/`.

Prompt conventions used:
- "single centered sprite"
- "retro pixel-art"
- "no blur / no anti-aliased look"
- "plain neutral background only" (background gets removed in post)
- No UI/text/logos/watermarks

Naming examples:
- `wave2_enemy_variant1_prompt.txt`
- `wave3_bullet_enemy_prompt.txt`
- `wave4_boss_prompt.txt`

## Step 2: Generate Raw Sprites (Gemini)
Use `scripts/generate-gemini-sprite.mjs`.

Example:
```bash
GEMINI_API_KEY='<YOUR_KEY>' node scripts/generate-gemini-sprite.mjs \
  --mode=interactions \
  --model=gemini-3-pro-image-preview \
  --prompt-file=assets/sprites/generated/prompts/wave2_enemy_variant1_prompt.txt \
  --out=assets/sprites/generated/wave2_enemy_variant1_test.png \
  --aspect=1:1 \
  --image-size=1K
```

Notes:
- Current script uses `interactions.create` with `response_modalities: ["image"]`.
- API may return JPEG bytes even if output filename uses `.png`.
- Treat these as raw intermediates.

## Step 3: Convert to Transparent PNG Runtime Assets
Use `scripts/make-sprites-transparent.mjs` to remove neutral background and crop bounds.

Single or batch usage:
```bash
node scripts/make-sprites-transparent.mjs \
  assets/sprites/generated/wave2_enemy_variant1_test.png \
  assets/sprites/generated/wave2_enemy_variant2_test.png \
  assets/sprites/generated/wave2_enemy_variant3_test.png
```

Output pattern:
- Input: `name_test.png`
- Output: `name_test-transparent.png`

## Step 4: Verify Alpha Exists
```bash
sips -g format -g hasAlpha assets/sprites/generated/wave2_enemy_variant1_test-transparent.png
```
Expected:
- `format: png`
- `hasAlpha: yes`

## Step 5: Wire Into Runtime
Wire generated transparent assets in `/Users/anubhav.mehrotra/Documents/codex/Retro Arcade/src/main.ts`.

Implementation pattern used:
- Load image with `createOptionalImage(url)`.
- Map sprites by wave and role:
  - Enemy variants by wave group.
  - Bullet sprites split by side (`player` vs `enemy`) every wave.
  - Dedicated Wave 4 boss sprite.
- Keep fallback primitive rendering when image is unavailable.

## Step 6: Gameplay Bug Guard (Formation Recenter Issue)
To avoid late-wave "enemies snapping/reappearing in center":
- Fit formation once after spawn or viewport resize.
- Avoid re-centering every frame.

Pattern used:
- `needsFormationFit` flag
- `lastFormationFitWidth`
- `ensureEnemyFormationFit(width)` called during update

## Step 7: Validate
```bash
npm test
npm run build
```

## Step 8: Commit/Push
```bash
git add <changed-files>
git commit -m "<message>"
git push origin main
```

## Troubleshooting
- `Missing GEMINI_API_KEY`: export key before running generation.
- `No image bytes returned from model`: prompt or model response issue; rerun with same prompt first.
- Background still visible in game: verify runtime references `*-transparent.png`, not raw `*_test.png`.
- Sprites not rendering: check `image.complete && image.naturalWidth > 0` conditions and file paths.
- API schema errors: keep snake_case fields in `interactions.create` payload (`response_modalities`, `generation_config.image_config`).

## Reusable Skill Candidate Structure
If converting this to a skill, keep these sections:
1. Trigger conditions (when to use the workflow)
2. Required inputs (prompt files, target waves, model)
3. Command recipe (generate -> transparent -> verify)
4. Wiring checklist (main.ts mapping and fallbacks)
5. Validation and acceptance criteria
6. Failure modes and fixes
