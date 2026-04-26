import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";

import { loadEnv, type AppEnv } from "./config/env.js";
import { auditPlugin } from "./modules/audit/audit.plugin.js";
import { auditRoutes } from "./modules/audit/audit.routes.js";
import type { AuditActorType } from "./modules/audit/audit.types.js";
import { FirebaseAuthService } from "./modules/auth/auth.service.js";
import { economyRoutes } from "./modules/economy/economy.routes.js";
import { leaderboardRoutes } from "./modules/leaderboard/leaderboard.routes.js";
import { playersRoutes } from "./modules/players/players.routes.js";
import { prismaPlugin } from "./plugins/prisma.js";
import { AppError, isAppError } from "./utils/errors.js";
import { createLoggerOptions, createRequestId } from "./utils/logger.js";

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
    logger: createLoggerOptions(env),
    genReqId: createRequestId,
    requestIdHeader: "x-request-id",
    requestIdLogLabel: "requestId"
  });

  const authService = new FirebaseAuthService(env);

  void app.register(sensible);
  void app.register(cors, {
    origin: parseCorsOrigin(env.CORS_ORIGIN)
  });
  void app.register(prismaPlugin);
  void app.register(auditPlugin);
  void app.register(rateLimit, {
    global: false,
    onExceeded: (request, key) => {
      void request.server.audit.tryRecordFromRequest(request, {
        eventType: "rate_limit_triggered",
        category: "security",
        actorType: resolveActorType(request),
        playerId: request.user?.playerId,
        firebaseUid: request.user?.firebaseUid,
        source: "backend",
        status: "rejected",
        metadata: {
          key,
          method: request.method
        }
      });
    }
  });

  app.get("/health", async (_request, reply) => {
    try {
      await app.prisma.$queryRaw`SELECT 1`;

      return {
        status: "ok",
        database: "ok"
      };
    } catch {
      return reply.code(503).send({
        status: "degraded",
        database: "unavailable"
      });
    }
  });

  void app.register(async (instance) => {
    await auditRoutes(instance, {
      authService,
      env
    });
    await economyRoutes(instance, {
      authService,
      env
    });
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

  app.setErrorHandler(async (error, request, reply) => {
    const appError = normalizeError(error);
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

    await auditRequestError(request, appError);

    await reply.code(appError.statusCode).send({
      error: responseError
    });
  });

  return app;
}

function normalizeError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (isHttpError(error)) {
    const statusCode = error.statusCode;
    const code = statusCode === 429
      ? "rate_limit_exceeded"
      : typeof error.code === "string"
        ? error.code
        : "request_error";
    const message = statusCode >= 500
      ? "Internal server error."
      : error.message || "Request failed.";

    return new AppError(statusCode, code, message);
  }

  return new AppError(500, "internal_error", "Internal server error.");
}

function isHttpError(error: unknown): error is { statusCode: number; code?: string; message?: string } {
  return typeof error === "object"
    && error !== null
    && "statusCode" in error
    && typeof error.statusCode === "number"
    && error.statusCode >= 400
    && error.statusCode <= 599;
}

async function auditRequestError(request: FastifyRequest, appError: AppError): Promise<void> {
  if (appError.code === "validation_error") {
    await request.server.audit.tryRecordFromRequest(request, {
      eventType: "invalid_payload",
      category: "security",
      actorType: resolveActorType(request),
      playerId: request.user?.playerId,
      firebaseUid: request.user?.firebaseUid,
      source: "backend",
      status: "rejected",
      metadata: {
        code: appError.code,
        statusCode: appError.statusCode,
        method: request.method
      }
    });
    return;
  }

  if (appError.statusCode >= 500) {
    await request.server.audit.tryRecordFromRequest(request, {
      eventType: "api_error",
      category: "api",
      actorType: resolveActorType(request),
      playerId: request.user?.playerId,
      firebaseUid: request.user?.firebaseUid,
      source: "backend",
      status: "error",
      metadata: {
        code: appError.code,
        statusCode: appError.statusCode,
        method: request.method
      }
    });
  }
}

function resolveActorType(request: FastifyRequest): AuditActorType {
  return request.user ? "authenticated" : "unknown";
}
