import path from 'node:path';
import pLimit from 'p-limit';
import {
  upload,
  walkLocalDir,
  type LocalWalkEntry,
  type NetStorageClientConfig,
  isFile,
} from '@/index';
import type { NetStorageUpload } from '@/operations/upload';

/**
 * Parameters for uploading a local directory to a NetStorage destination.
 *
 * @property localPath - Path to the local directory to upload.
 * @property remotePath - Remote NetStorage path to upload files to.
 * @property overwrite - If true, overwrites existing remote files (default: true).
 * @property followSymlinks - If true, follows symlinks when walking the local directory (default: false).
 * @property ignore - Glob patterns to exclude files/directories during traversal.
 * @property dryRun - If true, simulates the upload without performing file operations.
 * @property maxConcurrency - Max number of concurrent uploads (default: 5).
 * @property onUpload - Callback triggered on successful file upload.
 * @property onSkip - Callback triggered when a file is skipped.
 * @property shouldUpload - Optional predicate to determine if a file should be uploaded.
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
 * Represents the result of uploading a single file in a directory upload operation.
 *
 * @property localPath - Absolute or relative local path to the uploaded file.
 * @property remotePath - The corresponding NetStorage destination path.
 * @property status - Response status returned by the NetStorage API, including the HTTP-style status code.
 */
export interface UploadResult extends NetStorageUpload {
  localPath: string;
  remotePath: string;
}

/**
 * Uploads files from a local directory to NetStorage.
 *
 * Traverses the local directory and uploads files to the specified remote path.
 * Respects ignore patterns, symlink behavior, overwrite flag, and concurrency limits.
 *
 * @param config - The NetStorage client config.
 * @param params - Options controlling upload behavior.
 * @returns A promise that resolves when all eligible files are processed.
 */
export async function uploadDirectory(
  config: NetStorageClientConfig,
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
): Promise<UploadResult[]> {
  const { logger } = config;
  const limiter = pLimit(maxConcurrency);
  const tasks: Array<Promise<void>> = [];
  const results: UploadResult[] = [];

  logger.verbose(`Uploading ${localPath} → ${config.uri(remotePath)}`, {
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

      if (!overwrite && (await isFile(config, destPath))) {
        logger.debug(`Skipping existing file: ${destPath}`, {
          method: 'uploadDirectory',
        });
        return skip('overwriteFalse');
      }

      try {
        const uploadResult = await upload(config, {
          fromLocal: entry.localPath,
          toRemote: destPath,
        });
        onUpload?.({ localPath: entry.localPath, remotePath: destPath });
        results.push({
          localPath: entry.localPath,
          remotePath: destPath,
          status: uploadResult.status,
        });
      } catch (error) {
        logger.error(
          `Failed to upload ${entry.localPath} → ${config.uri(destPath)}; error: ${error}`,
          { method: 'uploadDirectory' },
        );
        await skip('error');
      }
    });

    tasks.push(task);
  }

  await Promise.all(tasks);
  return results;
}
