import Phaser from "phaser";

import { FirebaseAuthService } from "./auth/FirebaseAuthService";
import { AuthState } from "./auth/authState";
import { setGameAppContext } from "./game/appContext";
import { createGameConfig } from "./game/config";
import { NoopRankedScoreSubmissionService } from "./game/services/NoopRankedScoreSubmissionService";
import { PracticeScoreStore } from "./game/services/PracticeScoreStore";
import { ResultsService } from "./game/services/ResultsService";

const appRoot = document.getElementById("app");

if (!appRoot) {
  throw new Error("Game root #app was not found.");
}

const authState = new AuthState();
const authService = new FirebaseAuthService(authState);
const resultsService = new ResultsService(new PracticeScoreStore(), new NoopRankedScoreSubmissionService());

setGameAppContext({
  authService,
  resultsService
});

void authService.initialize();

const game = new Phaser.Game(createGameConfig(appRoot));

window.addEventListener("beforeunload", () => {
  authService.destroy();
  game.destroy(true);
});
