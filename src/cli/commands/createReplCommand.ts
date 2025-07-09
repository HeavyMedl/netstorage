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
 * Defines which arguments for GET commands should be resolved as local or remote paths.
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
 * Defines which arguments for PUT commands should be resolved as local or remote paths.
 */
const PutCommands: Record<string, Record<number, 'local' | 'remote'>> = {
  sync: { 0: 'local', 1: 'remote' },
  upload: { 0: 'local', 1: 'remote' },
  up: { 0: 'local', 1: 'remote' },
  put: { 0: 'local', 1: 'remote' },
  rm: { 0: 'remote' },
};

/**
 * Merged argument resolution for REPL commands (GET and PUT).
 */
const CLICommands: Record<string, Record<number, 'local' | 'remote'>> = {
  ...GetCommands,
  ...PutCommands,
};

/**
 * List of internal REPL commands that are handled directly by the REPL shell.
 * These commands do not delegate to the main CLI command parser.
 */
const ReplInternalCommands = [
  'cd',
  'ls',
  'll',
  'pwd',
  'clear',
  'exit',
] as const;

/**
 * Represents an interactive NetStorage shell context.
 *
 * @interface
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
 * Creates a contextual interface to interact with a remote NetStorage
 * working directory.
 *
 * This context manages the current path (`remoteWorkingDir`), provides a
 * lightweight caching layer for directory entries, and exposes methods for
 * retrieving and refreshing remote entries.
 *
 * @param config - The NetStorage client configuration.
 * @returns An object containing:
 *   - `getPath`: Getter for the current remote working directory.
 *   - `setPath`: Setter to update the working directory.
 *   - `getEntries`: Returns cached entries for the current path or fetches
 *     if absent.
 *   - `loadEntries`: Performs a remote walk to load and optionally cache
 *     entries.
 */
function createRemoteContext(config: NetStorageClientConfig): RemoteContext {
  let remoteWorkingDir = config.lastReplPath || '/';
  const cache = createRemoteDirectoryCache();

  /**
   * Loads directory entries from the remote path using a remote walk.
   *
   * Optionally caches entries if the path matches the current working
   * directory.
   *
   * @param path - The remote path to load entries from.
   * @returns An object with optional root metadata and entries array.
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
   * Retrieves cached entries for the current remote working directory.
   *
   * If no cache exists, performs a remote load and caches the results.
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
 * Creates an in-memory cache for directory listings in the REPL.
 *
 * This simple cache stores entries for a single directory path and clears
 * when navigated away.
 *
 * @returns An object containing:
 *   - `getCachedEntries`: Retrieves cached entries for a path if available.
 *   - `setCachedEntries`: Stores entries for a specific path.
 *   - `clear`: Clears the cache.
 */
function createRemoteDirectoryCache() {
  let cachedPath = '';
  let cachedEntries: NetStorageFile[] = [];

  return {
    /**
     * Gets cached entries for a given path if it matches the cached path.
     *
     * @param path - The path to retrieve cached entries for.
     * @returns The cached entries or undefined if not cached.
     */
    getCachedEntries(path: string): NetStorageFile[] | undefined {
      return path === cachedPath ? cachedEntries : undefined;
    },
    /**
     * Sets cached entries for a given path.
     *
     * @param path - The path to cache entries for.
     * @param entries - The entries to cache.
     */
    setCachedEntries(path: string, entries: NetStorageFile[]) {
      cachedPath = path;
      cachedEntries = entries;
    },
    /**
     * Clears the cached path and entries.
     */
    clear() {
      cachedPath = '';
      cachedEntries = [];
    },
  };
}

/**
 * Handles the `cd` command within the REPL.
 *
 * Resolves the target path, verifies that it's a directory, and updates the
 * remote working directory context.
 * Logs a warning if the target is not a directory or if the path is invalid.
 *
 * @param target - The path to navigate to (can be relative or absolute).
 * @param ctx - The remote context for managing path state and remote data.
 * @param logger - Logger instance for writing warnings and debug messages.
 * @returns Promise resolving when the command completes.
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
 * Handles the `ls` command within the REPL.
 *
 * Fetches and displays directory entries for the current path, optionally
 * showing detailed metadata.
 * Entries are sorted by type and name.
 *
 * @param detailed - If true, renders output with type, size, modified time,
 *   and colorized name.
 * @param ctx - The remote context for accessing cached or live directory
 *   entries.
 * @returns Promise resolving when the command completes.
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
 * Creates a synchronous tab-completion handler for the REPL.
 *
 * Supports command-aware completion for `cd`, `download`, and their aliases.
 * For `cd`, only directory entries are suggested.
 * For `download` (and aliases: `dl`, `get`), both file and directory entries are suggested.
 * Other commands (e.g. upload, stat) are matched against a static command list.
 *
 * @param entries - List of NetStorageFile entries to use for completion.
 * @returns A REPL-compatible completer function.
 */
function createCompleterSync(
  entries: NetStorageFile[],
): (line: string) => [string[], string] {
  const remoteEntries = entries.map((e) => e.name).sort();
  const remoteDirEntries = entries
    .filter((e) => e.type === 'dir')
    .map((e) => e.name);
  const allCommands = [...Object.keys(CLICommands), ...ReplInternalCommands];

  /**
   * Completer function for REPL tab completion.
   *
   * @param line - The current input line.
   * @returns A tuple with matching completions and the substring to replace.
   */
  return (line: string) => {
    const trimmed = line.trim();
    const tokens = trimmed.split(/\s+/);
    const cmd = tokens[0];
    const arg = tokens[1] ?? '';

    if (cmd === 'cd') {
      const matches = remoteDirEntries.filter((name) => name.startsWith(arg));
      return [matches.length ? matches : remoteDirEntries, arg];
    }

    if (CLICommands[cmd]) {
      const resolutionSpec = CLICommands[cmd];
      let localArgIndex: number | undefined;
      let remoteArgIndex: number | undefined;
      for (const index in resolutionSpec) {
        const key = parseInt(index, 10);
        const value = resolutionSpec[key];
        if (value === 'local') localArgIndex = key;
        if (value === 'remote') remoteArgIndex = key;
      }
      return getReplCompletions(line, tokens, arg, remoteEntries, {
        localArgIndex,
        remoteArgIndex,
      });
    }

    const matches = allCommands.filter((c) => c.startsWith(trimmed));
    return [matches.length ? matches : allCommands, trimmed];
  };
}

/**
 * Creates the `repl` command for the NetStorage CLI.
 *
 * Launches an interactive shell that accepts NetStorage CLI commands
 * and routes them through the standard Commander interface.
 *
 * @returns A Commander Command instance for the REPL.
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
         * Current tab completion function used by the REPL to suggest
         * completions based on the current directory entries and command.
         */
        let completer = createCompleterSync([]);

        /**
         * Helper to refresh the tab completion list with the latest entries.
         *
         * @returns Promise resolving when completer is refreshed.
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
           * REPL evaluator callback for processing user commands.
           *
           * Parses and executes supported commands such as `cd`, `ls`, `pwd`,
           * and `exit`.
           * Delegates to Commander CLI for unrecognized commands.
           *
           * @param input - Raw user input line.
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
