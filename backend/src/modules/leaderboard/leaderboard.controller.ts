import type { FastifyReply, FastifyRequest } from "fastify";

import { AppError } from "../../utils/errors.js";
import { validateWithSchema } from "../../utils/validation.js";

import type { LeaderboardService } from "./leaderboard.service.js";
import {
  leaderboardAroundMeQuerySchema,
  leaderboardQuerySchema,
  leaderboardTopQuerySchema,
  submitScoreSchema
} from "./leaderboard.types.js";

const LEADERBOARD_TOP_CACHE_CONTROL = "public, max-age=5, stale-while-revalidate=30";

export class LeaderboardController {
  public constructor(private readonly leaderboardService: LeaderboardService) {}

  public submitScore = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      throw new AppError(401, "unauthorized", "Authenticated player is required.");
    }

    const payload = validateWithSchema(submitScoreSchema, request.body);
    const result = await this.leaderboardService.submitScore(request.user, payload);

    await reply.code(201).send({
      accepted: result.accepted,
      improvedBest: result.improvedBest,
      bestScore: result.bestScore,
      bestWave: result.bestWave,
      bestScoreAt: result.bestScoreAt.toISOString(),
      rank: result.rank
    });
  };

  public getLeaderboard = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const query = validateWithSchema(leaderboardQuerySchema, request.query);
    const leaderboard = await this.leaderboardService.getLeaderboard(query.limit ?? 20, query.offset ?? 0);

    await reply.send({
      items: leaderboard.items.map((item) => ({
        rank: item.rank,
        displayName: item.displayName,
        avatarUrl: item.avatarUrl,
        bestScore: item.bestScore,
        bestWave: item.bestWave,
        bestScoreAt: item.bestScoreAt.toISOString()
      })),
      limit: leaderboard.limit,
      offset: leaderboard.offset,
      total: leaderboard.total
    });
  };

  public getTopLeaderboard = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const query = validateWithSchema(leaderboardTopQuerySchema, request.query);
    const items = await this.leaderboardService.getTopLeaderboard({
      limit: query.limit ?? 10
    });

    await reply.header("Cache-Control", LEADERBOARD_TOP_CACHE_CONTROL).send({
      items: items.map((item) => ({
        rank: item.rank,
        displayName: item.displayName,
        avatarUrl: item.avatarUrl,
        bestScore: item.bestScore,
        bestWave: item.bestWave,
        bestScoreAt: item.bestScoreAt.toISOString()
      })),
      limit: query.limit
    });
  };

  public getAroundMe = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      throw new AppError(401, "unauthorized", "Authenticated player is required.");
    }

    const query = validateWithSchema(leaderboardAroundMeQuerySchema, request.query);
    const result = await this.leaderboardService.getLeaderboardAroundPlayer(
      request.user.playerId,
      query.radius ?? 3
    );

    await reply.send({
      playerRank: result.playerRank,
      items: result.items.map((item) => ({
        rank: item.rank,
        displayName: item.displayName,
        avatarUrl: item.avatarUrl,
        bestScore: item.bestScore,
        bestWave: item.bestWave,
        bestScoreAt: item.bestScoreAt.toISOString()
      }))
    });
  };
}
