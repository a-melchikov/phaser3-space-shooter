import type { CombatTuning } from "../types/combat";

export const DEFAULT_COMBAT_TUNING = {
  enemyScaleMultiplier: 1,
  enemySpeedMultiplier: 1,
  enemyBulletSpeedMultiplier: 1,
  enemySpawnPressureMultiplier: 1,
  enemyCapMultiplier: 1,
  playerHitboxMultiplier: 1,
  touchFollowMaxSpeed: 640,
  touchFollowResponsiveness: 13,
  touchFollowStopDistance: 8
} as const satisfies CombatTuning;

export const MOBILE_COMBAT_TUNING = {
  enemyScaleMultiplier: 0.9,
  enemySpeedMultiplier: 0.9,
  enemyBulletSpeedMultiplier: 0.92,
  enemySpawnPressureMultiplier: 0.94,
  enemyCapMultiplier: 0.92,
  playerHitboxMultiplier: 0.88,
  touchFollowMaxSpeed: 640,
  touchFollowResponsiveness: 13,
  touchFollowStopDistance: 8
} as const satisfies CombatTuning;

export function resolveCombatTuning(useMobileTuning: boolean): CombatTuning {
  return useMobileTuning ? MOBILE_COMBAT_TUNING : DEFAULT_COMBAT_TUNING;
}
