import { RateLimiter } from 'limiter';
import type { RateLimitConfig } from '../types';

/**
 * Creates a set of token-bucket rate limiters for different NetStorage API operation types.
 *
 * Each limiter controls the frequency of operations per defined interval (default: 1000ms).
 *
 * @param {RateLimitConfig} [config] - Optional configuration object to customize rate limits.
 * @returns {{ readLimiter: RateLimiter, writeLimiter: RateLimiter, dirLimiter: RateLimiter }}
 * An object containing separate limiters for read, write, and directory-listing operations.
 */
export function createRateLimiters(config?: RateLimitConfig) {
  const { read = 800, write = 25, dir = 50, time = 1000 } = config || {};

  return {
    readLimiter: new RateLimiter({ tokensPerInterval: read, interval: time }),
    writeLimiter: new RateLimiter({ tokensPerInterval: write, interval: time }),
    dirLimiter: new RateLimiter({ tokensPerInterval: dir, interval: time }),
  };
}
