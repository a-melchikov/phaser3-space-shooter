import Phaser from "phaser";

import { TEXTURE_KEYS, WORLD_HEIGHT, WORLD_WIDTH } from "../utils/constants";

export class PlayerBullet extends Phaser.Physics.Arcade.Image {
  public damage = 1;

  public constructor(scene: Phaser.Scene, x = -100, y = -100) {
    super(scene, x, y, TEXTURE_KEYS.bulletPlayer);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);

    this.setActive(false);
    this.setVisible(false);
    this.setDepth(8);
  }

  public fire(x: number, y: number, velocityY: number): void {
    this.enableBody(true, x, y, true, true);
    this.setVelocity(0, velocityY);
  }

  public deactivate(): void {
    this.disableBody(true, true);
    this.setVelocity(0, 0);
  }

  public override update(): void {
    if (
      this.active &&
      (this.y < -32 || this.y > WORLD_HEIGHT + 32 || this.x < -32 || this.x > WORLD_WIDTH + 32)
    ) {
      this.deactivate();
    }
  }
}
