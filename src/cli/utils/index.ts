import { readdirSync } from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { getReasonPhrase } from 'http-status-codes';
import {
  ConfigValidationError,
  createLogger,
  formatBytes,
  formatMtime,
  HttpError,
  type NetStorageFile,
  type WinstonLogLevel,
} from '@/index';

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

/**
 * Sorts NetStorage entries by type priority and alphabetically by name.
 *
 * @param entries - The entries to sort.
 */
export function sortEntriesByTypeAndName(entries: NetStorageFile[]) {
  const typeOrder = { dir: 0, file: 1, symlink: 2 };
  entries.sort((a, b) => {
    return (
      (typeOrder[a.type] ?? 3) - (typeOrder[b.type] ?? 3) ||
      a.name.localeCompare(b.name)
    );
  });
}

/**
 * Formats a single entry with detailed metadata.
 *
 * @param entry - The NetStorage file entry.
 * @param maxSizeLength - Width for right-aligned file sizes.
 * @returns A formatted string.
 */
export function formatDetailedEntry(
  entry: NetStorageFile,
  maxSizeLength: number,
): string {
  const typeLabel = entry.type.slice(0, 4).padEnd(4);
  const sizeLabel =
    entry.type === 'file' && entry.size
      ? formatBytes(Number(entry.size)).padStart(maxSizeLength)
      : '--'.padStart(maxSizeLength);
  const timeLabel = formatMtime(entry.mtime);
  const nameLabel = colorizeName(
    entry.type === 'dir' ? `${entry.name}/` : entry.name,
    entry.type,
  );
  return `${typeLabel}  ${sizeLabel}  ${timeLabel}  ${nameLabel}`;
}

/**
 * Formats a single entry for simple (non-detailed) output.
 *
 * @param entry - The NetStorage file entry.
 * @returns A formatted string.
 */
export function formatSimpleEntry(entry: NetStorageFile): string {
  return colorizeName(
    entry.type === 'dir' ? `${entry.name}/` : entry.name,
    entry.type,
  );
}

/**
 * Resolves a relative or absolute path against the current remote working
 * directory.
 *
 * - Normalizes redundant slashes.
 * - Ensures path starts with a single leading slash.
 * - Trims any trailing slashes (except root).
 *
 * @param input - The path input from the user (may be relative or absolute).
 * @param currentPath - The current working directory path.
 * @returns A normalized, absolute path.
 */
export function resolvePath(
  input: string | undefined,
  currentPath: string,
): string {
  const candidate = path.posix.normalize(
    input?.startsWith('/') ? input : `${currentPath}/${input ?? ''}`,
  );
  return (
    (candidate.startsWith('/') ? candidate : `/${candidate}`).replace(
      /\/+$/,
      '',
    ) || '/'
  );
}

/**
 * Applies terminal colorization to a NetStorage entry name based on its type.
 *
 * - Directories are cyan.
 * - Symlinks are blue.
 * - Files are gray.
 *
 * @param name - The display name of the entry.
 * @param type - The entry type: 'dir', 'file', or 'symlink'.
 * @returns The colorized name string.
 */
export function colorizeName(name: string, type: string) {
  switch (type) {
    case 'dir':
      return chalk.cyan(name);
    case 'symlink':
      return chalk.blue(name);
    default:
      return chalk.gray(name);
  }
}

/**
 * Asserts that the provided config is valid for REPL usage.
 *
 * Specifically ensures that `cpCode` is defined, since REPL operations
 * often require a default CP code for scoped commands.
 *
 * @param config - The NetStorageClientConfig to validate.
 * @throws ConfigValidationError if cpCode is not set.
 */
export function assertReplConfig(config: { cpCode?: string }): void {
  if (!config.cpCode) {
    throw new ConfigValidationError('cpCode');
  }
}

/**
 * Returns a list of local files and directories that match the provided prefix.
 *
 * @param {string} prefix - The prefix to filter local files and directories by.
 * @returns {string[]} A list of matching local files and directories.
 */
export function getLocalCompletions(prefix: string): string[] {
  const base = path.dirname(prefix || '');
  const partial = path.basename(prefix || '');
  try {
    const fullBase = base ? path.resolve(process.cwd(), base) : process.cwd();
    return readdirSync(fullBase, { withFileTypes: true })
      .map((e) => (e.isDirectory() ? e.name + '/' : e.name))
      .filter((n: string) => n.startsWith(partial))
      .sort();
  } catch {
    return [];
  }
}

/**
 * Generates tab completions for REPL commands with both remote and local path arguments.
 *
 * @param line - The raw REPL input line.
 * @param tokens - Tokenized input from the REPL.
 * @param arg - The current argument token being completed.
 * @param remoteEntries - Remote NetStorage entry names.
 * @param options - Object specifying which argument indices are for local or remote completions.
 * @returns A tuple of matching completions and the replacement prefix.
 */
export function getReplCompletions(
  line: string,
  tokens: string[],
  arg: string,
  remoteEntries: string[],
  options: {
    localArgIndex?: number;
    remoteArgIndex?: number;
  },
): [string[], string] {
  const endsWithSpace = /\s$/.test(line);

  // Calculate the index of the next token (current arg position)
  const nextTokenIndex = endsWithSpace ? tokens.length : tokens.length - 1;
  const currentArgIndex = nextTokenIndex - 1;

  const isLocalCompletion = options.localArgIndex === currentArgIndex;
  const isRemoteCompletion = options.remoteArgIndex === currentArgIndex;

  const prefix = endsWithSpace ? '' : arg;

  const matches = isLocalCompletion
    ? getLocalCompletions(prefix)
    : isRemoteCompletion
      ? remoteEntries.filter((name) => name.startsWith(prefix))
      : [];
  return [matches.length ? matches : [], prefix];
}
