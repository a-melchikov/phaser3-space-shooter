import { buildApp } from "./app.js";
import { loadEnv } from "./config/env.js";

const env = loadEnv();
const app = buildApp(env);
let isShuttingDown = false;

async function start(): Promise<void> {
  try {
    await app.listen({
      host: "0.0.0.0",
      port: env.PORT
    });

    app.log.info(`Leaderboard backend is running on port ${env.PORT}.`);
  } catch (error) {
    app.log.error(error, "Failed to start leaderboard backend.");
    process.exit(1);
  }
}

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  app.log.info({ signal }, "Shutting down leaderboard backend.");

  try {
    await app.close();
    process.exit(0);
  } catch (error) {
    app.log.error(error, "Failed to shutdown leaderboard backend cleanly.");
    process.exit(1);
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    void shutdown(signal);
  });
}

void start();
