export type TurnDir = "up" | "down" | "left" | "right";

export type MobileTurnAssistConfig = {
  maxQueue: number;
  ttlMs: number;
  blockOppositeTurns: boolean;
};

type PendingTurn = {
  dir: TurnDir;
  queuedAtMs: number;
};

export type MobileTurnAssistState = {
  config: MobileTurnAssistConfig;
  pending: PendingTurn[];
  acceptedTurns: number;
  expiredTurns: number;
  rejectedTurns: number;
  droppedTurns: number;
  lastTurnLatencyMs: number | null;
};

const OPPOSITE: Record<TurnDir, TurnDir> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left"
};

function isOppositeDirection(a: TurnDir, b: TurnDir): boolean {
  return OPPOSITE[a] === b;
}

function pruneExpiredTurns(state: MobileTurnAssistState, nowMs: number): void {
  while (state.pending.length > 0) {
    const head = state.pending[0];
    if (nowMs - head.queuedAtMs <= state.config.ttlMs) {
      return;
    }
    state.pending.shift();
    state.expiredTurns += 1;
  }
}

export function createMobileTurnAssistState(config: MobileTurnAssistConfig): MobileTurnAssistState {
  return {
    config,
    pending: [],
    acceptedTurns: 0,
    expiredTurns: 0,
    rejectedTurns: 0,
    droppedTurns: 0,
    lastTurnLatencyMs: null
  };
}

export function enqueueTurnIntent(state: MobileTurnAssistState, dir: TurnDir, nowMs: number): void {
  const last = state.pending[state.pending.length - 1];
  if (last?.dir === dir) {
    last.queuedAtMs = nowMs;
    return;
  }

  state.pending.push({ dir, queuedAtMs: nowMs });
  if (state.pending.length > state.config.maxQueue) {
    state.pending.shift();
    state.droppedTurns += 1;
  }
}

export function consumeTurnIntent(
  state: MobileTurnAssistState,
  nowMs: number,
  currentDir: TurnDir,
  isTurnAllowed: (dir: TurnDir) => boolean
): TurnDir | null {
  pruneExpiredTurns(state, nowMs);

  while (state.pending.length > 0) {
    const head = state.pending[0];
    if (state.config.blockOppositeTurns && isOppositeDirection(currentDir, head.dir)) {
      state.pending.shift();
      state.rejectedTurns += 1;
      continue;
    }
    if (!isTurnAllowed(head.dir)) {
      return null;
    }
    state.pending.shift();
    state.acceptedTurns += 1;
    state.lastTurnLatencyMs = Math.max(0, nowMs - head.queuedAtMs);
    return head.dir;
  }

  return null;
}

export function readTurnAssistTelemetry(state: MobileTurnAssistState) {
  return {
    pendingTurns: state.pending.length,
    acceptedTurns: state.acceptedTurns,
    expiredTurns: state.expiredTurns,
    rejectedTurns: state.rejectedTurns,
    droppedTurns: state.droppedTurns,
    lastTurnLatencyMs: state.lastTurnLatencyMs
  };
}
