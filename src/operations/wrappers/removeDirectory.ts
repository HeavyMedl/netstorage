import {
  remoteWalk,
  rm,
  rmdir,
  type RemoteWalkEntry,
  type NetStorageClientContext,
} from '@/index';

export interface RemoveDirectoryParams {
  remotePath: string;
  dryRun?: boolean;
  // maxConcurrency?: number;
  onRemove?: (info: { remotePath: string }) => void;
  onSkip?: (info: {
    remotePath: string;
    reason: 'dryRun' | 'error' | 'filtered';
    error?: unknown;
  }) => void;
  /**
   * Optional predicate to determine whether a given entry should be removed.
   * Return true to include the entry for removal, false to skip it.
   */
  shouldRemove?: (entry: RemoteWalkEntry) => boolean | Promise<boolean>;
}

/**
 * Recursively removes a directory from NetStorage, including all nested files and directories.
 *
 * @param ctx - NetStorage context
 * @param params - RemoveDirectoryParams
 */
export async function removeDirectory(
  ctx: NetStorageClientContext,
  {
    remotePath,
    dryRun = false,
    // maxConcurrency = 5,
    onRemove,
    onSkip,
    shouldRemove,
  }: RemoveDirectoryParams,
): Promise<void> {
  const { logger } = ctx;

  logger.info(`Removing ${remotePath}`, { method: 'removeDirectory' });

  const entries: RemoteWalkEntry[] = [];
  for await (const entry of remoteWalk(ctx, { path: remotePath })) {
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
          await rm(ctx, { path: entry.path });
        } else if (
          entry.file.type === 'dir' &&
          entry.file.implicit !== 'true'
        ) {
          await rmdir(ctx, { path: entry.path }).catch(() => {});
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
