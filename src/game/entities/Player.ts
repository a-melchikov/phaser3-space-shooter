import Phaser from "phaser";

import { PlayerBullet } from "./PlayerBullet";
import type { ActivePowerUpState, PowerUpType } from "../types/game";
import {
  PLAYER_CONFIG,
  POWER_UP_DURATIONS_MS,
  POWER_UP_LABELS,
  TEXTURE_KEYS
} from "../utils/constants";
import { getPlayerSpawnX, getPlayerSpawnY } from "../utils/viewport";

export const PLAYER_EVENTS = {
  FIRED: "player-fired"
} as const;

export interface PlayerControls {
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
  up: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  fire: Phaser.Input.Keyboard.Key;
}

export interface PlayerDamageResult {
  blocked: boolean;
  lostLife: boolean;
  gameOver: boolean;
}

export class Player extends Phaser.Physics.Arcade.Image {
  public readonly maxHealth: number = PLAYER_CONFIG.maxHealth;
  public health: number = PLAYER_CONFIG.maxHealth;
  public lives: number = PLAYER_CONFIG.startingLives;

  private readonly shieldRing: Phaser.GameObjects.Image;
  private fireReadyAt = 0;
  private invulnerableUntil = 0;
  private shieldUntil = 0;
  private doubleShotUntil = 0;

  public constructor(scene: Phaser.Scene) {
    super(scene, getPlayerSpawnX(scene), getPlayerSpawnY(scene), TEXTURE_KEYS.player);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setCollideWorldBounds(true);
    body.setSize(26, 34, true);

    this.setDisplaySize(PLAYER_CONFIG.width, PLAYER_CONFIG.height);
    this.setDepth(10);

    this.shieldRing = scene.add
      .image(this.x, this.y, TEXTURE_KEYS.shieldRing)
      .setVisible(false)
      .setDepth(9);
  }

  public resetForRun(time = 0): void {
    this.enableBody(true, getPlayerSpawnX(this.scene), getPlayerSpawnY(this.scene), true, true);
    this.setVelocity(0, 0);
    this.health = PLAYER_CONFIG.maxHealth;
    this.lives = PLAYER_CONFIG.startingLives;
    this.fireReadyAt = time;
    this.invulnerableUntil = 0;
    this.shieldUntil = 0;
    this.doubleShotUntil = 0;
    this.setAlpha(1);
    this.clearTint();
    this.shieldRing.setVisible(false);
  }

  public updateState(
    time: number,
    controls: PlayerControls,
    bullets: Phaser.Physics.Arcade.Group
  ): void {
    if (!this.active) {
      return;
    }

    let velocityX = 0;
    let velocityY = 0;

    if (controls.left.isDown) {
      velocityX -= 1;
    }
    if (controls.right.isDown) {
      velocityX += 1;
    }
    if (controls.up.isDown) {
      velocityY -= 1;
    }
    if (controls.down.isDown) {
      velocityY += 1;
    }

    const body = this.body as Phaser.Physics.Arcade.Body;
    const movement = new Phaser.Math.Vector2(velocityX, velocityY);
    if (movement.lengthSq() > 0) {
      movement.normalize().scale(PLAYER_CONFIG.speed);
    }

    body.setVelocity(movement.x, movement.y);

    if (controls.fire.isDown && time >= this.fireReadyAt) {
      this.fire(time, bullets);
    }

    this.updateVisualState(time);
  }

  public takeDamage(amount: number, time: number): PlayerDamageResult {
    if (!this.active || this.isInvulnerable(time) || this.hasShield(time)) {
      return { blocked: true, lostLife: false, gameOver: false };
    }

    this.health = Math.max(0, this.health - amount);
    this.invulnerableUntil = time + PLAYER_CONFIG.invulnerabilityMs;

    if (this.health > 0) {
      return { blocked: false, lostLife: false, gameOver: false };
    }

    this.lives -= 1;
    if (this.lives <= 0) {
      this.health = 0;
      return { blocked: false, lostLife: true, gameOver: true };
    }

    this.health = PLAYER_CONFIG.maxHealth;
    this.invulnerableUntil = time + PLAYER_CONFIG.respawnInvulnerabilityMs;
    this.setPosition(getPlayerSpawnX(this.scene), getPlayerSpawnY(this.scene));
    this.setVelocity(0, 0);

    return { blocked: false, lostLife: true, gameOver: false };
  }

  public applyPowerUp(type: PowerUpType, time: number): void {
    if (type === "heal") {
      this.health = Math.min(this.maxHealth, this.health + 30);
      return;
    }

    if (type === "doubleShot") {
      this.doubleShotUntil = time + POWER_UP_DURATIONS_MS.doubleShot;
      return;
    }

    this.shieldUntil = time + POWER_UP_DURATIONS_MS.shield;
  }

  public isInvulnerable(time: number): boolean {
    return time < this.invulnerableUntil;
  }

  public hasShield(time: number): boolean {
    return time < this.shieldUntil;
  }

  public hasDoubleShot(time: number): boolean {
    return time < this.doubleShotUntil;
  }

  public getActivePowerUps(time: number): ActivePowerUpState[] {
    const effects: ActivePowerUpState[] = [];

    if (this.hasShield(time)) {
      effects.push({
        type: "shield",
        label: POWER_UP_LABELS.shield,
        remainingMs: this.shieldUntil - time
      });
    }

    if (this.hasDoubleShot(time)) {
      effects.push({
        type: "doubleShot",
        label: POWER_UP_LABELS.doubleShot,
        remainingMs: this.doubleShotUntil - time
      });
    }

    return effects;
  }

  public override destroy(fromScene?: boolean): void {
    this.shieldRing.destroy();
    super.destroy(fromScene);
  }

  private fire(time: number, bullets: Phaser.Physics.Arcade.Group): void {
    this.fireReadyAt = time + PLAYER_CONFIG.fireCooldownMs;
    const offsets = this.hasDoubleShot(time) ? [-11, 11] : [0];

    offsets.forEach((offset) => {
      const bullet = bullets.get() as PlayerBullet | null;
      if (!bullet) {
        return;
      }
      bullet.fire(this.x + offset, this.y - this.displayHeight * 0.44, -PLAYER_CONFIG.bulletSpeed);
    });

    this.emit(PLAYER_EVENTS.FIRED);
  }

  private updateVisualState(time: number): void {
    if (this.isInvulnerable(time)) {
      this.setAlpha(Math.floor(time * 0.03) % 2 === 0 ? 0.4 : 1);
    } else {
      this.setAlpha(1);
    }

    this.shieldRing.setPosition(this.x, this.y);
    this.shieldRing.rotation += 0.02;
    this.shieldRing.setVisible(this.hasShield(time));
    this.shieldRing.setAlpha(this.hasShield(time) ? 0.8 : 0);
  }
}
