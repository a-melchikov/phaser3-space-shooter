import Phaser from "phaser";

import { TEXTURE_KEYS } from "../utils/constants";
import { getViewportHeight, getViewportWidth } from "../utils/viewport";

export class EnemyBullet extends Phaser.Physics.Arcade.Image {
  public damage = 10;

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

  public fire(x: number, y: number, velocityX: number, velocityY: number, damage: number): void {
    this.damage = damage;
    this.enableBody(true, x, y, true, true);
    this.setVelocity(velocityX, velocityY);
  }

  public deactivate(): void {
    this.disableBody(true, true);
    this.setVelocity(0, 0);
  }

  public override update(): void {
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
}
