import Phaser from "phaser";

import type { SavedMineState } from "../types/runState";
import { TEXTURE_KEYS } from "../utils/constants";
import { getViewportHeight, getViewportWidth } from "../utils/viewport";

export class Mine extends Phaser.Physics.Arcade.Image {
  public contactDamage = 18;

  private armedAt = 0;
  private expiresAt = 0;
  private armed = false;

  public constructor(scene: Phaser.Scene, x = -100, y = -100) {
    super(scene, x, y, TEXTURE_KEYS.mine);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);
    body.setCircle(14, 6, 6);

    this.setActive(false);
    this.setVisible(false);
    this.setDepth(7);
  }

  public spawn(x: number, y: number, time: number, armDurationMs: number, lifetimeMs: number, damage: number): void {
    this.contactDamage = damage;
    this.armedAt = time + armDurationMs;
    this.expiresAt = time + lifetimeMs;
    this.armed = false;

    this.enableBody(true, x, y, true, true);
    this.setScale(0.9);
    this.setAlpha(0.7);
    this.clearTint();
    this.setVelocity(0, 0);
  }

  public isArmed(time: number): boolean {
    return this.active && time >= this.armedAt;
  }

  public takeDamage(): boolean {
    this.deactivate();
    return true;
  }

  public deactivate(): void {
    this.disableBody(true, true);
    this.armed = false;
    this.clearTint();
    this.setScale(1);
    this.setAlpha(1);
  }

  public capturePersistentState(time: number): SavedMineState | null {
    if (!this.active) {
      return null;
    }

    return {
      x: this.x,
      y: this.y,
      damage: this.contactDamage,
      armRemainingMs: Math.max(0, this.armedAt - time),
      remainingMs: Math.max(0, this.expiresAt - time)
    };
  }

  public restorePersistentState(state: SavedMineState, time: number): void {
    this.spawn(
      state.x,
      state.y,
      time,
      Math.max(0, state.armRemainingMs),
      Math.max(1, state.remainingMs),
      state.damage
    );
    this.setPosition(state.x, state.y);
  }

  public override update(time: number, delta: number): void {
    if (!this.active) {
      return;
    }

    this.rotation += delta * 0.0016;

    if (!this.armed && time >= this.armedAt) {
      this.armed = true;
      this.setTint(0xff7a7a);
      this.setAlpha(0.92);
    }

    const pulseSpeed = this.armed ? 0.014 : 0.01;
    this.setScale(0.92 + Math.sin(time * pulseSpeed) * (this.armed ? 0.08 : 0.05));

    if (
      time >= this.expiresAt ||
      this.y < -40 ||
      this.y > getViewportHeight(this.scene) + 40 ||
      this.x < -40 ||
      this.x > getViewportWidth(this.scene) + 40
    ) {
      this.deactivate();
    }
  }
}
