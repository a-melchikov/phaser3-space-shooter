import Phaser from "phaser";

import type { AudioSettings, MusicKey, SfxKey, SfxPlaybackConfig } from "../types/audio";
import { clamp } from "../utils/helpers";
import { STORAGE_KEYS } from "../utils/constants";
import { AUDIO_ASSET_MAP, DEFAULT_AUDIO_SETTINGS, SFX_PLAYBACK_RULES } from "../utils/audioKeys";

interface ActiveSfxEntry {
  key: SfxKey;
  volumeMultiplier: number;
}

type ManagedSound = Phaser.Sound.NoAudioSound | Phaser.Sound.HTML5AudioSound | Phaser.Sound.WebAudioSound;

export class AudioSystem {
  private static instance: AudioSystem | null = null;

  public static bootstrap(source: Phaser.Scene | Phaser.Game): AudioSystem {
    const game = source instanceof Phaser.Game ? source : source.game;

    if (!AudioSystem.instance || AudioSystem.instance.game !== game) {
      AudioSystem.instance?.destroy();
      AudioSystem.instance = new AudioSystem(game);
    }

    return AudioSystem.instance;
  }

  public static getInstance(source: Phaser.Scene | Phaser.Game): AudioSystem {
    return AudioSystem.bootstrap(source);
  }

  public static destroyGlobal(): void {
    AudioSystem.instance?.destroy();
    AudioSystem.instance = null;
  }

  private readonly soundManager: Phaser.Sound.NoAudioSoundManager | Phaser.Sound.HTML5AudioSoundManager | Phaser.Sound.WebAudioSoundManager;
  private readonly activeSfx = new Map<ManagedSound, ActiveSfxEntry>();
  private readonly sfxLastPlayedAt = new Map<SfxKey, number>();
  private currentMusic?: ManagedSound;
  private currentMusicKey?: MusicKey;
  private pendingMusicKey?: MusicKey;
  private settings: AudioSettings = { ...DEFAULT_AUDIO_SETTINGS };

  private readonly handleUnlocked = (): void => {
    if (!this.pendingMusicKey) {
      return;
    }

    const key = this.pendingMusicKey;
    this.pendingMusicKey = undefined;
    this.startMusicPlayback(key);
  };

  private constructor(private readonly game: Phaser.Game) {
    this.soundManager = game.sound;
    this.soundManager.on(Phaser.Sound.Events.UNLOCKED, this.handleUnlocked, this);
    this.applySettings();
  }

  public unlock(): void {
    if (!this.soundManager.locked) {
      return;
    }

    this.soundManager.unlock();
  }

  public playMusic(key: MusicKey): void {
    if (!this.game.cache.audio.exists(key)) {
      return;
    }

    if (this.soundManager.locked) {
      this.pendingMusicKey = key;
      return;
    }

    this.pendingMusicKey = undefined;
    this.startMusicPlayback(key);
  }

  public stopMusic(): void {
    this.pendingMusicKey = undefined;
    this.destroyCurrentMusic();
  }

  public stopAllSfx(): void {
    Array.from(this.activeSfx.keys()).forEach((sound) => {
      if (sound.isPlaying) {
        sound.stop();
      }

      sound.destroy();
    });

    this.activeSfx.clear();
  }

  public playSfx(key: SfxKey, config: SfxPlaybackConfig = {}): void {
    if (this.soundManager.locked || !this.game.cache.audio.exists(key)) {
      return;
    }

    const rule = SFX_PLAYBACK_RULES[key];
    const now = window.performance.now();
    const lastPlayedAt = this.sfxLastPlayedAt.get(key) ?? -Infinity;

    if (rule.cooldownMs !== undefined && now - lastPlayedAt < rule.cooldownMs) {
      return;
    }

    const concurrentCount = Array.from(this.activeSfx.values()).filter((entry) => entry.key === key).length;
    if (rule.maxSimultaneous !== undefined && concurrentCount >= rule.maxSimultaneous) {
      return;
    }

    const sound = this.soundManager.add(key) as ManagedSound;
    const volumeMultiplier = clamp(config.volume ?? 1, 0, 1);
    const playbackConfig: Phaser.Types.Sound.SoundConfig = {
      delay: config.delay,
      detune: config.detune ?? this.getRandomDetune(rule.detuneRange),
      loop: config.loop ?? false,
      rate: config.rate,
      seek: config.seek,
      volume: this.resolveSfxVolume(key, volumeMultiplier)
    };

    const cleanup = (): void => {
      this.activeSfx.delete(sound);
    };

    sound.once(Phaser.Sound.Events.COMPLETE, cleanup);
    sound.once(Phaser.Sound.Events.STOP, cleanup);
    sound.once(Phaser.Sound.Events.DESTROY, cleanup);

    this.activeSfx.set(sound, { key, volumeMultiplier });
    this.sfxLastPlayedAt.set(key, now);

    if (!sound.play(playbackConfig)) {
      cleanup();
      sound.destroy();
    }
  }

  public setMasterMuted(value: boolean): void {
    this.settings.masterMuted = value;
    this.applySettings();
    this.saveSettings();
  }

  public setMusicVolume(value: number): void {
    this.settings.musicVolume = clamp(value, 0, 1);
    this.applySettings();
    this.saveSettings();
  }

  public setSfxVolume(value: number): void {
    this.settings.sfxVolume = clamp(value, 0, 1);
    this.applySettings();
    this.saveSettings();
  }

  public getSettings(): AudioSettings {
    return { ...this.settings };
  }

  public loadSettings(): AudioSettings {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.audioSettings);
      if (!raw) {
        this.settings = { ...DEFAULT_AUDIO_SETTINGS };
      } else {
        const parsed = JSON.parse(raw) as Partial<AudioSettings>;
        this.settings = {
          masterMuted: typeof parsed.masterMuted === "boolean" ? parsed.masterMuted : DEFAULT_AUDIO_SETTINGS.masterMuted,
          musicVolume:
            typeof parsed.musicVolume === "number"
              ? clamp(parsed.musicVolume, 0, 1)
              : DEFAULT_AUDIO_SETTINGS.musicVolume,
          sfxVolume:
            typeof parsed.sfxVolume === "number" ? clamp(parsed.sfxVolume, 0, 1) : DEFAULT_AUDIO_SETTINGS.sfxVolume
        };
      }
    } catch {
      this.settings = { ...DEFAULT_AUDIO_SETTINGS };
    }

    this.applySettings();
    return this.getSettings();
  }

  public saveSettings(): void {
    try {
      window.localStorage.setItem(STORAGE_KEYS.audioSettings, JSON.stringify(this.settings));
    } catch {
      // Audio settings are optional and must never break the game.
    }
  }

  public destroy(): void {
    this.stopMusic();
    this.stopAllSfx();
    this.soundManager.off(Phaser.Sound.Events.UNLOCKED, this.handleUnlocked, this);
  }

  private startMusicPlayback(key: MusicKey): void {
    if (this.currentMusicKey === key && this.currentMusic?.isPlaying) {
      return;
    }

    const asset = AUDIO_ASSET_MAP[key];
    if (asset.kind !== "music") {
      return;
    }

    this.destroyCurrentMusic();

    const music = this.soundManager.add(key, {
      loop: asset.loop ?? false,
      volume: this.resolveMusicVolume(key)
    }) as ManagedSound;

    music.once(Phaser.Sound.Events.COMPLETE, () => {
      if (this.currentMusic === music) {
        this.currentMusic = undefined;
        this.currentMusicKey = undefined;
      }

      music.destroy();
    });

    if (!music.play()) {
      music.destroy();
      return;
    }

    this.currentMusic = music;
    this.currentMusicKey = key;
  }

  private destroyCurrentMusic(): void {
    if (!this.currentMusic) {
      this.currentMusicKey = undefined;
      return;
    }

    const currentMusic = this.currentMusic;
    this.currentMusic = undefined;
    this.currentMusicKey = undefined;

    if (currentMusic.isPlaying) {
      currentMusic.stop();
    }

    currentMusic.destroy();
  }

  private applySettings(): void {
    this.soundManager.mute = this.settings.masterMuted;

    if (this.currentMusicKey && this.currentMusic) {
      this.currentMusic.setVolume(this.resolveMusicVolume(this.currentMusicKey));
    }

    this.activeSfx.forEach((entry, sound) => {
      sound.setVolume(this.resolveSfxVolume(entry.key, entry.volumeMultiplier));
    });
  }

  private resolveMusicVolume(key: MusicKey): number {
    return clamp(AUDIO_ASSET_MAP[key].volume * this.settings.musicVolume, 0, 1);
  }

  private resolveSfxVolume(key: SfxKey, volumeMultiplier: number): number {
    return clamp(AUDIO_ASSET_MAP[key].volume * this.settings.sfxVolume * volumeMultiplier, 0, 1);
  }

  private getRandomDetune(detuneRange = 0): number {
    if (detuneRange <= 0) {
      return 0;
    }

    return Phaser.Math.Between(-detuneRange, detuneRange);
  }
}
