import type { AuthService } from "../../auth/AuthService";
import type { UserSession } from "../../auth/types";
import { GAME_BUILD_VERSION } from "../config/build";
import {
  calculateRunUpgradeEffects,
  createLocalEconomyCatalog,
  estimateRunShardReward,
  normalizeUpgradeLevels
} from "../config/upgrades";
import type {
  EconomyProfileResponse,
  EconomyRunStartState,
  EconomyRunSummary,
  EconomySubmissionOutcome,
  EconomyUpgradeKey
} from "../types/economy";

import { BackendEconomyClient, BackendEconomyClientError } from "./BackendEconomyClient";

export class EconomyService {
  public constructor(
    private readonly authService: AuthService,
    private readonly backendEconomyClient: BackendEconomyClient
  ) {}

  public createGuestProfile(): EconomyProfileResponse {
    return {
      currency: {
        shardsBalance: 0,
        lifetimeShardsEarned: 0,
        lifetimeShardsSpent: 0
      },
      upgrades: normalizeUpgradeLevels(undefined),
      catalog: createLocalEconomyCatalog(undefined, 0)
    };
  }

  public async loadProfile(session: UserSession): Promise<EconomyProfileResponse> {
    if (!session.isAuthenticated) {
      return this.createGuestProfile();
    }

    const token = await this.authService.getIdToken();
    if (!token) {
      throw new BackendEconomyClientError(
        "Нужен вход через Google, чтобы загрузить осколки.",
        401,
        "missing_token"
      );
    }

    return this.backendEconomyClient.fetchMe(token);
  }

  public async purchaseUpgrade(
    session: UserSession,
    upgradeKey: EconomyUpgradeKey,
    expectedLevel: number
  ): Promise<EconomyProfileResponse> {
    if (!session.isAuthenticated) {
      throw new BackendEconomyClientError(
        "Постоянные улучшения доступны после входа через Google.",
        401,
        "guest_session"
      );
    }

    const token = await this.authService.getIdToken();
    if (!token) {
      throw new BackendEconomyClientError(
        "Нужен вход через Google, чтобы потратить осколки.",
        401,
        "missing_token"
      );
    }

    const result = await this.backendEconomyClient.purchaseUpgrade(token, {
      upgradeKey,
      expectedLevel
    });

    const currentProfile = await this.backendEconomyClient.fetchMe(token);
    return {
      ...currentProfile,
      currency: result.currency,
      catalog: result.catalog
    };
  }

  public async startRun(session: UserSession): Promise<EconomyRunStartState | null> {
    if (!session.isAuthenticated) {
      return null;
    }

    const token = await this.authService.getIdToken();
    if (!token) {
      return null;
    }

    const response = await this.backendEconomyClient.startRun(token, {
      clientBuildVersion: GAME_BUILD_VERSION
    });
    const upgrades = normalizeUpgradeLevels(response.upgrades);

    return {
      runId: response.runId,
      upgrades,
      effects: calculateRunUpgradeEffects(upgrades)
    };
  }

  public async finishRun(summary: EconomyRunSummary): Promise<EconomySubmissionOutcome> {
    const session = this.authService.getSession();
    const estimatedReward = estimateRunShardReward(summary);

    if (!session.isAuthenticated) {
      return {
        status: "skipped",
        estimatedReward,
        message: estimatedReward > 0
          ? `Можно было бы получить ${estimatedReward} осколков после входа через Google.`
          : "Осколки доступны после входа через Google."
      };
    }

    const token = await this.authService.getIdToken();
    if (!token) {
      return {
        status: "failed",
        estimatedReward,
        message: "Не удалось подтвердить вход для начисления осколков."
      };
    }

    try {
      const response = await this.backendEconomyClient.finishRun(token, summary);
      const prefix = response.status === "duplicate"
        ? "Награда за этот забег уже была сохранена"
        : "Награда сохранена";
      const capNote = response.capped ? " Лимит защиты ограничил итог." : "";

      return {
        status: "submitted",
        response,
        message: `${prefix}: +${response.totalReward} осколков. Баланс: ${response.balance}.${capNote}`
      };
    } catch (error) {
      if (error instanceof BackendEconomyClientError) {
        return {
          status: "failed",
          estimatedReward,
          message: error.message
        };
      }

      return {
        status: "failed",
        estimatedReward,
        message: "Не удалось сохранить награду за осколки."
      };
    }
  }
}
