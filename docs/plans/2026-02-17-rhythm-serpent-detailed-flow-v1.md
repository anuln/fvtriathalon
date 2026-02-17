# Festiverse Arcade Retro Triathlon
## Rhythm Serpent Detailed User Flow v1

Date: 2026-02-17  
Purpose: define the complete player experience for Stage 1 so it feels like a festival performance, not a reskinned Snake.

## 1) Core Promise
- Rhythm Serpent is a playable opening set.
- The player is not a snake; they are building a dancing conga line and controlling crowd energy.
- Success should feel like:
- clean movement mastery
- musical build-up under player control
- visual spectacle escalation

## 2) What Makes It More Than Snake
- Performance loop instead of pure survival loop:
- every pickup adds to music density and visual intensity.
- Stage-show moments:
- power-ups trigger show events (bass drop lights, encore confetti, mosh speed burst).
- Triathlon strategy:
- player can continue farming stage points or commit forward once unlocked.
- Festival world fantasy:
- barriers are stage rigs and speaker walls.
- pickups are notes/instruments/merch moments, not generic pellets.

## 3) Player Journey (Minute-by-Minute Intent)
## 0:00 - 0:10 (Instant Readability)
- Spawn with broad safe lanes.
- First visible pickup is directly on natural movement path.
- First successful pickup triggers:
- audible note layer
- trail pulse
- tiny score pop
- Goal: player instantly understands movement + reward.

## 0:10 - 0:30 (Confidence Build)
- Add light directional pressure with simple barrier shapes.
- Combo text appears only after second consecutive pickup.
- Crowd ambience ramps subtly with combo consistency.

## 0:30 - 0:60 (First Performance Identity)
- Introduce one power-up opportunity on-risk path.
- Visual lighting sweeps synchronize to beat.
- At 0:60:
- `Commit & Move On` becomes available.
- Goal: player realizes triathlon decision is now active.

## 1:00+ (Strategic Farming Phase)
- Difficulty ramps every 30s:
- tighter pathing
- higher move tempo
- more risk-reward pickup placements
- Player decision loop:
- keep pushing for more stage points
- or bank and move to stage 2

## 4) Stage State Flow
1. `StageEnter`
- short 1.0s hype card then gameplay start.
2. `Playing`
- core movement, pickups, combo, power-up events.
3. `CommitEligible`
- same as playing, with persistent `Commit & Move On` CTA.
4. `DeathResolve`
- crash event + score freeze + 1.5s beat-pause.
5. `DeathChoice`
- `Retry Here` or `Commit & Move On` (if eligible or early death).
6. `CommitConfirm`
- irreversible move warning modal.
7. `TransitionOut`
- banked score + total TriPoints shown, then stage 2 entry.

## 5) Detailed Interaction Rules
- Input:
- swipe queue with direction buffering for mobile reliability.
- Illegal reverse turns are ignored with subtle feedback.
- Retry behavior:
- retry restarts Rhythm Serpent stage state only.
- global triathlon clock continues running.
- early death rule:
- if stage ends before 60s from current stage entry/retry, next stage becomes immediately available.
- no backtracking:
- once committed to stage 2, stage 1 is permanently locked.

## 6) Scoring and Reward Feel
- Raw points:
- basic note pickup
- higher-value instrument pickup
- power-up assisted chain bonuses
- Combo reward:
- visible at low thresholds only (avoid UI noise).
- Triathlon relevance:
- raw score converts to TriPoints with diminishing returns (prevents infinite farming dominance).
- Emotional cadence:
- small frequent rewards + occasional big spectacle moments.

## 7) Power-Ups as Show Control
## Bass Drop (slow-mo precision window)
- Effect:
- temporary slowdown + enhanced pickup hitbox clarity.
- Feel:
- dramatic low-frequency sweep + strobe collapse then rebuild.
- Design role:
- rescue tool and high-skill chain tool.

## Encore (short invincibility)
- Effect:
- collision immunity for brief window.
- Feel:
- crowd cheer surge + gold/pink stage flare.
- Design role:
- momentum extender, encourages aggressive lines.

## Mosh Burst (speed burst)
- Effect:
- temporary speed increase + pickup value bonus.
- Feel:
- camera shake micro pulses + kinetic trails.
- Design role:
- high-risk score spike option.

## 8) UX Copy and Communication
- Stage intro line:
- `Open the night. Build the line.`
- Unlock message at 60s:
- `Next Stage Ready. Keep playing or commit.`
- Commit modal:
- `Move to Mosh Pit Pac-Man? You can’t return this run.`
- Early death banner:
- `Stage Ended Early. Next Stage is available now.`

## 9) Fail States and Fairness
- Common fail causes:
- over-commit into tight barrier turns
- late swipe under higher speed ramps
- Fairness protections:
- readable telegraphing for dense barrier clusters
- consistent collision boundaries
- one-beat death pause before options (no instant frustration spam)

## 10) QA Acceptance (Rhythm Serpent v1)
- New player survives at least 20s in first attempt >70% of tests.
- Players understand move input within first 2 pickups.
- At least 80% of test players notice `Commit & Move On` by 75s.
- No report of hidden or confusing one-way progression after commit.
- Power-up identities are distinguishable without tutorial text.

## 11) Next Design Deliverable
- Build equivalent detailed user-flow specs for:
1. Mosh Pit Pac-Man (stage 2 strategic routing)
2. Amp Invaders (stage 3 finale pressure and closure)

Status update:
- Mosh Pit Pac-Man detailed flow: completed.
- Amp Invaders detailed flow: completed.
