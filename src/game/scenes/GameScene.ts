import Phaser from "phaser";

import { Boss } from "../entities/Boss";
import { Enemy } from "../entities/Enemy";
import { EnemyBullet } from "../entities/EnemyBullet";
import { Player, type PlayerControls } from "../entities/Player";
import { PlayerBullet } from "../entities/PlayerBullet";
import { PowerUp } from "../entities/PowerUp";
import { AudioSystem } from "../systems/AudioSystem";
import { CollisionManager } from "../systems/CollisionManager";
import { UISystem } from "../systems/UISystem";
import { WaveManager } from "../systems/WaveManager";
import type { EnemyType, GameStartPayload, PowerUpType, WaveManagerCallbacks } from "../types/game";
import { SCENE_KEYS } from "../types/scene";
import {
  CAMERA_SHAKE_LIGHT,
  CAMERA_SHAKE_STRONG,
  ENEMY_CONFIGS,
  GAME_TITLE,
  POWER_UP_DROP_CHANCE,
  POWER_UP_LABELS,
  SCORE_VALUES,
  TEXTURE_KEYS,
  UI_COLORS,
  WORLD_HEIGHT,
  WORLD_WIDTH
} from "../utils/constants";
import { getEnemySpawnX, getEnemySpawnY } from "../utils/enemyFactory";
import { chance, pickRandom, randomBetween } from "../utils/helpers";

export class GameScene extends Phaser.Scene {
  private farBackground?: Phaser.GameObjects.TileSprite;
  private nearBackground?: Phaser.GameObjects.TileSprite;

  private player!: Player;
  private audioSystem!: AudioSystem;
  private uiSystem!: UISystem;
  private waveManager!: WaveManager;
  private collisionManager!: CollisionManager;

  private playerBullets!: Phaser.Physics.Arcade.Group;
  private enemyBullets!: Phaser.Physics.Arcade.Group;
  private enemies!: Phaser.Physics.Arcade.Group;
  private bosses!: Phaser.Physics.Arcade.Group;
  private powerUps!: Phaser.Physics.Arcade.Group;

  private controls?: PlayerControls;
  private pauseKey?: Phaser.Input.Keyboard.Key;
  private isPaused = false;
  private isTransitioning = true;
  private isFinishing = false;
  private score = 0;
  private activeBoss?: Boss;
  private gameOverTimeoutId?: number;

  public constructor() {
    super(SCENE_KEYS.GAME);
  }

  public init(_data: GameStartPayload): void {
    this.isPaused = false;
    this.isTransitioning = true;
    this.isFinishing = false;
    this.score = 0;
    this.activeBoss = undefined;
    this.gameOverTimeoutId = undefined;
  }

  public create(): void {
    this.cameras.main.setBackgroundColor("#030712");
    this.physics.world.resume();
    this.time.timeScale = 1;
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    this.createBackground();
    this.createGroups();
    this.createPlayer();
    this.createInput();

    this.audioSystem = new AudioSystem(this);
    this.uiSystem = new UISystem(this);
    this.uiSystem.bindPlayer(this.player);
    this.uiSystem.setScore(this.score);
    this.uiSystem.setWave(1);
    this.uiSystem.setPowerUps([]);
    this.uiSystem.setBossHealth(0, 0);

    this.collisionManager = new CollisionManager({
      scene: this,
      player: this.player,
      playerBullets: this.playerBullets,
      enemyBullets: this.enemyBullets,
      enemies: this.enemies,
      bosses: this.bosses,
      powerUps: this.powerUps,
      canResolveCombat: () => !this.isPaused && !this.isTransitioning && !this.isFinishing,
      canResolvePlayerDamage: () => !this.isPaused && !this.isTransitioning && !this.isFinishing,
      onPlayerBulletHitsEnemy: (bullet, enemy) => this.handlePlayerBulletHitsEnemy(bullet, enemy),
      onPlayerBulletHitsBoss: (bullet, boss) => this.handlePlayerBulletHitsBoss(bullet, boss),
      onEnemyBulletHitsPlayer: (bullet) => this.handleEnemyBulletHitsPlayer(bullet),
      onPlayerHitsEnemy: (enemy) => this.handlePlayerHitsEnemy(enemy),
      onPlayerCollectsPowerUp: (powerUp) => this.handlePlayerCollectsPowerUp(powerUp)
    });

    const callbacks: WaveManagerCallbacks = {
      onWaveChanged: (wave, bossWave) => {
        this.uiSystem.setWave(wave);
        if (bossWave) {
          this.uiSystem.showBanner(`Волна ${wave} • босс`);
        }
      },
      onTransitionStateChange: (active) => {
        this.isTransitioning = active;
        this.clearProjectiles();
      },
      onBanner: (text) => this.uiSystem.showBanner(text),
      spawnEnemy: (type) => this.spawnEnemy(type),
      spawnBoss: (wave) => this.spawnBoss(wave),
      hasActiveEnemies: () => this.enemies.countActive(true) > 0,
      hasActiveEnemyProjectiles: () => this.enemyBullets.countActive(true) > 0,
      isBossAlive: () => Boolean(this.activeBoss?.active)
    };

    this.waveManager = new WaveManager(this, callbacks);
    this.waveManager.startRun();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
  }

  public override update(time: number, delta: number): void {
    this.scrollBackground(delta);

    if (this.pauseKey && Phaser.Input.Keyboard.JustDown(this.pauseKey) && !this.isFinishing) {
      this.togglePause();
    }

    if (this.isPaused) {
      return;
    }

    if (this.controls) {
      this.player.updateState(time, this.controls, this.playerBullets);
    }

    this.enemies.children.iterate((gameObject) => {
      const enemy = gameObject as Enemy;
      if (enemy.active) {
        enemy.updateState(time, this.player.x, this.enemyBullets);
      }
      return true;
    });

    this.activeBoss?.updateState();
    if (this.activeBoss?.active) {
      this.uiSystem.setBossHealth(this.activeBoss.health, this.activeBoss.maxHealth);
    }

    this.waveManager.update(time, delta);
    this.uiSystem.refresh(time);
  }

  private createBackground(): void {
    this.farBackground = this.add
      .tileSprite(0, 0, WORLD_WIDTH, WORLD_HEIGHT, TEXTURE_KEYS.backgroundFar)
      .setOrigin(0)
      .setAlpha(0.95);

    this.nearBackground = this.add
      .tileSprite(0, 0, WORLD_WIDTH, WORLD_HEIGHT, TEXTURE_KEYS.backgroundNear)
      .setOrigin(0)
      .setAlpha(0.74);

    this.add.rectangle(WORLD_WIDTH * 0.5, WORLD_HEIGHT * 0.5, WORLD_WIDTH, WORLD_HEIGHT, 0x05101f, 0.14);
    this.add
      .text(WORLD_WIDTH - 16, WORLD_HEIGHT - 18, `${GAME_TITLE}  •  Phaser 3`, {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "12px",
        color: "#6f8ba3"
      })
      .setOrigin(1, 1)
      .setScrollFactor(0)
      .setDepth(40);
  }

  private createGroups(): void {
    this.playerBullets = this.physics.add.group({
      classType: PlayerBullet,
      maxSize: 60,
      runChildUpdate: true
    });

    this.enemyBullets = this.physics.add.group({
      classType: EnemyBullet,
      maxSize: 80,
      runChildUpdate: true
    });

    this.enemies = this.physics.add.group({
      classType: Enemy,
      maxSize: 40,
      runChildUpdate: true
    });

    this.bosses = this.physics.add.group({
      classType: Boss,
      maxSize: 1,
      runChildUpdate: true
    });

    this.powerUps = this.physics.add.group({
      classType: PowerUp,
      maxSize: 12,
      runChildUpdate: true
    });
  }

  private createPlayer(): void {
    this.player = new Player(this);
    this.player.resetForRun(this.time.now);
  }

  private createInput(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) {
      throw new Error("Keyboard input is unavailable for GameScene.");
    }

    this.controls = {
      left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      up: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      down: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      fire: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
    };
    this.pauseKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P);
  }

  private spawnEnemy(type: EnemyType): void {
    const enemy = this.enemies.get() as Enemy | null;
    if (!enemy) {
      return;
    }

    const x = getEnemySpawnX(type === "heavy");
    const y = getEnemySpawnY();
    enemy.spawn(type, this.waveManager.getCurrentWave(), x, y, this.time.now);
  }

  private spawnBoss(wave: number): void {
    const boss = this.bosses.get() as Boss | null;
    if (!boss) {
      return;
    }

    this.clearProjectiles();
    boss.spawn(wave, this.enemyBullets);
    this.activeBoss = boss;
    this.uiSystem.setBossHealth(boss.health, boss.maxHealth);
  }

  private handlePlayerBulletHitsEnemy(bullet: PlayerBullet, enemy: Enemy): void {
    bullet.deactivate();
    this.audioSystem.playHit();
    this.spawnImpact(enemy.x, enemy.y, UI_COLORS.gold);

    if (!enemy.takeDamage(bullet.damage)) {
      return;
    }

    this.destroyEnemy(enemy, true);
  }

  private handlePlayerBulletHitsBoss(bullet: PlayerBullet, boss: Boss): void {
    bullet.deactivate();
    this.audioSystem.playBossHit();
    this.addScore(SCORE_VALUES.bossHit);
    this.spawnImpact(boss.x, boss.y + boss.displayHeight * 0.2, UI_COLORS.gold);
    this.cameras.main.shake(110, CAMERA_SHAKE_LIGHT);

    if (!boss.takeDamage(1)) {
      this.uiSystem.setBossHealth(boss.health, boss.maxHealth);
      return;
    }

    this.destroyBoss(boss);
  }

  private handleEnemyBulletHitsPlayer(bullet: EnemyBullet): void {
    bullet.deactivate();
    const result = this.player.takeDamage(bullet.damage, this.time.now);

    if (result.blocked) {
      if (this.player.hasShield(this.time.now)) {
        this.spawnImpact(this.player.x, this.player.y, UI_COLORS.gold);
      }
      return;
    }

    this.audioSystem.playHit();
    this.spawnImpact(this.player.x, this.player.y, UI_COLORS.danger);
    this.cameras.main.shake(120, CAMERA_SHAKE_LIGHT);

    if (result.gameOver) {
      this.finishRun();
      return;
    }

    if (result.lostLife) {
      this.spawnBurst(this.player.x, this.player.y, UI_COLORS.cyan, 14);
    }
  }

  private handlePlayerHitsEnemy(enemy: Enemy): void {
    const result = this.player.takeDamage(enemy.contactDamage, this.time.now);
    if (result.blocked) {
      return;
    }

    this.destroyEnemy(enemy, false);
    this.audioSystem.playHit();
    this.cameras.main.shake(150, CAMERA_SHAKE_LIGHT);

    if (result.gameOver) {
      this.finishRun();
    }
  }

  private handlePlayerCollectsPowerUp(powerUp: PowerUp): void {
    if (!powerUp.active) {
      return;
    }

    const label = POWER_UP_LABELS[powerUp.powerUpType];
    this.player.applyPowerUp(powerUp.powerUpType, this.time.now);
    powerUp.deactivate();
    this.addScore(SCORE_VALUES.powerUpPickup);
    this.audioSystem.playPowerUp();
    this.uiSystem.showBanner(`Бонус: ${label}`);
    this.spawnImpact(this.player.x, this.player.y, UI_COLORS.success);
  }

  private destroyEnemy(enemy: Enemy, awardScore: boolean): void {
    const enemyType = enemy.enemyType;
    const x = enemy.x;
    const y = enemy.y;

    enemy.deactivate();

    if (awardScore) {
      this.addScore(ENEMY_CONFIGS[enemyType].score);
      this.tryDropPowerUp(enemyType, x, y);
    }

    this.spawnBurst(
      x,
      y,
      enemyType === "heavy" ? UI_COLORS.gold : UI_COLORS.danger,
      enemyType === "heavy" ? 14 : 8
    );

    if (enemyType === "heavy") {
      this.cameras.main.shake(160, CAMERA_SHAKE_STRONG);
    }

    this.audioSystem.playExplosion();
  }

  private destroyBoss(boss: Boss): void {
    const x = boss.x;
    const y = boss.y;

    boss.deactivate();
    this.activeBoss = undefined;
    this.clearEnemyProjectiles();
    this.addScore(SCORE_VALUES.bossKill);
    this.dropPowerUp("boss", x, y);
    this.uiSystem.setBossHealth(0, 0);
    this.spawnBurst(x, y, UI_COLORS.gold, 26);
    this.cameras.main.shake(260, CAMERA_SHAKE_STRONG);
    this.audioSystem.playExplosion();
  }

  private tryDropPowerUp(source: EnemyType, x: number, y: number): void {
    if (!chance(POWER_UP_DROP_CHANCE[source])) {
      return;
    }

    this.dropPowerUp(source, x, y);
  }

  private dropPowerUp(_source: EnemyType | "boss", x: number, y: number): void {
    const powerUp = this.powerUps.get() as PowerUp | null;
    if (!powerUp) {
      return;
    }

    const types: PowerUpType[] = ["heal", "doubleShot", "shield"];
    powerUp.spawn(pickRandom(types), x, y, this.time.now);
  }

  private addScore(amount: number): void {
    this.score += amount;
    this.uiSystem.setScore(this.score);
  }

  private clearProjectiles(): void {
    this.clearPlayerProjectiles();
    this.clearEnemyProjectiles();
  }

  private clearPlayerProjectiles(): void {
    this.iterateGroup(this.playerBullets, (gameObject) => {
      const bullet = gameObject as PlayerBullet;
      if (bullet.active) {
        bullet.deactivate();
      }
      return true;
    });
  }

  private clearEnemyProjectiles(): void {
    this.iterateGroup(this.enemyBullets, (gameObject) => {
      const bullet = gameObject as EnemyBullet;
      if (bullet.active) {
        bullet.deactivate();
      }
      return true;
    });
  }

  private finishRun(): void {
    if (this.isFinishing) {
      return;
    }

    this.isFinishing = true;
    this.isTransitioning = true;
    this.forceResumeRuntimeState();
    this.clearProjectiles();
    this.waveManager.shutdown();
    this.stopCombatMotion();
    this.uiSystem.showBanner("Корабль уничтожен");

    this.gameOverTimeoutId = window.setTimeout(() => {
      this.gameOverTimeoutId = undefined;
      this.scene.start(SCENE_KEYS.GAME_OVER, {
        score: this.score,
        wave: this.waveManager.getCurrentWave()
      });
    }, 650);
  }

  private forceResumeRuntimeState(): void {
    this.isPaused = false;
    this.uiSystem.showPauseOverlay(false);
    this.time.timeScale = 1;
    this.tweens.resumeAll();
    this.physics.world.resume();
  }

  private stopCombatMotion(): void {
    if (this.player?.active) {
      this.player.setVelocity(0, 0);
    }

    this.iterateGroup(this.enemies, (gameObject) => {
      const enemy = gameObject as Enemy;
      if (enemy.active) {
        enemy.setVelocity(0, 0);
      }
      return true;
    });

    this.iterateGroup(this.bosses, (gameObject) => {
      const boss = gameObject as Boss;
      if (boss.active) {
        boss.setVelocity(0, 0);
      }
      return true;
    });

    this.iterateGroup(this.powerUps, (gameObject) => {
      const powerUp = gameObject as PowerUp;
      if (powerUp.active) {
        powerUp.setVelocity(0, 0);
      }
      return true;
    });
  }

  private togglePause(): void {
    this.isPaused = !this.isPaused;
    this.uiSystem.showPauseOverlay(this.isPaused);

    if (this.isPaused) {
      this.physics.world.pause();
      this.time.timeScale = 0;
      this.tweens.pauseAll();
      return;
    }

    this.time.timeScale = 1;
    this.physics.world.resume();
    this.tweens.resumeAll();
  }

  private spawnImpact(x: number, y: number, tint: number): void {
    const flash = this.add.image(x, y, TEXTURE_KEYS.flash).setTint(tint).setDepth(30);
    flash.setScale(0.18);

    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 0.6,
      duration: 180,
      onComplete: () => flash.destroy()
    });
  }

  private spawnBurst(x: number, y: number, tint: number, count: number): void {
    for (let index = 0; index < count; index += 1) {
      const particle = this.add.image(x, y, TEXTURE_KEYS.particle).setTint(tint).setDepth(30);
      const offsetX = randomBetween(-52, 52);
      const offsetY = randomBetween(-52, 52);
      const scale = randomBetween(0.4, 1.1);

      particle.setScale(scale);
      this.tweens.add({
        targets: particle,
        x: x + offsetX,
        y: y + offsetY,
        alpha: 0,
        duration: randomBetween(260, 520),
        ease: "Quad.easeOut",
        onComplete: () => particle.destroy()
      });
    }
  }

  private scrollBackground(delta: number): void {
    this.farBackground?.setTilePosition(0, this.farBackground.tilePositionY + delta * 0.008);
    this.nearBackground?.setTilePosition(0, this.nearBackground.tilePositionY + delta * 0.02);
  }

  private iterateGroup(
    group: Phaser.Physics.Arcade.Group | undefined,
    iterator: (gameObject: Phaser.GameObjects.GameObject) => boolean | null
  ): void {
    if (!group?.children) {
      return;
    }

    group.children.iterate((gameObject) => {
      if (!gameObject) {
        return false;
      }
      return iterator(gameObject);
    });
  }

  private destroyGroupMembers(group: Phaser.Physics.Arcade.Group | undefined): void {
    this.iterateGroup(group, (gameObject) => {
      gameObject.destroy();
      return true;
    });
  }

  private handleShutdown(): void {
    if (this.gameOverTimeoutId !== undefined) {
      window.clearTimeout(this.gameOverTimeoutId);
      this.gameOverTimeoutId = undefined;
    }

    this.waveManager?.shutdown();
    this.collisionManager?.destroy();
    this.uiSystem?.destroy();
    this.audioSystem?.destroy();

    this.clearProjectiles();
    this.destroyGroupMembers(this.enemies);
    this.destroyGroupMembers(this.bosses);
    this.destroyGroupMembers(this.powerUps);
    this.destroyGroupMembers(this.playerBullets);
    this.destroyGroupMembers(this.enemyBullets);

    if (this.controls) {
      this.input.keyboard?.removeKey(this.controls.left);
      this.input.keyboard?.removeKey(this.controls.right);
      this.input.keyboard?.removeKey(this.controls.up);
      this.input.keyboard?.removeKey(this.controls.down);
      this.input.keyboard?.removeKey(this.controls.fire);
      this.controls = undefined;
    }

    if (this.pauseKey) {
      this.input.keyboard?.removeKey(this.pauseKey);
      this.pauseKey = undefined;
    }

    this.player?.destroy();
    this.activeBoss = undefined;
    this.farBackground = undefined;
    this.nearBackground = undefined;
    this.physics.world.resume();
    this.time.timeScale = 1;
    this.tweens.killAll();

    this.controls = undefined;
    this.playerBullets = undefined as unknown as Phaser.Physics.Arcade.Group;
    this.enemyBullets = undefined as unknown as Phaser.Physics.Arcade.Group;
    this.enemies = undefined as unknown as Phaser.Physics.Arcade.Group;
    this.bosses = undefined as unknown as Phaser.Physics.Arcade.Group;
    this.powerUps = undefined as unknown as Phaser.Physics.Arcade.Group;
    this.player = undefined as unknown as Player;
  }
}
