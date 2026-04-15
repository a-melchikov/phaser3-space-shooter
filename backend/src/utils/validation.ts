import type { ZodType } from "zod";

import { AppError } from "./errors.js";

export function validateWithSchema<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw new AppError(400, "validation_error", "Request validation failed.", result.error.flatten());
  }

  return result.data;
}
