/**
 * User-facing error class for better error messages
 */
export class UserFacingError extends Error {
  constructor(
    message: string,
    public readonly originalError?: Error,
  ) {
    super(message);
    this.name = "UserFacingError";
  }
}

/**
 * Convert technical errors to user-friendly messages
 */
export function getUserFriendlyErrorMessage(error: unknown): string {
  if (error instanceof UserFacingError) {
    return error.message;
  }

  const errorMessage =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  // Network errors
  if (
    errorMessage.includes("network") ||
    errorMessage.includes("failed to fetch") ||
    errorMessage.includes("fetch")
  ) {
    return "We couldn't reach the server. Please check your internet connection and try again.";
  }

  // Authentication errors
  if (
    errorMessage.includes("unauthorized") ||
    errorMessage.includes("401") ||
    errorMessage.includes("403") ||
    errorMessage.includes("not authorized")
  ) {
    return "Your session may have expired. Please sign out and sign back in.";
  }

  // Not found errors
  if (errorMessage.includes("404") || errorMessage.includes("not found")) {
    return "We couldn't find what you're looking for. It may have been removed or doesn't exist.";
  }

  // Server errors
  if (errorMessage.includes("500") || errorMessage.includes("internal server")) {
    return "Our servers are experiencing issues. Please try again in a few moments.";
  }

  // Timeout errors
  if (errorMessage.includes("timeout") || errorMessage.includes("timed out")) {
    return "The request took too long. Please try again.";
  }

  // Abort errors
  if (errorMessage.includes("abort")) {
    return "The request was cancelled. Please try again.";
  }

  // Database errors
  if (errorMessage.includes("unique constraint") || errorMessage.includes("duplicate")) {
    return "This item already exists. Please try something different.";
  }

  // Validation errors
  if (errorMessage.includes("invalid") || errorMessage.includes("validation")) {
    return "Please check your input and try again.";
  }

  // Generic fallback
  return "Something went wrong. Please try again.";
}

/**
 * Error tracking utility (placeholder for Sentry/similar)
 */
export function captureException(
  error: Error,
  context?: {
    context?: string;
    extra?: Record<string, any>;
    user?: { id: string; email?: string };
  },
) {
  const viteDev =
    typeof import.meta !== "undefined" &&
    "env" in import.meta &&
    (import.meta as { env?: { DEV?: boolean } }).env?.DEV === true;
  const nodeEnv =
    typeof process !== "undefined" && typeof process.env !== "undefined"
      ? process.env.NODE_ENV
      : undefined;
  const isDev = viteDev || nodeEnv === "development";

  // Log to console in development
  if (isDev) {
    console.error("[Error Tracking]", {
      error,
      message: error.message,
      stack: error.stack,
      ...context,
    });
  }

  // TODO: Send to error tracking service
  // Example with Sentry:
  // Sentry.captureException(error, {
  //   tags: { context: context?.context },
  //   extra: context?.extra,
  //   user: context?.user,
  // });
}

/**
 * Retry utility for failed requests
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffFactor?: number;
    onRetry?: (attempt: number, error: Error) => void;
  } = {},
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2,
    onRetry,
  } = options;

  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Don't retry on certain errors
      if (
        lastError.message.includes("401") ||
        lastError.message.includes("403") ||
        lastError.message.includes("404") ||
        lastError.message.includes("AbortError")
      ) {
        throw lastError;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(initialDelay * Math.pow(backoffFactor, attempt), maxDelay);

      // Call retry callback
      onRetry?.(attempt + 1, lastError);

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}
