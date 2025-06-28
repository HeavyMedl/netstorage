import {
  remoteWalk,
  rm,
  rmdir,
  type RemoteWalkEntry,
  type NetStorageClientConfig,
} from '@/index';

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
): Promise<void> {
  const { logger } = config;

  logger.info(`Removing ${remotePath}`, { method: 'removeDirectory' });

  const entries: RemoteWalkEntry[] = [];
  for await (const entry of remoteWalk(config, { path: remotePath })) {
    entries.push(entry);
  }

  const reversedEntries = [...entries].reverse();
  const tasks = [];
  for (const entry of reversedEntries) {
    const task = (async () => {
      if (shouldRemove && !(await shouldRemove(entry))) {
        logger.debug(`Skipping via shouldRemove: ${entry.path}`, {
          method: 'removeDirectory',
        });
        onSkip?.({
          remotePath: entry.path,
          reason: 'filtered',
        });
        return;
      }

      if (dryRun) {
        logger.info(`[dryRun] Would remove ${entry.path}`, {
          method: 'removeDirectory',
        });
        onSkip?.({ remotePath: entry.path, reason: 'dryRun' });
        return;
      }

      try {
        if (entry.file.type === 'file' || entry.file.type === 'symlink') {
          await rm(config, { path: entry.path });
        } else if (
          entry.file.type === 'dir' &&
          entry.file.implicit !== 'true'
        ) {
          await rmdir(config, { path: entry.path }).catch(() => {});
        }
        onRemove?.({ remotePath: entry.path });
      } catch (error) {
        logger.error(`Failed to remove ${entry.path}; error: ${error}`, {
          method: 'removeDirectory',
        });
        onSkip?.({ remotePath: entry.path, reason: 'error', error });
      }
    })();
    tasks.push(task);
  }
  await Promise.all(tasks);
}
