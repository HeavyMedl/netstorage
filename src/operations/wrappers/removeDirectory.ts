import {
  remoteWalk,
  rm,
  rmdir,
  type RemoteWalkEntry,
  type NetStorageClientConfig,
} from '@/index';

/**
 * Represents the result of a single remove operation (file or directory).
 *
 * @property remotePath - The full NetStorage path of the removed entry.
 * @property status - Status metadata from the NetStorage API response.
 */
export interface RemoveResult {
  remotePath: string;
  status: {
    code: number;
  };
}

/**
 * Parameters for removing a directory from NetStorage.
 *
 * @property remotePath - Remote directory path to remove.
 * @property dryRun - If true, simulates removal without executing.
 * @property onRemove - Callback invoked for each successfully removed path.
 * @property onSkip - Callback for each skipped path with reason and optional error.
 * @property shouldRemove - Optional predicate to filter which entries should be removed.
 */
export interface RemoveDirectoryParams {
  remotePath: string;
  dryRun?: boolean;
  onRemove?: (info: { remotePath: string }) => void;
  onSkip?: (info: {
    remotePath: string;
    reason: 'dryRun' | 'error' | 'filtered';
    error?: unknown;
  }) => void;
  shouldRemove?: (entry: RemoteWalkEntry) => boolean | Promise<boolean>;
}

/**
 * Recursively removes a directory and its contents from NetStorage.
 *
 * Walks all remote entries under the specified path and deletes them in reverse order.
 * Honors dryRun, filtering, and error handling via callbacks.
 *
 * @param config - NetStorage client config.
 * @param params - Configuration parameters for removal behavior.
 */
export async function removeDirectory(
  config: NetStorageClientConfig,
  {
    remotePath,
    dryRun = false,
    onRemove,
    onSkip,
    shouldRemove,
  }: RemoveDirectoryParams,
): Promise<RemoveResult[]> {
  const { logger } = config;

  logger.verbose(`Removing ${remotePath}`, { method: 'removeDirectory' });

  const entries: RemoteWalkEntry[] = [];
  for await (const entry of remoteWalk(config, {
    path: remotePath,
    addSyntheticRoot: true,
  })) {
    entries.push(entry);
  }

  const reversedEntries = [...entries].reverse();
  const results: RemoveResult[] = [];

  for (const entry of reversedEntries) {
    const { path, file } = entry;

    if (shouldRemove && !(await shouldRemove(entry))) {
      logger.debug(`Skipping via shouldRemove: ${path}`, {
        method: 'removeDirectory',
      });
      onSkip?.({ remotePath: path, reason: 'filtered' });
      continue;
    }

    if (dryRun) {
      logger.info(`[dryRun] Would remove ${path}`, {
        method: 'removeDirectory',
      });
      onSkip?.({ remotePath: path, reason: 'dryRun' });
      continue;
    }

    try {
      if (file.type === 'file' || file.type === 'symlink') {
        await rm(config, { path });
      } else if (file.type === 'dir') {
        if (file.implicit === 'true') continue;

        try {
          await rmdir(config, { path });
        } catch (error) {
          logger.debug(`Ignoring rmdir error for ${path}`, {
            method: 'removeDirectory',
            error,
          });
          continue;
        }
      } else {
        continue;
      }

      onRemove?.({ remotePath: path });
      results.push({ remotePath: path, status: { code: 200 } });
    } catch (error) {
      logger.error(`Failed to remove ${path}; error: ${error}`, {
        method: 'removeDirectory',
      });
      onSkip?.({ remotePath: path, reason: 'error', error });
    }
  }
  return results;
}
