import Phaser from "phaser";

export function getViewportWidth(scene: Phaser.Scene): number {
  return scene.scale.gameSize.width;
}

export function getViewportHeight(scene: Phaser.Scene): number {
  return scene.scale.gameSize.height;
}

export function getViewportCenterX(scene: Phaser.Scene): number {
  return getViewportWidth(scene) * 0.5;
}

export function getViewportCenterY(scene: Phaser.Scene): number {
  return getViewportHeight(scene) * 0.5;
}

export function getPlayerSpawnX(scene: Phaser.Scene): number {
  return getViewportCenterX(scene);
}

export function getPlayerSpawnY(scene: Phaser.Scene): number {
  return getViewportHeight(scene) * 0.84;
}
