export type AutoFireStep = {
  shots: number;
  cooldownMs: number;
};

export function stepAutoFire(cooldownMs: number, dtMs: number, intervalMs: number): AutoFireStep {
  let cooldown = cooldownMs - dtMs;
  let shots = 0;

  while (cooldown <= 0) {
    shots += 1;
    cooldown += intervalMs;
  }

  return { shots, cooldownMs: cooldown };
}

