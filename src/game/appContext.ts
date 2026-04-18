import type { AuthService } from "../auth/AuthService";
import type { ResultsService } from "./services/ResultsService";
import type { RunStateStore } from "./services/RunStateStore";

export interface GameAppContext {
  authService: AuthService;
  resultsService: ResultsService;
  runStateStore: RunStateStore;
}

let gameAppContext: GameAppContext | null = null;

export function setGameAppContext(context: GameAppContext): void {
  gameAppContext = context;
}

export function getGameAppContext(): GameAppContext {
  if (!gameAppContext) {
    throw new Error("Game app context has not been initialized yet.");
  }

  return gameAppContext;
}
