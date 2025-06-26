import { selectLimiter } from '@/utils/createRateLimiters';
import type { NetStorageClientContext } from '@/config/createClientContext';
import { HttpError } from '@/errors/httpError';
import type { NetStorageOperation } from '@/types';

/**
 * Configuration options for retrying asynchronous operations using exponential backoff.
 *
 * This interface supports flexible and safe retries with optional jitter and retry hooks.
 *
 * @property retries - The maximum number of retry attempts (default: 3).
 * @property baseDelayMs - The initial delay in milliseconds before retrying (default: 300ms).
 * @property maxDelayMs - The maximum allowed delay between retries in milliseconds (default: 2000ms).
 * @property jitter - Whether to apply random jitter to the delay (default: true).
 * @property shouldRetry - A function that determines whether a given error warrants a retry.
 * @property beforeAttempt - An optional async hook to run before each retry attempt (e.g., rate limiter).
 * @property onRetry - An optional callback invoked after a failed attempt, before delay.
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
 * Determines whether a system-level error should trigger a retry.
 *
 * Logs and returns false for non-retryable errors like file not found or permission denied.
 * Returns true for transient errors like connection resets or timeouts.
 */
export function shouldRetrySystemError(
  ctx: NetStorageClientContext,
  err: Error,
  method = 'unknown',
): boolean {
  const retryableCodes = ['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ENOTFOUND'];
  const shouldRetry = retryableCodes.some((code) => err.message.includes(code));

  if (!shouldRetry) {
    ctx.logger.debug(`Non-retryable system error encountered: ${err.message}`, {
      method,
    });
  }

  return shouldRetry;
}

/**
 * Executes a given asynchronous function with automatic retries using exponential backoff.
 */
export async function withRetries<T>(
  ctx: NetStorageClientContext,
  method: NetStorageOperation,
  fn: () => Promise<T>,
  overrides?: Partial<Pick<WithRetriesOptions, 'shouldRetry' | 'onRetry'>>,
): Promise<T> {
  const limiter = selectLimiter(method, ctx.rateLimiters);
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
      if (err instanceof Error) {
        return shouldRetrySystemError(ctx, err, method);
      }
      if (err instanceof HttpError) {
        return [429, 500, 502, 503, 504].includes(err.code);
      }
      return false;
    });

  const onRetry =
    overrides?.onRetry ??
    ((err, attempt, delay) => {
      const message = err instanceof Error ? err.message : 'Unknown error';
      ctx.logger.warn(
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
