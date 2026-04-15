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
        message: "Leaderboard backend не настроен. Укажите VITE_API_BASE_URL, чтобы включить ranked submission."
      };
    }

    const idToken = await this.authService.getIdToken();

    if (!idToken) {
      return {
        status: "failed",
        message: "Не удалось получить Firebase ID token для ranked submission."
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
          ? `Новый ranked best сохранён: ${response.bestScore} очков, волна ${response.bestWave}.`
          : `Ranked result отправлен. Текущий лучший результат: ${response.bestScore} очков, волна ${response.bestWave}.`
      };
    } catch (error) {
      if (error instanceof BackendLeaderboardClientError) {
        if (error.statusCode === 401) {
          return {
            status: "failed",
            message: "Ranked submission отклонён: требуется валидная авторизованная Google-сессия."
          };
        }

        if (error.statusCode === 429) {
          return {
            status: "failed",
            message: "Слишком много запросов к leaderboard backend. Попробуйте отправить результат чуть позже."
          };
        }

        return {
          status: "failed",
          message: error.message
        };
      }

      return {
        status: "failed",
        message: "Не удалось отправить ranked result из-за неизвестной ошибки."
      };
    }
  }
}
