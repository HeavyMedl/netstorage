import path from 'node:path';
import fs from 'node:fs';
import pLimit from 'p-limit';

import {
  deleteExtraneous,
  formatSyncDirectionLog,
  remoteWalk,
  syncSingleEntry,
  walkLocalDir,
  type NetStorageClientContext,
  type NetStorageFile,
  type SyncDirectoryParams,
  type SyncResult,
  type SyncResultAccumulator,
  type SyncResultHandlers,
} from '@/index';

export async function syncDirectory(
  ctx: NetStorageClientContext,
  {
    localPath,
    remotePath,
    dryRun = false,
    conflictRules,
    compareStrategy = 'exists',
    syncDirection = 'upload',
    conflictResolution = 'preferLocal',
    deleteExtraneous: deleteExtraneousParam = 'none',
    onTransfer,
    onDelete,
    onSkip,
    maxConcurrency = 5,
  }: SyncDirectoryParams,
): Promise<SyncResult> {
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

  ctx.logger.info(
    formatSyncDirectionLog({ localPath, remotePath, syncDirection }),
    { method: 'syncDirectory' },
  );

  if (syncDirection === 'download' || syncDirection === 'both') {
    await fs.promises.mkdir(localPath, { recursive: true });
  }

  const localFiles = new Map<string, string>();
  const remoteFiles = new Map<string, NetStorageFile>();

  for await (const entry of walkLocalDir(localPath)) {
    if (!entry.isDirectory) {
      const rel = entry.relativePath.split(path.sep).join('/');
      localFiles.set(rel, entry.localPath);
    }
  }

  for await (const entry of remoteWalk(ctx, { path: remotePath })) {
    if (entry.file.type !== 'dir') {
      remoteFiles.set(entry.relativePath, entry.file);
    }
  }

  const limiter = pLimit(maxConcurrency);

  if (syncDirection === 'upload' || syncDirection === 'both') {
    ctx.logger.verbose('Beginning upload phase', { method: 'syncDirectory' });
    const uploadTasks: Array<Promise<void>> = [];

    for (const [relPath, localAbsPath] of localFiles) {
      const remoteAbsPath = path.posix.join(remotePath, relPath);
      const remoteFile = remoteFiles.get(relPath);

      uploadTasks.push(
        limiter(() =>
          syncSingleEntry({
            ctx,
            direction: 'upload',
            localPath: localAbsPath,
            remotePath: remoteAbsPath,
            remoteFileMeta: remoteFile,
            dryRun,
            compareStrategy,
            conflictRules,
            conflictResolution,
            onTransfer: handlers.onTransfer,
            onSkip: handlers.onSkip,
          }),
        ),
      );
    }

    await Promise.all(uploadTasks);
  }

  if (syncDirection === 'download' || syncDirection === 'both') {
    ctx.logger.verbose('Beginning download phase', { method: 'syncDirectory' });
    const downloadTasks: Array<Promise<void>> = [];

    for (const [relPath, remoteFile] of remoteFiles) {
      const localAbsPath = path.join(localPath, relPath);
      const remoteAbsPath = path.posix.join(remotePath, relPath);

      downloadTasks.push(
        limiter(() =>
          syncSingleEntry({
            ctx,
            direction: 'download',
            localPath: localAbsPath,
            remotePath: remoteAbsPath,
            remoteFileMeta: remoteFile,
            dryRun,
            compareStrategy,
            conflictRules,
            conflictResolution,
            onTransfer: handlers.onTransfer,
            onSkip: handlers.onSkip,
          }),
        ),
      );
    }

    await Promise.all(downloadTasks);
  }

  await deleteExtraneous({
    ctx,
    deleteExtraneous: deleteExtraneousParam,
    dryRun,
    localPath,
    remotePath,
    localFiles,
    remoteFiles,
    onDelete: handlers.onDelete,
  });

  return results;
}
