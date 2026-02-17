# Festiverse Arcade Retro Triathlon
## Mosh Pit Pac-Man Detailed User Flow v1

Date: 2026-02-17  
Purpose: define Stage 2 as the strategic mid-set where route choice and timing mastery matter, while still being immediately readable on mobile.

## 1) Core Promise
- Mosh Pit Pac-Man is the tactical middle act.
- The player is navigating festival grounds, not a generic maze.
- Success should feel like:
- smart routing decisions under pressure
- controlled risk-taking around guards and power windows
- audible growth as zones activate instrument layers

## 2) What Makes It More Than Pac-Man
- Festival zoning with musical meaning:
- each map region corresponds to an instrument lane (drums, bass, synth, lead, vocals).
- Zone activation loop:
- clearing enough picks in a zone audibly/visually activates that layer.
- Triathlon strategy layer:
- once commit unlocks, player decides whether to keep optimizing route points or move on.
- Environmental identity:
- stage paths, food alleys, VIP cuts, security patrol vibe.

## 3) Player Journey (Stage 2 Intent)
## 0:00 - 0:15 (Reorientation)
- Fast visual orientation:
- player spawn, nearest safe route, visible pick trail.
- guards start readable and slightly forgiving.
- First pickups create clear pitch/timbre differentiation by zone.
- Goal: player immediately feels this is a “music map,” not just dot clear.

## 0:15 - 0:45 (Route Ownership)
- Introduce branch decisions:
- safe longer route vs risky short route with denser value.
- One backstage pass (power state) appears on a clear but contested lane.
- Goal: establish “choose your line” skill expression.

## 0:45 - 1:00 (Pressure Hand-off)
- Guard intent becomes clearer (predictable chase/scatter rhythm).
- Zone progress HUD starts to matter for player prioritization.
- At 1:00:
- `Commit & Move On` unlocks for stage strategy decision.

## 1:00+ (Optimization Phase)
- Every 30s:
- guard speed/intelligence pressure edges up
- corner timing tolerance tightens
- route mistakes become costly
- Player decision loop:
- keep farming guard-chain and zone-clear value
- or bank and move to Amp Invaders

## 4) Stage State Flow
1. `StageEnter`
- short “Festival Grounds Open” banner and spawn.
2. `Playing`
- routing, pick collection, guard evasion/chase.
3. `CommitEligible`
- same as playing with persistent commit CTA.
4. `PowerChase`
- backstage pass active, guards vulnerable.
5. `DeathResolve`
- caught by guard; freeze + 1.5s beat-pause.
6. `DeathChoice`
- `Retry Here` (primary), `Commit & Move On`.
7. `CommitConfirm`
- irreversible move warning.
8. `TransitionOut`
- stage bank + total TriPoints to stage 3.

## 5) Detailed Interaction Rules
- Input:
- swipe/virtual-direction support with buffered turn windows.
- fairness:
- cornering uses consistent turn-buffer rules; no hidden snap turns.
- retry behavior:
- retry resets only stage 2 state.
- global triathlon timer keeps running.
- early death rule:
- stage-ending failure before 60s from stage entry/retry instantly unlocks next stage option.
- backtracking:
- once stage 3 committed, stage 2 locked for that run.

## 6) Scoring and Reward Feel
- Raw points:
- base pick value
- backstage pass pickup bonus
- escalating guard-chain rewards during chase window
- zone completion bonus
- Feedback cadence:
- frequent micro rewards for movement quality
- medium spikes for zone milestones
- major spikes for power-chain execution
- Triathlon fairness:
- raw converts to TriPoints with diminishing returns to avoid over-dominance from infinite farm patterns.

## 7) Zone Identity and Music Integration
## Drums Zone
- visual: harder, punchier lighting accents.
- audio: kick/snare-focused pickup tones.

## Bass Zone
- visual: deeper lane glow, lower-frequency pulse.
- audio: bass note pickups and low-end emphasis.

## Synth Zone
- visual: airy neon gradients and shimmer.
- audio: chord and pad-like pickups.

## Lead Zone
- visual: sharp highlights and bright lane edges.
- audio: higher-register melodic pickup tones.

## Vocals Zone (Center)
- visual: warmer spotlight treatment.
- audio: hook-like call-response stings on milestones.

## 8) UX Copy and Communication
- Stage intro:
- `Find your route. Build the set.`
- Commit unlock message:
- `Next Stage Ready. Stay for score or commit now.`
- Commit modal:
- `Move to Amp Invaders? You can’t return this run.`
- Early death banner:
- `Stage Ended Early. Next Stage is available now.`

## 9) Fairness, Clarity, and Frustration Controls
- Guard behavior must feel learnable, not random.
- Power state readability:
- vulnerable guard state color/animation unmistakable.
- Death clarity:
- caught-state must clearly show source guard and path error moment.
- Anti-frustration:
- one-beat pause before retry/commit options; no instant respawn confusion.

## 10) QA Acceptance (Mosh Pit Pac-Man v1)
- New players understand “collect + avoid” loop in first 10s.
- At least 75% of players notice zone meter relevance by 45s.
- At least 80% of players identify power-chase state correctly.
- Commit/no-return rule understood after one confirmation modal.
- No critical navigation confusion reports across zone transitions.

## 11) Next Design Deliverable
- Stage 3 detailed user-flow spec:
- Amp Invaders (finale intensity, closure, and end-run emotional payoff)

Status update:
- Amp Invaders detailed flow: completed.
