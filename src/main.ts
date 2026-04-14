import Phaser from "phaser";

import { createGameConfig } from "./game/config";

const appRoot = document.getElementById("app");

if (!appRoot) {
  throw new Error("Game root #app was not found.");
}

const game = new Phaser.Game(createGameConfig(appRoot));

window.addEventListener("beforeunload", () => {
  game.destroy(true);
});
