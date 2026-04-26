import type { FastifyInstance } from "fastify";

import { authenticateRequest } from "../auth/auth.middleware.js";
import type { FirebaseAuthService } from "../auth/auth.service.js";

import { PlayersController } from "./players.controller.js";
import { PlayersService } from "./players.service.js";

interface PlayersRoutesOptions {
  authService: FirebaseAuthService;
}

export async function playersRoutes(
  fastify: FastifyInstance,
  options: PlayersRoutesOptions
): Promise<void> {
  const playersService = new PlayersService(fastify.prisma);
  const controller = new PlayersController(playersService);
  const authenticate = authenticateRequest(options.authService, fastify.audit);

  fastify.get("/api/players/me", { preHandler: authenticate }, controller.getCurrentPlayer);
}
