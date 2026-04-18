import Phaser from "phaser";

import type { FireProjectileOptions } from "../types/combat";
import { TEXTURE_KEYS } from "../utils/constants";
import { getViewportHeight, getViewportWidth } from "../utils/viewport";

export class EnemyBullet extends Phaser.Physics.Arcade.Image {
  public damage = 10;
  private homingUntil = 0;
  private homingTurnRateRadPerSec = 0;
  private homingTargetOffsetX = 0;
  private homingTargetOffsetY = 0;
  private getHomingTarget?: NonNullable<FireProjectileOptions["homing"]>["getTarget"];

  public constructor(scene: Phaser.Scene, x = -100, y = -100) {
    super(scene, x, y, TEXTURE_KEYS.bulletEnemy);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);

    this.setActive(false);
    this.setVisible(false);
    this.setDepth(8);
  }

  public fire(x: number, y: number, options: FireProjectileOptions): void {
    this.damage = options.damage;
    this.homingUntil = options.homing ? this.scene.time.now + options.homing.durationMs : 0;
    this.homingTurnRateRadPerSec = options.homing?.turnRateRadPerSec ?? 0;
    this.homingTargetOffsetX = options.homing?.targetOffsetX ?? 0;
    this.homingTargetOffsetY = options.homing?.targetOffsetY ?? 0;
    this.getHomingTarget = options.homing?.getTarget;
    this.enableBody(true, x, y, true, true);
    this.setVelocity(options.velocityX, options.velocityY);
    this.setTint(options.tint ?? 0xffffff);
    this.setScale(options.scaleX ?? 1, options.scaleY ?? 1);
    this.setRotation(options.angle ?? 0);
  }

  public deactivate(): void {
    this.disableBody(true, true);
    this.setVelocity(0, 0);
    this.homingUntil = 0;
    this.homingTurnRateRadPerSec = 0;
    this.homingTargetOffsetX = 0;
    this.homingTargetOffsetY = 0;
    this.getHomingTarget = undefined;
    this.clearTint();
    this.setScale(1, 1);
    this.setRotation(0);
  }

  public override update(): void {
    if (this.active) {
      this.updateHoming();
    }

    if (
      this.active &&
      (
        this.y < -32 ||
        this.y > getViewportHeight(this.scene) + 32 ||
        this.x < -32 ||
        this.x > getViewportWidth(this.scene) + 32
      )
    ) {
      this.deactivate();
    }
  }

  private updateHoming(): void {
    if (this.scene.time.now >= this.homingUntil || !this.getHomingTarget) {
      return;
    }

    const body = this.body as Phaser.Physics.Arcade.Body;
    const speed = body.velocity.length();
    if (speed <= 0) {
      return;
    }

    const target = this.getHomingTarget();
    if (!target) {
      return;
    }

    const desiredAngle = Phaser.Math.Angle.Between(
      this.x,
      this.y,
      target.x + this.homingTargetOffsetX,
      target.y + this.homingTargetOffsetY
    );
    const currentAngle = Math.atan2(body.velocity.y, body.velocity.x);
    const maxTurn = this.homingTurnRateRadPerSec * (this.scene.game.loop.delta / 1000);
    const angleDelta = Phaser.Math.Angle.Wrap(desiredAngle - currentAngle);
    const nextAngle = currentAngle + Phaser.Math.Clamp(angleDelta, -maxTurn, maxTurn);

    body.setVelocity(Math.cos(nextAngle) * speed, Math.sin(nextAngle) * speed);
    this.setRotation(nextAngle + Math.PI * 0.5);
  }
}
