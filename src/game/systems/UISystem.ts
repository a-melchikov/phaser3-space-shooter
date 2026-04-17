import Phaser from "phaser";

import { Player } from "../entities/Player";
import type { ActivePowerUpState, SessionPresentation } from "../types/game";
import { getViewportCenterX, getViewportCenterY, getViewportHeight, getViewportWidth } from "../utils/viewport";
import { AudioSystem } from "./AudioSystem";
import { AudioSettingsPanel } from "../ui/audioPanel";
import { UI_THEME, addUiText, colorToHex, fadeScaleIn } from "../ui/theme";
import { UiButton, UiMeter, createAmbientOrb, createChip, createGlassPanel, createScreenOverlay, type UiPanel } from "../ui/primitives";

interface UISystemOptions {
  onPauseResume?: () => void;
  onPauseExitToMenu?: () => void;
}

interface DestroyableComponent {
  destroy(): void;
}

export class UISystem {
  private player?: Player;
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly components: DestroyableComponent[] = [];
  private readonly leftPanel: UiPanel;
  private readonly rightPanel: UiPanel;
  private readonly bossPanel: UiPanel;
  private readonly bannerPanel: UiPanel;
  private readonly pausePanel: UiPanel;
  private readonly healthMeter: UiMeter;
  private readonly livesValueText: Phaser.GameObjects.Text;
  private readonly scoreValueText: Phaser.GameObjects.Text;
  private readonly waveValueText: Phaser.GameObjects.Text;
  private readonly statusValueText: Phaser.GameObjects.Text;
  private readonly profileValueText: Phaser.GameObjects.Text;
  private readonly bossBarFill: Phaser.GameObjects.Rectangle;
  private readonly bossValueText: Phaser.GameObjects.Text;
  private readonly bannerText: Phaser.GameObjects.Text;
  private readonly pauseOverlay: Phaser.GameObjects.Rectangle;
  private readonly pauseGlowPrimary: Phaser.GameObjects.Ellipse;
  private readonly pauseGlowSecondary: Phaser.GameObjects.Ellipse;
  private readonly pauseHintText: Phaser.GameObjects.Text;
  private readonly pauseSettingsPanel: AudioSettingsPanel;
  private readonly pauseContinueButton: UiButton;
  private readonly pauseSettingsButton: UiButton;
  private readonly pauseExitButton: UiButton;
  private readonly powerUpLabelText: Phaser.GameObjects.Text;
  private readonly powerUpContainer: Phaser.GameObjects.Container;
  private readonly powerUpChips: Phaser.GameObjects.GameObject[] = [];
  private bannerTween?: Phaser.Tweens.Tween;
  private score = 0;
  private wave = 1;
  private powerUpSignature = "";
  private sessionStatus: SessionPresentation = {
    mode: "guest",
    displayName: "Гость",
    rankedEligible: false,
    isGuest: true
  };
  private pauseVisible = false;
  private pauseSettingsVisible = false;

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly audioSystem: AudioSystem,
    private readonly options: UISystemOptions = {}
  ) {
    const viewportWidth = getViewportWidth(scene);
    const viewportHeight = getViewportHeight(scene);
    const viewportCenterX = getViewportCenterX(scene);
    const viewportCenterY = getViewportCenterY(scene);

    this.leftPanel = this.trackComponent(
      createGlassPanel(scene, {
        x: 138,
        y: 76,
        width: 240,
        height: 106,
        depth: UI_THEME.depth.hud,
        fillColor: UI_THEME.colors.panelStrong,
        fillAlpha: 0.76
      })
    );
    this.healthMeter = this.trackComponent(
      new UiMeter(scene, {
        x: 0,
        y: 0,
        width: 192,
        label: "Здоровье",
        valueText: "100 / 100",
        color: UI_THEME.colors.success,
        depth: UI_THEME.depth.hud + 2
      })
    );
    this.leftPanel.content.add(this.healthMeter.root);

    this.leftPanel.content.add(
      addUiText(scene, 0, 56, "Жизни", "meta", {
        color: colorToHex(UI_THEME.colors.textSoft)
      }).setOrigin(0, 0)
    );
    this.livesValueText = addUiText(scene, 0, 74, "3", "metric", {
      fontSize: "20px"
    }).setOrigin(0, 0);
    this.leftPanel.content.add(this.livesValueText);

    this.leftPanel.content.add(
      addUiText(scene, 108, 56, "Счёт", "meta", {
        color: colorToHex(UI_THEME.colors.textSoft)
      }).setOrigin(0, 0)
    );
    this.scoreValueText = addUiText(scene, 108, 74, "0", "metric", {
      fontSize: "20px",
      color: colorToHex(UI_THEME.colors.warning)
    }).setOrigin(0, 0);
    this.leftPanel.content.add(this.scoreValueText);

    this.rightPanel = this.trackComponent(
      createGlassPanel(scene, {
        x: viewportWidth - 138,
        y: 88,
        width: 244,
        height: 138,
        depth: UI_THEME.depth.hud,
        fillColor: UI_THEME.colors.panelStrong,
        fillAlpha: 0.76,
        glowColor: UI_THEME.colors.violet,
        borderColor: UI_THEME.colors.lineSoft
      })
    );
    this.rightPanel.content.add(addUiText(scene, 0, 0, "Текущая волна", "label").setOrigin(0, 0));
    this.waveValueText = addUiText(scene, 0, 22, "1", "metric", {
      fontSize: "28px"
    }).setOrigin(0, 0);
    this.rightPanel.content.add(this.waveValueText);

    this.rightPanel.content.add(addUiText(scene, 0, 62, "Статус", "meta", {
      color: colorToHex(UI_THEME.colors.textSoft)
    }).setOrigin(0, 0));
    this.statusValueText = addUiText(scene, 160, 62, "local only", "bodySoft", {
      color: colorToHex(UI_THEME.colors.success),
      align: "right"
    }).setOrigin(1, 0);
    this.rightPanel.content.add(this.statusValueText);

    this.rightPanel.content.add(addUiText(scene, 0, 86, "Профиль", "meta", {
      color: colorToHex(UI_THEME.colors.textSoft)
    }).setOrigin(0, 0));
    this.profileValueText = addUiText(scene, 160, 86, "Гость", "bodySoft", {
      align: "right"
    }).setOrigin(1, 0);
    this.rightPanel.content.add(this.profileValueText);

    this.powerUpLabelText = this.trackObject(
      addUiText(scene, viewportWidth - 18, 148, "Бонусы", "meta", {
        color: colorToHex(UI_THEME.colors.textMuted)
      })
        .setOrigin(1, 0)
        .setDepth(UI_THEME.depth.hud + 1)
    );
    this.powerUpContainer = this.trackObject(
      scene.add.container(viewportWidth - 18, 172).setDepth(UI_THEME.depth.hud + 2)
    );

    this.bossPanel = this.trackComponent(
      createGlassPanel(scene, {
        x: viewportCenterX,
        y: 42,
        width: Math.min(380, viewportWidth - 80),
        height: 52,
        depth: UI_THEME.depth.hud + 2,
        fillColor: UI_THEME.colors.panel,
        fillAlpha: 0.72,
        glowColor: UI_THEME.colors.danger,
        borderColor: UI_THEME.colors.danger
      })
    );
    const bossTrack = scene.add.graphics();
    bossTrack.fillStyle(UI_THEME.colors.surface, 0.92);
    bossTrack.fillRoundedRect(0, 18, Math.min(312, viewportWidth - 148), 10, 10);
    bossTrack.lineStyle(1, UI_THEME.colors.danger, 0.16);
    bossTrack.strokeRoundedRect(0, 18, Math.min(312, viewportWidth - 148), 10, 10);
    this.bossPanel.content.add(bossTrack);

    this.bossValueText = addUiText(scene, 0, 0, "", "meta", {
      color: colorToHex(UI_THEME.colors.danger)
    }).setOrigin(0, 0);
    this.bossPanel.content.add(this.bossValueText);

    this.bossBarFill = scene.add
      .rectangle(0, 23, Math.min(312, viewportWidth - 148), 6, UI_THEME.colors.danger, 1)
      .setOrigin(0, 0.5);
    this.bossPanel.content.add(this.bossBarFill);
    this.bossPanel.root.setVisible(false);

    this.bannerPanel = this.trackComponent(
      createGlassPanel(scene, {
        x: viewportCenterX,
        y: viewportHeight * 0.24,
        width: Math.min(320, viewportWidth - 80),
        height: 62,
        depth: UI_THEME.depth.banner,
        fillColor: UI_THEME.colors.panelStrong,
        fillAlpha: 0.9,
        glowColor: UI_THEME.colors.cyan
      })
    );
    this.bannerText = addUiText(scene, 0, 7, "", "sectionTitle", {
      fontSize: "20px",
      align: "center",
      color: colorToHex(UI_THEME.colors.text)
    }).setOrigin(0, 0);
    this.bannerPanel.content.add(this.bannerText);
    this.bannerPanel.root.setVisible(false);

    this.pauseOverlay = this.trackObject(createScreenOverlay(scene, UI_THEME.colors.shadow, 0.76, UI_THEME.depth.overlay));
    this.pauseOverlay.setVisible(false);

    this.pauseGlowPrimary = this.trackObject(
      createAmbientOrb(scene, viewportCenterX, viewportCenterY, 360, 220, UI_THEME.colors.violet, 0.12, UI_THEME.depth.overlay + 1)
    );
    this.pauseGlowPrimary.setVisible(false);
    this.pauseGlowSecondary = this.trackObject(
      createAmbientOrb(scene, viewportCenterX, viewportCenterY + 34, 460, 260, UI_THEME.colors.cyan, 0.08, UI_THEME.depth.overlay + 1)
    );
    this.pauseGlowSecondary.setVisible(false);

    this.pausePanel = this.trackComponent(
      createGlassPanel(scene, {
        x: viewportCenterX,
        y: viewportCenterY - 12,
        width: Math.min(420, viewportWidth - 48),
        height: 248,
        depth: UI_THEME.depth.overlayContent,
        fillColor: UI_THEME.colors.panelStrong,
        fillAlpha: 0.94,
        glowColor: UI_THEME.colors.violet,
        borderColor: UI_THEME.colors.lineSoft
      })
    );
    this.pausePanel.root.setVisible(false);
    this.pausePanel.content.add(addUiText(scene, 0, 0, "Пауза", "heroTitle", {
      fontSize: "38px"
    }).setOrigin(0, 0));
    this.pauseHintText = addUiText(scene, 0, 44, "Esc или P — продолжить матч", "meta", {
      color: colorToHex(UI_THEME.colors.textSoft)
    }).setOrigin(0, 0);
    this.pausePanel.content.add(this.pauseHintText);

    this.pauseContinueButton = this.trackComponent(
      new UiButton(scene, {
        x: 0,
        y: 108,
        width: Math.min(300, viewportWidth - 120),
        height: 46,
        label: "Продолжить",
        variant: "primary",
        depth: UI_THEME.depth.overlayContent + 2,
        audioSystem,
        onClick: () => this.options.onPauseResume?.()
      })
    );
    this.pauseContinueButton.setVisible(false);
    this.pausePanel.root.add(this.pauseContinueButton.root);

    this.pauseSettingsButton = this.trackComponent(
      new UiButton(scene, {
        x: 0,
        y: 162,
        width: Math.min(300, viewportWidth - 120),
        height: 40,
        label: "Настройки",
        variant: "secondary",
        depth: UI_THEME.depth.overlayContent + 2,
        audioSystem,
        onClick: () => this.togglePauseSettings()
      })
    );
    this.pauseSettingsButton.setVisible(false);
    this.pausePanel.root.add(this.pauseSettingsButton.root);

    this.pauseExitButton = this.trackComponent(
      new UiButton(scene, {
        x: 0,
        y: 210,
        width: Math.min(300, viewportWidth - 120),
        height: 38,
        label: "Выйти в меню",
        variant: "ghost",
        depth: UI_THEME.depth.overlayContent + 2,
        audioSystem,
        onClick: () => this.options.onPauseExitToMenu?.()
      })
    );
    this.pauseExitButton.setVisible(false);
    this.pausePanel.root.add(this.pauseExitButton.root);

    this.pauseSettingsPanel = this.trackComponent(
      new AudioSettingsPanel(scene, audioSystem, {
        x: viewportCenterX,
        y: viewportCenterY + 184,
        width: Math.min(360, viewportWidth - 56),
        title: "Параметры звука",
        subtitle: "Изменения применяются сразу.",
        depth: UI_THEME.depth.overlayContent + 1
      })
    );
    this.pauseSettingsPanel.setVisible(false);
  }

  public bindPlayer(player: Player): void {
    this.player = player;
  }

  public setSessionStatus(session: SessionPresentation): void {
    this.sessionStatus = session;
    this.profileValueText.setText(session.isGuest ? "Гость" : session.displayName);
    this.statusValueText.setText(session.rankedEligible ? "online ready" : "local only");
    this.statusValueText.setColor(colorToHex(session.rankedEligible ? UI_THEME.colors.success : UI_THEME.colors.textSoft));
  }

  public refresh(time: number): void {
    if (!this.player) {
      return;
    }

    const ratio = Phaser.Math.Clamp(this.player.health / this.player.maxHealth, 0, 1);
    const color =
      ratio > 0.55 ? UI_THEME.colors.success : ratio > 0.25 ? UI_THEME.colors.warning : UI_THEME.colors.danger;
    this.healthMeter.setValue(ratio, `${Math.ceil(this.player.health)} / ${this.player.maxHealth}`, color);
    this.livesValueText.setText(String(this.player.lives));
    this.setPowerUps(this.player.getActivePowerUps(time));
  }

  public setScore(score: number): void {
    this.score = score;
    this.scoreValueText.setText(String(score));
  }

  public setWave(wave: number): void {
    this.wave = wave;
    this.waveValueText.setText(String(wave));
  }

  public setBossHealth(current: number, max: number): void {
    const visible = max > 0 && current > 0;
    this.bossPanel.root.setVisible(visible);

    if (!visible) {
      return;
    }

    const ratio = Phaser.Math.Clamp(current / max, 0, 1);
    this.bossBarFill.displayWidth = this.bossBarFill.width * ratio;
    this.bossValueText.setText(`Босс • ${Math.ceil(current)} / ${max}`);
  }

  public setPowerUps(effects: ActivePowerUpState[]): void {
    const nextSignature = effects.map((effect) => effect.label).join("|");
    if (nextSignature === this.powerUpSignature) {
      return;
    }

    this.powerUpSignature = nextSignature;
    while (this.powerUpChips.length > 0) {
      this.powerUpChips.pop()?.destroy();
    }
    this.powerUpContainer.removeAll(true);

    if (effects.length === 0) {
      const emptyChip = createChip(this.scene, 0, 0, "нет активных модулей", {
        width: 170,
        color: UI_THEME.colors.textMuted,
        fillColor: UI_THEME.colors.surface,
        fillAlpha: 0.46,
        depth: UI_THEME.depth.hud + 2
      });
      emptyChip.setPosition(-85, 0);
      this.powerUpContainer.add(emptyChip);
      this.powerUpChips.push(emptyChip);
      return;
    }

    let offsetX = 0;
    effects.forEach((effect, index) => {
      const chip = createChip(this.scene, offsetX, 0, effect.label, {
        width: Math.max(122, 34 + effect.label.length * 8),
        color: index % 2 === 0 ? UI_THEME.colors.cyan : UI_THEME.colors.violet,
        fillColor: UI_THEME.colors.surface,
        fillAlpha: 0.72,
        depth: UI_THEME.depth.hud + 2
      });
      chip.setPosition(offsetX - chip.width * 0.5, 0);
      offsetX -= chip.width + 10;
      this.powerUpContainer.add(chip);
      this.powerUpChips.push(chip);
    });
  }

  public showBanner(text: string): void {
    this.bannerTween?.stop();
    this.bannerText.setText(text);
    this.bannerPanel.root.setVisible(true);
    this.bannerPanel.root.setAlpha(0);
    this.bannerPanel.root.setScale(0.96);

    this.bannerTween = this.scene.tweens.add({
      targets: this.bannerPanel.root,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: UI_THEME.motion.normal,
      ease: "Quad.easeOut",
      hold: 1150,
      yoyo: true,
      onComplete: () => {
        this.bannerPanel.root.setVisible(false);
      }
    });
  }

  public showPauseOverlay(visible: boolean): void {
    this.pauseVisible = visible;

    if (!visible) {
      this.pauseSettingsVisible = false;
      this.pauseSettingsButton.setLabel("Настройки");
      this.pauseOverlay.setVisible(false);
      this.pauseGlowPrimary.setVisible(false);
      this.pauseGlowSecondary.setVisible(false);
      this.pausePanel.root.setVisible(false);
      this.pauseContinueButton.setVisible(false);
      this.pauseSettingsButton.setVisible(false);
      this.pauseExitButton.setVisible(false);
      this.pauseSettingsPanel.setVisible(false);
      return;
    }

    this.pauseSettingsPanel.refresh();
    this.pauseOverlay.setVisible(true).setAlpha(0);
    this.pauseGlowPrimary.setVisible(true).setAlpha(0);
    this.pauseGlowSecondary.setVisible(true).setAlpha(0);
    this.pausePanel.root.setVisible(true).setAlpha(0).setScale(0.96);
    this.pauseContinueButton.setVisible(true);
    this.pauseSettingsButton.setVisible(true);
    this.pauseExitButton.setVisible(true);
    this.pauseSettingsPanel.setVisible(this.pauseSettingsVisible);

    this.scene.tweens.add({
      targets: this.pauseOverlay,
      alpha: 0.76,
      duration: UI_THEME.motion.normal,
      ease: "Quad.easeOut"
    });
    this.scene.tweens.add({
      targets: [this.pauseGlowPrimary, this.pauseGlowSecondary],
      alpha: { from: 0, to: 1 },
      duration: UI_THEME.motion.normal,
      ease: "Quad.easeOut"
    });
    fadeScaleIn(this.scene, this.pausePanel.root, {
      duration: UI_THEME.motion.normal,
      scaleFrom: 0.96,
      yOffset: 10
    });
    fadeScaleIn(this.scene, this.pauseContinueButton.root, {
      delay: 24,
      duration: UI_THEME.motion.normal,
      scaleFrom: 0.98,
      yOffset: 8
    });
    fadeScaleIn(this.scene, this.pauseSettingsButton.root, {
      delay: 48,
      duration: UI_THEME.motion.normal,
      scaleFrom: 0.99,
      yOffset: 8
    });
    fadeScaleIn(this.scene, this.pauseExitButton.root, {
      delay: 72,
      duration: UI_THEME.motion.normal,
      scaleFrom: 0.99,
      yOffset: 8
    });

    if (this.pauseSettingsVisible) {
      fadeScaleIn(this.scene, this.pauseSettingsPanel.root, {
        delay: 90,
        duration: UI_THEME.motion.normal,
        scaleFrom: 0.97,
        yOffset: 8
      });
    }
  }

  public destroy(): void {
    this.bannerTween?.stop();
    while (this.components.length > 0) {
      this.components.pop()?.destroy();
    }
    while (this.objects.length > 0) {
      this.objects.pop()?.destroy();
    }
    this.powerUpChips.length = 0;
    this.player = undefined;
  }

  private togglePauseSettings(): void {
    this.pauseSettingsVisible = !this.pauseSettingsVisible;
    this.pauseSettingsButton.setLabel(this.pauseSettingsVisible ? "Скрыть настройки" : "Настройки");
    this.pauseSettingsPanel.setVisible(this.pauseSettingsVisible);

    if (this.pauseSettingsVisible) {
      this.pauseSettingsPanel.refresh();
      this.pauseSettingsPanel.root.setAlpha(0);
      this.pauseSettingsPanel.root.setScale(0.97);
      fadeScaleIn(this.scene, this.pauseSettingsPanel.root, {
        duration: UI_THEME.motion.normal,
        scaleFrom: 0.97,
        yOffset: 8
      });
    }
  }

  private trackObject<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.objects.push(object);
    return object;
  }

  private trackComponent<T extends DestroyableComponent>(component: T): T {
    this.components.push(component);
    return component;
  }
}
