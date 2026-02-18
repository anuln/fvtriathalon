export type EnemyBulletHitInput = {
  bulletX: number;
  bulletY: number;
  width: number;
  height: number;
  playerXNorm: number;
  shields: ReadonlyArray<number>;
};

export type EnemyBulletHitResult = {
  consumed: boolean;
  playerHit: boolean;
  shieldIndex: 0 | 1 | 2 | null;
  shieldDamage: number;
};

export function resolveEnemyBulletHit(input: EnemyBulletHitInput): EnemyBulletHitResult {
  const { bulletX, bulletY, width, height, playerXNorm, shields } = input;
  const shieldIndex = (bulletX < width / 3 ? 0 : bulletX < (width * 2) / 3 ? 1 : 2) as 0 | 1 | 2;
  const shieldX = ((shieldIndex + 0.5) * width) / 3;
  const shieldY = height - 150;
  const shieldAlive = (shields[shieldIndex] ?? 0) > 0;
  if (shieldAlive && Math.abs(bulletX - shieldX) < 58 && Math.abs(bulletY - shieldY) < 24) {
    return {
      consumed: true,
      playerHit: false,
      shieldIndex,
      shieldDamage: 12
    };
  }

  const playerX = playerXNorm * width;
  const playerY = height - 70;
  if (Math.abs(bulletX - playerX) < 26 && Math.abs(bulletY - playerY) < 24) {
    return {
      consumed: true,
      playerHit: true,
      shieldIndex: null,
      shieldDamage: 0
    };
  }

  return {
    consumed: false,
    playerHit: false,
    shieldIndex: null,
    shieldDamage: 0
  };
}
