import type { FastifyReply, FastifyRequest } from "fastify";

import { AppError } from "../../utils/errors.js";
import type { AuditService } from "../audit/audit.service.js";

import type { FirebaseAuthService } from "./auth.service.js";

export function authenticateRequest(authService: FirebaseAuthService, auditService?: AuditService) {
  return async function onRequest(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const authorizationHeader = request.headers.authorization;

    if (!authorizationHeader) {
      await auditAuthFailure(request, auditService, "missing_authorization_header");
      throw new AppError(401, "unauthorized", "Authorization header is required.");
    }

    const [scheme, token] = authorizationHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
      await auditAuthFailure(request, auditService, "malformed_authorization_header");
      throw new AppError(401, "unauthorized", "Authorization header must use Bearer token format.");
    }

    try {
      request.user = await authService.verifyAndSyncPlayer(request.server.prisma, token);
    } catch (error) {
      await auditAuthFailure(
        request,
        auditService,
        error instanceof AppError ? error.code : "auth_verification_failed"
      );
      throw error;
    }
  };
}

async function auditAuthFailure(
  request: FastifyRequest,
  auditService: AuditService | undefined,
  reason: string
): Promise<void> {
  const isRankedSubmission = request.method === "POST" && request.url.startsWith("/api/leaderboard/submit");

  await auditService?.tryRecordFromRequest(request, {
    eventType: isRankedSubmission ? "ranked_submit_rejected" : "auth_token_invalid",
    category: "security",
    actorType: "unknown",
    source: "backend",
    status: "rejected",
    metadata: {
      reason,
      method: request.method,
      protectedRoute: true
    }
  });
}
