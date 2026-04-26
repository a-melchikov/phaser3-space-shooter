import type { FastifyInstance } from "fastify";

import type { AppEnv } from "../../config/env.js";
import type { FirebaseAuthService } from "../auth/auth.service.js";

import { AuditController } from "./audit.controller.js";

interface AuditRoutesOptions {
  authService: FirebaseAuthService;
  env: AppEnv;
}

export async function auditRoutes(
  fastify: FastifyInstance,
  options: AuditRoutesOptions
): Promise<void> {
  const controller = new AuditController(fastify.audit, options.authService);

  fastify.post(
    "/api/audit/events",
    {
      config: {
        rateLimit: {
          max: options.env.AUDIT_RATE_LIMIT_MAX,
          timeWindow: options.env.AUDIT_RATE_LIMIT_WINDOW_MS
        }
      }
    },
    controller.ingestEvent
  );
}
