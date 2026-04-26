import { Prisma, type AuditEvent, type PrismaClient } from "@prisma/client";

import type { AuditRecordInput } from "./audit.types.js";

export type PersistedAuditMetadata = Prisma.InputJsonObject;

export interface PersistableAuditRecord extends Omit<AuditRecordInput, "metadata"> {
  metadata: PersistedAuditMetadata;
}

export class AuditRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public create(record: PersistableAuditRecord): Promise<AuditEvent> {
    return this.prisma.auditEvent.create({
      data: {
        eventType: record.eventType,
        category: record.category,
        actorType: record.actorType,
        playerId: record.playerId ?? null,
        firebaseUid: record.firebaseUid ?? null,
        sessionId: record.sessionId ?? null,
        ipAddress: record.ipAddress ?? null,
        userAgent: record.userAgent ?? null,
        route: record.route ?? null,
        source: record.source,
        requestId: record.requestId ?? null,
        status: record.status,
        metadata: record.metadata
      }
    });
  }
}
