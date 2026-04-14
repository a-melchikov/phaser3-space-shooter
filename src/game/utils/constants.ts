import type { BossConfig, EnemyConfig, EnemyType, PowerUpType } from "../types/game";

export const GAME_TITLE = "Starfall Aegis";
export const WORLD_WIDTH = 960;
export const WORLD_HEIGHT = 540;
export const HIGHSCORE_LIMIT = 5;
export const BOSS_WAVE_INTERVAL = 5;
export const BANNER_DURATION_MS = 1800;
export const CAMERA_SHAKE_STRONG = 0.008;
export const CAMERA_SHAKE_LIGHT = 0.0035;

export const STORAGE_KEYS = {
  legacyHighscores: "spaceShooterHighscoresV1",
  highscores: "spaceShooterHighscoresV2"
} as const;

export const TEXTURE_KEYS = {
  backgroundFar: "bg-stars-far",
  backgroundNear: "bg-stars-near",
  player: "ship-player",
  shieldRing: "shield-ring",
  enemyBasic: "enemy-basic",
  enemyFast: "enemy-fast",
  enemyHeavy: "enemy-heavy",
  boss: "enemy-boss",
  bulletPlayer: "bullet-player",
  bulletEnemy: "bullet-enemy",
  powerHeal: "power-heal",
  powerDoubleShot: "power-double-shot",
  powerShield: "power-shield",
  particle: "fx-particle",
  flash: "fx-flash"
} as const;

export const PLAYER_CONFIG = {
  width: 42,
  height: 48,
  speed: 320,
  maxHealth: 100,
  startingLives: 3,
  fireCooldownMs: 180,
  bulletSpeed: 520,
  invulnerabilityMs: 1000,
  respawnInvulnerabilityMs: 1500,
  respawnDelayMs: 450
} as const;

export const POWER_UP_LABELS: Record<PowerUpType, string> = {
  heal: "Ремонт",
  doubleShot: "Двойной выстрел",
  shield: "Щит"
};

export const POWER_UP_TEXTURES: Record<PowerUpType, string> = {
  heal: TEXTURE_KEYS.powerHeal,
  doubleShot: TEXTURE_KEYS.powerDoubleShot,
  shield: TEXTURE_KEYS.powerShield
};

export const POWER_UP_DURATIONS_MS = {
  doubleShot: 8000,
  shield: 6000
} as const;

export const POWER_UP_DROP_CHANCE: Record<EnemyType | "boss", number> = {
  basic: 0.12,
  fast: 0.15,
  heavy: 0.25,
  boss: 1
};

export const SCORE_VALUES = {
  bossHit: 5,
  bossKill: 2000,
  powerUpPickup: 50
} as const;

export const ENEMY_CONFIGS: Record<EnemyType, EnemyConfig> = {
  basic: {
    type: "basic",
    textureKey: TEXTURE_KEYS.enemyBasic,
    width: 24,
    height: 28,
    maxHealth: 1,
    baseSpeed: 112,
    speedPerWave: 6,
    contactDamage: 18,
    score: 100,
    pattern: "straight",
    zigzagAmplitude: 0,
    zigzagFrequency: 0,
    canShoot: true,
    shotCooldownMinMs: 2600,
    shotCooldownMaxMs: 4200,
    bulletSpeed: 240,
    bulletDamage: 9
  },
  fast: {
    type: "fast",
    textureKey: TEXTURE_KEYS.enemyFast,
    width: 18,
    height: 24,
    maxHealth: 1,
    baseSpeed: 176,
    speedPerWave: 7,
    contactDamage: 14,
    score: 150,
    pattern: "zigzag",
    zigzagAmplitude: 30,
    zigzagFrequency: 5,
    canShoot: false,
    shotCooldownMinMs: 999999,
    shotCooldownMaxMs: 999999,
    bulletSpeed: 0,
    bulletDamage: 0
  },
  heavy: {
    type: "heavy",
    textureKey: TEXTURE_KEYS.enemyHeavy,
    width: 36,
    height: 42,
    maxHealth: 4,
    baseSpeed: 84,
    speedPerWave: 4,
    contactDamage: 28,
    score: 300,
    pattern: "straight",
    zigzagAmplitude: 0,
    zigzagFrequency: 0,
    canShoot: true,
    shotCooldownMinMs: 1800,
    shotCooldownMaxMs: 3000,
    bulletSpeed: 280,
    bulletDamage: 14
  }
};

export const BOSS_CONFIG: BossConfig = {
  textureKey: TEXTURE_KEYS.boss,
  width: 164,
  height: 84,
  baseHealth: 120,
  healthPerBoss: 25,
  enterSpeed: 95,
  moveSpeed: 140,
  targetY: 86,
  fireCooldownMs: 1200,
  bulletSpeed: 310,
  bulletDamage: 12,
  contactDamage: 40,
  fanShotCount: 5,
  fanSpread: 0.64
};

export const UI_COLORS = {
  background: 0x06111f,
  panel: 0x0b1831,
  cyan: 0x6ef2ff,
  text: 0xeaf7ff,
  muted: 0x97bad5,
  gold: 0xffd76c,
  danger: 0xff6b7a,
  success: 0x79f7c1
} as const;
