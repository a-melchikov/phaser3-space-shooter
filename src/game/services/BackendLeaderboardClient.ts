import type {
  AroundMeLeaderboardResponse,
  LeaderboardResponse,
  LeaderboardTopResponse,
  PlayerLeaderboardProfile,
  RankedSubmitResponse
} from "../types/game";

interface BackendErrorShape {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

export class BackendLeaderboardClientError extends Error {
  public constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "BackendLeaderboardClientError";
  }
}

export class BackendLeaderboardClient {
  private readonly baseUrl: string;

  public constructor(baseUrl = import.meta.env.VITE_API_BASE_URL?.trim()) {
    this.baseUrl = baseUrl ? baseUrl.replace(/\/+$/, "") : "";
  }

  public isConfigured(): boolean {
    return true;
  }

  public submitRankedScore(
    result: {
      score: number;
      wave: number;
    },
    token: string
  ): Promise<RankedSubmitResponse> {
    return this.request<RankedSubmitResponse>("/api/leaderboard/submit", {
      method: "POST",
      headers: this.createAuthHeaders(token),
      body: JSON.stringify(result)
    });
  }

  public fetchLeaderboard(params: { limit?: number; offset?: number } = {}): Promise<LeaderboardResponse> {
    const query = new URLSearchParams();

    if (typeof params.limit === "number") {
      query.set("limit", String(params.limit));
    }

    if (typeof params.offset === "number") {
      query.set("offset", String(params.offset));
    }

    return this.request<LeaderboardResponse>(`/api/leaderboard${this.getQuerySuffix(query)}`);
  }

  public fetchLeaderboardTop(limit?: number): Promise<LeaderboardTopResponse> {
    const query = new URLSearchParams();

    if (typeof limit === "number") {
      query.set("limit", String(limit));
    }

    return this.request<LeaderboardTopResponse>(`/api/leaderboard/top${this.getQuerySuffix(query)}`);
  }

  public fetchLeaderboardAroundMe(token: string, radius?: number): Promise<AroundMeLeaderboardResponse> {
    const query = new URLSearchParams();

    if (typeof radius === "number") {
      query.set("radius", String(radius));
    }

    return this.request<AroundMeLeaderboardResponse>(
      `/api/leaderboard/around-me${this.getQuerySuffix(query)}`,
      {
        headers: this.createAuthHeaders(token)
      }
    );
  }

  public fetchMyProfile(token: string): Promise<PlayerLeaderboardProfile> {
    return this.request<PlayerLeaderboardProfile>("/api/players/me", {
      headers: this.createAuthHeaders(token)
    });
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    let response: Response;

    try {
      response = await fetch(`${this.baseUrl}${path}`, init);
    } catch (error) {
      throw new BackendLeaderboardClientError(
        "Онлайн-таблица сейчас недоступна.",
        503,
        "backend_unavailable",
        error
      );
    }

    const payload = (await response
      .json()
      .catch(() => null)) as T | BackendErrorShape | null;

    if (!response.ok) {
      const errorPayload = payload as BackendErrorShape | null;

      throw new BackendLeaderboardClientError(
        errorPayload?.error?.message ?? "Leaderboard request failed.",
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

  private getQuerySuffix(query: URLSearchParams): string {
    const value = query.toString();
    return value ? `?${value}` : "";
  }
}
