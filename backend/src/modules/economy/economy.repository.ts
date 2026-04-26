import { Prisma, type EconomyRunReward, type EconomyRunSession, type PlayerEconomy, type PlayerUpgrade, type PrismaClient } from "@prisma/client";

import type { EconomyUpgradeKey } from "./economy.config.js";

type PrismaExecutor = PrismaClient | Prisma.TransactionClient;

export interface EconomyRunRewardCreateInput {
  playerId: string;
  runId: string;
  wave: number;
  score: number;
  baseReward: number;
  bonusReward: number;
  totalReward: number;
  metadata: Prisma.InputJsonObject;
}

export class EconomyRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public executeSerializableTransaction<T>(
    callback: (tx: Prisma.TransactionClient) => Promise<T>
  ): Promise<T> {
    return this.prisma.$transaction(callback, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });
  }

  public ensurePlayerEconomy(executor: PrismaExecutor, playerId: string): Promise<PlayerEconomy> {
    return executor.playerEconomy.upsert({
      where: {
        playerId
      },
      create: {
        playerId
      },
      update: {}
    });
  }

  public getPlayerEconomy(executor: PrismaExecutor, playerId: string): Promise<PlayerEconomy | null> {
    return executor.playerEconomy.findUnique({
      where: {
        playerId
      }
    });
  }

  public getPlayerUpgrades(executor: PrismaExecutor, playerId: string): Promise<PlayerUpgrade[]> {
    return executor.playerUpgrade.findMany({
      where: {
        playerId
      }
    });
  }

  public createRunSession(
    executor: PrismaExecutor,
    input: {
      playerId: string;
      runId: string;
      clientBuildVersion?: string;
      upgradesSnapshot: Prisma.InputJsonObject;
    }
  ): Promise<EconomyRunSession> {
    return executor.economyRunSession.create({
      data: {
        playerId: input.playerId,
        runId: input.runId,
        clientBuildVersion: input.clientBuildVersion,
        upgradesSnapshot: input.upgradesSnapshot
      }
    });
  }

  public getRunSession(executor: PrismaExecutor, playerId: string, runId: string): Promise<EconomyRunSession | null> {
    return executor.economyRunSession.findFirst({
      where: {
        playerId,
        runId
      }
    });
  }

  public getRunReward(executor: PrismaExecutor, runId: string): Promise<EconomyRunReward | null> {
    return executor.economyRunReward.findUnique({
      where: {
        runId
      }
    });
  }

  public finishRunSession(
    executor: PrismaExecutor,
    runId: string,
    metadata: Prisma.InputJsonObject
  ): Promise<EconomyRunSession> {
    return executor.economyRunSession.update({
      where: {
        runId
      },
      data: {
        status: "finished",
        finishedAt: new Date(),
        metadata
      }
    });
  }

  public createRunReward(
    executor: PrismaExecutor,
    input: EconomyRunRewardCreateInput
  ): Promise<EconomyRunReward> {
    return executor.economyRunReward.create({
      data: {
        playerId: input.playerId,
        runId: input.runId,
        wave: input.wave,
        score: input.score,
        baseReward: input.baseReward,
        bonusReward: input.bonusReward,
        totalReward: input.totalReward,
        metadata: input.metadata
      }
    });
  }

  public addShards(
    executor: PrismaExecutor,
    playerId: string,
    amount: number
  ): Promise<PlayerEconomy> {
    return executor.playerEconomy.update({
      where: {
        playerId
      },
      data: {
        shardsBalance: {
          increment: amount
        },
        lifetimeShardsEarned: {
          increment: amount
        }
      }
    });
  }

  public trySpendShards(
    executor: PrismaExecutor,
    playerId: string,
    amount: number
  ): Promise<{ count: number }> {
    return executor.playerEconomy.updateMany({
      where: {
        playerId,
        shardsBalance: {
          gte: amount
        }
      },
      data: {
        shardsBalance: {
          decrement: amount
        },
        lifetimeShardsSpent: {
          increment: amount
        }
      }
    });
  }

  public createTransaction(
    executor: PrismaExecutor,
    input: {
      playerId: string;
      type: "award" | "purchase";
      amount: number;
      reason: string;
      runId?: string;
      sourceId?: string;
      upgradeKey?: EconomyUpgradeKey;
      metadata: Prisma.InputJsonObject;
    }
  ) {
    return executor.economyTransaction.create({
      data: {
        playerId: input.playerId,
        type: input.type,
        amount: input.amount,
        reason: input.reason,
        runId: input.runId,
        sourceId: input.sourceId,
        upgradeKey: input.upgradeKey,
        metadata: input.metadata
      }
    });
  }

  public getPlayerUpgrade(
    executor: PrismaExecutor,
    playerId: string,
    upgradeKey: EconomyUpgradeKey
  ): Promise<PlayerUpgrade | null> {
    return executor.playerUpgrade.findUnique({
      where: {
        playerId_upgradeKey: {
          playerId,
          upgradeKey
        }
      }
    });
  }

  public upsertPlayerUpgrade(
    executor: PrismaExecutor,
    playerId: string,
    upgradeKey: EconomyUpgradeKey,
    level: number
  ): Promise<PlayerUpgrade> {
    return executor.playerUpgrade.upsert({
      where: {
        playerId_upgradeKey: {
          playerId,
          upgradeKey
        }
      },
      create: {
        playerId,
        upgradeKey,
        level
      },
      update: {
        level
      }
    });
  }
}
