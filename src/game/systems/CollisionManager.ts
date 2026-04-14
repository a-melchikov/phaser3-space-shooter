import Phaser from "phaser";

import { Boss } from "../entities/Boss";
import { Enemy } from "../entities/Enemy";
import { EnemyBullet } from "../entities/EnemyBullet";
import { Player } from "../entities/Player";
import { PlayerBullet } from "../entities/PlayerBullet";
import { PowerUp } from "../entities/PowerUp";

interface CollisionManagerOptions {
  scene: Phaser.Scene;
  player: Player;
  playerBullets: Phaser.Physics.Arcade.Group;
  enemyBullets: Phaser.Physics.Arcade.Group;
  enemies: Phaser.Physics.Arcade.Group;
  bosses: Phaser.Physics.Arcade.Group;
  powerUps: Phaser.Physics.Arcade.Group;
  canResolveCombat: () => boolean;
  canResolvePlayerDamage: () => boolean;
  onPlayerBulletHitsEnemy: (bullet: PlayerBullet, enemy: Enemy) => void;
  onPlayerBulletHitsBoss: (bullet: PlayerBullet, boss: Boss) => void;
  onEnemyBulletHitsPlayer: (bullet: EnemyBullet) => void;
  onPlayerHitsEnemy: (enemy: Enemy) => void;
  onPlayerCollectsPowerUp: (powerUp: PowerUp) => void;
}

export class CollisionManager {
  private readonly colliders: Phaser.Physics.Arcade.Collider[] = [];

  public constructor(private readonly options: CollisionManagerOptions) {
    const { scene } = options;

    this.colliders.push(
      scene.physics.add.overlap(options.playerBullets, options.enemies, (left, right) => {
        if (!options.canResolveCombat()) {
          return;
        }
        options.onPlayerBulletHitsEnemy(left as PlayerBullet, right as Enemy);
      }),
      scene.physics.add.overlap(options.playerBullets, options.bosses, (left, right) => {
        if (!options.canResolveCombat()) {
          return;
        }
        options.onPlayerBulletHitsBoss(left as PlayerBullet, right as Boss);
      }),
      scene.physics.add.overlap(options.enemyBullets, options.player, (left) => {
        if (!options.canResolvePlayerDamage()) {
          return;
        }
        options.onEnemyBulletHitsPlayer(left as EnemyBullet);
      }),
      scene.physics.add.overlap(options.player, options.enemies, (_player, enemy) => {
        if (!options.canResolvePlayerDamage()) {
          return;
        }
        options.onPlayerHitsEnemy(enemy as Enemy);
      }),
      scene.physics.add.overlap(options.player, options.powerUps, (_player, powerUp) => {
        options.onPlayerCollectsPowerUp(powerUp as PowerUp);
      })
    );
  }

  public destroy(): void {
    this.colliders.forEach((collider) => collider.destroy());
    this.colliders.length = 0;
  }
}
