import Phaser from "phaser";

export class AudioSystem {
  public constructor(private readonly _scene: Phaser.Scene) {}

  public playShoot(): void {}

  public playHit(): void {}

  public playExplosion(): void {}

  public playPowerUp(): void {}

  public playBossHit(): void {}

  public destroy(): void {}
}
