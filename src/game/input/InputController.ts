import type { InputMode, PlayerInputState } from "./inputTypes";

export interface InputController {
  readonly mode: InputMode;
  update(time: number, delta: number): PlayerInputState;
  resize(): void;
  destroy(): void;
}
