import Phaser from "phaser";

import { BOSS_DEFINITIONS } from "../config/bosses";
import type { BossId, BossPhaseId, PlayerCombatSnapshot, WavePlan } from "../types/combat";
import type { SavedBossState } from "../types/runState";
import { getSpawnLaneX } from "../utils/enemyFactory";
import { getViewportHeight, getViewportWidth } from "../utils/viewport";
import { CombatDirector } from "../systems/CombatDirector";
import { TelegraphSystem } from "../systems/TelegraphSystem";

export const BOSS_EVENTS = {
  ATTACK: "boss-attack"
} as const;

interface BossSpawnOptions {
  plan: WavePlan;
  director: CombatDirector;
  telegraphs: TelegraphSystem;
}

export interface BossDamageResult {
  destroyed: boolean;
  blocked: boolean;
  appliedDamage: number;
}

interface BeamSweepState {
  startX: number;
  endX: number;
  startAt: number;
  endsAt: number;
  nextTickAt: number;
  damage: number;
  width: number;
}

const BOSS_ATTACK_COOLDOWNS: Record<BossId, number> = {
  bulwarkHowitzer: 1300,
  blinkReaver: 1200,
  broodCarrier: 1500,
  prismBeamArray: 1500,
  aegisCoreMatrix: 1350
};

export class Boss extends Phaser.Physics.Arcade.Image {
  public bossId: BossId = "bulwarkHowitzer";
  public maxHealth = 1;
  public health = 1;
  public contactDamage = 40;

  private readonly baseCenterX: number;
  private phase: BossPhaseId = "phase1";
  private bossCycle = 0;
  private isEntering = true;
  private spawnedAt = 0;
  private director?: CombatDirector;
  private telegraphs?: TelegraphSystem;
  private movementSpeed = 120;
  private attackCooldownMs = 1300;
  private nextActionAt = 0;
  private attackIndex = 0;
  private damageFlashUntil = 0;
  private pendingAttack?: string;
  private attackReleaseAt = 0;
  private storedPoints: number[] = [];
  private dashTargetX = 0;
  private dashStartX = 0;
  private dashStartedAt = 0;
  private dashEndsAt = 0;
  private beamSweep?: BeamSweepState;
  private shielded = false;
  private shieldToggleAt = 0;
  private phaseTransitioned: Record<BossPhaseId, boolean> = {
    phase1: true,
    phase2: false,
    phase3: false
  };

  public constructor(scene: Phaser.Scene, x = -200, y = -200) {
    super(scene, x, y, BOSS_DEFINITIONS.bulwarkHowitzer.textureKey);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);

    this.baseCenterX = getViewportWidth(scene) * 0.5;
    this.setActive(false);
    this.setVisible(false);
    this.setDepth(9);
  }

  public spawn(options: BossSpawnOptions): void {
    const definition = BOSS_DEFINITIONS[options.plan.bossId ?? "bulwarkHowitzer"];
    const body = this.body as Phaser.Physics.Arcade.Body;
    const cycleMultiplier = Math.max(0, options.plan.bossCycle);
    const healthMultiplier = Math.pow(definition.repeatHealthMultiplier, cycleMultiplier);
    const speedMultiplier = Math.pow(definition.repeatMoveMultiplier, cycleMultiplier);
    const cooldownMultiplier = Math.pow(definition.repeatCooldownMultiplier, cycleMultiplier);

    this.bossId = definition.id;
    this.director = options.director;
    this.telegraphs = options.telegraphs;
    this.bossCycle = options.plan.bossCycle;
    this.spawnedAt = this.scene.time.now;
    this.maxHealth = definition.baseHealth * healthMultiplier;
    this.health = this.maxHealth;
    this.contactDamage = definition.contactDamage;
    this.movementSpeed = definition.moveSpeed * speedMultiplier;
    this.attackCooldownMs = BOSS_ATTACK_COOLDOWNS[definition.id] * cooldownMultiplier;
    this.phase = "phase1";
    this.isEntering = true;
    this.nextActionAt = this.scene.time.now + 900;
    this.attackIndex = 0;
    this.damageFlashUntil = 0;
    this.pendingAttack = undefined;
    this.attackReleaseAt = 0;
    this.storedPoints = [];
    this.dashTargetX = this.baseCenterX;
    this.dashStartX = this.baseCenterX;
    this.dashStartedAt = 0;
    this.dashEndsAt = 0;
    this.beamSweep = undefined;
    this.shielded = definition.id === "aegisCoreMatrix";
    this.shieldToggleAt = this.scene.time.now + 1500;
    this.phaseTransitioned = {
      phase1: true,
      phase2: false,
      phase3: false
    };

    this.enableBody(true, getViewportWidth(this.scene) * 0.5, -definition.height, true, true);
    this.setTexture(definition.textureKey);
    this.setDisplaySize(definition.width, definition.height);
    body.setSize(definition.width * 0.8, definition.height * 0.72, true);
    body.setVelocity(0, definition.enterSpeed);
    this.clearTint();
  }

  public updateState(time: number, player = this.director?.getPlayerSnapshot() as PlayerCombatSnapshot | undefined): void {
    if (!this.active || !player) {
      return;
    }

    const definition = BOSS_DEFINITIONS[this.bossId];
    const body = this.body as Phaser.Physics.Arcade.Body;

    if (this.isEntering) {
      if (this.y >= definition.targetY) {
        this.isEntering = false;
        body.setVelocity(0, 0);
      }
      return;
    }

    this.updatePhase(time);
    this.updateShieldState(time);
    this.updateMovement(time);
    this.updateBeamSweep(time);

    if (this.pendingAttack && time >= this.attackReleaseAt) {
      this.executePendingAttack(time, player);
      this.pendingAttack = undefined;
      this.attackReleaseAt = 0;
      this.nextActionAt = time + this.getCurrentAttackCooldown();
    } else if (!this.pendingAttack && time >= this.nextActionAt) {
      this.queueNextAttack(time, player);
    }

    if (time < this.damageFlashUntil) {
      this.setTintFill(0xffffff);
      return;
    }

    if (this.shielded && this.bossId === "aegisCoreMatrix") {
      this.setTint(0xffd76c);
      return;
    }

    this.clearTint();
  }

  public takeDamage(amount: number): BossDamageResult {
    const reduced = this.bossId === "aegisCoreMatrix" && this.shielded;
    const appliedDamage = reduced ? amount * 0.35 : amount;
    this.health = Math.max(0, this.health - appliedDamage);
    this.damageFlashUntil = this.scene.time.now + 90;

    return {
      destroyed: this.health <= 0,
      blocked: reduced,
      appliedDamage
    };
  }

  public deactivate(): void {
    this.disableBody(true, true);
    this.setVelocity(0, 0);
    this.clearTint();
    this.beamSweep = undefined;
    this.pendingAttack = undefined;
  }

  public capturePersistentState(): SavedBossState {
    return {
      active: this.active,
      bossId: this.active ? this.bossId : undefined,
      health: this.active ? this.health : undefined,
      maxHealth: this.active ? this.maxHealth : undefined,
      x: this.active ? this.x : undefined,
      y: this.active ? this.y : undefined
    };
  }

  public restorePersistentState(state: SavedBossState, time: number): void {
    if (!this.active) {
      return;
    }

    this.isEntering = false;
    this.maxHealth = Math.max(this.maxHealth, state.maxHealth ?? this.maxHealth);
    this.health = Phaser.Math.Clamp(state.health ?? this.maxHealth, 1, this.maxHealth);
    this.setPosition(state.x ?? this.x, state.y ?? this.y);
    this.setVelocity(0, 0);
    this.pendingAttack = undefined;
    this.attackReleaseAt = 0;
    this.nextActionAt = time + 500;
    this.beamSweep = undefined;
  }

  public override destroy(fromScene?: boolean): void {
    this.beamSweep = undefined;
    super.destroy(fromScene);
  }

  private updatePhase(time: number): void {
    const thresholds = BOSS_DEFINITIONS[this.bossId].phaseThresholds;
    const ratio = this.health / this.maxHealth;
    const nextPhase: BossPhaseId = ratio <= thresholds[1] ? "phase3" : ratio <= thresholds[0] ? "phase2" : "phase1";

    if (nextPhase !== this.phase) {
      this.phase = nextPhase;
      if (!this.phaseTransitioned[nextPhase]) {
        this.phaseTransitioned[nextPhase] = true;
        this.telegraphs?.showChargeRing({ x: this.x, y: this.y }, this.displayWidth * 0.34, 520, BOSS_DEFINITIONS[this.bossId].color);
        this.nextActionAt = Math.max(this.nextActionAt, time + 320);
      }
    }
  }

  private updateMovement(time: number): void {
    const width = getViewportWidth(this.scene);
    const minX = this.displayWidth * 0.5 + 32;
    const maxX = width - this.displayWidth * 0.5 - 32;

    if (time < this.dashEndsAt) {
      const progress = Phaser.Math.Clamp((time - this.dashStartedAt) / Math.max(1, this.dashEndsAt - this.dashStartedAt), 0, 1);
      this.x = Phaser.Math.Linear(this.dashStartX, this.dashTargetX, progress);
      return;
    }

    if (this.bossId === "bulwarkHowitzer") {
      this.x = Phaser.Math.Clamp(this.baseCenterX + Math.sin((time - this.spawnedAt) * 0.001 * 0.8) * 230, minX, maxX);
      return;
    }

    if (this.bossId === "blinkReaver") {
      this.x = Phaser.Math.Clamp(this.baseCenterX + Math.sin((time - this.spawnedAt) * 0.001 * 1.5) * 260, minX, maxX);
      return;
    }

    if (this.bossId === "broodCarrier") {
      this.x = Phaser.Math.Clamp(this.baseCenterX + Math.sin((time - this.spawnedAt) * 0.001 * 0.9) * 190, minX, maxX);
      this.y = BOSS_DEFINITIONS[this.bossId].targetY + Math.sin((time - this.spawnedAt) * 0.001 * 1.3) * 10;
      return;
    }

    if (this.bossId === "prismBeamArray") {
      this.x = Phaser.Math.Clamp(this.baseCenterX + Math.sin((time - this.spawnedAt) * 0.001 * 1.05) * 210, minX, maxX);
      return;
    }

    this.x = Phaser.Math.Clamp(this.baseCenterX + Math.sin((time - this.spawnedAt) * 0.001 * 0.7) * 160, minX, maxX);
  }

  private updateShieldState(time: number): void {
    if (this.bossId !== "aegisCoreMatrix" || time < this.shieldToggleAt) {
      return;
    }

    this.shielded = !this.shielded;
    const nextDuration = this.phase === "phase1"
      ? this.shielded ? 1500 : 1300
      : this.phase === "phase2"
        ? this.shielded ? 1200 : 1500
        : this.shielded ? 900 : 1700;

    this.shieldToggleAt = time + nextDuration;
    this.telegraphs?.showChargeRing({ x: this.x, y: this.y }, this.displayWidth * 0.3, 360, 0xffd76c);
  }

  private updateBeamSweep(time: number): void {
    if (!this.beamSweep || !this.director) {
      return;
    }

    if (time >= this.beamSweep.endsAt) {
      this.beamSweep = undefined;
      return;
    }

    if (time < this.beamSweep.nextTickAt) {
      return;
    }

    const progress = Phaser.Math.Clamp((time - this.beamSweep.startAt) / (this.beamSweep.endsAt - this.beamSweep.startAt), 0, 1);
    const x = Phaser.Math.Linear(this.beamSweep.startX, this.beamSweep.endX, progress);
    this.director.requestEnemyBullet({
      x,
      y: this.y + this.displayHeight * 0.28,
      velocityX: 0,
      velocityY: 430,
      damage: this.beamSweep.damage,
      tint: BOSS_DEFINITIONS[this.bossId].color,
      scaleX: this.beamSweep.width,
      scaleY: 2.2
    });
    this.beamSweep.nextTickAt = time + 70;
    this.emit(BOSS_EVENTS.ATTACK, this);
  }

  private queueNextAttack(time: number, player: PlayerCombatSnapshot): void {
    switch (this.bossId) {
      case "bulwarkHowitzer":
        this.queueBulwarkAttack(time, player);
        return;
      case "blinkReaver":
        this.queueBlinkAttack(time, player);
        return;
      case "broodCarrier":
        this.queueCarrierAttack(time);
        return;
      case "prismBeamArray":
        this.queuePrismAttack(time);
        return;
      case "aegisCoreMatrix":
        this.queueAegisAttack(time, player);
        return;
      default:
        return;
    }
  }

  private executePendingAttack(time: number, player: PlayerCombatSnapshot): void {
    switch (this.pendingAttack) {
      case "bulwarkFan":
        this.fireFan(7, 0.82, 320, 12);
        return;
      case "bulwarkMortar":
        this.fireMortarRain(360, 15);
        return;
      case "bulwarkAimed":
        this.fireAimedBurst(player, 4, 0.36, 360, 13);
        return;
      case "blinkVolley":
        this.setBlinkDestination();
        this.fireAimedBurst(player, 3, 0.24, 350, 12);
        return;
      case "blinkDash":
        this.dashStartX = this.x;
        this.dashStartedAt = time;
        this.dashEndsAt = time + 240;
        this.fireFan(this.phase === "phase3" ? 6 : 5, this.phase === "phase3" ? 1.12 : 0.92, 340, 12);
        return;
      case "blinkCross":
        this.setBlinkDestination();
        this.fireCrossBurst(360, 12);
        return;
      case "carrierVolley":
        this.fireFan(6, 0.72, 320, 11);
        return;
      case "carrierSummon":
        this.spawnCarrierAdds();
        return;
      case "carrierPods":
        this.spawnCarrierPods();
        return;
      case "prismBeam":
        this.startBeamSweep(time, 13);
        return;
      case "prismCurtain":
        this.fireSafeLaneCurtain(11);
        return;
      case "aegisSpokes":
        this.fireFan(this.phase === "phase3" ? 8 : 6, this.phase === "phase3" ? 1.5 : 1.12, 320, 12);
        return;
      case "aegisCore":
        this.fireAimedBurst(player, this.phase === "phase3" ? 5 : 4, 0.52, 360, 13);
        return;
      default:
        return;
    }
  }

  private queueBulwarkAttack(time: number, player: PlayerCombatSnapshot): void {
    const pattern = this.phase === "phase1"
      ? ["bulwarkFan", "bulwarkMortar"]
      : this.phase === "phase2"
        ? ["bulwarkFan", "bulwarkMortar", "bulwarkAimed"]
        : ["bulwarkAimed", "bulwarkMortar", "bulwarkFan"];
    const attack = pattern[this.attackIndex % pattern.length];
    this.attackIndex += 1;

    if (attack === "bulwarkMortar") {
      const targetY = getViewportHeight(this.scene) * 0.68;
      this.storedPoints = [1, 2, 3].map((lane) => getSpawnLaneX(getViewportWidth(this.scene), lane, 18));
      this.storedPoints.forEach((pointX) => {
        this.telegraphs?.showImpactMarker({ x: pointX, y: targetY }, 24, 700, 0xffa56b);
      });
      this.pendingAttack = attack;
      this.attackReleaseAt = time + 700;
      return;
    }

    if (attack === "bulwarkAimed") {
      this.telegraphs?.showAimLine(
        { x: this.x, y: this.y + this.displayHeight * 0.28 },
        { x: player.x, y: player.y },
        380,
        BOSS_DEFINITIONS[this.bossId].color
      );
      this.pendingAttack = attack;
      this.attackReleaseAt = time + 380;
      return;
    }

    this.telegraphs?.showMuzzleFlash({ x: this.x, y: this.y + this.displayHeight * 0.32 }, 420, BOSS_DEFINITIONS[this.bossId].color, 0.55);
    this.pendingAttack = attack;
    this.attackReleaseAt = time + 420;
  }

  private queueBlinkAttack(time: number, player: PlayerCombatSnapshot): void {
    const pattern = this.phase === "phase1"
      ? ["blinkVolley", "blinkDash"]
      : this.phase === "phase2"
        ? ["blinkDash", "blinkVolley", "blinkCross"]
        : ["blinkCross", "blinkDash", "blinkVolley"];
    const attack = pattern[this.attackIndex % pattern.length];
    this.attackIndex += 1;

    this.dashTargetX = getSpawnLaneX(getViewportWidth(this.scene), Phaser.Math.Between(0, 4), this.displayWidth * 0.5);
    this.telegraphs?.showImpactMarker({ x: this.dashTargetX, y: this.y }, 22, 420, 0x6ef2ff);

    if (attack === "blinkDash") {
      this.telegraphs?.showAimLine(
        { x: this.x, y: this.y },
        { x: this.dashTargetX, y: this.y + 8 },
        380,
        0x6ef2ff
      );
      this.dashEndsAt = time + 260;
    } else if (attack === "blinkVolley") {
      this.telegraphs?.showAimLine(
        { x: this.dashTargetX, y: this.y },
        { x: player.x, y: player.y },
        380,
        0x6ef2ff
      );
    }

    this.pendingAttack = attack;
    this.attackReleaseAt = time + 420;
  }

  private queueCarrierAttack(time: number): void {
    const pattern = this.phase === "phase1"
      ? ["carrierVolley", "carrierSummon"]
      : this.phase === "phase2"
        ? ["carrierSummon", "carrierPods", "carrierVolley"]
        : ["carrierPods", "carrierSummon", "carrierVolley"];
    const attack = pattern[this.attackIndex % pattern.length];
    this.attackIndex += 1;

    this.telegraphs?.showChargeRing({ x: this.x, y: this.y }, this.displayWidth * 0.28, 460, 0x79f7c1);
    this.pendingAttack = attack;
    this.attackReleaseAt = time + 460;
  }

  private queuePrismAttack(time: number): void {
    const attack = this.attackIndex % 2 === 0 ? "prismBeam" : "prismCurtain";
    this.attackIndex += 1;

    if (attack === "prismBeam") {
      const startLane = Phaser.Math.Between(0, 4);
      const endLane = this.phase === "phase3" ? 4 - startLane : Phaser.Math.Between(0, 4);
      this.storedPoints = [
        getSpawnLaneX(getViewportWidth(this.scene), startLane, 20),
        getSpawnLaneX(getViewportWidth(this.scene), endLane, 20)
      ];
      this.telegraphs?.showBeamLine(
        { x: this.storedPoints[0], y: this.y + this.displayHeight * 0.28 },
        { x: this.storedPoints[0], y: getViewportHeight(this.scene) + 20 },
        26,
        680,
        0xc39bff
      );
      this.pendingAttack = attack;
      this.attackReleaseAt = time + 680;
      return;
    }

    this.pendingAttack = attack;
    this.attackReleaseAt = time + 360;
  }

  private queueAegisAttack(time: number, player: PlayerCombatSnapshot): void {
    const attack = this.shielded ? "aegisSpokes" : "aegisCore";
    this.attackIndex += 1;

    if (!this.shielded) {
      this.telegraphs?.showAimLine(
        { x: this.x, y: this.y + this.displayHeight * 0.3 },
        { x: player.x, y: player.y },
        420,
        0xffd76c
      );
    } else {
      this.telegraphs?.showChargeRing({ x: this.x, y: this.y }, this.displayWidth * 0.26, 360, 0xffd76c);
    }

    this.pendingAttack = attack;
    this.attackReleaseAt = time + 420;
  }

  private fireFan(count: number, spread: number, speed: number, damage: number): void {
    const fired = this.director?.fireSpread(
      { x: this.x, y: this.y + this.displayHeight * 0.36 },
      Math.PI * 0.5,
      count + (this.bossCycle > 0 ? 1 : 0),
      spread,
      speed,
      damage + this.bossCycle,
      BOSS_DEFINITIONS[this.bossId].color,
      1.18
    ) ?? 0;

    if (fired > 0) {
      this.emit(BOSS_EVENTS.ATTACK, this);
    }
  }

  private fireAimedBurst(player: PlayerCombatSnapshot, count: number, spread: number, speed: number, damage: number): void {
    const target = this.predictPlayer(player, 170);
    const angle = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
    const fired = this.director?.fireSpread(
      { x: this.x, y: this.y + this.displayHeight * 0.34 },
      angle,
      count + (this.bossCycle > 0 ? 1 : 0),
      spread,
      speed,
      damage + this.bossCycle,
      BOSS_DEFINITIONS[this.bossId].color,
      1.05
    ) ?? 0;

    if (fired > 0) {
      this.emit(BOSS_EVENTS.ATTACK, this);
    }
  }

  private fireMortarRain(speed: number, damage: number): void {
    this.storedPoints.forEach((pointX) => {
      this.director?.requestEnemyBullet({
        x: pointX,
        y: -16,
        velocityX: 0,
        velocityY: speed,
        damage: damage + this.bossCycle,
        tint: BOSS_DEFINITIONS[this.bossId].color,
        scaleX: 1.14,
        scaleY: 1.54
      });
    });
    this.emit(BOSS_EVENTS.ATTACK, this);
  }

  private fireCrossBurst(speed: number, damage: number): void {
    const angles = [Math.PI * 0.5 - 0.5, Math.PI * 0.5 - 0.16, Math.PI * 0.5 + 0.16, Math.PI * 0.5 + 0.5];
    angles.forEach((angle) => {
      this.director?.requestEnemyBullet({
        x: this.x,
        y: this.y + this.displayHeight * 0.28,
        velocityX: Math.cos(angle) * speed,
        velocityY: Math.sin(angle) * speed,
        damage: damage + this.bossCycle,
        tint: BOSS_DEFINITIONS[this.bossId].color,
        angle: angle + Math.PI * 0.5
      });
    });
    this.emit(BOSS_EVENTS.ATTACK, this);
  }

  private spawnCarrierAdds(): void {
    const lanes = [1, 3];
    lanes.forEach((lane, index) => {
      this.director?.spawnBossAdd({
        archetype: this.phase === "phase1" ? (index === 0 ? "basic" : "fast") : "heavy",
        variant: "normal",
        role: this.phase === "phase1" ? "common" : "elite",
        lane,
        source: "boss"
      }, this.director?.getCurrentPlan()?.wave ?? 1);
    });

    if (this.phase === "phase3") {
      this.director?.spawnBossAdd({
        archetype: "kamikaze",
        variant: "elite",
        role: "elite",
        lane: 2,
        source: "boss"
      }, this.director?.getCurrentPlan()?.wave ?? 1);
    }

    this.emit(BOSS_EVENTS.ATTACK, this);
  }

  private spawnCarrierPods(): void {
    [0, 4].forEach((lane) => {
      this.director?.spawnBossAdd({
        archetype: "kamikaze",
        variant: this.phase === "phase3" ? "elite" : "normal",
        role: this.phase === "phase3" ? "elite" : "special",
        lane,
        source: "boss"
      }, this.director?.getCurrentPlan()?.wave ?? 1);
    });
    this.fireFan(5, 0.62, 310, 10);
  }

  private startBeamSweep(time: number, damage: number): void {
    const [startX, endX] = this.storedPoints;
    this.beamSweep = {
      startX,
      endX,
      startAt: time,
      endsAt: time + (this.phase === "phase3" ? 950 : 820),
      nextTickAt: time,
      damage: damage + this.bossCycle,
      width: this.phase === "phase3" ? 1.5 : 1.3
    };
    this.emit(BOSS_EVENTS.ATTACK, this);
  }

  private fireSafeLaneCurtain(damage: number): void {
    const safeLane = Phaser.Math.Between(0, 4);
    for (let lane = 0; lane < 5; lane += 1) {
      if (lane === safeLane) {
        continue;
      }

      const x = getSpawnLaneX(getViewportWidth(this.scene), lane, 18);
      this.director?.requestEnemyBullet({
        x,
        y: this.y + this.displayHeight * 0.3,
        velocityX: 0,
        velocityY: 360,
        damage: damage + this.bossCycle,
        tint: BOSS_DEFINITIONS[this.bossId].color,
        scaleX: 1.08,
        scaleY: 1.8
      });
    }
    this.emit(BOSS_EVENTS.ATTACK, this);
  }

  private setBlinkDestination(): void {
    this.x = this.dashTargetX;
  }

  private predictPlayer(player: PlayerCombatSnapshot, leadMs: number): { x: number; y: number } {
    const leadSeconds = Math.min(0.22, Math.max(0, leadMs) / 1000);
    return {
      x: player.x + player.velocityX * leadSeconds,
      y: player.y + player.velocityY * leadSeconds
    };
  }

  private getCurrentAttackCooldown(): number {
    if (this.phase === "phase2") {
      return this.attackCooldownMs * 0.92;
    }

    if (this.phase === "phase3") {
      return this.attackCooldownMs * 0.82;
    }

    return this.attackCooldownMs;
  }
}
