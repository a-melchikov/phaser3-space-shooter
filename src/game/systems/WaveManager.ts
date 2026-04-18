import Phaser from "phaser";

import { WAVE_BATCH_RETRY_MS } from "../config/combat";
import type { WaveManagerCallbacks } from "../types/game";
import type { SpawnBatch, WavePlan } from "../types/combat";
import type { SavedWaveProgressState } from "../types/runState";
import { WavePlanner } from "./WavePlanner";

export class WaveManager {
  private currentWave = 1;
  private currentPlan?: WavePlan;
  private transitioning = false;
  private stopped = false;
  private batchIndex = 0;
  private pendingBatch?: SpawnBatch;
  private batchEvent?: Phaser.Time.TimerEvent;
  private transitionEvent?: Phaser.Time.TimerEvent;

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly callbacks: WaveManagerCallbacks,
    private readonly planner = new WavePlanner()
  ) {}

  public startRun(startWave = 1, skipInitialTransition = false): void {
    this.shutdown();
    this.stopped = false;
    this.currentWave = Math.max(1, Math.floor(startWave));

    const firstPlan = this.planner.createPlan(this.currentWave);
    if (skipInitialTransition) {
      this.transitioning = false;
      this.callbacks.onTransitionStateChange(false);
      this.startWave(firstPlan);
      return;
    }

    this.beginTransition(firstPlan, () => {
      this.startWave(firstPlan);
    });
  }

  public update(): void {
    if (this.stopped || this.transitioning || !this.currentPlan) {
      return;
    }

    if (this.currentPlan.kind === "boss") {
      if (
        !this.callbacks.isBossAlive() &&
        !this.callbacks.hasActiveEnemies() &&
        !this.callbacks.hasActiveEnemyProjectiles() &&
        !this.callbacks.hasActiveHazards()
      ) {
        this.advanceWave();
      }
      return;
    }

    const hasRemainingBatches = this.pendingBatch !== undefined || this.batchIndex < this.currentPlan.spawnBatches.length;
    if (!hasRemainingBatches && !this.callbacks.hasActiveEnemies() && !this.callbacks.hasActiveEnemyProjectiles() && !this.callbacks.hasActiveHazards()) {
      this.advanceWave();
    }
  }

  public getCurrentWave(): number {
    return this.currentWave;
  }

  public getCurrentPlan(): WavePlan | undefined {
    return this.currentPlan;
  }

  public captureProgress(): SavedWaveProgressState | null {
    if (!this.currentPlan) {
      return null;
    }

    return {
      plan: this.currentPlan,
      nextBatchIndex: this.batchIndex,
      pendingBatch: this.pendingBatch ?? null,
      nextSpawnDelayMs: Math.max(0, this.batchEvent?.getRemaining() ?? 0),
      activeEnemies: [],
      activePowerUps: [],
      activeMines: [],
      boss: {
        active: false
      }
    };
  }

  public isBossWave(): boolean {
    return this.currentPlan?.kind === "boss";
  }

  public isTransitioning(): boolean {
    return this.transitioning;
  }

  public getCheckpointWave(): number {
    if (!this.currentPlan) {
      return this.currentWave;
    }

    if (this.transitioning || this.isCurrentWaveCleared()) {
      return this.currentPlan.wave + 1;
    }

    return this.currentPlan.wave;
  }

  public shutdown(): void {
    this.batchEvent?.remove(false);
    this.transitionEvent?.remove(false);
    this.batchEvent = undefined;
    this.transitionEvent = undefined;
    this.pendingBatch = undefined;
    this.batchIndex = 0;
    this.currentPlan = undefined;
    this.transitioning = false;
    this.stopped = true;
  }

  public restoreProgress(progress: SavedWaveProgressState): void {
    this.shutdown();
    this.stopped = false;
    this.transitioning = false;
    this.currentWave = progress.plan.wave;
    this.currentPlan = progress.plan;
    this.batchIndex = Math.min(progress.nextBatchIndex, progress.plan.spawnBatches.length);
    this.pendingBatch = progress.pendingBatch ?? undefined;
    this.callbacks.onTransitionStateChange(false);
    this.callbacks.onWaveChanged(progress.plan);

    if (progress.plan.kind === "boss") {
      return;
    }

    const hasRemainingBatches = this.pendingBatch !== undefined || this.batchIndex < progress.plan.spawnBatches.length;
    if (hasRemainingBatches) {
      this.scheduleBatch(progress.nextSpawnDelayMs);
    }
  }

  private startWave(plan: WavePlan): void {
    if (this.stopped) {
      return;
    }

    this.currentWave = plan.wave;
    this.currentPlan = plan;
    this.pendingBatch = undefined;
    this.batchIndex = 0;
    this.callbacks.onWaveChanged(plan);

    if (plan.kind === "boss") {
      this.callbacks.spawnBoss(plan);
      return;
    }

    if (plan.spawnBatches.length === 0) {
      return;
    }

    this.scheduleBatch(0);
  }

  private scheduleBatch(delayMs: number): void {
    if (this.stopped || this.transitioning || !this.currentPlan || this.currentPlan.kind === "boss") {
      return;
    }

    this.batchEvent?.remove(false);
    this.batchEvent = this.scene.time.delayedCall(delayMs, () => {
      if (this.stopped || this.transitioning || !this.currentPlan || this.currentPlan.kind === "boss") {
        return;
      }

      const batch = this.pendingBatch ?? this.currentPlan.spawnBatches[this.batchIndex];
      if (!batch) {
        return;
      }

      const remainder = this.callbacks.spawnBatch(this.currentPlan, batch);
      if (remainder) {
        this.pendingBatch = remainder;
        this.scheduleBatch(WAVE_BATCH_RETRY_MS);
        return;
      }

      this.pendingBatch = undefined;
      this.batchIndex += 1;
      if (this.batchIndex < this.currentPlan.spawnBatches.length) {
        this.scheduleBatch(batch.delayAfterMs);
      }
    });
  }

  private advanceWave(): void {
    const nextWave = this.currentWave + 1;
    const nextPlan = this.planner.createPlan(nextWave);

    this.beginTransition(nextPlan, () => {
      this.startWave(nextPlan);
    });
  }

  private beginTransition(plan: WavePlan, onComplete: () => void): void {
    this.transitioning = true;
    this.batchEvent?.remove(false);
    this.batchEvent = undefined;
    this.pendingBatch = undefined;

    this.callbacks.onTransitionStateChange(true);
    this.callbacks.onBanner(plan.bannerText);

    this.transitionEvent = this.scene.time.delayedCall(this.planner.getTransitionDuration(plan), () => {
      this.transitioning = false;
      this.callbacks.onTransitionStateChange(false);
      onComplete();
    });
  }

  private isCurrentWaveCleared(): boolean {
    if (!this.currentPlan) {
      return false;
    }

    if (this.currentPlan.kind === "boss") {
      return (
        !this.callbacks.isBossAlive() &&
        !this.callbacks.hasActiveEnemies() &&
        !this.callbacks.hasActiveEnemyProjectiles() &&
        !this.callbacks.hasActiveHazards()
      );
    }

    const hasRemainingBatches =
      this.pendingBatch !== undefined || this.batchIndex < this.currentPlan.spawnBatches.length;

    return (
      !hasRemainingBatches &&
      !this.callbacks.hasActiveEnemies() &&
      !this.callbacks.hasActiveEnemyProjectiles() &&
      !this.callbacks.hasActiveHazards()
    );
  }
}
