import Phaser from "phaser";

import type { UserSession } from "../../auth/types";
import { getGameAppContext } from "../appContext";
import { AudioSystem } from "../systems/AudioSystem";
import { BackgroundSystem, SPACE_BACKGROUND_PRESETS } from "../systems/BackgroundSystem";
import type { CompletedRunResult, GameOverPayload, GameStartPayload, PracticeScoreEntry } from "../types/game";
import { SCENE_KEYS } from "../types/scene";
import { MUSIC_KEYS } from "../utils/audioKeys";
import { buildSessionPresentation, formatHighscoreDate } from "../utils/helpers";
import { GAME_TITLE } from "../utils/constants";
import { getViewportCenterX, getViewportHeight, getViewportWidth } from "../utils/viewport";
import { UI_THEME, addUiText, colorToHex, fadeScaleIn, isCompactViewport } from "../ui/theme";
import { UiButton, createAmbientOrb, createGlassPanel, type UiPanel } from "../ui/primitives";

interface DestroyableComponent {
  destroy(): void;
}

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
  private readonly components: DestroyableComponent[] = [];
  private rankedStatusText?: Phaser.GameObjects.Text;
  private rankedStatusMessage = "Проверяем сохранение результата...";
  private rankedStatusColor = colorToHex(UI_THEME.colors.textSoft);

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
    getGameAppContext().runStateStore.clear();

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
      this.startNewRun();
      return;
    }

    if (this.menuKey && Phaser.Input.Keyboard.JustDown(this.menuKey)) {
      this.scene.start(SCENE_KEYS.MENU);
    }
  }

  private createBackground(): void {
    this.cameras.main.setBackgroundColor("#0f0610");
    this.background = new BackgroundSystem(this, SPACE_BACKGROUND_PRESETS.gameOver);

    this.backgroundOverlay = this.add
      .rectangle(
        getViewportCenterX(this),
        getViewportHeight(this) * 0.5,
        getViewportWidth(this),
        getViewportHeight(this),
        0x09020a,
        0.46
      )
      .setDepth(1);

    this.layoutBackground();
  }

  private createContent(scores: PracticeScoreEntry[], session: UserSession): void {
    this.destroyContent();

    const viewportCenterX = getViewportCenterX(this);
    const viewportHeight = getViewportHeight(this);
    const viewportWidth = getViewportWidth(this);
    const compact = isCompactViewport(this);
    const cardWidth = Math.min(viewportWidth - 44, compact ? 472 : 560);

    this.trackObject(createAmbientOrb(this, viewportCenterX - 160, viewportHeight * 0.32, 260, 120, UI_THEME.colors.danger, 0.1, 2));
    this.trackObject(createAmbientOrb(this, viewportCenterX + 180, viewportHeight * 0.56, 320, 140, UI_THEME.colors.violet, 0.08, 2));

    const title = this.trackObject(
      addUiText(this, viewportCenterX, compact ? 68 : 82, "Поражение", "heroTitle", {
        fontSize: compact ? "36px" : "46px"
      })
        .setOrigin(0.5)
        .setDepth(UI_THEME.depth.menu + 4)
    );
    title.setShadow(0, 0, colorToHex(UI_THEME.colors.danger), 16, false, true);
    fadeScaleIn(this, title, { scaleFrom: 0.97, yOffset: 8 });

    const subtitle = this.trackObject(
      addUiText(this, viewportCenterX, compact ? 106 : 122, GAME_TITLE, "bodySoft", {
        color: colorToHex(UI_THEME.colors.textSoft)
      })
        .setOrigin(0.5)
        .setDepth(UI_THEME.depth.menu + 4)
    );
    fadeScaleIn(this, subtitle, { delay: 40, scaleFrom: 0.98, yOffset: 6 });

    const summaryPanel = this.trackComponent(
      createGlassPanel(this, {
        x: viewportCenterX,
        y: viewportHeight * (compact ? 0.39 : 0.37),
        width: cardWidth,
        height: 246,
        depth: UI_THEME.depth.menu + 2,
        fillColor: UI_THEME.colors.panelStrong,
        fillAlpha: 0.88,
        glowColor: UI_THEME.colors.danger,
        borderColor: UI_THEME.colors.danger
      })
    );
    this.populateSummaryPanel(summaryPanel, cardWidth, session);
    fadeScaleIn(this, summaryPanel.root, { delay: 80, scaleFrom: 0.97, yOffset: 12 });

    const leaderboardPanel = this.trackComponent(
      createGlassPanel(this, {
        x: viewportCenterX,
        y: viewportHeight * (compact ? 0.705 : 0.675),
        width: cardWidth,
        height: compact ? 224 : 238,
        depth: UI_THEME.depth.menu + 2,
        fillColor: UI_THEME.colors.panel,
        fillAlpha: 0.8,
        glowColor: UI_THEME.colors.violet,
        borderColor: UI_THEME.colors.lineSoft
      })
    );
    this.populateLeaderboardPanel(leaderboardPanel, cardWidth, scores);
    fadeScaleIn(this, leaderboardPanel.root, { delay: 120, scaleFrom: 0.98, yOffset: 10 });

    const restartButton = this.trackComponent(
      new UiButton(this, {
        x: viewportCenterX - 106,
        y: viewportHeight - (compact ? 66 : 60),
        width: 184,
        height: 44,
        label: "Играть снова",
        variant: "primary",
        depth: UI_THEME.depth.menu + 5,
        audioSystem: this.audioSystem,
        onClick: () => this.startNewRun()
      })
    );
    const menuButton = this.trackComponent(
      new UiButton(this, {
        x: viewportCenterX + 106,
        y: viewportHeight - (compact ? 66 : 60),
        width: 184,
        height: 40,
        label: "Главное меню",
        variant: "ghost",
        depth: UI_THEME.depth.menu + 5,
        audioSystem: this.audioSystem,
        onClick: () => this.scene.start(SCENE_KEYS.MENU)
      })
    );
    fadeScaleIn(this, restartButton.root, { delay: 150, scaleFrom: 0.99, yOffset: 6 });
    fadeScaleIn(this, menuButton.root, { delay: 170, scaleFrom: 0.99, yOffset: 6 });

    this.trackObject(
      addUiText(this, viewportCenterX, viewportHeight - 14, "R — заново   •   Esc — меню", "meta", {
        color: colorToHex(UI_THEME.colors.textMuted)
      })
        .setOrigin(0.5, 1)
        .setDepth(UI_THEME.depth.menu + 3)
    );
  }

  private populateSummaryPanel(panel: UiPanel, panelWidth: number, session: UserSession): void {
    const sessionLabel = session.isGuest ? "Гость" : `${session.displayName} • Google`;
    panel.content.add(addUiText(this, 0, 0, "Итоги сессии", "label").setOrigin(0, 0));
    panel.content.add(addUiText(this, 0, 26, `${this.payload.score} очков`, "heroTitle", {
      fontSize: "34px",
      color: colorToHex(UI_THEME.colors.text)
    }).setOrigin(0, 0));
    panel.content.add(addUiText(this, 0, 76, `Волна ${this.payload.wave} • ${sessionLabel}`, "bodySoft", {
      color: colorToHex(UI_THEME.colors.textSoft)
    }).setOrigin(0, 0));

    const modeSummary = session.isGuest
      ? "Результат сохранён локально на этом устройстве."
      : "Результат сохранён локально и отправляется в ranked-поток, если backend доступен.";

    panel.content.add(addUiText(this, 0, 110, modeSummary, "bodySoft", {
      wordWrap: { width: panelWidth - 48 },
      color: colorToHex(session.isGuest ? UI_THEME.colors.warning : UI_THEME.colors.success),
      lineSpacing: 5
    }).setOrigin(0, 0));

    this.rankedStatusText = this.trackObject(
      addUiText(this, panel.root.x - panelWidth * 0.5 + 24, panel.root.y + 78, this.rankedStatusMessage, "meta", {
        color: this.rankedStatusColor,
        wordWrap: { width: panelWidth - 48 }
      })
        .setOrigin(0, 0)
        .setDepth(UI_THEME.depth.menu + 4)
    ) as Phaser.GameObjects.Text;
  }

  private populateLeaderboardPanel(panel: UiPanel, panelWidth: number, scores: PracticeScoreEntry[]): void {
    const contentWidth = panelWidth - 48;
    panel.content.add(addUiText(this, 0, 0, "Лучшие локальные результаты", "sectionTitle", {
      fontSize: "22px"
    }).setOrigin(0, 0));
    panel.content.add(addUiText(this, 0, 30, "Последние лучшие матчи этой установки", "meta").setOrigin(0, 0));

    scores.slice(0, 5).forEach((entry, index) => {
      const rowY = 68 + index * 30;
      const row = this.add.container(0, rowY);
      const divider = this.add.graphics();
      divider.lineStyle(1, UI_THEME.colors.line, index === 0 ? 0.16 : 0.08);
      divider.lineBetween(0, 24, contentWidth, 24);

      const rank = addUiText(this, 0, 0, `#${index + 1}`, "label", {
        color: colorToHex(index === 0 ? UI_THEME.colors.warning : UI_THEME.colors.cyan)
      }).setOrigin(0, 0);
      const score = addUiText(this, 40, 0, `${entry.score} • волна ${entry.wave}`, "body", {
        fontSize: "14px"
      }).setOrigin(0, 0);
      const meta = addUiText(this, contentWidth, 0, `${this.truncateLabel(entry.playerLabel, 16)} • ${formatHighscoreDate(entry.date)}`, "meta", {
        align: "right"
      }).setOrigin(1, 0);

      row.add([divider, rank, score, meta]);
      panel.content.add(row);
    });
  }

  private async updateRankedStatus(result: CompletedRunResult, session: UserSession): Promise<void> {
    const outcome = await getGameAppContext().resultsService.submitRankedResult(result, session);

    if (!this.rankedStatusText || !this.rankedStatusText.active) {
      return;
    }

    const color =
      outcome.status === "failed"
        ? colorToHex(UI_THEME.colors.danger)
        : outcome.status === "unavailable"
          ? colorToHex(UI_THEME.colors.warning)
          : outcome.status === "skipped"
            ? colorToHex(UI_THEME.colors.textSoft)
            : colorToHex(UI_THEME.colors.success);

    this.rankedStatusColor = color;
    this.rankedStatusMessage = outcome.message;
    this.rankedStatusText.setColor(color);
    this.rankedStatusText.setText(outcome.message);
  }

  private startNewRun(): void {
    if (this.restartRequested) {
      return;
    }

    this.restartRequested = true;
    this.audioSystem.unlock();
    getGameAppContext().runStateStore.clear();

    const payload: GameStartPayload = {
      source: "gameover",
      session: buildSessionPresentation(getGameAppContext().authService.getSession())
    };
    this.scene.start(SCENE_KEYS.GAME, payload);
  }

  private truncateLabel(value: string, maxLength: number): string {
    if (value.length <= maxLength) {
      return value;
    }

    return `${value.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`;
  }

  private trackObject<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.contentObjects.push(object);
    return object;
  }

  private trackComponent<T extends DestroyableComponent>(component: T): T {
    this.components.push(component);
    return component;
  }

  private destroyContent(): void {
    while (this.components.length > 0) {
      this.components.pop()?.destroy();
    }

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
    this.rankedStatusColor = colorToHex(UI_THEME.colors.textSoft);
  }
}
