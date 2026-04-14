export type EnemyType = "basic" | "fast" | "heavy";
export type EnemyPattern = "straight" | "zigzag";
export type PowerUpType = "heal" | "doubleShot" | "shield";

export interface HighscoreEntry {
  score: number;
  wave: number;
  date: string;
}

export interface GameStartPayload {
  source?: "menu" | "gameover";
}

export interface GameOverPayload {
  score: number;
  wave: number;
}

export interface ActivePowerUpState {
  type: PowerUpType;
  label: string;
  remainingMs: number;
}

export interface EnemyConfig {
  type: EnemyType;
  textureKey: string;
  width: number;
  height: number;
  maxHealth: number;
  baseSpeed: number;
  speedPerWave: number;
  contactDamage: number;
  score: number;
  pattern: EnemyPattern;
  zigzagAmplitude: number;
  zigzagFrequency: number;
  canShoot: boolean;
  shotCooldownMinMs: number;
  shotCooldownMaxMs: number;
  bulletSpeed: number;
  bulletDamage: number;
}

export interface BossConfig {
  textureKey: string;
  width: number;
  height: number;
  baseHealth: number;
  healthPerBoss: number;
  enterSpeed: number;
  moveSpeed: number;
  targetY: number;
  fireCooldownMs: number;
  bulletSpeed: number;
  bulletDamage: number;
  contactDamage: number;
  fanShotCount: number;
  fanSpread: number;
}

export interface WaveManagerCallbacks {
  onWaveChanged: (wave: number, bossWave: boolean) => void;
  onTransitionStateChange: (active: boolean) => void;
  onBanner: (text: string) => void;
  spawnEnemy: (type: EnemyType) => void;
  spawnBoss: (wave: number) => void;
  hasActiveEnemies: () => boolean;
  hasActiveEnemyProjectiles: () => boolean;
  isBossAlive: () => boolean;
}
