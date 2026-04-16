import Phaser from "phaser";

import type { UserSession } from "../../auth/types";
import { getGameAppContext } from "../appContext";
import { AudioSystem } from "../systems/AudioSystem";
import { BackgroundSystem, SPACE_BACKGROUND_PRESETS } from "../systems/BackgroundSystem";
import type { CompletedRunResult, GameOverPayload, GameStartPayload, PracticeScoreEntry } from "../types/game";
import { SCENE_KEYS } from "../types/scene";
import { MUSIC_KEYS, SFX_KEYS } from "../utils/audioKeys";
import { buildSessionPresentation, configureText, formatHighscoreDate } from "../utils/helpers";
import { GAME_TITLE, UI_COLORS } from "../utils/constants";
import { getViewportCenterX, getViewportHeight, getViewportWidth } from "../utils/viewport";

export class GameOverScene extends Phaser.Scene {
  private background?: BackgroundSystem;
  private backgroundOverlay?: Phaser.GameObjects.Rectangle;
  private restartKey?: Phaser.Input.Keyboard.Key;
  private menuKey?: Phaser.Input.Keyboard.Key;
  private audioSystem!: AudioSystem;
  private payload: GameOverPayload = {
    score: 0,
    wave: 1,
    session: {
      mode: "guest",
      displayName: "Гость",
      rankedEligible: false,
      isGuest: true
    }
  };
  private restartRequested = false;
  private readonly contentObjects: Phaser.GameObjects.GameObject[] = [];
  private rankedStatusText?: Phaser.GameObjects.Text;
  private rankedStatusMessage = "Проверяем сохранение результата...";
  private rankedStatusColor = "#9abed8";

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
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
  }

  public override update(time: number): void {
    this.background?.update(time);

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
    this.background = new BackgroundSystem(this, SPACE_BACKGROUND_PRESETS.gameOver);

    this.backgroundOverlay = this.add.rectangle(
      getViewportCenterX(this),
      getViewportHeight(this) * 0.5,
      getViewportWidth(this),
      getViewportHeight(this),
      0x10030a,
      0.52
    );

    this.layoutBackground();
  }

  private createContent(scores: PracticeScoreEntry[], session: UserSession): void {
    const viewportCenterX = getViewportCenterX(this);
    const viewportHeight = getViewportHeight(this);

    const title = this.trackObject(
      this.add
        .text(viewportCenterX, 72, "ПОРАЖЕНИЕ", {
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
        .text(viewportCenterX, 112, GAME_TITLE, {
          fontFamily: "Segoe UI, sans-serif",
          fontSize: "18px",
          color: "#f1b9c3"
        })
        .setOrigin(0.5)
    );

    this.trackObject(
      this.add
        .rectangle(viewportCenterX, 210, 520, 138, UI_COLORS.panel, 0.9)
        .setStrokeStyle(2, UI_COLORS.danger, 0.28)
    );

    this.trackObject(
      this.add
        .text(viewportCenterX, 170, `Итоговый счёт: ${this.payload.score}`, {
          fontFamily: "Segoe UI, sans-serif",
          fontSize: "28px",
          color: "#ffffff",
          fontStyle: "bold"
        })
        .setOrigin(0.5)
    );

    const sessionLabel = session.isGuest ? "Гость" : `${session.displayName} • Google`;
    this.trackObject(
      this.add
        .text(viewportCenterX, 208, `Волна: ${this.payload.wave} • Профиль: ${sessionLabel}`, {
          fontFamily: "Segoe UI, sans-serif",
          fontSize: "20px",
          color: "#f5c0cb"
        })
        .setOrigin(0.5)
    );

    const modeSummary = session.isGuest
      ? "Результат сохранён на этом устройстве."
      : "Результат сохранён и отправлен в онлайн-таблицу, если она доступна.";

    this.trackObject(
      this.add
        .text(viewportCenterX, 240, modeSummary, {
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
        .text(viewportCenterX, 272, this.rankedStatusMessage, {
          fontFamily: "Segoe UI, sans-serif",
          fontSize: "14px",
          color: this.rankedStatusColor,
          wordWrap: { width: 460 },
          align: "center"
        })
        .setOrigin(0.5)
    ) as Phaser.GameObjects.Text;

    this.trackObject(
      this.add
        .rectangle(viewportCenterX, 414, 620, 228, UI_COLORS.panel, 0.9)
        .setStrokeStyle(2, UI_COLORS.cyan, 0.22)
    );

    this.trackObject(
      this.add
        .text(viewportCenterX, 322, "Лучшие результаты", {
          fontFamily: "Segoe UI, sans-serif",
          fontSize: "26px",
          color: "#ffd76c",
          fontStyle: "bold"
        })
        .setOrigin(0.5)
    );

    scores.forEach((entry, index) => {
      const modeLabel = entry.rankedEligible ? "онлайн" : "локально";
      this.trackObject(
        this.add
          .text(
            viewportCenterX,
            360 + index * 30,
            `#${index + 1} — ${entry.score} очков • волна ${entry.wave} • ${entry.playerLabel} • ${modeLabel} • ${formatHighscoreDate(entry.date)}`,
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
        .text(viewportCenterX, viewportHeight - 28, "R — заново • Esc — в меню", {
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

    this.rankedStatusColor = color;
    this.rankedStatusMessage = outcome.message;
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

  private layoutBackground(): void {
    const viewportWidth = getViewportWidth(this);
    const viewportHeight = getViewportHeight(this);

    this.background?.resize();
    this.backgroundOverlay?.setPosition(getViewportCenterX(this), viewportHeight * 0.5).setSize(viewportWidth, viewportHeight);
  }

  private handleResize(): void {
    this.layoutBackground();
    this.destroyContent();
    this.createContent(getGameAppContext().resultsService.getPracticeScores(), getGameAppContext().authService.getSession());
  }

  private handleShutdown(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);

    if (this.restartKey) {
      this.input.keyboard?.removeKey(this.restartKey);
      this.restartKey = undefined;
    }

    if (this.menuKey) {
      this.input.keyboard?.removeKey(this.menuKey);
      this.menuKey = undefined;
    }

    this.destroyContent();
    this.background?.destroy();
    this.background = undefined;
    this.backgroundOverlay = undefined;
    this.restartRequested = false;
    this.rankedStatusText = undefined;
    this.rankedStatusMessage = "Проверяем сохранение результата...";
    this.rankedStatusColor = "#9abed8";
  }
}
