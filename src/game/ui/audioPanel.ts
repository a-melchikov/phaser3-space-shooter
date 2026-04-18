import Phaser from "phaser";

import { AudioSystem } from "../systems/AudioSystem";
import { clamp } from "../utils/helpers";
import { UI_THEME, addUiText, colorToHex } from "./theme";
import { UiButton, UiPanel, createGlassPanel } from "./primitives";

export class AudioSettingsPanel {
  public readonly root: Phaser.GameObjects.Container;
  private readonly panel: UiPanel;
  private readonly muteButton: UiButton;
  private readonly musicDownButton: UiButton;
  private readonly musicUpButton: UiButton;
  private readonly sfxDownButton: UiButton;
  private readonly sfxUpButton: UiButton;
  private readonly musicValueText: Phaser.GameObjects.Text;
  private readonly sfxValueText: Phaser.GameObjects.Text;

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly audioSystem: AudioSystem,
    options: {
      x: number;
      y: number;
      width: number;
      title: string;
      subtitle?: string;
      depth?: number;
    }
  ) {
    const height = options.subtitle ? 240 : 212;
    const muteButtonWidth = 154;
    this.panel = createGlassPanel(scene, {
      x: options.x,
      y: options.y,
      width: options.width,
      height,
      depth: options.depth ?? 0,
      fillColor: UI_THEME.colors.panelStrong,
      fillAlpha: 0.92,
      glowColor: UI_THEME.colors.violet,
      padding: 24
    });
    this.root = this.panel.root;

    const contentWidth = options.width - 48;
    let cursorY = 0;

    const title = addUiText(scene, 0, cursorY, options.title, "sectionTitle", {
      fontSize: "20px",
      color: colorToHex(UI_THEME.colors.text)
    }).setOrigin(0, 0);
    this.panel.content.add(title);
    cursorY += 40;

    if (options.subtitle) {
      const subtitle = addUiText(scene, 0, cursorY, options.subtitle, "meta", {
        wordWrap: { width: contentWidth }
      }).setOrigin(0, 0);
      this.panel.content.add(subtitle);
      cursorY += 36;
    }

    const muteLabel = addUiText(scene, 0, cursorY + 8, "Общий звук", "meta", {
      color: colorToHex(UI_THEME.colors.textSoft)
    }).setOrigin(0, 0.5);
    this.panel.content.add(muteLabel);

    this.muteButton = new UiButton(scene, {
      x: -options.width * 0.5 + 24 + contentWidth - 82,
      y: -height * 0.5 + 24 + cursorY + 8,
      width: muteButtonWidth,
      height: 34,
      label: "Вкл",
      variant: "secondary",
      depth: (options.depth ?? 0) + 2,
      audioSystem,
      onClick: () => {
        const settings = this.audioSystem.getSettings();
        this.audioSystem.unlock();
        this.audioSystem.setMasterMuted(!settings.masterMuted);
        this.refresh();
      }
    });
    this.panel.root.add(this.muteButton.root);
    cursorY += 52;

    const musicLabel = addUiText(scene, 0, cursorY + 8, "Музыка", "meta", {
      color: colorToHex(UI_THEME.colors.textSoft)
    }).setOrigin(0, 0.5);
    this.panel.content.add(musicLabel);

    this.musicDownButton = new UiButton(scene, {
      x: -options.width * 0.5 + 24 + contentWidth - 142,
      y: -height * 0.5 + 24 + cursorY + 8,
      width: 34,
      height: 34,
      label: "-",
      variant: "ghost",
      depth: (options.depth ?? 0) + 2,
      audioSystem,
      onClick: () => {
        const settings = this.audioSystem.getSettings();
        this.audioSystem.unlock();
        this.audioSystem.setMusicVolume(clamp(settings.musicVolume - 0.1, 0, 1));
        this.refresh();
      }
    });
    this.panel.root.add(this.musicDownButton.root);

    this.musicValueText = addUiText(scene, contentWidth - 82, cursorY + 8, "", "bodySoft", {
      color: colorToHex(UI_THEME.colors.text)
    }).setOrigin(0.5);
    this.panel.content.add(this.musicValueText);

    this.musicUpButton = new UiButton(scene, {
      x: -options.width * 0.5 + 24 + contentWidth - 22,
      y: -height * 0.5 + 24 + cursorY + 8,
      width: 34,
      height: 34,
      label: "+",
      variant: "ghost",
      depth: (options.depth ?? 0) + 2,
      audioSystem,
      onClick: () => {
        const settings = this.audioSystem.getSettings();
        this.audioSystem.unlock();
        this.audioSystem.setMusicVolume(clamp(settings.musicVolume + 0.1, 0, 1));
        this.refresh();
      }
    });
    this.panel.root.add(this.musicUpButton.root);
    cursorY += 48;

    const sfxLabel = addUiText(scene, 0, cursorY + 8, "Эффекты", "meta", {
      color: colorToHex(UI_THEME.colors.textSoft)
    }).setOrigin(0, 0.5);
    this.panel.content.add(sfxLabel);

    this.sfxDownButton = new UiButton(scene, {
      x: -options.width * 0.5 + 24 + contentWidth - 142,
      y: -height * 0.5 + 24 + cursorY + 8,
      width: 34,
      height: 34,
      label: "-",
      variant: "ghost",
      depth: (options.depth ?? 0) + 2,
      audioSystem,
      onClick: () => {
        const settings = this.audioSystem.getSettings();
        this.audioSystem.unlock();
        this.audioSystem.setSfxVolume(clamp(settings.sfxVolume - 0.1, 0, 1));
        this.refresh();
      }
    });
    this.panel.root.add(this.sfxDownButton.root);

    this.sfxValueText = addUiText(scene, contentWidth - 82, cursorY + 8, "", "bodySoft", {
      color: colorToHex(UI_THEME.colors.text)
    }).setOrigin(0.5);
    this.panel.content.add(this.sfxValueText);

    this.sfxUpButton = new UiButton(scene, {
      x: -options.width * 0.5 + 24 + contentWidth - 22,
      y: -height * 0.5 + 24 + cursorY + 8,
      width: 34,
      height: 34,
      label: "+",
      variant: "ghost",
      depth: (options.depth ?? 0) + 2,
      audioSystem,
      onClick: () => {
        const settings = this.audioSystem.getSettings();
        this.audioSystem.unlock();
        this.audioSystem.setSfxVolume(clamp(settings.sfxVolume + 0.1, 0, 1));
        this.refresh();
      }
    });
    this.panel.root.add(this.sfxUpButton.root);

    this.refresh();
  }

  public setVisible(value: boolean): void {
    this.root.setVisible(value);
    this.muteButton.setVisible(value);
    this.musicDownButton.setVisible(value);
    this.musicUpButton.setVisible(value);
    this.sfxDownButton.setVisible(value);
    this.sfxUpButton.setVisible(value);
  }

  public setPosition(x: number, y: number): void {
    this.root.setPosition(x, y);
  }

  public refresh(): void {
    const settings = this.audioSystem.getSettings();
    this.muteButton.setVariant(settings.masterMuted ? "danger" : "success");
    this.muteButton.setLabel(settings.masterMuted ? "Выкл" : "Вкл");
    this.musicValueText.setText(`${Math.round(settings.musicVolume * 100)}%`);
    this.sfxValueText.setText(`${Math.round(settings.sfxVolume * 100)}%`);
  }

  public destroy(): void {
    this.muteButton.destroy();
    this.musicDownButton.destroy();
    this.musicUpButton.destroy();
    this.sfxDownButton.destroy();
    this.sfxUpButton.destroy();
    this.panel.destroy();
  }
}
