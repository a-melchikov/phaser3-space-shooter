import type { CombatCaps, EnemyArchetypeId, PowerUpType, ProgressionStageConfig } from "../types/combat";
import { TEXTURE_KEYS } from "../utils/constants";

export const BOSS_WAVE_INTERVAL = 5;
export const BOSS_REPEAT_START_WAVE = 30;
export const WAVE_TRANSITION_MS = 1800;
export const BOSS_TRANSITION_MS = 2200;
export const WAVE_BATCH_RETRY_MS = 220;
export const SOFT_SPAWN_LANES = 5;

export const GLOBAL_COMBAT_CAPS = {
  maxActiveEnemies: 16,
  maxEnemyBullets: 84,
  maxMines: 5,
  maxEliteEnemies: 3,
  maxSnipers: 2,
  maxTurrets: 2,
  maxBossAdds: 4,
  globalMaxEnemies: 16,
  globalMaxEnemyBullets: 84,
  globalMaxMines: 5
} as const satisfies CombatCaps;

export const PLAYER_CONFIG = {
  width: 42,
  height: 48,
  speed: 332,
  maxHealth: 100,
  startingLives: 3,
  fireCooldownMs: 170,
  bulletSpeed: 520,
  bulletDamage: 1.15,
  invulnerabilityMs: 1100,
  respawnInvulnerabilityMs: 1500,
  respawnDelayMs: 450,
  damageBoostMultiplier: 1.35,
  supportDroneDamage: 0.6,
  supportDroneFireCooldownMs: 650
} as const;

export const POWER_UP_LABELS: Record<PowerUpType, string> = {
  heal: "Ремонт",
  doubleShot: "Двойной выстрел",
  shield: "Щит",
  damageBoost: "Усиление урона",
  supportDrone: "Дрон-помощник"
};

export const POWER_UP_TEXTURES: Record<PowerUpType, string> = {
  heal: TEXTURE_KEYS.powerHeal,
  doubleShot: TEXTURE_KEYS.powerDoubleShot,
  shield: TEXTURE_KEYS.powerShield,
  damageBoost: TEXTURE_KEYS.powerDamageBoost,
  supportDrone: TEXTURE_KEYS.powerSupportDrone
};

export const POWER_UP_DURATIONS_MS = {
  doubleShot: 8000,
  shield: 6000,
  damageBoost: 8000,
  supportDrone: 10000
} as const;

export const POWER_UP_DROP_CHANCE: Record<EnemyArchetypeId | "boss", number> = {
  basic: 0.11,
  fast: 0.13,
  heavy: 0.18,
  sniper: 0.17,
  kamikaze: 0.14,
  mineLayer: 0.16,
  turret: 0.18,
  tank: 0.22,
  boss: 1
};

export const SCORE_VALUES = {
  bossHit: 5,
  bossKill: 2000,
  powerUpPickup: 50,
  mineDestroy: 40
} as const;

export const POWER_UP_UNLOCK_WAVES: Record<PowerUpType, number> = {
  heal: 1,
  doubleShot: 1,
  shield: 1,
  damageBoost: 6,
  supportDrone: 11
};

export const PROGRESSION_STAGES: readonly ProgressionStageConfig[] = [
  {
    id: "early",
    minWave: 1,
    maxWave: 5,
    caps: {
      ...GLOBAL_COMBAT_CAPS,
      maxActiveEnemies: 7,
      maxEnemyBullets: 26,
      maxMines: 0,
      maxEliteEnemies: 0,
      maxSnipers: 0,
      maxTurrets: 0,
      maxBossAdds: 0
    },
    enemySpeedMultiplier: 1,
    enemyFireRateMultiplier: 1,
    enemyBulletSpeedMultiplier: 1,
    budgetBase: 7,
    budgetPerWave: 1.8,
    dropBonus: 0
  },
  {
    id: "mid",
    minWave: 6,
    maxWave: 10,
    caps: {
      ...GLOBAL_COMBAT_CAPS,
      maxActiveEnemies: 9,
      maxEnemyBullets: 40,
      maxMines: 2,
      maxEliteEnemies: 1,
      maxSnipers: 1,
      maxTurrets: 1,
      maxBossAdds: 2
    },
    enemySpeedMultiplier: 1.06,
    enemyFireRateMultiplier: 0.94,
    enemyBulletSpeedMultiplier: 1.05,
    budgetBase: 10,
    budgetPerWave: 2,
    dropBonus: 0.03
  },
  {
    id: "late",
    minWave: 11,
    maxWave: 15,
    caps: {
      ...GLOBAL_COMBAT_CAPS,
      maxActiveEnemies: 12,
      maxEnemyBullets: 56,
      maxMines: 3,
      maxEliteEnemies: 2,
      maxSnipers: 1,
      maxTurrets: 2,
      maxBossAdds: 3
    },
    enemySpeedMultiplier: 1.12,
    enemyFireRateMultiplier: 0.88,
    enemyBulletSpeedMultiplier: 1.1,
    budgetBase: 12,
    budgetPerWave: 2.2,
    dropBonus: 0.05
  },
  {
    id: "endless",
    minWave: 16,
    caps: {
      ...GLOBAL_COMBAT_CAPS,
      maxActiveEnemies: 14,
      maxEnemyBullets: 68,
      maxMines: 4,
      maxEliteEnemies: 3,
      maxSnipers: 2,
      maxTurrets: 2,
      maxBossAdds: 4
    },
    enemySpeedMultiplier: 1.18,
    enemyFireRateMultiplier: 0.82,
    enemyBulletSpeedMultiplier: 1.16,
    budgetBase: 14,
    budgetPerWave: 2.5,
    dropBonus: 0.06
  }
] as const;

export function getProgressionStageConfig(wave: number): ProgressionStageConfig {
  return PROGRESSION_STAGES.find((stage) => wave >= stage.minWave && (stage.maxWave === undefined || wave <= stage.maxWave))
    ?? PROGRESSION_STAGES[PROGRESSION_STAGES.length - 1];
}

export function isBossWave(wave: number): boolean {
  return wave % BOSS_WAVE_INTERVAL === 0;
}

export function isEliteWave(wave: number): boolean {
  return wave >= 8 && (wave - 8) % 5 === 0;
}

export function getAvailablePowerUpTypes(wave: number): PowerUpType[] {
  return (Object.keys(POWER_UP_UNLOCK_WAVES) as PowerUpType[]).filter((type) => wave >= POWER_UP_UNLOCK_WAVES[type]);
}
