import type { NetStorageAuthConfig } from '@/config/createAuthConfig';
import { createLogger, type WinstonLogLevel } from '@/utils/createLogger';
import {
  createRateLimiters,
  type RateLimitConfig,
} from '@/utils/createRateLimiters';
import { name as packageName } from '../../package.json';

export interface ClientContext extends NetStorageAuthConfig {
  logLevel?: WinstonLogLevel;
  logger?: ReturnType<typeof createLogger>;
  rateLimiters?: ReturnType<typeof createRateLimiters>;
  rateLimitConfig?: RateLimitConfig;
  request?: {
    timeout?: number;
  };
}

export interface NetStorageClientContext
  extends Omit<ClientContext, 'logger' | 'rateLimiters' | 'request'> {
  logger: ReturnType<typeof createLogger>;
  rateLimiters: ReturnType<typeof createRateLimiters>;
  request: {
    timeout: number;
  };
}

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
