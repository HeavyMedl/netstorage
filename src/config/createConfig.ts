import { ConfigValidationError } from '@/errors/configValidationError';
import { name as packageName } from '../../package.json';
import { buildUri } from '@/utils/buildUri';

import {
  createLogger,
  createRateLimiters,
  type WinstonLogLevel,
  type RateLimitConfig,
} from '@/index';

/**
 * Unified configuration interface for initializing a NetStorage client.
 *
 * @property {string} key - The API key used for NetStorage authentication.
 * @property {string} keyName - The name associated with the API key.
 * @property {string} host - The NetStorage hostname (excluding protocol).
 * @property {boolean} [ssl] - Whether to use SSL (HTTPS). Defaults to false.
 * @property {string} [cpCode] - Optional CP code used to prefix NetStorage paths.
 * @property {WinstonLogLevel} [logLevel] - Optional log level for internal logging.
 * @property {RateLimitConfig} [rateLimitConfig] - Optional configuration for rate limiter creation.
 * @property {{ timeout?: number }} [request] - Optional request config (e.g., request timeout in ms).
 * @property {ReturnType<typeof createLogger>} logger - Logger instance to use for internal logging.
 * @property {ReturnType<typeof createRateLimiters>} rateLimiters - Rate limiter instance to use for request throttling.
 * @property {(path?: string) => string} uri - Method to build a URI with an optional path.
 */
export interface NetStorageClientConfig {
  key: string;
  keyName: string;
  host: string;
  ssl?: boolean;
  cpCode?: string;
  logLevel?: WinstonLogLevel;
  rateLimitConfig?: RateLimitConfig;
  request?: {
    timeout?: number;
  };
  logger: ReturnType<typeof createLogger>;
  rateLimiters: ReturnType<typeof createRateLimiters>;
  uri(path?: string): string;
}

/**
 * Throws a ConfigValidationError if the provided string is missing or contains only whitespace.
 *
 * @param value - The string to validate.
 * @param field - The name of the field being validated.
 * @throws {ConfigValidationError} If the string is missing or contains only whitespace.
 */
function assertNonEmpty(value: string, field: string): void {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ConfigValidationError(field);
  }
}

/**
 * Creates a fully validated and normalized NetStorage client configuration.
 * Ensures required fields are present and applies defaults for optional values.
 *
 * @param input - A partial configuration object provided by the consumer.
 * @returns A complete NetStorageClientConfig with defaults applied and values validated.
 * @throws {ConfigValidationError} If a required field is missing or invalid.
 */
export function createConfig(
  input: Partial<NetStorageClientConfig>,
): NetStorageClientConfig {
  assertNonEmpty(input.key!, 'key');
  assertNonEmpty(input.keyName!, 'keyName');
  assertNonEmpty(input.host!, 'host');

  const ssl = input.ssl ?? false;
  const logLevel = input.logLevel ?? 'info';
  const logger = input.logger ?? createLogger(logLevel, packageName);
  const rateLimiters =
    input.rateLimiters ?? createRateLimiters(input.rateLimitConfig);
  const timeout = input?.request?.timeout ?? 10000;

  return {
    key: input.key!,
    keyName: input.keyName!,
    host: input.host!,
    cpCode: input.cpCode,
    ssl,
    logLevel,
    logger,
    rateLimitConfig: input.rateLimitConfig,
    rateLimiters,
    request: {
      ...input.request,
      timeout,
    },
    uri(path = '') {
      return buildUri(this, path);
    },
  };
}
