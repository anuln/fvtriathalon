# Festiverse Arcade Retro Triathlon
## Theme System + Screen-by-Screen Wire Spec (Planning)

Date: 2026-02-17  
Status: Locked v1 for implementation planning (no gameplay code yet)

## 1) Goals
- Support 3 full visual themes now:
- `neon-tournament-broadcast` (recommended default)
- `rave-poster-maximal`
- `vintage-crt-arcade`
- Keep player UX consistent across themes (same layout, same controls, same game-state messaging).
- Keep theme switching hidden from players.
- Allow admin-only theme swapping for test sessions.
- Make adding future themes low-effort through tokenized theme packs.

## 2) Non-Negotiable UX Consistency Layer
- Top HUD always contains:
- `Run Time`
- `Stage x/3`
- `Banked TriPoints`
- `Commit & Move On` interaction is identical across themes.
- Confirmation copy is identical across themes:
- `Leave this stage? You can’t return this run.`
- Leaderboard and results information hierarchy remains identical.
- Touch target minimums remain identical:
- primary controls >= 52x52 px
- secondary controls >= 44x44 px
- Contrast minimums remain identical:
- body/UI text >= WCAG AA
- critical gameplay labels target AAA where possible

## 3) Theme System Architecture (Extensible)
### 3.1 Token model
Use semantic tokens, not direct hex in components.

```ts
type ThemePack = {
  id: string;
  label: string;
  version: string;
  palette: {
    bg_base: string;
    bg_elevated: string;
    text_primary: string;
    text_secondary: string;
    accent_primary: string;
    accent_secondary: string;
    accent_warning: string;
    accent_success: string;
    gameplay_snake: string;
    gameplay_pac: string;
    gameplay_invaders: string;
  };
  typography: {
    display: string;
    ui: string;
    numeric: string;
    scale: { xs:number; sm:number; md:number; lg:number; xl:number; };
  };
  motion: {
    beat_pulse_ms: number;
    transition_ms_fast: number;
    transition_ms_base: number;
    transition_ms_slow: number;
    shake_intensity: number;
  };
  fx: {
    glow_strength: number;
    grain_opacity: number;
    scanline_opacity: number;
    bloom_enabled: boolean;
  };
  audioMix: {
    crowd_gain: number;
    ui_sfx_gain: number;
    stage_transition_gain: number;
  };
}
```

### 3.2 Runtime model
- `ThemeRegistry`: list of installed theme packs.
- `ThemeResolver`: returns active theme from priority:
1. admin override (session)
2. admin persisted override
3. server default
- `ThemeApplier`: updates CSS vars + Pixi runtime style map.
- `ThemeValidator`: checks required token keys and accessibility thresholds.

### 3.3 Future theme plugin path
- New themes are added as independent packs under `/themes/<theme-id>/`.
- Each pack must export required semantic tokens.
- Pack can optionally include:
- background shaders
- texture overlays
- SFX profile overrides

## 4) Hidden Theme Switching (Admin-Only)
### 4.1 Player-facing behavior
- No visible theme switcher in player UI.
- No theme names exposed in normal flow.

### 4.2 Admin entry points (recommended)
- Build-time flag `ADMIN_THEME_TOOLS=true` controls availability.
- Hidden gesture on attract screen:
- long press logo 3s -> tap top-left corner 3x within 2s.
- If successful, open `Theme Lab` sheet.
- Alternate safe fallback (for QA): URL param `?adminThemeLab=1` only in non-public env.

### 4.3 Theme Lab controls
- `Active Theme` segmented control (3 current themes).
- `Cycle on Restart` toggle (for rapid QA).
- `Persist Override` toggle (LocalStorage).
- `Reset to Default` action.

## 5) Theme Art Directions (Shared Structure, Different Feel)
## 5.1 Theme A: Neon Tournament Broadcast
- Mood: festival esports show.
- Colors:
- base `#090B10`, elevated `#111827`, text `#F3F4F6`
- accents `#FF5A36`, `#00E7D4`, `#FFD447`
- Fonts:
- display `Bebas Neue`
- UI `Rajdhani`
- numeric `JetBrains Mono`
- FX: moderate bloom, low grain, no heavy scanline.
- Motion: precise, crisp snap transitions.

## 5.2 Theme B: Rave Poster Maximal
- Mood: chaotic festival flyer energy, high saturation.
- Colors:
- base `#0D0217`, elevated `#18042A`, text `#FFF5EC`
- accents `#FF2A6D`, `#31FFA8`, `#00E5FF`, `#FFC400`
- Fonts:
- display `Anton`
- UI `Barlow Condensed`
- numeric `Space Mono`
- FX: strong glow, halftone texture, poster-grain.
- Motion: bolder squash/stretch on scoring events.

## 5.3 Theme C: Vintage CRT Arcade
- Mood: analog nostalgia with modern readability.
- Colors:
- base `#050B07`, elevated `#0D1710`, text `#DDF8D8`
- accents `#65FF8F`, `#39D1FF`, `#FFB357`
- Fonts:
- display `Press Start 2P` (titles only)
- UI `IBM Plex Sans`
- numeric `IBM Plex Mono`
- FX: scanline overlay + subtle phosphor bloom.
- Motion: fewer flashy transitions, stronger tactile ticks.

## 5.4 Art Ownership Model (Explicit)
- Visual direction is intentionally hybrid:
- `Shared Theme Layer` (global consistency)
- `Game Style Layer` (stage-specific personality)
- Target split:
- ~65% shared theme system
- ~35% game-specific style nuance

### Shared Theme Layer responsibilities
- Global HUD layout and hierarchy
- Typography families and sizing scale
- Core semantic colors (background, text, accents, states)
- Transition style and global motion timing
- Results/leaderboard/admin visual language

### Game Style Layer responsibilities
- Unique environment props and silhouettes per game
- Gameplay object styling (pickups, enemies, barriers, shields)
- Stage-specific micro-FX and VFX flavor
- Game-specific audio motif and event stingers

### Art source pipeline
- Phase 1 (fast consistency): token-driven procedural visuals in PixiJS
- Phase 2 (differentiation): curated bespoke sprite/style packs per game
- Rule: bespoke assets must still bind to semantic tokens to preserve cross-theme readability

## 6) Shared Layout Grid (Mobile-First)
- Base artboard: 390x844.
- Safe inset top/bottom: device-aware.
- 8-pt spacing system.
- Structure:
- top HUD strip (persistent)
- gameplay canvas
- bottom action rail (contextual)

## 7) Screen-by-Screen Wire Spec
## S0) Boot / Cold Open
- Purpose: immediate brand and audio handshake.
- Components:
- logo lockup
- `Tap to Enable Audio` prompt
- subtle animated equalizer bars
- Behavior:
- first tap initializes audio + enters Attract.
- Theme adaptation:
- logo treatment + background texture + pulse style only.

## S1) Attract / Start
- Purpose: explain the run in 5 seconds without tutorial wall.
- Components:
- title
- subline: `3 Games. One Clock. One Score.`
- primary CTA: `Start Triathlon`
- tiny info row: `You can move forward. You can't go back.`
- hidden admin trigger zone (invisible)
- Behavior:
- swipe up or tap CTA to start.

## S2) In-Game Core HUD (applies to all 3 games)
- Persistent top row:
- left: `Run Time`
- center: `Stage 1/3` + stage name
- right: `Banked TriPoints`
- Contextual controls:
- `Commit & Move On` appears when eligible.
- `Pause` icon (top-right micro button)
- Feedback:
- combo burst labels
- tri-point bank pulse on major events

## S3) Commit Confirmation Sheet
- Trigger: player taps `Commit & Move On`.
- Copy:
- Title: `Move to Next Stage?`
- Body: `You can’t return to this stage in this run.`
- Buttons:
- primary `Commit`
- secondary `Keep Playing`
- Visual:
- dimmed live gameplay behind sheet.

## S4) Stage Transition Card (3s)
- Content:
- `Stage Complete`
- `Banked This Stage: ####`
- `Total TriPoints: ####`
- `Up Next: <Stage Name>`
- Progress rail shows locked/completed stages.

## S5) Early Death in Stage (<60s)
- Behavior:
- immediate “Next Stage Available Now” banner.
- no forced transition.
- Player chooses:
- retry-in-place if allowed by game rule
- or commit forward.

## S6) Run Results
- Hierarchy:
1. Final TriPoints (hero number)
2. Placement / percentile
3. Per-stage splits (Snake, Pac, Invaders)
4. Key stats (peak combo, best clutch, survival)
- CTAs:
- `Submit to Leaderboard`
- `Play Again`

## S7) Leaderboard
- Default tab: global daily/weekly/all-time.
- Rows:
- rank, player tag, total TriPoints, stage splits.
- Filters:
- date range
- friends/local (optional later)

## S8) Hidden Admin Theme Lab
- Access: only hidden trigger + admin enabled builds.
- Controls:
- theme selector (A/B/C)
- persist override toggle
- cycle-per-run toggle
- preview next transition toggle
- reset button
- Telemetry panel:
- FPS
- UI contrast pass/fail
- current theme token hash

## 8) Gameplay-Specific UI Differences (Within Shared Shell)
- Rhythm Serpent:
- beat ring around score + trail pulse meter.
- Mosh Pit Pac-Man:
- zone activation strip (drums/bass/synth/lead/vocals).
- Amp Invaders:
- wave bar + genre badge.
- All are visually themed but use identical placement and scale rules.

## 9) Motion & Feel Rules
- Avoid constant micro-animation noise.
- Prioritize:
- event pulses
- transition ramps
- score milestone reveals
- Global cadence:
- quarter-note pulse anchors UI rhythm.
- Performance budget:
- cap expensive full-screen effects on low-power devices.

## 10) Validation Checklist (Before Build Lock)
- Player understands triathlon rules without tutorial modal.
- Player understands one-way progression instantly.
- Theme swaps do not alter gameplay readability.
- All 3 themes pass legibility and contrast checks.
- HUD comprehension is <2s in hallway tests.

## 11) Launch Default (Locked)
- Default live theme at launch: `Neon Tournament Broadcast`.
- Other themes remain admin-only test variants until explicitly promoted.

## 12) Pre-Dev Readiness Gates
- Product + design signoff:
- Triathlon rules signed (global timer, one-way stage commits, qualification rules).
- Theme architecture signed (token schema + admin-only switching).
- Wireframe signoff:
- all core screens reviewed on mobile-first layout.
- copy pass for key warnings and calls to action.
- Balance inputs signed:
- initial `K_game` parity constants accepted.
- first-pass raw-score targets per skill band accepted.
- Technical feasibility checks:
- performance budget targets defined for low-power mobile.
- theme packs validated with required semantic token contract.
- QA plan ready:
- smoke checklist for each screen + each theme.
- leaderboard submission and stage commit edge cases covered.

## 13) Locked Interaction Decisions
- Launch default visual theme: `Neon Tournament Broadcast`.
- Leaderboard split detail: keep current 3-way split (Snake/Pac/Invaders) in v1.
- Commit confirmation default action: `Keep Playing` (safety-first).
- Retry model:
- Retry restarts only the current mini-game stage state.
- Global run clock never pauses during retry or decision overlays.
- Banked points from completed stages are preserved.
- Current unbanked stage points reset on retry.
- Once `Commit & Move On` is unlocked in a stage, it remains unlocked for that stage.
- Early death definition:
- `Early death` = stage-ending failure before `60s` elapsed from current stage entry/retry.
- Early death response:
- show a short `1.5s` beat-pause stinger before options.
- then display `Retry Here` and `Commit & Move On`.
