export type ClientAuditEventType =
  | "site_visit"
  | "user_session_started"
  | "auth_login_success"
  | "auth_login_failure"
  | "auth_logout"
  | "game_run_started"
  | "game_run_resumed"
  | "game_run_finished"
  | "game_over"
  | "boss_wave_started"
  | "ranked_submit_rejected";

export interface ClientAuditEventPayload {
  eventType: ClientAuditEventType;
  sessionId: string;
  metadata?: Record<string, unknown>;
}

const REQUEST_TIMEOUT_MS = 5000;

export class BackendAuditClient {
  private readonly baseUrl: string;

  public constructor(baseUrl = import.meta.env.VITE_API_BASE_URL?.trim()) {
    this.baseUrl = baseUrl ? baseUrl.replace(/\/+$/, "") : "";
  }

  public async sendEvent(payload: ClientAuditEventPayload, token?: string): Promise<void> {
    const body = JSON.stringify(payload);
    const abortController = new AbortController();
    const timeoutId = window.setTimeout(() => {
      abortController.abort();
    }, REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${this.baseUrl}/api/audit/events`, {
        method: "POST",
        headers: this.createHeaders(token),
        body,
        keepalive: body.length < 60000,
        signal: abortController.signal
      });

      if (!response.ok) {
        throw new Error(`Audit event rejected with status ${response.status}.`);
      }
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  private createHeaders(token: string | undefined): HeadersInit {
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return headers;
  }
}
