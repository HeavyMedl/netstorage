import {
  HttpError,
  selectLimiter,
  type NetStorageClientConfig,
  type NetStorageOperation,
} from '@/index';

/**
 * Configuration for retry behavior using exponential backoff.
 *
 * @property retries - Maximum number of retry attempts.
 * @property baseDelayMs - Base delay in milliseconds before retrying.
 * @property maxDelayMs - Maximum delay in milliseconds between retries.
 * @property jitter - Whether to apply random jitter to the backoff delay.
 * @property shouldRetry - Function to determine if an error should trigger a retry.
 * @property beforeAttempt - Hook executed before each retry attempt (e.g., for rate limiting).
 * @property onRetry - Callback invoked after a failed attempt, before the delay.
 */
export interface WithRetriesOptions {
  retries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitter: boolean;
  shouldRetry: (error: unknown) => boolean;
  beforeAttempt?: () => Promise<void>;
  onRetry?: (error: unknown, attempt: number, delay: number) => void;
}

/**
 * Calculates exponential backoff delay with optional jitter.
 *
 * @param attempt - The current retry attempt (zero-based).
 * @param base - The base delay in milliseconds.
 * @param max - The maximum delay allowed.
 * @param jitter - Whether to apply jitter to the delay.
 * @returns The delay in milliseconds.
 */
export function calculateDelay(
  attempt: number,
  base: number,
  max: number,
  jitter: boolean,
): number {
  const expBackoff = Math.min(base * 2 ** attempt, max);
  return jitter ? Math.floor(Math.random() * expBackoff) : expBackoff;
}

/**
 * Determines if a system-level error is transient and retryable.
 *
 * @param config - NetStorage client config for logging.
 * @param err - The error to evaluate.
 * @param method - The method or operation name for config.
 * @returns True if the error should be retried; otherwise, false.
 */
export function shouldRetrySystemError(
  config: NetStorageClientConfig,
  err: Error,
  method = 'unknown',
): boolean {
  const retryableCodes = ['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ENOTFOUND'];
  const shouldRetry = retryableCodes.some((code) => err.message.includes(code));

  if (!shouldRetry) {
    config.logger.debug(
      `Non-retryable system error encountered: ${err.message}`,
      {
        method,
      },
    );
  }

  return shouldRetry;
}

/**
 * Executes a function with retry logic using exponential backoff and optional jitter.
 *
 * @param config - NetStorage client config for logging and rate limiting.
 * @param method - The NetStorage operation being executed.
 * @param fn - The asynchronous function to execute with retry logic.
 * @param overrides - Optional overrides for retry behavior.
 * @returns A promise that resolves with the function's result or rejects after final failure.
 */
export async function withRetries<T>(
  config: NetStorageClientConfig,
  method: NetStorageOperation,
  fn: () => Promise<T>,
  overrides?: Partial<Pick<WithRetriesOptions, 'shouldRetry' | 'onRetry'>>,
): Promise<T> {
  const limiter = selectLimiter(method, config.rateLimiters);
  const retries = 3;
  const baseDelayMs = 300;
  const maxDelayMs = 2000;
  const jitter = true;

  const beforeAttempt = async () => {
    await limiter.removeTokens(1);
  };

  const shouldRetry =
    overrides?.shouldRetry ??
    ((err) => {
      if (
        err instanceof HttpError &&
        [429, 500, 502, 503, 504].includes(err.code)
      ) {
        return true;
      }
      if (err instanceof Error) {
        return shouldRetrySystemError(config, err, method);
      }
      return false;
    });

  const onRetry =
    overrides?.onRetry ??
    ((err, attempt, delay) => {
      const message = err instanceof Error ? err.message : 'Unknown error';
      config.logger.verbose(
        `Retry ${attempt} due to error: ${message}. Retrying in ${delay}ms.`,
        { method },
      );
    });

  let attempt = 0;

  while (true) {
    try {
      await beforeAttempt();
      return await fn();
    } catch (err) {
      if (attempt >= retries || !shouldRetry(err)) {
        throw err;
      }

      const delay = calculateDelay(attempt, baseDelayMs, maxDelayMs, jitter);

      onRetry(err, attempt + 1, delay);

      await new Promise((res) => setTimeout(res, delay));
      attempt++;
    }
  }
}
