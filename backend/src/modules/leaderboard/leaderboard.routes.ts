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
  const controller = new LeaderboardController(leaderboardService, fastify.audit);
  const authenticate = authenticateRequest(options.authService, fastify.audit);
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
    : async (request: Parameters<typeof controller.submitScore>[0]) => {
        await fastify.audit.tryRecordFromRequest(request, {
          eventType: "ranked_submit_rejected",
          category: "leaderboard",
          actorType: request.user ? "authenticated" : "unknown",
          playerId: request.user?.playerId,
          firebaseUid: request.user?.firebaseUid,
          source: "backend",
          status: "rejected",
          metadata: {
            reason: "ranked_submissions_disabled"
          }
        });
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
