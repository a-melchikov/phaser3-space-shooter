import type { PrismaClient } from "@prisma/client";

import { AppError } from "../../utils/errors.js";
import type { AuthenticatedPlayer } from "../auth/auth.types.js";

import type {
  AroundMeLeaderboard,
  LeaderboardPage,
  LeaderboardTopQuery,
  SubmitScoreInput,
  SubmitScoreResult
} from "./leaderboard.types.js";
import { LeaderboardRepository } from "./leaderboard.repository.js";

export class LeaderboardService {
  private readonly repository: LeaderboardRepository;
  private readonly topLeaderboardCache = new Map<number, { expiresAt: number; items: Awaited<ReturnType<LeaderboardRepository["getLeaderboardTop"]>> }>();
  private static readonly TOP_LEADERBOARD_CACHE_TTL_MS = 5000;

  public constructor(prisma: PrismaClient) {
    this.repository = new LeaderboardRepository(prisma);
  }

  public getLeaderboard(limit: number, offset: number): Promise<LeaderboardPage> {
    return this.repository.getLeaderboardPage(limit, offset);
  }

  public async getTopLeaderboard(query: LeaderboardTopQuery) {
    const now = Date.now();
    const cached = this.topLeaderboardCache.get(query.limit);

    if (cached && cached.expiresAt > now) {
      return cached.items;
    }

    const items = await this.repository.getLeaderboardTop(query.limit);
    this.topLeaderboardCache.set(query.limit, {
      items,
      expiresAt: now + LeaderboardService.TOP_LEADERBOARD_CACHE_TTL_MS
    });

    return items;
  }

  public getLeaderboardAroundPlayer(playerId: string, radius: number): Promise<AroundMeLeaderboard> {
    return this.repository.getAroundPlayer(playerId, radius);
  }

  public getPlayerRank(playerId: string): Promise<number | null> {
    return this.repository.getPlayerRank(playerId);
  }

  public async submitScore(
    player: AuthenticatedPlayer,
    input: SubmitScoreInput
  ): Promise<SubmitScoreResult> {
    const submissionResult = await this.repository.executeTransaction(async (tx) => {
      if (input.economyRunId) {
        const economyRun = await this.repository.getPlayerEconomyRun(tx, player.playerId, input.economyRunId);

        if (!economyRun) {
          throw new AppError(400, "invalid_economy_run", "Economy run is not finished or does not belong to this player.");
        }
      }

      const scoreEntry = await this.repository.createScoreEntry(
        tx,
        player.playerId,
        input.score,
        input.wave,
        input.economyRunId
      );
      const updateResult = await this.repository.tryUpdatePlayerBest(
        tx,
        player.playerId,
        input.score,
        input.wave,
        scoreEntry.createdAt
      );
      const currentBest = await this.repository.getPlayerBestState(tx, player.playerId);

      if (!currentBest) {
        throw new Error(`Player ${player.playerId} is missing after score submission.`);
      }

      return {
        improvedBest: updateResult.count > 0,
        bestScore: currentBest.bestScore ?? input.score,
        bestWave: currentBest.bestWave ?? input.wave,
        bestScoreAt: currentBest.bestScoreAt ?? scoreEntry.createdAt
      };
    });

    const rank = await this.repository.getPlayerRank(player.playerId);
    this.topLeaderboardCache.clear();

    return {
      accepted: true,
      improvedBest: submissionResult.improvedBest,
      bestScore: submissionResult.bestScore,
      bestWave: submissionResult.bestWave,
      bestScoreAt: submissionResult.bestScoreAt,
      rank
    };
  }
}
