import Phaser from "phaser";

import type { WaveManagerCallbacks } from "../types/game";
import { BANNER_DURATION_MS, BOSS_WAVE_INTERVAL } from "../utils/constants";
import {
  getEnemyBurstCount,
  getEnemyQuota,
  getEnemySpawnIntervalMs,
  pickEnemyTypeForWave
} from "../utils/enemyFactory";
import { randomBetween } from "../utils/helpers";

export class WaveManager {
  private currentWave = 1;
  private bossWave = false;
  private transitioning = false;
  private stopped = false;
  private enemyQuota = 0;
  private enemiesSpawned = 0;
  private spawnEvent?: Phaser.Time.TimerEvent;
  private transitionEvent?: Phaser.Time.TimerEvent;

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly callbacks: WaveManagerCallbacks
  ) {}

  public startRun(): void {
    this.shutdown();
    this.stopped = false;
    this.currentWave = 1;
    this.beginTransition(`Волна ${this.currentWave}`, () => {
      this.startWave(this.currentWave);
    });
  }

  public update(_time: number, _delta: number): void {
    if (this.stopped || this.transitioning) {
      return;
    }

    if (this.bossWave) {
      if (!this.callbacks.isBossAlive() && !this.callbacks.hasActiveEnemyProjectiles()) {
        this.advanceWave("Босс повержен");
      }
      return;
    }

    if (
      this.enemiesSpawned >= this.enemyQuota &&
      !this.callbacks.hasActiveEnemies() &&
      !this.callbacks.hasActiveEnemyProjectiles()
    ) {
      this.advanceWave(`Волна ${this.currentWave + 1}`);
    }
  }

  public getCurrentWave(): number {
    return this.currentWave;
  }

  public isBossWave(): boolean {
    return this.bossWave;
  }

  public isTransitioning(): boolean {
    return this.transitioning;
  }

  public shutdown(): void {
    this.spawnEvent?.remove(false);
    this.transitionEvent?.remove(false);
    this.spawnEvent = undefined;
    this.transitionEvent = undefined;
    this.transitioning = false;
    this.stopped = true;
    this.enemyQuota = 0;
    this.enemiesSpawned = 0;
  }

  private startWave(wave: number): void {
    if (this.stopped) {
      return;
    }

    this.currentWave = wave;
    this.bossWave = wave % BOSS_WAVE_INTERVAL === 0;
    this.callbacks.onWaveChanged(this.currentWave, this.bossWave);

    if (this.bossWave) {
      this.callbacks.spawnBoss(this.currentWave);
      return;
    }

    this.enemyQuota = getEnemyQuota(this.currentWave);
    this.enemiesSpawned = 0;
    this.scheduleNextSpawn();
  }

  private scheduleNextSpawn(): void {
    if (this.stopped || this.transitioning || this.bossWave || this.enemiesSpawned >= this.enemyQuota) {
      return;
    }

    const delay = getEnemySpawnIntervalMs(this.currentWave) * randomBetween(0.75, 1.15);
    this.spawnEvent = this.scene.time.delayedCall(delay, () => {
      if (this.stopped || this.transitioning || this.bossWave) {
        return;
      }

      const burstCount = Math.min(getEnemyBurstCount(this.currentWave), this.enemyQuota - this.enemiesSpawned);
      for (let index = 0; index < burstCount; index += 1) {
        this.callbacks.spawnEnemy(pickEnemyTypeForWave(this.currentWave));
        this.enemiesSpawned += 1;
      }

      this.scheduleNextSpawn();
    });
  }

  private advanceWave(bannerText: string): void {
    this.currentWave += 1;
    this.beginTransition(bannerText, () => {
      this.startWave(this.currentWave);
    });
  }

  private beginTransition(text: string, onComplete: () => void): void {
    this.transitioning = true;
    this.spawnEvent?.remove(false);
    this.spawnEvent = undefined;

    this.callbacks.onTransitionStateChange(true);
    this.callbacks.onBanner(text);

    this.transitionEvent = this.scene.time.delayedCall(BANNER_DURATION_MS, () => {
      this.transitioning = false;
      this.callbacks.onTransitionStateChange(false);
      onComplete();
    });
  }
}
