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
} from '../utils';

const logger = createLogger('info', 'netstorage/repl');

interface RemoteContext {
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
function createRemoteContext(config: NetStorageClientConfig) {
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

// REPL command handlers

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
  logger: ReturnType<typeof createLogger>,
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
 * For the `cd` command, only directory entries are suggested.
 * Other commands (e.g. upload, stat) are matched against a static command
 * list.
 *
 * @param entries - List of NetStorageFile entries to use for completion.
 * @returns A REPL-compatible completer function.
 */
function createCompleterSync(
  entries: NetStorageFile[],
): (line: string) => [string[], string] {
  const staticCommands = [
    'cd',
    'pwd',
    'exit',
    'upload',
    'download',
    'stat',
    'clear',
  ];
  const dirNames = entries
    .filter((e) => e.type === 'dir')
    .map((e) => e.name)
    .sort();

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
      const matches = dirNames.filter((name) => name.startsWith(arg));
      return [matches.length ? matches : dirNames, arg];
    }

    const matches = staticCommands.filter((c) => c.startsWith(trimmed));
    return [matches.length ? matches : staticCommands, trimmed];
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
            const [command, ...args] = input.trim().split(/\s+/);

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
                  logger.info('Goodbye!');
                  process.exit(0);
                  break;
                default:
                  if (command !== '') {
                    await program
                      .exitOverride()
                      .parseAsync([command, ...args], { from: 'user' });
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
          const updatedConfig: Partial<NetStorageClientConfig> = {
            lastReplPath: context.getPath(),
          };
          savePersistentConfig(updatedConfig);
          logger.info('Goodbye!');
          process.exit(0);
        });
      } catch (err) {
        logger.error(err);
        process.exit(1);
      }
    });
}
