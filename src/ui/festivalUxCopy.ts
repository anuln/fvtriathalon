export const bootCopy = {
  titleTop: "FESTIVERSE",
  titleBottom: "ARCADE TRIATHLON",
  strap: "3 stages. 1 timer. Chase the headline.",
  hint: "Tap in. Audio on. Crowd up.",
  startCta: "START",
  stageLabels: ["RHYTHM SERPENT", "MOSH PIT PAC-MAN", "AMP INVADERS"] as const,
  rules: "Lock in after 60s. No rewinds."
} as const;

export const deathPauseCopy = {
  title: "SET BREAK",
  subtitle: "Lights breathe. Crowd waits."
} as const;

export const deathChoiceCopy = {
  title: "CROWD CHECK",
  subtitle: "Run it back or lock this stage and move.",
  primaryCta: "RUN IT BACK",
  secondaryCta: "LOCK & NEXT"
} as const;

export const transitionCopy = {
  cta: "DROP IN",
  nextPrefix: "UP NEXT"
} as const;

export const resultsCopy = {
  title: "HEADLINER TRIATHLON SCORE",
  initialsLabel: "TAG",
  initialsHint: "Enter 3 initials",
  submitCta: "SUBMIT SCORE",
  submitPendingCta: "LOCKING...",
  submittedCta: "SCORE LOCKED",
  leaderboardCta: "VIEW BOARD",
  playAgainCta: "RUN AGAIN",
  stageTotalLabel: "SET TOTAL",
  timeBonusLabel: "TIME HYPE BONUS",
  finalLabel: "FINAL"
} as const;

export const leaderboardCopy = {
  title: "FESTIVAL BOARD",
  empty: "No scores yet. Drop the first set.",
  loading: "Loading board...",
  syncError: "Board sync failed. Showing cached ranks.",
  pendingSubmitHint: "Submit this run to claim rank.",
  backCta: "BACK"
} as const;
