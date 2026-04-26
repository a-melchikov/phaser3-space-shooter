import Phaser from "phaser";

import { PlayerBullet } from "./PlayerBullet";
import type { SavedPlayerState, SavedPowerUpState } from "../types/runState";
import type { ActivePowerUpState } from "../types/game";
import type { PlayerCombatSnapshot, PowerUpType } from "../types/combat";
import type { RunUpgradeEffects } from "../types/economy";
import {
  PLAYER_CONFIG,
  POWER_UP_DURATIONS_MS,
  POWER_UP_LABELS
} from "../config/combat";
import { DEFAULT_RUN_UPGRADE_EFFECTS } from "../config/upgrades";
import { TEXTURE_KEYS } from "../utils/constants";
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
  leftAlt?: Phaser.Input.Keyboard.Key;
  rightAlt?: Phaser.Input.Keyboard.Key;
  upAlt?: Phaser.Input.Keyboard.Key;
  downAlt?: Phaser.Input.Keyboard.Key;
}

export interface PlayerDamageResult {
  blocked: boolean;
  lostLife: boolean;
  gameOver: boolean;
}

export type SupportDroneMode = "none" | "permanent" | "powerUp";

export class Player extends Phaser.Physics.Arcade.Image {
  public maxHealth: number = PLAYER_CONFIG.maxHealth;
  public health: number = PLAYER_CONFIG.maxHealth;
  public lives: number = PLAYER_CONFIG.startingLives;

  private readonly shieldRing: Phaser.GameObjects.Image;
  private upgradeEffects: RunUpgradeEffects = DEFAULT_RUN_UPGRADE_EFFECTS;
  private fireReadyAt = 0;
  private invulnerableUntil = 0;
  private shieldUntil = 0;
  private doubleShotUntil = 0;
  private damageBoostUntil = 0;
  private supportDroneUntil = 0;

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

  public setUpgradeEffects(effects: RunUpgradeEffects): void {
    this.upgradeEffects = effects;
    this.maxHealth = PLAYER_CONFIG.maxHealth + effects.maxHealthBonus;
    this.health = Math.min(this.health, this.maxHealth);
  }

  public resetForRun(time = 0): void {
    this.enableBody(true, getPlayerSpawnX(this.scene), getPlayerSpawnY(this.scene), true, true);
    this.setVelocity(0, 0);
    this.maxHealth = PLAYER_CONFIG.maxHealth + this.upgradeEffects.maxHealthBonus;
    this.health = this.maxHealth;
    this.lives = PLAYER_CONFIG.startingLives;
    this.fireReadyAt = time;
    this.invulnerableUntil = 0;
    this.shieldUntil = 0;
    this.doubleShotUntil = 0;
    this.damageBoostUntil = 0;
    this.supportDroneUntil = 0;
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

    if (controls.left.isDown || controls.leftAlt?.isDown) {
      velocityX -= 1;
    }
    if (controls.right.isDown || controls.rightAlt?.isDown) {
      velocityX += 1;
    }
    if (controls.up.isDown || controls.upAlt?.isDown) {
      velocityY -= 1;
    }
    if (controls.down.isDown || controls.downAlt?.isDown) {
      velocityY += 1;
    }

    const body = this.body as Phaser.Physics.Arcade.Body;
    const movementLengthSq = velocityX * velocityX + velocityY * velocityY;

    if (movementLengthSq > 0) {
      const movementScale = PLAYER_CONFIG.speed / Math.sqrt(movementLengthSq);
      velocityX *= movementScale;
      velocityY *= movementScale;
    }

    body.setVelocity(velocityX, velocityY);

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

    this.health = this.maxHealth;
    this.invulnerableUntil = time + PLAYER_CONFIG.respawnInvulnerabilityMs;
    this.setPosition(getPlayerSpawnX(this.scene), getPlayerSpawnY(this.scene));
    this.setVelocity(0, 0);

    return { blocked: false, lostLife: true, gameOver: false };
  }

  public applyPowerUp(type: PowerUpType, time: number): void {
    if (type === "heal") {
      this.health = Math.min(this.maxHealth, this.health + 30 + this.upgradeEffects.healBonus);
      return;
    }

    if (type === "doubleShot") {
      this.doubleShotUntil = this.extendPowerUpDuration(this.doubleShotUntil, POWER_UP_DURATIONS_MS.doubleShot, time);
      return;
    }

    if (type === "shield") {
      this.shieldUntil = this.extendPowerUpDuration(this.shieldUntil, POWER_UP_DURATIONS_MS.shield, time);
      return;
    }

    if (type === "damageBoost") {
      this.damageBoostUntil = this.extendPowerUpDuration(this.damageBoostUntil, POWER_UP_DURATIONS_MS.damageBoost, time);
      return;
    }

    this.supportDroneUntil = this.extendPowerUpDuration(this.supportDroneUntil, POWER_UP_DURATIONS_MS.supportDrone, time);
  }

  public grantTimedPowerUp(type: Exclude<PowerUpType, "heal" | "damageBoost" | "supportDrone">, durationMs: number, time: number): void {
    if (durationMs <= 0) {
      return;
    }

    if (type === "doubleShot") {
      this.doubleShotUntil = Math.max(this.doubleShotUntil, time) + durationMs;
      return;
    }

    this.shieldUntil = Math.max(this.shieldUntil, time) + durationMs;
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

  public hasDamageBoost(time: number): boolean {
    return time < this.damageBoostUntil;
  }

  public hasSupportDrone(time: number): boolean {
    return this.upgradeEffects.permanentSupportDrone || this.hasTemporarySupportDrone(time);
  }

  public hasTemporarySupportDrone(time: number): boolean {
    return time < this.supportDroneUntil;
  }

  public getSupportDroneMode(time: number): SupportDroneMode {
    if (this.hasTemporarySupportDrone(time)) {
      return "powerUp";
    }

    return this.upgradeEffects.permanentSupportDrone ? "permanent" : "none";
  }

  public getUpgradeEffects(): RunUpgradeEffects {
    return this.upgradeEffects;
  }

  public getBulletDamage(time: number): number {
    return this.hasDamageBoost(time)
      ? PLAYER_CONFIG.bulletDamage * this.upgradeEffects.bulletDamageMultiplier * PLAYER_CONFIG.damageBoostMultiplier
      : PLAYER_CONFIG.bulletDamage * this.upgradeEffects.bulletDamageMultiplier;
  }

  public getCombatSnapshot(): PlayerCombatSnapshot {
    const body = this.body as Phaser.Physics.Arcade.Body | undefined;

    return {
      x: this.x,
      y: this.y,
      velocityX: body?.velocity.x ?? 0,
      velocityY: body?.velocity.y ?? 0
    };
  }

  public getActivePowerUps(time: number, target: ActivePowerUpState[] = []): ActivePowerUpState[] {
    let nextIndex = 0;

    if (this.hasShield(time)) {
      this.writeActivePowerUp(target, nextIndex, "shield", this.shieldUntil - time);
      nextIndex += 1;
    }

    if (this.hasDoubleShot(time)) {
      this.writeActivePowerUp(target, nextIndex, "doubleShot", this.doubleShotUntil - time);
      nextIndex += 1;
    }

    if (this.hasDamageBoost(time)) {
      this.writeActivePowerUp(target, nextIndex, "damageBoost", this.damageBoostUntil - time);
      nextIndex += 1;
    }

    if (this.hasTemporarySupportDrone(time)) {
      this.writeActivePowerUp(target, nextIndex, "supportDrone", this.supportDroneUntil - time);
      nextIndex += 1;
    }

    target.length = nextIndex;
    return target;
  }

  public capturePersistentState(time: number): SavedPlayerState {
    return {
      health: this.health,
      lives: this.lives,
      x: this.x,
      y: this.y,
      invulnerableRemainingMs: Math.max(0, this.invulnerableUntil - time),
      powerUps: this.capturePowerUps(time)
    };
  }

  public restorePersistentState(state: SavedPlayerState, time: number): void {
    this.health = Phaser.Math.Clamp(state.health, 0, this.maxHealth);
    this.lives = Math.max(0, Math.floor(state.lives));
    this.setPosition(state.x, state.y);
    this.setVelocity(0, 0);
    this.fireReadyAt = time;
    this.invulnerableUntil = time + Math.max(0, state.invulnerableRemainingMs);
    this.shieldUntil = 0;
    this.doubleShotUntil = 0;
    this.damageBoostUntil = 0;
    this.supportDroneUntil = 0;
    this.restorePowerUps(state.powerUps, time);
    this.updateVisualState(time);
  }

  public override destroy(fromScene?: boolean): void {
    this.shieldRing.destroy();
    super.destroy(fromScene);
  }

  private capturePowerUps(time: number): SavedPowerUpState[] {
    return this.getActivePowerUps(time).map((effect) => ({
      type: effect.type,
      remainingMs: effect.remainingMs
    }));
  }

  private restorePowerUps(powerUps: SavedPowerUpState[], time: number): void {
    powerUps.forEach((powerUp) => {
      const remainingMs = Math.max(0, powerUp.remainingMs);
      if (remainingMs <= 0) {
        return;
      }

      switch (powerUp.type) {
        case "shield":
          this.shieldUntil = Math.max(this.shieldUntil, time + remainingMs);
          break;
        case "doubleShot":
          this.doubleShotUntil = Math.max(this.doubleShotUntil, time + remainingMs);
          break;
        case "damageBoost":
          this.damageBoostUntil = Math.max(this.damageBoostUntil, time + remainingMs);
          break;
        case "supportDrone":
          this.supportDroneUntil = Math.max(this.supportDroneUntil, time + remainingMs);
          break;
        case "heal":
          break;
        default: {
          const exhaustiveCheck: never = powerUp.type;
          return exhaustiveCheck;
        }
      }
    });
  }

  private extendPowerUpDuration(currentUntil: number, durationMs: number, time: number): number {
    return Math.max(currentUntil, time) + durationMs * this.upgradeEffects.powerUpDurationMultiplier;
  }

  private writeActivePowerUp(
    target: ActivePowerUpState[],
    index: number,
    type: Exclude<PowerUpType, "heal">,
    remainingMs: number
  ): void {
    const entry = target[index] ?? {
      type,
      label: POWER_UP_LABELS[type],
      remainingMs
    };

    entry.type = type;
    entry.label = POWER_UP_LABELS[type];
    entry.remainingMs = remainingMs;
    target[index] = entry;
  }

  private fire(time: number, bullets: Phaser.Physics.Arcade.Group): void {
    this.fireReadyAt = time + PLAYER_CONFIG.fireCooldownMs * this.upgradeEffects.fireCooldownMultiplier;
    const offsets = this.hasDoubleShot(time) ? [-11, 11] : [0];
    const damage = this.getBulletDamage(time);

    offsets.forEach((offset) => {
      const bullet = bullets.get() as PlayerBullet | null;
      if (!bullet) {
        return;
      }
      bullet.fire(this.x + offset, this.y - this.displayHeight * 0.44, {
        velocityX: 0,
        velocityY: -PLAYER_CONFIG.bulletSpeed,
        damage
      });
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

    if (this.hasDamageBoost(time)) {
      this.setTint(0xffd76c);
    } else {
      this.clearTint();
    }
  }
}
