import type { UserSession } from "../../auth/types";
import type {
  CompletedRunResult,
  PracticeScoreEntry,
  RankedScorePayload,
  RankedScoreSubmissionOutcome
} from "../types/game";
import { canSubmitRankedScore } from "../utils/rankedEligibility";

import type { AuditService } from "./AuditService";
import type { PracticeScoreStore } from "./PracticeScoreStore";
import type { RankedScoreSubmissionService } from "./RankedScoreSubmissionService";

export class ResultsService {
  public constructor(
    private readonly practiceScoreStore: PracticeScoreStore,
    private readonly rankedScoreSubmissionService: RankedScoreSubmissionService,
    private readonly auditService: AuditService
  ) {}

  public getPracticeScores(): PracticeScoreEntry[] {
    return this.practiceScoreStore.loadScores();
  }

  public recordPracticeResult(result: CompletedRunResult, session: UserSession): PracticeScoreEntry[] {
    const rankedEligible = canSubmitRankedScore(session) && result.rankedSubmissionAllowed;

    this.auditService.recordGameRunFinished(result, session);
    this.auditService.recordGameOver(result, session);

    return this.practiceScoreStore.saveScore({
      score: result.score,
      wave: result.wave,
      date: result.completedAt,
      playerLabel: session.displayName,
      mode: session.mode,
      rankedEligible
    });
  }

  public async submitRankedResult(
    result: CompletedRunResult,
    session: UserSession
  ): Promise<RankedScoreSubmissionOutcome> {
    if (!result.rankedSubmissionAllowed) {
      this.auditService.recordRankedSubmitRejected("local_only_run", result, session);

      return {
        status: "skipped",
        message: "Продолженный run сохранён только локально и не участвует в ranked."
      };
    }

    if (!canSubmitRankedScore(session)) {
      this.auditService.recordRankedSubmitRejected("guest_session", result, session);

      return {
        status: "skipped",
        message: "Гостевой результат сохранён только на этом устройстве."
      };
    }

    const payload: RankedScorePayload = {
      score: result.score,
      wave: result.wave,
      completedAt: result.completedAt,
      rankedSubmissionAllowed: result.rankedSubmissionAllowed,
      playerLabel: session.displayName,
      economyRunId: result.economyRunId
    };

    return this.rankedScoreSubmissionService.submitScore(payload, session);
  }
}
