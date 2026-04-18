import Phaser from "phaser";

import { getProgressionStageConfig } from "../config/combat";
import { ENEMY_DEFINITIONS, getEnemyStageHealthMultiplier } from "../config/enemies";
import type { EnemyArchetypeId, EnemyRole, EnemyVariant, PlannedEnemySpawn, ProgressionStage } from "../types/combat";
import { randomBetween } from "../utils/helpers";
import { getViewportHeight, getViewportWidth } from "../utils/viewport";
import { CombatDirector } from "../systems/CombatDirector";
import { TelegraphSystem } from "../systems/TelegraphSystem";

export const ENEMY_EVENTS = {
  SHOT: "enemy-shot"
} as const;

interface EnemySpawnOptions {
  spawn: PlannedEnemySpawn;
  wave: number;
  stage: ProgressionStage;
  x: number;
  y: number;
  time: number;
  director: CombatDirector;
  telegraphs: TelegraphSystem;
}

type ChargeState = "idle" | "charging" | "dashing";

const VARIANT_TINTS: Partial<Record<EnemyVariant, number>> = {
  smart: 0xb3f3ff,
  elite: 0xffd68d
};

const VARIANT_MULTIPLIERS: Record<EnemyVariant, {
  health: number;
  speed: number;
  cooldown: number;
  bulletDamage: number;
}> = {
  normal: {
    health: 1,
    speed: 1,
    cooldown: 1,
    bulletDamage: 1
  },
  smart: {
    health: 1.2,
    speed: 1.04,
    cooldown: 0.9,
    bulletDamage: 1.18
  },
  elite: {
    health: 1.35,
    speed: 1.06,
    cooldown: 0.86,
    bulletDamage: 1.25
  }
};

export class Enemy extends Phaser.Physics.Arcade.Image {
  public enemyType: EnemyArchetypeId = "basic";
  public archetypeId: EnemyArchetypeId = "basic";
  public variant: EnemyVariant = "normal";
  public role: EnemyRole = "common";
  public maxHealth = 1;
  public health = 1;
  public contactDamage = 0;
  public scoreValue = 0;

  private stage: ProgressionStage = "early";
  private spawnedAt = 0;
  private currentWave = 1;
  private director?: CombatDirector;
  private telegraphs?: TelegraphSystem;
  private spawnSource: "wave" | "boss" = "wave";
  private baseX = 0;
  private anchorX = 0;
  private moveDirection = 1;
  private canShoot = false;
  private nextShotAt = 0;
  private bulletSpeed = 0;
  private bulletDamage = 0;
  private shotCooldownMinMs = 0;
  private shotCooldownMaxMs = 0;
  private predictiveLeadMs = 0;
  private telegraphDurationMs = 0;
  private nextMineAt = 0;
  private chargeState: ChargeState = "idle";
  private chargeUntil = 0;
  private dashAngle = 0;
  private dashEndsAt = 0;
  private burstShotsRemaining = 0;
  private burstShotAt = 0;
  private burstBaseAngle = Math.PI * 0.5;
  private damageFlashUntil = 0;
  private activeTelegraph?: { destroy(): void };

  public constructor(scene: Phaser.Scene, x = -100, y = -100) {
    super(scene, x, y, ENEMY_DEFINITIONS.basic.textureKey);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);

    this.setActive(false);
    this.setVisible(false);
    this.setDepth(6);
  }

  public spawn(options: EnemySpawnOptions): void {
    const definition = ENEMY_DEFINITIONS[options.spawn.archetype];
    const body = this.body as Phaser.Physics.Arcade.Body;
    const stageConfig = getProgressionStageConfig(options.wave);
    const variantModifiers = VARIANT_MULTIPLIERS[options.spawn.variant];
    const stageIndex = this.getStageIndex(options.stage);

    this.enemyType = options.spawn.archetype;
    this.archetypeId = options.spawn.archetype;
    this.variant = options.spawn.variant;
    this.role = options.spawn.role;
    this.stage = options.stage;
    this.currentWave = options.wave;
    this.spawnedAt = options.time;
    this.director = options.director;
    this.telegraphs = options.telegraphs;
    this.spawnSource = options.spawn.source;
    this.baseX = options.x;
    this.anchorX = options.x;
    this.moveDirection = Math.random() < 0.5 ? -1 : 1;
    this.canShoot = definition.canShoot;
    this.contactDamage = definition.contactDamage;
    this.scoreValue = definition.score;
    this.bulletSpeed = definition.bulletSpeed * stageConfig.enemyBulletSpeedMultiplier * variantModifiers.speed;
    this.bulletDamage = definition.bulletDamage * variantModifiers.bulletDamage;
    this.shotCooldownMinMs = definition.shotCooldownMinMs * stageConfig.enemyFireRateMultiplier * variantModifiers.cooldown;
    this.shotCooldownMaxMs = definition.shotCooldownMaxMs * stageConfig.enemyFireRateMultiplier * variantModifiers.cooldown;
    this.predictiveLeadMs = definition.predictiveLeadMs ?? 0;
    this.telegraphDurationMs = definition.telegraphDurationMs ?? 0;
    this.maxHealth = definition.baseHealth * getEnemyStageHealthMultiplier(options.stage, options.spawn.archetype) * variantModifiers.health;
    this.health = this.maxHealth;
    this.nextShotAt = options.time + randomBetween(this.shotCooldownMinMs, this.shotCooldownMaxMs);
    this.nextMineAt = options.time + randomBetween(definition.mineDropMinMs ?? 2600, definition.mineDropMaxMs ?? 3200);
    this.chargeState = "idle";
    this.chargeUntil = 0;
    this.dashEndsAt = 0;
    this.burstShotsRemaining = 0;
    this.burstShotAt = 0;
    this.damageFlashUntil = 0;
    this.clearTelegraph();

    this.enableBody(true, options.x, options.y, true, true);
    this.setTexture(definition.textureKey);
    this.setDisplaySize(definition.width, definition.height);
    body.setSize(definition.width * 0.74, definition.height * 0.74, true);
    body.setVelocity(0, (definition.baseSpeed + stageIndex * definition.speedPerStage) * stageConfig.enemySpeedMultiplier * variantModifiers.speed);
    this.setRotation(0);
    this.setScale(1);
    this.applyBaseTint();
  }

  public updateState(time: number, player = this.director?.getPlayerSnapshot()): void {
    if (!this.active || !player || !this.director) {
      return;
    }

    switch (ENEMY_DEFINITIONS[this.archetypeId].pattern) {
      case "straight":
        this.updateStraight(time, player);
        break;
      case "zigzag":
        this.updateZigzag(time, player);
        break;
      case "sniperHold":
        this.updateSniper(time, player);
        break;
      case "dash":
        this.updateKamikaze(time, player);
        break;
      case "mineDrift":
        this.updateMineLayer(time, player);
        break;
      case "anchor":
        this.updateTurret(time, player);
        break;
      case "tank":
        this.updateTank(time, player);
        break;
      default:
        break;
    }

    this.refreshVisualState(time);
  }

  public isElite(): boolean {
    return this.role === "elite";
  }

  public isBossAdd(): boolean {
    return this.spawnSource === "boss";
  }

  public takeDamage(amount: number): boolean {
    this.health = Math.max(0, this.health - amount);
    this.damageFlashUntil = this.scene.time.now + 70;
    return this.health <= 0;
  }

  public deactivate(): void {
    this.disableBody(true, true);
    this.setVelocity(0, 0);
    this.setRotation(0);
    this.setScale(1);
    this.clearTelegraph();
    this.clearTint();
  }

  public override update(): void {
    if (
      this.active &&
      (
        this.y > getViewportHeight(this.scene) + 80 ||
        this.x < -80 ||
        this.x > getViewportWidth(this.scene) + 80
      )
    ) {
      this.deactivate();
    }
  }

  private updateStraight(time: number, player: { x: number; y: number; velocityX: number; velocityY: number }): void {
    const definition = ENEMY_DEFINITIONS[this.archetypeId];
    (this.body as Phaser.Physics.Arcade.Body).setVelocityX(0);

    if (!definition.canShoot || !this.isInFireLane()) {
      return;
    }

    if (time >= this.nextShotAt) {
      const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
      const shotCount = definition.spreadShotCount ?? 1;
      const spread = definition.spreadRadians ?? 0;
      const fired = this.director?.fireSpread(
        { x: this.x, y: this.y + this.displayHeight * 0.45 },
        angle,
        shotCount,
        spread,
        this.bulletSpeed,
        this.bulletDamage,
        definition.color,
        this.archetypeId === "heavy" ? 1.1 : 1
      ) ?? 0;

      if (fired > 0) {
        this.emit(ENEMY_EVENTS.SHOT, this);
        this.nextShotAt = time + randomBetween(this.shotCooldownMinMs, this.shotCooldownMaxMs);
        this.telegraphs?.showMuzzleFlash({ x: this.x, y: this.y + this.displayHeight * 0.36 }, 150, definition.color, 0.32);
      }
    }
  }

  private updateZigzag(_time: number, _player: { x: number; y: number; velocityX: number; velocityY: number }): void {
    const definition = ENEMY_DEFINITIONS[this.archetypeId];
    this.x = this.baseX + Math.sin((this.scene.time.now - this.spawnedAt) * 0.001 * (definition.zigzagFrequency ?? 5)) * (definition.zigzagAmplitude ?? 24);
  }

  private updateSniper(time: number, player: { x: number; y: number; velocityX: number; velocityY: number }): void {
    const definition = ENEMY_DEFINITIONS.sniper;
    const body = this.body as Phaser.Physics.Arcade.Body;

    if (this.y < (definition.preferredY ?? 118)) {
      body.setVelocity(
        Phaser.Math.Clamp((this.anchorX - this.x) * 1.5, -72, 72),
        body.velocity.y
      );
    } else {
      body.setVelocityY(26);
      body.setVelocityX((definition.strafeSpeed ?? 84) * this.moveDirection);

      const minX = this.displayWidth * 0.5 + 36;
      const maxX = getViewportWidth(this.scene) - this.displayWidth * 0.5 - 36;
      if (this.x <= minX || this.x >= maxX) {
        this.moveDirection *= -1;
      }
    }

    if (this.chargeState === "charging") {
      body.setVelocity(0, 0);
      if (time >= this.chargeUntil) {
        this.fireSniperShot(player);
        this.chargeState = "idle";
        this.clearTelegraph();
        this.nextShotAt = time + randomBetween(this.shotCooldownMinMs, this.shotCooldownMaxMs);
      }
      return;
    }

    if (this.isInFireLane() && time >= this.nextShotAt) {
      const target = this.predictPlayer(player, this.variant === "smart" ? 220 : this.predictiveLeadMs);
      this.dashAngle = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
      this.chargeState = "charging";
      this.chargeUntil = time + this.telegraphDurationMs;
      this.clearTelegraph();
      this.activeTelegraph = this.telegraphs?.showAimLine(
        { x: this.x, y: this.y + this.displayHeight * 0.3 },
        {
          x: this.x + Math.cos(this.dashAngle) * 560,
          y: this.y + Math.sin(this.dashAngle) * 560
        },
        this.telegraphDurationMs,
        0x6ef2ff
      );
    }
  }

  private updateKamikaze(time: number, player: { x: number; y: number; velocityX: number; velocityY: number }): void {
    const definition = ENEMY_DEFINITIONS.kamikaze;
    const body = this.body as Phaser.Physics.Arcade.Body;

    if (this.chargeState === "dashing") {
      if (time >= this.dashEndsAt) {
        this.chargeState = "idle";
        body.setVelocity(0, definition.baseSpeed * 0.8);
      }
      return;
    }

    if (this.chargeState === "charging") {
      body.setVelocity(0, 0);
      if (time >= this.chargeUntil) {
        body.setVelocity(Math.cos(this.dashAngle) * (definition.dashSpeed ?? 430), Math.sin(this.dashAngle) * (definition.dashSpeed ?? 430));
        this.chargeState = "dashing";
        this.dashEndsAt = time + 720;
        this.clearTelegraph();
      }
      return;
    }

    body.setVelocityX(Phaser.Math.Clamp((player.x - this.x) * 1.35, -definition.baseSpeed * 0.9, definition.baseSpeed * 0.9));
    body.setVelocityY(definition.baseSpeed);

    if (this.y >= Math.min(player.y - 110, getViewportHeight(this.scene) * 0.55)) {
      const target = this.predictPlayer(player, 110);
      this.dashAngle = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
      this.chargeState = "charging";
      this.chargeUntil = time + (definition.dashChargeMs ?? 450);
      this.clearTelegraph();
      this.activeTelegraph = this.telegraphs?.showChargeRing({ x: this.x, y: this.y }, 18, definition.dashChargeMs ?? 450, 0xff8d5c);
    }
  }

  private updateMineLayer(time: number, _player: { x: number; y: number; velocityX: number; velocityY: number }): void {
    const definition = ENEMY_DEFINITIONS.mineLayer;
    this.x = this.baseX + Math.sin((time - this.spawnedAt) * 0.001 * (definition.zigzagFrequency ?? 3)) * (definition.zigzagAmplitude ?? 24);

    if (this.y > 64 && this.y < getViewportHeight(this.scene) * 0.8 && time >= this.nextMineAt) {
      const mine = this.director?.spawnMine(
        this.x,
        this.y + this.displayHeight * 0.38,
        definition.mineArmMs ?? 600,
        definition.mineLifetimeMs ?? 7000,
        18
      );

      if (mine) {
        this.nextMineAt = time + randomBetween(definition.mineDropMinMs ?? 2600, definition.mineDropMaxMs ?? 3200);
      }
    }
  }

  private updateTurret(time: number, player: { x: number; y: number; velocityX: number; velocityY: number }): void {
    const definition = ENEMY_DEFINITIONS.turret;
    const body = this.body as Phaser.Physics.Arcade.Body;
    const anchorY = definition.anchorY ?? 132;

    if (this.y < anchorY) {
      body.setVelocity(
        Phaser.Math.Clamp((this.anchorX - this.x) * 1.6, -definition.baseSpeed, definition.baseSpeed),
        Math.max(body.velocity.y, definition.baseSpeed * 0.85)
      );
      return;
    }

    body.setVelocity(0, 0);

    if (this.burstShotsRemaining > 0 && time >= this.burstShotAt) {
      const burstIndex = (definition.burstCount ?? 3) - this.burstShotsRemaining;
      const burstSpread = definition.burstSpreadRadians ?? 0.18;
      const step = (definition.burstCount ?? 3) > 1 ? burstSpread / ((definition.burstCount ?? 3) - 1) : 0;
      const angle = this.burstBaseAngle - burstSpread * 0.5 + step * burstIndex;
      const bullet = this.director?.requestEnemyBullet({
        x: this.x,
        y: this.y + this.displayHeight * 0.38,
        velocityX: Math.cos(angle) * this.bulletSpeed,
        velocityY: Math.sin(angle) * this.bulletSpeed,
        damage: this.bulletDamage,
        tint: definition.color,
        angle: angle + Math.PI * 0.5
      });

      if (bullet) {
        this.emit(ENEMY_EVENTS.SHOT, this);
      }

      this.burstShotsRemaining -= 1;
      this.burstShotAt = time + (definition.burstSpacingMs ?? 110);
      if (this.burstShotsRemaining <= 0) {
        this.nextShotAt = time + randomBetween(this.shotCooldownMinMs, this.shotCooldownMaxMs);
      }
      return;
    }

    if (this.chargeState === "charging") {
      if (time >= this.chargeUntil) {
        this.chargeState = "idle";
        this.clearTelegraph();
        this.burstShotsRemaining = definition.burstCount ?? 3;
        this.burstShotAt = time;
      }
      return;
    }

    if (this.isInFireLane() && time >= this.nextShotAt) {
      const predictiveLead = this.variant === "elite" ? 160 : this.predictiveLeadMs;
      const target = this.predictPlayer(player, predictiveLead);
      this.burstBaseAngle = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
      this.chargeState = "charging";
      this.chargeUntil = time + this.telegraphDurationMs;
      this.clearTelegraph();
      this.activeTelegraph = this.telegraphs?.showMuzzleFlash(
        { x: this.x, y: this.y + this.displayHeight * 0.28 },
        this.telegraphDurationMs,
        definition.color,
        0.42
      );
    }
  }

  private updateTank(time: number, player: { x: number; y: number; velocityX: number; velocityY: number }): void {
    const definition = ENEMY_DEFINITIONS.tank;
    const body = this.body as Phaser.Physics.Arcade.Body;

    body.setVelocityX(Math.sin((time - this.spawnedAt) * 0.0015) * 34);
    body.setVelocityY(Math.min(body.velocity.y, definition.baseSpeed * 0.9));

    if (!this.isInFireLane() || time < this.nextShotAt) {
      return;
    }

    const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
    const count = this.variant === "elite" ? 4 : (definition.spreadShotCount ?? 3);
    const spread = this.variant === "elite" ? 0.46 : (definition.spreadRadians ?? 0.34);
    const fired = this.director?.fireSpread(
      { x: this.x, y: this.y + this.displayHeight * 0.4 },
      angle,
      count,
      spread,
      this.bulletSpeed,
      this.bulletDamage,
      definition.color,
      1.12
    ) ?? 0;

    if (fired > 0) {
      this.emit(ENEMY_EVENTS.SHOT, this);
      this.nextShotAt = time + randomBetween(this.shotCooldownMinMs, this.shotCooldownMaxMs);
      this.telegraphs?.showMuzzleFlash({ x: this.x, y: this.y + this.displayHeight * 0.34 }, 180, definition.color, 0.45);
    }
  }

  private fireSniperShot(player: { x: number; y: number; velocityX: number; velocityY: number }): void {
    const definition = ENEMY_DEFINITIONS.sniper;
    const target = this.predictPlayer(player, this.variant === "smart" ? 220 : this.predictiveLeadMs);
    const angle = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
    const bullet = this.director?.requestEnemyBullet({
      x: this.x,
      y: this.y + this.displayHeight * 0.32,
      velocityX: Math.cos(angle) * this.bulletSpeed,
      velocityY: Math.sin(angle) * this.bulletSpeed,
      damage: this.bulletDamage,
      tint: definition.color,
      scaleX: 1.18,
      scaleY: 1.28,
      angle: angle + Math.PI * 0.5
    });

    if (bullet) {
      this.emit(ENEMY_EVENTS.SHOT, this);
    }
  }

  private predictPlayer(
    player: { x: number; y: number; velocityX: number; velocityY: number },
    leadMs: number
  ): { x: number; y: number } {
    const leadSeconds = Math.min(0.22, Math.max(0, leadMs) / 1000);
    return {
      x: player.x + player.velocityX * leadSeconds,
      y: player.y + player.velocityY * leadSeconds
    };
  }

  private isInFireLane(): boolean {
    return this.y > 20 && this.y < getViewportHeight(this.scene) * 0.8;
  }

  private refreshVisualState(time: number): void {
    if (time < this.damageFlashUntil) {
      this.setTintFill(0xffffff);
      return;
    }

    this.applyBaseTint();
  }

  private applyBaseTint(): void {
    const variantTint = VARIANT_TINTS[this.variant];
    if (variantTint) {
      this.setTint(variantTint);
      return;
    }

    this.clearTint();
  }

  private clearTelegraph(): void {
    this.activeTelegraph?.destroy();
    this.activeTelegraph = undefined;
  }

  private getStageIndex(stage: ProgressionStage): number {
    if (stage === "mid") {
      return 1;
    }

    if (stage === "late") {
      return 2;
    }

    if (stage === "endless") {
      return 3;
    }

    return 0;
  }
}
