import Phaser from "phaser";

import { createGuestSession, type UserSession } from "../../auth/types";
import { getGameAppContext } from "../appContext";
import { AudioSystem } from "../systems/AudioSystem";
import type { GameStartPayload, PracticeScoreEntry } from "../types/game";
import { SCENE_KEYS } from "../types/scene";
import { MUSIC_KEYS, SFX_KEYS } from "../utils/audioKeys";
import { buildSessionPresentation, clamp, configureText, formatHighscoreDate } from "../utils/helpers";
import { GAME_TITLE, TEXTURE_KEYS, UI_COLORS, WORLD_HEIGHT, WORLD_WIDTH } from "../utils/constants";

export class MenuScene extends Phaser.Scene {
  private farBackground?: Phaser.GameObjects.TileSprite;
  private nearBackground?: Phaser.GameObjects.TileSprite;
  private enterKey?: Phaser.Input.Keyboard.Key;
  private spaceKey?: Phaser.Input.Keyboard.Key;
  private authUnsubscribe?: () => void;
  private readonly contentObjects: Phaser.GameObjects.GameObject[] = [];
  private audioSystem!: AudioSystem;
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
    this.audioSystem = AudioSystem.getInstance(this);
    this.audioSystem.stopAllSfx();
    this.audioSystem.playMusic(MUSIC_KEYS.MENU);

    this.createBackground();
    this.renderContent();

    this.enterKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.spaceKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.input.on("pointerdown", this.handleFirstInteraction, this);
    this.input.keyboard?.on("keydown", this.handleFirstInteraction, this);

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
      this.handleFirstInteraction();
      this.audioSystem.playSfx(SFX_KEYS.UI_CLICK);
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
        .text(WORLD_WIDTH * 0.5, 106, "РђСЂРєР°РґРЅС‹Р№ РІС‹Р»РµС‚ СЃ guest mode Рё Google auth foundation", {
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
    this.createAudioPanel(WORLD_WIDTH * 0.5, 480, 720, 36);

    const quickStart = this.trackObject(
      this.add
        .text(
          WORLD_WIDTH * 0.5,
          WORLD_HEIGHT - 10,
          "Enter / Space вЂ” РЅР°С‡Р°С‚СЊ РёРіСЂСѓ С‚РµРєСѓС‰РёРј СЂРµР¶РёРјРѕРј. Р“РѕСЃС‚СЊ РёРіСЂР°РµС‚ РїРѕР»РЅРѕС†РµРЅРЅРѕ, РЅРѕ РѕСЃС‚Р°С‘С‚СЃСЏ РІРЅРµ ranked results.",
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
        .text(centerX, centerY - 128, "РџСЂРѕС„РёР»СЊ", {
          fontFamily: "Segoe UI, sans-serif",
          fontSize: "26px",
          color: "#6ef2ff",
          fontStyle: "bold"
        })
        .setOrigin(0.5)
        .setDepth(3)
    );

    const profileStatus = this.session.isGuest
      ? "Р“РѕСЃС‚СЊ"
      : `${this.session.displayName}${this.session.email ? ` вЂў ${this.session.email}` : ""}`;

    this.trackObject(
      this.add
        .text(centerX - 112, centerY - 88, `РЎС‚Р°С‚СѓСЃ: ${profileStatus}`, {
          fontFamily: "Segoe UI, sans-serif",
          fontSize: "18px",
          color: "#eaf7ff",
          wordWrap: { width: 224 }
        })
        .setDepth(3)
    );

    const modeDescription = this.session.isGuest
      ? "Guest mode: РјРѕР¶РЅРѕ РёРіСЂР°С‚СЊ СЃСЂР°Р·Сѓ, Р° СЂРµР·СѓР»СЊС‚Р°С‚С‹ РїРѕРїР°РґР°СЋС‚ С‚РѕР»СЊРєРѕ РІ Р»РѕРєР°Р»СЊРЅСѓСЋ practice history РЅР° СЌС‚РѕРј СѓСЃС‚СЂРѕР№СЃС‚РІРµ."
      : "Google profile: СЂРµР·СѓР»СЊС‚Р°С‚С‹ РїРѕРјРµС‡Р°СЋС‚СЃСЏ РєР°Рє ranked-eligible Рё РіРѕС‚РѕРІС‹ РґР»СЏ Р±СѓРґСѓС‰РµР№ РёРЅС‚РµРіСЂР°С†РёРё leaderboard backend.";

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

    const startLabel = this.session.isGuest ? "РРіСЂР°С‚СЊ РєР°Рє РіРѕСЃС‚СЊ" : "РќР°С‡Р°С‚СЊ РёРіСЂСѓ";
    this.createButton(centerX, centerY + 54, 228, 42, startLabel, !this.isAuthBusy, () => this.startGame(), "primary");

    if (this.session.isGuest) {
      const googleLabel = googleAvailable
        ? this.isAuthBusy
          ? "Р’С…РѕРґ С‡РµСЂРµР· Google..."
          : "Р’РѕР№С‚Рё С‡РµСЂРµР· Google"
        : "Google login РЅРµРґРѕСЃС‚СѓРїРµРЅ";
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
      const signOutLabel = this.isAuthBusy ? "Р’С‹С…РѕРґ..." : "Р’С‹Р№С‚Рё РІ РіРѕСЃС‚СЏ";
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
      ? "Google login Р°РєС‚РёРІРёСЂСѓРµС‚СЃСЏ С‡РµСЂРµР· Firebase Authentication Рё РІРѕСЃСЃС‚Р°РЅР°РІР»РёРІР°РµС‚ СЃРµСЃСЃРёСЋ РїРѕСЃР»Рµ reload."
      : "Р”Р»СЏ Google login РґРѕР±Р°РІСЊС‚Рµ Firebase env-РїРµСЂРµРјРµРЅРЅС‹Рµ РёР· .env.example Рё РІРєР»СЋС‡РёС‚Рµ Google provider РІ Firebase Console.";

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
        .text(centerX, centerY - 128, "РЈРїСЂР°РІР»РµРЅРёРµ", {
          fontFamily: "Segoe UI, sans-serif",
          fontSize: "26px",
          color: "#6ef2ff",
          fontStyle: "bold"
        })
        .setOrigin(0.5)
        .setDepth(3)
    );

    const lines = [
      "РЎС‚СЂРµР»РєРё вЂ” РґРІРёР¶РµРЅРёРµ РєРѕСЂР°Р±Р»СЏ",
      "Space вЂ” СЃС‚СЂРµР»СЊР±Р° СЃ cooldown",
      "P вЂ” РїР°СѓР·Р° РІРѕ РІСЂРµРјСЏ Р±РѕСЏ",
      "R вЂ” СЂРµСЃС‚Р°СЂС‚ С‚РѕР»СЊРєРѕ РїРѕСЃР»Рµ РїРѕСЂР°Р¶РµРЅРёСЏ",
      "Esc вЂ” РІРѕР·РІСЂР°С‚ РІ РјРµРЅСЋ СЃ СЌРєСЂР°РЅР° Game Over"
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
          centerY + 118,
          "Guest Рё Google РёРіСЂР°СЋС‚ РІ РѕРґРЅСѓ Рё С‚Сѓ Р¶Рµ РёРіСЂСѓ. Р Р°Р·РЅРёС†Р° С‚РѕР»СЊРєРѕ РІ С‚РѕРј, СЃС‡РёС‚Р°РµС‚СЃСЏ Р»Рё СЂРµР·СѓР»СЊС‚Р°С‚ ranked-eligible.",
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
        .text(centerX, centerY - 128, "Р›РѕРєР°Р»СЊРЅР°СЏ РїСЂР°РєС‚РёРєР°", {
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
        .text(centerX, centerY - 96, "Р­С‚Рѕ РЅРµ leaderboard. Р—РґРµСЃСЊ С‚РѕР»СЊРєРѕ local practice history РЅР° СѓСЃС‚СЂРѕР№СЃС‚РІРµ.", {
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
          .text(centerX, centerY - 6, "РџРѕРєР° РЅРµС‚ Р»РѕРєР°Р»СЊРЅС‹С… С‚СЂРµРЅРёСЂРѕРІРѕС‡РЅС‹С… СЂРµР·СѓР»СЊС‚Р°С‚РѕРІ.", {
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
            `#${index + 1}  ${entry.score} РѕС‡РєРѕРІ вЂў РІРѕР»РЅР° ${entry.wave}\n${entry.playerLabel} вЂў ${label} вЂў ${formatHighscoreDate(entry.date)}`,
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

  private createAudioPanel(centerX: number, centerY: number, width: number, height: number): void {
    const settings = this.audioSystem.getSettings();

    this.trackObject(
      this.add
        .rectangle(centerX, centerY, width, height, UI_COLORS.panel, 0.94)
        .setStrokeStyle(2, UI_COLORS.gold, 0.26)
        .setDepth(2)
    );

    this.trackObject(
      this.add
        .text(centerX - 330, centerY, "Audio", {
          fontFamily: "Segoe UI, sans-serif",
          fontSize: "18px",
          color: "#ffd76c",
          fontStyle: "bold"
        })
        .setOrigin(0, 0.5)
        .setDepth(3)
    );

    this.createButton(centerX - 215, centerY, 118, 28, settings.masterMuted ? "Mute: On" : "Mute: Off", true, () => {
      this.audioSystem.setMasterMuted(!settings.masterMuted);
      this.renderContent();
    }, "secondary");

    this.trackObject(
      this.add
        .text(centerX - 98, centerY, "Music", {
          fontFamily: "Segoe UI, sans-serif",
          fontSize: "16px",
          color: "#eaf7ff"
        })
        .setOrigin(1, 0.5)
        .setDepth(3)
    );
    this.createButton(centerX - 68, centerY, 34, 28, "-", true, () => {
      this.audioSystem.setMusicVolume(clamp(settings.musicVolume - 0.1, 0, 1));
      this.renderContent();
    }, "secondary");
    this.trackObject(
      this.add
        .text(centerX - 2, centerY, `${Math.round(settings.musicVolume * 100)}%`, {
          fontFamily: "Segoe UI, sans-serif",
          fontSize: "16px",
          color: "#9abed8",
          fontStyle: "bold"
        })
        .setOrigin(0.5)
        .setDepth(3)
    );
    this.createButton(centerX + 64, centerY, 34, 28, "+", true, () => {
      this.audioSystem.setMusicVolume(clamp(settings.musicVolume + 0.1, 0, 1));
      this.renderContent();
    }, "secondary");

    this.trackObject(
      this.add
        .text(centerX + 140, centerY, "SFX", {
          fontFamily: "Segoe UI, sans-serif",
          fontSize: "16px",
          color: "#eaf7ff"
        })
        .setOrigin(1, 0.5)
        .setDepth(3)
    );
    this.createButton(centerX + 170, centerY, 34, 28, "-", true, () => {
      this.audioSystem.setSfxVolume(clamp(settings.sfxVolume - 0.1, 0, 1));
      this.renderContent();
    }, "secondary");
    this.trackObject(
      this.add
        .text(centerX + 236, centerY, `${Math.round(settings.sfxVolume * 100)}%`, {
          fontFamily: "Segoe UI, sans-serif",
          fontSize: "16px",
          color: "#9abed8",
          fontStyle: "bold"
        })
        .setOrigin(0.5)
        .setDepth(3)
    );
    this.createButton(centerX + 302, centerY, 34, 28, "+", true, () => {
      this.audioSystem.setSfxVolume(clamp(settings.sfxVolume + 0.1, 0, 1));
      this.renderContent();
    }, "secondary");
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
    button.on("pointerover", () => {
      button.setFillStyle(fillColor, 1);
      this.audioSystem.playSfx(SFX_KEYS.UI_HOVER);
    });
    button.on("pointerout", () => button.setFillStyle(fillColor, alpha));
    button.on("pointerdown", () => {
      this.handleFirstInteraction();
      this.audioSystem.playSfx(SFX_KEYS.UI_CLICK);
      onClick();
    });
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
      this.authMessage = result.errorMessage || "РќРµ СѓРґР°Р»РѕСЃСЊ РІС‹РїРѕР»РЅРёС‚СЊ РІС…РѕРґ С‡РµСЂРµР· Google.";
      this.authMessageColor = "#ff9eaa";
      this.renderContent();
      return;
    }

    this.session = result.session;
    this.authMessage = "Google-РїСЂРѕС„РёР»СЊ Р°РєС‚РёРІРёСЂРѕРІР°РЅ. Р‘СѓРґСѓС‰РёРµ СЂРµР·СѓР»СЊС‚Р°С‚С‹ С‚РµРїРµСЂСЊ РїРѕРјРµС‡Р°СЋС‚СЃСЏ РєР°Рє ranked-eligible.";
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
      this.authMessage = result.errorMessage || "РќРµ СѓРґР°Р»РѕСЃСЊ РІС‹Р№С‚Рё РёР· Google-РїСЂРѕС„РёР»СЏ.";
      this.authMessageColor = "#ff9eaa";
      this.renderContent();
      return;
    }

    this.session = result.session;
    this.authMessage = "РџСЂРѕС„РёР»СЊ РїРµСЂРµРєР»СЋС‡С‘РЅ РІ РіРѕСЃС‚РµРІРѕР№ СЂРµР¶РёРј. РЎР»РµРґСѓСЋС‰РёРµ СЂРµР·СѓР»СЊС‚Р°С‚С‹ РѕСЃС‚Р°РЅСѓС‚СЃСЏ С‚РѕР»СЊРєРѕ РІ Р»РѕРєР°Р»СЊРЅРѕР№ РёСЃС‚РѕСЂРёРё.";
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
    this.input.off("pointerdown", this.handleFirstInteraction, this);
    this.input.keyboard?.off("keydown", this.handleFirstInteraction, this);
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
