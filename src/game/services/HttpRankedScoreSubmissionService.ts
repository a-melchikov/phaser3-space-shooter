import type { AuthService } from "../../auth/AuthService";
import type { UserSession } from "../../auth/types";
import type { RankedScorePayload, RankedScoreSubmissionOutcome } from "../types/game";

import {
  BackendLeaderboardClient,
  BackendLeaderboardClientError
} from "./BackendLeaderboardClient";
import type { RankedScoreSubmissionService } from "./RankedScoreSubmissionService";

export class HttpRankedScoreSubmissionService implements RankedScoreSubmissionService {
  public constructor(
    private readonly authService: AuthService,
    private readonly backendLeaderboardClient: BackendLeaderboardClient
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
      return {
        status: "failed",
        message: "Не удалось подтвердить вход для отправки результата."
      };
    }

    try {
      const response = await this.backendLeaderboardClient.submitRankedScore(
        {
          score: result.score,
          wave: result.wave
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
