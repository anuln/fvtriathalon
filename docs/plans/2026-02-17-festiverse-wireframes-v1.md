# Festiverse Arcade Retro Triathlon
## Low-Fidelity Wireframes v1 (Mobile-First)

Date: 2026-02-17  
Default Theme: `Neon Tournament Broadcast`  
Other Themes: admin-only test variants

---

## Frame Specs
- Base frame: `390 x 844`
- Safe top inset: `47`
- Safe bottom inset: `34`
- Grid: 8-pt

Legend:
- `[A#]` actionable component
- `[I#]` informational component
- `[S#]` state-dependent component

---

## WF-00 Boot / Audio Handshake

```text
┌────────────────────────────────────────────┐
│                                            │
│                 FESTIVERSE                 │
│                  ARCADE                    │
│                                            │
│              [I1] Equalizer Bars           │
│                                            │
│                                            │
│       [A1] TAP TO ENABLE AUDIO             │
│                                            │
└────────────────────────────────────────────┘
```

- Notes:
- Single tap advances to Attract.
- No secondary actions.

---

## WF-01 Attract / Start

```text
┌────────────────────────────────────────────┐
│ [I1] Festiverse Arcade Retro Triathlon     │
│                                            │
│ [I2] 3 Games. One Clock. One Score.        │
│                                            │
│ [I3] Rhythm Serpent  ->  Mosh Pit  -> Amp  │
│                                            │
│                [A1] START                  │
│                                            │
│ [I4] Move forward anytime after 60s.       │
│ [I5] You can't return to prior stages.     │
│                                            │
│                          [S1] hidden admin │
└────────────────────────────────────────────┘
```

- Notes:
- `[S1]` only responds when admin tools flag enabled.

---

## WF-02 In-Game Shell (applies to all games)

```text
┌────────────────────────────────────────────┐
│ [I1] 08:41   [I2] Stage 1/3   [I3] TP 542  │
│────────────────────────────────────────────│
│                                            │
│                                            │
│              [I4] GAME CANVAS              │
│                                            │
│                                            │
│                                            │
│ [S1] Combo Burst / Milestone Callouts      │
│                                            │
│ [A1] Commit & Move On   [A2] Pause         │
└────────────────────────────────────────────┘
```

- Notes:
- `[A1]` hidden until rule unlock (60s or early stage end).
- `[I4]` content differs per game but shell stays fixed.

---

## WF-03 Commit Confirmation Sheet

```text
┌────────────────────────────────────────────┐
│ (dimmed live game background)              │
│                                            │
│         [I1] Move to Next Stage?           │
│ [I2] You can't return to this stage        │
│      in this run.                          │
│                                            │
│              [A1] COMMIT                   │
│              [A2] KEEP PLAYING             │
│                                            │
└────────────────────────────────────────────┘
```

- Notes:
- Default focus on `[A2]` to prevent accidental commits.

---

## WF-04 Stage Transition Card (3s)

```text
┌────────────────────────────────────────────┐
│          [I1] STAGE COMPLETE               │
│                                            │
│       [I2] Banked This Stage: 1380         │
│        [I3] Total TriPoints: 1742          │
│                                            │
│      [I4] Up Next: MOSH PIT PAC-MAN        │
│                                            │
│ [I5] Progress: [✓] [→] [•]                 │
└────────────────────────────────────────────┘
```

- Notes:
- Auto-advance unless user opens pause/debug in admin mode.

---

## WF-05 Early Death (<60s)

```text
┌────────────────────────────────────────────┐
│ [I1] Stage Ended Early                     │
│                                            │
│ [I2] Next Stage is available now.          │
│                                            │
│ [A1] RETRY HERE                            │
│ [A2] COMMIT & MOVE ON                      │
│                                            │
│ [I3] (No backtracking once committed)      │
└────────────────────────────────────────────┘
```

- Notes:
- Trigger condition: stage-ending failure before 60s in current stage attempt.
- Before showing choices, hold a 1.5s beat-pause stinger.
- Keeps triathlon flow while avoiding dead-end frustration.

---

## WF-06 Run Results

```text
┌────────────────────────────────────────────┐
│ [I1] FINAL TRIPOINTS                       │
│ [I2] 3128                                  │
│                                            │
│ [I3] Stage Splits                          │
│ Rhythm Serpent      1224                   │
│ Mosh Pit Pac-Man     964                   │
│ Amp Invaders         940                   │
│                                            │
│ [I4] Rank: #27 (Top 12%)                   │
│                                            │
│ [A1] SUBMIT TO LEADERBOARD                 │
│ [A2] PLAY AGAIN                            │
└────────────────────────────────────────────┘
```

---

## WF-07 Leaderboard

```text
┌────────────────────────────────────────────┐
│ [I1] LEADERBOARD   [A1] Daily Weekly All   │
│────────────────────────────────────────────│
│ #1  NEOFOX   3521   1180/1140/1201         │
│ #2  BASSRAT  3489   1330/1010/1149         │
│ #3  YOU      3128   1224/964/940           │
│                                            │
│ [A2] Back                                 │
└────────────────────────────────────────────┘
```

---

## WF-08 Admin Theme Lab (Hidden)

```text
┌────────────────────────────────────────────┐
│ [I1] THEME LAB (ADMIN)                     │
│                                            │
│ [A1] Theme: Neon | Rave | CRT              │
│ [A2] Persist Override [on/off]             │
│ [A3] Cycle Per Restart [on/off]            │
│ [A4] Reset to Default                      │
│                                            │
│ [I2] FPS: 58   Contrast: PASS              │
│ [I3] Token Hash: 8f7a...                   │
│                                            │
│ [A5] Close                                 │
└────────────────────────────────────────────┘
```

---

## Game-Specific HUD Inserts (within WF-02 shell)

### Rhythm Serpent Insert
- `[I5] Beat Ring`
- `[I6] Power Status` (Bass Drop / Encore / Mosh Burst)

### Mosh Pit Pac-Man Insert
- `[I5] Zone Meter` (Drums, Bass, Synth, Lead, Vocals)

### Amp Invaders Insert
- `[I5] Wave Meter`
- `[I6] Genre Badge` (Jazz -> Rock -> EDM -> Metal)

---

## Interaction Flow (Primary)
1. WF-00 -> WF-01 -> WF-02(Stage1)
2. WF-02 -> WF-03 -> WF-04 -> WF-02(Stage2)
3. WF-02 -> WF-03 -> WF-04 -> WF-02(Stage3)
4. WF-02 end-of-run -> WF-06 -> WF-07 or restart

Admin branch:
1. WF-01 hidden trigger -> WF-08

---

## Locked Review Outcomes
1. Wireframe detail level accepted for v1.
2. Early-death screen primary action is `Retry Here`.
3. Stage split stats are sufficient for v1 competitive trust.
