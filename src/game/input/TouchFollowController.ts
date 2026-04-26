import Phaser from "phaser";

import type { MovementInput } from "./inputTypes";
import { getViewportHeight, getViewportWidth } from "../utils/viewport";

type PointerBlockPredicate = (pointer: Phaser.Input.Pointer) => boolean;

export class TouchFollowController {
  private activePointerId: number | null = null;
  private targetX = 0;
  private targetY = 0;

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly isPointerBlocked: PointerBlockPredicate
  ) {
    scene.input.on("pointerdown", this.handlePointerDown, this);
    scene.input.on("pointermove", this.handlePointerMove, this);
    scene.input.on("pointerup", this.handlePointerUp, this);
    scene.input.on("pointerupoutside", this.handlePointerUp, this);
  }

  public writeMovement(target: MovementInput): void {
    target.axisX = 0;
    target.axisY = 0;
    target.hasTarget = this.activePointerId !== null;
    target.targetX = this.targetX;
    target.targetY = this.targetY;
  }

  public destroy(): void {
    this.scene.input.off("pointerdown", this.handlePointerDown, this);
    this.scene.input.off("pointermove", this.handlePointerMove, this);
    this.scene.input.off("pointerup", this.handlePointerUp, this);
    this.scene.input.off("pointerupoutside", this.handlePointerUp, this);
    this.activePointerId = null;
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.activePointerId !== null || this.isPointerBlocked(pointer)) {
      return;
    }

    this.activePointerId = pointer.id;
    this.setTargetFromPointer(pointer);
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.activePointerId !== pointer.id) {
      return;
    }

    this.setTargetFromPointer(pointer);
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    if (this.activePointerId !== pointer.id) {
      return;
    }

    this.setTargetFromPointer(pointer);
    this.activePointerId = null;
  }

  private setTargetFromPointer(pointer: Phaser.Input.Pointer): void {
    this.targetX = Phaser.Math.Clamp(pointer.worldX, 0, getViewportWidth(this.scene));
    this.targetY = Phaser.Math.Clamp(pointer.worldY, 0, getViewportHeight(this.scene));
  }
}
