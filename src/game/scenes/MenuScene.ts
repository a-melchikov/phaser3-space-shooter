import Phaser from "phaser";

import { createGuestSession, type UserSession } from "../../auth/types";
import { getGameAppContext } from "../appContext";
import type { GameStartPayload, PracticeScoreEntry } from "../types/game";
import { SCENE_KEYS } from "../types/scene";
import { buildSessionPresentation, configureText, formatHighscoreDate } from "../utils/helpers";
import { GAME_TITLE, TEXTURE_KEYS, UI_COLORS, WORLD_HEIGHT, WORLD_WIDTH } from "../utils/constants";

export class MenuScene extends Phaser.Scene {
  private farBackground?: Phaser.GameObjects.TileSprite;
  private nearBackground?: Phaser.GameObjects.TileSprite;
  private enterKey?: Phaser.Input.Keyboard.Key;
  private spaceKey?: Phaser.Input.Keyboard.Key;
  private authUnsubscribe?: () => void;
  private readonly contentObjects: Phaser.GameObjects.GameObject[] = [];
  private session: UserSession = createGuestSession();
  private isStarting = false;
  private isAuthBusy = false;
  private authMessage = "";
  private authMessageColor = "#9abed8";

  public constructor() {
    super(SCENE_KEYS.MENU);
  }

  public create(): void {
    this.session = getGameAppContext().authService.getSession();
    this.createBackground();
    this.renderContent();

    this.enterKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.spaceKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.authUnsubscribe = getGameAppContext().authService.subscribe((session) => {
      this.session = session;
      this.isAuthBusy = false;
      this.renderContent();
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
  }

  public override update(_: number, delta: number): void {
    this.farBackground?.setTilePosition(0, this.farBackground.tilePositionY + delta * 0.008);
    this.nearBackground?.setTilePosition(0, this.nearBackground.tilePositionY + delta * 0.018);

    if (
      !this.isStarting &&
      !this.isAuthBusy &&
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

    this.add.rectangle(WORLD_WIDTH * 0.5, WORLD_HEIGHT * 0.5, WORLD_WIDTH, WORLD_HEIGHT, 0x040912, 0.22).setDepth(1);
  }

  private renderContent(): void {
    this.destroyContent();

    const practiceScores = getGameAppContext().resultsService.getPracticeScores();
    const googleAvailable = getGameAppContext().authService.isGoogleLoginAvailable();

    const title = this.trackObject(
      this.add
        .text(WORLD_WIDTH * 0.5, 66, GAME_TITLE, {
          fontFamily: "Segoe UI, sans-serif",
          fontSize: "44px",
          color: "#eaf7ff",
          fontStyle: "bold"
        })
        .setOrigin(0.5)
        .setDepth(3)
    );

    title.setShadow(0, 0, "#6ef2ff", 12, false, true);

    const subtitle = this.trackObject(
      this.add
        .text(WORLD_WIDTH * 0.5, 106, "Аркадный вылет с guest mode и Google auth foundation", {
          fontFamily: "Segoe UI, sans-serif",
          fontSize: "18px",
          color: "#9abed8"
        })
        .setOrigin(0.5)
        .setDepth(3)
    );

    subtitle.setShadow(0, 0, "#08111f", 8, false, true);

    this.createAuthPanel(182, 306, 300, 320, googleAvailable);
    this.createControlsPanel(480, 306, 248, 320);
    this.createPracticePanel(778, 306, 300, 320, practiceScores);

    const quickStart = this.trackObject(
      this.add
        .text(
          WORLD_WIDTH * 0.5,
          WORLD_HEIGHT - 28,
          "Enter / Space — начать игру текущим режимом. Гость играет полноценно, но остаётся вне ranked results.",
          {
            fontFamily: "Segoe UI, sans-serif",
            fontSize: "15px",
            color: "#8fb0c7",
            align: "center"
          }
        )
        .setOrigin(0.5, 1)
        .setDepth(3)
    );

    quickStart.setAlpha(0.94);
  }

  private createAuthPanel(centerX: number, centerY: number, width: number, height: number, googleAvailable: boolean): void {
    this.trackObject(
      this.add
        .rectangle(centerX, centerY, width, height, UI_COLORS.panel, 0.88)
        .setStrokeStyle(2, UI_COLORS.cyan, 0.22)
        .setDepth(2)
    );

    this.trackObject(
      this.add
        .text(centerX, centerY - 128, "Профиль", {
          fontFamily: "Segoe UI, sans-serif",
          fontSize: "26px",
          color: "#6ef2ff",
          fontStyle: "bold"
        })
        .setOrigin(0.5)
        .setDepth(3)
    );

    const profileStatus = this.session.isGuest
      ? "Гость"
      : `${this.session.displayName}${this.session.email ? ` • ${this.session.email}` : ""}`;

    this.trackObject(
      this.add
        .text(centerX - 112, centerY - 88, `Статус: ${profileStatus}`, {
          fontFamily: "Segoe UI, sans-serif",
          fontSize: "18px",
          color: "#eaf7ff",
          wordWrap: { width: 224 }
        })
        .setDepth(3)
    );

    const modeDescription = this.session.isGuest
      ? "Guest mode: можно играть сразу, а результаты попадают только в локальную practice history на этом устройстве."
      : "Google profile: результаты помечаются как ranked-eligible и готовы для будущей интеграции leaderboard backend.";

    this.trackObject(
      this.add
        .text(centerX - 112, centerY - 32, modeDescription, {
          fontFamily: "Segoe UI, sans-serif",
          fontSize: "15px",
          color: "#9abed8",
          wordWrap: { width: 224 },
          lineSpacing: 6
        })
        .setDepth(3)
    );

    const startLabel = this.session.isGuest ? "Играть как гость" : "Начать игру";
    this.createButton(centerX, centerY + 54, 228, 42, startLabel, !this.isAuthBusy, () => this.startGame(), "primary");

    if (this.session.isGuest) {
      const googleLabel = googleAvailable
        ? this.isAuthBusy
          ? "Вход через Google..."
          : "Войти через Google"
        : "Google login недоступен";
      this.createButton(
        centerX,
        centerY + 108,
        228,
        42,
        googleLabel,
        googleAvailable && !this.isAuthBusy,
        () => void this.handleGoogleSignIn(),
        "secondary"
      );
    } else {
      const signOutLabel = this.isAuthBusy ? "Выход..." : "Выйти в гостя";
      this.createButton(
        centerX,
        centerY + 108,
        228,
        42,
        signOutLabel,
        !this.isAuthBusy,
        () => void this.handleSignOut(),
        "secondary"
      );
    }

    const availabilityText = googleAvailable
      ? "Google login активируется через Firebase Authentication и восстанавливает сессию после reload."
      : "Для Google login добавьте Firebase env-переменные из .env.example и включите Google provider в Firebase Console.";

    this.trackObject(
      this.add
        .text(centerX - 112, centerY + 142, availabilityText, {
          fontFamily: "Segoe UI, sans-serif",
          fontSize: "13px",
          color: googleAvailable ? "#85d8ff" : "#ffd76c",
          wordWrap: { width: 224 },
          lineSpacing: 5
        })
        .setDepth(3)
    );

    if (this.authMessage.trim().length > 0) {
      this.trackObject(
        this.add
          .text(centerX - 112, centerY + 186, this.authMessage, {
            fontFamily: "Segoe UI, sans-serif",
            fontSize: "13px",
            color: this.authMessageColor,
            wordWrap: { width: 224 },
            lineSpacing: 5
          })
          .setDepth(3)
      );
    }
  }

  private createControlsPanel(centerX: number, centerY: number, width: number, height: number): void {
    this.trackObject(
      this.add
        .rectangle(centerX, centerY, width, height, UI_COLORS.panel, 0.88)
        .setStrokeStyle(2, UI_COLORS.cyan, 0.22)
        .setDepth(2)
    );

    this.trackObject(
      this.add
        .text(centerX, centerY - 128, "Управление", {
          fontFamily: "Segoe UI, sans-serif",
          fontSize: "26px",
          color: "#6ef2ff",
          fontStyle: "bold"
        })
        .setOrigin(0.5)
        .setDepth(3)
    );

    const lines = [
      "Стрелки — движение корабля",
      "Space — стрельба с cooldown",
      "P — пауза во время боя",
      "R — рестарт только после поражения",
      "Esc — возврат в меню с экрана Game Over"
    ];

    lines.forEach((line, index) => {
      this.trackObject(
        this.add
          .text(centerX - 92, centerY - 84 + index * 38, line, {
            fontFamily: "Segoe UI, sans-serif",
            fontSize: "17px",
            color: "#eaf7ff",
            wordWrap: { width: 188 }
          })
          .setDepth(3)
      );
    });

    this.trackObject(
      this.add
        .text(
          centerX - 92,
          centerY + 124,
          "Guest и Google играют в одну и ту же игру. Разница только в том, считается ли результат ranked-eligible.",
          {
            fontFamily: "Segoe UI, sans-serif",
            fontSize: "13px",
            color: "#9abed8",
            wordWrap: { width: 188 },
            lineSpacing: 5
          }
        )
        .setDepth(3)
    );
  }

  private createPracticePanel(
    centerX: number,
    centerY: number,
    width: number,
    height: number,
    scores: PracticeScoreEntry[]
  ): void {
    this.trackObject(
      this.add
        .rectangle(centerX, centerY, width, height, UI_COLORS.panel, 0.88)
        .setStrokeStyle(2, UI_COLORS.cyan, 0.22)
        .setDepth(2)
    );

    this.trackObject(
      this.add
        .text(centerX, centerY - 128, "Локальная практика", {
          fontFamily: "Segoe UI, sans-serif",
          fontSize: "26px",
          color: "#ffd76c",
          fontStyle: "bold"
        })
        .setOrigin(0.5)
        .setDepth(3)
    );

    this.trackObject(
      this.add
        .text(centerX, centerY - 96, "Это не leaderboard. Здесь только local practice history на устройстве.", {
          fontFamily: "Segoe UI, sans-serif",
          fontSize: "13px",
          color: "#9abed8",
          wordWrap: { width: 230 },
          align: "center"
        })
        .setOrigin(0.5, 0)
        .setDepth(3)
    );

    if (scores.length === 0) {
      this.trackObject(
        this.add
          .text(centerX, centerY - 6, "Пока нет локальных тренировочных результатов.", {
            fontFamily: "Segoe UI, sans-serif",
            fontSize: "16px",
            color: "#eaf7ff",
            wordWrap: { width: 220 },
            align: "center"
          })
          .setOrigin(0.5)
          .setDepth(3)
      );
      return;
    }

    scores.forEach((entry, index) => {
      const label = entry.rankedEligible ? "eligible" : "practice";
      this.trackObject(
        this.add
          .text(
            centerX - 116,
            centerY - 44 + index * 42,
            `#${index + 1}  ${entry.score} очков • волна ${entry.wave}\n${entry.playerLabel} • ${label} • ${formatHighscoreDate(entry.date)}`,
            {
              fontFamily: "Segoe UI, sans-serif",
              fontSize: "14px",
              color: index === 0 ? "#eaf7ff" : "#9abed8",
              lineSpacing: 4,
              wordWrap: { width: 232 }
            }
          )
          .setDepth(3)
      );
    });
  }

  private createButton(
    centerX: number,
    centerY: number,
    width: number,
    height: number,
    label: string,
    enabled: boolean,
    onClick: () => void,
    variant: "primary" | "secondary"
  ): void {
    const fillColor = variant === "primary" ? 0x164d62 : 0x22314b;
    const strokeColor = variant === "primary" ? UI_COLORS.cyan : UI_COLORS.gold;
    const alpha = enabled ? 0.96 : 0.42;

    const button = this.trackObject(
      this.add
        .rectangle(centerX, centerY, width, height, fillColor, alpha)
        .setStrokeStyle(2, strokeColor, enabled ? 0.45 : 0.2)
        .setDepth(4)
    ) as Phaser.GameObjects.Rectangle;

    const text = this.trackObject(
      this.add
        .text(centerX, centerY, label, {
          fontFamily: "Segoe UI, sans-serif",
          fontSize: "18px",
          color: enabled ? "#eaf7ff" : "#7e95aa",
          fontStyle: "bold",
          align: "center"
        })
        .setOrigin(0.5)
        .setDepth(5)
    );

    if (!enabled) {
      button.disableInteractive();
      text.setAlpha(0.85);
      return;
    }

    button.setInteractive({ useHandCursor: true });
    button.on("pointerover", () => button.setFillStyle(fillColor, 1));
    button.on("pointerout", () => button.setFillStyle(fillColor, alpha));
    button.on("pointerdown", onClick);
  }

  private startGame(): void {
    if (this.isStarting || this.isAuthBusy) {
      return;
    }

    this.isStarting = true;
    const payload: GameStartPayload = {
      source: "menu",
      session: buildSessionPresentation(this.session)
    };

    this.scene.start(SCENE_KEYS.GAME, payload);
  }

  private async handleGoogleSignIn(): Promise<void> {
    if (this.isAuthBusy) {
      return;
    }

    this.isAuthBusy = true;
    this.authMessage = "";
    this.renderContent();

    const result = await getGameAppContext().authService.signInWithGoogle();
    this.isAuthBusy = false;

    if (!result.ok) {
      this.authMessage = result.errorMessage || "Не удалось выполнить вход через Google.";
      this.authMessageColor = "#ff9eaa";
      this.renderContent();
      return;
    }

    this.session = result.session;
    this.authMessage = "Google-профиль активирован. Будущие результаты теперь помечаются как ranked-eligible.";
    this.authMessageColor = "#79f7c1";
    this.renderContent();
  }

  private async handleSignOut(): Promise<void> {
    if (this.isAuthBusy) {
      return;
    }

    this.isAuthBusy = true;
    this.authMessage = "";
    this.renderContent();

    const result = await getGameAppContext().authService.signOut();
    this.isAuthBusy = false;

    if (!result.ok) {
      this.authMessage = result.errorMessage || "Не удалось выйти из Google-профиля.";
      this.authMessageColor = "#ff9eaa";
      this.renderContent();
      return;
    }

    this.session = result.session;
    this.authMessage = "Профиль переключён в гостевой режим. Следующие результаты останутся только в локальной истории.";
    this.authMessageColor = "#ffd76c";
    this.renderContent();
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
    this.authUnsubscribe?.();
    this.authUnsubscribe = undefined;

    if (this.enterKey) {
      this.input.keyboard?.removeKey(this.enterKey);
      this.enterKey = undefined;
    }

    if (this.spaceKey) {
      this.input.keyboard?.removeKey(this.spaceKey);
      this.spaceKey = undefined;
    }

    this.destroyContent();
    this.farBackground = undefined;
    this.nearBackground = undefined;
    this.isStarting = false;
    this.isAuthBusy = false;
    this.authMessage = "";
  }
}
