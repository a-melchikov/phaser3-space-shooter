import { Prisma, type PrismaClient, type ScoreEntry } from "@prisma/client";

import type {
  AroundMeLeaderboard,
  LeaderboardEntry,
  LeaderboardPage
} from "./leaderboard.types.js";

type PrismaExecutor = PrismaClient | Prisma.TransactionClient;

interface CountRow {
  total: number;
}

interface RankRow {
  rank: number;
}

export class LeaderboardRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public executeTransaction<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(callback);
  }

  public createScoreEntry(
    executor: PrismaExecutor,
    playerId: string,
    score: number,
    wave: number
  ): Promise<ScoreEntry> {
    return executor.scoreEntry.create({
      data: {
        playerId,
        score,
        wave
      }
    });
  }

  public getPlayerBestState(executor: PrismaExecutor, playerId: string) {
    return executor.player.findUnique({
      where: {
        id: playerId
      },
      select: {
        id: true,
        bestScore: true,
        bestWave: true,
        bestScoreAt: true
      }
    });
  }

  public updatePlayerBest(
    executor: PrismaExecutor,
    playerId: string,
    score: number,
    wave: number,
    bestScoreAt: Date
  ) {
    return executor.player.update({
      where: {
        id: playerId
      },
      data: {
        bestScore: score,
        bestWave: wave,
        bestScoreAt
      },
      select: {
        bestScore: true,
        bestWave: true,
        bestScoreAt: true
      }
    });
  }

  public async getLeaderboardPage(limit: number, offset: number): Promise<LeaderboardPage> {
    const items = await this.prisma.$queryRaw<LeaderboardEntry[]>(Prisma.sql`
      WITH ranked AS (
        ${this.getRankedPlayersSql()}
      )
      SELECT
        ranked.rank,
        ranked."playerId",
        ranked."displayName",
        ranked."avatarUrl",
        ranked."bestScore",
        ranked."bestWave",
        ranked."bestScoreAt"
      FROM ranked
      ORDER BY ranked.rank
      LIMIT ${limit}
      OFFSET ${offset}
    `);

    const [countRow] = await this.prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT COUNT(*)::int AS total
      FROM "Player"
      WHERE "bestScore" IS NOT NULL
        AND "bestWave" IS NOT NULL
        AND "bestScoreAt" IS NOT NULL
    `);

    return {
      items,
      limit,
      offset,
      total: countRow?.total ?? 0
    };
  }

  public async getLeaderboardTop(limit: number): Promise<LeaderboardEntry[]> {
    const page = await this.getLeaderboardPage(limit, 0);
    return page.items;
  }

  public async getPlayerRank(playerId: string): Promise<number | null> {
    const [rankRow] = await this.prisma.$queryRaw<RankRow[]>(Prisma.sql`
      WITH ranked AS (
        ${this.getRankedPlayersSql()}
      )
      SELECT ranked.rank
      FROM ranked
      WHERE ranked."playerId" = ${playerId}
      LIMIT 1
    `);

    return rankRow?.rank ?? null;
  }

  public async getAroundPlayer(playerId: string, radius: number): Promise<AroundMeLeaderboard> {
    const playerRank = await this.getPlayerRank(playerId);

    if (playerRank === null) {
      return {
        playerRank: null,
        items: []
      };
    }

    const fromRank = Math.max(1, playerRank - radius);
    const toRank = playerRank + radius;

    const items = await this.prisma.$queryRaw<LeaderboardEntry[]>(Prisma.sql`
      WITH ranked AS (
        ${this.getRankedPlayersSql()}
      )
      SELECT
        ranked.rank,
        ranked."playerId",
        ranked."displayName",
        ranked."avatarUrl",
        ranked."bestScore",
        ranked."bestWave",
        ranked."bestScoreAt"
      FROM ranked
      WHERE ranked.rank BETWEEN ${fromRank} AND ${toRank}
      ORDER BY ranked.rank
    `);

    return {
      playerRank,
      items
    };
  }

  private getRankedPlayersSql(): Prisma.Sql {
    return Prisma.sql`
      SELECT
        p.id AS "playerId",
        p."displayName",
        p."avatarUrl",
        p."bestScore",
        p."bestWave",
        p."bestScoreAt",
        ROW_NUMBER() OVER (
          ORDER BY
            p."bestScore" DESC,
            p."bestWave" DESC,
            p."bestScoreAt" ASC,
            p.id ASC
        )::int AS rank
      FROM "Player" p
      WHERE p."bestScore" IS NOT NULL
        AND p."bestWave" IS NOT NULL
        AND p."bestScoreAt" IS NOT NULL
    `;
  }
}
