import type { UserSession } from "../../auth/types";
import type {
  CompletedRunResult,
  PracticeScoreEntry,
  RankedScorePayload,
  RankedScoreSubmissionOutcome
} from "../types/game";
import { canSubmitRankedScore } from "../utils/rankedEligibility";

import type { PracticeScoreStore } from "./PracticeScoreStore";
import type { RankedScoreSubmissionService } from "./RankedScoreSubmissionService";

export class ResultsService {
  public constructor(
    private readonly practiceScoreStore: PracticeScoreStore,
    private readonly rankedScoreSubmissionService: RankedScoreSubmissionService
  ) {}

  public getPracticeScores(): PracticeScoreEntry[] {
    return this.practiceScoreStore.loadScores();
  }

  public recordPracticeResult(result: CompletedRunResult, session: UserSession): PracticeScoreEntry[] {
    return this.practiceScoreStore.saveScore({
      score: result.score,
      wave: result.wave,
      date: result.completedAt,
      playerLabel: session.displayName,
      mode: session.mode,
      rankedEligible: canSubmitRankedScore(session)
    });
  }

  public async submitRankedResult(
    result: CompletedRunResult,
    session: UserSession
  ): Promise<RankedScoreSubmissionOutcome> {
    if (!canSubmitRankedScore(session)) {
      return {
        status: "skipped",
        message: "Гостевой результат сохранён только на этом устройстве."
      };
    }

    const payload: RankedScorePayload = {
      score: result.score,
      wave: result.wave,
      completedAt: result.completedAt,
      playerLabel: session.displayName
    };

    return this.rankedScoreSubmissionService.submitScore(payload, session);
  }
}
