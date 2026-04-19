import { GAME_BUILD_VERSION } from "../config/build";
import type { BossId, EnemyArchetypeId, EnemyRole, EnemyVariant, PlannedEnemySpawn, PowerUpType, ProgressionStage, SpawnBatch, WaveKind, WavePlan, WaveThemeId } from "../types/combat";
import type {
  ResumeMetadata,
  RunSnapshot,
  SavedBossState,
  SavedEnemyState,
  SavedMineState,
  SavedPlayerState,
  SavedPowerUpState,
  SavedRunState,
  SavedWaveProgressState,
  SavedWorldPowerUpState
} from "../types/runState";
import { RUN_STATE_SAVE_VERSION } from "../types/runState";
import { STORAGE_KEYS } from "../utils/constants";

const MAX_RESTORABLE_ENEMIES = 48;
const MAX_RESTORABLE_POWER_UPS = 14;
const MAX_RESTORABLE_MINES = 8;

interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

class SafeLocalStorageAdapter implements StorageAdapter {
  public getItem(key: string): string | null {
    try {
      if (typeof window === "undefined" || !window.localStorage) {
        return null;
      }

      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  public setItem(key: string, value: string): void {
    try {
      if (typeof window === "undefined" || !window.localStorage) {
        return;
      }

      window.localStorage.setItem(key, value);
    } catch {
      // Run resume is best-effort and should not break gameplay.
    }
  }

  public removeItem(key: string): void {
    try {
      if (typeof window === "undefined" || !window.localStorage) {
        return;
      }

      window.localStorage.removeItem(key);
    } catch {
      // Ignore storage cleanup failures.
    }
  }
}

export class RunStateStore {
  public constructor(
    private readonly storage: StorageAdapter = new SafeLocalStorageAdapter(),
    private readonly storageKey = STORAGE_KEYS.runState
  ) {}

  public save(run: RunSnapshot): SavedRunState {
    const payload: SavedRunState = {
      version: RUN_STATE_SAVE_VERSION,
      buildVersion: GAME_BUILD_VERSION,
      savedAt: new Date().toISOString(),
      activeRun: true,
      run
    };

    this.storage.setItem(this.storageKey, JSON.stringify(payload));
    return payload;
  }

  public load(): SavedRunState | null {
    const raw = this.storage.getItem(this.storageKey);
    if (!raw) {
      return null;
    }

    try {
      const parsed: unknown = JSON.parse(raw);
      if (!this.validate(parsed)) {
        this.clear();
        return null;
      }

      return parsed;
    } catch {
      this.clear();
      return null;
    }
  }

  public clear(): void {
    this.storage.removeItem(this.storageKey);
  }

  public hasSavedRun(): boolean {
    return this.load() !== null;
  }

  public getResumeMetadata(): ResumeMetadata | null {
    const savedRun = this.load();
    if (!savedRun) {
      return null;
    }

    return {
      wave: savedRun.run.wave,
      score: savedRun.run.score,
      savedAt: savedRun.savedAt,
      waveKind: savedRun.run.waveKind,
      bossActive: savedRun.run.boss.active,
      sessionLabel: savedRun.run.session.displayName
    };
  }

  public validate(value: unknown): value is SavedRunState {
    if (!isRecord(value)) {
      return false;
    }

    if (value.version !== RUN_STATE_SAVE_VERSION) {
      return false;
    }

    if (value.buildVersion !== GAME_BUILD_VERSION) {
      return false;
    }

    if (!isIsoDateString(value.savedAt) || value.activeRun !== true) {
      return false;
    }

    return isRunSnapshot(value.run);
  }
}

function isRunSnapshot(value: unknown): value is RunSnapshot {
  if (!isRecord(value)) {
    return false;
  }

    return (
      isPositiveInteger(value.wave) &&
      isFiniteNumber(value.score) &&
      value.score >= 0 &&
      isRunPhase(value.phase) &&
      isWaveKind(value.waveKind) &&
      isSavedPlayerState(value.player) &&
      isSavedBossState(value.boss) &&
      (value.waveProgress === null || isSavedWaveProgressState(value.waveProgress)) &&
      isSessionPresentation(value.session)
    );
}

function isSavedPlayerState(value: unknown): value is SavedPlayerState {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isFiniteNumber(value.health) &&
    value.health >= 0 &&
    value.health <= 100 &&
    isFiniteNumber(value.lives) &&
    value.lives >= 0 &&
    value.lives <= 9 &&
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y) &&
    isFiniteNumber(value.invulnerableRemainingMs) &&
    value.invulnerableRemainingMs >= 0 &&
    Array.isArray(value.powerUps) &&
    value.powerUps.every((entry) => isSavedPowerUpState(entry))
  );
}

function isSavedPowerUpState(value: unknown): value is SavedPowerUpState {
  if (!isRecord(value)) {
    return false;
  }

  return isPowerUpType(value.type) && isFiniteNumber(value.remainingMs) && value.remainingMs >= 0;
}

function isSavedBossState(value: unknown): value is SavedBossState {
  if (!isRecord(value) || typeof value.active !== "boolean") {
    return false;
  }

  if (value.bossId !== undefined && !isBossId(value.bossId)) {
    return false;
  }

  if (value.health !== undefined && (!isFiniteNumber(value.health) || value.health < 0)) {
    return false;
  }

  if (value.maxHealth !== undefined && (!isFiniteNumber(value.maxHealth) || value.maxHealth <= 0)) {
    return false;
  }

  if (value.health !== undefined && value.maxHealth !== undefined && value.health > value.maxHealth) {
    return false;
  }

  if (value.x !== undefined && !isFiniteNumber(value.x)) {
    return false;
  }

  if (value.y !== undefined && !isFiniteNumber(value.y)) {
    return false;
  }

  return true;
}

function isSavedWaveProgressState(value: unknown): value is SavedWaveProgressState {
  if (!isRecord(value)) {
    return false;
  }

  if (!isWavePlan(value.plan)) {
    return false;
  }

  const maxRestorableEnemies = Math.min(
    MAX_RESTORABLE_ENEMIES,
    value.plan.caps.maxActiveEnemies,
    value.plan.caps.globalMaxEnemies
  );
  const maxRestorableMines = Math.min(
    MAX_RESTORABLE_MINES,
    value.plan.caps.maxMines,
    value.plan.caps.globalMaxMines
  );

  return (
    isNonNegativeInteger(value.nextBatchIndex) &&
    (value.pendingBatch === null || isSpawnBatch(value.pendingBatch)) &&
    isFiniteNumber(value.nextSpawnDelayMs) &&
    value.nextSpawnDelayMs >= 0 &&
    Array.isArray(value.activeEnemies) &&
    value.activeEnemies.length <= maxRestorableEnemies &&
    value.activeEnemies.every((entry) => isSavedEnemyState(entry)) &&
    Array.isArray(value.activePowerUps) &&
    value.activePowerUps.length <= MAX_RESTORABLE_POWER_UPS &&
    value.activePowerUps.every((entry) => isSavedWorldPowerUpState(entry)) &&
    Array.isArray(value.activeMines) &&
    value.activeMines.length <= maxRestorableMines &&
    value.activeMines.every((entry) => isSavedMineState(entry)) &&
    isSavedBossState(value.boss)
  );
}

function isSavedEnemyState(value: unknown): value is SavedEnemyState {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isPlannedEnemySpawn(value.spawn) &&
    isFiniteNumber(value.health) &&
    value.health > 0 &&
    isFiniteNumber(value.maxHealth) &&
    value.maxHealth > 0 &&
    value.health <= value.maxHealth &&
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y)
  );
}

function isSavedWorldPowerUpState(value: unknown): value is SavedWorldPowerUpState {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isPowerUpType(value.type) &&
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y) &&
    isFiniteNumber(value.remainingMs) &&
    value.remainingMs >= 0
  );
}

function isSavedMineState(value: unknown): value is SavedMineState {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y) &&
    isFiniteNumber(value.damage) &&
    value.damage >= 0 &&
    isFiniteNumber(value.armRemainingMs) &&
    value.armRemainingMs >= 0 &&
    isFiniteNumber(value.remainingMs) &&
    value.remainingMs >= 0 &&
    value.armRemainingMs <= value.remainingMs
  );
}

function isWavePlan(value: unknown): value is WavePlan {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isPositiveInteger(value.wave) &&
    isProgressionStage(value.stage) &&
    isWaveKind(value.kind) &&
    isWaveThemeId(value.theme) &&
    typeof value.bannerText === "string" &&
    typeof value.subtitle === "string" &&
    isCombatCaps(value.caps) &&
    isFiniteNumber(value.dropBonus) &&
    Array.isArray(value.spawnBatches) &&
    value.spawnBatches.every((entry) => isSpawnBatch(entry)) &&
    (value.bossId === undefined || isBossId(value.bossId)) &&
    isNonNegativeInteger(value.bossCycle)
  );
}

function isSpawnBatch(value: unknown): value is SpawnBatch {
  if (!isRecord(value)) {
    return false;
  }

  return (
    Array.isArray(value.enemies) &&
    value.enemies.every((entry) => isPlannedEnemySpawn(entry)) &&
    isFiniteNumber(value.delayAfterMs) &&
    value.delayAfterMs >= 0 &&
    (value.allowLaneReuse === undefined || typeof value.allowLaneReuse === "boolean") &&
    (value.label === undefined || typeof value.label === "string")
  );
}

function isPlannedEnemySpawn(value: unknown): value is PlannedEnemySpawn {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isEnemyArchetypeId(value.archetype) &&
    isEnemyVariant(value.variant) &&
    isEnemyRole(value.role) &&
    isNonNegativeInteger(value.lane) &&
    value.lane <= 4 &&
    (value.source === "wave" || value.source === "boss")
  );
}

function isCombatCaps(value: unknown): value is WavePlan["caps"] {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNonNegativeInteger(value.maxActiveEnemies) &&
    isNonNegativeInteger(value.maxEnemyBullets) &&
    isNonNegativeInteger(value.maxMines) &&
    isNonNegativeInteger(value.maxEliteEnemies) &&
    isNonNegativeInteger(value.maxSnipers) &&
    isNonNegativeInteger(value.maxTurrets) &&
    isNonNegativeInteger(value.maxBossAdds) &&
    isNonNegativeInteger(value.globalMaxEnemies) &&
    isNonNegativeInteger(value.globalMaxEnemyBullets) &&
    isNonNegativeInteger(value.globalMaxMines)
  );
}

function isSessionPresentation(value: unknown): value is RunSnapshot["session"] {
  if (!isRecord(value)) {
    return false;
  }

  return (
    (value.mode === "guest" || value.mode === "google") &&
    typeof value.displayName === "string" &&
    typeof value.rankedEligible === "boolean" &&
    typeof value.isGuest === "boolean"
  );
}

function isRunPhase(value: unknown): value is RunSnapshot["phase"] {
  return value === "playing" || value === "paused" || value === "transition";
}

function isWaveKind(value: unknown): value is WaveKind {
  return value === "normal" || value === "elite" || value === "boss";
}

function isProgressionStage(value: unknown): value is ProgressionStage {
  return value === "early" || value === "mid" || value === "late" || value === "endless";
}

function isWaveThemeId(value: unknown): value is WaveThemeId {
  return value === "onboarding" ||
    value === "swarm" ||
    value === "heavyIntro" ||
    value === "fastMix" ||
    value === "marksmanIntro" ||
    value === "rammerIntro" ||
    value === "mixedElite" ||
    value === "minefield" ||
    value === "siege" ||
    value === "tankWall" ||
    value === "crossfire" ||
    value === "fastAssault" ||
    value === "sniperNest" ||
    value === "bulwarkAssault" ||
    value === "endlessMixer" ||
    value === "bossEncounter";
}

function isPowerUpType(value: unknown): value is PowerUpType {
  return value === "heal" || value === "doubleShot" || value === "shield" || value === "damageBoost" || value === "supportDrone";
}

function isEnemyArchetypeId(value: unknown): value is EnemyArchetypeId {
  return value === "basic" ||
    value === "fast" ||
    value === "heavy" ||
    value === "sniper" ||
    value === "kamikaze" ||
    value === "mineLayer" ||
    value === "turret" ||
    value === "tank";
}

function isEnemyVariant(value: unknown): value is EnemyVariant {
  return value === "normal" || value === "smart" || value === "elite";
}

function isEnemyRole(value: unknown): value is EnemyRole {
  return value === "common" || value === "special" || value === "elite";
}

function isBossId(value: unknown): value is BossId {
  return value === "bulwarkHowitzer" ||
    value === "blinkReaver" ||
    value === "broodCarrier" ||
    value === "prismBeamArray" ||
    value === "aegisCoreMatrix";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isIsoDateString(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}
