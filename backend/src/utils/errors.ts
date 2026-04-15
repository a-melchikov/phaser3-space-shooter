export class AppError extends Error {
  public constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function createError(
  statusCode: number,
  code: string,
  message: string,
  details?: unknown
): AppError {
  return new AppError(statusCode, code, message, details);
}
