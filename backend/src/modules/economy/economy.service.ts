import { randomUUID } from "node:crypto";

import { Prisma, type EconomyRunReward, type EconomyRunSession, type PlayerEconomy, type PrismaClient } from "@prisma/client";

import { AppError } from "../../utils/errors.js";
import type { AuthenticatedPlayer } from "../auth/auth.types.js";

import {
  ECONOMY_REWARD_CONFIG,
  ECONOMY_UPGRADE_DEFINITIONS,
  ECONOMY_VALIDATION_CONFIG,
  economyUpgradeKeys,
  getBossRewardForWave,
  getUpgradeDefinition,
  getUpgradeNextCost,
  type EconomyUpgradeKey
} from "./economy.config.js";
import { EconomyRepository } from "./economy.repository.js";
import type {
  EconomyCurrencyState,
  EconomyProfileResponse,
  EconomyPurchaseInput,
  EconomyPurchaseResponse,
  EconomyRewardBreakdown,
  EconomyRunFinishInput,
  EconomyRunFinishResponse,
  EconomyRunStartInput,
  EconomyRunStartResponse,
  EconomyUpgradeCatalogItem,
  EconomyUpgradeLevelMap
} from "./economy.types.js";

interface CalculatedReward {
  baseReward: number;
  bonusReward: number;
  totalReward: number;
  uncappedTotalReward: number;
  capped: boolean;
  suspiciousReasons: string[];
  breakdown: EconomyRewardBreakdown;
  metadata: Prisma.InputJsonObject;
}

export class EconomyService {
  private readonly repository: EconomyRepository;

  public constructor(prisma: PrismaClient) {
    this.repository = new EconomyRepository(prisma);
  }

  public async getProfile(player: AuthenticatedPlayer): Promise<EconomyProfileResponse> {
    return this.repository.executeSerializableTransaction(async (tx) => {
      const economy = await this.repository.ensurePlayerEconomy(tx, player.playerId);
      const upgrades = await this.getUpgradeLevelMap(tx, player.playerId);

      return this.createProfileResponse(economy, upgrades);
    });
  }

  public async startRun(
    player: AuthenticatedPlayer,
    input: EconomyRunStartInput
  ): Promise<EconomyRunStartResponse> {
    return this.repository.executeSerializableTransaction(async (tx) => {
      await this.repository.ensurePlayerEconomy(tx, player.playerId);
      const upgrades = await this.getUpgradeLevelMap(tx, player.playerId);
      const runId = randomUUID();
      const run = await this.repository.createRunSession(tx, {
        playerId: player.playerId,
        runId,
        clientBuildVersion: input.clientBuildVersion,
        upgradesSnapshot: upgrades as unknown as Prisma.InputJsonObject
      });

      return {
        runId,
        upgrades,
        startedAt: run.startedAt.toISOString()
      };
    });
  }

  public async finishRun(
    player: AuthenticatedPlayer,
    input: EconomyRunFinishInput
  ): Promise<EconomyRunFinishResponse> {
    return this.repository.executeSerializableTransaction(async (tx) => {
      const economy = await this.repository.ensurePlayerEconomy(tx, player.playerId);
      const run = await this.repository.getRunSession(tx, player.playerId, input.runId);

      if (!run) {
        throw new AppError(404, "economy_run_not_found", "Economy run session was not found.");
      }

      const existingReward = await this.repository.getRunReward(tx, input.runId);
      if (existingReward) {
        const currentEconomy = await this.repository.getPlayerEconomy(tx, player.playerId) ?? economy;
        return this.createDuplicateFinishResponse(existingReward, currentEconomy);
      }

      const calculated = this.calculateReward(input, run);
      const finishedRun = await this.repository.finishRunSession(tx, input.runId, calculated.metadata);
      const reward = await this.repository.createRunReward(tx, {
        playerId: player.playerId,
        runId: input.runId,
        wave: input.wave,
        score: input.score,
        baseReward: calculated.baseReward,
        bonusReward: calculated.bonusReward,
        totalReward: calculated.totalReward,
        metadata: calculated.metadata
      });
      const updatedEconomy = calculated.totalReward > 0
        ? await this.repository.addShards(tx, player.playerId, calculated.totalReward)
        : economy;

      if (calculated.totalReward > 0) {
        await this.repository.createTransaction(tx, {
          playerId: player.playerId,
          type: "award",
          amount: calculated.totalReward,
          reason: "run_reward",
          runId: input.runId,
          sourceId: reward.id,
          metadata: {
            score: input.score,
            wave: input.wave,
            finalizedAt: finishedRun.finishedAt?.toISOString() ?? new Date().toISOString(),
            breakdown: calculated.breakdown as unknown as Prisma.InputJsonObject,
            capped: calculated.capped,
            suspiciousReasons: calculated.suspiciousReasons
          }
        });
      }

      return {
        status: "awarded",
        runId: input.runId,
        baseReward: calculated.baseReward,
        bonusReward: calculated.bonusReward,
        totalReward: calculated.totalReward,
        balance: updatedEconomy.shardsBalance,
        capped: calculated.capped,
        suspicious: calculated.suspiciousReasons.length > 0,
        suspiciousReasons: calculated.suspiciousReasons,
        breakdown: calculated.breakdown
      };
    });
  }

  public async purchaseUpgrade(
    player: AuthenticatedPlayer,
    input: EconomyPurchaseInput
  ): Promise<EconomyPurchaseResponse> {
    return this.repository.executeSerializableTransaction(async (tx) => {
      await this.repository.ensurePlayerEconomy(tx, player.playerId);

      const currentUpgrade = await this.repository.getPlayerUpgrade(tx, player.playerId, input.upgradeKey);
      const currentLevel = currentUpgrade?.level ?? 0;
      const definition = getUpgradeDefinition(input.upgradeKey);

      if (currentLevel !== input.expectedLevel) {
        throw new AppError(409, "upgrade_level_changed", "Upgrade level changed. Refresh economy state and retry.", {
          upgradeKey: input.upgradeKey,
          expectedLevel: input.expectedLevel,
          currentLevel
        });
      }

      if (currentLevel >= definition.maxLevel) {
        throw new AppError(400, "upgrade_max_level", "Upgrade is already at max level.", {
          upgradeKey: input.upgradeKey,
          currentLevel,
          maxLevel: definition.maxLevel
        });
      }

      const cost = getUpgradeNextCost(input.upgradeKey, currentLevel);
      if (cost === null) {
        throw new AppError(400, "upgrade_max_level", "Upgrade is already at max level.");
      }

      const spendResult = await this.repository.trySpendShards(tx, player.playerId, cost);
      if (spendResult.count <= 0) {
        throw new AppError(400, "insufficient_shards", "Not enough shards to purchase this upgrade.", {
          upgradeKey: input.upgradeKey,
          cost
        });
      }

      const nextLevel = currentLevel + 1;
      await this.repository.upsertPlayerUpgrade(tx, player.playerId, input.upgradeKey, nextLevel);
      await this.repository.createTransaction(tx, {
        playerId: player.playerId,
        type: "purchase",
        amount: -cost,
        reason: "upgrade_purchase",
        upgradeKey: input.upgradeKey,
        metadata: {
          upgradeKey: input.upgradeKey,
          previousLevel: currentLevel,
          nextLevel,
          cost
        }
      });

      const updatedEconomy = await this.repository.getPlayerEconomy(tx, player.playerId);
      if (!updatedEconomy) {
        throw new Error(`Player economy ${player.playerId} is missing after purchase.`);
      }

      const upgrades = await this.getUpgradeLevelMap(tx, player.playerId);

      return {
        upgradeKey: input.upgradeKey,
        level: nextLevel,
        spent: cost,
        currency: this.createCurrencyState(updatedEconomy),
        catalog: this.createCatalog(upgrades, updatedEconomy.shardsBalance)
      };
    });
  }

  private async getUpgradeLevelMap(
    executor: Prisma.TransactionClient,
    playerId: string
  ): Promise<EconomyUpgradeLevelMap> {
    const rows = await this.repository.getPlayerUpgrades(executor, playerId);
    const levels = createEmptyUpgradeLevelMap();

    rows.forEach((row) => {
      if (isEconomyUpgradeKey(row.upgradeKey)) {
        const maxLevel = ECONOMY_UPGRADE_DEFINITIONS[row.upgradeKey].maxLevel;
        levels[row.upgradeKey] = Math.max(0, Math.min(maxLevel, row.level));
      }
    });

    return levels;
  }

  private createProfileResponse(
    economy: PlayerEconomy,
    upgrades: EconomyUpgradeLevelMap
  ): EconomyProfileResponse {
    return {
      currency: this.createCurrencyState(economy),
      upgrades,
      catalog: this.createCatalog(upgrades, economy.shardsBalance)
    };
  }

  private createCurrencyState(economy: PlayerEconomy): EconomyCurrencyState {
    return {
      shardsBalance: economy.shardsBalance,
      lifetimeShardsEarned: economy.lifetimeShardsEarned,
      lifetimeShardsSpent: economy.lifetimeShardsSpent
    };
  }

  private createCatalog(
    upgrades: EconomyUpgradeLevelMap,
    balance: number
  ): EconomyUpgradeCatalogItem[] {
    return economyUpgradeKeys.map((key) => {
      const definition = getUpgradeDefinition(key);
      const level = upgrades[key];
      const nextCost = getUpgradeNextCost(key, level);
      const isMaxed = level >= definition.maxLevel;
      const canAfford = nextCost !== null && balance >= nextCost;

      return {
        key,
        rarity: definition.rarity,
        title: definition.title,
        description: definition.description,
        level,
        maxLevel: definition.maxLevel,
        nextCost,
        effectLabel: level <= 0
          ? "не открыто"
          : definition.effectLabels[Math.max(0, level - 1)] ?? "активно",
        nextEffectLabel: isMaxed
          ? null
          : definition.effectLabels[level] ?? null,
        canPurchase: !isMaxed && canAfford,
        unavailableReason: isMaxed
          ? "max level"
          : canAfford
            ? null
            : "not enough shards"
      };
    });
  }

  private calculateReward(input: EconomyRunFinishInput, run: EconomyRunSession): CalculatedReward {
    const suspiciousReasons: string[] = [];
    const bossWaves = uniqueSorted(input.kills.bossWaves);
    const noDamageWaves = uniqueSorted(input.bonuses.noDamageWaves);
    const highHpWaves = uniqueSorted(input.bonuses.highHpWaves);
    const bossNoLifeLossWaves = uniqueSorted(input.bonuses.bossNoLifeLossWaves);
    const deathlessStreakMilestones = uniqueSorted(input.bonuses.deathlessStreakMilestones);

    this.validateHardCaps(input, run, {
      bossWaves,
      noDamageWaves,
      highHpWaves,
      bossNoLifeLossWaves,
      deathlessStreakMilestones
    });

    if (bossWaves.length !== input.kills.bossWaves.length) {
      suspiciousReasons.push("duplicate_boss_waves");
    }
    if (noDamageWaves.length !== input.bonuses.noDamageWaves.length) {
      suspiciousReasons.push("duplicate_no_damage_waves");
    }
    if (highHpWaves.length !== input.bonuses.highHpWaves.length) {
      suspiciousReasons.push("duplicate_high_hp_waves");
    }

    const serverDurationMs = Date.now() - run.startedAt.getTime();
    const minimumDurationMs = Math.min(
      ECONOMY_VALIDATION_CONFIG.minRewardedRunDurationMs + input.wave * ECONOMY_VALIDATION_CONFIG.minDurationPerWaveMs,
      45000
    );

    if (
      input.durationMs < minimumDurationMs
      && serverDurationMs < minimumDurationMs
      && input.score > 0
    ) {
      suspiciousReasons.push("short_run_duration");
    }

    const commonReward = input.kills.common * ECONOMY_REWARD_CONFIG.commonKill;
    const eliteReward = input.kills.elite * ECONOMY_REWARD_CONFIG.eliteKill;
    const bossReward = bossWaves.reduce((sum, wave) => sum + getBossRewardForWave(wave), 0);
    const noDamageReward = noDamageWaves.length * ECONOMY_REWARD_CONFIG.noDamageWave;
    const highHpReward = highHpWaves.length * ECONOMY_REWARD_CONFIG.highHpWave;
    const bossNoLifeLossReward = bossNoLifeLossWaves.length * ECONOMY_REWARD_CONFIG.bossNoLifeLoss;
    const deathlessReward = deathlessStreakMilestones.length * ECONOMY_REWARD_CONFIG.deathlessStreakMilestone;
    const baseReward = commonReward + eliteReward + bossReward;
    const bonusReward = noDamageReward + highHpReward + bossNoLifeLossReward + deathlessReward;
    const uncappedTotalReward = baseReward + bonusReward;
    const runCap = Math.min(
      ECONOMY_REWARD_CONFIG.maxRewardPerRun,
      Math.max(ECONOMY_REWARD_CONFIG.maxRewardPerWave, input.wave * ECONOMY_REWARD_CONFIG.maxRewardPerWave)
    );
    const durationCap = suspiciousReasons.includes("short_run_duration")
      ? ECONOMY_VALIDATION_CONFIG.shortRunRewardAllowance
      : runCap;
    const totalReward = Math.min(uncappedTotalReward, durationCap);
    const capped = totalReward < uncappedTotalReward;
    const scaledBaseReward = uncappedTotalReward <= 0
      ? 0
      : Math.min(baseReward, Math.floor(totalReward * (baseReward / uncappedTotalReward)));
    const scaledBonusReward = totalReward - scaledBaseReward;
    const breakdown: EconomyRewardBreakdown = {
      commonKills: input.kills.common,
      eliteKills: input.kills.elite,
      bossKills: bossWaves.length,
      noDamageWaves: noDamageWaves.length,
      highHpWaves: highHpWaves.length,
      bossNoLifeLoss: bossNoLifeLossWaves.length,
      deathlessStreaks: deathlessStreakMilestones.length
    };
    const metadata: Prisma.InputJsonObject = {
      submitted: {
        score: input.score,
        wave: input.wave,
        durationMs: input.durationMs,
        kills: {
          common: input.kills.common,
          elite: input.kills.elite,
          bossWaves
        },
        bonuses: {
          noDamageWaves,
          highHpWaves,
          bossNoLifeLossWaves,
          deathlessStreakMilestones
        }
      },
      serverDurationMs,
      reward: {
        baseReward: scaledBaseReward,
        bonusReward: scaledBonusReward,
        totalReward,
        uncappedTotalReward,
        capped,
        breakdown: breakdown as unknown as Prisma.InputJsonObject
      },
      suspiciousReasons
    };

    return {
      baseReward: scaledBaseReward,
      bonusReward: scaledBonusReward,
      totalReward,
      uncappedTotalReward,
      capped,
      suspiciousReasons,
      breakdown,
      metadata
    };
  }

  private validateHardCaps(
    input: EconomyRunFinishInput,
    run: EconomyRunSession,
    normalized: {
      bossWaves: number[];
      noDamageWaves: number[];
      highHpWaves: number[];
      bossNoLifeLossWaves: number[];
      deathlessStreakMilestones: number[];
    }
  ): void {
    const reasons: string[] = [];
    const maxScore = ECONOMY_VALIDATION_CONFIG.maxScoreFlatPadding
      + input.wave * ECONOMY_VALIDATION_CONFIG.maxScorePerWave;

    if (input.wave > ECONOMY_VALIDATION_CONFIG.maxWave) {
      reasons.push("wave_over_cap");
    }
    if (input.score > maxScore) {
      reasons.push("score_over_cap");
    }
    if (input.kills.common > input.wave * ECONOMY_VALIDATION_CONFIG.maxCommonKillsPerWave) {
      reasons.push("common_kills_over_cap");
    }
    if (input.kills.elite > input.wave * ECONOMY_VALIDATION_CONFIG.maxEliteKillsPerWave) {
      reasons.push("elite_kills_over_cap");
    }

    const possibleBossKills = Math.floor(input.wave / 5) + ECONOMY_VALIDATION_CONFIG.maxBossKillsPadding;
    if (normalized.bossWaves.length > possibleBossKills) {
      reasons.push("boss_kills_over_cap");
    }

    normalized.bossWaves.forEach((wave) => {
      if (wave > input.wave || wave % 5 !== 0) {
        reasons.push("invalid_boss_wave");
      }
    });
    normalized.bossNoLifeLossWaves.forEach((wave) => {
      if (wave > input.wave || wave % 5 !== 0 || !normalized.bossWaves.includes(wave)) {
        reasons.push("invalid_boss_no_life_loss_wave");
      }
    });

    const waveLists = [
      normalized.noDamageWaves,
      normalized.highHpWaves,
      normalized.deathlessStreakMilestones
    ];

    waveLists.forEach((waves) => {
      if (waves.some((wave) => wave > input.wave)) {
        reasons.push("bonus_wave_over_final_wave");
      }
    });

    if (normalized.deathlessStreakMilestones.length > Math.floor(input.wave / ECONOMY_REWARD_CONFIG.deathlessStreakSize)) {
      reasons.push("deathless_streaks_over_cap");
    }

    if (run.status !== "started") {
      reasons.push("run_not_started");
    }

    if (reasons.length > 0) {
      throw new AppError(400, "economy_submission_rejected", "Economy submission failed validation.", {
        runId: input.runId,
        reasons: Array.from(new Set(reasons))
      });
    }
  }

  private createDuplicateFinishResponse(
    reward: EconomyRunReward,
    economy: PlayerEconomy
  ): EconomyRunFinishResponse {
    const metadata = isRecord(reward.metadata) ? reward.metadata : {};
    const rewardMetadata = isRecord(metadata.reward) ? metadata.reward : {};
    const breakdown = isRewardBreakdown(rewardMetadata.breakdown)
      ? rewardMetadata.breakdown
      : {
          commonKills: 0,
          eliteKills: 0,
          bossKills: 0,
          noDamageWaves: 0,
          highHpWaves: 0,
          bossNoLifeLoss: 0,
          deathlessStreaks: 0
        };
    const suspiciousReasons = Array.isArray(metadata.suspiciousReasons)
      ? metadata.suspiciousReasons.filter((item): item is string => typeof item === "string")
      : [];

    return {
      status: "duplicate",
      runId: reward.runId,
      baseReward: reward.baseReward,
      bonusReward: reward.bonusReward,
      totalReward: reward.totalReward,
      balance: economy.shardsBalance,
      capped: typeof rewardMetadata.capped === "boolean" ? rewardMetadata.capped : false,
      suspicious: suspiciousReasons.length > 0,
      suspiciousReasons,
      breakdown
    };
  }
}

function createEmptyUpgradeLevelMap(): EconomyUpgradeLevelMap {
  return economyUpgradeKeys.reduce((accumulator, key) => {
    accumulator[key] = 0;
    return accumulator;
  }, {} as EconomyUpgradeLevelMap);
}

function isEconomyUpgradeKey(value: string): value is EconomyUpgradeKey {
  return (economyUpgradeKeys as readonly string[]).includes(value);
}

function uniqueSorted(values: readonly number[]): number[] {
  return Array.from(new Set(values.map((value) => Math.floor(value)))).sort((left, right) => left - right);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRewardBreakdown(value: unknown): value is EconomyRewardBreakdown {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.commonKills === "number"
    && typeof value.eliteKills === "number"
    && typeof value.bossKills === "number"
    && typeof value.noDamageWaves === "number"
    && typeof value.highHpWaves === "number"
    && typeof value.bossNoLifeLoss === "number"
    && typeof value.deathlessStreaks === "number";
}
