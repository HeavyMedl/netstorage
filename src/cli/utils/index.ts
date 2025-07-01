import { ConfigValidationError, createLogger, HttpError } from '@/index';
import { getReasonPhrase } from 'http-status-codes';
import type { WinstonLogLevel } from '@/index';

/**
 * Validates and parses a timeout value from a string.
 *
 * @param v - The timeout value as a string.
 * @returns The parsed timeout as a number.
 * @throws If the value cannot be parsed into a valid number.
 */
export function validateTimeout(v: string): number {
  const n = parseInt(v, 10);
  if (isNaN(n)) throw new Error('Invalid timeout value');
  return n;
}

/**
 * Validates and parses a cancel-after value from a string.
 *
 * @param v - The cancel-after value as a string.
 * @returns The parsed cancel-after value as a number.
 * @throws If the value cannot be parsed into a valid number.
 */
export function validateCancelAfter(v: string): number {
  const n = parseInt(v, 10);
  if (isNaN(n)) throw new Error('Invalid cancel-after value');
  return n;
}

/**
 * Resolves an AbortSignal that triggers after the given number of milliseconds.
 *
 * @param cancelAfter - Time in milliseconds to wait before aborting.
 * @returns An AbortSignal if cancelAfter is provided; otherwise, undefined.
 */
export function resolveAbortSignal(
  cancelAfter?: number,
): AbortSignal | undefined {
  if (cancelAfter != null) {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), cancelAfter);
    return controller.signal;
  }
  return undefined;
}

/**
 * Handles CLI-related errors and logs a user-friendly message.
 * Exits the process with status code 1.
 *
 * @param err - The error object caught during execution.
 * @param logger - The logger instance to use for logging.
 */
export function handleCliError(
  err: unknown,
  logger: ReturnType<typeof createLogger>,
): void {
  if (err instanceof ConfigValidationError) {
    logger.error(err.message);
    logger.info(`$ npx netstorage config set [${err.field}] [value]`);
  } else if (err instanceof HttpError) {
    const reason = getReasonPhrase(err.code) || 'Unknown';
    logger.error(
      `HTTP ${err.code} ${reason} (${err.method?.toUpperCase()} ${err.url})`,
    );
  } else {
    logger.error('Unexpected error');
    console.error(err);
  }
  process.exit(1);
}

/**
 * Resolves the appropriate Winston log level override based on CLI options.
 *
 * @param logLevel - Optional string log level explicitly provided.
 * @param verbose - Whether verbose logging is enabled.
 * @returns An object containing the log level override, or undefined if invalid.
 */
export function getLogLevelOverride(
  logLevel?: string,
  verbose?: boolean,
): Partial<{ logLevel: WinstonLogLevel }> | undefined {
  const allowedLevels: WinstonLogLevel[] = [
    'error',
    'warn',
    'info',
    'verbose',
    'debug',
    'silly',
  ];
  const resolved = logLevel ?? (verbose ? 'verbose' : undefined);
  return allowedLevels.includes(resolved as WinstonLogLevel)
    ? { logLevel: resolved as WinstonLogLevel }
    : undefined;
}

/**
 * Prints data to stdout as a JSON string.
 *
 * @param data - The data to stringify and print.
 * @param pretty - Whether to pretty-print the JSON with indentation.
 */
export function printJson(data: unknown, pretty = false) {
  const payload = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  process.stdout.write(payload + '\n');
}
