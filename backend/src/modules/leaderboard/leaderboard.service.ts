import type { PrismaClient } from "@prisma/client";

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

  public constructor(prisma: PrismaClient) {
    this.repository = new LeaderboardRepository(prisma);
  }

  public getLeaderboard(limit: number, offset: number): Promise<LeaderboardPage> {
    return this.repository.getLeaderboardPage(limit, offset);
  }

  public getTopLeaderboard(query: LeaderboardTopQuery) {
    return this.repository.getLeaderboardTop(query.limit);
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
      const scoreEntry = await this.repository.createScoreEntry(tx, player.playerId, input.score, input.wave);
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
