import repl, { REPLServer } from 'node:repl';
import chalk from 'chalk';
import { Command } from 'commander';
import { program } from '../index';
import {
  createLogger,
  remoteWalk,
  formatBytes,
  type NetStorageClientConfig,
  type NetStorageFile,
} from '@/index';
import {
  resolvePath,
  sortEntriesByTypeAndName,
  formatDetailedEntry,
  formatSimpleEntry,
  assertReplConfig,
  getReplCompletions,
  parseReplInput,
  resolveCliArgs,
  savePersistentConfig,
  loadClientConfig,
  getSpinner,
  type CommandArgResolutionSpec,
} from '../utils';
import type winston from 'winston';

const logger = createLogger('info', 'netstorage/repl');

/**
 * Defines resolution specifications for read-based NetStorage commands.
 *
 * Each command maps its positional arguments to how they should be resolved:
 * - 'remote': argument should resolve to a remote path.
 */
export const GetCommands: CommandArgResolutionSpec = {
  stat: { 0: 'remote' },
  dir: { 0: 'remote' },
  du: { 0: 'remote' },
  tree: { 0: 'remote' },
  download: { 0: 'remote', 1: 'local' },
  dl: { 0: 'remote', 1: 'local' },
  get: { 0: 'remote', 1: 'local' },
};

/**
 * Defines resolution specifications for write-based NetStorage commands.
 *
 * Each command maps its positional arguments to how they should be resolved:
 * - 'local': argument should resolve to a local path.
 * - 'remote': argument should resolve to a remote path.
 * - 'passthrough': argument is preserved as-is without resolution.
 */
export const PutCommands: CommandArgResolutionSpec = {
  sync: { 0: 'local', 1: 'remote' },
  upload: { 0: 'local', 1: 'remote' },
  up: { 0: 'local', 1: 'remote' },
  put: { 0: 'local', 1: 'remote' },
  rm: { 0: 'remote' },
  symlink: { 0: 'remote', 1: 'remote' },
  mtime: { 0: 'remote', 1: 'passthrough' },
  rename: { 0: 'remote', 1: 'remote' },
  mv: { 0: 'remote', 1: 'remote' },
  mkdir: { 0: 'remote' },
  rmdir: { 0: 'remote' },
};

/**
 * Combined resolution specification for all supported CLI commands.
 *
 * Merges `GetCommands` and `PutCommands` to support tab completion and
 * argument resolution logic for the interactive REPL shell.
 */
export const CLICommands: CommandArgResolutionSpec = {
  ...GetCommands,
  ...PutCommands,
  config: {
    0: 'passthrough',
    1: 'passthrough',
  },
};

/**
 * List of internal REPL commands handled directly by the REPL shell. These
 * commands do not invoke the main CLI parser.
 */
export const REPLCommands = ['cd', 'ls', 'll', 'pwd', 'clear', 'exit'] as const;

/**
 * Interface representing the remote context for the interactive NetStorage
 * shell. Provides methods for managing the current remote path, caching
 * directory entries, and retrieving/updating directory contents.
 */
export interface RemoteContext {
  getPath(): string;
  setPath(path: string): void;
  getEntries(): Promise<NetStorageFile[]>;
  loadEntries(path: string): Promise<{
    rootMeta?: NetStorageFile;
    entries: NetStorageFile[];
  }>;
  clearCache(): void;
  setCachedEntries(path: string, entries: NetStorageFile[]): void;
}

/**
 * Creates a remote context object for interacting with the NetStorage working
 * directory. The context manages the current remote path, caches directory
 * entries, and exposes methods to retrieve or update remote directory contents.
 *
 * @param config - The NetStorage client configuration.
 * @returns A RemoteContext object providing access to path and entries
 * management.
 */
export function createRemoteContext(
  config: NetStorageClientConfig,
): RemoteContext {
  let remoteWorkingDir = config.lastReplPath || '/';
  const cache = createRemoteDirectoryCache();

  /**
   * Loads directory entries from the specified remote path using a remote walk.
   * Optionally caches the result if the path matches the current working
   * directory.
   *
   * @param path - Remote path to retrieve entries from.
   * @returns Promise resolving to an object containing root metadata and entries
   * array.
   */
  async function loadEntries(path: string): Promise<{
    rootMeta?: NetStorageFile;
    entries: NetStorageFile[];
  }> {
    const entries: NetStorageFile[] = [];
    let rootMeta: NetStorageFile | undefined;

    for await (const entry of remoteWalk(config, {
      path,
      maxDepth: 0,
      addSyntheticRoot: true,
    })) {
      if (entry.depth === 0 && entry.path === path) {
        rootMeta = entry.file;
      } else if (entry.file.name !== '__synthetic_root__') {
        entries.push(entry.file);
      }
    }

    if (path === remoteWorkingDir) {
      cache.setCachedEntries(path, entries);
    }

    return { rootMeta, entries };
  }

  /**
   * Retrieves directory entries for the current remote working directory. Uses
   * the cache if available, otherwise loads entries from the remote source.
   *
   * @returns Promise resolving to an array of NetStorageFile entries.
   */
  async function getEntries(): Promise<NetStorageFile[]> {
    const cached = cache.getCachedEntries(remoteWorkingDir);
    if (cached) return cached;
    const { entries } = await loadEntries(remoteWorkingDir);
    cache.setCachedEntries(remoteWorkingDir, entries);
    return entries;
  }

  return {
    getPath: () => remoteWorkingDir,
    setPath: (p: string) => {
      remoteWorkingDir = p;
      savePersistentConfig({ lastReplPath: remoteWorkingDir });
    },
    getEntries,
    loadEntries,
    clearCache: cache.clear,
    setCachedEntries: cache.setCachedEntries,
  };
}

/**
 * Creates an in-memory cache utility for directory listings in the REPL. Stores
 * entries for a single directory path and clears when navigating to a new path.
 *
 * @returns An object with methods to get, set, and clear cached entries.
 */
export function createRemoteDirectoryCache() {
  let cachedPath = '';
  let cachedEntries: NetStorageFile[] = [];

  return {
    /**
     * Retrieves cached entries for the specified path, if present.
     *
     * @param path - Path to look up in the cache.
     * @returns Cached entries array, or undefined if not cached.
     */
    getCachedEntries(path: string): NetStorageFile[] | undefined {
      return path === cachedPath ? cachedEntries : undefined;
    },
    /**
     * Stores entries for a specific path in the cache.
     *
     * @param path - Path to associate with the cached entries.
     * @param entries - Array of NetStorageFile entries to cache.
     */
    setCachedEntries(path: string, entries: NetStorageFile[]) {
      cachedPath = path;
      cachedEntries = entries;
    },
    /**
     * Clears the current cached path and entries.
     */
    clear() {
      cachedPath = '';
      cachedEntries = [];
    },
  };
}

/**
 * Executes the `cd` command in the REPL. Resolves the target path, verifies it's
 * a directory, and updates the remote context. Logs a warning if the path is
 * invalid or not a directory.
 *
 * @param target - Target path to change to (relative or absolute).
 * @param ctx - RemoteContext instance for managing remote path state.
 * @param logger - Logger for outputting warnings and errors.
 * @returns Promise that resolves when the operation is complete.
 */
export async function handleCdCommand(
  target: string | undefined,
  ctx: RemoteContext,
  logger: winston.Logger,
): Promise<void> {
  const resolved = resolvePath(target, ctx.getPath());
  const prev = ctx.getPath();

  try {
    const { rootMeta, entries } = await ctx.loadEntries(resolved);
    const isDir = rootMeta?.type === 'dir';
    if (!isDir && resolved !== '/') {
      logger.warn(`Not a directory: ${resolved}`);
      return;
    }
    ctx.setPath(resolved);
    ctx.setCachedEntries(resolved, entries);
  } catch {
    logger.warn(`Remote directory not found: ${resolved}`);
    ctx.setPath(prev);
  }
}

/**
 * Executes the `ls` or `ll` command in the REPL. Fetches and displays directory
 * entries for the target or current path, optionally showing detailed metadata.
 * Entries are sorted by type and name.
 *
 * @param detailed - Whether to show detailed output (type, size, modified time,
 * colorized name).
 * @param ctx - RemoteContext instance for retrieving entries.
 * @param target - Optional target path to list.
 * @returns Promise that resolves when the command finishes.
 */
export async function handleLsCommand(
  detailed: boolean,
  ctx: RemoteContext,
  target?: string,
): Promise<void> {
  const resolved = target ? resolvePath(target, ctx.getPath()) : ctx.getPath();
  const entries = target
    ? (await ctx.loadEntries(resolved)).entries
    : await ctx.getEntries();
  sortEntriesByTypeAndName(entries);

  const maxSizeLength = Math.max(
    ...entries.map((e) =>
      e.type === 'file' && e.size ? formatBytes(Number(e.size)).length : 2,
    ),
  );

  const lines = detailed
    ? entries.map((e) => formatDetailedEntry(e, maxSizeLength))
    : entries.map(formatSimpleEntry);

  for (const line of lines) {
    process.stdout.write(line + '\n');
  }
}

/**
 * Refreshes the completer function with the latest entries from the remote context.
 *
 * @param {RemoteContext} context - The remote context to retrieve entries from.
 * @return {function} A synchronous tab-completion function for the REPL.
 */
export async function refreshCompleter(context: RemoteContext) {
  return createCompleterSync(await context.getEntries());
}

/**
 * Creates a synchronous tab-completion function for the REPL. Provides
 * command-aware completion for REPL and CLI commands, suggesting appropriate
 * entries or commands.
 *
 * @param entries - Array of NetStorageFile entries to use for completion
 * suggestions.
 * @returns A function compatible with the REPL completer API.
 */
export function createCompleterSync(
  entries: NetStorageFile[],
): (line: string) => [string[], string] {
  const remoteEntries = entries.map((e) => e.name).sort();
  const remoteDirEntries = entries
    .filter((e) => e.type === 'dir')
    .map((e) => e.name);
  const allCommands = [...Object.keys(CLICommands), ...REPLCommands];

  /**
   * Tab completion function for the REPL.
   *
   * @param line - The current input line.
   * @returns Tuple of possible completions and the substring to be replaced.
   */
  return (line: string) => {
    const trimmed = line.trim();
    const tokens = trimmed.split(/\s+/);
    const cmd = tokens[0];
    const endsWithSpace = /\s$/.test(line);
    const currentArgIndex = endsWithSpace ? tokens.length : tokens.length - 1;
    const arg = tokens[currentArgIndex] ?? '';

    if (cmd === 'cd' || cmd === 'ls' || cmd === 'll') {
      const matches = remoteDirEntries.filter((name) => name.startsWith(arg));
      return [matches.length ? matches : remoteDirEntries, arg];
    }

    if (CLICommands[cmd]) {
      const resolutionSpec = CLICommands[cmd];
      const localArgIndices = new Set<number>();
      const remoteArgIndices = new Set<number>();
      for (const index in resolutionSpec) {
        const key = parseInt(index, 10);
        const value = resolutionSpec[key];
        if (value === 'local') localArgIndices.add(key);
        if (value === 'remote') remoteArgIndices.add(key);
      }
      return getReplCompletions(line, tokens, arg, remoteEntries, {
        localArgIndices,
        remoteArgIndices,
      });
    }

    const matches = allCommands.filter((c) => c.startsWith(trimmed));
    return [matches.length ? matches : allCommands, trimmed];
  };
}

/**
 * Resumes the interactive shell by updating the prompt and requesting user input.
 *
 * @returns {void} No return value.
 */
export function resumeShell(context: RemoteContext, shell: REPLServer): void {
  shell.setPrompt(`nst:${chalk.cyan(context.getPath())}> `);
  shell.prompt();
}

/**
 * Handles internal REPL commands, such as `cd`, `ls`, and `pwd`.
 *
 * @param command - The command to handle.
 * @param args - The arguments for the command.
 * @param options - The options for the command.
 */
export const runReplCommand = async (
  config: NetStorageClientConfig,
  context: RemoteContext,
  command: string,
  args: string[],
  options: string[],
): Promise<void> => {
  switch (command) {
    case 'cd':
      await handleCdCommand(args[0], context, logger);
      break;
    case 'ls':
      await handleLsCommand(options.includes('-l'), context, args[0]);
      break;
    case 'll':
      await handleLsCommand(true, context, args[0]);
      break;
    case 'pwd':
      process.stdout.write(`${config.uri(context.getPath())}\n`);
      break;
    case 'clear':
      process.stdout.write('\x1Bc');
      break;
    case 'exit':
      process.exit(0);
      break;
    default: {
      break;
    }
  }
};

/**
 * Handles CLI commands.
 *
 * @param config - The NetStorage client configuration.
 * @param context - The remote context for the REPL.
 * @param command - The command to handle.
 * @param args - The arguments for the command.
 * @param options - The options for the command.
 */
export const runClICommand = async (
  config: NetStorageClientConfig,
  context: RemoteContext,
  command: string,
  args: string[],
  options: string[],
) => {
  if (!(command in CLICommands)) return;
  const resolutionSpec = CLICommands[command];
  const resolvedArgs = resolveCliArgs(args, resolutionSpec, context.getPath());
  await program
    .exitOverride()
    .parseAsync([command, ...resolvedArgs, ...options], {
      from: 'user',
    });
  if (command === 'config' && ['set', 'clear'].includes(args[0])) {
    config = await loadClientConfig();
    assertReplConfig(config);
    context = createRemoteContext(config);
  }
  if (command in PutCommands) {
    context.clearCache();
    context.getEntries();
  }
};

/**
 * Constructs the `repl` command for the NetStorage CLI. Launches an interactive
 * shell that accepts NetStorage CLI commands and routes them through Commander.
 *
 * @returns Commander Command instance for the REPL.
 */
export function createReplCommand(): Command {
  return new Command('repl')
    .description('Start an interactive NetStorage shell')
    .action(async () => {
      try {
        const config = await loadClientConfig();
        assertReplConfig(config);
        const spinner = getSpinner(config);
        const context = createRemoteContext(config);

        // Current tab completion function used by the REPL to suggest completions.
        let completer = createCompleterSync([]);

        // The REPL instance started for the interactive shell session.
        const shell = repl.start({
          prompt: `nst:${chalk.cyan(context.getPath())}> `,
          ignoreUndefined: true,
          completer: (...args: [string]) => completer(...args),
          eval: async (input, _context, _filename, callback) => {
            const { command, args, options } = parseReplInput(input);
            try {
              spinner?.start();
              await runClICommand(config, context, command, args, options);
              await runReplCommand(config, context, command, args, options);
              completer = await refreshCompleter(context);
            } catch (err) {
              logger.error(err);
            } finally {
              spinner?.stop();
              resumeShell(context, shell);
              callback(null, undefined);
            }
          },
        });
        shell.on('exit', () => {
          process.exit(0);
        });
      } catch (err) {
        logger.error(err);
        process.exit(1);
      }
    });
}
