import type { AuthService } from "../../auth/AuthService";
import type { UserSession } from "../../auth/types";
import type { RankedScorePayload, RankedScoreSubmissionOutcome } from "../types/game";

import {
  BackendLeaderboardClient,
  BackendLeaderboardClientError
} from "./BackendLeaderboardClient";
import type { AuditService } from "./AuditService";
import type { RankedScoreSubmissionService } from "./RankedScoreSubmissionService";

export class HttpRankedScoreSubmissionService implements RankedScoreSubmissionService {
  public constructor(
    private readonly authService: AuthService,
    private readonly backendLeaderboardClient: BackendLeaderboardClient,
    private readonly auditService: AuditService
  ) {}

  public async submitScore(
    result: RankedScorePayload,
    _session: UserSession
  ): Promise<RankedScoreSubmissionOutcome> {
    if (!this.backendLeaderboardClient.isConfigured()) {
      return {
        status: "unavailable",
        message: "Онлайн-таблица сейчас недоступна."
      };
    }

    const idToken = await this.authService.getIdToken();

    if (!idToken) {
      this.auditService.recordRankedSubmitRejected("missing_token", result, _session);

      return {
        status: "failed",
        message: "Не удалось подтвердить вход для отправки результата."
      };
    }

    try {
      const response = await this.backendLeaderboardClient.submitRankedScore(
        {
          score: result.score,
          wave: result.wave,
          economyRunId: result.economyRunId
        },
        idToken
      );

      return {
        status: "submitted",
        message: response.improvedBest
          ? `Новый лучший онлайн-результат: ${response.bestScore} очков, волна ${response.bestWave}.`
          : `Результат отправлен. Лучший онлайн-результат: ${response.bestScore} очков, волна ${response.bestWave}.`
      };
    } catch (error) {
      if (error instanceof BackendLeaderboardClientError) {
        if (error.statusCode === 401 || error.statusCode === 400) {
          this.auditService.recordRankedSubmitRejected("backend_rejected", result, _session, {
            status: String(error.statusCode),
            code: error.code
          });
        }

        if (error.statusCode === 503 && error.code === "ranked_submissions_disabled") {
          this.auditService.recordRankedSubmitRejected("ranked_unavailable", result, _session, {
            status: String(error.statusCode),
            code: error.code
          });
        }

        if (error.statusCode === 401) {
          return {
            status: "failed",
            message: "Отправка отклонена: нужен действующий вход через Google."
          };
        }

        if (error.statusCode === 429) {
          return {
            status: "failed",
            message: "Слишком много запросов. Попробуйте отправить результат чуть позже."
          };
        }

        if (
          error.statusCode === 503 ||
          error.statusCode === 504 ||
          error.code === "backend_unavailable" ||
          error.code === "request_timeout"
        ) {
          return {
            status: "unavailable",
            message: error.message
          };
        }

        return {
          status: "failed",
          message: error.message
        };
      }

      return {
        status: "failed",
        message: "Не удалось отправить результат из-за неизвестной ошибки."
      };
    }
  }
}
