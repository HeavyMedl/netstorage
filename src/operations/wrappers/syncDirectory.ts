import path from 'node:path';
import fs from 'node:fs';
import micromatch from 'micromatch';
import { download } from '@/operations/download';
import { stat as fsStat } from 'node:fs/promises';
import { walkLocalDir } from '@/utils/walkLocalDir';
import { remoteWalk } from '@/operations/wrappers/remoteWalk';
import { upload } from '@/operations/upload';
import { rm } from '@/operations/rm';

import {
  isSizeMismatch,
  isMtimeNewer,
  isChecksumMismatch,
} from '@/utils/transferPredicates';
import type { NetStorageClientContext } from '@/config/createClientContext';
import type { NetStorageFile } from '@/types';
import type { NetStorageStat } from '../stat';

export interface SyncDirectoryParams {
  localPath: string;
  remotePath: string;
  dryRun?: boolean;
  deleteExtraneous?: 'remote' | 'local' | 'both' | 'none';
  compareStrategy?: 'size' | 'mtime' | 'checksum' | 'exists';
  syncDirection?: 'upload' | 'download' | 'both';
  conflictResolution?: 'preferLocal' | 'preferRemote' | 'manual';
  conflictRules?: Record<string, 'upload' | 'download' | 'skip'>;
  onTransfer?: (params: {
    direction: 'upload' | 'download';
    localPath: string;
    remotePath: string;
  }) => void;
  onDelete?: (remotePath: string) => void;
  onSkip?: (params: {
    direction: 'upload' | 'download';
    localPath: string;
    remotePath: string;
    reason: string;
  }) => void;
}

function toNetStorageStat(file?: NetStorageFile): NetStorageStat {
  return { stat: { file } };
}

async function shouldUploadFile(
  ctx: NetStorageClientContext,
  compareStrategy: 'size' | 'mtime' | 'checksum' | 'exists',
  localAbsPath: string,
  remoteFile?: NetStorageFile,
): Promise<boolean> {
  const stat = toNetStorageStat(remoteFile);
  switch (compareStrategy) {
    case 'size':
      return await isSizeMismatch(ctx, localAbsPath, stat);
    case 'mtime':
      return await isMtimeNewer(ctx, localAbsPath, stat);
    case 'checksum':
      return await isChecksumMismatch(ctx, localAbsPath, stat);
    case 'exists':
      try {
        await fsStat(localAbsPath);
        return remoteFile === undefined;
      } catch {
        return true;
      }
    default:
      return true;
  }
}

async function shouldDownloadFile(
  ctx: NetStorageClientContext,
  compareStrategy: 'size' | 'mtime' | 'checksum' | 'exists',
  localAbsPath: string,
  remoteFile?: NetStorageFile,
): Promise<boolean> {
  if (compareStrategy === 'exists') {
    try {
      await fsStat(localAbsPath);
      return false; // file already exists locally
    } catch {
      return true; // file does not exist locally, should download
    }
  }
  const stat = toNetStorageStat(remoteFile);
  switch (compareStrategy) {
    case 'size':
      return await isSizeMismatch(ctx, localAbsPath, stat);
    case 'mtime':
      return await isMtimeNewer(ctx, localAbsPath, stat);
    case 'checksum':
      return await isChecksumMismatch(ctx, localAbsPath, stat);
    default:
      return true;
  }
}

function resolveConflictAction(
  relPath: string,
  conflictRules?: Record<string, 'upload' | 'download' | 'skip'>,
): 'upload' | 'download' | 'skip' | undefined {
  if (!conflictRules) return undefined;
  for (const pattern in conflictRules) {
    if (micromatch.isMatch(relPath, pattern)) {
      return conflictRules[pattern];
    }
  }
  return undefined;
}

export async function syncDirectory(
  ctx: NetStorageClientContext,
  {
    localPath,
    remotePath,
    deleteExtraneous = 'none',
    dryRun = false,
    onTransfer,
    onDelete,
    onSkip,
    compareStrategy = 'exists',
    syncDirection = 'upload',
    conflictResolution = 'preferLocal',
    conflictRules,
  }: SyncDirectoryParams,
): Promise<void> {
  const directionMap = {
    upload: '→',
    download: '←',
    both: '↔',
  } as const;
  const arrow = directionMap[syncDirection] ?? '?';
  ctx.logger.info(
    `Syncing ${localPath} ${arrow} ${remotePath} [${syncDirection}]`,
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

  // Sync files based on direction
  if (syncDirection === 'upload' || syncDirection === 'both') {
    ctx.logger.verbose('Beginning upload phase', { method: 'syncDirectory' });
    for (const [relPath, localAbsPath] of localFiles) {
      const remoteAbsPath = path.posix.join(remotePath, relPath);
      const remoteFile = remoteFiles.get(relPath);

      const shouldUpload = await shouldUploadFile(
        ctx,
        compareStrategy,
        localAbsPath,
        remoteFile,
      );

      const action = resolveConflictAction(relPath, conflictRules);
      if (action === 'skip') {
        onSkip?.({
          direction: 'upload',
          localPath: localAbsPath,
          remotePath: remoteAbsPath,
          reason: 'conflictRules skip',
        });
        continue;
      }

      const uploadAllowed =
        compareStrategy === 'exists' ||
        action === 'upload' ||
        (conflictResolution === 'preferLocal' && action !== 'download');

      if (!shouldUpload || !uploadAllowed) {
        onSkip?.({
          direction: 'upload',
          localPath: localAbsPath,
          remotePath: remoteAbsPath,
          reason: compareStrategy,
        });
        continue;
      }

      if (dryRun) {
        ctx.logger.info(
          `[dryRun] Would upload ${localAbsPath} → ${remoteAbsPath}`,
        );
      } else {
        await upload(ctx, {
          fromLocal: localAbsPath,
          toRemote: remoteAbsPath,
        });
      }
      onTransfer?.({
        direction: 'upload',
        localPath: localAbsPath,
        remotePath: remoteAbsPath,
      });
    }
  }

  if (syncDirection === 'download' || syncDirection === 'both') {
    ctx.logger.verbose('Beginning download phase', { method: 'syncDirectory' });
    for (const [relPath, remoteFile] of remoteFiles) {
      const localAbsPath = path.join(localPath, relPath);
      const remoteAbsPath = path.posix.join(remotePath, relPath);

      const shouldDownload = await shouldDownloadFile(
        ctx,
        compareStrategy,
        localAbsPath,
        remoteFile,
      );

      const action = resolveConflictAction(relPath, conflictRules);
      if (action === 'skip') {
        onSkip?.({
          direction: 'download',
          localPath: localAbsPath,
          remotePath: remoteAbsPath,
          reason: 'conflictRules skip',
        });
        continue;
      }

      const downloadAllowed =
        compareStrategy === 'exists' ||
        action === 'download' ||
        (conflictResolution === 'preferRemote' && action !== 'upload');

      if (!shouldDownload || !downloadAllowed) {
        onSkip?.({
          direction: 'download',
          localPath: localAbsPath,
          remotePath: remoteAbsPath,
          reason: compareStrategy,
        });
        continue;
      }

      if (dryRun) {
        ctx.logger.info(
          `[dryRun] Would download ${remoteAbsPath} → ${localAbsPath}`,
        );
      } else {
        await fs.promises.mkdir(path.dirname(localAbsPath), {
          recursive: true,
        });
        await download(ctx, {
          fromRemote: remoteAbsPath,
          toLocal: localAbsPath,
        });
      }
      onTransfer?.({
        direction: 'download',
        localPath: localAbsPath,
        remotePath: remoteAbsPath,
      });
    }
  }

  if (deleteExtraneous === 'remote' || deleteExtraneous === 'both') {
    ctx.logger.verbose('Checking for extraneous remote files to delete', {
      method: 'syncDirectory',
    });
    for (const [relPath] of remoteFiles) {
      if (!localFiles.has(relPath)) {
        const absPath = path.posix.join(remotePath, relPath);
        if (dryRun) {
          ctx.logger.info(`[dryRun] Would delete remote file at ${absPath}`);
        } else {
          await rm(ctx, { path: absPath });
          onDelete?.(absPath);
        }
      }
    }
  }

  if (deleteExtraneous === 'local' || deleteExtraneous === 'both') {
    ctx.logger.verbose('Checking for extraneous local files to delete', {
      method: 'syncDirectory',
    });
    for (const [relPath] of localFiles) {
      if (!remoteFiles.has(relPath)) {
        const absPath = path.join(localPath, relPath);
        if (dryRun) {
          ctx.logger.info(`[dryRun] Would delete local file at ${absPath}`);
        } else {
          await fs.promises.rm(absPath);
          onDelete?.(absPath);
        }
      }
    }
  }
}
