import Phaser from "phaser";

import type { UserSession } from "../../auth/types";
import { getGameAppContext } from "../appContext";
import { AudioSystem } from "../systems/AudioSystem";
import type { CompletedRunResult, GameOverPayload, GameStartPayload, PracticeScoreEntry } from "../types/game";
import { SCENE_KEYS } from "../types/scene";
import { MUSIC_KEYS, SFX_KEYS } from "../utils/audioKeys";
import { buildSessionPresentation, configureText, formatHighscoreDate } from "../utils/helpers";
import { GAME_TITLE, TEXTURE_KEYS, UI_COLORS, WORLD_HEIGHT, WORLD_WIDTH } from "../utils/constants";

export class GameOverScene extends Phaser.Scene {
  private farBackground?: Phaser.GameObjects.TileSprite;
  private nearBackground?: Phaser.GameObjects.TileSprite;
  private restartKey?: Phaser.Input.Keyboard.Key;
  private menuKey?: Phaser.Input.Keyboard.Key;
  private audioSystem!: AudioSystem;
  private payload: GameOverPayload = {
    score: 0,
    wave: 1,
    session: {
      mode: "guest",
      displayName: "Р“РѕСЃС‚СЊ",
      rankedEligible: false,
      isGuest: true
    }
  };
  private restartRequested = false;
  private readonly contentObjects: Phaser.GameObjects.GameObject[] = [];
  private rankedStatusText?: Phaser.GameObjects.Text;

  public constructor() {
    super(SCENE_KEYS.GAME_OVER);
  }

  public init(data: GameOverPayload): void {
    this.payload = data;
  }

  public create(): void {
    this.audioSystem = AudioSystem.getInstance(this);
    this.audioSystem.stopAllSfx();
    this.audioSystem.playMusic(MUSIC_KEYS.GAME_OVER);

    const session = getGameAppContext().authService.getSession();
    const result: CompletedRunResult = {
      score: this.payload.score,
      wave: this.payload.wave,
      completedAt: new Date().toISOString()
    };

    const practiceScores = getGameAppContext().resultsService.recordPracticeResult(result, session);

    this.createBackground();
    this.createContent(practiceScores, session);
    void this.updateRankedStatus(result, session);

    this.restartKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this.menuKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
  }

  public override update(_: number, delta: number): void {
    this.farBackground?.setTilePosition(0, this.farBackground.tilePositionY + delta * 0.006);
    this.nearBackground?.setTilePosition(0, this.nearBackground.tilePositionY + delta * 0.016);

    if (!this.restartRequested && this.restartKey && Phaser.Input.Keyboard.JustDown(this.restartKey)) {
      this.restartRequested = true;
      this.audioSystem.unlock();
      this.audioSystem.playSfx(SFX_KEYS.UI_CLICK);

      const payload: GameStartPayload = {
        source: "gameover",
        session: buildSessionPresentation(getGameAppContext().authService.getSession())
      };
      this.scene.start(SCENE_KEYS.GAME, payload);
      return;
    }

    if (this.menuKey && Phaser.Input.Keyboard.JustDown(this.menuKey)) {
      this.audioSystem.unlock();
      this.audioSystem.playSfx(SFX_KEYS.UI_CLICK);
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

  private createContent(scores: PracticeScoreEntry[], session: UserSession): void {
    const title = this.trackObject(
      this.add
        .text(WORLD_WIDTH * 0.5, 72, "GAME OVER", {
          fontFamily: "Segoe UI, sans-serif",
          fontSize: "48px",
          color: "#ffdce2",
          fontStyle: "bold"
        })
        .setOrigin(0.5)
    );

    title.setShadow(0, 0, "#ff6b7a", 12, false, true);

    this.trackObject(
      this.add
        .text(WORLD_WIDTH * 0.5, 112, GAME_TITLE, {
          fontFamily: "Segoe UI, sans-serif",
          fontSize: "18px",
          color: "#f1b9c3"
        })
        .setOrigin(0.5)
    );

    this.trackObject(
      this.add
        .rectangle(WORLD_WIDTH * 0.5, 210, 520, 138, UI_COLORS.panel, 0.9)
        .setStrokeStyle(2, UI_COLORS.danger, 0.28)
    );

    this.trackObject(
      this.add
        .text(WORLD_WIDTH * 0.5, 170, `РС‚РѕРіРѕРІС‹Р№ СЃС‡С‘С‚: ${this.payload.score}`, {
          fontFamily: "Segoe UI, sans-serif",
          fontSize: "28px",
          color: "#ffffff",
          fontStyle: "bold"
        })
        .setOrigin(0.5)
    );

    const sessionLabel = session.isGuest ? "Р“РѕСЃС‚СЊ" : `${session.displayName} вЂў Google`;
    this.trackObject(
      this.add
        .text(WORLD_WIDTH * 0.5, 208, `Р’РѕР»РЅР°: ${this.payload.wave} вЂў РџСЂРѕС„РёР»СЊ: ${sessionLabel}`, {
          fontFamily: "Segoe UI, sans-serif",
          fontSize: "20px",
          color: "#f5c0cb"
        })
        .setOrigin(0.5)
    );

    const modeSummary = session.isGuest
      ? "Р“РѕСЃС‚РµРІРѕР№ РІС‹Р»РµС‚: СЂРµР·СѓР»СЊС‚Р°С‚ СЃРѕС…СЂР°РЅС‘РЅ С‚РѕР»СЊРєРѕ РІ Р»РѕРєР°Р»СЊРЅРѕР№ practice history."
      : "Google-РїСЂРѕС„РёР»СЊ: СЂРµР·СѓР»СЊС‚Р°С‚ СЃРѕС…СЂР°РЅС‘РЅ Р»РѕРєР°Р»СЊРЅРѕ Рё РїРѕРјРµС‡РµРЅ РєР°Рє ranked-eligible РґР»СЏ Р±СѓРґСѓС‰РµРіРѕ leaderboard backend.";

    this.trackObject(
      this.add
        .text(WORLD_WIDTH * 0.5, 240, modeSummary, {
          fontFamily: "Segoe UI, sans-serif",
          fontSize: "15px",
          color: session.isGuest ? "#ffd76c" : "#79f7c1",
          wordWrap: { width: 460 },
          align: "center"
        })
        .setOrigin(0.5)
    );

    this.rankedStatusText = this.trackObject(
      this.add
        .text(WORLD_WIDTH * 0.5, 272, "РџСЂРѕРІРµСЂСЏРµРј СЃС‚Р°С‚СѓСЃ ranked submission...", {
          fontFamily: "Segoe UI, sans-serif",
          fontSize: "14px",
          color: "#9abed8",
          wordWrap: { width: 460 },
          align: "center"
        })
        .setOrigin(0.5)
    ) as Phaser.GameObjects.Text;

    this.trackObject(
      this.add
        .rectangle(WORLD_WIDTH * 0.5, 414, 620, 228, UI_COLORS.panel, 0.9)
        .setStrokeStyle(2, UI_COLORS.cyan, 0.22)
    );

    this.trackObject(
      this.add
        .text(WORLD_WIDTH * 0.5, 322, "Р›РѕРєР°Р»СЊРЅР°СЏ РїСЂР°РєС‚РёРєР°", {
          fontFamily: "Segoe UI, sans-serif",
          fontSize: "26px",
          color: "#ffd76c",
          fontStyle: "bold"
        })
        .setOrigin(0.5)
    );

    scores.forEach((entry, index) => {
      const modeLabel = entry.rankedEligible ? "eligible" : "practice";
      this.trackObject(
        this.add
          .text(
            WORLD_WIDTH * 0.5,
            360 + index * 30,
            `#${index + 1} вЂ” ${entry.score} РѕС‡РєРѕРІ вЂў РІРѕР»РЅР° ${entry.wave} вЂў ${entry.playerLabel} вЂў ${modeLabel} вЂў ${formatHighscoreDate(entry.date)}`,
            {
              fontFamily: "Segoe UI, sans-serif",
              fontSize: "17px",
              color: index === 0 ? "#ffffff" : "#c9d8e5",
              wordWrap: { width: 560 },
              align: "center"
            }
          )
          .setOrigin(0.5)
      );
    });

    this.trackObject(
      this.add
        .text(WORLD_WIDTH * 0.5, WORLD_HEIGHT - 28, "R вЂ” Р·Р°РЅРѕРІРѕ вЂў Esc вЂ” РІРµСЂРЅСѓС‚СЊСЃСЏ РІ РјРµРЅСЋ", {
          fontFamily: "Segoe UI, sans-serif",
          fontSize: "18px",
          color: "#9abed8"
        })
        .setOrigin(0.5, 1)
    );
  }

  private async updateRankedStatus(result: CompletedRunResult, session: UserSession): Promise<void> {
    const outcome = await getGameAppContext().resultsService.submitRankedResult(result, session);

    if (!this.rankedStatusText || !this.rankedStatusText.active) {
      return;
    }

    const color =
      outcome.status === "failed"
        ? "#ff9eaa"
        : outcome.status === "unavailable"
          ? "#ffd76c"
          : outcome.status === "skipped"
            ? "#9abed8"
            : "#79f7c1";

    this.rankedStatusText.setColor(color);
    this.rankedStatusText.setText(outcome.message);
  }

  private trackObject<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.contentObjects.push(object);

    if (object instanceof Phaser.GameObjects.Text) {
      configureText(object);
    }

    return object;
  }

  private destroyContent(): void {
    while (this.contentObjects.length > 0) {
      this.contentObjects.pop()?.destroy();
    }
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

    this.destroyContent();
    this.farBackground = undefined;
    this.nearBackground = undefined;
    this.restartRequested = false;
    this.rankedStatusText = undefined;
  }
}
