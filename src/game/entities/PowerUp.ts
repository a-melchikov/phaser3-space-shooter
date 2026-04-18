import Phaser from "phaser";

import type { PowerUpType } from "../types/combat";
import type { SavedWorldPowerUpState } from "../types/runState";
import { POWER_UP_TEXTURES } from "../config/combat";
import { getViewportHeight } from "../utils/viewport";

export class PowerUp extends Phaser.Physics.Arcade.Image {
  public powerUpType: PowerUpType = "heal";
  private expiresAt = 0;

  public constructor(scene: Phaser.Scene, x = -100, y = -100) {
    super(scene, x, y, POWER_UP_TEXTURES.heal);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);

    this.setActive(false);
    this.setVisible(false);
    this.setDepth(7);
  }

  public spawn(type: PowerUpType, x: number, y: number, time: number): void {
    this.powerUpType = type;
    this.expiresAt = time + 8000;
    this.setTexture(POWER_UP_TEXTURES[type]);
    this.enableBody(true, x, y, true, true);
    this.setScale(1);
    this.setAlpha(1);
    this.setVelocity(0, 82);
  }

  public deactivate(): void {
    this.disableBody(true, true);
    this.setVelocity(0, 0);
  }

  public capturePersistentState(time: number): SavedWorldPowerUpState | null {
    if (!this.active) {
      return null;
    }

    return {
      type: this.powerUpType,
      x: this.x,
      y: this.y,
      remainingMs: Math.max(0, this.expiresAt - time)
    };
  }

  public restorePersistentState(state: SavedWorldPowerUpState, time: number): void {
    this.spawn(state.type, state.x, state.y, time);
    this.expiresAt = time + Math.max(0, state.remainingMs);
    this.setPosition(state.x, state.y);
  }

  public override update(time: number, delta: number): void {
    if (!this.active) {
      return;
    }

    this.rotation += delta * 0.0012;
    this.setScale(1 + Math.sin(time * 0.008) * 0.05);

    if (time > this.expiresAt - 1800) {
      this.setAlpha(Math.floor(time * 0.02) % 2 === 0 ? 0.35 : 1);
    }

    if (time >= this.expiresAt || this.y > getViewportHeight(this.scene) + 36) {
      this.deactivate();
    }
  }
}
