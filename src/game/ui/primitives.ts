import Phaser from "phaser";

import { AudioSystem } from "../systems/AudioSystem";
import { SFX_KEYS } from "../utils/audioKeys";
import { configureText } from "../utils/helpers";
import { getViewportCenterX, getViewportCenterY, getViewportHeight, getViewportWidth } from "../utils/viewport";
import { UI_THEME, addUiText, colorToHex } from "./theme";

export interface UiPanel {
  root: Phaser.GameObjects.Container;
  content: Phaser.GameObjects.Container;
  destroy(): void;
}

export interface GlassPanelOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  depth?: number;
  radius?: number;
  padding?: number;
  glowColor?: number;
  fillColor?: number;
  fillAlpha?: number;
  borderColor?: number;
  borderAlpha?: number;
  glowLayers?: number;
  glowStrength?: number;
  showTopAccent?: boolean;
  highlightAlpha?: number;
}

export function createGlassPanel(scene: Phaser.Scene, options: GlassPanelOptions): UiPanel {
  const root = scene.add.container(options.x, options.y).setDepth(options.depth ?? 0);
  const glow = scene.add.graphics();
  const background = scene.add.graphics();
  const content = scene.add.container(-options.width * 0.5 + (options.padding ?? 24), -options.height * 0.5 + (options.padding ?? 24));
  const radius = options.radius ?? UI_THEME.radius.panel;
  const glowColor = options.glowColor ?? UI_THEME.colors.cyan;
  const fillColor = options.fillColor ?? UI_THEME.colors.panel;
  const fillAlpha = options.fillAlpha ?? UI_THEME.alpha.panel;
  const borderColor = options.borderColor ?? UI_THEME.colors.line;
  const borderAlpha = options.borderAlpha ?? UI_THEME.alpha.border;
  const glowLayers = options.glowLayers ?? 2;
  const glowStrength = options.glowStrength ?? 1;
  const showTopAccent = options.showTopAccent ?? false;
  const highlightAlpha = options.highlightAlpha ?? 0.026;

  for (let index = 0; index < glowLayers; index += 1) {
    const inset = index * 3;
    glow.lineStyle(2, glowColor, UI_THEME.alpha.glow * glowStrength * (0.55 - index * 0.24));
    glow.strokeRoundedRect(
      -options.width * 0.5 - inset,
      -options.height * 0.5 - inset,
      options.width + inset * 2,
      options.height + inset * 2,
      radius + inset
    );
  }
  glow.setBlendMode(Phaser.BlendModes.ADD);

  background.fillStyle(fillColor, fillAlpha);
  background.fillRoundedRect(-options.width * 0.5, -options.height * 0.5, options.width, options.height, radius);
  background.fillStyle(0xffffff, highlightAlpha);
  background.fillRoundedRect(
    -options.width * 0.5 + 1,
    -options.height * 0.5 + 1,
    options.width - 2,
    Math.max(36, options.height * 0.28),
    radius
  );
  background.lineStyle(1, borderColor, borderAlpha);
  background.strokeRoundedRect(-options.width * 0.5, -options.height * 0.5, options.width, options.height, radius);

  if (showTopAccent) {
    background.lineStyle(1, borderColor, 0.12);
    background.lineBetween(-options.width * 0.5 + 20, -options.height * 0.5 + 22, options.width * 0.5 - 20, -options.height * 0.5 + 22);
  }

  root.add([glow, background, content]);

  return {
    root,
    content,
    destroy: () => root.destroy(true)
  };
}

export function createScreenOverlay(
  scene: Phaser.Scene,
  color: number = UI_THEME.colors.ink,
  alpha: number = UI_THEME.alpha.overlay,
  depth: number = UI_THEME.depth.overlay
): Phaser.GameObjects.Rectangle {
  return scene.add
    .rectangle(
      getViewportCenterX(scene),
      getViewportCenterY(scene),
      getViewportWidth(scene),
      getViewportHeight(scene),
      color,
      alpha
    )
    .setDepth(depth)
    .setScrollFactor(0);
}

export function createAmbientOrb(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  color: number,
  alpha: number,
  depth: number
): Phaser.GameObjects.Ellipse {
  return scene.add
    .ellipse(x, y, width, height, color, alpha)
    .setDepth(depth)
    .setBlendMode(Phaser.BlendModes.ADD);
}

export function createChip(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  options: {
    width?: number;
    height?: number;
    color?: number;
    fillColor?: number;
    fillAlpha?: number;
    depth?: number;
  } = {}
): Phaser.GameObjects.Container {
  const width = options.width ?? Math.max(120, 28 + label.length * 8.2);
  const height = options.height ?? 32;
  const root = scene.add.container(x, y).setDepth(options.depth ?? 0);
  root.setSize(width, height);
  const background = scene.add.graphics();

  background.fillStyle(options.fillColor ?? UI_THEME.colors.surface, options.fillAlpha ?? 0.6);
  background.fillRoundedRect(-width * 0.5, -height * 0.5, width, height, UI_THEME.radius.pill);
  background.lineStyle(1, options.color ?? UI_THEME.colors.line, 0.24);
  background.strokeRoundedRect(-width * 0.5, -height * 0.5, width, height, UI_THEME.radius.pill);

  const text = addUiText(scene, 0, 0, label, "meta", {
    color: colorToHex(options.color ?? UI_THEME.colors.textSoft)
  }).setOrigin(0.5);

  root.add([background, text]);
  return root;
}

export class UiButton {
  public readonly root: Phaser.GameObjects.Container;
  private readonly glow: Phaser.GameObjects.Graphics;
  private readonly background: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly hitArea: Phaser.GameObjects.Zone;
  private enabled: boolean;
  private hovered = false;
  private pressed = false;

  public constructor(
    private readonly scene: Phaser.Scene,
    options: {
      x: number;
      y: number;
      width: number;
      height: number;
      label: string;
      variant?: "primary" | "secondary" | "ghost";
      enabled?: boolean;
      depth?: number;
      audioSystem?: AudioSystem;
      onClick: () => void;
    }
  ) {
    this.enabled = options.enabled ?? true;
    this.root = scene.add.container(options.x, options.y).setDepth(options.depth ?? 0);
    this.glow = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    this.background = scene.add.graphics();
    this.label = configureText(
      scene.add.text(0, 0, options.label, {
        fontFamily: UI_THEME.fonts.display,
        fontSize: options.height >= 48 ? "18px" : "16px",
        fontStyle: "700",
        color: colorToHex(UI_THEME.colors.text),
        align: "center"
      })
    ).setOrigin(0.5);
    this.hitArea = scene.add.zone(0, 0, options.width, options.height).setRectangleDropZone(options.width, options.height);

    this.root.add([this.glow, this.background, this.label, this.hitArea]);
    this.hitArea.setInteractive({ useHandCursor: true });

    const audioSystem = options.audioSystem;
    const variant = options.variant ?? "primary";

    this.hitArea.on("pointerover", () => {
      if (!this.enabled) {
        return;
      }

      this.hovered = true;
      audioSystem?.playSfx(SFX_KEYS.UI_HOVER);
      this.render(options.width, options.height, variant);
      this.scene.tweens.killTweensOf(this.root);
      this.scene.tweens.add({
        targets: this.root,
        scaleX: 1.02,
        scaleY: 1.02,
        duration: UI_THEME.motion.fast,
        ease: "Quad.easeOut"
      });
    });

    this.hitArea.on("pointerout", () => {
      this.hovered = false;
      this.pressed = false;
      this.render(options.width, options.height, variant);
      this.scene.tweens.killTweensOf(this.root);
      this.scene.tweens.add({
        targets: this.root,
        scaleX: 1,
        scaleY: 1,
        duration: UI_THEME.motion.fast,
        ease: "Quad.easeOut"
      });
    });

    this.hitArea.on("pointerdown", () => {
      if (!this.enabled) {
        return;
      }

      this.pressed = true;
      this.render(options.width, options.height, variant);
      this.root.setScale(0.98);
    });

    this.hitArea.on("pointerup", () => {
      if (!this.enabled) {
        return;
      }

      this.pressed = false;
      this.render(options.width, options.height, variant);
      this.root.setScale(this.hovered ? 1.02 : 1);
      audioSystem?.unlock();
      audioSystem?.playSfx(SFX_KEYS.UI_CLICK);
      options.onClick();
    });

    this.render(options.width, options.height, variant);
  }

  public setLabel(value: string): void {
    this.label.setText(value);
  }

  public setEnabled(value: boolean): void {
    this.enabled = value;
    if (value) {
      this.hitArea.setInteractive({ useHandCursor: true });
    } else {
      this.hitArea.disableInteractive();
      this.hovered = false;
      this.pressed = false;
    }
  }

  public setVisible(value: boolean): void {
    this.root.setVisible(value);
    if (value && this.enabled) {
      this.hitArea.setInteractive({ useHandCursor: true });
    } else if (!value) {
      this.hitArea.disableInteractive();
    }
  }

  public setPosition(x: number, y: number): void {
    this.root.setPosition(x, y);
  }

  public destroy(): void {
    this.scene.tweens.killTweensOf(this.root);
    this.root.destroy(true);
  }

  private render(width: number, height: number, variant: "primary" | "secondary" | "ghost"): void {
    this.glow.clear();
    this.background.clear();

    const palette = resolveButtonPalette(variant, this.enabled, this.hovered, this.pressed);
    const radius = UI_THEME.radius.button;

    for (let index = 0; index < 2; index += 1) {
      this.glow.lineStyle(2, palette.glow, palette.glowAlpha * (0.75 - index * 0.35));
      this.glow.strokeRoundedRect(-width * 0.5 - index * 2, -height * 0.5 - index * 2, width + index * 4, height + index * 4, radius + index * 2);
    }

    this.background.fillStyle(palette.fill, palette.fillAlpha);
    this.background.fillRoundedRect(-width * 0.5, -height * 0.5, width, height, radius);
    this.background.fillStyle(0xffffff, palette.highlightAlpha);
    this.background.fillRoundedRect(-width * 0.5 + 1, -height * 0.5 + 1, width - 2, Math.max(18, height * 0.48), radius);
    this.background.lineStyle(1, palette.border, palette.borderAlpha);
    this.background.strokeRoundedRect(-width * 0.5, -height * 0.5, width, height, radius);
    this.label.setColor(colorToHex(palette.text));
    this.label.setAlpha(this.enabled ? 1 : 0.6);
  }
}

function resolveButtonPalette(
  variant: "primary" | "secondary" | "ghost",
  enabled: boolean,
  hovered: boolean,
  pressed: boolean
): {
  fill: number;
  fillAlpha: number;
  border: number;
  borderAlpha: number;
  glow: number;
  glowAlpha: number;
  text: number;
  highlightAlpha: number;
} {
  if (!enabled) {
    return {
      fill: UI_THEME.colors.surface,
      fillAlpha: 0.32,
      border: UI_THEME.colors.textMuted,
      borderAlpha: 0.18,
      glow: UI_THEME.colors.textMuted,
      glowAlpha: 0.05,
      text: UI_THEME.colors.textMuted,
      highlightAlpha: 0.02
    };
  }

  const hoveredBoost = hovered ? 0.08 : 0;
  const pressedDrop = pressed ? 0.06 : 0;

  if (variant === "primary") {
    return {
      fill: hovered ? 0x1a345d : 0x143053,
      fillAlpha: 0.88 + hoveredBoost - pressedDrop,
      border: UI_THEME.colors.cyan,
      borderAlpha: hovered ? 0.44 : 0.28,
      glow: UI_THEME.colors.cyan,
      glowAlpha: hovered ? 0.2 : 0.09,
      text: UI_THEME.colors.text,
      highlightAlpha: hovered ? 0.07 : 0.04
    };
  }

  if (variant === "secondary") {
    return {
      fill: hovered ? 0x161f38 : 0x11192f,
      fillAlpha: 0.82 + hoveredBoost - pressedDrop,
      border: UI_THEME.colors.lineSoft,
      borderAlpha: hovered ? 0.34 : 0.2,
      glow: UI_THEME.colors.violet,
      glowAlpha: hovered ? 0.16 : 0.07,
      text: UI_THEME.colors.text,
      highlightAlpha: hovered ? 0.06 : 0.04
    };
  }

  return {
    fill: hovered ? 0x10192a : 0x0b1322,
    fillAlpha: 0.54 + hoveredBoost - pressedDrop,
    border: UI_THEME.colors.textSoft,
    borderAlpha: hovered ? 0.24 : 0.14,
    glow: UI_THEME.colors.cyan,
    glowAlpha: hovered ? 0.12 : 0.05,
    text: UI_THEME.colors.textSoft,
    highlightAlpha: hovered ? 0.05 : 0.02
  };
}

export class UiMeter {
  public readonly root: Phaser.GameObjects.Container;
  private readonly fill: Phaser.GameObjects.Rectangle;
  private readonly valueText: Phaser.GameObjects.Text;

  public constructor(
    scene: Phaser.Scene,
    options: {
      x: number;
      y: number;
      width: number;
      label: string;
      valueText: string;
      color?: number;
      depth?: number;
    }
  ) {
    this.root = scene.add.container(options.x, options.y).setDepth(options.depth ?? 0);
    const label = addUiText(scene, 0, 0, options.label, "label", {
      color: colorToHex(UI_THEME.colors.textSoft)
    }).setOrigin(0, 0);
    const track = scene.add.graphics();
    track.fillStyle(UI_THEME.colors.surface, 0.88);
    track.fillRoundedRect(0, 26, options.width, 12, 10);
    track.lineStyle(1, UI_THEME.colors.line, 0.12);
    track.strokeRoundedRect(0, 26, options.width, 12, 10);

    this.fill = scene.add
      .rectangle(0, 32, options.width, 8, options.color ?? UI_THEME.colors.success, 1)
      .setOrigin(0, 0.5);

    this.valueText = addUiText(scene, options.width, 0, options.valueText, "meta", {
      color: colorToHex(UI_THEME.colors.text)
    }).setOrigin(1, 0);

    this.root.add([label, track, this.fill, this.valueText]);
  }

  public setValue(progress: number, valueText: string, color?: number): void {
    this.fill.displayWidth = Math.max(0, this.fill.width * Phaser.Math.Clamp(progress, 0, 1));
    if (color !== undefined) {
      this.fill.setFillStyle(color, 1);
    }
    this.valueText.setText(valueText);
  }

  public destroy(): void {
    this.root.destroy(true);
  }
}

export function createStatusRow(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  value: string,
  width: number,
  options: {
    depth?: number;
    accentColor?: number;
  } = {}
): Phaser.GameObjects.Container {
  const root = scene.add.container(x, y).setDepth(options.depth ?? 0);
  const divider = scene.add.graphics();
  divider.lineStyle(1, UI_THEME.colors.line, 0.1);
  divider.lineBetween(0, 28, width, 28);

  const labelText = addUiText(scene, 0, 0, label, "meta").setOrigin(0, 0);
  const valueText = addUiText(scene, width, 0, value, "body", {
    color: colorToHex(options.accentColor ?? UI_THEME.colors.text)
  }).setOrigin(1, 0);

  root.add([divider, labelText, valueText]);
  return root;
}
