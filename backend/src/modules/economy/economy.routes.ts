import type { FastifyInstance } from "fastify";

import type { AppEnv } from "../../config/env.js";
import { authenticateRequest } from "../auth/auth.middleware.js";
import type { FirebaseAuthService } from "../auth/auth.service.js";

import { EconomyController } from "./economy.controller.js";
import { EconomyService } from "./economy.service.js";

interface EconomyRoutesOptions {
  authService: FirebaseAuthService;
  env: AppEnv;
}

export async function economyRoutes(
  fastify: FastifyInstance,
  options: EconomyRoutesOptions
): Promise<void> {
  const economyService = new EconomyService(fastify.prisma);
  const controller = new EconomyController(economyService, fastify.audit);
  const authenticate = authenticateRequest(options.authService, fastify.audit);
  const economyRateLimitConfig = {
    config: {
      rateLimit: {
        max: options.env.RATE_LIMIT_MAX,
        timeWindow: options.env.RATE_LIMIT_WINDOW_MS
      }
    }
  } as const;

  fastify.get(
    "/api/economy/me",
    {
      preHandler: authenticate,
      ...economyRateLimitConfig
    },
    controller.getMe
  );
  fastify.post(
    "/api/economy/purchase",
    {
      preHandler: authenticate,
      ...economyRateLimitConfig
    },
    controller.purchase
  );
  fastify.post(
    "/api/economy/run/start",
    {
      preHandler: authenticate,
      ...economyRateLimitConfig
    },
    controller.startRun
  );
  fastify.post(
    "/api/economy/run/finish",
    {
      preHandler: authenticate,
      ...economyRateLimitConfig
    },
    controller.finishRun
  );
}
