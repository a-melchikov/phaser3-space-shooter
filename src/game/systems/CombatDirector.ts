import Phaser from "phaser";

import { ENEMY_DEFINITIONS } from "../config/enemies";
import { Enemy } from "../entities/Enemy";
import { EnemyBullet } from "../entities/EnemyBullet";
import { Mine } from "../entities/Mine";
import type { FireProjectileOptions, PlannedEnemySpawn, SpawnBatch, VectorLike, WavePlan } from "../types/combat";
import { getSpawnLaneX, getSpawnY } from "../utils/enemyFactory";
import { getViewportWidth } from "../utils/viewport";
import { TelegraphSystem } from "./TelegraphSystem";

interface CombatDirectorOptions {
  scene: Phaser.Scene;
  enemies: Phaser.Physics.Arcade.Group;
  enemyBullets: Phaser.Physics.Arcade.Group;
  mines: Phaser.Physics.Arcade.Group;
  getPlayerSnapshot: () => { x: number; y: number; velocityX: number; velocityY: number };
  telegraphs: TelegraphSystem;
  onEnemySpawn?: (enemy: Enemy) => void;
}

export class CombatDirector {
  private currentPlan?: WavePlan;

  public constructor(private readonly options: CombatDirectorOptions) {}

  public setWaveContext(plan: WavePlan): void {
    this.currentPlan = plan;
  }

  public clearWaveContext(): void {
    this.currentPlan = undefined;
  }

  public getCurrentPlan(): WavePlan | undefined {
    return this.currentPlan;
  }

  public getPlayerSnapshot(): { x: number; y: number; velocityX: number; velocityY: number } {
    return this.options.getPlayerSnapshot();
  }

  public getTelegraphSystem(): TelegraphSystem {
    return this.options.telegraphs;
  }

  public spawnPlannedBatch(plan: WavePlan, batch: SpawnBatch): SpawnBatch | null {
    this.currentPlan = plan;

    const remaining: PlannedEnemySpawn[] = [];
    let spawnedAny = false;

    batch.enemies.forEach((spawn) => {
      if (!this.trySpawnEnemy(plan, spawn)) {
        remaining.push(spawn);
        return;
      }

      spawnedAny = true;
    });

    if (remaining.length === 0) {
      return null;
    }

    if (!spawnedAny) {
      return batch;
    }

    return {
      ...batch,
      enemies: remaining
    };
  }

  public spawnBossAdd(spawn: PlannedEnemySpawn, wave: number): boolean {
    const plan = this.currentPlan;
    if (!plan) {
      return false;
    }

    return this.trySpawnEnemy({ ...plan, wave }, { ...spawn, source: "boss" });
  }

  public requestEnemyBullet(options: FireProjectileOptions): EnemyBullet | null {
    if (!this.canSpawnEnemyBullet()) {
      return null;
    }

    const bullet = this.options.enemyBullets.get() as EnemyBullet | null;
    if (!bullet) {
      return null;
    }

    bullet.fire(options.x, options.y, options);
    return bullet;
  }

  public fireSpread(
    origin: VectorLike,
    angle: number,
    count: number,
    spreadRadians: number,
    speed: number,
    damage: number,
    tint?: number,
    scale = 1
  ): number {
    if (count <= 0) {
      return 0;
    }

    let fired = 0;
    const step = count > 1 ? spreadRadians / (count - 1) : 0;
    const start = angle - spreadRadians * 0.5;

    for (let index = 0; index < count; index += 1) {
      const projectileAngle = start + step * index;
      const bullet = this.requestEnemyBullet({
        x: origin.x,
        y: origin.y,
        velocityX: Math.cos(projectileAngle) * speed,
        velocityY: Math.sin(projectileAngle) * speed,
        damage,
        tint,
        scaleX: scale,
        scaleY: scale,
        angle: projectileAngle + Math.PI * 0.5
      });
      if (bullet) {
        fired += 1;
      }
    }

    return fired;
  }

  public spawnMine(x: number, y: number, armDurationMs: number, lifetimeMs: number, damage: number): Mine | null {
    const plan = this.currentPlan;
    if (!plan || !this.canSpawnMine(plan)) {
      return null;
    }

    const mine = this.options.mines.get() as Mine | null;
    if (!mine) {
      return null;
    }

    mine.spawn(x, y, this.options.scene.time.now, armDurationMs, lifetimeMs, damage);
    this.options.telegraphs.showChargeRing({ x, y }, 18, armDurationMs, 0xff8b7b);
    return mine;
  }

  public hasActiveHazards(): boolean {
    return this.options.mines.countActive(true) > 0;
  }

  public hasActiveEnemyProjectiles(): boolean {
    return this.options.enemyBullets.countActive(true) > 0;
  }

  public countActiveEnemies(): number {
    return this.options.enemies.countActive(true);
  }

  public countActiveElites(): number {
    let count = 0;
    this.options.enemies.children.iterate((gameObject) => {
      const enemy = gameObject as Enemy;
      if (enemy?.active && enemy.isElite()) {
        count += 1;
      }
      return true;
    });
    return count;
  }

  public countActiveByArchetype(archetype: PlannedEnemySpawn["archetype"]): number {
    let count = 0;
    this.options.enemies.children.iterate((gameObject) => {
      const enemy = gameObject as Enemy;
      if (enemy?.active && enemy.archetypeId === archetype) {
        count += 1;
      }
      return true;
    });
    return count;
  }

  public countBossAdds(): number {
    let count = 0;
    this.options.enemies.children.iterate((gameObject) => {
      const enemy = gameObject as Enemy;
      if (enemy?.active && enemy.isBossAdd()) {
        count += 1;
      }
      return true;
    });
    return count;
  }

  public countAnchoredTurrets(): number {
    let count = 0;
    this.options.enemies.children.iterate((gameObject) => {
      const enemy = gameObject as Enemy;
      if (enemy?.active && enemy.archetypeId === "turret") {
        count += 1;
      }
      return true;
    });
    return count;
  }

  private trySpawnEnemy(plan: WavePlan, spawn: PlannedEnemySpawn): boolean {
    if (!this.canSpawnEnemy(plan, spawn)) {
      return false;
    }

    const enemy = this.options.enemies.get() as Enemy | null;
    if (!enemy) {
      return false;
    }

    const definition = ENEMY_DEFINITIONS[spawn.archetype];
    const x = getSpawnLaneX(getViewportWidth(this.options.scene), spawn.lane, definition.width * 0.5);
    const y = getSpawnY();

    enemy.spawn({
      spawn,
      wave: plan.wave,
      stage: plan.stage,
      x,
      y,
      time: this.options.scene.time.now,
      director: this,
      telegraphs: this.options.telegraphs
    });
    this.options.onEnemySpawn?.(enemy);

    return true;
  }

  private canSpawnEnemy(plan: WavePlan, spawn: PlannedEnemySpawn): boolean {
    if (this.countActiveEnemies() >= Math.min(plan.caps.maxActiveEnemies, plan.caps.globalMaxEnemies)) {
      return false;
    }

    if (spawn.role === "elite" && this.countActiveElites() >= plan.caps.maxEliteEnemies) {
      return false;
    }

    if (spawn.archetype === "sniper" && this.countActiveByArchetype("sniper") >= plan.caps.maxSnipers) {
      return false;
    }

    if (spawn.archetype === "turret" && this.countAnchoredTurrets() >= plan.caps.maxTurrets) {
      return false;
    }

    if (spawn.source === "boss" && this.countBossAdds() >= plan.caps.maxBossAdds) {
      return false;
    }

    return true;
  }

  private canSpawnEnemyBullet(): boolean {
    const plan = this.currentPlan;
    if (!plan) {
      return false;
    }

    return this.options.enemyBullets.countActive(true) < Math.min(plan.caps.maxEnemyBullets, plan.caps.globalMaxEnemyBullets);
  }

  private canSpawnMine(plan: WavePlan): boolean {
    return this.options.mines.countActive(true) < Math.min(plan.caps.maxMines, plan.caps.globalMaxMines);
  }
}
