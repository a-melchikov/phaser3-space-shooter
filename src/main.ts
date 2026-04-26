import Phaser from "phaser";

import { LazyFirebaseAuthService } from "./auth/LazyFirebaseAuthService";
import { AuthState } from "./auth/authState";
import { setGameAppContext } from "./game/appContext";
import { createGameConfig } from "./game/config";
import { BackendAuditClient } from "./game/services/BackendAuditClient";
import { BackendLeaderboardClient } from "./game/services/BackendLeaderboardClient";
import { AuditService } from "./game/services/AuditService";
import { HttpRankedScoreSubmissionService } from "./game/services/HttpRankedScoreSubmissionService";
import { OnlineLeaderboardService } from "./game/services/OnlineLeaderboardService";
import { PracticeScoreStore } from "./game/services/PracticeScoreStore";
import { ResultsService } from "./game/services/ResultsService";
import { RunStateStore } from "./game/services/RunStateStore";
import { AudioSystem } from "./game/systems/AudioSystem";

const appRoot = document.getElementById("app");

if (!appRoot) {
  throw new Error("Game root #app was not found.");
}

const authState = new AuthState();
const authService = new LazyFirebaseAuthService(authState);
const auditClient = new BackendAuditClient();
const auditService = new AuditService(authService, auditClient);
const leaderboardClient = new BackendLeaderboardClient();
const practiceScoreStore = new PracticeScoreStore();
const resultsService = new ResultsService(
  practiceScoreStore,
  new HttpRankedScoreSubmissionService(authService, leaderboardClient, auditService),
  auditService
);
const onlineLeaderboardService = new OnlineLeaderboardService(authService, leaderboardClient, practiceScoreStore);
const runStateStore = new RunStateStore();

setGameAppContext({
  authService,
  auditService,
  onlineLeaderboardService,
  resultsService,
  runStateStore
});

auditService.recordSiteVisit();

const game = new Phaser.Game(createGameConfig(appRoot));

window.setTimeout(() => {
  void authService.initialize().then(() => {
    auditService.recordUserSessionStarted(
      authService.getSession(),
      runStateStore.getResumeMetadata() !== null
    );
  });
}, 0);

window.addEventListener("beforeunload", () => {
  authService.destroy();
  AudioSystem.destroyGlobal();
  game.destroy(true);
});
