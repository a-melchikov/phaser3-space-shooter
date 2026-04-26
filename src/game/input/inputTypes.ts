export type InputMode = "desktop" | "mobile";

export type AbilityActionId = "special" | "bomb" | "ultimate";

export interface MovementInput {
  axisX: number;
  axisY: number;
  hasTarget: boolean;
  targetX: number;
  targetY: number;
}

export interface PlayerInputState {
  mode: InputMode;
  movement: MovementInput;
  firePressed: boolean;
  autoFire: boolean;
  pausePressed: boolean;
  abilityPressed: AbilityActionId | null;
}

export function createNeutralInputState(mode: InputMode): PlayerInputState {
  return {
    mode,
    movement: {
      axisX: 0,
      axisY: 0,
      hasTarget: false,
      targetX: 0,
      targetY: 0
    },
    firePressed: false,
    autoFire: false,
    pausePressed: false,
    abilityPressed: null
  };
}
