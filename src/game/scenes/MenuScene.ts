import Phaser from "phaser";

import { createGuestSession, type UserSession } from "../../auth/types";
import { getGameAppContext } from "../appContext";
import { AudioSystem } from "../systems/AudioSystem";
import { BackgroundSystem, SPACE_BACKGROUND_PRESETS } from "../systems/BackgroundSystem";
import type { GameStartPayload, MenuLeaderboardSnapshot, PracticeScoreEntry } from "../types/game";
import type { ResumeMetadata } from "../types/runState";
import { SCENE_KEYS } from "../types/scene";
import { MUSIC_KEYS, SFX_KEYS } from "../utils/audioKeys";
import { buildSessionPresentation, formatHighscoreDate } from "../utils/helpers";
import { GAME_TITLE } from "../utils/constants";
import { getViewportCenterX, getViewportHeight, getViewportWidth } from "../utils/viewport";
import { AudioSettingsPanel } from "../ui/audioPanel";
import { UI_THEME, addUiText, colorToHex, fadeScaleIn, isCompactViewport } from "../ui/theme";
import { UiButton, createAmbientOrb, createGlassPanel, createScreenOverlay, type UiPanel } from "../ui/primitives";

interface DestroyableComponent {
  destroy(): void;
}

export class MenuScene extends Phaser.Scene {
  private background?: BackgroundSystem;
  private backgroundOverlay?: Phaser.GameObjects.Rectangle;
  private enterKey?: Phaser.Input.Keyboard.Key;
  private spaceKey?: Phaser.Input.Keyboard.Key;
  private escapeKey?: Phaser.Input.Keyboard.Key;
  private authUnsubscribe?: () => void;
  private readonly contentObjects: Phaser.GameObjects.GameObject[] = [];
  private readonly components: DestroyableComponent[] = [];
  private readonly settingsOverlayObjects: Phaser.GameObjects.GameObject[] = [];
  private readonly settingsOverlayComponents: DestroyableComponent[] = [];
  private audioSystem!: AudioSystem;
  private session: UserSession = createGuestSession();
  private isStarting = false;
  private isAuthBusy = false;
  private authMessage = "";
  private authMessageColor = colorToHex(UI_THEME.colors.textSoft);
  private isSettingsOpen = false;
  private resumeMetadata: ResumeMetadata | null = null;
  private leaderboardSnapshot: MenuLeaderboardSnapshot | null = null;
  private isLeaderboardLoading = false;
  private leaderboardRequestId = 0;

  public constructor() {
    super(SCENE_KEYS.MENU);
  }

  public create(): void {
    this.session = getGameAppContext().authService.getSession();
    this.resumeMetadata = getGameAppContext().runStateStore.getResumeMetadata();
    this.audioSystem = AudioSystem.getInstance(this);
    this.audioSystem.stopAllSfx();
    this.audioSystem.playMusic(MUSIC_KEYS.MENU);

    this.createBackground();
    this.renderContent();
    void this.refreshLeaderboardSnapshot();

    this.enterKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.spaceKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.escapeKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.input.on("pointerdown", this.handleFirstInteraction, this);
    this.input.keyboard?.on("keydown", this.handleFirstInteraction, this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);

    this.authUnsubscribe = getGameAppContext().authService.subscribe((session) => {
      this.session = session;
      this.isAuthBusy = false;
      this.resumeMetadata = getGameAppContext().runStateStore.getResumeMetadata();
      this.renderContent();
      void this.refreshLeaderboardSnapshot();
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
  }

  public override update(time: number): void {
    this.background?.update(time);

    if (this.isSettingsOpen && this.escapeKey && Phaser.Input.Keyboard.JustDown(this.escapeKey)) {
      this.closeSettingsOverlay();
      return;
    }

    if (
      !this.isStarting &&
      !this.isAuthBusy &&
      !this.isSettingsOpen &&
      ((this.enterKey && Phaser.Input.Keyboard.JustDown(this.enterKey)) ||
        (this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey)))
    ) {
      this.handleFirstInteraction();
      this.audioSystem.playSfx(SFX_KEYS.UI_CLICK);
      this.startGame(this.resumeMetadata ? "resume" : "new");
    }
  }

  private createBackground(): void {
    this.cameras.main.setBackgroundColor("#030712");
    this.background = new BackgroundSystem(this, SPACE_BACKGROUND_PRESETS.menu);

    this.backgroundOverlay = this.add
      .rectangle(
        getViewportCenterX(this),
        getViewportHeight(this) * 0.5,
        getViewportWidth(this),
        getViewportHeight(this),
        0x050a14,
        0.24
      )
      .setDepth(1);

    this.layoutBackground();
  }

  private renderContent(): void {
    this.destroyContent();

    const viewportCenterX = getViewportCenterX(this);
    const viewportHeight = getViewportHeight(this);
    const viewportWidth = getViewportWidth(this);
    const compact = isCompactViewport(this);
    const googleAvailable = getGameAppContext().authService.isGoogleLoginAvailable();
    const panelWidth = Math.min(viewportWidth - 48, compact ? 468 : 586);
    const actionPanelHeight = compact
      ? (this.resumeMetadata ? 336 : 286)
      : (this.resumeMetadata ? 372 : 320);
    const leaderboardHeight = compact ? 178 : 226;
    const footerHeight = compact ? 62 : 76;
    const stackGap = compact ? 10 : 12;
    const titleBlockHeight = compact ? 68 : 82;
    const actionPanelLift = compact ? 14 : 20;
    const totalHeight = titleBlockHeight + actionPanelHeight + leaderboardHeight + footerHeight + stackGap * 3;
    const startY = Math.max(compact ? 8 : 16, Math.round((viewportHeight - totalHeight) * 0.5) - (compact ? 10 : 12));
    const titleY = startY + (compact ? 8 : 10);
    const actionPanelY = startY + titleBlockHeight + stackGap + actionPanelHeight * 0.5 - actionPanelLift;
    const leaderboardY = actionPanelY + actionPanelHeight * 0.5 + stackGap + leaderboardHeight * 0.5 - actionPanelLift * 0.25;
    const footerY = leaderboardY + leaderboardHeight * 0.5 + stackGap + footerHeight * 0.5;

    this.trackObject(createAmbientOrb(this, viewportCenterX - panelWidth * 0.68, startY + 84, 180, 84, UI_THEME.colors.cyan, 0.04, 2));
    this.trackObject(createAmbientOrb(this, viewportCenterX + panelWidth * 0.58, leaderboardY - 132, 210, 96, UI_THEME.colors.violet, 0.035, 2));

    const title = this.trackObject(
      addUiText(this, viewportCenterX, titleY, GAME_TITLE, "heroTitle", {
        fontSize: compact ? "40px" : "50px",
        align: "center"
      })
        .setOrigin(0.5, 0)
        .setDepth(UI_THEME.depth.menu + 4)
    );
    title.setShadow(0, 0, colorToHex(UI_THEME.colors.cyan), 12, false, true);
    fadeScaleIn(this, title, { scaleFrom: 0.98, yOffset: 8 });

    const actionPanel = this.trackComponent(
      createGlassPanel(this, {
        x: viewportCenterX,
        y: actionPanelY,
        width: panelWidth,
        height: actionPanelHeight,
        depth: UI_THEME.depth.menu + 2,
        fillColor: UI_THEME.colors.panelStrong,
        fillAlpha: 0.78,
        borderColor: UI_THEME.colors.line,
        borderAlpha: 0.2,
        glowColor: UI_THEME.colors.cyan,
        glowStrength: 0.7,
        padding: compact ? 28 : 34,
        highlightAlpha: 0.022
      })
    );
    this.populateActionPanel(actionPanel, panelWidth, actionPanelHeight, compact, googleAvailable);
    fadeScaleIn(this, actionPanel.root, { delay: 65, scaleFrom: 0.985, yOffset: 10 });

    if (this.authMessage.trim().length > 0) {
      const authStatus = this.trackObject(
        addUiText(this, viewportCenterX, actionPanelY + actionPanelHeight * 0.5 + 10, this.authMessage, "meta", {
          color: this.authMessageColor,
          align: "center",
          wordWrap: { width: panelWidth - 24 }
        })
          .setOrigin(0.5, 0)
          .setDepth(UI_THEME.depth.menu + 4)
      );
      authStatus.setAlpha(0.96);
    }

    const leaderboardPanel = this.trackComponent(
      createGlassPanel(this, {
        x: viewportCenterX,
        y: leaderboardY,
        width: panelWidth,
        height: leaderboardHeight,
        depth: UI_THEME.depth.menu + 2,
        fillColor: UI_THEME.colors.panel,
        fillAlpha: 0.72,
        glowColor: UI_THEME.colors.violet,
        borderColor: UI_THEME.colors.lineSoft,
        borderAlpha: 0.16,
        glowStrength: 0.5,
        glowLayers: 1,
        padding: 22,
        highlightAlpha: 0.018
      })
    );
    this.populateOnlineLeaderboardPanel(leaderboardPanel, panelWidth, compact);
    fadeScaleIn(this, leaderboardPanel.root, { delay: 95, scaleFrom: 0.99, yOffset: 8 });

    const controlsPanel = this.trackComponent(
      createGlassPanel(this, {
        x: viewportCenterX,
        y: footerY,
        width: panelWidth,
        height: footerHeight,
        depth: UI_THEME.depth.menu + 2,
        fillColor: UI_THEME.colors.panel,
        fillAlpha: 0.6,
        glowColor: UI_THEME.colors.cyan,
        borderColor: UI_THEME.colors.line,
        borderAlpha: 0.12,
        glowStrength: 0.4,
        glowLayers: 1,
        padding: compact ? 12 : 16,
        highlightAlpha: 0.014
      })
    );
    this.populateControlsPanel(controlsPanel, panelWidth, compact);
    fadeScaleIn(this, controlsPanel.root, { delay: 125, scaleFrom: 0.995, yOffset: 6 });

    if (this.isSettingsOpen) {
      this.renderSettingsOverlay();
    }
  }

  private populateActionPanel(
    panel: UiPanel,
    panelWidth: number,
    panelHeight: number,
    compact: boolean,
    googleAvailable: boolean
  ): void {
    const innerPadding = compact ? 28 : 34;
    const contentWidth = panelWidth - innerPadding * 2;
    const localWidth = contentWidth;
    const actionWidth = Math.min(panelWidth - innerPadding * 2, compact ? 270 : 308);
    const secondaryLabel = this.resolveSecondaryActionLabel(googleAvailable);
    const hasResume = this.resumeMetadata !== null;
    const panelTop = panel.root.y - panelHeight * 0.5;
    const leftX = panel.root.x - panelWidth * 0.5 + innerPadding;
    const actionBaseY = compact
      ? (hasResume ? panel.root.y + 12 : panel.root.y + 8)
      : (hasResume ? panel.root.y + 22 : panel.root.y + 16);
    const headerTop = 0;
    const nameTop = compact ? 26 : 30;
    const sublineTop = compact ? 58 : 66;
    const dividerY = compact ? 88 : 96;
    const bodyTop = compact ? 98 : 110;

    panel.content.add(
      addUiText(this, 0, headerTop, "ПРОФИЛЬ", "label", {
        color: colorToHex(UI_THEME.colors.cyan)
      }).setOrigin(0, 0)
    );

    panel.content.add(
      addUiText(this, localWidth, headerTop, this.resolveRankedStateText(), "meta", {
        color: colorToHex(this.session.rankedEligible ? UI_THEME.colors.success : UI_THEME.colors.textSoft),
        align: "right"
      }).setOrigin(1, 0)
    );

    panel.content.add(
      addUiText(this, 0, nameTop, this.resolveProfileHeadline(), "sectionTitle", {
        fontSize: compact ? "20px" : "22px",
        color: colorToHex(UI_THEME.colors.text)
      }).setOrigin(0, 0)
    );

    panel.content.add(
      addUiText(this, 0, sublineTop, this.resolveProfileSubline(), "meta", {
        color: colorToHex(UI_THEME.colors.textSoft),
        wordWrap: { width: localWidth }
      }).setOrigin(0, 0)
    );

    const divider = this.add.graphics();
    divider.lineStyle(1, UI_THEME.colors.line, 0.08);
    divider.lineBetween(0, dividerY, localWidth, dividerY);
    panel.content.add(divider);

    panel.content.add(
      addUiText(this, 0, bodyTop, this.resolveModeDescription(googleAvailable), "bodySoft", {
        color: colorToHex(UI_THEME.colors.textSoft),
        lineSpacing: 6,
        wordWrap: { width: localWidth }
      }).setOrigin(0, 0)
    );

    const continueButton = hasResume
      ? this.trackComponent(
        new UiButton(this, {
          x: panel.root.x,
          y: actionBaseY - (compact ? 44 : 52),
          width: actionWidth,
          height: compact ? 54 : 58,
          subtitle: this.resumeMetadata ? this.formatResumeButtonSubtitle(this.resumeMetadata) : undefined,
          label: "Продолжить",
          variant: "primary",
          depth: UI_THEME.depth.menu + 6,
          audioSystem: this.audioSystem,
          enabled: !this.isAuthBusy,
          onClick: () => this.startGame("resume")
        })
      )
      : undefined;

    const primaryButton = this.trackComponent(
      new UiButton(this, {
        x: panel.root.x,
        y: actionBaseY + (hasResume ? (compact ? 12 : 14) : 0),
        width: actionWidth,
        height: compact ? 42 : 46,
        label: "Начать игру",
        variant: "primary",
        depth: UI_THEME.depth.menu + 6,
        audioSystem: this.audioSystem,
        enabled: !this.isAuthBusy,
        onClick: () => this.startGame("new")
      })
    );

    const secondaryButton = this.trackComponent(
      new UiButton(this, {
        x: panel.root.x,
        y: actionBaseY + (compact ? 42 : 50) + (hasResume ? (compact ? 12 : 14) : 0),
        width: actionWidth,
        height: compact ? 36 : 38,
        label: secondaryLabel,
        variant: "secondary",
        depth: UI_THEME.depth.menu + 6,
        audioSystem: this.audioSystem,
        enabled: this.isSecondaryActionEnabled(googleAvailable),
        onClick: () => {
          if (this.session.isGuest) {
            void this.handleGoogleSignIn();
            return;
          }

          void this.handleSignOut();
        }
      })
    );

    const settingsButton = this.trackComponent(
      new UiButton(this, {
        x: panel.root.x,
        y: actionBaseY + (compact ? 82 : 96) + (hasResume ? (compact ? 12 : 14) : 0),
        width: actionWidth,
        height: 32,
        label: "Настройки звука",
        variant: "ghost",
        depth: UI_THEME.depth.menu + 6,
        audioSystem: this.audioSystem,
        onClick: () => {
          if (this.isSettingsOpen) {
            this.closeSettingsOverlay();
            return;
          }

          this.openSettingsOverlay();
        }
      })
    );

    if (hasResume) {
      primaryButton.setLabel("Новая игра");
    }

    if (continueButton) {
      fadeScaleIn(this, continueButton.root, { delay: 90, scaleFrom: 0.99, yOffset: 5 });
    }
    fadeScaleIn(this, primaryButton.root, { delay: continueButton ? 108 : 90, scaleFrom: 0.99, yOffset: 5 });
    fadeScaleIn(this, secondaryButton.root, { delay: continueButton ? 126 : 110, scaleFrom: 0.995, yOffset: 5 });
    fadeScaleIn(this, settingsButton.root, { delay: continueButton ? 144 : 130, scaleFrom: 0.995, yOffset: 4 });

    const helper = this.trackObject(
      addUiText(this, leftX + contentWidth * 0.5, panelTop + panelHeight - (compact ? 14 : 18), this.resolveActionHint(googleAvailable), "meta", {
        color: colorToHex(UI_THEME.colors.textMuted),
        align: "center",
        wordWrap: { width: panelWidth - innerPadding * 2 }
      })
        .setOrigin(0.5, 1)
        .setDepth(UI_THEME.depth.menu + 4)
    );
    helper.setAlpha(0.9);
  }

  private populateLeaderboardPanel(
    panel: UiPanel,
    panelWidth: number,
    compact: boolean,
    scores: PracticeScoreEntry[]
  ): void {
    const contentWidth = panelWidth - 44;
    panel.content.add(
      addUiText(this, 0, 0, "Локальный leaderboard", "sectionTitle", {
        fontSize: compact ? "20px" : "22px"
      }).setOrigin(0, 0)
    );
    panel.content.add(
      addUiText(this, 0, 28, "Лучшие забеги на этом устройстве", "meta", {
        color: colorToHex(UI_THEME.colors.textMuted)
      }).setOrigin(0, 0)
    );

    if (scores.length === 0) {
      panel.content.add(
        addUiText(this, 0, 76, "Пока пусто. Сыграйте первый матч, и здесь появятся лучшие результаты.", "bodySoft", {
          wordWrap: { width: contentWidth }
        }).setOrigin(0, 0)
      );
      return;
    }

    if (compact) {
      this.populateCompactLeaderboard(panel, contentWidth, scores);
      return;
    }

    const headerY = 60;
    const rowHeight = 38;
    const columns = {
      rank: 0,
      score: 50,
      wave: 172,
      player: 244,
      date: contentWidth
    };

    const headerDivider = this.add.graphics();
    headerDivider.lineStyle(1, UI_THEME.colors.lineSoft, 0.08);
    headerDivider.lineBetween(0, headerY + 20, contentWidth, headerY + 20);
    panel.content.add(headerDivider);

    panel.content.add(addUiText(this, columns.rank, headerY, "RANK", "meta", {
      color: colorToHex(UI_THEME.colors.textMuted)
    }).setOrigin(0, 0));
    panel.content.add(addUiText(this, columns.score, headerY, "SCORE", "meta", {
      color: colorToHex(UI_THEME.colors.textMuted)
    }).setOrigin(0, 0));
    panel.content.add(addUiText(this, columns.wave, headerY, "WAVE", "meta", {
      color: colorToHex(UI_THEME.colors.textMuted)
    }).setOrigin(0, 0));
    panel.content.add(addUiText(this, columns.player, headerY, "PLAYER", "meta", {
      color: colorToHex(UI_THEME.colors.textMuted)
    }).setOrigin(0, 0));
    panel.content.add(addUiText(this, columns.date, headerY, "DATE", "meta", {
      color: colorToHex(UI_THEME.colors.textMuted),
      align: "right"
    }).setOrigin(1, 0));

    scores.slice(0, 3).forEach((entry, index) => {
      const rowY = headerY + 28 + index * rowHeight;
      const rowBackground = this.add.graphics();
      rowBackground.fillStyle(index === 0 ? UI_THEME.colors.surface : UI_THEME.colors.panelStrong, index === 0 ? 0.2 : 0.12);
      rowBackground.fillRoundedRect(-8, rowY - 8, contentWidth + 16, 32, 12);
      rowBackground.lineStyle(1, index === 0 ? UI_THEME.colors.warning : UI_THEME.colors.lineSoft, index === 0 ? 0.08 : 0.035);
      rowBackground.strokeRoundedRect(-8, rowY - 8, contentWidth + 16, 32, 12);
      panel.content.add(rowBackground);

      panel.content.add(
        addUiText(this, columns.rank, rowY, `#${index + 1}`, "label", {
          color: colorToHex(index === 0 ? UI_THEME.colors.warning : UI_THEME.colors.cyan)
        }).setOrigin(0, 0)
      );
      panel.content.add(
        addUiText(this, columns.score, rowY, String(entry.score), "body", {
          fontStyle: index === 0 ? "700" : "500",
          color: colorToHex(UI_THEME.colors.text)
        }).setOrigin(0, 0)
      );
      panel.content.add(addUiText(this, columns.wave, rowY, String(entry.wave), "bodySoft", {
        color: colorToHex(UI_THEME.colors.textSoft)
      }).setOrigin(0, 0));
      panel.content.add(
        addUiText(this, columns.player, rowY, this.resolveLeaderboardPlayer(entry), "meta", {
          color: colorToHex(UI_THEME.colors.textSoft)
        }).setOrigin(0, 0)
      );
      panel.content.add(
        addUiText(this, columns.date, rowY, formatHighscoreDate(entry.date), "meta", {
          color: colorToHex(UI_THEME.colors.textMuted),
          align: "right"
        }).setOrigin(1, 0)
      );
    });
  }

  private populateCompactLeaderboard(panel: UiPanel, contentWidth: number, scores: PracticeScoreEntry[]): void {
    const rowHeight = 44;
    scores.slice(0, 3).forEach((entry, index) => {
      const rowY = 62 + index * rowHeight;
      const rowBackground = this.add.graphics();
      rowBackground.fillStyle(index === 0 ? UI_THEME.colors.surface : UI_THEME.colors.panelStrong, index === 0 ? 0.2 : 0.12);
      rowBackground.fillRoundedRect(-6, rowY - 6, contentWidth + 12, 36, 12);
      panel.content.add(rowBackground);

      panel.content.add(
        addUiText(this, 0, rowY, `#${index + 1}`, "label", {
          color: colorToHex(index === 0 ? UI_THEME.colors.warning : UI_THEME.colors.cyan)
        }).setOrigin(0, 0)
      );
      panel.content.add(
        addUiText(this, 34, rowY, String(entry.score), "body", {
          fontStyle: index === 0 ? "700" : "500",
          color: colorToHex(UI_THEME.colors.text)
        }).setOrigin(0, 0)
      );
      panel.content.add(
        addUiText(this, 114, rowY, `W${entry.wave}`, "meta", {
          color: colorToHex(UI_THEME.colors.textSoft)
        }).setOrigin(0, 0)
      );
      panel.content.add(
        addUiText(this, contentWidth, rowY, formatHighscoreDate(entry.date), "meta", {
          color: colorToHex(UI_THEME.colors.textMuted),
          align: "right"
        }).setOrigin(1, 0)
      );
      panel.content.add(
        addUiText(this, 34, rowY + 19, this.resolveLeaderboardPlayer(entry, 22), "meta", {
          color: colorToHex(UI_THEME.colors.textMuted)
        }).setOrigin(0, 0)
      );
    });
  }

  private resolveLeaderboardPlayer(entry: PracticeScoreEntry, maxLength = 18): string {
    const modeLabel = entry.rankedEligible ? "online" : "local";
    return `${this.truncateLabel(entry.playerLabel, maxLength)} • ${modeLabel}`;
  }

  private populateOnlineLeaderboardPanel(panel: UiPanel, panelWidth: number, compact: boolean): void {
    const snapshot = this.leaderboardSnapshot;
    const contentWidth = panelWidth - 44;
    const isFallback = snapshot?.mode === "fallback";

    panel.content.add(
      addUiText(
        this,
        0,
        0,
        snapshot ? (isFallback ? "Локальный backup leaderboard" : "Глобальный leaderboard") : "Загрузка leaderboard",
        "sectionTitle",
        {
          fontSize: compact ? "20px" : "22px"
        }
      ).setOrigin(0, 0)
    );
    panel.content.add(
      addUiText(
        this,
        0,
        28,
        snapshot
          ? (isFallback ? "Показываем лучшие забеги на этом устройстве" : "Общий онлайн-рейтинг всех пилотов")
          : "Подключаемся к online-таблице",
        "meta",
        {
          color: colorToHex(UI_THEME.colors.textMuted)
        }
      ).setOrigin(0, 0)
    );
    panel.content.add(
      addUiText(this, contentWidth, 4, this.resolveLeaderboardStatusLabel(snapshot), "meta", {
        color: colorToHex(this.resolveLeaderboardStatusColor(snapshot)),
        align: "right"
      }).setOrigin(1, 0)
    );

    if (!snapshot) {
      panel.content.add(
        addUiText(this, 0, 82, "Загружаем глобальный рейтинг и ваш онлайн-статус...", "bodySoft", {
          wordWrap: { width: contentWidth }
        }).setOrigin(0, 0)
      );
      return;
    }

    const personalCardY = compact ? 62 : 60;
    const personalCardHeight = compact ? 52 : 58;
    const personalCard = this.add.graphics();
    personalCard.fillStyle(
      snapshot.playerProfile ? UI_THEME.colors.surface : UI_THEME.colors.panelStrong,
      snapshot.playerProfile ? 0.22 : 0.16
    );
    personalCard.fillRoundedRect(0, personalCardY, contentWidth, personalCardHeight, 14);
    personalCard.lineStyle(1, snapshot.playerProfile ? UI_THEME.colors.cyan : UI_THEME.colors.lineSoft, 0.1);
    personalCard.strokeRoundedRect(0, personalCardY, contentWidth, personalCardHeight, 14);
    panel.content.add(personalCard);

    panel.content.add(
      addUiText(this, 14, personalCardY + 10, "ВАШ ONLINE STATUS", "label", {
        color: colorToHex(snapshot.playerProfile ? UI_THEME.colors.cyan : UI_THEME.colors.textSoft)
      }).setOrigin(0, 0)
    );
    panel.content.add(
      addUiText(this, 14, personalCardY + 28, this.resolvePersonalRankHeadline(snapshot), "body", {
        color: colorToHex(UI_THEME.colors.text),
        fontStyle: "700"
      }).setOrigin(0, 0)
    );
    panel.content.add(
      addUiText(this, contentWidth - 14, personalCardY + 28, this.resolvePersonalRankMeta(snapshot), "meta", {
        color: colorToHex(snapshot.playerProfile ? UI_THEME.colors.success : UI_THEME.colors.textMuted),
        align: "right"
      }).setOrigin(1, 0)
    );

    if (snapshot.fallbackReason) {
      panel.content.add(
        addUiText(this, 0, personalCardY + personalCardHeight + 10, snapshot.fallbackReason, "meta", {
          color: colorToHex(UI_THEME.colors.warning),
          wordWrap: { width: contentWidth }
        }).setOrigin(0, 0)
      );
    }

    const entries = snapshot.topEntries.slice(0, compact ? 3 : 5);
    const rowsStartY = personalCardY + personalCardHeight + (snapshot.fallbackReason ? 34 : 18);

    if (entries.length === 0) {
      panel.content.add(
        addUiText(
          this,
          0,
          rowsStartY,
          isFallback
            ? "Пока нет локальных результатов. Сыграйте первый матч, и таблица заполнится."
            : "Онлайн-таблица пока пуста. Первый ranked-run появится здесь.",
          "bodySoft",
          {
            wordWrap: { width: contentWidth }
          }
        ).setOrigin(0, 0)
      );
      return;
    }

    if (compact) {
      this.populateOnlineCompactLeaderboard(panel, contentWidth, rowsStartY, entries, snapshot);
      return;
    }

    const headerY = rowsStartY;
    const rowHeight = 38;
    const columns = {
      rank: 0,
      score: 50,
      wave: 172,
      player: 244,
      date: contentWidth
    };

    const headerDivider = this.add.graphics();
    headerDivider.lineStyle(1, UI_THEME.colors.lineSoft, 0.08);
    headerDivider.lineBetween(0, headerY + 20, contentWidth, headerY + 20);
    panel.content.add(headerDivider);

    panel.content.add(addUiText(this, columns.rank, headerY, "RANK", "meta", {
      color: colorToHex(UI_THEME.colors.textMuted)
    }).setOrigin(0, 0));
    panel.content.add(addUiText(this, columns.score, headerY, "SCORE", "meta", {
      color: colorToHex(UI_THEME.colors.textMuted)
    }).setOrigin(0, 0));
    panel.content.add(addUiText(this, columns.wave, headerY, "WAVE", "meta", {
      color: colorToHex(UI_THEME.colors.textMuted)
    }).setOrigin(0, 0));
    panel.content.add(addUiText(this, columns.player, headerY, "PLAYER", "meta", {
      color: colorToHex(UI_THEME.colors.textMuted)
    }).setOrigin(0, 0));
    panel.content.add(addUiText(this, columns.date, headerY, "DATE", "meta", {
      color: colorToHex(UI_THEME.colors.textMuted),
      align: "right"
    }).setOrigin(1, 0));

    entries.forEach((entry, index) => {
      const rowY = headerY + 28 + index * rowHeight;
      const rowBackground = this.add.graphics();
      const isCurrentPlayer = this.isCurrentPlayerEntry(snapshot, entry);

      rowBackground.fillStyle(
        isCurrentPlayer ? UI_THEME.colors.surface : index === 0 ? UI_THEME.colors.surface : UI_THEME.colors.panelStrong,
        isCurrentPlayer ? 0.24 : index === 0 ? 0.2 : 0.12
      );
      rowBackground.fillRoundedRect(-8, rowY - 8, contentWidth + 16, 32, 12);
      rowBackground.lineStyle(
        1,
        isCurrentPlayer ? UI_THEME.colors.cyan : index === 0 ? UI_THEME.colors.warning : UI_THEME.colors.lineSoft,
        isCurrentPlayer ? 0.12 : index === 0 ? 0.08 : 0.035
      );
      rowBackground.strokeRoundedRect(-8, rowY - 8, contentWidth + 16, 32, 12);
      panel.content.add(rowBackground);

      panel.content.add(
        addUiText(this, columns.rank, rowY, `#${entry.rank}`, "label", {
          color: colorToHex(isCurrentPlayer ? UI_THEME.colors.cyan : index === 0 ? UI_THEME.colors.warning : UI_THEME.colors.cyan)
        }).setOrigin(0, 0)
      );
      panel.content.add(
        addUiText(this, columns.score, rowY, String(entry.bestScore), "body", {
          fontStyle: index === 0 || isCurrentPlayer ? "700" : "500",
          color: colorToHex(UI_THEME.colors.text)
        }).setOrigin(0, 0)
      );
      panel.content.add(addUiText(this, columns.wave, rowY, String(entry.bestWave), "bodySoft", {
        color: colorToHex(UI_THEME.colors.textSoft)
      }).setOrigin(0, 0));
      panel.content.add(
        addUiText(this, columns.player, rowY, this.resolveOnlineLeaderboardPlayer(entry.displayName, isCurrentPlayer), "meta", {
          color: colorToHex(isCurrentPlayer ? UI_THEME.colors.text : UI_THEME.colors.textSoft)
        }).setOrigin(0, 0)
      );
      panel.content.add(
        addUiText(this, columns.date, rowY, formatHighscoreDate(entry.bestScoreAt), "meta", {
          color: colorToHex(UI_THEME.colors.textMuted),
          align: "right"
        }).setOrigin(1, 0)
      );
    });
  }

  private populateOnlineCompactLeaderboard(
    panel: UiPanel,
    contentWidth: number,
    startY: number,
    entries: MenuLeaderboardSnapshot["topEntries"],
    snapshot: MenuLeaderboardSnapshot
  ): void {
    const rowHeight = 44;
    entries.forEach((entry, index) => {
      const rowY = startY + index * rowHeight;
      const rowBackground = this.add.graphics();
      const isCurrentPlayer = this.isCurrentPlayerEntry(snapshot, entry);

      rowBackground.fillStyle(
        isCurrentPlayer ? UI_THEME.colors.surface : index === 0 ? UI_THEME.colors.surface : UI_THEME.colors.panelStrong,
        isCurrentPlayer ? 0.24 : index === 0 ? 0.2 : 0.12
      );
      rowBackground.fillRoundedRect(-6, rowY - 6, contentWidth + 12, 36, 12);
      panel.content.add(rowBackground);

      panel.content.add(
        addUiText(this, 0, rowY, `#${entry.rank}`, "label", {
          color: colorToHex(isCurrentPlayer ? UI_THEME.colors.cyan : index === 0 ? UI_THEME.colors.warning : UI_THEME.colors.cyan)
        }).setOrigin(0, 0)
      );
      panel.content.add(
        addUiText(this, 34, rowY, String(entry.bestScore), "body", {
          fontStyle: index === 0 || isCurrentPlayer ? "700" : "500",
          color: colorToHex(UI_THEME.colors.text)
        }).setOrigin(0, 0)
      );
      panel.content.add(
        addUiText(this, 114, rowY, `W${entry.bestWave}`, "meta", {
          color: colorToHex(UI_THEME.colors.textSoft)
        }).setOrigin(0, 0)
      );
      panel.content.add(
        addUiText(this, contentWidth, rowY, formatHighscoreDate(entry.bestScoreAt), "meta", {
          color: colorToHex(UI_THEME.colors.textMuted),
          align: "right"
        }).setOrigin(1, 0)
      );
      panel.content.add(
        addUiText(this, 34, rowY + 19, this.resolveOnlineLeaderboardPlayer(entry.displayName, isCurrentPlayer, 22), "meta", {
          color: colorToHex(isCurrentPlayer ? UI_THEME.colors.textSoft : UI_THEME.colors.textMuted)
        }).setOrigin(0, 0)
      );
    });
  }

  private resolveOnlineLeaderboardPlayer(value: string, isCurrentPlayer: boolean, maxLength = 18): string {
    return isCurrentPlayer
      ? `${this.truncateLabel(value, maxLength)} • you`
      : this.truncateLabel(value, maxLength);
  }

  private resolveLeaderboardStatusLabel(snapshot: MenuLeaderboardSnapshot | null): string {
    if (snapshot === null) {
      return this.isLeaderboardLoading ? "SYNCING..." : "STANDBY";
    }

    return snapshot.mode === "online" ? "GLOBAL LIVE" : "LOCAL BACKUP";
  }

  private resolveLeaderboardStatusColor(snapshot: MenuLeaderboardSnapshot | null): number {
    if (snapshot === null) {
      return UI_THEME.colors.textSoft;
    }

    return snapshot.mode === "online" ? UI_THEME.colors.success : UI_THEME.colors.warning;
  }

  private resolvePersonalRankHeadline(snapshot: MenuLeaderboardSnapshot): string {
    if (snapshot.playerProfile?.rank !== null && snapshot.playerProfile?.rank !== undefined) {
      return `Ваш ранг: #${snapshot.playerProfile.rank}`;
    }

    if (this.session.rankedEligible) {
      return "Личный ранг ещё не зафиксирован";
    }

    return "Войдите через Google для personal rank";
  }

  private resolvePersonalRankMeta(snapshot: MenuLeaderboardSnapshot): string {
    const profile = snapshot.playerProfile;

    if (profile && profile.bestScore !== null && profile.bestWave !== null) {
      return `${profile.bestScore} pts • W${profile.bestWave}`;
    }

    return snapshot.mode === "online" ? "global board online" : "fallback mode";
  }

  private isCurrentPlayerEntry(snapshot: MenuLeaderboardSnapshot, entry: MenuLeaderboardSnapshot["topEntries"][number]): boolean {
    return snapshot.playerProfile !== null
      && snapshot.playerProfile.player.displayName === entry.displayName
      && snapshot.playerProfile.bestScore === entry.bestScore
      && snapshot.playerProfile.bestWave === entry.bestWave;
  }

  private populateControlsPanel(panel: UiPanel, panelWidth: number, compact: boolean): void {
    const contentWidth = panelWidth - (compact ? 32 : 40);
    const columnWidth = contentWidth / 3;
    const keys = ["СТРЕЛКИ / WASD", "SPACE", "P / ESC"];
    const captions = ["движение", "выстрел", "пауза"];

    for (let index = 0; index < 3; index += 1) {
      const centerX = columnWidth * index + columnWidth * 0.5;
      const dividerX = columnWidth * (index + 1);

      if (index < 2) {
        const divider = this.add.graphics();
        divider.lineStyle(1, UI_THEME.colors.line, 0.08);
        divider.lineBetween(dividerX, compact ? 6 : 8, dividerX, compact ? 36 : 40);
        panel.content.add(divider);
      }

      panel.content.add(
        addUiText(this, centerX, compact ? 4 : 6, keys[index] ?? "", "label", {
          color: colorToHex(index === 0 ? UI_THEME.colors.cyan : index === 1 ? UI_THEME.colors.text : UI_THEME.colors.lineSoft),
          align: "center",
          fontSize: compact ? "16px" : "18px"
        }).setOrigin(0.5, 0)
      );

      panel.content.add(
        addUiText(this, centerX, compact ? 22 : 24, captions[index] ?? "", "meta", {
          color: colorToHex(UI_THEME.colors.textMuted),
          align: "center",
          fontSize: compact ? "11px" : "12px",
          wordWrap: { width: columnWidth - 18 }
        }).setOrigin(0.5, 0)
      );
    }
  }

  private openSettingsOverlay(): void {
    if (this.isSettingsOpen) {
      return;
    }

    this.isSettingsOpen = true;
    this.renderSettingsOverlay();
  }

  private closeSettingsOverlay(): void {
    if (!this.isSettingsOpen) {
      return;
    }

    this.isSettingsOpen = false;
    this.destroySettingsOverlay();
  }

  private trackSettingsOverlayObject<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.settingsOverlayObjects.push(object);
    return object;
  }

  private trackSettingsOverlayComponent<T extends DestroyableComponent>(component: T): T {
    this.settingsOverlayComponents.push(component);
    return component;
  }

  private destroySettingsOverlay(): void {
    while (this.settingsOverlayComponents.length > 0) {
      this.settingsOverlayComponents.pop()?.destroy();
    }

    while (this.settingsOverlayObjects.length > 0) {
      this.settingsOverlayObjects.pop()?.destroy();
    }
  }

  private renderSettingsOverlay(): void {
    this.destroySettingsOverlay();

    const overlay = this.trackSettingsOverlayObject(createScreenOverlay(this, UI_THEME.colors.shadow, 0.72, UI_THEME.depth.overlay));
    overlay.setAlpha(0);
    overlay.setInteractive();
    overlay.on("pointerdown", (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
    });
    this.tweens.add({
      targets: overlay,
      alpha: 0.9,
      duration: UI_THEME.motion.normal,
      ease: "Quad.easeOut"
    });

    const settingsPanel = this.trackSettingsOverlayComponent(
      new AudioSettingsPanel(this, this.audioSystem, {
        x: getViewportCenterX(this),
        y: getViewportHeight(this) * 0.56,
        width: Math.min(getViewportWidth(this) - 44, 360),
        title: "Настройки звука",
        depth: UI_THEME.depth.overlayContent
      })
    );
    fadeScaleIn(this, settingsPanel.root, { scaleFrom: 0.97, yOffset: 8, duration: UI_THEME.motion.normal });

    const closeButton = this.trackSettingsOverlayComponent(
      new UiButton(this, {
        x: getViewportCenterX(this),
        y: getViewportHeight(this) * 0.56 + 138,
        width: 156,
        height: 34,
        label: "Закрыть",
        variant: "ghost",
        depth: UI_THEME.depth.overlayContent + 2,
        audioSystem: this.audioSystem,
        onClick: () => {
          this.closeSettingsOverlay();
        }
      })
    );
    fadeScaleIn(this, closeButton.root, { delay: 34, scaleFrom: 0.99, yOffset: 4, duration: UI_THEME.motion.normal });
  }

  private async refreshLeaderboardSnapshot(): Promise<void> {
    const requestId = ++this.leaderboardRequestId;
    this.isLeaderboardLoading = true;

    if (this.leaderboardSnapshot === null) {
      this.renderContent();
    }

    try {
      const snapshot = await getGameAppContext().onlineLeaderboardService.loadMenuLeaderboard(this.session);
      if (requestId !== this.leaderboardRequestId) {
        return;
      }

      this.leaderboardSnapshot = snapshot;
    } finally {
      if (requestId === this.leaderboardRequestId) {
        this.isLeaderboardLoading = false;
        this.renderContent();
      }
    }
  }

  private resolveProfileHeadline(): string {
    return this.session.isGuest ? "Гостевой профиль" : this.session.displayName;
  }

  private resolveProfileSubline(): string {
    if (this.isAuthBusy) {
      return "Обновляем доступ к профилю и результатам.";
    }

    if (this.session.isGuest) {
      return "Локальная сессия без авторизации.";
    }

    return "Google подключён. Сессия синхронизирована.";
  }

  private resolveRankedStateText(): string {
    return this.session.rankedEligible ? "ONLINE READY" : "LOCAL ONLY";
  }

  private resolveModeDescription(googleAvailable: boolean): string {
    if (this.isAuthBusy) {
      return "";
    }

    if (!googleAvailable) {
      return "Быстрый локальный запуск без авторизации. Результаты сохраняются на этом устройстве.";
    }

    return "";
  }

  private resolveActionHint(googleAvailable: boolean): string {
    if (!googleAvailable && this.session.isGuest) {
      return "Google вход недоступен в этой сборке.";
    }

    return "";
  }

  private resolveSecondaryActionLabel(googleAvailable: boolean): string {
    if (this.session.isGuest) {
      if (!googleAvailable) {
        return "Google недоступен";
      }

      return this.isAuthBusy ? "Подключаем Google..." : "Войти через Google";
    }

    return this.isAuthBusy ? "Переключение..." : "Гостевой режим";
  }

  private isSecondaryActionEnabled(googleAvailable: boolean): boolean {
    return this.session.isGuest ? googleAvailable : true;
  }

  private truncateLabel(value: string, maxLength: number): string {
    if (value.length <= maxLength) {
      return value;
    }

    return `${value.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`;
  }

  private describeSavedRun(metadata: ResumeMetadata): string {
    const savedAt = new Date(metadata.savedAt);
    const savedAtLabel = Number.isNaN(savedAt.getTime())
      ? "recently"
      : savedAt.toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      });
    const waveLabel = metadata.bossActive || metadata.waveKind === "boss"
      ? `boss wave ${metadata.wave}`
      : `wave ${metadata.wave}`;

    return `${waveLabel} • score ${metadata.score} • ${savedAtLabel}`;
  }

  private formatResumeButtonSubtitle(metadata: ResumeMetadata): string {
    return `Волна ${metadata.wave} • Счёт ${metadata.score}`;
  }

  private startGame(mode: "new" | "resume"): void {
    if (this.isStarting || this.isAuthBusy) {
      return;
    }

    this.isStarting = true;
    const runStateStore = getGameAppContext().runStateStore;

    if (mode === "new") {
      runStateStore.clear();
    }

    const savedRun = mode === "resume" ? runStateStore.load() : null;
    if (mode === "resume" && !savedRun) {
      this.isStarting = false;
      this.resumeMetadata = null;
      this.renderContent();
      return;
    }

    const payload: GameStartPayload = {
      source: mode === "resume" ? "resume" : "menu",
      session: savedRun?.run.session ?? buildSessionPresentation(this.session),
      savedRun: savedRun ?? undefined
    };

    this.scene.start(SCENE_KEYS.GAME, payload);
  }

  private handleFirstInteraction(): void {
    this.audioSystem.unlock();
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
      this.authMessageColor = colorToHex(UI_THEME.colors.danger);
      this.renderContent();
      return;
    }

    this.session = result.session;
    this.authMessage = "Профиль Google подключён.";
    this.authMessageColor = colorToHex(UI_THEME.colors.success);
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
      this.authMessage = result.errorMessage || "Не удалось переключиться в гостевой режим.";
      this.authMessageColor = colorToHex(UI_THEME.colors.danger);
      this.renderContent();
      return;
    }

    this.session = result.session;
    this.authMessage = "";
    this.renderContent();
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
    this.destroySettingsOverlay();

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
    this.renderContent();
  }

  private handleShutdown(): void {
    this.input.off("pointerdown", this.handleFirstInteraction, this);
    this.input.keyboard?.off("keydown", this.handleFirstInteraction, this);
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
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

    if (this.escapeKey) {
      this.input.keyboard?.removeKey(this.escapeKey);
      this.escapeKey = undefined;
    }

    this.destroyContent();
    this.background?.destroy();
    this.background = undefined;
    this.backgroundOverlay = undefined;
    this.isStarting = false;
    this.isAuthBusy = false;
    this.isSettingsOpen = false;
    this.resumeMetadata = null;
    this.leaderboardSnapshot = null;
    this.isLeaderboardLoading = false;
    this.leaderboardRequestId = 0;
    this.authMessage = "";
    this.authMessageColor = colorToHex(UI_THEME.colors.textSoft);
  }
}
