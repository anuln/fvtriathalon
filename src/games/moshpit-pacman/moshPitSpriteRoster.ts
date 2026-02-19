export const MOSH_PIT_PLAYER_SPRITE_ID = "player_runner" as const;

export const MOSH_PIT_GUARD_VARIANTS = ["bouncer", "punker", "raver"] as const;

export type MoshPitGuardVariant = (typeof MOSH_PIT_GUARD_VARIANTS)[number];

export function getMosherGuardVariant(index: number): MoshPitGuardVariant {
  const total = MOSH_PIT_GUARD_VARIANTS.length;
  const normalized = ((Math.floor(index) % total) + total) % total;
  return MOSH_PIT_GUARD_VARIANTS[normalized] ?? "bouncer";
}
