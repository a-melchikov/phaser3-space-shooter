import type { EnemyType } from "../types/game";

import { BOSS_WAVE_INTERVAL } from "./constants";
import { chance, randomBetween, randomInt } from "./helpers";

export function pickEnemyTypeForWave(wave: number): EnemyType {
  const roll = Math.random();

  if (wave < 2) {
    return "basic";
  }

  if (wave < 3) {
    return roll < 0.72 ? "basic" : "fast";
  }

  if (wave < BOSS_WAVE_INTERVAL) {
    if (roll < 0.45) {
      return "basic";
    }
    if (roll < 0.78) {
      return "fast";
    }
    return "heavy";
  }

  if (roll < 0.28) {
    return "basic";
  }
  if (roll < 0.7) {
    return "fast";
  }
  return "heavy";
}

export function getEnemySpawnIntervalMs(wave: number): number {
  return Math.max(380, 1050 - wave * 45);
}

export function getEnemyQuota(wave: number): number {
  return 8 + wave * 2;
}

export function getEnemyBurstCount(wave: number): number {
  return chance(Math.min(0.55, 0.2 + wave * 0.03)) ? 2 : 1;
}

export function getEnemySpawnX(worldWidth: number, isHeavy: boolean): number {
  const margin = isHeavy ? 42 : 24;
  return randomBetween(margin, worldWidth - margin);
}

export function getEnemySpawnY(): number {
  return randomInt(-90, -32);
}
