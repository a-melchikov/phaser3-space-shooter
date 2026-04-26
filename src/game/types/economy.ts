export const ECONOMY_UPGRADE_KEYS = [
  "reinforcedHull",
  "calibratedCannons",
  "improvedReactor",
  "extendedPowerUps",
  "recoveryProtocol",
  "dropCalibration",
  "supportDrone",
  "twinCore",
  "aegisProtocol"
] as const;

export type EconomyUpgradeKey = (typeof ECONOMY_UPGRADE_KEYS)[number];
export type EconomyUpgradeRarity = "common" | "rare" | "epic" | "legendary";

export type EconomyUpgradeLevelMap = Record<EconomyUpgradeKey, number>;

export interface EconomyCurrencyState {
  shardsBalance: number;
  lifetimeShardsEarned: number;
  lifetimeShardsSpent: number;
}

export interface EconomyUpgradeCatalogItem {
  key: EconomyUpgradeKey;
  rarity: EconomyUpgradeRarity;
  title: string;
  description: string;
  level: number;
  maxLevel: number;
  nextCost: number | null;
  effectLabel: string;
  nextEffectLabel: string | null;
  canPurchase: boolean;
  unavailableReason: string | null;
}

export interface EconomyProfileResponse {
  currency: EconomyCurrencyState;
  upgrades: EconomyUpgradeLevelMap;
  catalog: EconomyUpgradeCatalogItem[];
}

export interface EconomyRunStartResponse {
  runId: string;
  upgrades: EconomyUpgradeLevelMap;
  startedAt: string;
}

export interface EconomyRewardBreakdown {
  commonKills: number;
  eliteKills: number;
  bossKills: number;
  noDamageWaves: number;
  highHpWaves: number;
  bossNoLifeLoss: number;
  deathlessStreaks: number;
}

export interface EconomyRunFinishResponse {
  status: "awarded" | "duplicate";
  runId: string;
  baseReward: number;
  bonusReward: number;
  totalReward: number;
  balance: number;
  capped: boolean;
  suspicious: boolean;
  suspiciousReasons: string[];
  breakdown: EconomyRewardBreakdown;
}

export interface EconomyPurchaseResponse {
  upgradeKey: EconomyUpgradeKey;
  level: number;
  spent: number;
  currency: EconomyCurrencyState;
  catalog: EconomyUpgradeCatalogItem[];
}

export interface EconomyRunSummary {
  runId: string;
  score: number;
  wave: number;
  durationMs: number;
  kills: {
    common: number;
    elite: number;
    bossWaves: number[];
  };
  bonuses: {
    noDamageWaves: number[];
    highHpWaves: number[];
    bossNoLifeLossWaves: number[];
    deathlessStreakMilestones: number[];
  };
}

export interface RunEconomyProgressState {
  startedAtOffsetMs: number;
  commonKills: number;
  eliteKills: number;
  deathlessStreak: number;
  bossKillWaves: number[];
  noDamageWaves: number[];
  highHpWaves: number[];
  bossNoLifeLossWaves: number[];
  deathlessStreakMilestones: number[];
  waveStates: Array<{
    wave: number;
    kind: "normal" | "elite" | "boss";
    tookDamage: boolean;
    lostLife: boolean;
    completed: boolean;
  }>;
}

export interface RunUpgradeEffects {
  maxHealthBonus: number;
  bulletDamageMultiplier: number;
  fireCooldownMultiplier: number;
  powerUpDurationMultiplier: number;
  healBonus: number;
  dropChanceBonus: number;
  permanentSupportDrone: boolean;
  supportDroneDamage: number;
  supportDroneFireCooldownMs: number;
  supportDroneBossPriority: boolean;
  waveStartDoubleShotMs: number;
  bossWaveShieldMs: number;
}

export interface EconomyRunStartState {
  runId: string;
  upgrades: EconomyUpgradeLevelMap;
  effects: RunUpgradeEffects;
}

export interface GameOverEconomyPayload {
  summary: EconomyRunSummary;
  estimatedReward: number;
  authenticated: boolean;
}

export type EconomySubmissionOutcome =
  | {
      status: "skipped";
      message: string;
      estimatedReward: number;
    }
  | {
      status: "submitted";
      response: EconomyRunFinishResponse;
      message: string;
    }
  | {
      status: "failed";
      message: string;
      estimatedReward: number;
    };
