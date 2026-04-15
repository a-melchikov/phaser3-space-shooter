import type { FastifyInstance } from "fastify";

import type { AppEnv } from "../../config/env.js";
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

  fastify.get("/leaderboard", controller.getLeaderboard);
  fastify.get("/leaderboard/top", controller.getTopLeaderboard);
  fastify.get("/leaderboard/around-me", { preHandler: authenticate }, controller.getAroundMe);
  fastify.post(
    "/leaderboard/submit",
    {
      preHandler: authenticate,
      config: {
        rateLimit: {
          max: options.env.RATE_LIMIT_MAX,
          timeWindow: options.env.RATE_LIMIT_WINDOW_MS
        }
      }
    },
    controller.submitScore
  );
}
