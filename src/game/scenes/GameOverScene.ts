import Phaser from "phaser";

import { HighscoreStore } from "../services/HighscoreStore";
import type { GameOverPayload, HighscoreEntry } from "../types/game";
import { SCENE_KEYS } from "../types/scene";
import { configureText, formatHighscoreDate } from "../utils/helpers";
import { GAME_TITLE, TEXTURE_KEYS, UI_COLORS, WORLD_HEIGHT, WORLD_WIDTH } from "../utils/constants";

export class GameOverScene extends Phaser.Scene {
  private farBackground?: Phaser.GameObjects.TileSprite;
  private nearBackground?: Phaser.GameObjects.TileSprite;
  private restartKey?: Phaser.Input.Keyboard.Key;
  private menuKey?: Phaser.Input.Keyboard.Key;
  private payload: GameOverPayload = { score: 0, wave: 1 };
  private restartRequested = false;

  public constructor() {
    super(SCENE_KEYS.GAME_OVER);
  }

  public init(data: GameOverPayload): void {
    this.payload = data;
  }

  public create(): void {
    const nextScores = HighscoreStore.saveScore({
      score: this.payload.score,
      wave: this.payload.wave,
      date: new Date().toISOString()
    });

    this.createBackground();
    this.createContent(nextScores);
    this.refreshTextResolution();

    this.restartKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this.menuKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
  }

  public override update(_: number, delta: number): void {
    this.farBackground?.setTilePosition(0, this.farBackground.tilePositionY + delta * 0.006);
    this.nearBackground?.setTilePosition(0, this.nearBackground.tilePositionY + delta * 0.016);

    if (!this.restartRequested && this.restartKey && Phaser.Input.Keyboard.JustDown(this.restartKey)) {
      this.restartRequested = true;
      this.scene.start(SCENE_KEYS.GAME, { source: "gameover" });
      return;
    }

    if (this.menuKey && Phaser.Input.Keyboard.JustDown(this.menuKey)) {
      this.scene.start(SCENE_KEYS.MENU);
    }
  }

  private createBackground(): void {
    this.cameras.main.setBackgroundColor("#16060d");
    this.farBackground = this.add
      .tileSprite(0, 0, WORLD_WIDTH, WORLD_HEIGHT, TEXTURE_KEYS.backgroundFar)
      .setOrigin(0)
      .setTint(0x9a3650);
    this.nearBackground = this.add
      .tileSprite(0, 0, WORLD_WIDTH, WORLD_HEIGHT, TEXTURE_KEYS.backgroundNear)
      .setOrigin(0)
      .setTint(0xc26f7c)
      .setAlpha(0.6);

    this.add.rectangle(WORLD_WIDTH * 0.5, WORLD_HEIGHT * 0.5, WORLD_WIDTH, WORLD_HEIGHT, 0x10030a, 0.52);
  }

  private createContent(scores: HighscoreEntry[]): void {
    this.add
      .text(WORLD_WIDTH * 0.5, 82, "GAME OVER", {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "52px",
        color: "#ffdce2",
        fontStyle: "bold"
      })
      .setOrigin(0.5)
      .setShadow(0, 0, "#ff6b7a", 12, false, true);

    this.add
      .text(WORLD_WIDTH * 0.5, 128, GAME_TITLE, {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "18px",
        color: "#f1b9c3"
      })
      .setOrigin(0.5);

    this.add
      .rectangle(WORLD_WIDTH * 0.5, 218, 420, 108, UI_COLORS.panel, 0.9)
      .setStrokeStyle(2, UI_COLORS.danger, 0.28);

    this.add
      .text(WORLD_WIDTH * 0.5, 186, `Итоговый счёт: ${this.payload.score}`, {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "28px",
        color: "#ffffff",
        fontStyle: "bold"
      })
      .setOrigin(0.5);

    this.add
      .text(WORLD_WIDTH * 0.5, 226, `Достигнутая волна: ${this.payload.wave}`, {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "22px",
        color: "#f5c0cb"
      })
      .setOrigin(0.5);

    this.add
      .text(WORLD_WIDTH * 0.5, 264, "R — начать заново, Esc — вернуться в меню", {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "18px",
        color: "#9abed8"
      })
      .setOrigin(0.5);

    this.add
      .rectangle(WORLD_WIDTH * 0.5, 415, 580, 210, UI_COLORS.panel, 0.88)
      .setStrokeStyle(2, UI_COLORS.cyan, 0.2);

    this.add
      .text(WORLD_WIDTH * 0.5, 332, "Топ-5 рекордов", {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "26px",
        color: "#ffd76c",
        fontStyle: "bold"
      })
      .setOrigin(0.5);

    scores.forEach((entry, index) => {
      this.add
        .text(
          WORLD_WIDTH * 0.5,
          372 + index * 28,
          `#${index + 1} — ${entry.score} очков • волна ${entry.wave} • ${formatHighscoreDate(entry.date)}`,
          {
            fontFamily: "Segoe UI, sans-serif",
            fontSize: "18px",
            color: index === 0 ? "#ffffff" : "#c9d8e5"
          }
        )
        .setOrigin(0.5);
    });
  }

  private refreshTextResolution(): void {
    this.children.list.forEach((object) => {
      if (object instanceof Phaser.GameObjects.Text) {
        configureText(object);
      }
    });
  }

  private handleShutdown(): void {
    if (this.restartKey) {
      this.input.keyboard?.removeKey(this.restartKey);
      this.restartKey = undefined;
    }

    if (this.menuKey) {
      this.input.keyboard?.removeKey(this.menuKey);
      this.menuKey = undefined;
    }

    this.farBackground = undefined;
    this.nearBackground = undefined;
    this.restartRequested = false;
  }
}
