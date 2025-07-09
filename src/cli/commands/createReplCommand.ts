import repl from 'node:repl';
import chalk from 'chalk';
import { Command } from 'commander';
import { program } from '../index'; // Assumes program is exported from CLI index
import { loadClientConfig } from '../utils/loadConfig';
import { savePersistentConfig } from '../utils/configStore';
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
} from '../utils';
import type winston from 'winston';

const logger = createLogger('info', 'netstorage/repl');

/**
 * Specifies which arguments for GET commands should be interpreted as local or remote paths.
 * The key is the command name, and the value is a mapping of argument index to 'local' or 'remote'.
 */
const GetCommands: Record<string, Record<number, 'local' | 'remote'>> = {
  stat: { 0: 'remote' },
  dir: { 0: 'remote' },
  tree: { 0: 'remote' },
  download: { 0: 'remote', 1: 'local' },
  dl: { 0: 'remote', 1: 'local' },
  get: { 0: 'remote', 1: 'local' },
};

/**
 * Specifies which arguments for PUT commands should be interpreted as local or remote paths.
 * The key is the command name, and the value is a mapping of argument index to 'local' or 'remote'.
 */
const PutCommands: Record<string, Record<number, 'local' | 'remote'>> = {
  sync: { 0: 'local', 1: 'remote' },
  upload: { 0: 'local', 1: 'remote' },
  up: { 0: 'local', 1: 'remote' },
  put: { 0: 'local', 1: 'remote' },
  rm: { 0: 'remote' },
  symlink: { 0: 'remote', 1: 'remote' },
};

/**
 * Aggregates argument resolution mappings for all CLI commands available in the REPL.
 * Used to determine which arguments are local or remote paths for each command.
 */
const CLICommands: Record<string, Record<number, 'local' | 'remote'>> = {
  ...GetCommands,
  ...PutCommands,
};

/**
 * List of internal REPL commands handled directly by the REPL shell.
 * These commands do not invoke the main CLI parser.
 */
const REPLCommands = ['cd', 'ls', 'll', 'pwd', 'clear', 'exit'] as const;

/**
 * Interface representing the remote context for the interactive NetStorage shell.
 * Provides methods for managing the current remote path, caching directory entries,
 * and retrieving/updating directory contents.
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
 * Creates a remote context object for interacting with the NetStorage working directory.
 * The context manages the current remote path, caches directory entries, and exposes
 * methods to retrieve or update remote directory contents.
 *
 * @param config - The NetStorage client configuration.
 * @returns A RemoteContext object providing access to path and entries management.
 */
function createRemoteContext(config: NetStorageClientConfig): RemoteContext {
  let remoteWorkingDir = config.lastReplPath || '/';
  const cache = createRemoteDirectoryCache();

  /**
   * Loads directory entries from the specified remote path using a remote walk.
   * Optionally caches the result if the path matches the current working directory.
   *
   * @param path - Remote path to retrieve entries from.
   * @returns Promise resolving to an object containing root metadata and entries array.
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
   * Retrieves directory entries for the current remote working directory.
   * Uses the cache if available, otherwise loads entries from the remote source.
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
 * Creates an in-memory cache utility for directory listings in the REPL.
 * Stores entries for a single directory path and clears when navigating to a new path.
 *
 * @returns An object with methods to get, set, and clear cached entries.
 */
function createRemoteDirectoryCache() {
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
 * Executes the `cd` command in the REPL.
 * Resolves the target path, verifies it's a directory, and updates the remote context.
 * Logs a warning if the path is invalid or not a directory.
 *
 * @param target - Target path to change to (relative or absolute).
 * @param ctx - RemoteContext instance for managing remote path state.
 * @param logger - Logger for outputting warnings and errors.
 * @returns Promise that resolves when the operation is complete.
 */
async function handleCdCommand(
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
 * Executes the `ls` or `ll` command in the REPL.
 * Fetches and displays directory entries for the current path, optionally showing detailed metadata.
 * Entries are sorted by type and name.
 *
 * @param detailed - Whether to show detailed output (type, size, modified time, colorized name).
 * @param ctx - RemoteContext instance for retrieving entries.
 * @returns Promise that resolves when the command finishes.
 */
async function handleLsCommand(
  detailed: boolean,
  ctx: RemoteContext,
): Promise<void> {
  const entries = await ctx.getEntries();
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
 * Creates a synchronous tab-completion function for the REPL.
 * Provides command-aware completion for REPL and CLI commands, suggesting appropriate entries or commands.
 *
 * @param entries - Array of NetStorageFile entries to use for completion suggestions.
 * @returns A function compatible with the REPL completer API.
 */
function createCompleterSync(
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
 * Constructs the `repl` command for the NetStorage CLI.
 * Launches an interactive shell that accepts NetStorage CLI commands and routes them through Commander.
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
        const context = createRemoteContext(config);
        let entries: NetStorageFile[] = [];

        /**
         * Current tab completion function used by the REPL to suggest completions.
         */
        let completer = createCompleterSync([]);

        /**
         * Refreshes the tab completion list with the latest directory entries.
         *
         * @returns Promise that resolves when the completer is updated.
         */
        async function refreshCompleter() {
          entries = await context.getEntries();
          completer = createCompleterSync(entries);
        }

        /**
         * The REPL instance started for the interactive shell session.
         */
        const shell = repl.start({
          prompt: `nst:${chalk.cyan(context.getPath())}> `,
          ignoreUndefined: true,
          completer: (...args: [string]) => completer(...args),
          /**
           * Evaluator callback for processing user commands in the REPL.
           * Handles internal REPL commands and delegates other commands to the CLI parser.
           *
           * @param input - Raw input line from the user.
           * @param _context - REPL context object (unused).
           * @param _filename - Filename for the REPL context (unused).
           * @param callback - Callback to resume REPL input loop.
           */
          eval: async (input, _context, _filename, callback) => {
            const { command, args, options } = parseReplInput(input);
            try {
              switch (command) {
                case 'cd':
                  await handleCdCommand(args[0], context, logger);
                  await refreshCompleter();
                  break;
                case 'ls':
                  await handleLsCommand(args.includes('-l'), context);
                  await refreshCompleter();
                  break;
                case 'll':
                  await handleLsCommand(true, context);
                  await refreshCompleter();
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
                  if (command in CLICommands) {
                    const resolutionSpec = CLICommands[command];
                    const resolvedArgs = resolveCliArgs(
                      args,
                      resolutionSpec,
                      context.getPath(),
                    );
                    await program
                      .exitOverride()
                      .parseAsync([command, ...resolvedArgs, ...options], {
                        from: 'user',
                      });
                    if (command in PutCommands) {
                      context.clearCache();
                    }
                  }
                  break;
                }
              }
            } catch (err) {
              logger.error(err);
            }

            shell.setPrompt(`nst:${chalk.cyan(context.getPath())}> `);
            shell.prompt();
            callback(null, undefined);
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
