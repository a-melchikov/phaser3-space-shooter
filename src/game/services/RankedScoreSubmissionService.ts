import type { UserSession } from "../../auth/types";
import type { RankedScorePayload, RankedScoreSubmissionOutcome } from "../types/game";

export interface RankedScoreSubmissionService {
  submitScore(result: RankedScorePayload, session: UserSession): Promise<RankedScoreSubmissionOutcome>;
}
