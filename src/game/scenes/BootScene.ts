import Phaser from "phaser";

import { PracticeScoreStore } from "../services/PracticeScoreStore";
import { SCENE_KEYS } from "../types/scene";
import { GAME_TITLE, WORLD_HEIGHT, WORLD_WIDTH } from "../utils/constants";
import { generateTextures } from "../utils/textureFactory";

export class BootScene extends Phaser.Scene {
  public constructor() {
    super(SCENE_KEYS.BOOT);
  }

  public create(): void {
    generateTextures(this);
    new PracticeScoreStore().migrateLegacyScores();

    this.registry.set("gameTitle", GAME_TITLE);
    this.registry.set("worldWidth", WORLD_WIDTH);
    this.registry.set("worldHeight", WORLD_HEIGHT);

    this.scene.start(SCENE_KEYS.MENU);
  }
}
