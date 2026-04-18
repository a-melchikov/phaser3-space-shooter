import Phaser from "phaser";

import { FirebaseAuthService } from "./auth/FirebaseAuthService";
import { AuthState } from "./auth/authState";
import { setGameAppContext } from "./game/appContext";
import { createGameConfig } from "./game/config";
import { BackendLeaderboardClient } from "./game/services/BackendLeaderboardClient";
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
const authService = new FirebaseAuthService(authState);
const leaderboardClient = new BackendLeaderboardClient();
const practiceScoreStore = new PracticeScoreStore();
const resultsService = new ResultsService(
  practiceScoreStore,
  new HttpRankedScoreSubmissionService(authService, leaderboardClient)
);
const onlineLeaderboardService = new OnlineLeaderboardService(authService, leaderboardClient, practiceScoreStore);
const runStateStore = new RunStateStore();

setGameAppContext({
  authService,
  onlineLeaderboardService,
  resultsService,
  runStateStore
});

void authService.initialize();

const game = new Phaser.Game(createGameConfig(appRoot));

window.addEventListener("beforeunload", () => {
  authService.destroy();
  AudioSystem.destroyGlobal();
  game.destroy(true);
});
