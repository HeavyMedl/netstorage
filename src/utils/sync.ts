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
 * Determines if a transfer is allowed based on the provided strategy, direction, action, and resolution.
 * @param input - Transfer permission configuration
 * @returns Whether the file transfer should proceed
 */
export function isTransferAllowed({
  compareStrategy,
  direction,
  action,
  conflictResolution,
}: TransferPermissionInput): boolean {
  return (
    compareStrategy === 'exists' ||
    action === direction ||
    (!action &&
      ((direction === 'upload' && conflictResolution === 'preferLocal') ||
        (direction === 'download' && conflictResolution === 'preferRemote')))
  );
}

/**
 * Wraps a NetStorageFile in a NetStorageStat structure.
 * @param file - The remote file metadata
 * @returns A NetStorageStat object
 */
export function toNetStorageStat(file?: NetStorageFile): NetStorageStat {
  return { stat: { file } };
}

/**
 * Determines whether a file should be transferred based on the compare strategy and direction.
 * @param input - Parameters including paths, direction, and compare strategy
 * @returns True if transfer should occur, false otherwise
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
      return direction === 'upload'
        ? remoteFile === undefined
        : !(await fs
            .stat(localAbsPath)
            .then(() => true)
            .catch(() => false));
    default:
      return false;
  }
}

/**
 * Resolves the transfer action (upload, download, or skip) based on conflict resolution rules.
 * @param input - Relative path and conflict rules mapping
 * @returns The resolved transfer action or 'skip'
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
 * Formats a sync operation into a directional log message.
 * @param input - Sync direction and file paths
 * @returns A formatted string describing the sync operation
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
 * Performs a one-to-one sync operation for a single file, supporting dry-run and transfer logging.
 * @param params - Configuration for syncing a single entry
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
    if (direction === 'upload') {
      await upload(config, { fromLocal: localPath, toRemote: remotePath });
    } else {
      await fs.mkdir(path.dirname(localPath), { recursive: true });
      await download(config, { fromRemote: remotePath, toLocal: localPath });
    }
  }

  onTransfer?.({ direction, localPath, remotePath });
}

/**
 * Deletes files that exist in one location (local or remote) but not in the other.
 * @param params - Configuration for comparing and optionally deleting extraneous files
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
}: DeleteExtraneousFilesParams) {
  const localEntries = singleFile
    ? new Map([[path.basename(localPath), true]])
    : (localFiles ?? new Map());
  const remoteEntries = singleFile
    ? new Map([[path.basename(localPath), true]])
    : (remoteFiles ?? new Map());

  if (deleteExtraneous === 'remote' || deleteExtraneous === 'both') {
    config.logger.verbose('Checking for extraneous remote files to delete', {
      method: 'deleteExtraneous',
    });

    for (const [relPath] of remoteEntries) {
      if (!localEntries.has(relPath)) {
        const absPath = path.posix.join(remotePath, relPath);
        if (dryRun) {
          config.logger.info(`[dryRun] Would delete remote file at ${absPath}`);
        } else {
          await rm(config, { path: absPath });
          onDelete?.(absPath);
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
          onDelete?.(absPath);
        }
      }
    }
  }
}
