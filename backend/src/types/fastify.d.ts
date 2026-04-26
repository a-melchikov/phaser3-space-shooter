import type { PrismaClient } from "@prisma/client";

import type { AuthenticatedPlayer } from "../modules/auth/auth.types.js";
import type { AuditService } from "../modules/audit/audit.service.js";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
    audit: AuditService;
  }

  interface FastifyRequest {
    user?: AuthenticatedPlayer;
  }
}
