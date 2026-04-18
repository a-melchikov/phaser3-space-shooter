import { SOFT_SPAWN_LANES } from "../config/combat";
import { clamp, randomInt } from "./helpers";

export function clampSpawnLane(lane: number): number {
  return clamp(Math.round(lane), 0, SOFT_SPAWN_LANES - 1);
}

export function getSpawnLaneX(worldWidth: number, lane: number, halfWidth = 18): number {
  const safeHalfWidth = Math.max(halfWidth, 18);
  const left = safeHalfWidth + 26;
  const right = worldWidth - safeHalfWidth - 26;
  const usableWidth = Math.max(0, right - left);
  const laneIndex = clampSpawnLane(lane);

  if (SOFT_SPAWN_LANES <= 1) {
    return left + usableWidth * 0.5;
  }

  return left + usableWidth * (laneIndex / (SOFT_SPAWN_LANES - 1));
}

export function getSpawnY(): number {
  return randomInt(-110, -44);
}

export function buildLaneOrder(startLane = 0, allowReuse = false): number[] {
  const lanes = Array.from({ length: SOFT_SPAWN_LANES }, (_, index) => index);
  const offset = clampSpawnLane(startLane);
  const rotated = [...lanes.slice(offset), ...lanes.slice(0, offset)];
  return allowReuse ? [...rotated, ...rotated] : rotated;
}
