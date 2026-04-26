import Phaser from "phaser";

import { AudioSystem } from "../systems/AudioSystem";
import { addUiText, colorToHex, UI_THEME } from "../ui/theme";
import { SFX_KEYS } from "../utils/audioKeys";
import { getSafeAreaInsets } from "../utils/device";
import { getViewportHeight, getViewportWidth } from "../utils/viewport";

interface MobileActionButtonsOptions {
  onPausePressed: () => void;
  onPointerBlockChange?: (pointerId: number, blocked: boolean) => void;
}

interface ButtonBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class MobileActionButtons {
  private readonly root: Phaser.GameObjects.Container;
  private readonly background: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly hitArea: Phaser.GameObjects.Zone;
  private readonly blockedPointerIds = new Set<number>();
  private bounds: ButtonBounds = { x: 0, y: 0, width: 60, height: 60 };
  private pressed = false;

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly audioSystem: AudioSystem,
    private readonly options: MobileActionButtonsOptions
  ) {
    this.root = scene.add.container(0, 0).setDepth(UI_THEME.depth.hud + 12).setScrollFactor(0);
    this.background = scene.add.graphics();
    this.label = addUiText(scene, 0, -1, "||", "button", {
      color: colorToHex(UI_THEME.colors.text),
      fontSize: "22px"
    }).setOrigin(0.5);
    this.hitArea = scene.add.zone(0, 0, this.bounds.width, this.bounds.height).setRectangleDropZone(this.bounds.width, this.bounds.height);
    this.hitArea.setInteractive({ useHandCursor: true });
    this.root.add([this.background, this.label, this.hitArea]);

    this.hitArea.on("pointerdown", this.handlePointerDown, this);
    this.hitArea.on("pointerup", this.handlePointerUp, this);
    this.hitArea.on("pointerupoutside", this.handlePointerCancel, this);
    this.hitArea.on("pointerout", this.handlePointerOut, this);
    this.layout();
  }

  public layout(): void {
    const safeArea = getSafeAreaInsets();
    const viewportWidth = getViewportWidth(this.scene);
    const viewportHeight = getViewportHeight(this.scene);
    const portrait = viewportHeight > viewportWidth;
    const size = portrait ? 62 : 58;
    const margin = portrait ? 14 : 12;
    const x = viewportWidth - safeArea.right - margin - size * 0.5;
    const y = safeArea.top + margin + size * 0.5;

    this.bounds = { x, y, width: size, height: size };
    this.root.setPosition(x, y);
    this.hitArea.setSize(size, size).setRectangleDropZone(size, size);
    this.render();
  }

  public contains(pointer: Phaser.Input.Pointer): boolean {
    const halfWidth = this.bounds.width * 0.5;
    const halfHeight = this.bounds.height * 0.5;
    return (
      pointer.x >= this.bounds.x - halfWidth &&
      pointer.x <= this.bounds.x + halfWidth &&
      pointer.y >= this.bounds.y - halfHeight &&
      pointer.y <= this.bounds.y + halfHeight
    );
  }

  public isPointerBlocked(pointerId: number): boolean {
    return this.blockedPointerIds.has(pointerId);
  }

  public destroy(): void {
    this.hitArea.off("pointerdown", this.handlePointerDown, this);
    this.hitArea.off("pointerup", this.handlePointerUp, this);
    this.hitArea.off("pointerupoutside", this.handlePointerCancel, this);
    this.hitArea.off("pointerout", this.handlePointerOut, this);
    this.blockedPointerIds.forEach((pointerId) => {
      this.options.onPointerBlockChange?.(pointerId, false);
    });
    this.blockedPointerIds.clear();
    this.root.destroy(true);
  }

  private handlePointerDown(
    pointer: Phaser.Input.Pointer,
    _localX: number,
    _localY: number,
    event: Phaser.Types.Input.EventData
  ): void {
    event.stopPropagation();
    this.setPointerBlocked(pointer.id, true);
    this.pressed = true;
    this.audioSystem.unlock();
    this.render();
  }

  private handlePointerUp(
    pointer: Phaser.Input.Pointer,
    _localX: number,
    _localY: number,
    event: Phaser.Types.Input.EventData
  ): void {
    event.stopPropagation();
    this.setPointerBlocked(pointer.id, false);
    this.pressed = false;
    this.audioSystem.playSfx(SFX_KEYS.UI_CLICK);
    this.options.onPausePressed();
    this.render();
  }

  private handlePointerCancel(pointer: Phaser.Input.Pointer): void {
    this.setPointerBlocked(pointer.id, false);
    this.pressed = false;
    this.render();
  }

  private handlePointerOut(pointer: Phaser.Input.Pointer): void {
    if (!pointer.isDown) {
      this.setPointerBlocked(pointer.id, false);
      this.pressed = false;
      this.render();
    }
  }

  private setPointerBlocked(pointerId: number, blocked: boolean): void {
    if (blocked) {
      this.blockedPointerIds.add(pointerId);
    } else {
      this.blockedPointerIds.delete(pointerId);
    }

    this.options.onPointerBlockChange?.(pointerId, blocked);
  }

  private render(): void {
    const { width, height } = this.bounds;
    const radius = 18;
    const fillAlpha = this.pressed ? 0.9 : 0.74;

    this.background.clear();
    this.background.lineStyle(2, UI_THEME.colors.cyan, this.pressed ? 0.36 : 0.22);
    this.background.strokeRoundedRect(-width * 0.5, -height * 0.5, width, height, radius);
    this.background.fillStyle(this.pressed ? UI_THEME.colors.surface : UI_THEME.colors.panelStrong, fillAlpha);
    this.background.fillRoundedRect(-width * 0.5, -height * 0.5, width, height, radius);
    this.background.lineStyle(1, UI_THEME.colors.lineSoft, 0.16);
    this.background.strokeRoundedRect(-width * 0.5 + 3, -height * 0.5 + 3, width - 6, height - 6, radius - 4);
    this.label.setAlpha(this.pressed ? 1 : 0.88);
  }
}
