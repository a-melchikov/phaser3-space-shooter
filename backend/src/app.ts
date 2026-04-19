import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import Fastify, { type FastifyInstance } from "fastify";

import { loadEnv, type AppEnv } from "./config/env.js";
import { FirebaseAuthService } from "./modules/auth/auth.service.js";
import { leaderboardRoutes } from "./modules/leaderboard/leaderboard.routes.js";
import { playersRoutes } from "./modules/players/players.routes.js";
import { prismaPlugin } from "./plugins/prisma.js";
import { AppError, isAppError } from "./utils/errors.js";
import { createLoggerOptions } from "./utils/logger.js";

function parseCorsOrigin(corsOrigin: string): true | string[] {
  if (corsOrigin.trim() === "*") {
    return true;
  }

  return corsOrigin
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function buildApp(env: AppEnv = loadEnv()): FastifyInstance {
  const app = Fastify({
    logger: createLoggerOptions(env)
  });

  const authService = new FirebaseAuthService(env);

  void app.register(sensible);
  void app.register(cors, {
    origin: parseCorsOrigin(env.CORS_ORIGIN)
  });
  void app.register(rateLimit, {
    global: false
  });
  void app.register(prismaPlugin);

  app.get("/health", async (_request, reply) => {
    try {
      await app.prisma.$queryRaw`SELECT 1`;

      return {
        status: "ok",
        database: "ok",
        authConfigured: authService.isConfigured()
      };
    } catch {
      return reply.code(503).send({
        status: "degraded",
        database: "unavailable",
        authConfigured: authService.isConfigured()
      });
    }
  });

  void app.register(async (instance) => {
    await leaderboardRoutes(instance, {
      authService,
      env
    });
    await playersRoutes(instance, {
      authService
    });
  });

  app.setNotFoundHandler((_request, reply) => {
    void reply.code(404).send({
      error: {
        code: "not_found",
        message: "Route not found."
      }
    });
  });

  app.setErrorHandler((error, request, reply) => {
    const appError = isAppError(error)
      ? error
      : new AppError(500, "internal_error", "Internal server error.");
    const exposeDetails = env.NODE_ENV !== "production";
    const responseError = exposeDetails && appError.details !== undefined
      ? {
          code: appError.code,
          message: appError.message,
          details: appError.details
        }
      : {
          code: appError.code,
          message: appError.message
        };

    request.log.error(
      {
        err: error,
        code: appError.code
      },
      appError.message
    );

    void reply.code(appError.statusCode).send({
      error: responseError
    });
  });

  return app;
}
