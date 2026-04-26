import Phaser from "phaser";

import type { InputController } from "./InputController";
import { createNeutralInputState, type PlayerInputState } from "./inputTypes";

export class DesktopInputController implements InputController {
  public readonly mode = "desktop" as const;

  private readonly state = createNeutralInputState(this.mode);
  private readonly movementKeys: Phaser.Input.Keyboard.Key[];
  private readonly pauseKeys: Phaser.Input.Keyboard.Key[];
  private readonly fireKey: Phaser.Input.Keyboard.Key;

  public constructor(private readonly scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard;
    if (!keyboard) {
      throw new Error("Keyboard input is unavailable for desktop controls.");
    }

    this.movementKeys = [
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S)
    ];
    this.fireKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.pauseKeys = [
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC),
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P)
    ];
  }

  public update(_time: number, _delta: number): PlayerInputState {
    const [left, right, up, down, leftAlt, rightAlt, upAlt, downAlt] = this.movementKeys;
    const movement = this.state.movement;

    movement.axisX = (right.isDown || rightAlt.isDown ? 1 : 0) - (left.isDown || leftAlt.isDown ? 1 : 0);
    movement.axisY = (down.isDown || downAlt.isDown ? 1 : 0) - (up.isDown || upAlt.isDown ? 1 : 0);
    movement.hasTarget = false;
    movement.targetX = 0;
    movement.targetY = 0;

    this.state.firePressed = this.fireKey.isDown;
    this.state.autoFire = false;
    this.state.pausePressed = this.pauseKeys.some((key) => Phaser.Input.Keyboard.JustDown(key));
    this.state.abilityPressed = null;

    return this.state;
  }

  public resize(): void {
    // Keyboard input has no screen-space layout.
  }

  public destroy(): void {
    this.movementKeys.forEach((key) => {
      this.scene.input.keyboard?.removeKey(key);
    });
    this.scene.input.keyboard?.removeKey(this.fireKey);
    this.pauseKeys.forEach((key) => {
      this.scene.input.keyboard?.removeKey(key);
    });
  }
}
