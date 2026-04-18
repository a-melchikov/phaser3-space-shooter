export type ProgressionStage = "early" | "mid" | "late" | "endless";
export type WaveKind = "normal" | "elite" | "boss";
export type WaveThemeId =
  | "onboarding"
  | "swarm"
  | "heavyIntro"
  | "fastMix"
  | "marksmanIntro"
  | "rammerIntro"
  | "mixedElite"
  | "minefield"
  | "siege"
  | "tankWall"
  | "crossfire"
  | "fastAssault"
  | "sniperNest"
  | "bulwarkAssault"
  | "endlessMixer"
  | "bossEncounter";

export type EnemyRole = "common" | "special" | "elite";
export type EnemyArchetypeId =
  | "basic"
  | "fast"
  | "heavy"
  | "sniper"
  | "kamikaze"
  | "mineLayer"
  | "turret"
  | "tank";
export type EnemyVariant = "normal" | "smart" | "elite";
export type EnemyPattern = "straight" | "zigzag" | "sniperHold" | "dash" | "mineDrift" | "anchor" | "tank";

export type BossId =
  | "bulwarkHowitzer"
  | "blinkReaver"
  | "broodCarrier"
  | "prismBeamArray"
  | "aegisCoreMatrix";

export type BossPhaseId = "phase1" | "phase2" | "phase3";
export type PowerUpType = "heal" | "doubleShot" | "shield" | "damageBoost" | "supportDrone";

export interface VectorLike {
  x: number;
  y: number;
}

export interface TelegraphSpec {
  kind: "aimLine" | "chargeRing" | "beamLine" | "impactMarker" | "muzzleFlash";
  durationMs: number;
  color: number;
  alpha?: number;
  lineWidth?: number;
  width?: number;
  radius?: number;
  start?: VectorLike;
  end?: VectorLike;
  position?: VectorLike;
}

export interface CombatCaps {
  maxActiveEnemies: number;
  maxEnemyBullets: number;
  maxMines: number;
  maxEliteEnemies: number;
  maxSnipers: number;
  maxTurrets: number;
  maxBossAdds: number;
  globalMaxEnemies: number;
  globalMaxEnemyBullets: number;
  globalMaxMines: number;
}

export interface PlannedEnemySpawn {
  archetype: EnemyArchetypeId;
  variant: EnemyVariant;
  role: EnemyRole;
  lane: number;
  source: "wave" | "boss";
}

export interface SpawnBatch {
  enemies: PlannedEnemySpawn[];
  delayAfterMs: number;
  allowLaneReuse?: boolean;
  label?: string;
}

export interface WavePlan {
  wave: number;
  stage: ProgressionStage;
  kind: WaveKind;
  theme: WaveThemeId;
  bannerText: string;
  subtitle: string;
  caps: CombatCaps;
  dropBonus: number;
  spawnBatches: SpawnBatch[];
  bossId?: BossId;
  bossCycle: number;
}

export interface PlayerCombatSnapshot {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
}

export interface FireProjectileOptions {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  damage: number;
  tint?: number;
  scaleX?: number;
  scaleY?: number;
  angle?: number;
}

export interface EnemyDefinition {
  id: EnemyArchetypeId;
  role: EnemyRole;
  textureKey: string;
  width: number;
  height: number;
  color: number;
  pattern: EnemyPattern;
  introWave: number;
  baseHealth: number;
  contactDamage: number;
  score: number;
  baseSpeed: number;
  speedPerStage: number;
  canShoot: boolean;
  bulletSpeed: number;
  bulletDamage: number;
  shotCooldownMinMs: number;
  shotCooldownMaxMs: number;
  zigzagAmplitude?: number;
  zigzagFrequency?: number;
  preferredY?: number;
  strafeSpeed?: number;
  telegraphDurationMs?: number;
  predictiveLeadMs?: number;
  dashChargeMs?: number;
  dashSpeed?: number;
  dashCooldownMs?: number;
  mineDropMinMs?: number;
  mineDropMaxMs?: number;
  mineLifetimeMs?: number;
  mineArmMs?: number;
  anchorY?: number;
  burstCount?: number;
  burstSpacingMs?: number;
  burstSpreadRadians?: number;
  spreadShotCount?: number;
  spreadRadians?: number;
}

export interface BossDefinition {
  id: BossId;
  name: string;
  textureKey: string;
  color: number;
  width: number;
  height: number;
  baseHealth: number;
  contactDamage: number;
  enterSpeed: number;
  targetY: number;
  moveSpeed: number;
  score: number;
  phaseThresholds: readonly [number, number];
  repeatHealthMultiplier: number;
  repeatMoveMultiplier: number;
  repeatCooldownMultiplier: number;
}

export interface ProgressionStageConfig {
  id: ProgressionStage;
  minWave: number;
  maxWave?: number;
  caps: CombatCaps;
  enemySpeedMultiplier: number;
  enemyFireRateMultiplier: number;
  enemyBulletSpeedMultiplier: number;
  budgetBase: number;
  budgetPerWave: number;
  dropBonus: number;
}

export interface WeightedEnemyPick {
  archetype: EnemyArchetypeId;
  weight: number;
  variant?: EnemyVariant;
  minWave?: number;
}

export interface TemplateBatchSeed {
  enemies: ReadonlyArray<{
    archetype: EnemyArchetypeId;
    lane: number;
    variant?: EnemyVariant;
  }>;
  delayAfterMs: number;
  allowLaneReuse?: boolean;
}

export interface WaveThemeTemplate {
  id: WaveThemeId;
  label: string;
  batchSizeMin: number;
  batchSizeMax: number;
  batchDelayMinMs: number;
  batchDelayMaxMs: number;
  budgetMultiplier: number;
  allowLaneReuse: boolean;
  weightedPool: readonly WeightedEnemyPick[];
  forcedBatches?: readonly TemplateBatchSeed[];
}
