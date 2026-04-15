import type { UserSession } from "../../auth/types";
import type { RankedScorePayload, RankedScoreSubmissionOutcome } from "../types/game";

import type { RankedScoreSubmissionService } from "./RankedScoreSubmissionService";

export class NoopRankedScoreSubmissionService implements RankedScoreSubmissionService {
  public async submitScore(
    _result: RankedScorePayload,
    _session: UserSession
  ): Promise<RankedScoreSubmissionOutcome> {
    return {
      status: "unavailable",
      message: "Leaderboard backend пока не подключён. Результат помечен как ranked-eligible, но не отправлен."
    };
  }
}
