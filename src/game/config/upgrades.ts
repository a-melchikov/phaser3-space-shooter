import {
  ECONOMY_UPGRADE_KEYS,
  type EconomyUpgradeCatalogItem,
  type EconomyUpgradeKey,
  type EconomyUpgradeLevelMap,
  type EconomyUpgradeRarity,
  type EconomyRunSummary,
  type RunUpgradeEffects
} from "../types/economy";

export const DEFAULT_UPGRADE_LEVELS: EconomyUpgradeLevelMap = {
  reinforcedHull: 0,
  calibratedCannons: 0,
  improvedReactor: 0,
  extendedPowerUps: 0,
  recoveryProtocol: 0,
  dropCalibration: 0,
  supportDrone: 0,
  twinCore: 0,
  aegisProtocol: 0
};

export const DEFAULT_RUN_UPGRADE_EFFECTS: RunUpgradeEffects = {
  maxHealthBonus: 0,
  bulletDamageMultiplier: 1,
  fireCooldownMultiplier: 1,
  powerUpDurationMultiplier: 1,
  healBonus: 0,
  dropChanceBonus: 0,
  permanentSupportDrone: false,
  supportDroneDamage: 0,
  supportDroneFireCooldownMs: 1100,
  supportDroneBossPriority: false,
  waveStartDoubleShotMs: 0,
  bossWaveShieldMs: 0
};

interface LocalUpgradeDefinition {
  key: EconomyUpgradeKey;
  rarity: EconomyUpgradeRarity;
  title: string;
  description: string;
  maxLevel: number;
  costs: readonly number[];
  effectLabels: readonly string[];
}

export const LOCAL_UPGRADE_DEFINITIONS: Record<EconomyUpgradeKey, LocalUpgradeDefinition> = {
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
    description: "Слегка ускоряет темп стрельбы.",
    maxLevel: 5,
    costs: [35, 80, 135, 200, 280],
    effectLabels: ["-3% кд", "-6% кд", "-9% кд", "-12% кд", "-15% кд"]
  },
  extendedPowerUps: {
    key: "extendedPowerUps",
    rarity: "rare",
    title: "Расширенный импульс",
    description: "Продлевает временные бонусы.",
    maxLevel: 4,
    costs: [80, 140, 220, 320],
    effectLabels: ["+5% длительности", "+10% длительности", "+15% длительности", "+20% длительности"]
  },
  recoveryProtocol: {
    key: "recoveryProtocol",
    rarity: "rare",
    title: "Протокол восстановления",
    description: "Усиливает ремонтные бонусы.",
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
    description: "Короткий double-shot импульс в начале волны.",
    maxLevel: 3,
    costs: [320, 560, 900],
    effectLabels: ["1.2с double-shot", "1.8с double-shot", "2.4с double-shot"]
  },
  aegisProtocol: {
    key: "aegisProtocol",
    rarity: "legendary",
    title: "Протокол Эгида",
    description: "Слабый shield charge в начале boss wave.",
    maxLevel: 2,
    costs: [900, 1500],
    effectLabels: ["1.2с щита на boss wave", "1.8с щита на boss wave"]
  }
};

export const ECONOMY_REWARD_VALUES = {
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

export function normalizeUpgradeLevels(
  levels: Partial<Record<EconomyUpgradeKey, number>> | undefined
): EconomyUpgradeLevelMap {
  const normalized = { ...DEFAULT_UPGRADE_LEVELS };

  ECONOMY_UPGRADE_KEYS.forEach((key) => {
    const definition = LOCAL_UPGRADE_DEFINITIONS[key];
    const level = levels?.[key] ?? 0;
    normalized[key] = Math.max(0, Math.min(definition.maxLevel, Math.floor(level)));
  });

  return normalized;
}

export function calculateRunUpgradeEffects(levelsInput: Partial<Record<EconomyUpgradeKey, number>> | undefined): RunUpgradeEffects {
  const levels = normalizeUpgradeLevels(levelsInput);
  const supportDroneLevel = levels.supportDrone;
  const twinCoreDurations = [0, 1200, 1800, 2400] as const;
  const aegisDurations = [0, 1200, 1800] as const;

  return {
    maxHealthBonus: levels.reinforcedHull * 5,
    bulletDamageMultiplier: 1 + levels.calibratedCannons * 0.03,
    fireCooldownMultiplier: Math.max(0.85, 1 - levels.improvedReactor * 0.03),
    powerUpDurationMultiplier: 1 + levels.extendedPowerUps * 0.05,
    healBonus: levels.recoveryProtocol * 6,
    dropChanceBonus: levels.dropCalibration * 0.015,
    permanentSupportDrone: supportDroneLevel > 0,
    supportDroneDamage: supportDroneLevel <= 0 ? 0 : supportDroneLevel === 1 ? 0.28 : supportDroneLevel === 2 ? 0.32 : 0.36,
    supportDroneFireCooldownMs: supportDroneLevel <= 1 ? 1100 : supportDroneLevel === 2 ? 960 : 860,
    supportDroneBossPriority: supportDroneLevel >= 3,
    waveStartDoubleShotMs: twinCoreDurations[levels.twinCore] ?? 0,
    bossWaveShieldMs: aegisDurations[levels.aegisProtocol] ?? 0
  };
}

export function createLocalEconomyCatalog(
  levelsInput: Partial<Record<EconomyUpgradeKey, number>> | undefined,
  balance: number
): EconomyUpgradeCatalogItem[] {
  const levels = normalizeUpgradeLevels(levelsInput);

  return ECONOMY_UPGRADE_KEYS.map((key) => {
    const definition = LOCAL_UPGRADE_DEFINITIONS[key];
    const level = levels[key];
    const nextCost = level >= definition.maxLevel ? null : definition.costs[level] ?? null;
    const canPurchase = nextCost !== null && balance >= nextCost;

    return {
      key,
      rarity: definition.rarity,
      title: definition.title,
      description: definition.description,
      level,
      maxLevel: definition.maxLevel,
      nextCost,
      effectLabel: level <= 0 ? "не открыто" : definition.effectLabels[Math.max(0, level - 1)] ?? "активно",
      nextEffectLabel: level >= definition.maxLevel ? null : definition.effectLabels[level] ?? null,
      canPurchase,
      unavailableReason: level >= definition.maxLevel
        ? "max level"
        : canPurchase
          ? null
          : "not enough shards"
    };
  });
}

export function estimateRunShardReward(summary: Pick<EconomyRunSummary, "wave" | "kills" | "bonuses">): number {
  const bossReward = unique(summary.kills.bossWaves)
    .reduce((sum, wave) => sum + getBossRewardForWave(wave), 0);
  const total = summary.kills.common * ECONOMY_REWARD_VALUES.commonKill
    + summary.kills.elite * ECONOMY_REWARD_VALUES.eliteKill
    + bossReward
    + unique(summary.bonuses.noDamageWaves).length * ECONOMY_REWARD_VALUES.noDamageWave
    + unique(summary.bonuses.highHpWaves).length * ECONOMY_REWARD_VALUES.highHpWave
    + unique(summary.bonuses.bossNoLifeLossWaves).length * ECONOMY_REWARD_VALUES.bossNoLifeLoss
    + unique(summary.bonuses.deathlessStreakMilestones).length * ECONOMY_REWARD_VALUES.deathlessStreakMilestone;
  const cap = Math.min(
    ECONOMY_REWARD_VALUES.maxRewardPerRun,
    Math.max(ECONOMY_REWARD_VALUES.maxRewardPerWave, summary.wave * ECONOMY_REWARD_VALUES.maxRewardPerWave)
  );

  return Math.min(total, cap);
}

function getBossRewardForWave(wave: number): number {
  const bossIndex = Math.max(1, Math.floor(wave / 5));
  return Math.min(
    ECONOMY_REWARD_VALUES.bossMax,
    ECONOMY_REWARD_VALUES.bossBase + ECONOMY_REWARD_VALUES.bossPerIndex * bossIndex
  );
}

function unique(values: readonly number[]): number[] {
  return Array.from(new Set(values.map((value) => Math.max(1, Math.floor(value)))));
}
