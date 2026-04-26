import type { FastifyReply, FastifyRequest } from "fastify";

import { AppError, isAppError } from "../../utils/errors.js";
import { validateWithSchema } from "../../utils/validation.js";
import type { AuthenticatedPlayer } from "../auth/auth.types.js";
import type { FirebaseAuthService } from "../auth/auth.service.js";

import type { AuditService } from "./audit.service.js";
import {
  auditIngestSchema,
  clientAuditEventRequiresAuth,
  normalizeClientAuditEvent
} from "./audit.types.js";

export class AuditController {
  public constructor(
    private readonly auditService: AuditService,
    private readonly authService: FirebaseAuthService
  ) {}

  public ingestEvent = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const payload = validateWithSchema(auditIngestSchema, request.body);
    const normalizedEvent = normalizeClientAuditEvent(payload);
    const authenticatedPlayer = await this.resolveOptionalAuthenticatedPlayer(
      request,
      clientAuditEventRequiresAuth(payload.eventType)
    );

    await this.auditService.recordFromRequest(request, {
      eventType: normalizedEvent.eventType,
      category: normalizedEvent.category,
      actorType: authenticatedPlayer ? "authenticated" : normalizedEvent.actorType,
      playerId: authenticatedPlayer?.playerId,
      firebaseUid: authenticatedPlayer?.firebaseUid,
      sessionId: normalizedEvent.sessionId,
      source: "frontend",
      status: normalizedEvent.status,
      metadata: normalizedEvent.metadata
    });

    await reply.code(202).send({
      accepted: true
    });
  };

  private async resolveOptionalAuthenticatedPlayer(
    request: FastifyRequest,
    required: boolean
  ): Promise<AuthenticatedPlayer | null> {
    const authorizationHeader = request.headers.authorization;

    if (!authorizationHeader) {
      if (required) {
        await this.auditService.tryRecordFromRequest(request, {
          eventType: "auth_token_invalid",
          category: "security",
          actorType: "unknown",
          source: "backend",
          status: "rejected",
          metadata: {
            reason: "missing_authorization_header",
            endpoint: "audit_ingest"
          }
        });

        throw new AppError(401, "unauthorized", "Authorization header is required.");
      }

      return null;
    }

    const token = parseBearerToken(authorizationHeader);

    if (!token) {
      await this.auditService.tryRecordFromRequest(request, {
        eventType: "auth_token_invalid",
        category: "security",
        actorType: "unknown",
        source: "backend",
        status: "rejected",
        metadata: {
          reason: "malformed_authorization_header",
          endpoint: "audit_ingest"
        }
      });

      throw new AppError(401, "unauthorized", "Authorization header must use Bearer token format.");
    }

    try {
      return await this.authService.verifyAndSyncPlayer(request.server.prisma, token);
    } catch (error) {
      const reason = isAppError(error) ? error.code : "auth_verification_failed";

      await this.auditService.tryRecordFromRequest(request, {
        eventType: "auth_token_invalid",
        category: "security",
        actorType: "unknown",
        source: "backend",
        status: "rejected",
        metadata: {
          reason,
          endpoint: "audit_ingest"
        }
      });

      throw error;
    }
  }
}

function parseBearerToken(authorizationHeader: string): string | null {
  const [scheme, token] = authorizationHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
}
