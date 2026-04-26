export const economyUpgradeKeys = [
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

export type EconomyUpgradeKey = (typeof economyUpgradeKeys)[number];
export type EconomyUpgradeRarity = "common" | "rare" | "epic" | "legendary";

export interface EconomyUpgradeDefinition {
  key: EconomyUpgradeKey;
  rarity: EconomyUpgradeRarity;
  title: string;
  description: string;
  maxLevel: number;
  costs: readonly number[];
  effectLabels: readonly string[];
}

export const ECONOMY_UPGRADE_DEFINITIONS: Record<EconomyUpgradeKey, EconomyUpgradeDefinition> = {
  reinforcedHull: {
    key: "reinforcedHull",
    rarity: "common",
    title: "Усиленный корпус",
    description: "Немного увеличивает стартовый запас прочности.",
    maxLevel: 5,
    costs: [25, 55, 95, 145, 210],
    effectLabels: ["+5 HP", "+10 HP", "+15 HP", "+20 HP", "+25 HP"]
  },
  calibratedCannons: {
    key: "calibratedCannons",
    rarity: "common",
    title: "Калиброванные орудия",
    description: "Умеренно повышает базовый урон основного оружия.",
    maxLevel: 5,
    costs: [35, 75, 125, 185, 260],
    effectLabels: ["+3% урона", "+6% урона", "+9% урона", "+12% урона", "+15% урона"]
  },
  improvedReactor: {
    key: "improvedReactor",
    rarity: "common",
    title: "Улучшенный реактор",
    description: "Слегка ускоряет темп стрельбы без резкого скачка силы.",
    maxLevel: 5,
    costs: [35, 80, 135, 200, 280],
    effectLabels: ["-3% кд", "-6% кд", "-9% кд", "-12% кд", "-15% кд"]
  },
  extendedPowerUps: {
    key: "extendedPowerUps",
    rarity: "rare",
    title: "Расширенный импульс",
    description: "Продлевает временные бонусы на короткий срок.",
    maxLevel: 4,
    costs: [80, 140, 220, 320],
    effectLabels: ["+5% длительности", "+10% длительности", "+15% длительности", "+20% длительности"]
  },
  recoveryProtocol: {
    key: "recoveryProtocol",
    rarity: "rare",
    title: "Протокол восстановления",
    description: "Усиливает ремонтные бонусы, но не добавляет бессмертия.",
    maxLevel: 4,
    costs: [75, 135, 210, 300],
    effectLabels: ["+6 ремонта", "+12 ремонта", "+18 ремонта", "+24 ремонта"]
  },
  dropCalibration: {
    key: "dropCalibration",
    rarity: "rare",
    title: "Калибровка дропа",
    description: "Чуть повышает шанс выпадения бонусов.",
    maxLevel: 3,
    costs: [95, 180, 300],
    effectLabels: ["+1.5% шанс", "+3% шанс", "+4.5% шанс"]
  },
  supportDrone: {
    key: "supportDrone",
    rarity: "epic",
    title: "Боевой дрон",
    description: "Открывает слабого постоянного дрона-помощника.",
    maxLevel: 3,
    costs: [240, 420, 680],
    effectLabels: ["дрон открыт", "дрон стреляет чаще", "лучшее наведение"]
  },
  twinCore: {
    key: "twinCore",
    rarity: "epic",
    title: "Двойной контур",
    description: "Даёт короткий double-shot импульс в начале каждой волны.",
    maxLevel: 3,
    costs: [320, 560, 900],
    effectLabels: ["1.2с double-shot", "1.8с double-shot", "2.4с double-shot"]
  },
  aegisProtocol: {
    key: "aegisProtocol",
    rarity: "legendary",
    title: "Протокол Эгида",
    description: "Даёт слабый shield charge в начале boss wave.",
    maxLevel: 2,
    costs: [900, 1500],
    effectLabels: ["1.2с щита на boss wave", "1.8с щита на boss wave"]
  }
} as const;

export const ECONOMY_REWARD_CONFIG = {
  commonKill: 1,
  eliteKill: 4,
  bossBase: 28,
  bossPerIndex: 6,
  bossMax: 100,
  noDamageWave: 8,
  highHpWave: 5,
  bossNoLifeLoss: 16,
  deathlessStreakMilestone: 12,
  highHpThreshold: 0.8,
  deathlessStreakSize: 3,
  maxRewardPerWave: 45,
  maxRewardPerRun: 900
} as const;

export const ECONOMY_VALIDATION_CONFIG = {
  maxWave: 200,
  maxScorePerWave: 9500,
  maxScoreFlatPadding: 5000,
  maxCommonKillsPerWave: 42,
  maxEliteKillsPerWave: 9,
  maxBossKillsPadding: 1,
  minRewardedRunDurationMs: 8000,
  minDurationPerWaveMs: 2200,
  shortRunRewardAllowance: 5
} as const;

export function getUpgradeDefinition(key: EconomyUpgradeKey): EconomyUpgradeDefinition {
  return ECONOMY_UPGRADE_DEFINITIONS[key];
}

export function getUpgradeNextCost(key: EconomyUpgradeKey, currentLevel: number): number | null {
  const definition = getUpgradeDefinition(key);

  if (currentLevel >= definition.maxLevel) {
    return null;
  }

  return definition.costs[currentLevel] ?? null;
}

export function getBossRewardForWave(wave: number): number {
  const bossIndex = Math.max(1, Math.floor(wave / 5));
  return Math.min(
    ECONOMY_REWARD_CONFIG.bossMax,
    ECONOMY_REWARD_CONFIG.bossBase + ECONOMY_REWARD_CONFIG.bossPerIndex * bossIndex
  );
}
