import { ConfigValidationError, createLogger, HttpError } from '@/index';
import { getReasonPhrase } from 'http-status-codes';
import type { WinstonLogLevel } from '@/index';

export function validateTimeout(v: string): number {
  const n = parseInt(v, 10);
  if (isNaN(n)) throw new Error('Invalid timeout value');
  return n;
}

export function validateCancelAfter(v: string): number {
  const n = parseInt(v, 10);
  if (isNaN(n)) throw new Error('Invalid cancel-after value');
  return n;
}

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

export function printJson(data: unknown, pretty = false) {
  const payload = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  process.stdout.write(payload + '\n');
}
