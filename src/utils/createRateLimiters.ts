import type { NetStorageOperation } from '@/types';

import { RateLimiter } from 'limiter';

type LimiterMap = Partial<
  Record<NetStorageOperation, keyof ReturnType<typeof createRateLimiters>>
>;

/**
 * Optional configuration for throttling NetStorage API operations.
 *
 * This allows fine-grained control over how frequently certain categories
 * of operations are performed to avoid overwhelming the NetStorage API.
 *
 * @property {number} [read] - Maximum number of read operations (e.g., stat, du, dir) per interval.
 * @property {number} [write] - Maximum number of write operations (e.g., upload, delete, mkdir) per interval.
 * @property {number} [dir] - Maximum number of directory listing operations (e.g., dir) per interval.
 * @property {number} [time] - The interval window in milliseconds (default is 1000 ms).
 */
export interface RateLimitConfig {
  read?: number;
  write?: number;
  dir?: number;
  time?: number;
}

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

/**
 * Selects the appropriate rate limiter based on the API method name.
 *
 * @param method - The API method name (e.g., 'stat', 'upload', 'dir').
 * @param limiters - The object containing all available limiters.
 * @returns The corresponding RateLimiter instance.
 * @throws If the method is not mapped to a limiter.
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
