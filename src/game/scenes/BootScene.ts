import Phaser from "phaser";

import { PracticeScoreStore } from "../services/PracticeScoreStore";
import { AudioSystem } from "../systems/AudioSystem";
import { SCENE_KEYS } from "../types/scene";
import { GAME_TITLE, WORLD_HEIGHT, WORLD_WIDTH } from "../utils/constants";
import { AUDIO_ASSETS } from "../utils/audioKeys";
import { generateTextures } from "../utils/textureFactory";

export class BootScene extends Phaser.Scene {
  public constructor() {
    super(SCENE_KEYS.BOOT);
  }

  public preload(): void {
    AudioSystem.bootstrap(this).loadSettings();

    AUDIO_ASSETS.forEach((asset) => {
      this.load.audio(asset.key, asset.urls);
    });
  }

  public create(): void {
    generateTextures(this);
    new PracticeScoreStore().migrateLegacyScores();

    this.registry.set("gameTitle", GAME_TITLE);
    this.registry.set("worldWidth", WORLD_WIDTH);
    this.registry.set("worldHeight", WORLD_HEIGHT);
    if ("fonts" in document) {
      void Promise.allSettled([
        document.fonts.load("700 32px Orbitron"),
        document.fonts.load("500 16px Orbitron")
      ]).finally(() => {
        this.scene.start(SCENE_KEYS.MENU);
      });
      return;
    }

    this.scene.start(SCENE_KEYS.MENU);
  }
}
