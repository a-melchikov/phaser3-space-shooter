import Phaser from "phaser";

import type { InputController } from "./InputController";
import { createNeutralInputState, type PlayerInputState } from "./inputTypes";
import { MobileActionButtons } from "./MobileActionButtons";
import { TouchFollowController } from "./TouchFollowController";
import { AudioSystem } from "../systems/AudioSystem";

export class MobileInputController implements InputController {
  public readonly mode = "mobile" as const;

  private readonly state = createNeutralInputState(this.mode);
  private readonly blockedPointerIds = new Set<number>();
  private readonly touchFollow: TouchFollowController;
  private readonly actionButtons: MobileActionButtons;
  private pauseQueued = false;

  public constructor(
    private readonly scene: Phaser.Scene,
    audioSystem: AudioSystem
  ) {
    this.actionButtons = new MobileActionButtons(scene, audioSystem, {
      onPausePressed: () => {
        this.pauseQueued = true;
      },
      onPointerBlockChange: (pointerId, blocked) => {
        if (blocked) {
          this.blockedPointerIds.add(pointerId);
        } else {
          this.blockedPointerIds.delete(pointerId);
        }
      }
    });
    this.touchFollow = new TouchFollowController(scene, (pointer) =>
      this.blockedPointerIds.has(pointer.id) || this.actionButtons.contains(pointer)
    );
  }

  public update(_time: number, _delta: number): PlayerInputState {
    this.touchFollow.writeMovement(this.state.movement);
    this.state.firePressed = true;
    this.state.autoFire = true;
    this.state.pausePressed = this.pauseQueued;
    this.state.abilityPressed = null;
    this.pauseQueued = false;

    return this.state;
  }

  public resize(): void {
    this.actionButtons.layout();
  }

  public destroy(): void {
    this.touchFollow.destroy();
    this.actionButtons.destroy();
    this.blockedPointerIds.clear();
    this.pauseQueued = false;
  }
}
