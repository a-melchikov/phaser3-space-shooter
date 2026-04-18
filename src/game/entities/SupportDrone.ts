import Phaser from "phaser";

import { PLAYER_CONFIG } from "../config/combat";
import { Boss } from "./Boss";
import { Enemy } from "./Enemy";
import { Player } from "./Player";
import { PlayerBullet } from "./PlayerBullet";
import { TEXTURE_KEYS } from "../utils/constants";

export class SupportDrone extends Phaser.GameObjects.Image {
  private orbitAngle = 0;
  private nextFireAt = 0;

  public constructor(scene: Phaser.Scene) {
    super(scene, -200, -200, TEXTURE_KEYS.supportDrone);

    scene.add.existing(this);
    this.setActive(false);
    this.setVisible(false);
    this.setDepth(11);
    this.setScale(0.9);
  }

  public updateState(
    time: number,
    player: Player,
    bullets: Phaser.Physics.Arcade.Group,
    enemies: Phaser.Physics.Arcade.Group,
    bosses: Phaser.Physics.Arcade.Group
  ): void {
    if (!player.active || !player.hasSupportDrone(time)) {
      this.setActive(false);
      this.setVisible(false);
      return;
    }

    if (!this.active) {
      this.setActive(true);
      this.setVisible(true);
      this.nextFireAt = time + 120;
    }

    this.orbitAngle += 0.045;
    const offsetX = Math.cos(this.orbitAngle) * 24;
    const offsetY = Math.sin(this.orbitAngle * 1.12) * 14 - 12;
    this.setPosition(player.x + offsetX, player.y + offsetY);
    this.rotation = Math.sin(this.orbitAngle) * 0.18;

    if (time < this.nextFireAt) {
      return;
    }

    const target = this.findNearestTarget(enemies, bosses, this.x, this.y);
    if (!target) {
      return;
    }

    const bullet = bullets.get() as PlayerBullet | null;
    if (!bullet) {
      return;
    }

    const angle = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
    const speed = PLAYER_CONFIG.bulletSpeed * 0.92;
    bullet.fire(this.x, this.y, {
      velocityX: Math.cos(angle) * speed,
      velocityY: Math.sin(angle) * speed,
      damage: PLAYER_CONFIG.supportDroneDamage,
      tint: 0x79f7c1,
      scaleX: 0.72,
      scaleY: 0.92,
      angle: angle + Math.PI * 0.5
    });

    this.nextFireAt = time + PLAYER_CONFIG.supportDroneFireCooldownMs;
  }

  private findNearestTarget(
    enemies: Phaser.Physics.Arcade.Group,
    bosses: Phaser.Physics.Arcade.Group,
    x: number,
    y: number
  ): Enemy | Boss | null {
    let bestTarget: Enemy | Boss | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    bosses.children.iterate((gameObject) => {
      const boss = gameObject as Boss;
      if (!boss?.active) {
        return true;
      }

      const distance = Phaser.Math.Distance.Between(x, y, boss.x, boss.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestTarget = boss;
      }

      return true;
    });

    enemies.children.iterate((gameObject) => {
      const enemy = gameObject as Enemy;
      if (!enemy?.active) {
        return true;
      }

      const distance = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestTarget = enemy;
      }

      return true;
    });

    return bestTarget;
  }
}
