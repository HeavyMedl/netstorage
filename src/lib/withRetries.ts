import type { RateLimiter } from 'limiter';

import type { WithRetriesOptions } from '../types';
import { HttpError } from '../errors';

/**
 * Executes a given asynchronous function with automatic retries using exponential backoff.
 *
 * This utility provides robust retry logic for transient failures, with optional hooks
 * for rate limiting (`beforeAttempt`) and logging (`onRetry`). Delay increases exponentially
 * and supports jitter to mitigate retry storms.
 *
 * @template T - The return type of the asynchronous function.
 * @param fn - The asynchronous function to execute and retry on failure.
 * @param opts - Optional retry configuration. See {@link WithRetriesOptions}.
 * @returns The result of the successful function execution, or throws after exhausting retries.
 */
export async function withRetries<T>(
  fn: () => Promise<T>,
  opts?: Partial<WithRetriesOptions>,
): Promise<T> {
  const {
    retries = 3,
    baseDelayMs = 300,
    maxDelayMs = 2000,
    jitter = true,
    shouldRetry = () => false,
    beforeAttempt,
    onRetry,
  } = opts ?? {};
  let attempt = 0;

  while (true) {
    try {
      if (beforeAttempt) {
        await beforeAttempt();
      }
      return await fn();
    } catch (err) {
      if (attempt >= retries || !shouldRetry(err)) {
        throw err;
      }

      const delay = calculateDelay(attempt, baseDelayMs, maxDelayMs, jitter);

      if (onRetry) {
        onRetry(err, attempt + 1, delay);
      }

      await new Promise((res) => setTimeout(res, delay));
      attempt++;
    }
  }
}

/**
 * Calculates a delay in milliseconds based on the given attempt number,
 * base delay, maximum delay, and whether to apply jitter.
 *
 * The delay is calculated as a minimum of the base delay multiplied by 2 to
 * the power of the attempt number and the maximum delay. If jitter is true,
 * the calculated delay is multiplied by a random number between 0 (inclusive)
 * and 1 (exclusive) to introduce randomness in the delay.
 *
 * @param {number} attempt - The current attempt number (0-indexed).
 * @param {number} base - The base delay in milliseconds.
 * @param {number} max - The maximum delay in milliseconds.
 * @param {boolean} jitter - Whether to apply jitter to the delay.
 * @returns {number} The calculated delay in milliseconds.
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
 * Generates a standardized retry configuration for a given NetStorage method.
 *
 * @param methodName - The name of the API method (for logging).
 * @param limiter - The rate limiter used to throttle requests.
 * @param overrides - Optional overrides for shouldRetry and onRetry logic.
 * @returns A complete WithRetriesOptions object ready for use with withRetries().
 */
export function createRetryConfig(
  methodName: string,
  limiter: RateLimiter,
  overrides: Partial<Pick<WithRetriesOptions, 'shouldRetry' | 'onRetry'>> = {},
): WithRetriesOptions {
  return {
    retries: 3,
    baseDelayMs: 300,
    maxDelayMs: 2000,
    jitter: true,
    shouldRetry:
      overrides.shouldRetry ??
      ((err) =>
        err instanceof HttpError &&
        [429, 500, 502, 503, 504].includes(err.code)),
    beforeAttempt: async () => {
      await limiter.removeTokens(1);
    },
    onRetry:
      overrides.onRetry ??
      ((err, attempt, delay) => {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.warn(
          `[${methodName}] Retry ${attempt} due to error: ${message}. Retrying in ${delay}ms.`,
        );
      }),
  };
}
