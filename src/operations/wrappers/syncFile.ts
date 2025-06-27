import {
  formatSyncDirectionLog,
  syncSingleEntry,
  deleteExtraneous,
  type NetStorageClientContext,
  type SyncFileParams,
  type SyncResult,
  type SyncResultAccumulator,
  type SyncResultHandlers,
} from '@/index';

/**
 * Synchronizes a single local file with a remote NetStorage path.
 *
 * @param ctx - The NetStorage client context.
 * @param params - Configuration options for the sync operation.
 * @returns A SyncResult summarizing transferred, skipped, and deleted files.
 */
export async function syncFile(
  ctx: NetStorageClientContext,
  {
    localPath,
    remotePath,
    dryRun = false,
    conflictRules,
    remoteFileMeta,
    compareStrategy = 'exists',
    syncDirection = 'upload',
    conflictResolution = 'preferLocal',
    deleteExtraneous: deleteExtraneousParam = 'none',
    onTransfer,
    onSkip,
    onDelete,
  }: SyncFileParams,
): Promise<SyncResult> {
  ctx.logger.info(
    formatSyncDirectionLog({ localPath, remotePath, syncDirection }),
    {
      method: 'syncFile',
    },
  );

  /**
   * Accumulates results during the sync process.
   * @property transferred - Files that were transferred.
   * @property skipped - Files that were skipped due to comparison or rules.
   * @property deleted - Files that were deleted as extraneous.
   */
  const results: SyncResultAccumulator = {
    transferred: [],
    skipped: [],
    deleted: [],
  };

  /**
   * Handlers for collecting sync results and triggering user-defined callbacks.
   * @property onTransfer - Callback for each transferred file.
   * @property onSkip - Callback for each skipped file.
   * @property onDelete - Callback for each deleted file.
   */
  const handlers: SyncResultHandlers = {
    onTransfer: (event) => {
      results.transferred.push(event);
      onTransfer?.(event);
    },
    onSkip: (event) => {
      results.skipped.push(event);
      onSkip?.(event);
    },
    onDelete: (absPath) => {
      results.deleted.push(absPath);
      onDelete?.(absPath);
    },
  };

  await syncSingleEntry({
    ctx,
    direction: syncDirection,
    localPath,
    remotePath,
    remoteFileMeta,
    dryRun,
    compareStrategy,
    conflictRules,
    conflictResolution,
    onTransfer: handlers.onTransfer,
    onSkip: handlers.onSkip,
  });

  await deleteExtraneous({
    ctx,
    deleteExtraneous: deleteExtraneousParam,
    dryRun,
    localPath,
    remotePath,
    singleFile: true,
    onDelete: handlers.onDelete,
  });

  return results;
}
