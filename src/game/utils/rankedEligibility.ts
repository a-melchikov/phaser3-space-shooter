import type { UserSession } from "../../auth/types";

export function canSubmitRankedScore(session: UserSession): boolean {
  return session.isAuthenticated && session.mode === "google" && Boolean(session.user?.id);
}
