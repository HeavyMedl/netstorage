import { RateLimiter } from 'limiter';
import type { RateLimitConfig } from '../types';

export function createRateLimiters(config?: RateLimitConfig) {
  const { read = 800, write = 25, dir = 50, time = 1000 } = config || {};

  return {
    readLimiter: new RateLimiter({ tokensPerInterval: read, interval: time }),
    writeLimiter: new RateLimiter({ tokensPerInterval: write, interval: time }),
    dirLimiter: new RateLimiter({ tokensPerInterval: dir, interval: time }),
  };
}
