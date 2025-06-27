import { RateLimiter } from 'limiter';

import type { NetStorageOperation } from '@/index';

/**
 * Maps a NetStorage operation to the corresponding limiter key returned from `createRateLimiters`.
 */
type LimiterMap = Partial<
  Record<NetStorageOperation, keyof ReturnType<typeof createRateLimiters>>
>;

/**
 * Configuration for throttling NetStorage API operations.
 *
 * @property {number} [read] - Max read ops (e.g., stat, du, dir) per interval.
 * @property {number} [write] - Max write ops (e.g., upload, delete, mkdir) per interval.
 * @property {number} [dir] - Max directory listing ops (e.g., dir) per interval.
 * @property {number} [time] - Interval window in milliseconds (default: 1000ms).
 */
export interface RateLimitConfig {
  read?: number;
  write?: number;
  dir?: number;
  time?: number;
}

/**
 * Creates rate limiters for read, write, and directory operations.
 *
 * @param {RateLimitConfig} [config] - Optional rate limit configuration.
 * @returns {{
 *   readLimiter: RateLimiter,
 *   writeLimiter: RateLimiter,
 *   dirLimiter: RateLimiter
 * }} Limiters for respective operation types.
 */
export function createRateLimiters(config?: RateLimitConfig) {
  const { read = 800, write = 25, dir = 50, time = 1000 } = config || {};

  return {
    readLimiter: new RateLimiter({ tokensPerInterval: read, interval: time }),
    writeLimiter: new RateLimiter({ tokensPerInterval: write, interval: time }),
    dirLimiter: new RateLimiter({ tokensPerInterval: dir, interval: time }),
  };
}

/**
 * Resolves the appropriate limiter for a given NetStorage method.
 *
 * @param {NetStorageOperation} method - API operation name (e.g., 'stat', 'upload').
 * @param {ReturnType<typeof createRateLimiters>} limiters - Available rate limiters.
 * @returns {RateLimiter} Matching limiter instance.
 * @throws {Error} If no limiter is mapped to the given method.
 */
export function selectLimiter(
  method: NetStorageOperation,
  limiters: ReturnType<typeof createRateLimiters>,
): RateLimiter {
  const map: LimiterMap = {
    dir: 'dirLimiter',
    download: 'readLimiter',
    du: 'readLimiter',
    mkdir: 'writeLimiter',
    mtime: 'writeLimiter',
    rename: 'writeLimiter',
    rm: 'writeLimiter',
    rmdir: 'writeLimiter',
    stat: 'readLimiter',
    symlink: 'writeLimiter',
    upload: 'writeLimiter',
  };

  const key = map[method];
  if (!key) {
    throw new Error(`Unsupported method for limiter selection: ${method}`);
  }

  return limiters[key];
}
