export const GAME_TITLE = "Starfall Aegis";
export const WORLD_WIDTH = 960;
export const WORLD_HEIGHT = 540;
export const HIGHSCORE_LIMIT = 5;
export const CAMERA_SHAKE_STRONG = 0.008;
export const CAMERA_SHAKE_LIGHT = 0.0035;

export const STORAGE_KEYS = {
  legacyHighscores: "spaceShooterHighscoresV1",
  legacyPracticeScores: "spaceShooterHighscoresV2",
  practiceScores: "spaceShooterPracticeScoresV1",
  audioSettings: "spaceShooterAudioSettingsV1",
  runState: "spaceShooterRunStateV1"
} as const;

export const TEXTURE_KEYS = {
  player: "ship-player",
  shieldRing: "shield-ring",
  enemyBasic: "enemy-basic",
  enemyFast: "enemy-fast",
  enemyHeavy: "enemy-heavy",
  enemySniper: "enemy-sniper",
  enemyKamikaze: "enemy-kamikaze",
  enemyMineLayer: "enemy-mine-layer",
  enemyTurret: "enemy-turret",
  enemyTank: "enemy-tank",
  bossBulwark: "boss-bulwark",
  bossBlink: "boss-blink",
  bossCarrier: "boss-carrier",
  bossPrism: "boss-prism",
  bossAegis: "boss-aegis",
  bulletPlayer: "bullet-player",
  bulletEnemy: "bullet-enemy",
  powerHeal: "power-heal",
  powerDoubleShot: "power-double-shot",
  powerShield: "power-shield",
  powerDamageBoost: "power-damage-boost",
  powerSupportDrone: "power-support-drone",
  mine: "hazard-mine",
  supportDrone: "support-drone",
  particle: "fx-particle",
  flash: "fx-flash"
} as const;

export const UI_COLORS = {
  background: 0x06111f,
  panel: 0x0b1831,
  cyan: 0x6ef2ff,
  text: 0xeaf7ff,
  muted: 0x97bad5,
  gold: 0xffd76c,
  danger: 0xff6b7a,
  success: 0x79f7c1
} as const;
