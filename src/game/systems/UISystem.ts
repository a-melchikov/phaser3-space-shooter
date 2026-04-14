import Phaser from "phaser";

import { Player } from "../entities/Player";
import type { ActivePowerUpState } from "../types/game";
import { UI_COLORS, WORLD_HEIGHT, WORLD_WIDTH } from "../utils/constants";

export class UISystem {
  private player?: Player;
  private readonly hudObjects: Phaser.GameObjects.GameObject[] = [];
  private readonly healthFill: Phaser.GameObjects.Rectangle;
  private readonly healthText: Phaser.GameObjects.Text;
  private readonly livesText: Phaser.GameObjects.Text;
  private readonly scoreText: Phaser.GameObjects.Text;
  private readonly waveText: Phaser.GameObjects.Text;
  private readonly powerUpText: Phaser.GameObjects.Text;
  private readonly bossBarBg: Phaser.GameObjects.Rectangle;
  private readonly bossBarFill: Phaser.GameObjects.Rectangle;
  private readonly bossBarText: Phaser.GameObjects.Text;
  private readonly pauseOverlay: Phaser.GameObjects.Rectangle;
  private readonly pauseText: Phaser.GameObjects.Text;
  private readonly bannerText: Phaser.GameObjects.Text;
  private bannerTween?: Phaser.Tweens.Tween;
  private score = 0;
  private wave = 1;

  public constructor(private readonly scene: Phaser.Scene) {
    const panel = scene.add
      .rectangle(208, 52, 392, 78, UI_COLORS.panel, 0.86)
      .setStrokeStyle(2, UI_COLORS.cyan, 0.14)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(50);

    const healthLabel = scene.add
      .text(18, 18, "Здоровье", {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "14px",
        color: "#9abed8"
      })
      .setScrollFactor(0)
      .setDepth(51);

    const healthBg = scene.add
      .rectangle(18, 42, 180, 14, 0x16253d, 1)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(51);

    this.healthFill = scene.add
      .rectangle(18, 42, 180, 14, UI_COLORS.success, 1)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(52);

    this.healthText = scene.add
      .text(18, 53, "100 / 100", {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "14px",
        color: "#eaf7ff"
      })
      .setScrollFactor(0)
      .setDepth(52);

    this.livesText = scene.add
      .text(228, 20, "Жизни: 3", {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "18px",
        color: "#eaf7ff",
        fontStyle: "bold"
      })
      .setScrollFactor(0)
      .setDepth(52);

    this.scoreText = scene.add
      .text(228, 44, "Счёт: 0", {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "18px",
        color: "#ffd76c",
        fontStyle: "bold"
      })
      .setScrollFactor(0)
      .setDepth(52);

    this.waveText = scene.add
      .text(WORLD_WIDTH - 18, 20, "Волна: 1", {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "18px",
        color: "#6ef2ff",
        fontStyle: "bold"
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(52);

    this.powerUpText = scene.add
      .text(WORLD_WIDTH - 18, 46, "Бонусы: нет", {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "14px",
        color: "#9abed8"
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(52);

    this.bossBarBg = scene.add
      .rectangle(WORLD_WIDTH * 0.5, 88, 340, 16, 0x16253d, 1)
      .setScrollFactor(0)
      .setDepth(52)
      .setVisible(false);

    this.bossBarFill = scene.add
      .rectangle(WORLD_WIDTH * 0.5 - 170, 88, 340, 16, UI_COLORS.danger, 1)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(53)
      .setVisible(false);

    this.bossBarText = scene.add
      .text(WORLD_WIDTH * 0.5, 64, "", {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "14px",
        color: "#ffdce2"
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(53)
      .setVisible(false);

    this.pauseOverlay = scene.add
      .rectangle(WORLD_WIDTH * 0.5, WORLD_HEIGHT * 0.5, WORLD_WIDTH, WORLD_HEIGHT, 0x000000, 0.45)
      .setScrollFactor(0)
      .setDepth(120)
      .setVisible(false);

    this.pauseText = scene.add
      .text(WORLD_WIDTH * 0.5, WORLD_HEIGHT * 0.5, "Пауза", {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "48px",
        color: "#eaf7ff",
        fontStyle: "bold"
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(121)
      .setVisible(false);

    this.bannerText = scene.add
      .text(WORLD_WIDTH * 0.5, WORLD_HEIGHT * 0.42, "", {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "36px",
        color: "#eaf7ff",
        fontStyle: "bold",
        align: "center"
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(110)
      .setVisible(false);

    this.hudObjects.push(
      panel,
      healthLabel,
      healthBg,
      this.healthFill,
      this.healthText,
      this.livesText,
      this.scoreText,
      this.waveText,
      this.powerUpText,
      this.bossBarBg,
      this.bossBarFill,
      this.bossBarText,
      this.pauseOverlay,
      this.pauseText,
      this.bannerText
    );
  }

  public bindPlayer(player: Player): void {
    this.player = player;
  }

  public refresh(time: number): void {
    if (!this.player) {
      return;
    }

    const ratio = Phaser.Math.Clamp(this.player.health / this.player.maxHealth, 0, 1);
    this.healthFill.displayWidth = 180 * ratio;
    this.healthFill.fillColor = ratio > 0.55 ? UI_COLORS.success : ratio > 0.25 ? UI_COLORS.gold : UI_COLORS.danger;
    this.healthText.setText(`${Math.ceil(this.player.health)} / ${this.player.maxHealth}`);
    this.livesText.setText(`Жизни: ${this.player.lives}`);

    this.setPowerUps(this.player.getActivePowerUps(time));
  }

  public setScore(score: number): void {
    this.score = score;
    this.scoreText.setText(`Счёт: ${this.score}`);
  }

  public setWave(wave: number): void {
    this.wave = wave;
    this.waveText.setText(`Волна: ${this.wave}`);
  }

  public setBossHealth(current: number, max: number): void {
    const visible = max > 0 && current > 0;
    this.bossBarBg.setVisible(visible);
    this.bossBarFill.setVisible(visible);
    this.bossBarText.setVisible(visible);

    if (!visible) {
      return;
    }

    const ratio = Phaser.Math.Clamp(current / max, 0, 1);
    this.bossBarFill.displayWidth = 340 * ratio;
    this.bossBarText.setText(`Босс: ${Math.ceil(current)} / ${max}`);
  }

  public setPowerUps(effects: ActivePowerUpState[]): void {
    if (effects.length === 0) {
      this.powerUpText.setText("Бонусы: нет");
      return;
    }

    const text = effects
      .map((effect) => `${effect.label} ${(effect.remainingMs / 1000).toFixed(1)}с`)
      .join("  •  ");

    this.powerUpText.setText(`Бонусы: ${text}`);
  }

  public showBanner(text: string): void {
    this.bannerTween?.stop();
    this.bannerText.setText(text);
    this.bannerText.setAlpha(0);
    this.bannerText.setVisible(true);

    this.bannerTween = this.scene.tweens.add({
      targets: this.bannerText,
      alpha: { from: 0, to: 1 },
      duration: 220,
      hold: 1200,
      yoyo: true,
      onComplete: () => {
        this.bannerText.setVisible(false);
      }
    });
  }

  public showPauseOverlay(visible: boolean): void {
    this.pauseOverlay.setVisible(visible);
    this.pauseText.setVisible(visible);
  }

  public destroy(): void {
    this.bannerTween?.stop();
    this.hudObjects.forEach((object) => object.destroy());
    this.hudObjects.length = 0;
    this.player = undefined;
  }
}
