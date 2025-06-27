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

  const results: SyncResultAccumulator = {
    transferred: [],
    skipped: [],
    deleted: [],
  };

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
