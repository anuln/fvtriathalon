# Festiverse Mobile-First V1 QA Matrix

Date: 2026-02-17
Scope: Portrait-only mobile baseline for full triathlon runtime.

## Targets
- FPS target (mid-tier mobile): 55+ while playing.
- Touch latency target: <= 120ms perceived response for primary actions.
- Layout target: no page scroll in active run states.
- Reachability target: key actions remain visible on 320w, 375w, 390w, 430w.

## Current Baseline (P0)
| Scenario | Viewport | Expected | Status |
|---|---|---|---|
| Boot -> Start -> Stage 1 visible | 390x844 | pass | pass (e2e `mobile-smoke`) |
| No blocking overlay after start | 390x844 | pass | pass (e2e `mobile-smoke`) |
| No page scroll while playing | 390x844 | pass | pass (e2e `mobile-smoke`) |
| HUD + action rail visible | 320x568 | pass | pass (e2e `mobile-smoke`) |

## Known Risks
- Safe-area padding is not yet explicitly contract-tested against iOS dynamic inset behavior.
- Touch input tuning is currently shared for all stages; stage-specific mobile profiles still pending.
- Performance tiering for lower-end Android devices still pending.

## Next Validation Passes
- Add safe-area/canvas mapping assertions and resize stress checks.
- Add per-stage touch control reliability tests.
- Add iPhone Safari + Android Chrome manual verification table.
