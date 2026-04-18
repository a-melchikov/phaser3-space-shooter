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

function generatePowerOrb(
  scene: Phaser.Scene,
  key: string,
  primaryColor: number,
  draw: (graphics: Phaser.GameObjects.Graphics) => void
): void {
  generateTexture(scene, key, 36, 36, (graphics) => {
    graphics.clear();
    graphics.fillStyle(primaryColor, 0.16);
    graphics.fillCircle(18, 18, 17);
    graphics.lineStyle(2, primaryColor, 1);
    graphics.strokeCircle(18, 18, 16);
    draw(graphics);
  });
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

  generateTexture(scene, TEXTURE_KEYS.enemySniper, 44, 44, (graphics) => {
    graphics.clear();
    graphics.fillStyle(0x4698b3, 1);
    graphics.fillRoundedRect(10, 8, 24, 28, 6);
    graphics.fillStyle(0xdaf8ff, 1);
    graphics.fillCircle(22, 20, 6);
    graphics.lineStyle(3, 0x6ef2ff, 1);
    graphics.lineBetween(34, 14, 42, 10);
  });

  generateTexture(scene, TEXTURE_KEYS.enemyKamikaze, 40, 44, (graphics) => {
    graphics.clear();
    graphics.fillStyle(0xff7f50, 1);
    graphics.beginPath();
    graphics.moveTo(20, 2);
    graphics.lineTo(36, 18);
    graphics.lineTo(28, 18);
    graphics.lineTo(28, 38);
    graphics.lineTo(12, 38);
    graphics.lineTo(12, 18);
    graphics.lineTo(4, 18);
    graphics.closePath();
    graphics.fillPath();
    graphics.fillStyle(0xffd9c2, 1);
    graphics.fillCircle(20, 16, 4);
  });

  generateTexture(scene, TEXTURE_KEYS.enemyMineLayer, 44, 44, (graphics) => {
    graphics.clear();
    graphics.fillStyle(0x2f8a71, 1);
    graphics.fillRoundedRect(8, 10, 28, 24, 8);
    graphics.fillStyle(0x79f7c1, 1);
    graphics.fillCircle(22, 22, 6);
    graphics.fillRect(2, 16, 8, 4);
    graphics.fillRect(34, 16, 8, 4);
    graphics.fillRect(2, 24, 8, 4);
    graphics.fillRect(34, 24, 8, 4);
  });

  generateTexture(scene, TEXTURE_KEYS.enemyTurret, 46, 46, (graphics) => {
    graphics.clear();
    graphics.fillStyle(0x6c53a9, 1);
    graphics.fillRoundedRect(8, 16, 30, 20, 6);
    graphics.fillStyle(0xd9c3ff, 1);
    graphics.fillCircle(23, 26, 8);
    graphics.fillRect(20, 4, 6, 16);
  });

  generateTexture(scene, TEXTURE_KEYS.enemyTank, 64, 60, (graphics) => {
    graphics.clear();
    graphics.fillStyle(0x9b6a39, 1);
    graphics.fillRoundedRect(8, 12, 48, 34, 8);
    graphics.fillStyle(0xffd76c, 1);
    graphics.fillRoundedRect(24, 18, 16, 16, 6);
    graphics.fillStyle(0x5a3115, 1);
    graphics.fillRect(12, 40, 40, 6);
    graphics.fillRect(30, 4, 4, 14);
  });

  generateTexture(scene, TEXTURE_KEYS.bossBulwark, 240, 132, (graphics) => {
    graphics.clear();
    graphics.fillStyle(0x7a2030, 1);
    graphics.fillRoundedRect(18, 28, 204, 76, 18);
    graphics.fillStyle(0xffa56b, 1);
    graphics.fillRoundedRect(88, 18, 64, 28, 10);
    graphics.fillRect(110, 4, 20, 28);
    graphics.fillStyle(0xffddb1, 1);
    graphics.fillCircle(58, 78, 10);
    graphics.fillCircle(120, 78, 10);
    graphics.fillCircle(182, 78, 10);
  });

  generateTexture(scene, TEXTURE_KEYS.bossBlink, 220, 128, (graphics) => {
    graphics.clear();
    graphics.fillStyle(0x103c62, 1);
    graphics.beginPath();
    graphics.moveTo(24, 76);
    graphics.lineTo(82, 20);
    graphics.lineTo(138, 20);
    graphics.lineTo(196, 76);
    graphics.lineTo(164, 108);
    graphics.lineTo(56, 108);
    graphics.closePath();
    graphics.fillPath();
    graphics.fillStyle(0x6ef2ff, 1);
    graphics.fillCircle(110, 60, 16);
    graphics.fillRect(68, 88, 84, 8);
  });

  generateTexture(scene, TEXTURE_KEYS.bossCarrier, 248, 138, (graphics) => {
    graphics.clear();
    graphics.fillStyle(0x2a5749, 1);
    graphics.fillRoundedRect(18, 20, 212, 90, 20);
    graphics.fillStyle(0x79f7c1, 1);
    graphics.fillCircle(70, 66, 18);
    graphics.fillCircle(178, 66, 18);
    graphics.fillRoundedRect(96, 36, 56, 42, 12);
    graphics.fillStyle(0xe4fff3, 1);
    graphics.fillRect(108, 48, 32, 12);
  });

  generateTexture(scene, TEXTURE_KEYS.bossPrism, 236, 136, (graphics) => {
    graphics.clear();
    graphics.fillStyle(0x4d2d7a, 1);
    graphics.fillRoundedRect(24, 24, 188, 88, 20);
    graphics.fillStyle(0xc39bff, 1);
    graphics.fillTriangle(118, 14, 160, 64, 76, 64);
    graphics.fillStyle(0xe7d9ff, 1);
    graphics.fillRect(86, 76, 64, 12);
    graphics.fillCircle(58, 88, 8);
    graphics.fillCircle(178, 88, 8);
  });

  generateTexture(scene, TEXTURE_KEYS.bossAegis, 240, 140, (graphics) => {
    graphics.clear();
    graphics.fillStyle(0x775b1f, 1);
    graphics.fillRoundedRect(28, 24, 184, 92, 18);
    graphics.fillStyle(0xffd76c, 1);
    graphics.strokeEllipse(120, 70, 120, 72);
    graphics.fillStyle(0xfff2bd, 1);
    graphics.fillCircle(120, 70, 20);
    graphics.fillRect(116, 20, 8, 100);
    graphics.fillRect(70, 66, 100, 8);
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

  generatePowerOrb(scene, TEXTURE_KEYS.powerHeal, 0x79f7c1, (graphics) => {
    graphics.lineStyle(3, 0x79f7c1, 1);
    graphics.lineBetween(10, 18, 26, 18);
    graphics.lineBetween(18, 10, 18, 26);
  });

  generatePowerOrb(scene, TEXTURE_KEYS.powerDoubleShot, 0x7db0ff, (graphics) => {
    graphics.lineStyle(3, 0x7db0ff, 1);
    graphics.lineBetween(10, 11, 16, 18);
    graphics.lineBetween(10, 25, 16, 18);
    graphics.lineBetween(26, 11, 20, 18);
    graphics.lineBetween(26, 25, 20, 18);
  });

  generatePowerOrb(scene, TEXTURE_KEYS.powerShield, 0xffd76c, (graphics) => {
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

  generatePowerOrb(scene, TEXTURE_KEYS.powerDamageBoost, 0xff8d5c, (graphics) => {
    graphics.lineStyle(3, 0xff8d5c, 1);
    graphics.lineBetween(18, 8, 12, 18);
    graphics.lineBetween(12, 18, 18, 18);
    graphics.lineBetween(18, 18, 14, 28);
    graphics.lineBetween(18, 8, 24, 18);
    graphics.lineBetween(24, 18, 18, 18);
  });

  generatePowerOrb(scene, TEXTURE_KEYS.powerSupportDrone, 0x79f7c1, (graphics) => {
    graphics.fillStyle(0x79f7c1, 1);
    graphics.fillCircle(18, 18, 5);
    graphics.fillTriangle(7, 18, 14, 12, 14, 24);
    graphics.fillTriangle(29, 18, 22, 12, 22, 24);
  });

  generateTexture(scene, TEXTURE_KEYS.mine, 40, 40, (graphics) => {
    graphics.clear();
    graphics.fillStyle(0xff7a7a, 0.92);
    graphics.fillCircle(20, 20, 10);
    graphics.fillStyle(0x5c1f25, 1);
    graphics.fillCircle(20, 20, 4);
    graphics.lineStyle(3, 0xffb36a, 1);
    for (let index = 0; index < 8; index += 1) {
      const angle = (Math.PI * 2 * index) / 8;
      graphics.lineBetween(
        20 + Math.cos(angle) * 12,
        20 + Math.sin(angle) * 12,
        20 + Math.cos(angle) * 17,
        20 + Math.sin(angle) * 17
      );
    }
  });

  generateTexture(scene, TEXTURE_KEYS.supportDrone, 42, 32, (graphics) => {
    graphics.clear();
    graphics.fillStyle(0x79f7c1, 1);
    graphics.fillTriangle(6, 20, 18, 8, 18, 24);
    graphics.fillTriangle(36, 20, 24, 8, 24, 24);
    graphics.fillCircle(21, 18, 7);
    graphics.fillStyle(0xdffff4, 1);
    graphics.fillCircle(21, 18, 3);
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
