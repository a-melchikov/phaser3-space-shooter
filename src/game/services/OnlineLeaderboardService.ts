import type { AuthService } from "../../auth/AuthService";
import type { UserSession } from "../../auth/types";
import type { MenuLeaderboardSnapshot, PlayerLeaderboardProfile, PracticeScoreEntry } from "../types/game";
import { canSubmitRankedScore } from "../utils/rankedEligibility";

import {
  BackendLeaderboardClient,
  BackendLeaderboardClientError
} from "./BackendLeaderboardClient";
import type { PracticeScoreStore } from "./PracticeScoreStore";

export class OnlineLeaderboardService {
  public constructor(
    private readonly authService: AuthService,
    private readonly backendLeaderboardClient: BackendLeaderboardClient,
    private readonly practiceScoreStore: PracticeScoreStore
  ) {}

  public async loadMenuLeaderboard(session: UserSession): Promise<MenuLeaderboardSnapshot> {
    const localEntries = this.practiceScoreStore.loadScores();

    if (!this.backendLeaderboardClient.isConfigured()) {
      return this.createFallbackSnapshot(
        localEntries,
        "Онлайн-таблица пока недоступна. Показываем лучшие локальные результаты."
      );
    }

    try {
      const topResponse = await this.backendLeaderboardClient.fetchLeaderboardTop(5);
      const playerProfile = await this.loadPlayerProfile(session);

      return {
        mode: "online",
        topEntries: topResponse.items,
        playerProfile,
        statusMessage: playerProfile
          ? "Глобальный рейтинг синхронизирован."
          : canSubmitRankedScore(session)
            ? "Глобальный рейтинг загружен. Войдите заново, если личный ранг не отображается."
            : "Глобальный рейтинг загружен. Личный ранг появится после входа через Google."
      };
    } catch (error) {
      if (error instanceof BackendLeaderboardClientError) {
        return this.createFallbackSnapshot(localEntries, error.message);
      }

      return this.createFallbackSnapshot(
        localEntries,
        "Не удалось загрузить глобальный рейтинг. Показываем локальные результаты."
      );
    }
  }

  private async loadPlayerProfile(session: UserSession): Promise<PlayerLeaderboardProfile | null> {
    if (!canSubmitRankedScore(session)) {
      return null;
    }

    const idToken = await this.authService.getIdToken();
    if (!idToken) {
      return null;
    }

    try {
      return await this.backendLeaderboardClient.fetchMyProfile(idToken);
    } catch (error) {
      if (error instanceof BackendLeaderboardClientError && error.statusCode === 401) {
        return null;
      }

      throw error;
    }
  }

  private createFallbackSnapshot(
    localEntries: PracticeScoreEntry[],
    fallbackReason: string
  ): MenuLeaderboardSnapshot {
    return {
      mode: "fallback",
      topEntries: localEntries.slice(0, 5).map((entry, index) => ({
        rank: index + 1,
        displayName: entry.playerLabel,
        avatarUrl: null,
        bestScore: entry.score,
        bestWave: entry.wave,
        bestScoreAt: entry.date
      })),
      playerProfile: null,
      statusMessage: "Локальный backup leaderboard активен.",
      fallbackReason
    };
  }
}
