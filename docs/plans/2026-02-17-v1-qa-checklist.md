# V1 QA Checklist

## Gameplay Flow
- Start from boot and verify Stage 1/3 appears.
- Advance through all three stages and verify results screen appears.
- Confirm one-way transition from stage flow into final results.

## Scoring and HUD
- Confirm tri-point text appears on HUD and results.
- Confirm stage labels and timer formatting remain stable.

## Admin/Theme
- Verify player mode cannot access theme lab by default.
- Verify non-prod query fallback works only when enabled.

## Stability
- Run unit tests and targeted e2e.
- Confirm no runtime console errors during the triathlon flow.
