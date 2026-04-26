import type {
  EconomyProfileResponse,
  EconomyPurchaseResponse,
  EconomyRunFinishResponse,
  EconomyRunStartResponse,
  EconomyRunSummary,
  EconomyUpgradeKey
} from "../types/economy";

interface BackendErrorShape {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

export class BackendEconomyClientError extends Error {
  public constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "BackendEconomyClientError";
  }
}

const REQUEST_TIMEOUT_MS = 8000;

export class BackendEconomyClient {
  private readonly baseUrl: string;

  public constructor(baseUrl = import.meta.env.VITE_API_BASE_URL?.trim()) {
    this.baseUrl = baseUrl ? baseUrl.replace(/\/+$/, "") : "";
  }

  public isConfigured(): boolean {
    return true;
  }

  public fetchMe(token: string): Promise<EconomyProfileResponse> {
    return this.request<EconomyProfileResponse>("/api/economy/me", {
      headers: this.createAuthHeaders(token)
    });
  }

  public purchaseUpgrade(
    token: string,
    input: {
      upgradeKey: EconomyUpgradeKey;
      expectedLevel: number;
    }
  ): Promise<EconomyPurchaseResponse> {
    return this.request<EconomyPurchaseResponse>("/api/economy/purchase", {
      method: "POST",
      headers: this.createAuthHeaders(token),
      body: JSON.stringify(input)
    });
  }

  public startRun(
    token: string,
    input: {
      clientBuildVersion?: string;
    }
  ): Promise<EconomyRunStartResponse> {
    return this.request<EconomyRunStartResponse>("/api/economy/run/start", {
      method: "POST",
      headers: this.createAuthHeaders(token),
      body: JSON.stringify(input)
    });
  }

  public finishRun(token: string, summary: EconomyRunSummary): Promise<EconomyRunFinishResponse> {
    return this.request<EconomyRunFinishResponse>("/api/economy/run/finish", {
      method: "POST",
      headers: this.createAuthHeaders(token),
      body: JSON.stringify(summary)
    });
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    let response: Response;
    const abortController = new AbortController();
    const timeoutId = window.setTimeout(() => {
      abortController.abort();
    }, REQUEST_TIMEOUT_MS);

    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: abortController.signal
      });
    } catch (error) {
      if (abortController.signal.aborted) {
        throw new BackendEconomyClientError(
          "Экономика не ответила вовремя.",
          504,
          "request_timeout",
          error
        );
      }

      throw new BackendEconomyClientError(
        "Экономика сейчас недоступна.",
        503,
        "backend_unavailable",
        error
      );
    } finally {
      window.clearTimeout(timeoutId);
    }

    const payload = (await response
      .json()
      .catch(() => null)) as T | BackendErrorShape | null;

    if (!response.ok) {
      const errorPayload = payload as BackendErrorShape | null;

      throw new BackendEconomyClientError(
        errorPayload?.error?.message ?? "Economy request failed.",
        response.status,
        errorPayload?.error?.code ?? "request_failed",
        errorPayload?.error?.details
      );
    }

    return payload as T;
  }

  private createAuthHeaders(token: string): HeadersInit {
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    };
  }
}
