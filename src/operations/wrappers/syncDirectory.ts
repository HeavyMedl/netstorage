import path from 'node:path';
import fs from 'node:fs';
import pLimit from 'p-limit';

import {
  deleteExtraneous,
  formatSyncDirectionLog,
  remoteWalk,
  syncSingleEntry,
  walkLocalDir,
  type NetStorageClientConfig,
  type NetStorageFile,
  type SyncDirectoryParams,
  type SyncResult,
  type SyncResultAccumulator,
  type SyncResultHandlers,
} from '@/index';

/**
 * Synchronizes files between a local directory and a NetStorage remote directory.
 *
 * @param config - Authenticated NetStorage client config
 * @param localPath - Absolute or relative path to the local directory
 * @param remotePath - Remote NetStorage directory path
 * @param dryRun - If true, simulates operations without making changes
 * @param conflictRules - Optional map to resolve specific file conflicts
 * @param compareStrategy - File comparison strategy to decide transfer necessity
 * @param syncDirection - Direction of sync: upload, download, or both
 * @param conflictResolution - Default conflict resolution strategy
 * @param deleteExtraneous - Whether to remove files not present on the opposite side
 * @param onTransfer - Callback invoked after a file transfer
 * @param onDelete - Callback invoked after a file deletion
 * @param onSkip - Callback invoked when a file is skipped
 * @param maxConcurrency - Maximum number of concurrent sync operations
 * @returns Summary result of transferred, skipped, and deleted entries
 */
export async function syncDirectory(
  config: NetStorageClientConfig,
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

  config.logger.verbose(
    formatSyncDirectionLog({ localPath, remotePath, syncDirection }),
    { method: 'syncDirectory' },
  );

  if (syncDirection === 'download' || syncDirection === 'both') {
    await fs.promises.mkdir(localPath, { recursive: true });
  }

  const localFiles = new Map<string, string>();
  const remoteFiles = new Map<string, NetStorageFile>();
  const remoteDirs = new Map<string, NetStorageFile>();
  const localDirs = new Map<string, string>();

  for await (const entry of walkLocalDir(localPath, { includeDirs: true })) {
    const rel = entry.relativePath.split(path.sep).join('/');
    if (entry.isDirectory) {
      localDirs.set(rel, entry.localPath);
    } else {
      localFiles.set(rel, entry.localPath);
    }
  }

  for await (const entry of remoteWalk(config, { path: remotePath })) {
    if (entry.file.type === 'dir') {
      remoteDirs.set(entry.relativePath, entry.file);
    } else {
      remoteFiles.set(entry.relativePath, entry.file);
    }
  }

  await deleteExtraneous({
    config,
    deleteExtraneous: deleteExtraneousParam,
    dryRun,
    localPath,
    remotePath,
    localFiles,
    remoteFiles,
    localDirs,
    remoteDirs,
    onDelete: handlers.onDelete,
  });

  const limiter = pLimit(maxConcurrency);

  if (syncDirection === 'upload' || syncDirection === 'both') {
    config.logger.verbose('Beginning upload phase', {
      method: 'syncDirectory',
    });
    const uploadTasks: Array<Promise<void>> = [];

    for (const [relPath, localAbsPath] of localFiles) {
      const remoteAbsPath = path.posix.join(remotePath, relPath);
      const remoteFile = remoteFiles.get(relPath);

      uploadTasks.push(
        limiter(() =>
          syncSingleEntry({
            config,
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
    config.logger.verbose('Beginning download phase', {
      method: 'syncDirectory',
    });
    const downloadTasks: Array<Promise<void>> = [];

    for (const [relPath, remoteFile] of remoteFiles) {
      const localAbsPath = path.join(localPath, relPath);
      const remoteAbsPath = path.posix.join(remotePath, relPath);

      downloadTasks.push(
        limiter(() =>
          syncSingleEntry({
            config,
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
  // Note: localFiles and remoteFiles now reflect post-sync state.
  return results;
}
