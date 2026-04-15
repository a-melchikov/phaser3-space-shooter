import type { PrismaClient } from "@prisma/client";

import type { AuthenticatedPlayer } from "../modules/auth/auth.types.js";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }

  interface FastifyRequest {
    user?: AuthenticatedPlayer;
  }
}
