export type MusicKey = "music-menu" | "music-gameplay" | "music-boss" | "music-game-over";

export type SfxKey =
  | "sfx-player-shoot"
  | "sfx-enemy-hit"
  | "sfx-enemy-destroy"
  | "sfx-player-hurt"
  | "sfx-powerup-pickup"
  | "sfx-enemy-shoot"
  | "sfx-boss-attack"
  | "sfx-boss-hit"
  | "sfx-boss-death"
  | "sfx-ui-hover"
  | "sfx-ui-click"
  | "sfx-wave-start"
  | "sfx-game-over";

export type AudioKey = MusicKey | SfxKey;

export interface AudioSettings {
  masterMuted: boolean;
  musicVolume: number;
  sfxVolume: number;
}

export interface AudioAssetDefinition<K extends AudioKey = AudioKey> {
  key: K;
  kind: "music" | "sfx";
  urls: string[];
  volume: number;
  loop?: boolean;
}

export interface SfxPlaybackConfig {
  volume?: number;
  detune?: number;
  rate?: number;
  seek?: number;
  delay?: number;
  loop?: boolean;
}

export interface SfxPlaybackRule {
  cooldownMs?: number;
  maxSimultaneous?: number;
  detuneRange?: number;
}
