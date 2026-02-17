# Festiverse Triathlon V1 Developer Handoff

## feature completeness
- Boot, stage flow, and results shell are wired for the three-stage triathlon progression.
- Domain modules cover commit/retry eligibility, parity score normalization, theme validation, theme registry, and leaderboard ordering.
- Stage modules provide V1 hooks for Rhythm Serpent, Mosh Pit Pac-Man, and Amp Invaders behaviors.

## known issues
- Rendering is currently DOM-first scaffolding and not yet PixiJS scene composition.
- E2E currently drives deterministic helper hooks for progression instead of full gameplay simulation.

## performance metrics
- Unit test suites in this repo run in seconds on local machine.
- Targeted triathlon e2e executes in roughly a few seconds in headless Chromium.

## deferred to v1.1
- Replace scaffolded stage interactions with full deterministic gameplay loops and balancing.
- Expand telemetry and frame-time instrumentation for stage-by-stage profiling.

## follow-up backlog
- Integrate persistent run history and richer leaderboard views.
- Harden admin theme-lab unlock UX and analytics.
- Add more granular tests around transitions, retries, and score banking edge cases.

## run locally
- `npm install`
- `npm run dev`
- `npm run test`
- `npm run test:e2e -- e2e/triathlon-flow.spec.ts`
