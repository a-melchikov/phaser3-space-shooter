import Phaser from "phaser";

import { configureText } from "../utils/helpers";

export const UI_THEME = {
  colors: {
    ink: 0x030712,
    panel: 0x0b1328,
    panelStrong: 0x101b35,
    surface: 0x142344,
    line: 0x89deff,
    lineSoft: 0xa98cff,
    text: 0xf2f7ff,
    textSoft: 0xaabfd8,
    textMuted: 0x7f94af,
    cyan: 0x6ef2ff,
    violet: 0xb592ff,
    success: 0x79f7c1,
    warning: 0xffd76c,
    danger: 0xff7f9f,
    shadow: 0x01040b
  },
  alpha: {
    panel: 0.8,
    panelStrong: 0.92,
    border: 0.28,
    glow: 0.16,
    overlay: 0.72
  },
  radius: {
    panel: 24,
    button: 18,
    pill: 999
  },
  spacing: {
    xs: 8,
    sm: 12,
    md: 18,
    lg: 24,
    xl: 32
  },
  motion: {
    fast: 120,
    normal: 180,
    slow: 220
  },
  depth: {
    menu: 10,
    hud: 60,
    banner: 90,
    overlay: 120,
    overlayContent: 130
  },
  fonts: {
    display: "\"Orbitron\", \"Segoe UI\", sans-serif",
    body: "\"Segoe UI\", Tahoma, Geneva, Verdana, sans-serif"
  }
} as const;

const TEXT_PRESETS = {
  heroTitle: {
    fontFamily: UI_THEME.fonts.display,
    fontSize: "48px",
    fontStyle: "700",
    color: colorToHex(UI_THEME.colors.text)
  },
  sectionTitle: {
    fontFamily: UI_THEME.fonts.display,
    fontSize: "24px",
    fontStyle: "700",
    color: colorToHex(UI_THEME.colors.text)
  },
  metric: {
    fontFamily: UI_THEME.fonts.display,
    fontSize: "24px",
    fontStyle: "700",
    color: colorToHex(UI_THEME.colors.text)
  },
  button: {
    fontFamily: UI_THEME.fonts.display,
    fontSize: "18px",
    fontStyle: "700",
    color: colorToHex(UI_THEME.colors.text)
  },
  label: {
    fontFamily: UI_THEME.fonts.display,
    fontSize: "13px",
    fontStyle: "700",
    color: colorToHex(UI_THEME.colors.cyan)
  },
  body: {
    fontFamily: UI_THEME.fonts.body,
    fontSize: "16px",
    color: colorToHex(UI_THEME.colors.text)
  },
  bodySoft: {
    fontFamily: UI_THEME.fonts.body,
    fontSize: "15px",
    color: colorToHex(UI_THEME.colors.textSoft)
  },
  meta: {
    fontFamily: UI_THEME.fonts.body,
    fontSize: "13px",
    color: colorToHex(UI_THEME.colors.textMuted)
  }
} as const satisfies Record<string, Phaser.Types.GameObjects.Text.TextStyle>;

export type UiTextPreset = keyof typeof TEXT_PRESETS;

export function colorToHex(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

export function createTextStyle(
  preset: UiTextPreset,
  overrides: Phaser.Types.GameObjects.Text.TextStyle = {}
): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    ...TEXT_PRESETS[preset],
    ...overrides
  };
}

export function addUiText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  value: string,
  preset: UiTextPreset,
  overrides: Phaser.Types.GameObjects.Text.TextStyle = {}
): Phaser.GameObjects.Text {
  return configureText(scene.add.text(x, y, value, createTextStyle(preset, overrides)));
}

export function isCompactViewport(scene: Phaser.Scene): boolean {
  return scene.scale.gameSize.width <= 820 || scene.scale.gameSize.height <= 620;
}

export function fadeScaleIn(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.GameObject,
  options: {
    delay?: number;
    duration?: number;
    yOffset?: number;
    scaleFrom?: number;
  } = {}
): void {
  const alphaTarget = target as unknown as Phaser.GameObjects.Components.Alpha;
  const transformTarget = target as unknown as Phaser.GameObjects.Components.Transform;
  const startY = "y" in transformTarget ? transformTarget.y : undefined;

  alphaTarget.setAlpha?.(0);
  transformTarget.setScale?.(options.scaleFrom ?? 0.96);

  if (startY !== undefined) {
    transformTarget.setY?.(startY + (options.yOffset ?? 10));
  }

  scene.tweens.add({
    targets: target,
    alpha: 1,
    scaleX: 1,
    scaleY: 1,
    y: startY,
    delay: options.delay ?? 0,
    duration: options.duration ?? UI_THEME.motion.slow,
    ease: "Quad.easeOut"
  });
}
