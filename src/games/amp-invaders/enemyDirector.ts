import { type Stage3V2Config, getAggressionSpec } from "./stage3v2Config";

export type EnemyFirePattern = "single" | "dual" | "burst";

export type EnemyFirePlan = {
  cooldownMs: number;
  pattern: EnemyFirePattern;
  shots: number;
  speedScale: number;
};

export type ComputeEnemyFirePlanInput = {
  wave: number;
  elapsedMs: number;
  aliveEnemies: number;
};

export function createEnemyDirector(config: Stage3V2Config): {
  computeFirePlan: (input: ComputeEnemyFirePlanInput) => EnemyFirePlan;
} {
  return {
    computeFirePlan(input) {
      const wave = Math.max(1, Math.floor(input.wave));
      const elapsed = Math.max(0, input.elapsedMs);
      const alive = Math.max(0, Math.floor(input.aliveEnemies));
      const aggression = getAggressionSpec(config, wave);
      const pressure = Math.min(1, elapsed / 60_000);
      const cooldownRaw = aggression.baseFireCooldownMs - pressure * 180 - Math.min(120, alive * 2);
      const cooldownMs = Math.max(aggression.minFireCooldownMs, Math.round(cooldownRaw));
      const cycleSeed = Math.floor(elapsed / 800) + wave * 3 + alive;
      const cycleValue = ((cycleSeed % 17) + 17) % 17;
      const burstGate = aggression.burstChance * 17;

      let pattern: EnemyFirePattern = "single";
      if (wave >= 2 && cycleValue >= 9) {
        pattern = "dual";
      }
      if (wave >= 3 && cycleValue >= 17 - burstGate) {
        pattern = "burst";
      }

      const shots = pattern === "single" ? 1 : pattern === "dual" ? 2 : aggression.burstCount;
      return {
        cooldownMs,
        pattern,
        shots,
        speedScale: aggression.bulletSpeedScale
      };
    }
  };
}
