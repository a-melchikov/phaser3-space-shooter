export const SCENE_KEYS = {
  BOOT: "boot-scene",
  MENU: "menu-scene",
  GAME: "game-scene",
  GAME_OVER: "game-over-scene"
} as const;

export type SceneKey = (typeof SCENE_KEYS)[keyof typeof SCENE_KEYS];
