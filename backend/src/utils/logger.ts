import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";

import type { FastifyServerOptions } from "fastify";

import type { AppEnv } from "../config/env.js";

export function createLoggerOptions(env: AppEnv): FastifyServerOptions["logger"] {
  return {
    level: env.LOG_LEVEL,
    base: {
      service: "starfall-aegis-backend",
      environment: env.NODE_ENV
    },
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "request.headers.authorization",
        "request.headers.cookie",
        "res.headers.set-cookie",
        "*.token",
        "*.idToken",
        "*.accessToken",
        "*.refreshToken",
        "*.password",
        "*.secret",
        "*.privateKey"
      ],
      censor: "[REDACTED]"
    }
  };
}

export function createRequestId(request: IncomingMessage): string {
  const headerValue = request.headers["x-request-id"];
  const candidate = Array.isArray(headerValue) ? headerValue[0] : headerValue;

  if (candidate && /^[a-zA-Z0-9._:-]{8,128}$/.test(candidate)) {
    return candidate;
  }

  return randomUUID();
}
