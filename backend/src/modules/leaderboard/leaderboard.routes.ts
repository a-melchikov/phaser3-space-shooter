import type { FastifyInstance } from "fastify";

import type { AppEnv } from "../../config/env.js";
import { AppError } from "../../utils/errors.js";
import { authenticateRequest } from "../auth/auth.middleware.js";
import type { FirebaseAuthService } from "../auth/auth.service.js";

import { LeaderboardController } from "./leaderboard.controller.js";
import { LeaderboardService } from "./leaderboard.service.js";

interface LeaderboardRoutesOptions {
  authService: FirebaseAuthService;
  env: AppEnv;
}

export async function leaderboardRoutes(
  fastify: FastifyInstance,
  options: LeaderboardRoutesOptions
): Promise<void> {
  const leaderboardService = new LeaderboardService(fastify.prisma);
  const controller = new LeaderboardController(leaderboardService);
  const authenticate = authenticateRequest(options.authService);
  const readRateLimitConfig = {
    config: {
      rateLimit: {
        max: options.env.RATE_LIMIT_MAX,
        timeWindow: options.env.RATE_LIMIT_WINDOW_MS
      }
    }
  } as const;
  const submitScoreHandler = options.env.RANKED_SUBMISSIONS_ENABLED
    ? controller.submitScore
    : async () => {
        throw new AppError(
          503,
          "ranked_submissions_disabled",
          "Ranked score submissions are disabled in this deployment."
        );
      };

  fastify.get("/api/leaderboard", readRateLimitConfig, controller.getLeaderboard);
  fastify.get("/api/leaderboard/top", readRateLimitConfig, controller.getTopLeaderboard);
  fastify.get(
    "/api/leaderboard/around-me",
    {
      preHandler: authenticate,
      ...readRateLimitConfig
    },
    controller.getAroundMe
  );
  fastify.post(
    "/api/leaderboard/submit",
    {
      preHandler: authenticate,
      config: {
        rateLimit: {
          max: options.env.RATE_LIMIT_MAX,
          timeWindow: options.env.RATE_LIMIT_WINDOW_MS
        }
      }
    },
    submitScoreHandler
  );
}
