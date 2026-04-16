import Phaser from "phaser";

import { TEXTURE_KEYS } from "./constants";

function generateTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (graphics: Phaser.GameObjects.Graphics) => void
): void {
  if (scene.textures.exists(key)) {
    return;
  }

  const graphics = scene.add.graphics();
  draw(graphics);
  graphics.generateTexture(key, width, height);
  graphics.destroy();
}

export function generateTextures(scene: Phaser.Scene): void {
  generateTexture(scene, TEXTURE_KEYS.player, 64, 72, (graphics) => {
    graphics.clear();
    graphics.fillStyle(0x77a8ff, 1);
    graphics.beginPath();
    graphics.moveTo(32, 6);
    graphics.lineTo(58, 60);
    graphics.lineTo(32, 44);
    graphics.lineTo(6, 60);
    graphics.closePath();
    graphics.fillPath();

    graphics.fillStyle(0xdaf8ff, 1);
    graphics.beginPath();
    graphics.moveTo(32, 12);
    graphics.lineTo(42, 30);
    graphics.lineTo(32, 38);
    graphics.lineTo(22, 30);
    graphics.closePath();
    graphics.fillPath();

    graphics.fillStyle(0x6ef2ff, 0.85);
    graphics.fillRect(14, 52, 10, 8);
    graphics.fillRect(40, 52, 10, 8);
  });

  generateTexture(scene, TEXTURE_KEYS.shieldRing, 96, 96, (graphics) => {
    graphics.clear();
    graphics.lineStyle(4, 0xffd76c, 0.95);
    graphics.strokeCircle(48, 48, 34);
    graphics.lineStyle(2, 0xfff1a8, 0.55);
    graphics.strokeCircle(48, 48, 40);
  });

  generateTexture(scene, TEXTURE_KEYS.enemyBasic, 40, 40, (graphics) => {
    graphics.clear();
    graphics.fillStyle(0xff6b7a, 1);
    graphics.beginPath();
    graphics.moveTo(20, 4);
    graphics.lineTo(36, 22);
    graphics.lineTo(20, 36);
    graphics.lineTo(4, 22);
    graphics.closePath();
    graphics.fillPath();
  });

  generateTexture(scene, TEXTURE_KEYS.enemyFast, 36, 36, (graphics) => {
    graphics.clear();
    graphics.fillStyle(0xff9b74, 1);
    graphics.beginPath();
    graphics.moveTo(18, 3);
    graphics.lineTo(32, 18);
    graphics.lineTo(18, 33);
    graphics.lineTo(4, 18);
    graphics.closePath();
    graphics.fillPath();
  });

  generateTexture(scene, TEXTURE_KEYS.enemyHeavy, 56, 56, (graphics) => {
    graphics.clear();
    graphics.fillStyle(0xc96b54, 1);
    graphics.fillRoundedRect(8, 8, 40, 40, 6);
    graphics.fillStyle(0xffd59a, 1);
    graphics.fillRect(22, 18, 12, 18);
    graphics.fillStyle(0x72231c, 1);
    graphics.fillRect(14, 34, 28, 6);
  });

  generateTexture(scene, TEXTURE_KEYS.boss, 220, 120, (graphics) => {
    graphics.clear();
    graphics.fillStyle(0x7a2030, 1);
    graphics.beginPath();
    graphics.moveTo(18, 64);
    graphics.lineTo(52, 18);
    graphics.lineTo(168, 18);
    graphics.lineTo(202, 64);
    graphics.lineTo(186, 102);
    graphics.lineTo(34, 102);
    graphics.closePath();
    graphics.fillPath();

    graphics.fillStyle(0xca6874, 1);
    graphics.fillRoundedRect(54, 42, 112, 28, 10);
    graphics.fillStyle(0xffddb1, 1);
    graphics.fillRect(101, 42, 18, 24);

    graphics.fillStyle(0xff9c7a, 1);
    graphics.fillCircle(52, 82, 8);
    graphics.fillCircle(110, 82, 8);
    graphics.fillCircle(168, 82, 8);
  });

  generateTexture(scene, TEXTURE_KEYS.bulletPlayer, 12, 24, (graphics) => {
    graphics.clear();
    graphics.fillStyle(0x6ef2ff, 1);
    graphics.fillRoundedRect(3, 2, 6, 20, 3);
  });

  generateTexture(scene, TEXTURE_KEYS.bulletEnemy, 12, 24, (graphics) => {
    graphics.clear();
    graphics.fillStyle(0xff926c, 1);
    graphics.fillRoundedRect(3, 2, 6, 20, 3);
  });

  generateTexture(scene, TEXTURE_KEYS.powerHeal, 36, 36, (graphics) => {
    graphics.clear();
    graphics.fillStyle(0x79f7c1, 0.16);
    graphics.fillCircle(18, 18, 17);
    graphics.lineStyle(2, 0x79f7c1, 1);
    graphics.strokeCircle(18, 18, 16);
    graphics.lineStyle(3, 0x79f7c1, 1);
    graphics.lineBetween(10, 18, 26, 18);
    graphics.lineBetween(18, 10, 18, 26);
  });

  generateTexture(scene, TEXTURE_KEYS.powerDoubleShot, 36, 36, (graphics) => {
    graphics.clear();
    graphics.fillStyle(0x7db0ff, 0.16);
    graphics.fillCircle(18, 18, 17);
    graphics.lineStyle(2, 0x7db0ff, 1);
    graphics.strokeCircle(18, 18, 16);
    graphics.lineStyle(3, 0x7db0ff, 1);
    graphics.lineBetween(10, 11, 16, 18);
    graphics.lineBetween(10, 25, 16, 18);
    graphics.lineBetween(26, 11, 20, 18);
    graphics.lineBetween(26, 25, 20, 18);
  });

  generateTexture(scene, TEXTURE_KEYS.powerShield, 36, 36, (graphics) => {
    graphics.clear();
    graphics.fillStyle(0xffd76c, 0.16);
    graphics.fillCircle(18, 18, 17);
    graphics.lineStyle(2, 0xffd76c, 1);
    graphics.strokeCircle(18, 18, 16);
    graphics.lineStyle(3, 0xffd76c, 1);
    graphics.beginPath();
    graphics.moveTo(18, 8);
    graphics.lineTo(26, 12);
    graphics.lineTo(24, 24);
    graphics.lineTo(18, 28);
    graphics.lineTo(12, 24);
    graphics.lineTo(10, 12);
    graphics.closePath();
    graphics.strokePath();
  });

  generateTexture(scene, TEXTURE_KEYS.particle, 8, 8, (graphics) => {
    graphics.clear();
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(4, 4, 3);
  });

  generateTexture(scene, TEXTURE_KEYS.flash, 48, 48, (graphics) => {
    graphics.clear();
    graphics.fillStyle(0xffffff, 0.4);
    graphics.fillCircle(24, 24, 22);
  });
}
