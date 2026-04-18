import Phaser from "phaser";

import { FirebaseAuthService } from "./auth/FirebaseAuthService";
import { AuthState } from "./auth/authState";
import { setGameAppContext } from "./game/appContext";
import { createGameConfig } from "./game/config";
import { BackendLeaderboardClient } from "./game/services/BackendLeaderboardClient";
import { HttpRankedScoreSubmissionService } from "./game/services/HttpRankedScoreSubmissionService";
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
const resultsService = new ResultsService(
  new PracticeScoreStore(),
  new HttpRankedScoreSubmissionService(authService, leaderboardClient)
);
const runStateStore = new RunStateStore();

setGameAppContext({
  authService,
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
