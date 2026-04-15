import type { FastifyServerOptions } from "fastify";

import type { AppEnv } from "../config/env.js";

export function createLoggerOptions(env: AppEnv): FastifyServerOptions["logger"] {
  return {
    level: env.LOG_LEVEL
  };
}
