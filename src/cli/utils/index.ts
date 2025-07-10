import { readdirSync } from 'node:fs';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

import chalk from 'chalk';
import { getReasonPhrase } from 'http-status-codes';
import yargsParser from 'yargs-parser';

import {
  createConfig,
  ConfigValidationError,
  createLogger,
  formatBytes,
  formatMtime,
  HttpError,
  type NetStorageFile,
  type WinstonLogLevel,
  type NetStorageClientConfig,
} from '@/index';

/**
 * Specifies how each positional argument of a command should be resolved.
 *
 * Each key is a command string mapping to an object where keys are argument
 * indices and values indicate resolution mode:
 * - 'local': argument is a local path.
 * - 'remote': argument is a remote path.
 * - 'passthrough': argument is passed through as-is without resolution.
 */
export interface CommandArgResolutionSpec {
  [command: string]: {
    [index: number]: 'local' | 'remote' | 'passthrough';
  };
}

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
 * Resolves an AbortSignal that triggers after the given number of
 * milliseconds.
 *
 * @param cancelAfter - Time in milliseconds to wait before aborting.
 * @returns An AbortSignal if cancelAfter is provided; otherwise,
 * undefined.
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
 * @returns An object containing the log level override, or undefined if
 * invalid.
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
 * @param input - The path input from the user (may be relative or
 * absolute).
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
 * Applies terminal colorization to a NetStorage entry name based on its
 * type.
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
 * Returns a list of local files and directories that match the provided
 * prefix.
 *
 * @param {string} prefix - The prefix to filter local files and directories
 * by.
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
 * Generates tab completions for REPL commands based on specified local and
 * remote argument positions.
 *
 * Supports commands where multiple positional arguments may be resolved as
 * either local or remote paths.
 *
 * @param line - The raw REPL input line.
 * @param tokens - Tokenized input from the REPL.
 * @param arg - The current argument token being completed.
 * @param remoteEntries - Remote NetStorage entry names.
 * @param options - Object with Sets identifying which argument indices
 * should resolve as local or remote.
 * @returns A tuple of matching completions and the replacement prefix.
 */
export function getReplCompletions(
  line: string,
  tokens: string[],
  arg: string,
  remoteEntries: string[],
  options: {
    localArgIndices?: Set<number>;
    remoteArgIndices?: Set<number>;
  },
): [string[], string] {
  const endsWithSpace = /\s$/.test(line);

  // Calculate the index of the next token (current arg position)
  const nextTokenIndex = endsWithSpace ? tokens.length : tokens.length - 1;
  const currentArgIndex = nextTokenIndex - 1;

  const isLocalCompletion = options.localArgIndices?.has(currentArgIndex);
  const isRemoteCompletion = options.remoteArgIndices?.has(currentArgIndex);

  const prefix = endsWithSpace ? '' : arg;

  const matches = isLocalCompletion
    ? getLocalCompletions(prefix)
    : isRemoteCompletion
      ? remoteEntries.filter((name) => name.startsWith(prefix))
      : [];
  return [matches.length ? matches : [], prefix];
}

/**
 * Parses the input string to extract command, arguments, and options using
 * yargs-parser.
 *
 * All returned args and options are coerced to strings.
 * Handles both short (e.g., -v) and long (e.g., --verbose) options.
 *
 * @param input - The raw input string from the REPL.
 * @returns An object containing the command, args, and options as string
 * arrays.
 */
export function parseReplInput(input: string): {
  command: string;
  args: string[];
  options: string[];
} {
  const parsed = yargsParser(input.trim(), {
    configuration: {
      'camel-case-expansion': false,
      'dot-notation': false,
      'parse-numbers': false,
    },
  });

  const [rawCommand = ''] = parsed._;
  const command = String(rawCommand);
  const args = parsed._.slice(1).map(String);

  const options: string[] = Object.entries(parsed)
    .filter(([key]) => key !== '_')
    .flatMap(([key, val]) => {
      const prefix = key.length === 1 ? `-${key}` : `--${key}`;
      if (val === true) return [prefix];
      if (Array.isArray(val)) return val.flatMap((v) => [prefix, String(v)]);
      return [prefix, String(val)];
    });

  return { command, args, options };
}

/**
 * Resolves CLI arguments based on resolution spec and working directory.
 *
 * For arguments marked as 'remote' that are missing, infers the value using
 * the basename of a corresponding local argument (if available) or
 * defaults to the current remote working directory.
 *
 * Supports multiple remote, local, or passthrough positions defined via the
 * resolutionSpec.
 * Arguments marked as 'passthrough' are preserved as-is without
 * resolution.
 *
 * @param args - Raw user-provided arguments.
 * @param resolutionSpec - Map indicating whether each positional argument
 * should resolve as 'local', 'remote', or 'passthrough'.
 * @param cwd - Current remote working directory.
 * @returns Fully resolved list of arguments for CLI execution.
 */
export function resolveCliArgs(
  args: string[],
  resolutionSpec: CommandArgResolutionSpec[string],
  cwd: string,
): string[] {
  const result: string[] = [];
  const maxIndex = Math.max(...Object.keys(resolutionSpec).map(Number));

  for (let i = 0; i <= maxIndex; i++) {
    const mode = resolutionSpec[i];
    const arg = args[i];

    if (mode === 'passthrough') {
      result.push(arg ?? '');
      continue;
    }

    if (mode === 'local') {
      result.push(arg ?? '');
      continue;
    }

    if (arg !== undefined) {
      result.push(resolvePath(arg, cwd));
      continue;
    }

    const localIndex = Object.entries(resolutionSpec).find(
      ([, v]) => v === 'local',
    )?.[0];
    const localArg =
      localIndex !== undefined ? args[Number(localIndex)] : undefined;

    result.push(localArg ? path.posix.join(cwd, path.basename(localArg)) : cwd);
  }

  return result;
}

/**
 * Loads project-level NetStorage configuration from `netstorage.json` in the current working directory.
 *
 * @returns {Promise<Partial<NetStorageClientConfig>>} Parsed config object or an empty object if not found.
 */
async function loadFileConfig(): Promise<Partial<NetStorageClientConfig>> {
  const fallbackFiles = ['netstorage.json'];
  for (const file of fallbackFiles) {
    const fullPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      const raw = fs.readFileSync(fullPath, 'utf-8');
      return JSON.parse(raw);
    }
  }

  return {};
}

/**
 * Removes any properties from the given object that have an undefined value.
 *
 * @example
 * const input = { foo: 'bar', baz: undefined };
 * const output = removeUndefined(input);
 * // output is { foo: 'bar' }
 *
 * @param obj The object to filter.
 * @returns A new object missing any properties with undefined values from the input object.
 */
function removeUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

/**
 * Resolves a complete NetStorage client config from layered configuration sources.
 *
 * Resolution order (highest to lowest priority):
 * 1. CLI options (explicit flags passed to CLI command)
 * 2. Environment variables (NETSTORAGE_* keys)
 * 3. Project-level config file (`netstorage.json` in the current directory)
 * 4. Persistent config (`~/.config/netstorage/.netstorage.json`)
 *
 * @param {Partial<NetStorageClientConfig>} [cliOptions] - Optional config overrides from CLI flags.
 * @returns {Promise<NetStorageClientConfig>} Fully resolved configuration object.
 */
export async function loadClientConfig(
  cliOptions: Partial<NetStorageClientConfig> = {},
): Promise<NetStorageClientConfig> {
  const envConfig: Partial<NetStorageClientConfig> = {
    key: process.env.NETSTORAGE_API_KEY,
    keyName: process.env.NETSTORAGE_API_KEYNAME,
    host: process.env.NETSTORAGE_HOST,
    ssl: process.env.NETSTORAGE_SSL === 'true',
    cpCode: process.env.NETSTORAGE_CP_CODE,
  };
  const fileConfig = await loadFileConfig();
  const persistentConfig = loadPersistentConfig();

  // Merge: CLI > Env > File > Persistent
  const merged: Partial<NetStorageClientConfig> = {
    ...removeUndefined(persistentConfig),
    ...removeUndefined(fileConfig),
    ...removeUndefined(envConfig),
    ...removeUndefined(cliOptions),
  };

  return createConfig(merged as NetStorageClientConfig);
}

const CONFIG_FILE = path.join(
  os.homedir(),
  '.config',
  'netstorage',
  'config.json',
);

/**
 * Loads the persisted NetStorage client configuration from the user's config file.
 *
 * @returns {Partial<NetStorageClientConfig>} The saved configuration, or an empty object if none exists.
 */
export function loadPersistentConfig(): Partial<NetStorageClientConfig> {
  if (fs.existsSync(CONFIG_FILE)) {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(raw);
  }
  return {};
}

/**
 * Merges and saves the provided configuration with the existing persisted config.
 * Creates the config directory if it does not exist.
 *
 * @param {Partial<NetStorageClientConfig>} update - Configuration values to persist.
 */
export function savePersistentConfig(
  update: Partial<NetStorageClientConfig>,
): void {
  const current = loadPersistentConfig();
  const merged = { ...current, ...update };
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf-8');
}

/**
 * Overwrites the persistent configuration file with the given config object.
 *
 * @param {Partial<NetStorageClientConfig>} config - The complete configuration to persist.
 */
function overwritePersistentConfig(
  config: Partial<NetStorageClientConfig>,
): void {
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Deletes the persisted NetStorage configuration file if it exists.
 */
export function clearPersistentConfig(): void {
  if (fs.existsSync(CONFIG_FILE)) {
    fs.unlinkSync(CONFIG_FILE);
  }
}

/**
 * Deletes a specific key from the persisted NetStorage configuration file.
 *
 * @param {keyof NetStorageClientConfig} key - The configuration key to remove.
 */
export function clearPersistentConfigKey(
  key: keyof NetStorageClientConfig,
): void {
  const current = loadPersistentConfig();
  if (key in current) {
    delete current[key];
    overwritePersistentConfig(current);
  }
}

/**
 * Returns the path to the persistent configuration file.
 *
 * @returns {string} The absolute path to the saved config file.
 */
export function getPersistentConfigPath(): string {
  return CONFIG_FILE;
}
