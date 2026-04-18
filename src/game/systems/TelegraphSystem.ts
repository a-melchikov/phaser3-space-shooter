import Phaser from "phaser";

import type { TelegraphSpec, VectorLike } from "../types/combat";
import { TEXTURE_KEYS } from "../utils/constants";

interface TelegraphHandle {
  destroy(): void;
}

class ManagedTelegraph implements TelegraphHandle {
  private destroyed = false;

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly objects: Phaser.GameObjects.GameObject[],
    private readonly cleanupEvent?: Phaser.Time.TimerEvent
  ) {}

  public destroy(): void {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;
    this.cleanupEvent?.remove(false);
    this.objects.forEach((object) => {
      this.scene.tweens.killTweensOf(object);
      object.destroy();
    });
    this.objects.length = 0;
  }
}

export class TelegraphSystem {
  private readonly active = new Set<ManagedTelegraph>();

  public constructor(private readonly scene: Phaser.Scene) {}

  public showAimLine(start: VectorLike, end: VectorLike, durationMs: number, color: number): TelegraphHandle {
    const line = this.scene.add.line(0, 0, start.x, start.y, end.x, end.y, color, 0.24)
      .setOrigin(0, 0)
      .setLineWidth(2, 2)
      .setDepth(16);
    const glow = this.scene.add.line(0, 0, start.x, start.y, end.x, end.y, color, 0.12)
      .setOrigin(0, 0)
      .setLineWidth(6, 6)
      .setDepth(15);

    this.scene.tweens.add({
      targets: [line, glow],
      alpha: { from: 0.2, to: 0.9 },
      duration: Math.max(140, Math.floor(durationMs * 0.45)),
      yoyo: true,
      repeat: -1
    });

    return this.track([glow, line], durationMs);
  }

  public showChargeRing(position: VectorLike, radius: number, durationMs: number, color: number): TelegraphHandle {
    const ring = this.scene.add.circle(position.x, position.y, radius, color, 0.08)
      .setStrokeStyle(2, color, 0.9)
      .setDepth(16);

    this.scene.tweens.add({
      targets: ring,
      scaleX: { from: 0.72, to: 1.08 },
      scaleY: { from: 0.72, to: 1.08 },
      alpha: { from: 0.9, to: 0.1 },
      duration: durationMs,
      ease: "Sine.easeOut"
    });

    return this.track([ring], durationMs);
  }

  public showImpactMarker(position: VectorLike, radius: number, durationMs: number, color: number): TelegraphHandle {
    const marker = this.scene.add.circle(position.x, position.y, radius, color, 0.12)
      .setStrokeStyle(2, color, 0.88)
      .setDepth(16);
    const inner = this.scene.add.circle(position.x, position.y, radius * 0.34, color, 0.18)
      .setDepth(17);

    this.scene.tweens.add({
      targets: marker,
      alpha: { from: 0.14, to: 0.86 },
      duration: Math.max(120, Math.floor(durationMs * 0.5)),
      yoyo: true,
      repeat: -1
    });

    return this.track([marker, inner], durationMs);
  }

  public showBeamLine(start: VectorLike, end: VectorLike, width: number, durationMs: number, color: number): TelegraphHandle {
    const distance = Phaser.Math.Distance.Between(start.x, start.y, end.x, end.y);
    const angle = Phaser.Math.Angle.Between(start.x, start.y, end.x, end.y);
    const rectangle = this.scene.add.rectangle(start.x, start.y, distance, width, color, 0.18)
      .setOrigin(0, 0.5)
      .setRotation(angle)
      .setDepth(16);
    const core = this.scene.add.rectangle(start.x, start.y, distance, Math.max(2, width * 0.26), color, 0.42)
      .setOrigin(0, 0.5)
      .setRotation(angle)
      .setDepth(17);

    this.scene.tweens.add({
      targets: [rectangle, core],
      alpha: { from: 0.2, to: 0.92 },
      duration: Math.max(160, Math.floor(durationMs * 0.45)),
      yoyo: true,
      repeat: -1
    });

    return this.track([rectangle, core], durationMs);
  }

  public showMuzzleFlash(position: VectorLike, durationMs: number, color: number, scale = 0.38): TelegraphHandle {
    const flash = this.scene.add.image(position.x, position.y, TEXTURE_KEYS.flash)
      .setTint(color)
      .setDepth(17)
      .setScale(scale)
      .setAlpha(0.9);

    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      scaleX: scale * 1.8,
      scaleY: scale * 1.8,
      duration: durationMs,
      ease: "Quad.easeOut"
    });

    return this.track([flash], durationMs);
  }

  public showTelegraph(spec: TelegraphSpec): TelegraphHandle | null {
    if (spec.kind === "aimLine" && spec.start && spec.end) {
      return this.showAimLine(spec.start, spec.end, spec.durationMs, spec.color);
    }

    if (spec.kind === "chargeRing" && spec.position && spec.radius !== undefined) {
      return this.showChargeRing(spec.position, spec.radius, spec.durationMs, spec.color);
    }

    if (spec.kind === "impactMarker" && spec.position && spec.radius !== undefined) {
      return this.showImpactMarker(spec.position, spec.radius, spec.durationMs, spec.color);
    }

    if (spec.kind === "beamLine" && spec.start && spec.end && spec.width !== undefined) {
      return this.showBeamLine(spec.start, spec.end, spec.width, spec.durationMs, spec.color);
    }

    if (spec.kind === "muzzleFlash" && spec.position) {
      return this.showMuzzleFlash(spec.position, spec.durationMs, spec.color, spec.radius ?? 0.38);
    }

    return null;
  }

  public clear(): void {
    this.active.forEach((handle) => handle.destroy());
    this.active.clear();
  }

  public destroy(): void {
    this.clear();
  }

  private track(objects: Phaser.GameObjects.GameObject[], durationMs: number): TelegraphHandle {
    const handle = new ManagedTelegraph(
      this.scene,
      objects,
      this.scene.time.delayedCall(durationMs, () => {
        handle.destroy();
        this.active.delete(handle);
      })
    );

    this.active.add(handle);
    return handle;
  }
}
