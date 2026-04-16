import type { AudioAssetDefinition, AudioSettings, AudioKey, MusicKey, SfxKey, SfxPlaybackRule } from "../types/audio";

export const MUSIC_KEYS = {
  MENU: "music-menu",
  GAMEPLAY: "music-gameplay",
  BOSS: "music-boss",
  GAME_OVER: "music-game-over"
} as const satisfies Record<string, MusicKey>;

export const SFX_KEYS = {
  PLAYER_SHOOT: "sfx-player-shoot",
  ENEMY_HIT: "sfx-enemy-hit",
  ENEMY_DESTROY: "sfx-enemy-destroy",
  PLAYER_HURT: "sfx-player-hurt",
  POWERUP_PICKUP: "sfx-powerup-pickup",
  ENEMY_SHOOT: "sfx-enemy-shoot",
  BOSS_ATTACK: "sfx-boss-attack",
  BOSS_HIT: "sfx-boss-hit",
  BOSS_DEATH: "sfx-boss-death",
  UI_HOVER: "sfx-ui-hover",
  UI_CLICK: "sfx-ui-click",
  WAVE_START: "sfx-wave-start",
  GAME_OVER: "sfx-game-over"
} as const satisfies Record<string, SfxKey>;

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  masterMuted: false,
  musicVolume: 0.55,
  sfxVolume: 0.8
};

export const AUDIO_ASSETS: AudioAssetDefinition[] = [
  {
    key: MUSIC_KEYS.MENU,
    kind: "music",
    urls: ["/audio/music/menu-theme.wav"],
    volume: 0.85,
    loop: true
  },
  {
    key: MUSIC_KEYS.GAMEPLAY,
    kind: "music",
    urls: ["/audio/music/gameplay-loop.wav"],
    volume: 0.8,
    loop: true
  },
  {
    key: MUSIC_KEYS.BOSS,
    kind: "music",
    urls: ["/audio/music/boss-loop.wav"],
    volume: 0.9,
    loop: true
  },
  {
    key: MUSIC_KEYS.GAME_OVER,
    kind: "music",
    urls: ["/audio/music/game-over-sting.wav"],
    volume: 0.9,
    loop: false
  },
  {
    key: SFX_KEYS.PLAYER_SHOOT,
    kind: "sfx",
    urls: ["/audio/sfx/player-shoot.wav"],
    volume: 0.22
  },
  {
    key: SFX_KEYS.ENEMY_HIT,
    kind: "sfx",
    urls: ["/audio/sfx/enemy-hit.wav"],
    volume: 0.28
  },
  {
    key: SFX_KEYS.ENEMY_DESTROY,
    kind: "sfx",
    urls: ["/audio/sfx/enemy-destroy.wav"],
    volume: 0.42
  },
  {
    key: SFX_KEYS.PLAYER_HURT,
    kind: "sfx",
    urls: ["/audio/sfx/player-hurt.wav"],
    volume: 0.58
  },
  {
    key: SFX_KEYS.POWERUP_PICKUP,
    kind: "sfx",
    urls: ["/audio/sfx/powerup-pickup.wav"],
    volume: 0.42
  },
  {
    key: SFX_KEYS.ENEMY_SHOOT,
    kind: "sfx",
    urls: ["/audio/sfx/enemy-shoot.wav"],
    volume: 0.24
  },
  {
    key: SFX_KEYS.BOSS_ATTACK,
    kind: "sfx",
    urls: ["/audio/sfx/boss-attack.wav"],
    volume: 0.34
  },
  {
    key: SFX_KEYS.BOSS_HIT,
    kind: "sfx",
    urls: ["/audio/sfx/boss-hit.wav"],
    volume: 0.3
  },
  {
    key: SFX_KEYS.BOSS_DEATH,
    kind: "sfx",
    urls: ["/audio/sfx/boss-death.wav"],
    volume: 0.68
  },
  {
    key: SFX_KEYS.UI_HOVER,
    kind: "sfx",
    urls: ["/audio/sfx/ui-hover.wav"],
    volume: 0.18
  },
  {
    key: SFX_KEYS.UI_CLICK,
    kind: "sfx",
    urls: ["/audio/sfx/ui-click.wav"],
    volume: 0.24
  },
  {
    key: SFX_KEYS.WAVE_START,
    kind: "sfx",
    urls: ["/audio/sfx/wave-start.wav"],
    volume: 0.52
  },
  {
    key: SFX_KEYS.GAME_OVER,
    kind: "sfx",
    urls: ["/audio/sfx/game-over.wav"],
    volume: 0.62
  }
];

export const AUDIO_ASSET_MAP = Object.fromEntries(AUDIO_ASSETS.map((asset) => [asset.key, asset])) as Record<
  AudioKey,
  AudioAssetDefinition
>;

export const SFX_PLAYBACK_RULES: Record<SfxKey, SfxPlaybackRule> = {
  [SFX_KEYS.PLAYER_SHOOT]: {
    cooldownMs: 80,
    maxSimultaneous: 3,
    detuneRange: 35
  },
  [SFX_KEYS.ENEMY_HIT]: {
    cooldownMs: 45,
    maxSimultaneous: 4,
    detuneRange: 25
  },
  [SFX_KEYS.ENEMY_DESTROY]: {
    cooldownMs: 60,
    maxSimultaneous: 3,
    detuneRange: 40
  },
  [SFX_KEYS.PLAYER_HURT]: {
    cooldownMs: 120,
    maxSimultaneous: 2,
    detuneRange: 20
  },
  [SFX_KEYS.POWERUP_PICKUP]: {
    cooldownMs: 120,
    maxSimultaneous: 2,
    detuneRange: 30
  },
  [SFX_KEYS.ENEMY_SHOOT]: {
    cooldownMs: 90,
    maxSimultaneous: 4,
    detuneRange: 25
  },
  [SFX_KEYS.BOSS_ATTACK]: {
    cooldownMs: 180,
    maxSimultaneous: 1,
    detuneRange: 15
  },
  [SFX_KEYS.BOSS_HIT]: {
    cooldownMs: 80,
    maxSimultaneous: 3,
    detuneRange: 20
  },
  [SFX_KEYS.BOSS_DEATH]: {
    cooldownMs: 500,
    maxSimultaneous: 1,
    detuneRange: 0
  },
  [SFX_KEYS.UI_HOVER]: {
    cooldownMs: 70,
    maxSimultaneous: 1,
    detuneRange: 10
  },
  [SFX_KEYS.UI_CLICK]: {
    cooldownMs: 40,
    maxSimultaneous: 2,
    detuneRange: 10
  },
  [SFX_KEYS.WAVE_START]: {
    cooldownMs: 300,
    maxSimultaneous: 1,
    detuneRange: 0
  },
  [SFX_KEYS.GAME_OVER]: {
    cooldownMs: 500,
    maxSimultaneous: 1,
    detuneRange: 0
  }
};
