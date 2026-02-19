import { type Stage3V2Config, getBossPhaseSpec } from "./stage3v2Config";

export type BossAttackPattern = "sweep" | "volley" | "enrageBurst" | "verticalLaser" | "seekerSwarm";

export type BossEvent = {
  attackFired: boolean;
  pattern: BossAttackPattern | null;
  phase: 1 | 2 | 3 | null;
};

export type BossState = {
  active: boolean;
  defeated: boolean;
  hp: number;
  maxHp: number;
  phase: 1 | 2 | 3;
  telegraphActive: boolean;
  telegraphPattern: BossAttackPattern | null;
  attackTimerMs: number;
  totalAttacks: number;
  lastAttackPattern: BossAttackPattern | null;
};

function resolvePhase(config: Stage3V2Config, hp: number): 1 | 2 | 3 {
  const ratio = hp / config.boss.maxHp;
  const p1 = getBossPhaseSpec(config, 1);
  const p2 = getBossPhaseSpec(config, 2);
  if (ratio <= p2.hpThreshold) {
    return 3;
  }
  if (ratio <= p1.hpThreshold) {
    return 2;
  }
  return 1;
}

export function createBossDirector(config: Stage3V2Config): {
  enter: () => void;
  update: (dtMs: number) => BossEvent;
  applyDamage: (damage: number) => void;
  getState: () => BossState;
  isDefeated: () => boolean;
} {
  let state: BossState = {
    active: false,
    defeated: false,
    hp: config.boss.maxHp,
    maxHp: config.boss.maxHp,
    phase: 1,
    telegraphActive: false,
    telegraphPattern: null,
    attackTimerMs: getBossPhaseSpec(config, 1).attackCooldownMs,
    totalAttacks: 0,
    lastAttackPattern: null
  };

  function attackPatternForPhase(phase: 1 | 2 | 3, attackIndex: number): BossAttackPattern {
    if (phase === 1) {
      const phase1Sequence: BossAttackPattern[] = ["sweep", "volley", "sweep"];
      return phase1Sequence[((attackIndex % phase1Sequence.length) + phase1Sequence.length) % phase1Sequence.length] ?? "sweep";
    }
    if (phase === 2) {
      const phase2Sequence: BossAttackPattern[] = ["volley", "verticalLaser", "seekerSwarm", "volley"];
      return phase2Sequence[((attackIndex % phase2Sequence.length) + phase2Sequence.length) % phase2Sequence.length] ?? "volley";
    }
    const phase3Sequence: BossAttackPattern[] = ["verticalLaser", "enrageBurst", "seekerSwarm", "enrageBurst", "verticalLaser"];
    return phase3Sequence[((attackIndex % phase3Sequence.length) + phase3Sequence.length) % phase3Sequence.length] ?? "enrageBurst";
  }

  return {
    enter() {
      state = {
        ...state,
        active: true,
        defeated: false,
        hp: config.boss.maxHp,
        phase: 1,
        telegraphActive: false,
        telegraphPattern: null,
        attackTimerMs: getBossPhaseSpec(config, 1).attackCooldownMs,
        lastAttackPattern: null,
        totalAttacks: 0
      };
    },
    update(dtMs: number) {
      if (!state.active || state.defeated) {
        return { attackFired: false, pattern: null, phase: null };
      }

      const phaseSpec = getBossPhaseSpec(config, state.phase);
      const pendingPattern = attackPatternForPhase(state.phase, state.totalAttacks);
      state.attackTimerMs -= dtMs;

      if (state.attackTimerMs <= phaseSpec.telegraphMs) {
        state.telegraphActive = true;
        state.telegraphPattern = pendingPattern;
      }

      if (state.attackTimerMs > 0) {
        return { attackFired: false, pattern: null, phase: null };
      }

      const pattern = pendingPattern;
      state.totalAttacks += 1;
      state.lastAttackPattern = pattern;
      state.telegraphActive = false;
      state.telegraphPattern = null;
      state.attackTimerMs = getBossPhaseSpec(config, state.phase).attackCooldownMs;
      return { attackFired: true, pattern, phase: state.phase };
    },
    applyDamage(damage: number) {
      if (!state.active || state.defeated) {
        return;
      }
      state.hp = Math.max(0, state.hp - Math.max(0, Math.round(damage)));
      state.phase = resolvePhase(config, state.hp);
      if (state.hp <= 0) {
        state.defeated = true;
        state.active = false;
        state.telegraphPattern = null;
      }
    },
    getState() {
      return { ...state };
    },
    isDefeated() {
      return state.defeated;
    }
  };
}
