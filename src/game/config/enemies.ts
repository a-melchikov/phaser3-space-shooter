import type { EnemyArchetypeId, EnemyDefinition, EnemyRole, EnemyVariant, ProgressionStage } from "../types/combat";
import { TEXTURE_KEYS } from "../utils/constants";

export const ENEMY_DEFINITIONS: Record<EnemyArchetypeId, EnemyDefinition> = {
  basic: {
    id: "basic",
    role: "common",
    textureKey: TEXTURE_KEYS.enemyBasic,
    width: 24,
    height: 28,
    color: 0xff6b7a,
    pattern: "straight",
    introWave: 1,
    baseHealth: 1,
    contactDamage: 18,
    score: 100,
    baseSpeed: 118,
    speedPerStage: 10,
    canShoot: true,
    bulletSpeed: 255,
    bulletDamage: 9,
    shotCooldownMinMs: 2500,
    shotCooldownMaxMs: 3800,
    spreadShotCount: 1,
    spreadRadians: 0
  },
  fast: {
    id: "fast",
    role: "common",
    textureKey: TEXTURE_KEYS.enemyFast,
    width: 18,
    height: 24,
    color: 0xff9b74,
    pattern: "zigzag",
    introWave: 2,
    baseHealth: 1,
    contactDamage: 15,
    score: 145,
    baseSpeed: 190,
    speedPerStage: 12,
    canShoot: false,
    bulletSpeed: 0,
    bulletDamage: 0,
    shotCooldownMinMs: 999999,
    shotCooldownMaxMs: 999999,
    zigzagAmplitude: 30,
    zigzagFrequency: 4.6
  },
  heavy: {
    id: "heavy",
    role: "common",
    textureKey: TEXTURE_KEYS.enemyHeavy,
    width: 36,
    height: 42,
    color: 0xffd76c,
    pattern: "straight",
    introWave: 3,
    baseHealth: 4,
    contactDamage: 28,
    score: 280,
    baseSpeed: 92,
    speedPerStage: 8,
    canShoot: true,
    bulletSpeed: 300,
    bulletDamage: 13,
    shotCooldownMinMs: 1800,
    shotCooldownMaxMs: 2900,
    spreadShotCount: 2,
    spreadRadians: 0.24
  },
  sniper: {
    id: "sniper",
    role: "special",
    textureKey: TEXTURE_KEYS.enemySniper,
    width: 28,
    height: 32,
    color: 0x6ef2ff,
    pattern: "sniperHold",
    introWave: 6,
    baseHealth: 2,
    contactDamage: 20,
    score: 220,
    baseSpeed: 126,
    speedPerStage: 8,
    canShoot: true,
    bulletSpeed: 310,
    bulletDamage: 18,
    shotCooldownMinMs: 2400,
    shotCooldownMaxMs: 3000,
    preferredY: 118,
    strafeSpeed: 84,
    telegraphDurationMs: 700,
    predictiveLeadMs: 0
  },
  kamikaze: {
    id: "kamikaze",
    role: "special",
    textureKey: TEXTURE_KEYS.enemyKamikaze,
    width: 24,
    height: 28,
    color: 0xff7f50,
    pattern: "dash",
    introWave: 7,
    baseHealth: 1.5,
    contactDamage: 26,
    score: 180,
    baseSpeed: 210,
    speedPerStage: 12,
    canShoot: false,
    bulletSpeed: 0,
    bulletDamage: 0,
    shotCooldownMinMs: 999999,
    shotCooldownMaxMs: 999999,
    dashChargeMs: 450,
    dashSpeed: 430,
    dashCooldownMs: 999999
  },
  mineLayer: {
    id: "mineLayer",
    role: "special",
    textureKey: TEXTURE_KEYS.enemyMineLayer,
    width: 30,
    height: 34,
    color: 0x79f7c1,
    pattern: "mineDrift",
    introWave: 9,
    baseHealth: 3,
    contactDamage: 20,
    score: 260,
    baseSpeed: 118,
    speedPerStage: 8,
    canShoot: false,
    bulletSpeed: 0,
    bulletDamage: 0,
    shotCooldownMinMs: 999999,
    shotCooldownMaxMs: 999999,
    zigzagAmplitude: 26,
    zigzagFrequency: 3.2,
    mineDropMinMs: 2600,
    mineDropMaxMs: 3200,
    mineLifetimeMs: 7000,
    mineArmMs: 600
  },
  turret: {
    id: "turret",
    role: "special",
    textureKey: TEXTURE_KEYS.enemyTurret,
    width: 34,
    height: 36,
    color: 0xc39bff,
    pattern: "anchor",
    introWave: 11,
    baseHealth: 4,
    contactDamage: 26,
    score: 320,
    baseSpeed: 112,
    speedPerStage: 6,
    canShoot: true,
    bulletSpeed: 285,
    bulletDamage: 11,
    shotCooldownMinMs: 2100,
    shotCooldownMaxMs: 2800,
    anchorY: 132,
    burstCount: 3,
    burstSpacingMs: 110,
    burstSpreadRadians: 0.18,
    telegraphDurationMs: 420,
    predictiveLeadMs: 0
  },
  tank: {
    id: "tank",
    role: "elite",
    textureKey: TEXTURE_KEYS.enemyTank,
    width: 48,
    height: 54,
    color: 0xffb36a,
    pattern: "tank",
    introWave: 12,
    baseHealth: 8,
    contactDamage: 36,
    score: 450,
    baseSpeed: 72,
    speedPerStage: 4,
    canShoot: true,
    bulletSpeed: 275,
    bulletDamage: 14,
    shotCooldownMinMs: 2200,
    shotCooldownMaxMs: 3000,
    spreadShotCount: 3,
    spreadRadians: 0.34
  }
};

export const ENEMY_BUDGET_COSTS: Record<EnemyArchetypeId, number> = {
  basic: 1,
  fast: 1,
  heavy: 2,
  sniper: 3,
  kamikaze: 2,
  mineLayer: 3,
  turret: 3,
  tank: 4
};

export function getEnemyRole(archetype: EnemyArchetypeId, variant: EnemyVariant): EnemyRole {
  if (variant !== "normal" || archetype === "tank") {
    return "elite";
  }

  return ENEMY_DEFINITIONS[archetype].role;
}

export function getEnemyStageHealthMultiplier(stage: ProgressionStage, archetype: EnemyArchetypeId): number {
  if (archetype === "basic" || archetype === "fast") {
    return stage === "early" ? 1 : stage === "mid" ? 1.05 : stage === "late" ? 1.1 : 1.15;
  }

  if (archetype === "tank") {
    return stage === "late" ? 1.08 : stage === "endless" ? 1.15 : 1;
  }

  return stage === "early" ? 1 : stage === "mid" ? 1.08 : stage === "late" ? 1.12 : 1.18;
}
