import type { FastifyReply, FastifyRequest } from "fastify";

import { AppError } from "../../utils/errors.js";

import type { FirebaseAuthService } from "./auth.service.js";

export function authenticateRequest(authService: FirebaseAuthService) {
  return async function onRequest(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const authorizationHeader = request.headers.authorization;

    if (!authorizationHeader) {
      throw new AppError(401, "unauthorized", "Authorization header is required.");
    }

    const [scheme, token] = authorizationHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
      throw new AppError(401, "unauthorized", "Authorization header must use Bearer token format.");
    }

    request.user = await authService.verifyAndSyncPlayer(request.server.prisma, token);
  };
}
