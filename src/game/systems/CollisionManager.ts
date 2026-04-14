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
        const bullet = this.pickObject(left, right, PlayerBullet);
        const enemy = this.pickObject(left, right, Enemy);
        if (!bullet || !enemy) {
          return;
        }
        options.onPlayerBulletHitsEnemy(bullet, enemy);
      }),
      scene.physics.add.overlap(options.playerBullets, options.bosses, (left, right) => {
        if (!options.canResolveCombat()) {
          return;
        }
        const bullet = this.pickObject(left, right, PlayerBullet);
        const boss = this.pickObject(left, right, Boss);
        if (!bullet || !boss) {
          return;
        }
        options.onPlayerBulletHitsBoss(bullet, boss);
      }),
      scene.physics.add.overlap(options.enemyBullets, options.player, (left, right) => {
        if (!options.canResolvePlayerDamage()) {
          return;
        }
        const bullet = this.pickObject(left, right, EnemyBullet);
        if (!bullet) {
          return;
        }
        options.onEnemyBulletHitsPlayer(bullet);
      }),
      scene.physics.add.overlap(options.player, options.enemies, (left, right) => {
        if (!options.canResolvePlayerDamage()) {
          return;
        }
        const enemy = this.pickObject(left, right, Enemy);
        if (!enemy) {
          return;
        }
        options.onPlayerHitsEnemy(enemy);
      }),
      scene.physics.add.overlap(options.player, options.powerUps, (left, right) => {
        const powerUp = this.pickObject(left, right, PowerUp);
        if (!powerUp) {
          return;
        }
        options.onPlayerCollectsPowerUp(powerUp);
      })
    );
  }

  public destroy(): void {
    this.colliders.forEach((collider) => collider.destroy());
    this.colliders.length = 0;
  }

  private pickObject<T extends Phaser.GameObjects.GameObject>(
    left: unknown,
    right: unknown,
    ctor: new (...args: never[]) => T
  ): T | null {
    const leftGameObject = this.unwrapGameObject(left);
    const rightGameObject = this.unwrapGameObject(right);

    if (leftGameObject instanceof ctor) {
      return leftGameObject;
    }

    if (rightGameObject instanceof ctor) {
      return rightGameObject;
    }

    return null;
  }

  private unwrapGameObject(value: unknown): Phaser.GameObjects.GameObject | null {
    if (value instanceof Phaser.GameObjects.GameObject) {
      return value;
    }

    if (
      typeof value === "object" &&
      value !== null &&
      "gameObject" in value &&
      value.gameObject instanceof Phaser.GameObjects.GameObject
    ) {
      return value.gameObject;
    }

    return null;
  }
}
