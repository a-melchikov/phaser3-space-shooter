import Phaser from "phaser";

import { HighscoreStore } from "../services/HighscoreStore";
import type { GameStartPayload, HighscoreEntry } from "../types/game";
import { SCENE_KEYS } from "../types/scene";
import { configureText, formatHighscoreDate } from "../utils/helpers";
import { GAME_TITLE, TEXTURE_KEYS, UI_COLORS, WORLD_HEIGHT, WORLD_WIDTH } from "../utils/constants";

export class MenuScene extends Phaser.Scene {
  private farBackground?: Phaser.GameObjects.TileSprite;
  private nearBackground?: Phaser.GameObjects.TileSprite;
  private enterKey?: Phaser.Input.Keyboard.Key;
  private spaceKey?: Phaser.Input.Keyboard.Key;
  private pointerHandler?: () => void;
  private isStarting = false;

  public constructor() {
    super(SCENE_KEYS.MENU);
  }

  public create(): void {
    this.createBackground();
    this.createContent(HighscoreStore.loadScores());
    this.refreshTextResolution();

    this.enterKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.spaceKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.pointerHandler = () => this.startGame();
    this.input.on("pointerdown", this.pointerHandler);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
  }

  public override update(_: number, delta: number): void {
    this.farBackground?.setTilePosition(0, this.farBackground.tilePositionY + delta * 0.008);
    this.nearBackground?.setTilePosition(0, this.nearBackground.tilePositionY + delta * 0.018);

    if (
      !this.isStarting &&
      ((this.enterKey && Phaser.Input.Keyboard.JustDown(this.enterKey)) ||
        (this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey)))
    ) {
      this.startGame();
    }
  }

  private createBackground(): void {
    this.cameras.main.setBackgroundColor("#030712");
    this.farBackground = this.add
      .tileSprite(0, 0, WORLD_WIDTH, WORLD_HEIGHT, TEXTURE_KEYS.backgroundFar)
      .setOrigin(0)
      .setAlpha(0.95);
    this.nearBackground = this.add
      .tileSprite(0, 0, WORLD_WIDTH, WORLD_HEIGHT, TEXTURE_KEYS.backgroundNear)
      .setOrigin(0)
      .setAlpha(0.75);

    this.add
      .rectangle(WORLD_WIDTH * 0.5, WORLD_HEIGHT * 0.5, WORLD_WIDTH, WORLD_HEIGHT, 0x040912, 0.22)
      .setDepth(1);
  }

  private createContent(scores: HighscoreEntry[]): void {
    const title = this.add
      .text(WORLD_WIDTH * 0.5, 80, GAME_TITLE, {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "46px",
        color: "#eaf7ff",
        fontStyle: "bold"
      })
      .setOrigin(0.5)
      .setDepth(2);

    const subtitle = this.add
      .text(WORLD_WIDTH * 0.5, 126, "Phaser 3 space shooter про оборону орбитального сектора", {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "18px",
        color: "#9abed8"
      })
      .setOrigin(0.5)
      .setDepth(2);

    title.setShadow(0, 0, "#6ef2ff", 12, false, true);
    subtitle.setShadow(0, 0, "#08111f", 8, false, true);

    this.add
      .rectangle(236, 284, 332, 260, UI_COLORS.panel, 0.84)
      .setStrokeStyle(2, UI_COLORS.cyan, 0.2)
      .setDepth(2);

    this.add
      .text(236, 182, "Управление", {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "24px",
        color: "#6ef2ff",
        fontStyle: "bold"
      })
      .setOrigin(0.5)
      .setDepth(3);

    const controls = [
      "Стрелки — движение",
      "Space — стрельба",
      "P — пауза",
      "R — рестарт только после поражения"
    ];

    controls.forEach((line, index) => {
      this.add
        .text(84, 220 + index * 38, line, {
          fontFamily: "Segoe UI, sans-serif",
          fontSize: "20px",
          color: "#eaf7ff"
        })
        .setDepth(3);
    });

    this.add
      .rectangle(716, 284, 360, 260, UI_COLORS.panel, 0.84)
      .setStrokeStyle(2, UI_COLORS.cyan, 0.2)
      .setDepth(2);

    this.add
      .text(716, 182, "Лучшие результаты", {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "24px",
        color: "#ffd76c",
        fontStyle: "bold"
      })
      .setOrigin(0.5)
      .setDepth(3);

    if (scores.length === 0) {
      this.add
        .text(716, 276, "Пока нет сохранённых результатов.", {
          fontFamily: "Segoe UI, sans-serif",
          fontSize: "18px",
          color: "#9abed8",
          align: "center"
        })
        .setOrigin(0.5)
        .setDepth(3);
    } else {
      scores.forEach((entry, index) => {
        this.add
          .text(
            560,
            224 + index * 38,
            `#${index + 1}  ${entry.score} очков  •  волна ${entry.wave}  •  ${formatHighscoreDate(entry.date)}`,
            {
              fontFamily: "Segoe UI, sans-serif",
              fontSize: "18px",
              color: index === 0 ? "#eaf7ff" : "#9abed8"
            }
          )
          .setDepth(3);
      });
    }

    const startHint = this.add
      .text(WORLD_WIDTH * 0.5, WORLD_HEIGHT - 70, "Нажмите Enter, Space или кликните мышью, чтобы начать", {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "22px",
        color: "#6ef2ff",
        fontStyle: "bold"
      })
      .setOrigin(0.5)
      .setDepth(3);

    this.tweens.add({
      targets: startHint,
      alpha: { from: 0.45, to: 1 },
      duration: 900,
      yoyo: true,
      repeat: -1
    });
  }

  private startGame(): void {
    if (this.isStarting) {
      return;
    }

    this.isStarting = true;
    const payload: GameStartPayload = { source: "menu" };
    this.scene.start(SCENE_KEYS.GAME, payload);
  }

  private refreshTextResolution(): void {
    this.children.list.forEach((object) => {
      if (object instanceof Phaser.GameObjects.Text) {
        configureText(object);
      }
    });
  }

  private handleShutdown(): void {
    if (this.pointerHandler) {
      this.input.off("pointerdown", this.pointerHandler);
      this.pointerHandler = undefined;
    }

    if (this.enterKey) {
      this.input.keyboard?.removeKey(this.enterKey);
      this.enterKey = undefined;
    }

    if (this.spaceKey) {
      this.input.keyboard?.removeKey(this.spaceKey);
      this.spaceKey = undefined;
    }

    this.farBackground = undefined;
    this.nearBackground = undefined;
    this.isStarting = false;
  }
}
