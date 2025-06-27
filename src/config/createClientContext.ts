import { name as packageName } from '../../package.json';

import {
  createLogger,
  createRateLimiters,
  type NetStorageAuthConfig,
  type RateLimitConfig,
  type WinstonLogLevel,
} from '@/index';

/**
 * Configuration options for creating a NetStorage client context.
 *
 * @property logLevel - Optional log level for Winston logger.
 * @property logger - Optional custom logger instance.
 * @property rateLimiters - Optional custom rate limiter instance.
 * @property rateLimitConfig - Optional configuration for rate limiting.
 * @property request - Optional request configuration (e.g., timeout).
 */
export interface ClientContext extends NetStorageAuthConfig {
  logLevel?: WinstonLogLevel;
  logger?: ReturnType<typeof createLogger>;
  rateLimiters?: ReturnType<typeof createRateLimiters>;
  rateLimitConfig?: RateLimitConfig;
  request?: {
    timeout?: number;
  };
}

/**
 * Fully resolved NetStorage client context used during runtime.
 *
 * @property logger - Required logger instance.
 * @property rateLimiters - Required rate limiter instance.
 * @property request - Request configuration with resolved timeout.
 */
export interface NetStorageClientContext
  extends Omit<ClientContext, 'logger' | 'rateLimiters' | 'request'> {
  logger: ReturnType<typeof createLogger>;
  rateLimiters: ReturnType<typeof createRateLimiters>;
  request: {
    timeout: number;
  };
}

/**
 * Creates a fully-initialized NetStorage client context with defaults applied.
 *
 * @param config - Partial client context configuration.
 * @returns Fully resolved NetStorage client context.
 */
export function createClientContext(
  config: ClientContext,
): NetStorageClientContext {
  const { logLevel = 'info', rateLimitConfig, request = {}, ...rest } = config;

  const logger = config.logger ?? createLogger(logLevel, packageName);
  const rateLimiters =
    config.rateLimiters ?? createRateLimiters(rateLimitConfig);
  const timeout = request.timeout ?? 10000;

  return {
    ...rest,
    logLevel,
    rateLimitConfig,
    logger,
    rateLimiters,
    request: {
      timeout,
    },
  };
}
