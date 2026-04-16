import Phaser from "phaser";

import { EnemyBullet } from "./EnemyBullet";
import { BOSS_CONFIG } from "../utils/constants";
import { getViewportCenterX, getViewportWidth } from "../utils/viewport";

export const BOSS_EVENTS = {
  ATTACK: "boss-attack"
} as const;

export class Boss extends Phaser.Physics.Arcade.Image {
  public maxHealth = 1;
  public health = 1;
  public contactDamage = BOSS_CONFIG.contactDamage;

  private bossWave = 5;
  private isEntering = true;
  private fireEvent?: Phaser.Time.TimerEvent;
  private bulletGroup?: Phaser.Physics.Arcade.Group;

  public constructor(scene: Phaser.Scene, x = -200, y = -200) {
    super(scene, x, y, BOSS_CONFIG.textureKey);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);

    this.setActive(false);
    this.setVisible(false);
    this.setDepth(9);
  }

  public spawn(wave: number, bullets: Phaser.Physics.Arcade.Group): void {
    const bossIndex = Math.floor(wave / 5);
    const body = this.body as Phaser.Physics.Arcade.Body;

    this.bossWave = wave;
    this.maxHealth = BOSS_CONFIG.baseHealth + Math.max(0, bossIndex - 1) * BOSS_CONFIG.healthPerBoss;
    this.health = this.maxHealth;
    this.isEntering = true;
    this.bulletGroup = bullets;

    this.enableBody(true, getViewportCenterX(this.scene), -120, true, true);
    this.setDisplaySize(BOSS_CONFIG.width, BOSS_CONFIG.height);
    body.setSize(BOSS_CONFIG.width * 0.82, BOSS_CONFIG.height * 0.74, true);
    body.setVelocity(0, BOSS_CONFIG.enterSpeed);

    this.fireEvent?.remove(false);
    this.fireEvent = this.scene.time.addEvent({
      delay: BOSS_CONFIG.fireCooldownMs,
      loop: true,
      callback: this.fireFan,
      callbackScope: this
    });
  }

  public updateState(): void {
    if (!this.active) {
      return;
    }

    const body = this.body as Phaser.Physics.Arcade.Body;
    const minX = BOSS_CONFIG.width * 0.5 + 28;
    const maxX = getViewportWidth(this.scene) - BOSS_CONFIG.width * 0.5 - 28;

    if (this.isEntering && this.y >= BOSS_CONFIG.targetY) {
      this.isEntering = false;
      body.setVelocity(BOSS_CONFIG.moveSpeed, 0);
    }

    if (!this.isEntering) {
      if (this.x <= minX) {
        body.setVelocityX(Math.abs(body.velocity.x));
      } else if (this.x >= maxX) {
        body.setVelocityX(-Math.abs(body.velocity.x));
      }
    }
  }

  public takeDamage(amount: number): boolean {
    this.health = Math.max(0, this.health - amount);
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(80, () => {
      if (this.active) {
        this.clearTint();
      }
    });
    return this.health <= 0;
  }

  public deactivate(): void {
    this.fireEvent?.remove(false);
    this.fireEvent = undefined;
    this.disableBody(true, true);
    this.setVelocity(0, 0);
    this.clearTint();
    this.bulletGroup = undefined;
  }

  public override destroy(fromScene?: boolean): void {
    this.fireEvent?.remove(false);
    this.fireEvent = undefined;
    this.bulletGroup = undefined;
    super.destroy(fromScene);
  }

  private fireFan(): void {
    if (!this.active || this.isEntering || !this.bulletGroup) {
      return;
    }

    const bulletCount = BOSS_CONFIG.fanShotCount;
    const startAngle = Math.PI * 0.5 - BOSS_CONFIG.fanSpread * 0.5;
    const step = bulletCount > 1 ? BOSS_CONFIG.fanSpread / (bulletCount - 1) : 0;
    let fired = false;

    for (let index = 0; index < bulletCount; index += 1) {
      const bullet = this.bulletGroup.get() as EnemyBullet | null;
      if (!bullet) {
        continue;
      }

      const angle = startAngle + step * index;
      bullet.fire(
        this.x + (index - Math.floor(bulletCount / 2)) * 24,
        this.y + BOSS_CONFIG.height * 0.42,
        Math.cos(angle) * BOSS_CONFIG.bulletSpeed,
        Math.sin(angle) * BOSS_CONFIG.bulletSpeed,
        BOSS_CONFIG.bulletDamage
      );
      fired = true;
    }

    if (fired) {
      this.emit(BOSS_EVENTS.ATTACK, this);
    }
  }
}
