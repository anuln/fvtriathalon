# Mosh-Pit Pac-Man Sprite Brainstorm
Date: 2026-02-19

## Goal
Create Stage 2 sprites that match "mosh pit" fantasy: chaotic crowd characters trying to corner the player.

## Approach Options

### 1) Realistic Club Security (Recommended)
- Enemy set: bouncer, punk blocker, raver lane-cutter.
- Strengths: instantly readable threat roles, strong silhouettes, easy color coding.
- Risk: can feel too "serious" if palette is muted.

### 2) Exaggerated Cartoon Mosher
- Enemy set: giant boots, oversized arms, caricature faces.
- Strengths: high personality and readability at tiny sprite sizes.
- Risk: could drift away from retro tone if overdone.

### 3) Abstract Symbolic Moshers
- Enemy set: helmet/mask icons and geometric body blocks.
- Strengths: fastest to produce and easiest to animate.
- Risk: lower thematic payoff and weaker festival character identity.

Recommendation: Start with Approach 1 and keep color + accessories from Approach 2.

## Initial Prompt Set Added
- `assets/sprites/generated/prompts/moshpit_player_runner_prompt.txt`
- `assets/sprites/generated/prompts/moshpit_guard_bouncer_prompt.txt`
- `assets/sprites/generated/prompts/moshpit_guard_punker_prompt.txt`
- `assets/sprites/generated/prompts/moshpit_guard_raver_prompt.txt`

## Generation Commands
Use the same workflow from `SPRITE_GENERATION_PROCESS.md`.

```bash
GEMINI_API_KEY='<YOUR_KEY>' node scripts/generate-gemini-sprite.mjs --mode=interactions --model=gemini-3-pro-image-preview --prompt-file=assets/sprites/generated/prompts/moshpit_player_runner_prompt.txt --out=assets/sprites/generated/moshpit_player_runner_test.png --aspect=1:1 --image-size=1K
GEMINI_API_KEY='<YOUR_KEY>' node scripts/generate-gemini-sprite.mjs --mode=interactions --model=gemini-3-pro-image-preview --prompt-file=assets/sprites/generated/prompts/moshpit_guard_bouncer_prompt.txt --out=assets/sprites/generated/moshpit_guard_bouncer_test.png --aspect=1:1 --image-size=1K
GEMINI_API_KEY='<YOUR_KEY>' node scripts/generate-gemini-sprite.mjs --mode=interactions --model=gemini-3-pro-image-preview --prompt-file=assets/sprites/generated/prompts/moshpit_guard_punker_prompt.txt --out=assets/sprites/generated/moshpit_guard_punker_test.png --aspect=1:1 --image-size=1K
GEMINI_API_KEY='<YOUR_KEY>' node scripts/generate-gemini-sprite.mjs --mode=interactions --model=gemini-3-pro-image-preview --prompt-file=assets/sprites/generated/prompts/moshpit_guard_raver_prompt.txt --out=assets/sprites/generated/moshpit_guard_raver_test.png --aspect=1:1 --image-size=1K
```

Then convert to transparent runtime assets:

```bash
node scripts/make-sprites-transparent.mjs \
  assets/sprites/generated/moshpit_player_runner_test.png \
  assets/sprites/generated/moshpit_guard_bouncer_test.png \
  assets/sprites/generated/moshpit_guard_punker_test.png \
  assets/sprites/generated/moshpit_guard_raver_test.png
```
