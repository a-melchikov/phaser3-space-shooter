import Phaser from "phaser";

import { EnemyBullet } from "./EnemyBullet";
import type { EnemyType } from "../types/game";
import { ENEMY_CONFIGS, WORLD_HEIGHT } from "../utils/constants";
import { chance, randomBetween } from "../utils/helpers";

export const ENEMY_EVENTS = {
  SHOT: "enemy-shot"
} as const;

export class Enemy extends Phaser.Physics.Arcade.Image {
  public enemyType: EnemyType = "basic";
  public maxHealth = 1;
  public health = 1;
  public contactDamage = 0;
  public scoreValue = 0;

  private baseX = 0;
  private spawnedAt = 0;
  private currentWave = 1;
  private canShoot = false;
  private nextShotAt = 0;
  private bulletSpeed = 0;
  private bulletDamage = 0;

  public constructor(scene: Phaser.Scene, x = -100, y = -100) {
    super(scene, x, y, ENEMY_CONFIGS.basic.textureKey);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);

    this.setActive(false);
    this.setVisible(false);
    this.setDepth(6);
  }

  public spawn(type: EnemyType, wave: number, x: number, y: number, time: number): void {
    const config = ENEMY_CONFIGS[type];
    const body = this.body as Phaser.Physics.Arcade.Body;

    this.enemyType = type;
    this.currentWave = wave;
    this.maxHealth = config.maxHealth;
    this.health = config.maxHealth;
    this.contactDamage = config.contactDamage;
    this.scoreValue = config.score;
    this.baseX = x;
    this.spawnedAt = time;
    this.bulletSpeed = config.bulletSpeed;
    this.bulletDamage = config.bulletDamage;
    this.canShoot = config.canShoot && (type !== "basic" || (wave >= 7 && chance(0.12 + Math.min(0.18, wave * 0.01))));
    this.nextShotAt = time + randomBetween(config.shotCooldownMinMs, config.shotCooldownMaxMs);

    this.enableBody(true, x, y, true, true);
    this.setTexture(config.textureKey);
    this.setDisplaySize(config.width, config.height);
    this.setVelocity(0, config.baseSpeed + wave * config.speedPerWave);
    body.setSize(config.width * 0.72, config.height * 0.72, true);
    this.clearTint();
  }

  public updateState(time: number, targetX: number, bullets: Phaser.Physics.Arcade.Group): void {
    if (!this.active) {
      return;
    }

    const config = ENEMY_CONFIGS[this.enemyType];

    if (config.pattern === "zigzag") {
      this.x = this.baseX + Math.sin((time - this.spawnedAt) * 0.001 * config.zigzagFrequency) * config.zigzagAmplitude;
    }

    if (this.canShoot && this.y > 24 && this.y < WORLD_HEIGHT * 0.72 && time >= this.nextShotAt) {
      const bullet = bullets.get() as EnemyBullet | null;
      if (bullet) {
        const horizontalVelocity = Phaser.Math.Clamp((targetX - this.x) * 0.55, -150, 150);
        bullet.fire(this.x, this.y + this.displayHeight * 0.45, horizontalVelocity, this.bulletSpeed, this.bulletDamage);
        this.nextShotAt = time + randomBetween(config.shotCooldownMinMs, config.shotCooldownMaxMs);
        this.emit(ENEMY_EVENTS.SHOT, this);
      }
    }
  }

  public takeDamage(amount: number): boolean {
    this.health = Math.max(0, this.health - amount);
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(70, () => {
      if (this.active) {
        this.clearTint();
      }
    });
    return this.health <= 0;
  }

  public deactivate(): void {
    this.disableBody(true, true);
    this.setVelocity(0, 0);
    this.clearTint();
  }

  public override update(): void {
    if (this.active && this.y > WORLD_HEIGHT + 54) {
      this.deactivate();
    }
  }
}
