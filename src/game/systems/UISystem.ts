import Phaser from "phaser";

import { Player } from "../entities/Player";
import type { ActivePowerUpState, SessionPresentation } from "../types/game";
import { SFX_KEYS } from "../utils/audioKeys";
import { UI_COLORS } from "../utils/constants";
import { clamp, configureText } from "../utils/helpers";
import { getViewportCenterX, getViewportCenterY, getViewportHeight, getViewportWidth } from "../utils/viewport";
import { AudioSystem } from "./AudioSystem";

interface PauseButton {
  background: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
}

interface UISystemOptions {
  onPauseExitToMenu?: () => void;
}

export class UISystem {
  private player?: Player;
  private readonly hudObjects: Phaser.GameObjects.GameObject[] = [];
  private readonly pauseButtons: PauseButton[] = [];
  private readonly healthFill: Phaser.GameObjects.Rectangle;
  private readonly healthText: Phaser.GameObjects.Text;
  private readonly livesText: Phaser.GameObjects.Text;
  private readonly scoreText: Phaser.GameObjects.Text;
  private readonly waveText: Phaser.GameObjects.Text;
  private readonly powerUpText: Phaser.GameObjects.Text;
  private readonly sessionText: Phaser.GameObjects.Text;
  private readonly rankedText: Phaser.GameObjects.Text;
  private readonly bossBarBg: Phaser.GameObjects.Rectangle;
  private readonly bossBarFill: Phaser.GameObjects.Rectangle;
  private readonly bossBarText: Phaser.GameObjects.Text;
  private readonly pauseOverlay: Phaser.GameObjects.Rectangle;
  private readonly pausePanel: Phaser.GameObjects.Rectangle;
  private readonly pauseText: Phaser.GameObjects.Text;
  private readonly pauseHintText: Phaser.GameObjects.Text;
  private readonly pauseMuteValueText: Phaser.GameObjects.Text;
  private readonly pauseMusicValueText: Phaser.GameObjects.Text;
  private readonly pauseSfxValueText: Phaser.GameObjects.Text;
  private readonly bannerText: Phaser.GameObjects.Text;
  private bannerTween?: Phaser.Tweens.Tween;
  private score = 0;
  private wave = 1;

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly audioSystem: AudioSystem,
    private readonly options: UISystemOptions = {}
  ) {
    const viewportWidth = getViewportWidth(scene);
    const viewportHeight = getViewportHeight(scene);
    const viewportCenterX = getViewportCenterX(scene);
    const viewportCenterY = getViewportCenterY(scene);

    const panel = scene.add
      .rectangle(208, 58, 404, 90, UI_COLORS.panel, 0.86)
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
      .text(18, 54, "100 / 100", {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "14px",
        color: "#eaf7ff"
      })
      .setScrollFactor(0)
      .setDepth(52);

    this.livesText = scene.add
      .text(248, 18, "Жизни: 3", {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "18px",
        color: "#eaf7ff",
        fontStyle: "bold"
      })
      .setScrollFactor(0)
      .setDepth(52);

    this.scoreText = scene.add
      .text(248, 44, "Счёт: 0", {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "18px",
        color: "#ffd76c",
        fontStyle: "bold"
      })
      .setScrollFactor(0)
      .setDepth(52);

    this.waveText = scene.add
      .text(viewportWidth - 18, 18, "Волна: 1", {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "18px",
        color: "#6ef2ff",
        fontStyle: "bold"
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(52);

    this.powerUpText = scene.add
      .text(viewportWidth - 18, 44, "Бонусы: нет", {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "14px",
        color: "#9abed8"
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(52);

    this.sessionText = scene.add
      .text(viewportWidth - 18, 66, "Профиль: гость", {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "13px",
        color: "#8bcfff"
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(52);

    this.rankedText = scene.add
      .text(viewportWidth - 18, 84, "Результаты: только локально", {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "13px",
        color: "#9abed8"
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(52);

    this.bossBarBg = scene.add
      .rectangle(viewportCenterX, 104, 340, 16, 0x16253d, 1)
      .setScrollFactor(0)
      .setDepth(52)
      .setVisible(false);

    this.bossBarFill = scene.add
      .rectangle(viewportCenterX - 170, 104, 340, 16, UI_COLORS.danger, 1)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(53)
      .setVisible(false);

    this.bossBarText = scene.add
      .text(viewportCenterX, 80, "", {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "14px",
        color: "#ffdce2"
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(53)
      .setVisible(false);

    this.pauseOverlay = scene.add
      .rectangle(viewportCenterX, viewportCenterY, viewportWidth, viewportHeight, 0x000000, 0.45)
      .setScrollFactor(0)
      .setDepth(120)
      .setVisible(false);

    this.pausePanel = scene.add
      .rectangle(viewportCenterX, viewportCenterY, 420, 292, UI_COLORS.panel, 0.94)
      .setStrokeStyle(2, UI_COLORS.cyan, 0.28)
      .setScrollFactor(0)
      .setDepth(121)
      .setVisible(false);

    this.pauseText = scene.add
      .text(viewportCenterX, viewportCenterY - 86, "Пауза", {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "48px",
        color: "#eaf7ff",
        fontStyle: "bold"
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(122)
      .setVisible(false);

    this.pauseHintText = scene.add
      .text(viewportCenterX, viewportCenterY - 50, "Esc или P — продолжить", {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "16px",
        color: "#9abed8"
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(122)
      .setVisible(false);

    const pauseAudioHeader = scene.add
      .text(viewportCenterX, viewportCenterY - 14, "Звук", {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "20px",
        color: "#ffd76c",
        fontStyle: "bold"
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(122)
      .setVisible(false);

    const muteLabel = scene.add
      .text(viewportCenterX - 128, viewportCenterY + 24, "Общий звук", {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "18px",
        color: "#eaf7ff"
      })
      .setScrollFactor(0)
      .setDepth(122)
      .setVisible(false);

    const musicLabel = scene.add
      .text(viewportCenterX - 128, viewportCenterY + 64, "Музыка", {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "18px",
        color: "#eaf7ff"
      })
      .setScrollFactor(0)
      .setDepth(122)
      .setVisible(false);

    const sfxLabel = scene.add
      .text(viewportCenterX - 128, viewportCenterY + 104, "Эффекты", {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "18px",
        color: "#eaf7ff"
      })
      .setScrollFactor(0)
      .setDepth(122)
      .setVisible(false);

    this.pauseMuteValueText = scene.add
      .text(viewportCenterX + 18, viewportCenterY + 24, "Вкл", {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "18px",
        color: "#9abed8",
        fontStyle: "bold"
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(122)
      .setVisible(false);

    this.pauseMusicValueText = scene.add
      .text(viewportCenterX + 18, viewportCenterY + 64, "55%", {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "18px",
        color: "#9abed8",
        fontStyle: "bold"
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(122)
      .setVisible(false);

    this.pauseSfxValueText = scene.add
      .text(viewportCenterX + 18, viewportCenterY + 104, "80%", {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "18px",
        color: "#9abed8",
        fontStyle: "bold"
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(122)
      .setVisible(false);

    this.bannerText = scene.add
      .text(viewportCenterX, viewportHeight * 0.42, "", {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "34px",
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
      this.sessionText,
      this.rankedText,
      this.bossBarBg,
      this.bossBarFill,
      this.bossBarText,
      this.pauseOverlay,
      this.pausePanel,
      this.pauseText,
      this.pauseHintText,
      pauseAudioHeader,
      muteLabel,
      musicLabel,
      sfxLabel,
      this.pauseMuteValueText,
      this.pauseMusicValueText,
      this.pauseSfxValueText,
      this.bannerText
    );

    this.createPauseButton(viewportCenterX + 130, viewportCenterY + 39, 118, 30, "Переключить", () => {
      const settings = this.audioSystem.getSettings();
      this.audioSystem.unlock();
      this.audioSystem.setMasterMuted(!settings.masterMuted);
      this.audioSystem.playSfx(SFX_KEYS.UI_CLICK);
      this.refreshAudioSettings();
    });
    this.createPauseButton(viewportCenterX - 16, viewportCenterY + 79, 34, 30, "-", () => {
      const settings = this.audioSystem.getSettings();
      this.audioSystem.unlock();
      this.audioSystem.setMusicVolume(clamp(settings.musicVolume - 0.1, 0, 1));
      this.audioSystem.playSfx(SFX_KEYS.UI_CLICK);
      this.refreshAudioSettings();
    });
    this.createPauseButton(viewportCenterX + 54, viewportCenterY + 79, 34, 30, "+", () => {
      const settings = this.audioSystem.getSettings();
      this.audioSystem.unlock();
      this.audioSystem.setMusicVolume(clamp(settings.musicVolume + 0.1, 0, 1));
      this.audioSystem.playSfx(SFX_KEYS.UI_CLICK);
      this.refreshAudioSettings();
    });
    this.createPauseButton(viewportCenterX - 16, viewportCenterY + 119, 34, 30, "-", () => {
      const settings = this.audioSystem.getSettings();
      this.audioSystem.unlock();
      this.audioSystem.setSfxVolume(clamp(settings.sfxVolume - 0.1, 0, 1));
      this.audioSystem.playSfx(SFX_KEYS.UI_CLICK);
      this.refreshAudioSettings();
    });
    this.createPauseButton(viewportCenterX + 54, viewportCenterY + 119, 34, 30, "+", () => {
      const settings = this.audioSystem.getSettings();
      this.audioSystem.unlock();
      this.audioSystem.setSfxVolume(clamp(settings.sfxVolume + 0.1, 0, 1));
      this.audioSystem.playSfx(SFX_KEYS.UI_CLICK);
      this.refreshAudioSettings();
    });
    this.createPauseButton(viewportCenterX, viewportCenterY + 168, 186, 36, "Главное меню", () => {
      this.audioSystem.unlock();
      this.audioSystem.playSfx(SFX_KEYS.UI_CLICK);
      this.options.onPauseExitToMenu?.();
    });

    this.hudObjects.forEach((object) => {
      if (object instanceof Phaser.GameObjects.Text) {
        configureText(object);
      }
    });

    this.refreshAudioSettings();
    this.setPauseControlsInteractive(false);
  }

  public bindPlayer(player: Player): void {
    this.player = player;
  }

  public setSessionStatus(session: SessionPresentation): void {
    this.sessionText.setText(session.isGuest ? "Профиль: гость" : `Профиль: ${session.displayName}`);
    this.rankedText.setText(session.rankedEligible ? "Результаты: локально и онлайн" : "Результаты: только локально");
    this.rankedText.setColor(session.rankedEligible ? "#79f7c1" : "#9abed8");
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

    const text = effects.map((effect) => `${effect.label} ${(effect.remainingMs / 1000).toFixed(1)}с`).join(" • ");
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
    this.pausePanel.setVisible(visible);
    this.pauseText.setVisible(visible);
    this.pauseHintText.setVisible(visible);
    this.pauseMuteValueText.setVisible(visible);
    this.pauseMusicValueText.setVisible(visible);
    this.pauseSfxValueText.setVisible(visible);

    this.hudObjects.forEach((object) => {
      if (object === this.pauseOverlay || object === this.pausePanel || object === this.pauseText || object === this.pauseHintText) {
        return;
      }

      if (
        object === this.pauseMuteValueText ||
        object === this.pauseMusicValueText ||
        object === this.pauseSfxValueText ||
        (object instanceof Phaser.GameObjects.Text && object.depth === 122) ||
        (object instanceof Phaser.GameObjects.Rectangle && object.depth === 123)
      ) {
        if ("setVisible" in object && typeof object.setVisible === "function") {
          object.setVisible(visible);
        }
      }
    });

    this.setPauseControlsInteractive(visible);

    if (visible) {
      this.refreshAudioSettings();
    }
  }

  public destroy(): void {
    this.bannerTween?.stop();
    this.hudObjects.forEach((object) => object.destroy());
    this.hudObjects.length = 0;
    this.pauseButtons.length = 0;
    this.player = undefined;
  }

  private createPauseButton(
    centerX: number,
    centerY: number,
    width: number,
    height: number,
    label: string,
    onClick: () => void
  ): void {
    const background = this.scene.add
      .rectangle(centerX, centerY, width, height, 0x1a3850, 0.96)
      .setStrokeStyle(2, UI_COLORS.cyan, 0.32)
      .setScrollFactor(0)
      .setDepth(123)
      .setVisible(false);

    const text = this.scene.add
      .text(centerX, centerY, label, {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "16px",
        color: "#eaf7ff",
        fontStyle: "bold"
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(124)
      .setVisible(false);

    background.setInteractive({ useHandCursor: true });
    background.disableInteractive();
    background.on("pointerover", () => {
      background.setFillStyle(0x23506f, 1);
      this.audioSystem.playSfx(SFX_KEYS.UI_HOVER);
    });
    background.on("pointerout", () => {
      background.setFillStyle(0x1a3850, 0.96);
    });
    background.on("pointerdown", onClick);

    this.pauseButtons.push({ background, label: text });
    this.hudObjects.push(background, text);
  }

  private refreshAudioSettings(): void {
    const settings = this.audioSystem.getSettings();

    this.pauseMuteValueText.setText(settings.masterMuted ? "Выкл" : "Вкл");
    this.pauseMuteValueText.setColor(settings.masterMuted ? "#ff9eaa" : "#79f7c1");
    this.pauseMusicValueText.setText(`${Math.round(settings.musicVolume * 100)}%`);
    this.pauseSfxValueText.setText(`${Math.round(settings.sfxVolume * 100)}%`);
  }

  private setPauseControlsInteractive(visible: boolean): void {
    this.pauseButtons.forEach(({ background, label }) => {
      background.setVisible(visible);
      label.setVisible(visible);

      if (visible) {
        background.setInteractive({ useHandCursor: true });
      } else {
        background.disableInteractive();
      }
    });
  }
}
