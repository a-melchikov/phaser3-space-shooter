import type { BossId, PlannedEnemySpawn, PowerUpType, SpawnBatch, WaveKind, WavePlan } from "./combat";
import type { EconomyRunStartState, RunEconomyProgressState } from "./economy";
import type { SessionPresentation } from "./game";

export const RUN_STATE_SAVE_VERSION = 3;

export type RunPhase = "playing" | "paused" | "transition";

export interface SavedPowerUpState {
  type: PowerUpType;
  remainingMs: number;
}

export interface SavedPlayerState {
  health: number;
  lives: number;
  x: number;
  y: number;
  invulnerableRemainingMs: number;
  powerUps: SavedPowerUpState[];
}

export interface SavedBossState {
  active: boolean;
  bossId?: BossId;
  health?: number;
  maxHealth?: number;
  x?: number;
  y?: number;
}

export interface SavedEnemyState {
  spawn: PlannedEnemySpawn;
  health: number;
  maxHealth: number;
  x: number;
  y: number;
}

export interface SavedWorldPowerUpState {
  type: PowerUpType;
  x: number;
  y: number;
  remainingMs: number;
}

export interface SavedMineState {
  x: number;
  y: number;
  damage: number;
  armRemainingMs: number;
  remainingMs: number;
}

export interface SavedWaveProgressState {
  plan: WavePlan;
  nextBatchIndex: number;
  pendingBatch: SpawnBatch | null;
  nextSpawnDelayMs: number;
  activeEnemies: SavedEnemyState[];
  activePowerUps: SavedWorldPowerUpState[];
  activeMines: SavedMineState[];
  boss: SavedBossState;
}

export interface RunSnapshot {
  wave: number;
  score: number;
  phase: RunPhase;
  waveKind: WaveKind;
  player: SavedPlayerState;
  boss: SavedBossState;
  waveProgress: SavedWaveProgressState | null;
  session: SessionPresentation;
  economyRun?: EconomyRunStartState;
  economyProgress?: RunEconomyProgressState;
}

export interface SavedRunState {
  version: number;
  buildVersion: string;
  savedAt: string;
  activeRun: true;
  run: RunSnapshot;
}

export interface ResumeMetadata {
  wave: number;
  score: number;
  savedAt: string;
  waveKind: WaveKind;
  bossActive: boolean;
  sessionLabel: string;
}
