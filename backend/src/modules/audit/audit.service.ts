import type { Prisma } from "@prisma/client";
import type { FastifyBaseLogger, FastifyRequest } from "fastify";

import type { AuditRecordInput, AuditMetadata } from "./audit.types.js";
import type { AuditRepository, PersistableAuditRecord, PersistedAuditMetadata } from "./audit.repository.js";

type AuditLogger = Pick<FastifyBaseLogger, "error">;

const SENSITIVE_FIELD_PATTERN = /(authorization|bearer|token|password|secret|private.?key|api.?key|cookie|credential)/i;
const MAX_STRING_LENGTH = 1000;
const MAX_OBJECT_KEYS = 60;
const MAX_ARRAY_LENGTH = 60;
const MAX_DEPTH = 6;

export class AuditService {
  public constructor(private readonly repository: AuditRepository) {}

  public async record(record: AuditRecordInput): Promise<void> {
    const persistableRecord: PersistableAuditRecord = {
      ...record,
      metadata: sanitizeMetadata(record.metadata ?? {})
    };

    await this.repository.create(persistableRecord);
  }

  public async tryRecord(record: AuditRecordInput, logger?: AuditLogger): Promise<void> {
    try {
      await this.record(record);
    } catch (error) {
      logger?.error(
        {
          err: error,
          auditEventType: record.eventType
        },
        "Failed to persist audit event."
      );
    }
  }

  public recordFromRequest(
    request: FastifyRequest,
    record: Omit<AuditRecordInput, "ipAddress" | "userAgent" | "route" | "requestId">
  ): Promise<void> {
    return this.record({
      ...record,
      ipAddress: request.ip,
      userAgent: getHeaderValue(request.headers["user-agent"]),
      route: request.routeOptions.url ?? stripQueryString(request.url),
      requestId: String(request.id)
    });
  }

  public tryRecordFromRequest(
    request: FastifyRequest,
    record: Omit<AuditRecordInput, "ipAddress" | "userAgent" | "route" | "requestId">
  ): Promise<void> {
    return this.tryRecord(
      {
        ...record,
        ipAddress: request.ip,
        userAgent: getHeaderValue(request.headers["user-agent"]),
        route: request.routeOptions.url ?? stripQueryString(request.url),
        requestId: String(request.id)
      },
      request.log
    );
  }
}

function sanitizeMetadata(metadata: AuditMetadata): PersistedAuditMetadata {
  const sanitized = sanitizeJsonValue(metadata, 0);

  if (isJsonObject(sanitized)) {
    return sanitized;
  }

  return {};
}

function sanitizeJsonValue(value: unknown, depth: number, key = ""): Prisma.InputJsonValue | undefined {
  if (SENSITIVE_FIELD_PATTERN.test(key)) {
    return "[REDACTED]";
  }

  if (value === null) {
    return undefined;
  }

  if (typeof value === "boolean" || typeof value === "string") {
    return typeof value === "string" ? trimString(value) : value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : String(value);
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value !== "object" || depth >= MAX_DEPTH) {
    return undefined;
  }

  if (Array.isArray(value)) {
    const items: Prisma.InputJsonValue[] = [];

    for (const item of value.slice(0, MAX_ARRAY_LENGTH)) {
      const sanitizedItem = sanitizeJsonValue(item, depth + 1);

      if (sanitizedItem !== undefined) {
        items.push(sanitizedItem);
      }
    }

    return items;
  }

  const output: Record<string, Prisma.InputJsonValue> = {};
  const entries = Object.entries(value as Record<string, unknown>).slice(0, MAX_OBJECT_KEYS);

  for (const [childKey, childValue] of entries) {
    const sanitizedChild = sanitizeJsonValue(childValue, depth + 1, childKey);

    if (sanitizedChild !== undefined) {
      output[childKey] = sanitizedChild;
    }
  }

  return output as Prisma.InputJsonObject;
}

function isJsonObject(value: Prisma.InputJsonValue | undefined): value is Prisma.InputJsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function trimString(value: string): string {
  return value.length > MAX_STRING_LENGTH
    ? `${value.slice(0, MAX_STRING_LENGTH)}...`
    : value;
}

function getHeaderValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value.join(", ");
  }

  return value ?? null;
}

function stripQueryString(url: string): string {
  const queryIndex = url.indexOf("?");

  return queryIndex === -1 ? url : url.slice(0, queryIndex);
}
