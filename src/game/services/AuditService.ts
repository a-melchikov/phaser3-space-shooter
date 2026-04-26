import type { AuthService } from "../../auth/AuthService";
import type { UserSession } from "../../auth/types";
import type { CompletedRunResult, GameStartPayload, SessionPresentation } from "../types/game";

import type { BackendAuditClient, ClientAuditEventType } from "./BackendAuditClient";

type RankedSubmitRejectedReason =
  | "guest_session"
  | "local_only_run"
  | "missing_token"
  | "backend_rejected"
  | "ranked_unavailable";

const AUDIT_SESSION_STORAGE_KEY = "starfall-aegis:audit-session-id";

export class AuditService {
  private readonly sessionId = getOrCreateAuditSessionId();

  public constructor(
    private readonly authService: AuthService,
    private readonly auditClient: BackendAuditClient
  ) {}

  public recordSiteVisit(): void {
    this.record("site_visit", {
      path: `${window.location.pathname}${window.location.search}`,
      referrer: document.referrer || undefined,
      visibilityState: document.visibilityState
    });
  }

  public recordUserSessionStarted(session: UserSession, hasSavedRun: boolean): void {
    this.record(
      "user_session_started",
      {
        mode: session.mode,
        provider: session.provider,
        rankedEligible: session.rankedEligible,
        hasSavedRun
      },
      session.isAuthenticated
    );
  }

  public recordAuthLoginSuccess(session: UserSession): void {
    this.record(
      "auth_login_success",
      {
        provider: "google"
      },
      session.isAuthenticated
    );
  }

  public recordAuthLoginFailure(reasonCode: string | undefined): void {
    this.record("auth_login_failure", {
      provider: "google",
      reasonCode
    });
  }

  public recordAuthLogout(session: UserSession, token?: string | null): void {
    if (token !== undefined) {
      this.send("auth_logout", {
        provider: "google"
      }, token ?? undefined);
      return;
    }

    this.record("auth_logout", {
      provider: "google"
    }, session.isAuthenticated);
  }

  public recordGameRunStart(payload: GameStartPayload): void {
    const session = payload.session;

    if (payload.source === "resume" && payload.savedRun) {
      this.record(
        "game_run_resumed",
        {
          wave: payload.savedRun.run.wave,
          score: payload.savedRun.run.score,
          waveKind: payload.savedRun.run.waveKind,
          bossActive: payload.savedRun.run.boss.active,
          mode: session.mode,
          rankedEligible: session.rankedEligible
        },
        shouldAttachAuth(session)
      );
      return;
    }

    this.record(
      "game_run_started",
      {
        source: payload.source === "gameover" ? "gameover" : "menu",
        mode: session.mode,
        rankedEligible: session.rankedEligible
      },
      shouldAttachAuth(session)
    );
  }

  public recordBossWaveStarted(wave: number, score: number): void {
    const session = this.authService.getSession();

    this.record("boss_wave_started", {
      wave,
      score
    }, session.isAuthenticated);
  }

  public recordGameRunFinished(result: CompletedRunResult, session: UserSession): void {
    const metadata = this.createCompletedRunMetadata(result, session);

    this.record("game_run_finished", metadata, session.isAuthenticated);
  }

  public recordGameOver(result: CompletedRunResult, session: UserSession): void {
    const metadata = this.createCompletedRunMetadata(result, session);

    this.record("game_over", metadata, session.isAuthenticated);
  }

  public recordRankedSubmitRejected(
    reason: RankedSubmitRejectedReason,
    result: Pick<CompletedRunResult, "score" | "wave"> | null,
    session: UserSession,
    details: {
      status?: string;
      code?: string;
    } = {}
  ): void {
    this.record(
      "ranked_submit_rejected",
      {
        reason,
        score: result?.score,
        wave: result?.wave,
        status: details.status,
        code: details.code
      },
      session.isAuthenticated
    );
  }

  private createCompletedRunMetadata(
    result: CompletedRunResult,
    session: UserSession
  ): Record<string, unknown> {
    return {
      score: result.score,
      wave: result.wave,
      completedAt: result.completedAt,
      rankedSubmissionAllowed: result.rankedSubmissionAllowed,
      mode: session.mode,
      rankedEligible: session.rankedEligible
    };
  }

  private record(
    eventType: ClientAuditEventType,
    metadata: Record<string, unknown>,
    includeAuth = false
  ): void {
    void this.dispatch(eventType, metadata, includeAuth);
  }

  private async dispatch(
    eventType: ClientAuditEventType,
    metadata: Record<string, unknown>,
    includeAuth: boolean
  ): Promise<void> {
    const token = includeAuth ? await this.getIdTokenSafely() : null;

    this.send(eventType, metadata, token ?? undefined);
  }

  private send(
    eventType: ClientAuditEventType,
    metadata: Record<string, unknown>,
    token: string | undefined
  ): void {
    void this.auditClient.sendEvent({
      eventType,
      sessionId: this.sessionId,
      metadata: pruneUndefined(metadata)
    }, token).catch(() => undefined);
  }

  private async getIdTokenSafely(): Promise<string | null> {
    try {
      return await this.authService.getIdToken();
    } catch {
      return null;
    }
  }
}

function shouldAttachAuth(session: SessionPresentation): boolean {
  return session.mode === "google" && session.rankedEligible;
}

function getOrCreateAuditSessionId(): string {
  try {
    const existingSessionId = window.sessionStorage.getItem(AUDIT_SESSION_STORAGE_KEY);

    if (existingSessionId) {
      return existingSessionId;
    }

    const sessionId = createSessionId();
    window.sessionStorage.setItem(AUDIT_SESSION_STORAGE_KEY, sessionId);
    return sessionId;
  } catch {
    return createSessionId();
  }
}

function createSessionId(): string {
  if (typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function pruneUndefined(metadata: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined)
  );
}
