import { z } from "zod";

import { economyUpgradeKeys, type EconomyUpgradeKey, type EconomyUpgradeRarity } from "./economy.config.js";

export const economyUpgradeKeySchema = z.enum(economyUpgradeKeys);

export const economyRunStartSchema = z.object({
  clientBuildVersion: z.string().trim().min(1).max(80).optional()
}).strict();

const uniqueWaveListSchema = z.array(z.number().int().min(1).max(200)).max(200);

export const economyRunFinishSchema = z.object({
  runId: z.string().uuid(),
  score: z.number().int().min(0),
  wave: z.number().int().min(1).max(200),
  durationMs: z.number().int().min(0).max(1000 * 60 * 60 * 6),
  kills: z.object({
    common: z.number().int().min(0).max(10000),
    elite: z.number().int().min(0).max(3000),
    bossWaves: uniqueWaveListSchema
  }).strict(),
  bonuses: z.object({
    noDamageWaves: uniqueWaveListSchema,
    highHpWaves: uniqueWaveListSchema,
    bossNoLifeLossWaves: uniqueWaveListSchema,
    deathlessStreakMilestones: uniqueWaveListSchema
  }).strict()
}).strict();

export const economyPurchaseSchema = z.object({
  upgradeKey: economyUpgradeKeySchema,
  expectedLevel: z.number().int().min(0).max(100)
}).strict();

export type EconomyRunStartInput = z.infer<typeof economyRunStartSchema>;
export type EconomyRunFinishInput = z.infer<typeof economyRunFinishSchema>;
export type EconomyPurchaseInput = z.infer<typeof economyPurchaseSchema>;

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
