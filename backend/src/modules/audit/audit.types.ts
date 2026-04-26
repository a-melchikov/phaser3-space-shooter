import { z } from "zod";

import { AppError } from "../../utils/errors.js";

export const auditEventTypes = [
  "site_visit",
  "user_session_started",
  "auth_login_success",
  "auth_login_failure",
  "auth_logout",
  "game_run_started",
  "game_run_resumed",
  "game_run_finished",
  "game_over",
  "boss_wave_started",
  "ranked_submit_accepted",
  "ranked_submit_rejected",
  "economy_run_started",
  "economy_run_finished",
  "shards_awarded",
  "upgrade_purchased",
  "economy_submission_rejected",
  "suspicious_economy_submission",
  "guest_economy_attempt",
  "invalid_payload",
  "auth_token_invalid",
  "suspicious_request",
  "rate_limit_triggered",
  "api_error"
] as const;

export type AuditEventType = (typeof auditEventTypes)[number];

export const clientAuditEventTypes = [
  "site_visit",
  "user_session_started",
  "auth_login_success",
  "auth_login_failure",
  "auth_logout",
  "game_run_started",
  "game_run_resumed",
  "game_run_finished",
  "game_over",
  "boss_wave_started",
  "ranked_submit_rejected"
] as const;

export type ClientAuditEventType = (typeof clientAuditEventTypes)[number];

export type AuditCategory = "visit" | "auth" | "gameplay" | "leaderboard" | "economy" | "security" | "api";
export type AuditActorType = "guest" | "authenticated" | "system" | "unknown";
export type AuditEventStatus = "info" | "success" | "failure" | "rejected" | "error";
export type AuditSource = "frontend" | "backend" | "system";
export type AuditMetadata = Record<string, unknown>;

export interface AuditRecordInput {
  eventType: AuditEventType;
  category: AuditCategory;
  actorType: AuditActorType;
  status: AuditEventStatus;
  source: AuditSource;
  playerId?: string | null;
  firebaseUid?: string | null;
  sessionId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  route?: string | null;
  requestId?: string | null;
  metadata?: AuditMetadata;
}

export interface ClientAuditDefinition {
  category: AuditCategory;
  status: AuditEventStatus;
  defaultActorType: AuditActorType;
}

export interface NormalizedClientAuditEvent {
  eventType: ClientAuditEventType;
  category: AuditCategory;
  status: AuditEventStatus;
  actorType: AuditActorType;
  sessionId?: string;
  metadata: AuditMetadata;
}

export const auditIngestSchema = z.object({
  eventType: z.enum(clientAuditEventTypes),
  sessionId: z.string().trim().min(8).max(128).optional(),
  metadata: z.unknown().optional()
}).strict();

export type AuditIngestPayload = z.infer<typeof auditIngestSchema>;

const authModeSchema = z.enum(["guest", "google"]);
const frontendGameSourceSchema = z.enum(["menu", "gameover"]);
const resumedWaveKindSchema = z.enum(["normal", "elite", "boss"]);

const metadataSchemas = {
  site_visit: z.object({
    path: z.string().trim().min(1).max(300).optional(),
    referrer: z.string().trim().max(500).optional(),
    visibilityState: z.enum(["visible", "hidden", "prerender"]).optional()
  }).strict(),
  user_session_started: z.object({
    mode: authModeSchema,
    provider: authModeSchema,
    rankedEligible: z.boolean(),
    hasSavedRun: z.boolean().optional()
  }).strict(),
  auth_login_success: z.object({
    provider: z.literal("google")
  }).strict(),
  auth_login_failure: z.object({
    provider: z.literal("google"),
    reasonCode: z.string().trim().min(1).max(100).optional()
  }).strict(),
  auth_logout: z.object({
    provider: z.literal("google")
  }).strict(),
  game_run_started: z.object({
    source: frontendGameSourceSchema,
    mode: authModeSchema,
    rankedEligible: z.boolean()
  }).strict(),
  game_run_resumed: z.object({
    wave: z.number().int().min(1),
    score: z.number().int().min(0),
    waveKind: resumedWaveKindSchema.optional(),
    bossActive: z.boolean().optional(),
    mode: authModeSchema,
    rankedEligible: z.boolean()
  }).strict(),
  game_run_finished: z.object({
    score: z.number().int().min(0),
    wave: z.number().int().min(1),
    completedAt: z.string().datetime({ offset: true }),
    rankedSubmissionAllowed: z.boolean(),
    mode: authModeSchema,
    rankedEligible: z.boolean()
  }).strict(),
  game_over: z.object({
    score: z.number().int().min(0),
    wave: z.number().int().min(1),
    completedAt: z.string().datetime({ offset: true }),
    rankedSubmissionAllowed: z.boolean(),
    mode: authModeSchema,
    rankedEligible: z.boolean()
  }).strict(),
  boss_wave_started: z.object({
    wave: z.number().int().min(1),
    score: z.number().int().min(0)
  }).strict(),
  ranked_submit_rejected: z.object({
    reason: z.enum([
      "guest_session",
      "local_only_run",
      "missing_token",
      "backend_rejected",
      "ranked_unavailable"
    ]),
    score: z.number().int().min(0).optional(),
    wave: z.number().int().min(1).optional(),
    status: z.string().trim().min(1).max(40).optional(),
    code: z.string().trim().min(1).max(100).optional()
  }).strict()
} satisfies Record<ClientAuditEventType, z.ZodType<AuditMetadata>>;

const clientAuditDefinitions: Record<ClientAuditEventType, ClientAuditDefinition> = {
  site_visit: {
    category: "visit",
    status: "info",
    defaultActorType: "guest"
  },
  user_session_started: {
    category: "visit",
    status: "success",
    defaultActorType: "guest"
  },
  auth_login_success: {
    category: "auth",
    status: "success",
    defaultActorType: "authenticated"
  },
  auth_login_failure: {
    category: "auth",
    status: "failure",
    defaultActorType: "guest"
  },
  auth_logout: {
    category: "auth",
    status: "success",
    defaultActorType: "authenticated"
  },
  game_run_started: {
    category: "gameplay",
    status: "success",
    defaultActorType: "guest"
  },
  game_run_resumed: {
    category: "gameplay",
    status: "success",
    defaultActorType: "guest"
  },
  game_run_finished: {
    category: "gameplay",
    status: "success",
    defaultActorType: "guest"
  },
  game_over: {
    category: "gameplay",
    status: "success",
    defaultActorType: "guest"
  },
  boss_wave_started: {
    category: "gameplay",
    status: "info",
    defaultActorType: "guest"
  },
  ranked_submit_rejected: {
    category: "leaderboard",
    status: "rejected",
    defaultActorType: "guest"
  }
};

const authenticatedClientEvents = new Set<ClientAuditEventType>([
  "auth_login_success",
  "auth_logout"
]);

export function clientAuditEventRequiresAuth(eventType: ClientAuditEventType): boolean {
  return authenticatedClientEvents.has(eventType);
}

export function normalizeClientAuditEvent(payload: AuditIngestPayload): NormalizedClientAuditEvent {
  const definition = clientAuditDefinitions[payload.eventType];
  const metadataSchema = metadataSchemas[payload.eventType];
  const metadataResult = metadataSchema.safeParse(payload.metadata ?? {});

  if (!metadataResult.success) {
    throw new AppError(
      400,
      "validation_error",
      "Audit event metadata validation failed.",
      metadataResult.error.flatten()
    );
  }

  return {
    eventType: payload.eventType,
    category: definition.category,
    status: definition.status,
    actorType: definition.defaultActorType,
    sessionId: payload.sessionId,
    metadata: metadataResult.data
  };
}
