# Festiverse Arcade Retro Triathlon
## Amp Invaders Detailed User Flow v1

Date: 2026-02-17  
Purpose: define Stage 3 as the final-set climax where players convert remaining run time into high-pressure score decisions and a strong end-of-run payoff.

## 1) Core Promise
- Amp Invaders is the closing headliner set.
- The player is defending a DJ booth from descending sound gear waves.
- Success should feel like:
- high-tempo lane control
- clutch survival under rising pressure
- cinematic finale energy before results

## 2) What Makes It More Than Space Invaders
- Festival framing:
- enemies are amps, synth rigs, and drum walls marching the stage.
- Genre progression:
- each wave band shifts genre identity (jazz -> rock -> EDM -> metal).
- Triathlon stakes:
- this is the final stage, so players decide between safe banking and high-risk score spikes.
- Eventized moments:
- disco-ball flyover, overdrive windows, merch-tent shield collapses.

## 3) Player Journey (Finale Intent)
## 0:00 - 0:15 (Immediate Control Confidence)
- Quick lane-read moment:
- player movement and basic fire responsiveness confirmed instantly.
- first enemy row is forgiving and telegraphed.
- first elimination creates large, satisfying audiovisual pop.
- Goal: player feels control mastery before pressure ramps.

## 0:15 - 0:45 (Pattern Recognition)
- mixed enemy types introduced (basic + armored).
- merch-tent shields teach durability and positioning tradeoffs.
- periodic disco-ball pass cues high-risk bonus opportunities.
- Goal: shift from reaction to intentional lane planning.

## 0:45 - 1:00 (Final Stage Decision Hand-off)
- descending pace increases and row spacing tightens.
- player sees first “clutch” moments near booth line.
- At 1:00:
- `Commit & Move On` unlocks (to end run/results).
- Goal: player understands they can cash out now or push for more.

## 1:00+ (Risk Conversion Loop)
- every 30s:
- descent speed up
- enemy fire density up
- armored mix frequency up
- player decision loop:
- keep pushing high-risk multipliers
- or commit and lock score before catastrophic loss risk

## 4) Stage State Flow
1. `StageEnter`
- short “Final Set Live” banner and gameplay start.
2. `Playing`
- movement, fire loop, wave progression, shield management.
3. `CommitEligible`
- same as playing with persistent `Commit & Move On`.
4. `OverdriveWindow`
- temporary scoring/intensity spike mode.
5. `DeathResolve`
- booth breach / hit resolve + 1.5s beat-pause.
6. `DeathChoice`
- `Retry Here` (primary) or `Commit & Move On`.
7. `CommitConfirm`
- irreversible end-run confirmation.
8. `TransitionOut`
- final stage bank, total TriPoints, run results entry.

## 5) Detailed Interaction Rules
- Input model:
- drag or swipe-lane movement for mobile one-thumb control.
- basic fire is auto cadence; optional charged shot via tap-hold-release.
- retry behavior:
- retry resets only Amp Invaders stage state.
- global triathlon clock keeps running.
- early death rule:
- stage-ending failure before 60s from stage entry/retry unlocks immediate run-end commit option.
- no backtracking:
- stage 3 is terminal; commit sends player to results.

## 6) Scoring and Reward Feel
- Raw points:
- basic enemy defeat
- armored enemy bonus
- elite enemy bonus
- disco-ball flyover bonus
- clean-wave/perfect-defense bonus
- Risk-to-reward principle:
- highest values are exposed targets requiring lane risk.
- Triathlon fairness:
- raw score maps to TriPoints with diminishing returns to prevent single-stage over-dominance.
- Emotional cadence:
- frequent kill pops + periodic big “drop” payouts.

## 7) Enemy and Wave Design (Genre-Led Progression)
## Jazz Block (entry waves)
- lower density, clearer spacing, “warm-up groove.”

## Rock Block
- faster lateral movement and punchier enemy-fire cadence.

## EDM Block
- synchronized burst patterns and brighter strobe language.

## Metal Block (climax)
- denser mixed rows, tighter error windows, heavy visual/auditory impact.

Design rule:
- each block must be readable in under 2s via silhouette + color + rhythm.

## 8) Shield and Overdrive Systems
## Merch-Tent Shields
- absorb limited hits; damage state visibly degrades.
- positioning choices create tactical tradeoffs (safety vs shooting lanes).

## Overdrive Window
- triggered by streak conditions or special pickups.
- temporary score boost + high-intensity audiovisual treatment.
- must feel powerful but short; avoid long invulnerability.

## 9) UX Copy and Communication
- Stage intro:
- `Final Set. Hold the booth.`
- Commit unlock:
- `Run End Ready. Cash out or keep pushing.`
- Commit modal:
- `End run and go to results? You can’t return to gameplay.`
- Early death banner:
- `Stage Ended Early. Results are available now.`

## 10) Fairness, Readability, and Frustration Controls
- Enemy patterns must telegraph before becoming lethal.
- Screen clutter control:
- prioritize gameplay threats over decorative VFX during high pressure.
- Death clarity:
- cause-of-failure should be obvious on first glance.
- Anti-frustration:
- one-beat pause before retry/commit to prevent panic mis-inputs.

## 11) QA Acceptance (Amp Invaders v1)
- New players can understand movement + fire loop in first 10s.
- At least 80% of players identify shield function without tutorial text.
- At least 75% of players understand risk value of disco-ball targets.
- Commit/end-run flow understood after first confirmation modal.
- Finale feels meaningfully higher intensity than stages 1 and 2 in playtests.

## 12) Run Closure Handoff
- On stage 3 commit or timeout:
- immediately transition to results with:
- final TriPoints hero value
- per-stage split breakdown
- placement context
- preserving emotional payoff is mandatory: no abrupt utility-only screen cut.
