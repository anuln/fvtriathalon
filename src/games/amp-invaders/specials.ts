import {
  type SpecialKind,
  type Stage3V2Config,
  getSpecialSpawnSpec
} from "./stage3v2Config";

type SpecialState = "telegraph" | "diving";

export type SpecialEntity = {
  id: string;
  kind: SpecialKind;
  state: SpecialState;
  x: number;
  y: number;
  telegraphMsRemaining: number;
  speed: number;
  consumed: boolean;
};

export type SpecialsState = {
  config: Stage3V2Config;
  entities: SpecialEntity[];
  nextSpawnAtMs: Record<SpecialKind, number>;
  totalSpawns: number;
  lastSpawnKind: SpecialKind | null;
  sequence: number;
};

export type UpdateSpecialsInput = {
  dtMs: number;
  elapsedMs: number;
  wave: number;
  width: number;
  height: number;
  bossActive: boolean;
};

export function createSpecialsState(config: Stage3V2Config): SpecialsState {
  return {
    config,
    entities: [],
    nextSpawnAtMs: {
      diveBomber: getSpecialSpawnSpec(config, "diveBomber").cooldownMs,
      shieldBreaker: getSpecialSpawnSpec(config, "shieldBreaker").cooldownMs
    },
    totalSpawns: 0,
    lastSpawnKind: null,
    sequence: 0
  };
}

function nextLaneX(elapsedMs: number, width: number, sequence: number): number {
  const lanes = 5;
  const lane = (Math.floor(elapsedMs / 900) + sequence * 3) % lanes;
  return ((lane + 0.5) * width) / lanes;
}

export function updateSpecials(
  state: SpecialsState,
  input: UpdateSpecialsInput
): void {
  const useConfig = state.config;

  const activeHighThreat = state.entities.some((entity) => !entity.consumed);
  if (!input.bossActive && !activeHighThreat) {
    const kinds: SpecialKind[] = input.wave >= 4 ? ["shieldBreaker", "diveBomber"] : ["diveBomber", "shieldBreaker"];
    for (const kind of kinds) {
      const spec = getSpecialSpawnSpec(useConfig, kind);
      if (input.wave < spec.startWave) {
        continue;
      }
      if (input.elapsedMs < state.nextSpawnAtMs[kind]) {
        continue;
      }
      state.sequence += 1;
      state.entities.push({
        id: `${kind}-${state.sequence}`,
        kind,
        state: "telegraph",
        x: nextLaneX(input.elapsedMs, input.width, state.sequence),
        y: -28,
        telegraphMsRemaining: spec.telegraphMs,
        speed: spec.speed,
        consumed: false
      });
      state.nextSpawnAtMs[kind] = input.elapsedMs + spec.cooldownMs;
      state.totalSpawns += 1;
      state.lastSpawnKind = kind;
      break;
    }
  }

  for (const entity of state.entities) {
    if (entity.consumed) {
      continue;
    }
    if (entity.state === "telegraph") {
      entity.telegraphMsRemaining -= input.dtMs;
      if (entity.telegraphMsRemaining <= 0) {
        entity.telegraphMsRemaining = 0;
        entity.state = "diving";
      }
      continue;
    }

    entity.y += entity.speed * (input.dtMs / 1000);
    if (entity.y > input.height + 80) {
      entity.consumed = true;
    }
  }

  for (let i = state.entities.length - 1; i >= 0; i -= 1) {
    if (state.entities[i].consumed) {
      state.entities.splice(i, 1);
    }
  }
}
