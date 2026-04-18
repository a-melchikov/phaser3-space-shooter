import Phaser from "phaser";

import { Player } from "../entities/Player";
import type { ActivePowerUpState, SessionPresentation } from "../types/game";
import { POWER_UP_TEXTURES } from "../config/combat";
import { getViewportCenterX, getViewportCenterY, getViewportHeight, getViewportWidth } from "../utils/viewport";
import { AudioSystem } from "./AudioSystem";
import { AudioSettingsPanel } from "../ui/audioPanel";
import { UI_THEME, addUiText, colorToHex, fadeScaleIn } from "../ui/theme";
import { UiButton, UiMeter, createAmbientOrb, createGlassPanel, createScreenOverlay, type UiPanel } from "../ui/primitives";

interface UISystemOptions {
  onPauseResume?: () => void;
  onPauseExitToMenu?: () => void;
}

interface DestroyableComponent {
  destroy(): void;
}

interface PowerUpRow {
  icon: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
}

export class UISystem {
  private player?: Player;
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly components: DestroyableComponent[] = [];
  private readonly leftPanel: UiPanel;
  private readonly rightPanel: UiPanel;
  private readonly powerUpPanel: UiPanel;
  private readonly bossPanel: UiPanel;
  private readonly pausePanel: UiPanel;
  private readonly healthMeter: UiMeter;
  private readonly livesIcons: Phaser.GameObjects.Text[] = [];
  private readonly scoreValueText: Phaser.GameObjects.Text;
  private readonly waveValueText: Phaser.GameObjects.Text;
  private readonly statusValueText: Phaser.GameObjects.Text;
  private readonly profileValueText: Phaser.GameObjects.Text;
  private readonly powerUpEmptyText: Phaser.GameObjects.Text;
  private readonly powerUpRows: PowerUpRow[] = [];
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
  private bannerTween?: Phaser.Tweens.Tween;
  private score = 0;
  private wave = 1;
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

    const panelTop = 84;
    const sidePanelWidth = 256;
    const sidePanelPadding = 22;
    const leftPanelX = 148;
    const rightPanelX = viewportWidth - 148;

    this.leftPanel = this.trackComponent(
      createGlassPanel(scene, {
        x: leftPanelX,
        y: panelTop,
        width: sidePanelWidth,
        height: 124,
        padding: sidePanelPadding,
        depth: UI_THEME.depth.hud,
        fillColor: UI_THEME.colors.panelStrong,
        fillAlpha: 0.78,
        showTopAccent: false
      })
    );
    this.healthMeter = this.trackComponent(
      new UiMeter(scene, {
        x: 0,
        y: 0,
        width: 212,
        label: "Здоровье",
        valueText: "100 / 100",
        color: UI_THEME.colors.success,
        depth: UI_THEME.depth.hud + 2
      })
    );
    this.leftPanel.content.add(this.healthMeter.root);

    this.leftPanel.content.add(
      addUiText(scene, 0, 64, "Жизни", "meta", {
        color: colorToHex(UI_THEME.colors.textSoft)
      }).setOrigin(0, 0)
    );
    this.createLivesIcons();

    this.leftPanel.content.add(
      addUiText(scene, 118, 64, "Счёт", "meta", {
        color: colorToHex(UI_THEME.colors.textSoft)
      }).setOrigin(0, 0)
    );
    this.scoreValueText = addUiText(scene, 118, 76, "0", "metric", {
      fontSize: "20px",
      color: colorToHex(UI_THEME.colors.warning)
    }).setOrigin(0, 0);
    this.leftPanel.content.add(this.scoreValueText);

    this.rightPanel = this.trackComponent(
      createGlassPanel(scene, {
        x: rightPanelX,
        y: panelTop,
        width: sidePanelWidth,
        height: 164,
        padding: sidePanelPadding,
        depth: UI_THEME.depth.hud,
        fillColor: UI_THEME.colors.panelStrong,
        fillAlpha: 0.78,
        glowColor: UI_THEME.colors.violet,
        borderColor: UI_THEME.colors.lineSoft,
        showTopAccent: false
      })
    );
    this.rightPanel.content.add(addUiText(scene, 0, 0, "Текущая волна", "label").setOrigin(0, 0));
    this.waveValueText = addUiText(scene, 0, 22, "1", "metric", {
      fontSize: "28px"
    }).setOrigin(0, 0);
    this.rightPanel.content.add(this.waveValueText);

    this.rightPanel.content.add(addUiText(scene, 0, 66, "Статус", "meta", {
      color: colorToHex(UI_THEME.colors.textSoft)
    }).setOrigin(0, 0));
    this.statusValueText = addUiText(scene, 190, 66, "local only", "bodySoft", {
      color: colorToHex(UI_THEME.colors.success),
      align: "right"
    }).setOrigin(1, 0);
    this.rightPanel.content.add(this.statusValueText);

    this.rightPanel.content.add(addUiText(scene, 0, 94, "Профиль", "meta", {
      color: colorToHex(UI_THEME.colors.textSoft)
    }).setOrigin(0, 0));
    this.profileValueText = addUiText(scene, 0, 114, "Гость", "bodySoft", {
      color: colorToHex(UI_THEME.colors.text),
      wordWrap: { width: 190, useAdvancedWrap: true },
      maxLines: 2
    }).setOrigin(0, 0);
    this.rightPanel.content.add(this.profileValueText);

    this.powerUpPanel = this.trackComponent(
      createGlassPanel(scene, {
        x: rightPanelX,
        y: viewportHeight - 88,
        width: sidePanelWidth,
        height: 136,
        padding: sidePanelPadding,
        depth: UI_THEME.depth.hud,
        fillColor: UI_THEME.colors.panelStrong,
        fillAlpha: 0.74,
        glowColor: UI_THEME.colors.cyan,
        borderColor: UI_THEME.colors.line,
        showTopAccent: false
      })
    );
    this.powerUpPanel.content.add(addUiText(scene, 0, 0, "Бонусы", "meta", {
      color: colorToHex(UI_THEME.colors.textMuted)
    }).setOrigin(0, 0));
    this.powerUpEmptyText = this.trackObject(
      addUiText(scene, 0, 30, "нет активных модулей", "meta", {
        color: colorToHex(UI_THEME.colors.textSoft)
      }).setOrigin(0, 0)
    );
    this.powerUpPanel.content.add(this.powerUpEmptyText);
    this.createPowerUpRows();

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

    this.bannerText = this.trackObject(
      addUiText(scene, viewportCenterX, viewportHeight * 0.18, "", "sectionTitle", {
        fontSize: "34px",
        fontStyle: "700",
        color: colorToHex(UI_THEME.colors.text),
        stroke: colorToHex(UI_THEME.colors.ink),
        strokeThickness: 6
      })
        .setOrigin(0.5)
        .setDepth(UI_THEME.depth.banner)
        .setAlpha(0)
    );

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
        height: 292,
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
        y: -6,
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
        y: 55,
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
        y: 109,
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
    this.updateLivesIcons(this.player.lives);
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
    this.powerUpEmptyText.setVisible(effects.length === 0);

    this.powerUpRows.forEach((row, index) => {
      const effect = effects[index];
      const visible = Boolean(effect);

      row.icon.setVisible(visible);
      row.label.setVisible(visible);

      if (!effect) {
        return;
      }

      row.icon.setTexture(POWER_UP_TEXTURES[effect.type]);
      row.label.setText(`${effect.label} • ${Math.max(1, Math.ceil(effect.remainingMs / 1000))}с`);
    });
  }

  public showBanner(text: string): void {
    this.bannerTween?.stop();
    this.scene.tweens.killTweensOf(this.bannerText);

    this.bannerText.setText(text);
    this.bannerText.setAlpha(0).setScale(0.92);

    this.bannerTween = this.scene.tweens.add({
      targets: this.bannerText,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: UI_THEME.motion.normal,
      ease: "Quad.easeOut",
      hold: 1150,
      yoyo: true,
      onComplete: () => {
        this.bannerText.setAlpha(0);
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
    this.player = undefined;
  }

  private createLivesIcons(): void {
    for (let index = 0; index < 3; index += 1) {
      const icon = this.trackObject(
        addUiText(this.scene, index * 18, 74, "♥", "body", {
          fontFamily: UI_THEME.fonts.display,
          fontSize: "24px",
          color: colorToHex(UI_THEME.colors.danger)
        }).setOrigin(0, 0)
      );
      this.leftPanel.content.add(icon);
      this.livesIcons.push(icon);
    }

    this.updateLivesIcons(3);
  }

  private updateLivesIcons(lives: number): void {
    this.livesIcons.forEach((icon, index) => {
      const active = index < lives;
      icon.setAlpha(active ? 1 : 0.24);
      icon.setColor(colorToHex(active ? UI_THEME.colors.danger : UI_THEME.colors.textMuted));
    });
  }

  private createPowerUpRows(): void {
    for (let index = 0; index < 4; index += 1) {
      const y = 28 + index * 22;
      const icon = this.trackObject(
        this.scene.add.image(8, y + 6, POWER_UP_TEXTURES.heal)
          .setScale(0.55)
          .setVisible(false)
      );
      const label = this.trackObject(
        addUiText(this.scene, 24, y - 2, "", "meta", {
          color: colorToHex(UI_THEME.colors.cyan)
        }).setOrigin(0, 0).setVisible(false)
      );
      this.powerUpPanel.content.add([icon, label]);
      this.powerUpRows.push({ icon, label });
    }
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
