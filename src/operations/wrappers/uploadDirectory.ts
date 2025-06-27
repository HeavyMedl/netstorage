import path from 'node:path';
import pLimit from 'p-limit';
import {
  fileExists,
  upload,
  walkLocalDir,
  type LocalWalkEntry,
  type NetStorageClientContext,
} from '@/index';

/**
 * Parameters for the `uploadDirectory` operation.
 *
 * Defines options for uploading a local directory to a NetStorage destination.
 *
 * @property localPath - Absolute or relative path to the local directory to upload.
 * @property remotePath - Destination path in NetStorage where files will be uploaded.
 * @property overwrite - Whether to overwrite existing remote files (default: true).
 * @property followSymlinks - Whether to follow symbolic links during traversal (default: false).
 * @property ignore - Optional glob-style patterns for excluding files (e.g., 'node_modules').
 * @property dryRun - If true, simulates the upload without making any changes.
 * @property maxConcurrency - Maximum number of concurrent uploads (default: 5).
 * @property onUpload - Callback triggered when a file is successfully uploaded.
 * @property onSkip - Callback triggered when a file is skipped, including the reason.
 * @property shouldUpload - Optional callback to determine whether a file should be uploaded.
 */
export interface UploadDirectoryParams {
  localPath: string;
  remotePath: string;
  overwrite?: boolean;
  followSymlinks?: boolean;
  ignore?: string[];
  dryRun?: boolean;
  maxConcurrency?: number;
  onUpload?: (info: { localPath: string; remotePath: string }) => void;
  onSkip?: (info: {
    localPath: string;
    remotePath: string;
    reason:
      | 'exists'
      | 'filtered'
      | 'symlink'
      | 'dryRun'
      | 'overwriteFalse'
      | 'error';
    error?: unknown;
  }) => void;
  shouldUpload?: (entry: LocalWalkEntry) => boolean | Promise<boolean>;
}

/**
 * Uploads a local directory to a destination path in NetStorage.
 *
 * Recursively traverses a local directory, uploading each file to a remote
 * destination path on NetStorage. Supports concurrency limits, dry-run mode,
 * and file skipping logic.
 *
 * @param ctx - NetStorage context
 * @param params - UploadDirectoryParams
 */
export async function uploadDirectory(
  ctx: NetStorageClientContext,
  {
    localPath,
    remotePath,
    overwrite = true,
    followSymlinks = false,
    ignore = [],
    dryRun = false,
    maxConcurrency = 5,
    onUpload,
    onSkip,
    shouldUpload,
  }: UploadDirectoryParams,
): Promise<void> {
  const { logger } = ctx;
  const limiter = pLimit(maxConcurrency);
  const tasks: Array<Promise<void>> = [];

  logger.info(`Uploading ${localPath} → ${remotePath}`, {
    method: 'uploadDirectory',
  });

  for await (const entry of walkLocalDir(localPath, {
    ignore,
    followSymlinks,
  })) {
    if (entry.isDirectory) continue;

    const destPath = path.posix.join(
      remotePath,
      entry.relativePath.split(path.sep).join('/'),
    );

    if (shouldUpload && !(await shouldUpload(entry))) {
      logger.debug(`Skipping via shouldUpload: ${entry.localPath}`, {
        method: 'uploadDirectory',
      });
      onSkip?.({
        localPath: entry.localPath,
        remotePath: destPath,
        reason: 'filtered',
      });
      continue;
    }

    const task = limiter(async () => {
      const skip = async (reason: 'dryRun' | 'overwriteFalse' | 'error') => {
        onSkip?.({ localPath: entry.localPath, remotePath: destPath, reason });
      };

      if (dryRun) {
        logger.info(`[dryRun] Would upload ${entry.localPath} → ${destPath}`, {
          method: 'uploadDirectory',
        });
        return skip('dryRun');
      }

      if (!overwrite && (await fileExists(ctx, destPath))) {
        logger.debug(`Skipping existing file: ${destPath}`, {
          method: 'uploadDirectory',
        });
        return skip('overwriteFalse');
      }

      try {
        await upload(ctx, { fromLocal: entry.localPath, toRemote: destPath });
        onUpload?.({ localPath: entry.localPath, remotePath: destPath });
      } catch (error) {
        logger.error(
          `Failed to upload ${entry.localPath} → ${destPath}; error: ${error}`,
          { method: 'uploadDirectory' },
        );
        await skip('error');
      }
    });

    tasks.push(task);
  }

  await Promise.all(tasks);
}
