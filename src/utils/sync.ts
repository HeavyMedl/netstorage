import path from 'node:path';
import fs from 'node:fs/promises';
import micromatch from 'micromatch';

import {
  isSizeMismatch,
  isMtimeNewer,
  isChecksumMismatch,
  upload,
  download,
  rm,
  inspectRemotePath,
  rmdir,
  type NetStorageStat,
  type NetStorageFile,
  type TransferPermissionInput,
  type ShouldTransferFileInput,
  type DeleteExtraneousFilesParams,
  type FormatSyncDirectionLogInput,
  type ResolveConflictActionInput,
  type SyncSingleEntryParams,
} from '@/index';

/**
 * Determines whether a file transfer is permitted based on strategy and conflict settings.
 * @param input - Transfer permission parameters including strategy, direction, action, and conflict resolution
 * @returns True if the transfer is permitted, false otherwise
 */
export function isTransferAllowed({
  compareStrategy,
  direction,
  action,
  conflictResolution,
}: TransferPermissionInput): boolean {
  if (compareStrategy === 'exists') return true;
  if (action === direction) return true;
  if (!action) {
    const prefersLocal =
      conflictResolution === 'preferLocal' &&
      ['upload', 'both'].includes(direction);
    const prefersRemote =
      conflictResolution === 'preferRemote' &&
      ['download', 'both'].includes(direction);
    return prefersLocal || prefersRemote;
  }
  return false;
}

/**
 * Wraps a NetStorageFile object into a NetStorageStat structure for compatibility.
 * @param file - Remote file metadata from NetStorage
 * @returns A NetStorageStat-compliant object
 */
export function toNetStorageStat(file?: NetStorageFile): NetStorageStat {
  return { stat: { file } };
}

/**
 * Evaluates whether a file should be transferred based on the configured comparison strategy.
 * @param input - Object containing paths, strategy, direction, and remote metadata
 * @returns Promise resolving to true if transfer is needed, false otherwise
 */
export async function shouldTransferFile({
  config,
  direction,
  localAbsPath,
  remoteFile,
  compareStrategy = 'exists',
}: ShouldTransferFileInput): Promise<boolean> {
  const stat = toNetStorageStat(remoteFile);
  switch (compareStrategy) {
    case 'size':
      return await isSizeMismatch(config, localAbsPath, stat);
    case 'mtime':
      return await isMtimeNewer(config, localAbsPath, stat);
    case 'checksum':
      return await isChecksumMismatch(config, localAbsPath, stat);
    case 'exists':
      if (direction === 'upload' || direction === 'both') {
        if (remoteFile === undefined) return true;
      }
      if (direction === 'download' || direction === 'both') {
        const localExists = await fs
          .stat(localAbsPath)
          .then(() => true)
          .catch(() => false);
        if (!localExists) return true;
      }
      return false;
    default:
      return false;
  }
}

/**
 * Resolves how to handle file conflicts using the specified conflict rules.
 * @param input - Relative path and optional conflict rules mapping
 * @returns The resolved action ('upload', 'download', 'skip') or undefined
 */
export function resolveConflictAction({
  relativePath,
  conflictRules,
}: ResolveConflictActionInput): 'upload' | 'download' | 'skip' | undefined {
  if (!conflictRules) return undefined;
  for (const pattern in conflictRules) {
    if (micromatch.isMatch(relativePath, pattern)) {
      return conflictRules[pattern];
    }
  }
  return 'skip';
}

/**
 * Generates a human-readable string describing a file sync direction.
 * @param input - Object containing local/remote paths and sync direction
 * @returns A formatted log string representing the sync operation
 */
export function formatSyncDirectionLog({
  localPath,
  remotePath,
  syncDirection,
}: FormatSyncDirectionLogInput): string {
  const directionMap = {
    upload: '→',
    download: '←',
    both: '↔',
  } as const;
  const arrow = directionMap[syncDirection] ?? '?';
  return `Syncing ${localPath} ${arrow} ${remotePath} [${syncDirection}]`;
}

/**
 * Synchronizes a single file entry based on direction, comparison strategy, and conflict rules.
 * Handles dry-run mode and emits transfer/skip events as appropriate.
 * @param params - Sync configuration and callbacks for a single file
 */
export async function syncSingleEntry({
  config,
  direction,
  localPath,
  remotePath,
  remoteFileMeta,
  dryRun,
  compareStrategy,
  conflictRules,
  conflictResolution,
  onTransfer,
  onSkip,
}: SyncSingleEntryParams): Promise<void> {
  const relPath = path.basename(localPath);
  const action = resolveConflictAction({
    relativePath: relPath,
    conflictRules,
  });
  if (action === 'skip') {
    onSkip?.({
      direction,
      localPath,
      remotePath,
      reason: 'conflictRules skip',
    });
    return;
  }

  const shouldTransfer = await shouldTransferFile({
    config,
    direction,
    localAbsPath: localPath,
    remoteFile: remoteFileMeta,
    compareStrategy,
  });

  const allowed = isTransferAllowed({
    compareStrategy,
    direction,
    action,
    conflictResolution,
  });

  if (!shouldTransfer || !allowed) {
    onSkip?.({ direction, localPath, remotePath, reason: compareStrategy });
    return;
  }

  if (dryRun) {
    config.logger.info(
      `[dryRun] Would ${direction} ${localPath} ${direction === 'upload' ? '→' : '←'} ${remotePath}`,
    );
  } else {
    if (
      direction === 'upload' ||
      (direction === 'both' && remoteFileMeta === undefined)
    ) {
      await upload(config, { fromLocal: localPath, toRemote: remotePath });
    } else if (
      direction === 'download' ||
      (direction === 'both' && remoteFileMeta !== undefined)
    ) {
      await fs.mkdir(path.dirname(localPath), { recursive: true });
      await download(config, { fromRemote: remotePath, toLocal: localPath });
    }
  }

  onTransfer?.({ direction, localPath, remotePath });
}

/**
 * Removes files and directories that are no longer present on the opposite side of sync.
 * Can optionally perform dry-run and emit deletion events. Handles both local and remote clean-up.
 * @param params - Configuration including paths, maps of files and directories, and control flags
 */
export async function deleteExtraneous({
  config,
  deleteExtraneous,
  dryRun,
  localPath,
  remotePath,
  localFiles,
  remoteFiles,
  onDelete,
  singleFile = false,
  localDirs,
  remoteDirs,
}: DeleteExtraneousFilesParams) {
  const localEntries = singleFile
    ? new Map([[path.basename(localPath), true]])
    : (localFiles ?? new Map());
  const remoteEntries = singleFile
    ? new Map([[path.basename(localPath), true]])
    : (remoteFiles ?? new Map());

  if (!localEntries.size && !remoteEntries.size) return;

  if (deleteExtraneous === 'remote' || deleteExtraneous === 'both') {
    config.logger.verbose('Checking for extraneous remote files to delete', {
      method: 'deleteExtraneous',
    });

    // Aggregate cleanup candidates: parent dirs of deleted files and empty remote dirs
    const cleanupCandidates = new Set<string>(
      [...(remoteDirs?.entries() ?? [])]
        .filter(
          ([, file]) =>
            file.type === 'dir' &&
            (file.implicit === undefined || file.implicit === 'false') &&
            file.bytes === '0',
        )
        .map(([relPath]) => relPath),
    );

    for (const [relPath] of remoteEntries) {
      if (!localEntries.has(relPath)) {
        const absPath = path.posix.join(remotePath, relPath);
        if (dryRun) {
          config.logger.info(`[dryRun] Would delete remote file at ${absPath}`);
        } else {
          await rm(config, { path: absPath });
          if (!singleFile) remoteFiles?.delete(relPath);
          onDelete?.(absPath);
        }
        cleanupCandidates.add(path.posix.dirname(relPath));
      }
    }

    const sortedDirs = [...cleanupCandidates].sort(
      (a, b) => b.split('/').length - a.split('/').length,
    );

    for (const relPath of sortedDirs) {
      const absPath = path.posix.join(remotePath, relPath);

      const dirMeta = remoteDirs?.get(relPath);
      if (dirMeta?.implicit === 'true') continue;

      let isEmpty = dirMeta?.bytes === '0';

      if (!isEmpty) {
        try {
          const { du } = await inspectRemotePath(config, {
            path: absPath,
            kind: 'directory',
          });
          isEmpty = du?.du?.['du-info']?.bytes === '0';
        } catch {
          continue;
        }
      }

      if (isEmpty) {
        if (dryRun) {
          config.logger.info(
            `[dryRun] Would remove empty remote directory ${absPath}`,
          );
        } else {
          try {
            await rmdir(config, { path: absPath });
            onDelete?.(absPath);
          } catch {
            config.logger.verbose(
              `Failed to remove empty remote directory ${absPath}`,
            );
          }
        }
      }
    }
  }

  if (deleteExtraneous === 'local' || deleteExtraneous === 'both') {
    config.logger.verbose('Checking for extraneous local files to delete', {
      method: 'deleteExtraneous',
    });

    for (const [relPath] of localEntries) {
      if (!remoteEntries.has(relPath)) {
        const absPath = path.join(localPath, relPath);
        if (dryRun) {
          config.logger.info(`[dryRun] Would delete local file at ${absPath}`);
        } else {
          await fs.rm(absPath);
          if (!singleFile) localFiles?.delete(relPath);
          onDelete?.(absPath);
        }
      }
    }

    // Remove empty local directories
    if (localDirs?.size) {
      // Sort deepest directories first by directory depth (platform-agnostic)
      const dirs = [...localDirs.keys()].sort(
        (a, b) => b.split('/').length - a.split('/').length,
      );

      for (const relPath of dirs) {
        const absPath = localDirs.get(relPath);
        if (!absPath) continue;
        try {
          const contents = await fs.readdir(absPath);
          if (contents.length === 0) {
            if (dryRun) {
              config.logger.info(
                `[dryRun] Would remove empty local directory ${absPath}`,
              );
            } else {
              await fs.rmdir(absPath);
              onDelete?.(absPath);
            }
          }
        } catch {
          // ignore errors like ENOENT or ENOTDIR
        }
      }
    }
  }
}
