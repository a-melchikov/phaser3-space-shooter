import Phaser from "phaser";

import type { UserSession } from "../../auth/types";
import { getGameAppContext } from "../appContext";
import { BOSS_EVENTS, Boss } from "../entities/Boss";
import { ENEMY_EVENTS, Enemy } from "../entities/Enemy";
import { EnemyBullet } from "../entities/EnemyBullet";
import { Mine } from "../entities/Mine";
import { Player, PLAYER_EVENTS, type PlayerControls } from "../entities/Player";
import { PlayerBullet } from "../entities/PlayerBullet";
import { PowerUp } from "../entities/PowerUp";
import { SupportDrone } from "../entities/SupportDrone";
import { AudioSystem } from "../systems/AudioSystem";
import { BackgroundSystem, SPACE_BACKGROUND_PRESETS } from "../systems/BackgroundSystem";
import { CollisionManager } from "../systems/CollisionManager";
import { CombatDirector } from "../systems/CombatDirector";
import { RunEconomyTracker } from "../systems/RunEconomyTracker";
import { TelegraphSystem } from "../systems/TelegraphSystem";
import { UISystem } from "../systems/UISystem";
import { WaveManager } from "../systems/WaveManager";
import { RunAutosaveController } from "../services/RunAutosaveController";
import { DEFAULT_RUN_UPGRADE_EFFECTS } from "../config/upgrades";
import type { EnemyType, GameStartPayload, SessionPresentation, WaveManagerCallbacks } from "../types/game";
import type { PowerUpType, WavePlan } from "../types/combat";
import type { EconomyRunStartState, RunUpgradeEffects } from "../types/economy";
import type {
  RunPhase,
  RunSnapshot,
  SavedBossState,
  SavedEnemyState,
  SavedMineState,
  SavedRunState,
  SavedWaveProgressState,
  SavedWorldPowerUpState
} from "../types/runState";
import { SCENE_KEYS } from "../types/scene";
import { DEFERRED_GAME_AUDIO_ASSETS, MUSIC_KEYS, SFX_KEYS } from "../utils/audioKeys";
import {
  isBossWave,
  isEliteWave,
  getAvailablePowerUpTypes,
  POWER_UP_DROP_CHANCE,
  POWER_UP_LABELS,
  SCORE_VALUES
} from "../config/combat";
import { ENEMY_DEFINITIONS } from "../config/enemies";
import {
  CAMERA_SHAKE_LIGHT,
  CAMERA_SHAKE_STRONG,
  TEXTURE_KEYS,
  UI_COLORS
} from "../utils/constants";
import { chance, pickRandom, randomBetween } from "../utils/helpers";
import { getViewportCenterX, getViewportHeight, getViewportWidth } from "../utils/viewport";

export class GameScene extends Phaser.Scene {
  private background?: BackgroundSystem;
  private backgroundOverlay?: Phaser.GameObjects.Rectangle;

  private player!: Player;
  private supportDrone!: SupportDrone;
  private audioSystem!: AudioSystem;
  private uiSystem!: UISystem;
  private waveManager!: WaveManager;
  private collisionManager!: CollisionManager;
  private telegraphSystem!: TelegraphSystem;
  private combatDirector!: CombatDirector;

  private playerBullets!: Phaser.Physics.Arcade.Group;
  private enemyBullets!: Phaser.Physics.Arcade.Group;
  private enemies!: Phaser.Physics.Arcade.Group;
  private bosses!: Phaser.Physics.Arcade.Group;
  private powerUps!: Phaser.Physics.Arcade.Group;
  private mines!: Phaser.Physics.Arcade.Group;

  private readonly trackedEnemies = new WeakSet<Enemy>();
  private readonly trackedBosses = new WeakSet<Boss>();
  private controls?: PlayerControls;
  private pauseKeys: Phaser.Input.Keyboard.Key[] = [];
  private isPaused = false;
  private isTransitioning = true;
  private isFinishing = false;
  private isShuttingDown = false;
  private score = 0;
  private activeBoss?: Boss;
  private gameOverTimeoutId?: number;
  private runSession!: SessionPresentation;
  private autosaveController?: RunAutosaveController;
  private pendingSavedRun?: SavedRunState;
  private isRestoringRun = false;
  private rankedSubmissionAllowed = true;
  private completionSession!: UserSession;
  private economyRun?: EconomyRunStartState;
  private runUpgradeEffects: RunUpgradeEffects = DEFAULT_RUN_UPGRADE_EFFECTS;
  private economyTracker!: RunEconomyTracker;

  public constructor() {
    super(SCENE_KEYS.GAME);
  }

  public init(data: GameStartPayload): void {
    const runSession = data.savedRun?.run.session ?? data.session;

    this.isPaused = false;
    this.isTransitioning = true;
    this.isFinishing = false;
    this.isShuttingDown = false;
    this.score = 0;
    this.activeBoss = undefined;
    this.gameOverTimeoutId = undefined;
    this.runSession = runSession;
    this.pendingSavedRun = data.savedRun;
    this.economyRun = data.savedRun?.run.economyRun ?? data.economyRun;
    this.runUpgradeEffects = this.economyRun?.effects ?? DEFAULT_RUN_UPGRADE_EFFECTS;
    this.isRestoringRun = false;
    this.rankedSubmissionAllowed = data.source !== "resume";
    this.completionSession = this.rankedSubmissionAllowed
      ? getGameAppContext().authService.getSession()
      : this.buildLocalOnlySession(runSession);
    getGameAppContext().auditService.recordGameRunStart(data);
  }

  public create(): void {
    const viewportWidth = getViewportWidth(this);
    const viewportHeight = getViewportHeight(this);

    this.cameras.main.setBackgroundColor("#030712");
    this.physics.world.resume();
    this.time.timeScale = 1;
    this.physics.world.setBounds(0, 0, viewportWidth, viewportHeight);

    this.audioSystem = AudioSystem.getInstance(this);
    this.audioSystem.playMusic(MUSIC_KEYS.GAMEPLAY);
    this.economyTracker = new RunEconomyTracker(this.time.now);

    this.createBackground();
    this.createGroups();
    this.createPlayer();
    this.createInput();

    this.telegraphSystem = new TelegraphSystem(this);
    this.combatDirector = new CombatDirector({
      scene: this,
      enemies: this.enemies,
      enemyBullets: this.enemyBullets,
      mines: this.mines,
      getPlayerSnapshot: () => this.player.getCombatSnapshot(),
      telegraphs: this.telegraphSystem,
      onEnemySpawn: (enemy) => this.bindEnemyAudioEvents(enemy)
    });

    this.uiSystem = new UISystem(this, this.audioSystem, {
      onPauseResume: () => this.togglePause(),
      onPauseExitToMenu: () => this.exitToMainMenu()
    });
    this.uiSystem.bindPlayer(this.player);
    this.uiSystem.setScore(this.score);
    this.uiSystem.setShardsEstimate(0);
    this.uiSystem.setWave(1);
    this.uiSystem.setPowerUps([]);
    this.uiSystem.setBossHealth(0, 0);
    this.uiSystem.setSessionStatus(this.runSession);

    this.collisionManager = new CollisionManager({
      scene: this,
      player: this.player,
      playerBullets: this.playerBullets,
      enemyBullets: this.enemyBullets,
      enemies: this.enemies,
      bosses: this.bosses,
      mines: this.mines,
      powerUps: this.powerUps,
      canResolveCombat: () => !this.isPaused && !this.isTransitioning && !this.isFinishing,
      canResolvePlayerDamage: () => !this.isPaused && !this.isTransitioning && !this.isFinishing,
      onPlayerBulletHitsEnemy: (bullet, enemy) => this.handlePlayerBulletHitsEnemy(bullet, enemy),
      onPlayerBulletHitsBoss: (bullet, boss) => this.handlePlayerBulletHitsBoss(bullet, boss),
      onPlayerBulletHitsMine: (bullet, mine) => this.handlePlayerBulletHitsMine(bullet, mine),
      onEnemyBulletHitsPlayer: (bullet) => this.handleEnemyBulletHitsPlayer(bullet),
      onPlayerHitsEnemy: (enemy) => this.handlePlayerHitsEnemy(enemy),
      onPlayerHitsBoss: (boss) => this.handlePlayerHitsBoss(boss),
      onPlayerHitsMine: (mine) => this.handlePlayerHitsMine(mine),
      onPlayerCollectsPowerUp: (powerUp) => this.handlePlayerCollectsPowerUp(powerUp)
    });

    const callbacks: WaveManagerCallbacks = {
      onWaveChanged: (plan) => {
        this.combatDirector.setWaveContext(plan);
        this.economyTracker.startWave(plan);
        this.uiSystem.setWave(plan.wave);
        this.uiSystem.setBossHealth(0, 0);
        this.audioSystem.playSfx(SFX_KEYS.WAVE_START);
        this.audioSystem.playMusic(plan.kind === "boss" ? MUSIC_KEYS.BOSS : MUSIC_KEYS.GAMEPLAY);
        if (!this.isRestoringRun) {
          this.applyWaveStartUpgrades(plan);
          this.requestAutosave(true);
        }

        if (plan.kind !== "normal") {
          this.uiSystem.showBanner(`${plan.bannerText} • ${plan.subtitle}`);
        }

        if (plan.kind === "boss" && !this.isRestoringRun) {
          getGameAppContext().auditService.recordBossWaveStarted(plan.wave, this.score);
        }
      },
      onWaveCompleted: (plan) => {
        this.economyTracker.completeWave(plan, this.player.health, this.player.maxHealth);
        this.refreshShardEstimate();
      },
      onTransitionStateChange: (active) => {
        this.isTransitioning = active;
        if (active) {
          this.telegraphSystem.clear();
        }
      },
      onBanner: (text) => this.uiSystem.showBanner(text),
      spawnBatch: (plan, batch) => this.combatDirector.spawnPlannedBatch(plan, batch),
      spawnBoss: (plan) => this.spawnBoss(plan),
      hasActiveEnemies: () => this.enemies.countActive(true) > 0,
      hasActiveEnemyProjectiles: () => this.combatDirector.hasActiveEnemyProjectiles(),
      hasActiveHazards: () => this.combatDirector.hasActiveHazards(),
      isBossAlive: () => Boolean(this.activeBoss?.active)
    };

    this.waveManager = new WaveManager(this, callbacks);
    this.autosaveController = new RunAutosaveController(
      getGameAppContext().runStateStore,
      () => this.captureRunState()
    );
    this.autosaveController.start();

    if (this.pendingSavedRun) {
      this.restoreRunState(this.pendingSavedRun);
    } else {
      this.waveManager.startRun();
    }

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
  }

  public preload(): void {
    DEFERRED_GAME_AUDIO_ASSETS.forEach((asset) => {
      if (!this.cache.audio.exists(asset.key)) {
        this.load.audio(asset.key, asset.urls);
      }
    });
  }

  public override update(time: number, _delta: number): void {
    this.background?.update(time);

    if (
      !this.isFinishing &&
      this.pauseKeys.some((key) => Phaser.Input.Keyboard.JustDown(key))
    ) {
      this.togglePause();
    }

    if (this.isPaused) {
      return;
    }

    if (this.controls) {
      this.player.updateState(time, this.controls, this.playerBullets);
    }

    const snapshot = this.player.getCombatSnapshot();
    this.supportDrone.updateState(time, this.player, this.playerBullets, this.enemies, this.bosses);

    this.enemies.children.iterate((gameObject) => {
      const enemy = gameObject as Enemy;
      if (enemy?.active) {
        enemy.updateState(time, snapshot);
      }
      return true;
    });

    this.activeBoss?.updateState(time, snapshot);
    if (this.activeBoss?.active) {
      this.uiSystem.setBossHealth(this.activeBoss.health, this.activeBoss.maxHealth);
    }

    this.waveManager.update();
    this.uiSystem.refresh(time);
  }

  private restoreRunState(savedRun: SavedRunState): void {
    const snapshot = savedRun.run;
    const waveProgress = this.isWaveProgressRestorable(snapshot.waveProgress, snapshot.wave)
      ? snapshot.waveProgress
      : null;

    this.score = snapshot.score;
    this.runSession = snapshot.session;
    this.economyRun = snapshot.economyRun;
    this.runUpgradeEffects = this.economyRun?.effects ?? DEFAULT_RUN_UPGRADE_EFFECTS;
    if (snapshot.economyProgress) {
      this.economyTracker.restoreState(this.time.now, snapshot.economyProgress);
    }
    this.player.setUpgradeEffects(this.runUpgradeEffects);
    this.uiSystem.setScore(this.score);
    this.uiSystem.setSessionStatus(this.runSession);
    this.isRestoringRun = true;

    this.player.resetForRun(this.time.now);
    this.player.restorePersistentState(
      {
        ...snapshot.player,
        x: Phaser.Math.Clamp(
          snapshot.player.x,
          this.player.displayWidth * 0.5,
          getViewportWidth(this) - this.player.displayWidth * 0.5
        ),
        y: Phaser.Math.Clamp(
          snapshot.player.y,
          this.player.displayHeight * 0.5,
          getViewportHeight(this) - this.player.displayHeight * 0.5
        )
      },
      this.time.now
    );

    if (waveProgress) {
      this.waveManager.restoreProgress(waveProgress);
      this.restoreWaveEntities(waveProgress);
      this.uiSystem.setWave(waveProgress.plan.wave);
      this.uiSystem.setBossHealth(this.activeBoss?.health ?? 0, this.activeBoss?.maxHealth ?? 0);
    } else {
      this.waveManager.startRun(snapshot.wave, true);
    }

    this.uiSystem.setPowerUps(this.player.getActivePowerUps(this.time.now));
    this.uiSystem.showBanner("Продолжение run");
    this.pendingSavedRun = undefined;
    this.isRestoringRun = false;
    this.requestAutosave(true);
  }

  private captureRunState(): RunSnapshot | null {
    if (this.isFinishing || this.isShuttingDown || !this.player?.active || !this.waveManager) {
      return null;
    }

    const wave = Math.max(1, this.waveManager.getCheckpointWave());
    const waveProgress = this.captureWaveProgress(wave);
    const bossState = waveProgress?.boss ?? this.captureBossState();

    return {
      wave,
      score: this.score,
      phase: this.resolveRunPhase(),
      waveKind: this.resolveWaveKind(wave),
      player: this.player.capturePersistentState(this.time.now),
      boss: bossState,
      waveProgress,
      session: this.runSession,
      economyRun: this.economyRun,
      economyProgress: this.economyTracker.captureState(this.time.now)
    };
  }

  private requestAutosave(immediate = false): void {
    this.autosaveController?.requestSave(immediate);
  }

  private clearRunState(): void {
    getGameAppContext().runStateStore.clear();
  }

  private resolveRunPhase(): RunPhase {
    if (this.isPaused) {
      return "paused";
    }

    if (this.isTransitioning) {
      return "transition";
    }

    return "playing";
  }

  private resolveWaveKind(wave: number): WavePlan["kind"] {
    if (isBossWave(wave)) {
      return "boss";
    }

    return isEliteWave(wave) ? "elite" : "normal";
  }

  private createBackground(): void {
    this.background = new BackgroundSystem(this, SPACE_BACKGROUND_PRESETS.game);

    this.backgroundOverlay = this.add.rectangle(
      getViewportCenterX(this),
      getViewportHeight(this) * 0.5,
      getViewportWidth(this),
      getViewportHeight(this),
      0x05101f,
      0.14
    );
    this.layoutBackground();
  }

  private createGroups(): void {
    this.playerBullets = this.physics.add.group({
      classType: PlayerBullet,
      maxSize: 96,
      runChildUpdate: true
    });

    this.enemyBullets = this.physics.add.group({
      classType: EnemyBullet,
      maxSize: 128,
      runChildUpdate: true
    });

    this.enemies = this.physics.add.group({
      classType: Enemy,
      maxSize: 48,
      runChildUpdate: true
    });

    this.bosses = this.physics.add.group({
      classType: Boss,
      maxSize: 1,
      runChildUpdate: true
    });

    this.powerUps = this.physics.add.group({
      classType: PowerUp,
      maxSize: 14,
      runChildUpdate: true
    });

    this.mines = this.physics.add.group({
      classType: Mine,
      maxSize: 8,
      runChildUpdate: true
    });
  }

  private createPlayer(): void {
    this.player = new Player(this);
    this.player.setUpgradeEffects(this.runUpgradeEffects);
    this.player.resetForRun(this.time.now);
    this.player.on(PLAYER_EVENTS.FIRED, this.handlePlayerFired, this);
    this.supportDrone = new SupportDrone(this);
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
      leftAlt: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      rightAlt: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      upAlt: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      downAlt: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      fire: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
    };
    this.pauseKeys = [
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC),
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P)
    ];
  }

  private captureWaveProgress(checkpointWave: number): SavedWaveProgressState | null {
    const progress = this.waveManager.getCurrentWave() === checkpointWave
      ? this.waveManager.captureProgress()
      : null;

    if (!progress) {
      return null;
    }

    progress.activeEnemies = this.captureActiveEnemies();
    progress.activePowerUps = this.captureActivePowerUps();
    progress.activeMines = this.captureActiveMines();
    progress.boss = this.captureBossState();
    return progress;
  }

  private captureActiveEnemies(): SavedEnemyState[] {
    const enemies: SavedEnemyState[] = [];
    this.iterateGroup(this.enemies, (gameObject) => {
      const enemy = gameObject as Enemy;
      const snapshot = enemy.capturePersistentState();
      if (snapshot) {
        enemies.push(snapshot);
      }
      return true;
    });
    return enemies;
  }

  private captureActivePowerUps(): SavedWorldPowerUpState[] {
    const powerUps: SavedWorldPowerUpState[] = [];
    this.iterateGroup(this.powerUps, (gameObject) => {
      const powerUp = gameObject as PowerUp;
      const snapshot = powerUp.capturePersistentState(this.time.now);
      if (snapshot) {
        powerUps.push(snapshot);
      }
      return true;
    });
    return powerUps;
  }

  private captureActiveMines(): SavedMineState[] {
    const mines: SavedMineState[] = [];
    this.iterateGroup(this.mines, (gameObject) => {
      const mine = gameObject as Mine;
      const snapshot = mine.capturePersistentState(this.time.now);
      if (snapshot) {
        mines.push(snapshot);
      }
      return true;
    });
    return mines;
  }

  private captureBossState(): SavedBossState {
    return this.activeBoss?.capturePersistentState() ?? { active: false };
  }

  private restoreWaveEntities(progress: SavedWaveProgressState): void {
    this.restoreActiveEnemies(progress.activeEnemies, progress.plan);
    this.restoreActiveMines(progress.activeMines);
    this.restoreActivePowerUps(progress.activePowerUps);

    if (progress.plan.kind === "boss" && progress.boss.active) {
      this.restoreBoss(progress.plan, progress.boss);
    }
  }

  private restoreActiveEnemies(enemies: SavedEnemyState[], plan: WavePlan): void {
    enemies.forEach((enemyState) => {
      const enemy = this.enemies.get() as Enemy | null;
      if (!enemy) {
        return;
      }

      enemy.restorePersistentState(enemyState, {
        wave: plan.wave,
        stage: plan.stage,
        time: this.time.now,
        director: this.combatDirector,
        telegraphs: this.telegraphSystem
      });
      this.bindEnemyAudioEvents(enemy);
    });
  }

  private restoreActiveMines(mines: SavedMineState[]): void {
    mines.forEach((mineState) => {
      const mine = this.mines.get() as Mine | null;
      if (!mine) {
        return;
      }

      mine.restorePersistentState(mineState, this.time.now);
    });
  }

  private restoreActivePowerUps(powerUps: SavedWorldPowerUpState[]): void {
    powerUps.forEach((powerUpState) => {
      const powerUp = this.powerUps.get() as PowerUp | null;
      if (!powerUp) {
        return;
      }

      powerUp.restorePersistentState(powerUpState, this.time.now);
    });
  }

  private restoreBoss(plan: WavePlan, bossState: SavedBossState): void {
    const boss = this.bosses.get() as Boss | null;
    if (!boss) {
      return;
    }

    this.bindBossAudioEvents(boss);
    boss.spawn({
      plan,
      director: this.combatDirector,
      telegraphs: this.telegraphSystem
    });
    boss.restorePersistentState(bossState, this.time.now);
    this.activeBoss = boss;
  }

  private isWaveProgressRestorable(
    progress: SavedWaveProgressState | null,
    expectedWave: number
  ): progress is SavedWaveProgressState {
    if (!progress) {
      return false;
    }

    if (progress.plan.wave !== expectedWave) {
      return false;
    }

    if (progress.nextBatchIndex > progress.plan.spawnBatches.length) {
      return false;
    }

    if (progress.plan.kind !== "boss" && progress.boss.active) {
      return false;
    }

    if (progress.plan.kind === "boss" && progress.boss.active && !progress.boss.bossId) {
      return false;
    }

    return true;
  }

  private spawnBoss(plan: WavePlan): void {
    const boss = this.bosses.get() as Boss | null;
    if (!boss) {
      return;
    }

    this.bindBossAudioEvents(boss);
    this.clearProjectiles();
    boss.spawn({
      plan,
      director: this.combatDirector,
      telegraphs: this.telegraphSystem
    });
    this.activeBoss = boss;
    this.uiSystem.setBossHealth(boss.health, boss.maxHealth);
  }

  private handlePlayerBulletHitsEnemy(bullet: PlayerBullet, enemy: Enemy): void {
    bullet.deactivate();
    this.spawnImpact(enemy.x, enemy.y, UI_COLORS.gold);

    if (!enemy.takeDamage(bullet.damage)) {
      this.audioSystem.playSfx(SFX_KEYS.ENEMY_HIT);
      return;
    }

    this.destroyEnemy(enemy, true);
  }

  private handlePlayerBulletHitsBoss(bullet: PlayerBullet, boss: Boss): void {
    bullet.deactivate();
    this.addScore(SCORE_VALUES.bossHit);
    this.spawnImpact(boss.x, boss.y + boss.displayHeight * 0.2, UI_COLORS.gold);
    this.cameras.main.shake(110, CAMERA_SHAKE_LIGHT);

    const result = boss.takeDamage(bullet.damage);
    if (!result.destroyed) {
      this.audioSystem.playSfx(SFX_KEYS.BOSS_HIT);
      this.uiSystem.setBossHealth(boss.health, boss.maxHealth);
      return;
    }

    this.destroyBoss(boss);
  }

  private handlePlayerBulletHitsMine(bullet: PlayerBullet, mine: Mine): void {
    bullet.deactivate();
    if (!mine.takeDamage()) {
      return;
    }

    this.addScore(SCORE_VALUES.mineDestroy);
    this.audioSystem.playSfx(SFX_KEYS.ENEMY_HIT);
    this.spawnBurst(mine.x, mine.y, UI_COLORS.gold, 6);
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

    this.economyTracker.recordPlayerDamage(this.waveManager.getCurrentWave(), result.lostLife);
    this.audioSystem.playSfx(SFX_KEYS.PLAYER_HURT);
    this.spawnImpact(this.player.x, this.player.y, UI_COLORS.danger);
    this.cameras.main.shake(120, CAMERA_SHAKE_LIGHT);

    if (result.gameOver) {
      this.finishRun();
      return;
    }

    if (result.lostLife) {
      this.spawnBurst(this.player.x, this.player.y, UI_COLORS.cyan, 14);
    }

    this.requestAutosave();
  }

  private handlePlayerHitsEnemy(enemy: Enemy): void {
    const result = this.player.takeDamage(enemy.contactDamage, this.time.now);
    if (result.blocked) {
      return;
    }

    this.economyTracker.recordPlayerDamage(this.waveManager.getCurrentWave(), result.lostLife);
    this.destroyEnemy(enemy, false);
    this.audioSystem.playSfx(SFX_KEYS.PLAYER_HURT);
    this.cameras.main.shake(150, CAMERA_SHAKE_LIGHT);

    if (result.gameOver) {
      this.finishRun();
      return;
    }

    this.requestAutosave();
  }

  private handlePlayerHitsBoss(boss: Boss): void {
    const result = this.player.takeDamage(boss.contactDamage, this.time.now);
    if (result.blocked) {
      return;
    }

    this.economyTracker.recordPlayerDamage(this.waveManager.getCurrentWave(), result.lostLife);
    this.audioSystem.playSfx(SFX_KEYS.PLAYER_HURT);
    this.cameras.main.shake(160, CAMERA_SHAKE_LIGHT);

    if (result.gameOver) {
      this.finishRun();
      return;
    }

    this.requestAutosave();
  }

  private handlePlayerHitsMine(mine: Mine): void {
    if (!mine.isArmed(this.time.now)) {
      return;
    }

    const result = this.player.takeDamage(mine.contactDamage, this.time.now);
    if (result.blocked) {
      return;
    }

    this.economyTracker.recordPlayerDamage(this.waveManager.getCurrentWave(), result.lostLife);
    mine.deactivate();
    this.audioSystem.playSfx(SFX_KEYS.PLAYER_HURT);
    this.spawnBurst(this.player.x, this.player.y, UI_COLORS.danger, 8);
    this.cameras.main.shake(140, CAMERA_SHAKE_LIGHT);

    if (result.gameOver) {
      this.finishRun();
      return;
    }

    this.requestAutosave();
  }

  private handlePlayerCollectsPowerUp(powerUp: PowerUp): void {
    if (!powerUp.active) {
      return;
    }

    const label = POWER_UP_LABELS[powerUp.powerUpType];
    this.player.applyPowerUp(powerUp.powerUpType, this.time.now);
    powerUp.deactivate();
    this.addScore(SCORE_VALUES.powerUpPickup);
    this.audioSystem.playSfx(SFX_KEYS.POWERUP_PICKUP);
    this.uiSystem.showBanner(`Бонус: ${label}`);
    this.spawnImpact(this.player.x, this.player.y, UI_COLORS.success);
    this.requestAutosave();
  }

  private destroyEnemy(enemy: Enemy, awardScore: boolean): void {
    const enemyType = enemy.enemyType;
    const x = enemy.x;
    const y = enemy.y;

    enemy.deactivate();

    if (awardScore) {
      this.addScore(enemy.scoreValue);
      this.economyTracker.recordEnemyKilled(enemy.role);
      this.refreshShardEstimate();
      if (!enemy.isBossAdd()) {
        this.tryDropPowerUp(enemyType, x, y);
      }
    }

    const color = ENEMY_DEFINITIONS[enemyType].color;
    this.spawnBurst(x, y, color, enemyType === "tank" ? 16 : enemyType === "heavy" ? 14 : 8);

    if (enemyType === "heavy" || enemyType === "tank") {
      this.cameras.main.shake(160, CAMERA_SHAKE_STRONG);
    }

    this.audioSystem.playSfx(SFX_KEYS.ENEMY_DESTROY);
  }

  private destroyBoss(boss: Boss): void {
    const x = boss.x;
    const y = boss.y;

    boss.deactivate();
    this.activeBoss = undefined;
    this.clearEnemyProjectiles();
    this.addScore(SCORE_VALUES.bossKill);
    this.economyTracker.recordBossKilled(this.waveManager.getCurrentWave());
    this.refreshShardEstimate();
    this.dropPowerUp("boss", x, y);
    this.uiSystem.setBossHealth(0, 0);
    this.spawnBurst(x, y, UI_COLORS.gold, 26);
    this.cameras.main.shake(260, CAMERA_SHAKE_STRONG);
    this.audioSystem.playSfx(SFX_KEYS.BOSS_DEATH);
  }

  private tryDropPowerUp(source: EnemyType, x: number, y: number): void {
    const dropBonus = this.waveManager.getCurrentPlan()?.dropBonus ?? 0;
    const probability = Math.min(0.8, POWER_UP_DROP_CHANCE[source] + dropBonus + this.runUpgradeEffects.dropChanceBonus);

    if (!chance(probability)) {
      return;
    }

    this.dropPowerUp(source, x, y);
  }

  private dropPowerUp(_source: EnemyType | "boss", x: number, y: number): void {
    const powerUp = this.powerUps.get() as PowerUp | null;
    if (!powerUp) {
      return;
    }

    const wave = this.waveManager?.getCurrentWave() ?? 1;
    const types = getAvailablePowerUpTypes(wave);
    powerUp.spawn(pickRandom(types as PowerUpType[]), x, y, this.time.now);
  }

  private addScore(amount: number): void {
    this.score += amount;
    this.uiSystem.setScore(this.score);
    this.requestAutosave();
  }

  private applyWaveStartUpgrades(plan: WavePlan): void {
    if (this.runUpgradeEffects.waveStartDoubleShotMs > 0) {
      this.player.grantTimedPowerUp("doubleShot", this.runUpgradeEffects.waveStartDoubleShotMs, this.time.now);
    }

    if (plan.kind === "boss" && this.runUpgradeEffects.bossWaveShieldMs > 0) {
      this.player.grantTimedPowerUp("shield", this.runUpgradeEffects.bossWaveShieldMs, this.time.now);
    }
  }

  private refreshShardEstimate(): void {
    this.uiSystem.setShardsEstimate(this.economyTracker.estimateReward(this.waveManager.getCurrentWave()));
  }

  private createLocalEconomyRunId(): string {
    if (typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }

    return `00000000-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, "0")}`;
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

  private clearMines(): void {
    this.iterateGroup(this.mines, (gameObject) => {
      const mine = gameObject as Mine;
      if (mine.active) {
        mine.deactivate();
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
    this.clearRunState();
    this.telegraphSystem.clear();
    this.clearProjectiles();
    this.clearMines();
    this.waveManager.shutdown();
    this.combatDirector.clearWaveContext();
    this.stopCombatMotion();
    this.audioSystem.stopMusic();
    this.audioSystem.stopAllSfx();
    this.audioSystem.playSfx(SFX_KEYS.GAME_OVER);
    this.uiSystem.showBanner("Корабль уничтожен");

    this.gameOverTimeoutId = window.setTimeout(() => {
      this.gameOverTimeoutId = undefined;
      const runId = this.economyRun?.runId ?? this.createLocalEconomyRunId();
      const economySummary = this.economyTracker.createSummary(
        runId,
        this.score,
        this.waveManager.getCurrentWave(),
        this.time.now
      );
      this.scene.start(SCENE_KEYS.GAME_OVER, {
        score: this.score,
        wave: this.waveManager.getCurrentWave(),
        session: this.completionSession,
        rankedSubmissionAllowed: this.rankedSubmissionAllowed,
        economy: {
          summary: economySummary,
          estimatedReward: this.economyTracker.estimateReward(this.waveManager.getCurrentWave()),
          authenticated: Boolean(this.economyRun)
        }
      });
    }, 650);
  }

  private buildLocalOnlySession(session: SessionPresentation): UserSession {
    return {
      mode: session.mode,
      provider: session.mode,
      isAuthenticated: false,
      isGuest: session.isGuest,
      displayName: session.displayName,
      email: null,
      avatarUrl: null,
      user: null,
      localGuest: session.isGuest,
      rankedEligible: false
    };
  }

  private forceResumeRuntimeState(): void {
    this.isPaused = false;
    this.uiSystem.showPauseOverlay(false);
    this.time.timeScale = 1;
    this.physics?.world?.resume();
  }

  private exitToMainMenu(): void {
    if (this.isFinishing) {
      return;
    }

    this.forceResumeRuntimeState();
    this.clearRunState();
    this.audioSystem.stopAllSfx();
    this.scene.start(SCENE_KEYS.MENU);
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
      this.physics?.world?.pause();
      this.time.timeScale = 0;
      this.requestAutosave(true);
      return;
    }

    this.time.timeScale = 1;
    this.physics?.world?.resume();
    this.requestAutosave();
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

  private layoutBackground(): void {
    const viewportWidth = getViewportWidth(this);
    const viewportHeight = getViewportHeight(this);

    this.background?.resize();
    this.backgroundOverlay?.setPosition(getViewportCenterX(this), viewportHeight * 0.5).setSize(viewportWidth, viewportHeight);
  }

  private refreshUiLayout(): void {
    if (!this.uiSystem) {
      return;
    }

    this.uiSystem.destroy();
    this.uiSystem = new UISystem(this, this.audioSystem, {
      onPauseResume: () => this.togglePause(),
      onPauseExitToMenu: () => this.exitToMainMenu()
    });
    this.uiSystem.bindPlayer(this.player);
    this.uiSystem.setScore(this.score);
    this.refreshShardEstimate();
    this.uiSystem.setWave(this.waveManager?.getCurrentWave() ?? 1);
    this.uiSystem.setPowerUps(this.player?.active ? this.player.getActivePowerUps(this.time.now) : []);
    this.uiSystem.setBossHealth(this.activeBoss?.health ?? 0, this.activeBoss?.maxHealth ?? 0);
    this.uiSystem.setSessionStatus(this.runSession);
    this.uiSystem.showPauseOverlay(this.isPaused);
  }

  private handleResize(): void {
    const viewportWidth = getViewportWidth(this);
    const viewportHeight = getViewportHeight(this);

    this.physics.world.setBounds(0, 0, viewportWidth, viewportHeight);
    this.layoutBackground();
    this.refreshUiLayout();

    if (this.player?.active) {
      this.player.setPosition(
        Phaser.Math.Clamp(this.player.x, this.player.displayWidth * 0.5, viewportWidth - this.player.displayWidth * 0.5),
        Phaser.Math.Clamp(this.player.y, this.player.displayHeight * 0.5, viewportHeight - this.player.displayHeight * 0.5)
      );
    }

    if (this.activeBoss?.active) {
      const minX = this.activeBoss.displayWidth * 0.5 + 28;
      const maxX = viewportWidth - this.activeBoss.displayWidth * 0.5 - 28;
      this.activeBoss.setPosition(
        Phaser.Math.Clamp(this.activeBoss.x, minX, Math.max(minX, maxX)),
        this.activeBoss.y
      );
    }
  }

  private bindEnemyAudioEvents(enemy: Enemy): void {
    if (this.trackedEnemies.has(enemy)) {
      return;
    }

    this.trackedEnemies.add(enemy);
    enemy.on(ENEMY_EVENTS.SHOT, this.handleEnemyShot, this);
  }

  private bindBossAudioEvents(boss: Boss): void {
    if (this.trackedBosses.has(boss)) {
      return;
    }

    this.trackedBosses.add(boss);
    boss.on(BOSS_EVENTS.ATTACK, this.handleBossAttack, this);
  }

  private handlePlayerFired(): void {
    this.audioSystem.playSfx(SFX_KEYS.PLAYER_SHOOT);
  }

  private handleEnemyShot(): void {
    this.audioSystem.playSfx(SFX_KEYS.ENEMY_SHOOT);
  }

  private handleBossAttack(): void {
    this.audioSystem.playSfx(SFX_KEYS.BOSS_ATTACK);
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
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;

    if (this.gameOverTimeoutId !== undefined) {
      window.clearTimeout(this.gameOverTimeoutId);
      this.gameOverTimeoutId = undefined;
    }

    this.waveManager?.shutdown();
    this.autosaveController?.destroy();
    this.collisionManager?.destroy();
    this.uiSystem?.destroy();
    this.telegraphSystem?.destroy();
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);

    this.clearProjectiles();
    this.clearMines();
    this.destroyGroupMembers(this.enemies);
    this.destroyGroupMembers(this.bosses);
    this.destroyGroupMembers(this.powerUps);
    this.destroyGroupMembers(this.mines);
    this.destroyGroupMembers(this.playerBullets);
    this.destroyGroupMembers(this.enemyBullets);

    if (this.controls) {
      this.input.keyboard?.removeKey(this.controls.left);
      this.input.keyboard?.removeKey(this.controls.right);
      this.input.keyboard?.removeKey(this.controls.up);
      this.input.keyboard?.removeKey(this.controls.down);
      if (this.controls.leftAlt) {
        this.input.keyboard?.removeKey(this.controls.leftAlt);
      }
      if (this.controls.rightAlt) {
        this.input.keyboard?.removeKey(this.controls.rightAlt);
      }
      if (this.controls.upAlt) {
        this.input.keyboard?.removeKey(this.controls.upAlt);
      }
      if (this.controls.downAlt) {
        this.input.keyboard?.removeKey(this.controls.downAlt);
      }
      this.input.keyboard?.removeKey(this.controls.fire);
      this.controls = undefined;
    }

    this.pauseKeys.forEach((key) => {
      this.input.keyboard?.removeKey(key);
    });
    this.pauseKeys = [];

    this.player?.off(PLAYER_EVENTS.FIRED, this.handlePlayerFired, this);
    this.player?.destroy();
    this.supportDrone?.destroy();
    this.activeBoss = undefined;
    this.background?.destroy();
    this.background = undefined;
    this.backgroundOverlay = undefined;
    this.physics?.world?.resume();
    this.time.timeScale = 1;
    this.tweens?.killAll();

    this.controls = undefined;
    this.playerBullets = undefined as unknown as Phaser.Physics.Arcade.Group;
    this.enemyBullets = undefined as unknown as Phaser.Physics.Arcade.Group;
    this.enemies = undefined as unknown as Phaser.Physics.Arcade.Group;
    this.bosses = undefined as unknown as Phaser.Physics.Arcade.Group;
    this.powerUps = undefined as unknown as Phaser.Physics.Arcade.Group;
    this.mines = undefined as unknown as Phaser.Physics.Arcade.Group;
    this.player = undefined as unknown as Player;
    this.autosaveController = undefined;
    this.pendingSavedRun = undefined;
    this.rankedSubmissionAllowed = true;
    this.completionSession = undefined as unknown as UserSession;
    this.economyRun = undefined;
    this.runUpgradeEffects = DEFAULT_RUN_UPGRADE_EFFECTS;
    this.economyTracker = undefined as unknown as RunEconomyTracker;
  }
}
