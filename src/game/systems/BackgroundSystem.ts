import Phaser from "phaser";

import { getViewportCenterX, getViewportHeight, getViewportWidth } from "../utils/viewport";

type PlanetSurfaceType = "gas" | "rock" | "ice" | "clouded" | "volcanic";

interface StarLayerConfig {
  readonly depth: number;
  readonly alpha: number;
  readonly starCount: number;
  readonly clusterCount: number;
  readonly scatterRatio: number;
  readonly minSize: number;
  readonly maxSize: number;
  readonly alphaMin: number;
  readonly alphaMax: number;
  readonly colors: readonly number[];
  readonly twinkleCount: number;
  readonly parallaxX: number;
  readonly parallaxY: number;
  readonly swayX: number;
  readonly swayY: number;
  readonly speedX: number;
  readonly speedY: number;
}

interface NebulaConfig {
  readonly count: number;
  readonly colors: readonly number[];
  readonly minRadius: number;
  readonly maxRadius: number;
  readonly alphaMin: number;
  readonly alphaMax: number;
}

interface PlanetRingConfig {
  readonly color: number;
  readonly alpha: number;
}

interface PlanetVariant {
  readonly key: string;
  readonly baseColor: number;
  readonly shadowColor: number;
  readonly glowColor: number;
  readonly accentColor: number;
  readonly highlightColor: number;
  readonly craterColor: number;
  readonly bandColor: number;
  readonly bandCount: number;
  readonly craterCount: number;
  readonly hasAtmosphere: boolean;
  readonly ring?: PlanetRingConfig;
}

interface PlanetConfig {
  readonly minCount: number;
  readonly maxCount: number;
  readonly minRadius: number;
  readonly maxRadius: number;
  readonly edgePadding: number;
  readonly centralSafeZone: {
    readonly width: number;
    readonly height: number;
  };
  readonly variants: readonly PlanetVariant[];
}

export interface SpaceBackgroundConfig {
  readonly seed?: string;
  readonly overscan: number;
  readonly baseColorTop: number;
  readonly baseColorBottom: number;
  readonly vignetteColor: number;
  readonly starLayers: {
    readonly far: StarLayerConfig;
    readonly mid: StarLayerConfig;
    readonly near: StarLayerConfig;
  };
  readonly nebula: NebulaConfig;
  readonly planets: PlanetConfig;
}

interface LayerRuntime {
  readonly container: Phaser.GameObjects.Container;
  readonly config: StarLayerConfig;
  readonly phaseX: number;
  readonly phaseY: number;
  readonly twinkles: TwinkleRuntime[];
  currentX: number;
  currentY: number;
}

interface TwinkleRuntime {
  readonly star: Phaser.GameObjects.Arc;
  readonly glow?: Phaser.GameObjects.Arc;
  readonly originX: number;
  readonly originY: number;
  readonly baseAlpha: number;
  readonly amplitude: number;
  readonly speed: number;
  readonly phase: number;
  readonly driftX: number;
  readonly driftY: number;
  readonly driftSpeedX: number;
  readonly driftSpeedY: number;
}

const PLANET_VARIANTS: readonly PlanetVariant[] = [
  {
    key: "azure-gas",
    baseColor: 0x547fda,
    shadowColor: 0x21396f,
    glowColor: 0x8ec8ff,
    accentColor: 0x8eb7ff,
    highlightColor: 0xe6f7ff,
    craterColor: 0x3a5c9c,
    bandColor: 0xb6d8ff,
    bandCount: 4,
    craterCount: 1,
    hasAtmosphere: true,
    ring: {
      color: 0xe1f0ff,
      alpha: 0.24
    }
  },
  {
    key: "violet-ice",
    baseColor: 0x8d67cc,
    shadowColor: 0x45276d,
    glowColor: 0xc8a4ff,
    accentColor: 0xae8fff,
    highlightColor: 0xf7ebff,
    craterColor: 0x654b8f,
    bandColor: 0xd9c8ff,
    bandCount: 3,
    craterCount: 2,
    hasAtmosphere: true
  },
  {
    key: "rose-dwarf",
    baseColor: 0xbc6487,
    shadowColor: 0x612642,
    glowColor: 0xf4a9c4,
    accentColor: 0xd985a8,
    highlightColor: 0xffedf4,
    craterColor: 0x7d3d59,
    bandColor: 0xf0b6cf,
    bandCount: 2,
    craterCount: 4,
    hasAtmosphere: false
  },
  {
    key: "teal-ocean",
    baseColor: 0x3c9cb6,
    shadowColor: 0x165264,
    glowColor: 0x7fe8ff,
    accentColor: 0x65c8d6,
    highlightColor: 0xe2fdff,
    craterColor: 0x2a7184,
    bandColor: 0x9ce8ef,
    bandCount: 3,
    craterCount: 1,
    hasAtmosphere: true
  },
  {
    key: "amber-rock",
    baseColor: 0xc78652,
    shadowColor: 0x6c4121,
    glowColor: 0xffca8d,
    accentColor: 0xe3a26f,
    highlightColor: 0xfff0df,
    craterColor: 0x92572c,
    bandColor: 0xf5c289,
    bandCount: 2,
    craterCount: 5,
    hasAtmosphere: false
  },
  {
    key: "lilac-ring",
    baseColor: 0x7d78d9,
    shadowColor: 0x35327a,
    glowColor: 0xafb2ff,
    accentColor: 0x9894f0,
    highlightColor: 0xf2f3ff,
    craterColor: 0x5955a8,
    bandColor: 0xd0cdff,
    bandCount: 4,
    craterCount: 1,
    hasAtmosphere: true,
    ring: {
      color: 0xffddb3,
      alpha: 0.28
    }
  },
  {
    key: "emerald-cloud",
    baseColor: 0x47a37f,
    shadowColor: 0x1b5e46,
    glowColor: 0x8af5cb,
    accentColor: 0x6dcfa6,
    highlightColor: 0xe6fff4,
    craterColor: 0x2f785c,
    bandColor: 0xc5ffe7,
    bandCount: 3,
    craterCount: 2,
    hasAtmosphere: true
  },
  {
    key: "crimson-dust",
    baseColor: 0xc15a67,
    shadowColor: 0x6c2530,
    glowColor: 0xffa1ad,
    accentColor: 0xe28391,
    highlightColor: 0xffebee,
    craterColor: 0x8e3946,
    bandColor: 0xffcad0,
    bandCount: 2,
    craterCount: 4,
    hasAtmosphere: false
  }
] as const;

export const SPACE_BACKGROUND_PRESETS = {
  menu: {
    overscan: 0.22,
    baseColorTop: 0x020612,
    baseColorBottom: 0x071124,
    vignetteColor: 0x01040b,
    starLayers: {
      far: {
        depth: -10,
        alpha: 0.92,
        starCount: 420,
        clusterCount: 5,
        scatterRatio: 0.38,
        minSize: 0.45,
        maxSize: 1.25,
        alphaMin: 0.1,
        alphaMax: 0.38,
        colors: [0x86a9ff, 0xa5c9ff, 0xdceaff],
        twinkleCount: 0,
        parallaxX: 0.012,
        parallaxY: 0.016,
        swayX: 6,
        swayY: 12,
        speedX: 0.06,
        speedY: 0.08
      },
      mid: {
        depth: -9,
        alpha: 0.84,
        starCount: 260,
        clusterCount: 4,
        scatterRatio: 0.42,
        minSize: 0.7,
        maxSize: 1.8,
        alphaMin: 0.18,
        alphaMax: 0.56,
        colors: [0xb3d1ff, 0x86dfff, 0xf4d9ff],
        twinkleCount: 8,
        parallaxX: 0.02,
        parallaxY: 0.028,
        swayX: 10,
        swayY: 16,
        speedX: 0.08,
        speedY: 0.11
      },
      near: {
        depth: -8,
        alpha: 0.78,
        starCount: 156,
        clusterCount: 3,
        scatterRatio: 0.55,
        minSize: 1.1,
        maxSize: 2.5,
        alphaMin: 0.26,
        alphaMax: 0.86,
        colors: [0xffffff, 0xd9f6ff, 0xffefbc],
        twinkleCount: 14,
        parallaxX: 0.034,
        parallaxY: 0.046,
        swayX: 14,
        swayY: 22,
        speedX: 0.11,
        speedY: 0.15
      }
    },
    nebula: {
      count: 4,
      colors: [0x6947b8, 0x2357c8, 0xd2539d],
      minRadius: 130,
      maxRadius: 260,
      alphaMin: 0.05,
      alphaMax: 0.12
    },
    planets: {
      minCount: 3,
      maxCount: 4,
      minRadius: 34,
      maxRadius: 78,
      edgePadding: 46,
      centralSafeZone: {
        width: 0.42,
        height: 0.38
      },
      variants: PLANET_VARIANTS
    }
  },
  game: {
    overscan: 0.18,
    baseColorTop: 0x020611,
    baseColorBottom: 0x06101f,
    vignetteColor: 0x01030a,
    starLayers: {
      far: {
        depth: -10,
        alpha: 0.9,
        starCount: 360,
        clusterCount: 5,
        scatterRatio: 0.36,
        minSize: 0.4,
        maxSize: 1.2,
        alphaMin: 0.08,
        alphaMax: 0.34,
        colors: [0x88abff, 0xa8c6ff, 0xd0ddff],
        twinkleCount: 0,
        parallaxX: 0.01,
        parallaxY: 0.015,
        swayX: 5,
        swayY: 10,
        speedX: 0.05,
        speedY: 0.07
      },
      mid: {
        depth: -9,
        alpha: 0.86,
        starCount: 230,
        clusterCount: 4,
        scatterRatio: 0.46,
        minSize: 0.65,
        maxSize: 1.7,
        alphaMin: 0.18,
        alphaMax: 0.5,
        colors: [0x9ec7ff, 0x86e4ff, 0xdab8ff],
        twinkleCount: 6,
        parallaxX: 0.018,
        parallaxY: 0.024,
        swayX: 8,
        swayY: 12,
        speedX: 0.07,
        speedY: 0.1
      },
      near: {
        depth: -8,
        alpha: 0.8,
        starCount: 142,
        clusterCount: 3,
        scatterRatio: 0.58,
        minSize: 1,
        maxSize: 2.35,
        alphaMin: 0.24,
        alphaMax: 0.82,
        colors: [0xffffff, 0xd8f4ff, 0xffe7a1],
        twinkleCount: 12,
        parallaxX: 0.03,
        parallaxY: 0.04,
        swayX: 12,
        swayY: 18,
        speedX: 0.1,
        speedY: 0.13
      }
    },
    nebula: {
      count: 4,
      colors: [0x5740b8, 0x205bc2, 0xcc4d90],
      minRadius: 120,
      maxRadius: 220,
      alphaMin: 0.04,
      alphaMax: 0.1
    },
    planets: {
      minCount: 3,
      maxCount: 4,
      minRadius: 28,
      maxRadius: 68,
      edgePadding: 44,
      centralSafeZone: {
        width: 0.34,
        height: 0.28
      },
      variants: PLANET_VARIANTS
    }
  },
  gameOver: {
    overscan: 0.2,
    baseColorTop: 0x12040c,
    baseColorBottom: 0x1b0711,
    vignetteColor: 0x090108,
    starLayers: {
      far: {
        depth: -10,
        alpha: 0.88,
        starCount: 320,
        clusterCount: 4,
        scatterRatio: 0.42,
        minSize: 0.4,
        maxSize: 1.15,
        alphaMin: 0.08,
        alphaMax: 0.28,
        colors: [0xc187a1, 0xa4a8e7, 0xe6d2df],
        twinkleCount: 0,
        parallaxX: 0.012,
        parallaxY: 0.016,
        swayX: 4,
        swayY: 8,
        speedX: 0.05,
        speedY: 0.07
      },
      mid: {
        depth: -9,
        alpha: 0.82,
        starCount: 188,
        clusterCount: 4,
        scatterRatio: 0.5,
        minSize: 0.65,
        maxSize: 1.6,
        alphaMin: 0.14,
        alphaMax: 0.42,
        colors: [0xd8b8c6, 0xc5c2ff, 0xf0dce8],
        twinkleCount: 5,
        parallaxX: 0.02,
        parallaxY: 0.026,
        swayX: 7,
        swayY: 12,
        speedX: 0.07,
        speedY: 0.09
      },
      near: {
        depth: -8,
        alpha: 0.76,
        starCount: 118,
        clusterCount: 3,
        scatterRatio: 0.62,
        minSize: 0.95,
        maxSize: 2.2,
        alphaMin: 0.22,
        alphaMax: 0.74,
        colors: [0xffffff, 0xffd9de, 0xf5c0cb],
        twinkleCount: 10,
        parallaxX: 0.03,
        parallaxY: 0.04,
        swayX: 10,
        swayY: 15,
        speedX: 0.09,
        speedY: 0.12
      }
    },
    nebula: {
      count: 3,
      colors: [0xa33b72, 0x4e2a8e, 0x9e4d64],
      minRadius: 120,
      maxRadius: 210,
      alphaMin: 0.04,
      alphaMax: 0.09
    },
    planets: {
      minCount: 2,
      maxCount: 4,
      minRadius: 28,
      maxRadius: 60,
      edgePadding: 40,
      centralSafeZone: {
        width: 0.36,
        height: 0.3
      },
      variants: PLANET_VARIANTS
    }
  }
} as const satisfies Record<string, SpaceBackgroundConfig>;

export class BackgroundSystem {
  private readonly seed: string;
  private rng: Phaser.Math.RandomDataGenerator;
  private readonly layers: LayerRuntime[] = [];
  private readonly root: Phaser.GameObjects.Container;
  private readonly generatedTextureKeys = new Set<string>();
  private width = 0;
  private height = 0;
  private renderWidth = 0;
  private renderHeight = 0;
  private lastUpdateTime?: number;

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly config: SpaceBackgroundConfig
  ) {
    this.seed = config.seed ?? `${scene.scene.key}-${Date.now()}-${Math.random()}`;
    this.rng = new Phaser.Math.RandomDataGenerator([this.seed]);
    this.scene.cameras.main.roundPixels = false;
    this.root = this.scene.add.container(0, 0).setDepth(-20).setScrollFactor(0);
    this.rebuild();
  }

  public update(time: number): void {
    const centerX = getViewportCenterX(this.scene);
    const centerY = getViewportHeight(this.scene) * 0.5;
    const camera = this.scene.cameras.main;
    const seconds = time * 0.001;
    const deltaMs = this.lastUpdateTime === undefined ? 16.6667 : Math.max(1, Math.min(48, time - this.lastUpdateTime));
    const smoothing = 1 - Math.exp(-deltaMs * 0.018);
    this.lastUpdateTime = time;

    this.root.setPosition(centerX, centerY);

    this.layers.forEach((layer) => {
      const targetX =
        -camera.scrollX * layer.config.parallaxX +
        Math.sin(seconds * layer.config.speedX + layer.phaseX) * layer.config.swayX;
      const targetY =
        -camera.scrollY * layer.config.parallaxY +
        Math.cos(seconds * layer.config.speedY + layer.phaseY) * layer.config.swayY;

      layer.currentX = Phaser.Math.Linear(layer.currentX, targetX, smoothing);
      layer.currentY = Phaser.Math.Linear(layer.currentY, targetY, smoothing);

      layer.container.setPosition(layer.currentX, layer.currentY).setAlpha(layer.config.alpha);

      layer.twinkles.forEach((twinkle) => {
        const localX = Math.sin(seconds * twinkle.driftSpeedX + twinkle.phase) * twinkle.driftX;
        const localY = Math.cos(seconds * twinkle.driftSpeedY + twinkle.phase * 1.17) * twinkle.driftY;
        const alpha =
          twinkle.baseAlpha +
          (Math.sin(seconds * twinkle.speed + twinkle.phase) * 0.5 + 0.5) * twinkle.amplitude;
        const resolvedAlpha = Phaser.Math.Clamp(alpha, 0.02, 1);
        twinkle.star
          .setPosition(twinkle.originX + localX, twinkle.originY + localY)
          .setAlpha(resolvedAlpha);
        twinkle.glow
          ?.setPosition(twinkle.originX + localX, twinkle.originY + localY)
          .setAlpha(resolvedAlpha * 0.34);
      });
    });
  }

  public resize(): void {
    this.rebuild();
  }

  public destroy(): void {
    this.disposeGeneratedTextures();
    this.root.destroy(true);
    this.layers.length = 0;
  }

  private rebuild(): void {
    this.root.removeAll(true);
    this.disposeGeneratedTextures();
    this.layers.length = 0;
    this.rng = new Phaser.Math.RandomDataGenerator([this.seed]);
    this.lastUpdateTime = undefined;

    this.width = getViewportWidth(this.scene);
    this.height = getViewportHeight(this.scene);
    const overscanX = Math.ceil(this.width * this.config.overscan);
    const overscanY = Math.ceil(this.height * this.config.overscan);
    this.renderWidth = this.width + overscanX * 2;
    this.renderHeight = this.height + overscanY * 2;

    const farLayer = this.createLayer(this.config.starLayers.far);
    this.drawBackgroundGradient(farLayer.container);
    this.drawStarLayer(farLayer);
    this.layers.push(farLayer);

    const midLayer = this.createLayer(this.config.starLayers.mid);
    this.drawNebulae(midLayer.container);
    this.drawStarLayer(midLayer);
    this.layers.push(midLayer);

    const nearLayer = this.createLayer(this.config.starLayers.near);
    this.drawStarLayer(nearLayer);
    this.drawPlanets(nearLayer.container);
    this.layers.push(nearLayer);
  }

  private createLayer(config: StarLayerConfig): LayerRuntime {
    const container = this.scene.add.container(0, 0).setDepth(config.depth).setScrollFactor(0);
    this.root.add(container);

    return {
      container,
      config,
      phaseX: this.rng.realInRange(0, Math.PI * 2),
      phaseY: this.rng.realInRange(0, Math.PI * 2),
      twinkles: [],
      currentX: 0,
      currentY: 0
    };
  }

  private drawBackgroundGradient(container: Phaser.GameObjects.Container): void {
    const graphics = this.scene.add.graphics();

    const steps = 28;
    const top = Phaser.Display.Color.IntegerToColor(this.config.baseColorTop);
    const bottom = Phaser.Display.Color.IntegerToColor(this.config.baseColorBottom);

    for (let index = 0; index < steps; index += 1) {
      const t = index / Math.max(steps - 1, 1);
      const color = Phaser.Display.Color.Interpolate.ColorWithColor(top, bottom, 100, t * 100);
      graphics.fillStyle(Phaser.Display.Color.GetColor(color.r, color.g, color.b), 1);
      graphics.fillRect(0, (this.renderHeight / steps) * index, this.renderWidth, this.renderHeight / steps + 1);
    }

    graphics.fillStyle(this.config.vignetteColor, 0.16);
    graphics.fillEllipse(this.renderWidth * 0.08, this.renderHeight * 0.14, this.renderWidth * 0.48, this.renderHeight * 0.42);
    graphics.fillEllipse(this.renderWidth * 0.92, this.renderHeight * 0.22, this.renderWidth * 0.42, this.renderHeight * 0.38);
    graphics.fillEllipse(this.renderWidth * 0.5, this.renderHeight * 0.94, this.renderWidth * 0.9, this.renderHeight * 0.32);

    container.add(this.createBakedImage(graphics, "gradient"));
  }

  private drawNebulae(container: Phaser.GameObjects.Container): void {
    const graphics = this.scene.add.graphics();

    for (let index = 0; index < this.config.nebula.count; index += 1) {
      const centerX = this.rng.realInRange(this.renderWidth * 0.12, this.renderWidth * 0.88);
      const centerY = this.rng.realInRange(this.renderHeight * 0.14, this.renderHeight * 0.86);
      const radius = this.rng.realInRange(this.config.nebula.minRadius, this.config.nebula.maxRadius);
      const color = this.pickFrom(this.config.nebula.colors);
      const baseAlpha = this.rng.realInRange(this.config.nebula.alphaMin, this.config.nebula.alphaMax);

      for (let layer = 0; layer < 6; layer += 1) {
        const offsetX = this.rng.realInRange(-radius * 0.18, radius * 0.18);
        const offsetY = this.rng.realInRange(-radius * 0.14, radius * 0.14);
        const width = radius * this.rng.realInRange(1.1, 2.05) * (1 - layer * 0.08);
        const height = radius * this.rng.realInRange(0.48, 1.05) * (1 - layer * 0.08);
        graphics.fillStyle(color, baseAlpha * (1 - layer * 0.12));
        graphics.fillEllipse(centerX + offsetX, centerY + offsetY, width, height);
      }
    }

    container.add(this.createBakedImage(graphics, "nebula"));
  }

  private drawStarLayer(layer: LayerRuntime): void {
    const graphics = this.scene.add.graphics();

    const positions = this.generateClusteredPositions(
      layer.config.starCount,
      layer.config.clusterCount,
      layer.config.scatterRatio
    );

    positions.forEach((position) => {
      this.drawStar(graphics, layer.config, position.x, position.y);
    });

    layer.container.add(this.createBakedImage(graphics, `stars-${layer.config.depth}`));
    this.addTwinkles(layer);
  }

  private drawStar(
    graphics: Phaser.GameObjects.Graphics,
    config: StarLayerConfig,
    x: number,
    y: number
  ): void {
    const roll = this.rng.frac();
    const color = this.resolveStarColor(config.colors);

    let size = this.rng.realInRange(config.minSize, config.maxSize);
    let alpha = this.rng.realInRange(config.alphaMin, config.alphaMax);
    let hasGlow = false;
    let hasFlare = false;

    if (roll < 0.62) {
      size = this.rng.realInRange(config.minSize * 0.72, config.minSize * 1.08);
      alpha *= 0.72;
    } else if (roll < 0.92) {
      size = this.rng.realInRange(config.minSize * 0.95, config.maxSize * 0.72);
      alpha *= 0.92;
    } else {
      size = this.rng.realInRange(config.maxSize * 0.66, config.maxSize * 1.04);
      alpha = Math.min(0.96, alpha * 1.18);
      hasGlow = this.rng.frac() < 0.34;
      hasFlare = true;
    }

    if (this.rng.frac() < 0.04) {
      hasGlow = true;
    }

    if (hasGlow) {
      graphics.fillStyle(color, alpha * 0.08);
      graphics.fillCircle(x, y, size * this.rng.realInRange(2.1, 3.4));
    }

    graphics.fillStyle(color, alpha * 0.2);
    graphics.fillCircle(x, y, size * 1.55);

    graphics.fillStyle(color, alpha);
    graphics.fillCircle(x, y, size);

    graphics.fillStyle(0xffffff, Math.min(1, alpha * 0.42));
    graphics.fillCircle(x - size * 0.14, y - size * 0.14, Math.max(0.16, size * 0.42));

    if (hasFlare) {
      graphics.lineStyle(1, color, alpha * 0.18);
      graphics.lineBetween(x - size * 2.1, y, x + size * 2.1, y);
      graphics.lineBetween(x, y - size * 2.1, x, y + size * 2.1);
    }
  }

  private addTwinkles(layer: LayerRuntime): void {
    for (let index = 0; index < layer.config.twinkleCount; index += 1) {
      const x = this.rng.realInRange(-this.renderWidth * 0.44, this.renderWidth * 0.44);
      const y = this.rng.realInRange(-this.renderHeight * 0.42, this.renderHeight * 0.42);
      const radius = this.rng.realInRange(0.9, Math.max(1.2, layer.config.maxSize + 0.35));
      const color = this.resolveStarColor(layer.config.colors);
      const baseAlpha = this.rng.realInRange(0.12, 0.34);
      const glow =
        radius > layer.config.maxSize * 0.58 || this.rng.frac() < 0.45
          ? this.scene.add.circle(x, y, radius * 3.2, color, baseAlpha * 0.12).setBlendMode(Phaser.BlendModes.ADD)
          : undefined;
      const twinkle = this.scene.add.circle(x, y, radius, color, baseAlpha).setBlendMode(Phaser.BlendModes.ADD);

      if (glow) {
        layer.container.add(glow);
      }

      layer.container.add(twinkle);
      layer.twinkles.push({
        star: twinkle,
        glow,
        originX: x,
        originY: y,
        baseAlpha,
        amplitude: this.rng.realInRange(0.18, 0.46),
        speed: this.rng.realInRange(0.7, 1.7),
        phase: this.rng.realInRange(0, Math.PI * 2),
        driftX: this.rng.realInRange(0.15, 0.7),
        driftY: this.rng.realInRange(0.15, 0.7),
        driftSpeedX: this.rng.realInRange(0.12, 0.32),
        driftSpeedY: this.rng.realInRange(0.1, 0.28)
      });
    }
  }

  private drawPlanets(container: Phaser.GameObjects.Container): void {
    const count = this.rng.between(this.config.planets.minCount, this.config.planets.maxCount);
    const variants = this.shuffle(this.config.planets.variants).slice(0, count);
    const placed: Array<{ x: number; y: number; radius: number }> = [];
    const graphics = this.scene.add.graphics();

    variants.forEach((variant) => {
      const placement = this.findPlanetPlacement(placed);
      if (!placement) {
        return;
      }

      placed.push(placement);
      this.drawPlanetGraphic(graphics, placement.x, placement.y, placement.radius, variant);
    });

    container.add(this.createBakedImage(graphics, "planets"));
  }

  private drawPlanetGraphic(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    radius: number,
    variant: PlanetVariant
  ): void {
    const hasRing = Boolean(variant.ring);
    const surfaceType = this.resolveSurfaceType(variant.key);

    graphics.fillStyle(variant.glowColor, variant.hasAtmosphere ? 0.08 : 0.04);
    graphics.fillCircle(x, y, radius * (variant.hasAtmosphere ? 1.26 : 1.12));

    if (hasRing && variant.ring) {
      graphics.lineStyle(Math.max(1, radius * 0.08), variant.ring.color, variant.ring.alpha * 0.4);
      graphics.strokeEllipse(x - radius * 0.04, y + radius * 0.05, radius * 2.42, radius * 0.72);
    }

    this.drawPlanetBodyGradient(graphics, x, y, radius, variant);
    this.drawPlanetSurface(graphics, x, y, radius, variant, surfaceType);

    graphics.fillStyle(variant.highlightColor, 0.12);
    graphics.fillEllipse(x - radius * 0.24, y - radius * 0.26, radius * 0.84, radius * 0.56);

    graphics.fillStyle(variant.shadowColor, 0.24);
    graphics.fillEllipse(x + radius * 0.3, y + radius * 0.08, radius * 0.9, radius * 1.24);

    if (variant.hasAtmosphere) {
      graphics.lineStyle(Math.max(1, radius * 0.04), variant.glowColor, 0.22);
      graphics.strokeCircle(x, y, radius * 1.02);
      graphics.lineStyle(Math.max(1, radius * 0.022), variant.highlightColor, 0.18);
      graphics.strokeCircle(x - radius * 0.02, y - radius * 0.02, radius * 0.94);
    } else {
      graphics.lineStyle(Math.max(1, radius * 0.026), variant.highlightColor, 0.08);
      graphics.strokeCircle(x, y, radius * 0.98);
    }

    if (hasRing && variant.ring) {
      graphics.lineStyle(Math.max(1, radius * 0.06), variant.ring.color, variant.ring.alpha);
      graphics.strokeEllipse(x - radius * 0.02, y + radius * 0.05, radius * 2.18, radius * 0.54);
      graphics.lineStyle(1, variant.highlightColor, 0.16);
      graphics.strokeEllipse(x - radius * 0.02, y + radius * 0.05, radius * 1.98, radius * 0.44);
    }
  }

  private drawPlanetBodyGradient(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    radius: number,
    variant: PlanetVariant
  ): void {
    for (let layer = 0; layer < 10; layer += 1) {
      const t = layer / 9;
      const color = this.mixColors(variant.baseColor, variant.highlightColor, 1 - t * 0.78);
      const offsetX = -radius * 0.14 * (1 - t);
      const offsetY = -radius * 0.1 * (1 - t);
      graphics.fillStyle(color, 0.92);
      graphics.fillCircle(x + offsetX, y + offsetY, radius * (1 - t * 0.075));
    }

    graphics.fillStyle(variant.shadowColor, 0.34);
    graphics.fillCircle(x + radius * 0.22, y + radius * 0.14, radius * 0.92);
  }

  private drawPlanetSurface(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    radius: number,
    variant: PlanetVariant,
    surfaceType: PlanetSurfaceType
  ): void {
    switch (surfaceType) {
      case "gas":
        this.drawGasBands(graphics, x, y, radius, variant);
        return;
      case "ice":
        this.drawIceSurface(graphics, x, y, radius, variant);
        return;
      case "clouded":
        this.drawCloudSurface(graphics, x, y, radius, variant);
        return;
      case "volcanic":
        this.drawVolcanicSurface(graphics, x, y, radius, variant);
        return;
      case "rock":
      default:
        this.drawRockSurface(graphics, x, y, radius, variant);
    }
  }

  private drawGasBands(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    radius: number,
    variant: PlanetVariant
  ): void {
    for (let bandIndex = 0; bandIndex < variant.bandCount + 2; bandIndex += 1) {
      const offsetY = this.rng.realInRange(-radius * 0.5, radius * 0.45);
      const width = this.rng.realInRange(radius * 1.02, radius * 1.72);
      const height = this.rng.realInRange(radius * 0.12, radius * 0.24);
      graphics.fillStyle(variant.bandColor, this.rng.realInRange(0.07, 0.16));
      graphics.fillEllipse(x + this.rng.realInRange(-radius * 0.12, radius * 0.1), y + offsetY, width, height);
    }

    graphics.fillStyle(variant.accentColor, 0.14);
    graphics.fillEllipse(x + radius * 0.06, y + radius * 0.16, radius * 1.08, radius * 0.34);
  }

  private drawRockSurface(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    radius: number,
    variant: PlanetVariant
  ): void {
    for (let craterIndex = 0; craterIndex < variant.craterCount; craterIndex += 1) {
      const angle = this.rng.realInRange(0, Math.PI * 2);
      const distance = this.rng.realInRange(radius * 0.12, radius * 0.56);
      const craterX = x + Math.cos(angle) * distance;
      const craterY = y + Math.sin(angle) * distance * 0.86;
      const craterRadius = this.rng.realInRange(radius * 0.07, radius * 0.18);
      graphics.fillStyle(variant.craterColor, 0.24);
      graphics.fillCircle(craterX, craterY, craterRadius);
      graphics.fillStyle(variant.highlightColor, 0.08);
      graphics.fillCircle(craterX - craterRadius * 0.22, craterY - craterRadius * 0.2, craterRadius * 0.56);
    }

    for (let dustIndex = 0; dustIndex < 12; dustIndex += 1) {
      const px = x + this.rng.realInRange(-radius * 0.68, radius * 0.68);
      const py = y + this.rng.realInRange(-radius * 0.68, radius * 0.68);
      const pr = this.rng.realInRange(radius * 0.02, radius * 0.05);
      graphics.fillStyle(variant.accentColor, 0.08);
      graphics.fillCircle(px, py, pr);
    }
  }

  private drawIceSurface(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    radius: number,
    variant: PlanetVariant
  ): void {
    for (let streakIndex = 0; streakIndex < 7; streakIndex += 1) {
      const offsetY = this.rng.realInRange(-radius * 0.5, radius * 0.44);
      graphics.fillStyle(variant.bandColor, this.rng.realInRange(0.06, 0.14));
      graphics.fillEllipse(x + this.rng.realInRange(-radius * 0.08, radius * 0.12), y + offsetY, radius * 1.18, radius * 0.12);
    }

    for (let shardIndex = 0; shardIndex < 5; shardIndex += 1) {
      const px = x + this.rng.realInRange(-radius * 0.5, radius * 0.46);
      const py = y + this.rng.realInRange(-radius * 0.5, radius * 0.46);
      graphics.fillStyle(variant.highlightColor, 0.08);
      graphics.fillEllipse(px, py, radius * 0.32, radius * 0.08);
    }
  }

  private drawCloudSurface(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    radius: number,
    variant: PlanetVariant
  ): void {
    for (let bandIndex = 0; bandIndex < variant.bandCount + 1; bandIndex += 1) {
      const offsetY = this.rng.realInRange(-radius * 0.42, radius * 0.4);
      const offsetX = this.rng.realInRange(-radius * 0.16, radius * 0.16);
      graphics.fillStyle(variant.bandColor, this.rng.realInRange(0.08, 0.16));
      graphics.fillEllipse(
        x + offsetX,
        y + offsetY,
        radius * this.rng.realInRange(1.0, 1.45),
        radius * this.rng.realInRange(0.16, 0.28)
      );
    }

    graphics.fillStyle(variant.highlightColor, 0.09);
    graphics.fillEllipse(x - radius * 0.08, y + radius * 0.04, radius * 0.7, radius * 0.22);
  }

  private drawVolcanicSurface(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    radius: number,
    variant: PlanetVariant
  ): void {
    this.drawRockSurface(graphics, x, y, radius, variant);

    for (let fissureIndex = 0; fissureIndex < 4; fissureIndex += 1) {
      const startX = x + this.rng.realInRange(-radius * 0.42, radius * 0.42);
      const startY = y + this.rng.realInRange(-radius * 0.42, radius * 0.42);
      const endX = startX + this.rng.realInRange(-radius * 0.26, radius * 0.26);
      const endY = startY + this.rng.realInRange(-radius * 0.18, radius * 0.18);
      graphics.lineStyle(Math.max(1, radius * 0.032), variant.glowColor, 0.26);
      graphics.lineBetween(startX, startY, endX, endY);
      graphics.lineStyle(Math.max(1, radius * 0.014), variant.highlightColor, 0.16);
      graphics.lineBetween(startX, startY, endX, endY);
    }
  }

  private findPlanetPlacement(
    placed: Array<{ x: number; y: number; radius: number }>
  ): { x: number; y: number; radius: number } | null {
    for (let attempt = 0; attempt < 36; attempt += 1) {
      const radius = this.rng.realInRange(this.config.planets.minRadius, this.config.planets.maxRadius);
      const side = this.rng.pick(["left", "right", "top", "bottom"]);
      const minX = -this.renderWidth * 0.5 + radius + this.config.planets.edgePadding;
      const maxX = this.renderWidth * 0.5 - radius - this.config.planets.edgePadding;
      const minY = -this.renderHeight * 0.5 + radius + this.config.planets.edgePadding;
      const maxY = this.renderHeight * 0.5 - radius - this.config.planets.edgePadding;

      let x = 0;
      let y = 0;

      if (side === "left" || side === "right") {
        const zoneWidth = this.renderWidth * 0.18;
        x = side === "left" ? this.rng.realInRange(minX, minX + zoneWidth) : this.rng.realInRange(maxX - zoneWidth, maxX);
        y = this.rng.realInRange(minY, maxY);
      } else {
        const zoneHeight = this.renderHeight * 0.16;
        x = this.rng.realInRange(minX, maxX);
        y = side === "top" ? this.rng.realInRange(minY, minY + zoneHeight) : this.rng.realInRange(maxY - zoneHeight, maxY);
      }

      const safeZoneWidth = this.width * this.config.planets.centralSafeZone.width * 0.5;
      const safeZoneHeight = this.height * this.config.planets.centralSafeZone.height * 0.5;
      if (Math.abs(x) < safeZoneWidth + radius && Math.abs(y) < safeZoneHeight + radius) {
        continue;
      }

      const overlaps = placed.some((planet) => Phaser.Math.Distance.Between(x, y, planet.x, planet.y) < radius + planet.radius + 30);
      if (overlaps) {
        continue;
      }

      return { x, y, radius };
    }

    return null;
  }

  private generateClusteredPositions(
    count: number,
    clusterCount: number,
    scatterRatio: number
  ): Array<{ x: number; y: number }> {
    const padding = 12;
    const clusters = Array.from({ length: clusterCount }, () => ({
      x: this.rng.realInRange(padding, this.renderWidth - padding),
      y: this.rng.realInRange(padding, this.renderHeight - padding),
      radius: this.rng.realInRange(this.renderWidth * 0.09, this.renderWidth * 0.22),
      squashX: this.rng.realInRange(0.72, 1.6),
      squashY: this.rng.realInRange(0.68, 1.3),
      rotation: this.rng.realInRange(0, Math.PI * 2)
    }));

    return Array.from({ length: count }, () => {
      if (this.rng.frac() < scatterRatio) {
        return {
          x: this.rng.realInRange(padding, this.renderWidth - padding),
          y: this.rng.realInRange(padding, this.renderHeight - padding)
        };
      }

      const cluster = this.pickFrom(clusters);
      const angle = this.rng.realInRange(0, Math.PI * 2);
      const distance = Math.pow(this.rng.frac(), 1.7) * cluster.radius;
      const localX = Math.cos(angle) * distance * cluster.squashX;
      const localY = Math.sin(angle) * distance * cluster.squashY;
      const rotatedX = localX * Math.cos(cluster.rotation) - localY * Math.sin(cluster.rotation);
      const rotatedY = localX * Math.sin(cluster.rotation) + localY * Math.cos(cluster.rotation);

      return {
        x: Phaser.Math.Clamp(cluster.x + rotatedX, padding, this.renderWidth - padding),
        y: Phaser.Math.Clamp(cluster.y + rotatedY, padding, this.renderHeight - padding)
      };
    });
  }

  private resolveSurfaceType(key: string): PlanetSurfaceType {
    if (key.includes("gas") || key.includes("ring")) {
      return "gas";
    }
    if (key.includes("ice")) {
      return "ice";
    }
    if (key.includes("cloud") || key.includes("ocean")) {
      return "clouded";
    }
    if (key.includes("volcanic") || key.includes("dust")) {
      return "volcanic";
    }

    return "rock";
  }

  private mixColors(first: number, second: number, weight: number): number {
    const firstColor = Phaser.Display.Color.IntegerToColor(first);
    const secondColor = Phaser.Display.Color.IntegerToColor(second);
    const interpolated = Phaser.Display.Color.Interpolate.ColorWithColor(
      firstColor,
      secondColor,
      100,
      Phaser.Math.Clamp(weight, 0, 1) * 100
    );

    return Phaser.Display.Color.GetColor(interpolated.r, interpolated.g, interpolated.b);
  }

  private resolveStarColor(colors: readonly number[]): number {
    const roll = this.rng.frac();
    if (roll < 0.08) {
      return this.pickFrom([0xffecc8, 0xfff1d8, 0xffddba]);
    }
    if (roll < 0.18) {
      return this.pickFrom([0xd7f5ff, 0xcfe2ff, 0xb8ddff]);
    }

    return this.pickFrom(colors);
  }

  private pickFrom<T>(items: readonly T[]): T {
    return items[this.rng.between(0, items.length - 1)] as T;
  }

  private shuffle<T>(items: readonly T[]): T[] {
    const copy = [...items];

    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = this.rng.between(0, index);
      const current = copy[index];
      copy[index] = copy[swapIndex] as T;
      copy[swapIndex] = current as T;
    }

    return copy;
  }

  private createBakedImage(graphics: Phaser.GameObjects.Graphics, keySuffix: string): Phaser.GameObjects.Image {
    const textureKey = `space-bg-${this.scene.scene.key}-${keySuffix}-${Phaser.Utils.String.UUID()}`;
    graphics.generateTexture(textureKey, this.renderWidth, this.renderHeight);
    graphics.destroy();
    this.generatedTextureKeys.add(textureKey);

    return this.scene.add.image(0, 0, textureKey).setOrigin(0.5).setScrollFactor(0);
  }

  private disposeGeneratedTextures(): void {
    this.generatedTextureKeys.forEach((key) => {
      if (this.scene.textures.exists(key)) {
        this.scene.textures.remove(key);
      }
    });
    this.generatedTextureKeys.clear();
  }
}
