import path from 'node:path';
import { stat, mkdir } from 'node:fs/promises';
import pLimit from 'p-limit';

import {
  download,
  remoteWalk,
  type NetStorageClientConfig,
  type RemoteWalkEntry,
} from '@/index';

/**
 * Options for downloading a remote directory to the local filesystem.
 *
 * @property remotePath Absolute path to the remote directory.
 * @property localPath Local destination path.
 * @property overwrite Whether to overwrite existing local files. Default is false.
 * @property dryRun If true, simulates the operation without downloading.
 * @property maxConcurrency Maximum number of concurrent downloads.
 * @property onDownload Callback for each successfully downloaded file.
 * @property onSkip Callback for each skipped file with reason.
 * @property shouldDownload Optional filter function to determine whether to download a file.
 */
export interface DownloadDirectoryParams {
  remotePath: string;
  localPath: string;
  overwrite?: boolean;
  dryRun?: boolean;
  maxConcurrency?: number;
  onDownload?: (info: { remotePath: string; localPath: string }) => void;
  onSkip?: (info: {
    remotePath: string;
    localPath: string;
    reason: 'exists' | 'dryRun' | 'overwriteFalse' | 'error' | 'filtered';
    error?: unknown;
  }) => void;
  shouldDownload?: (entry: RemoteWalkEntry) => boolean | Promise<boolean>;
}

/**
 * Checks if a local file exists and is a file (not directory).
 *
 * @param path Local file path.
 * @returns True if the file exists and is a regular file.
 */
async function fileExistsLocal(path: string): Promise<boolean> {
  try {
    const stats = await stat(path);
    return stats.isFile();
  } catch {
    return false;
  }
}

/**
 * Downloads all files from a remote directory to a local path, respecting filters and concurrency.
 *
 * @param config NetStorage client config.
 * @param params Download options.
 */
export async function downloadDirectory(
  config: NetStorageClientConfig,
  params: DownloadDirectoryParams,
): Promise<void> {
  const {
    remotePath,
    localPath,
    overwrite = false,
    dryRun = false,
    maxConcurrency = 5,
    onDownload,
    onSkip,
    shouldDownload,
  } = params;

  config.logger.info(`Downloading ${remotePath} → ${path.resolve(localPath)}`, {
    method: 'downloadDirectory',
  });

  const limit = pLimit(maxConcurrency);

  const tasks: Array<Promise<void>> = [];

  for await (const entry of remoteWalk(config, { path: remotePath })) {
    const dest = path.join(localPath, entry.relativePath);

    if (entry.file.type === 'dir') {
      continue;
    }

    const task = limit(async () => {
      if (shouldDownload && !(await shouldDownload(entry))) {
        config.logger.debug(`Skipping via shouldDownload: ${entry.path}`, {
          method: 'downloadDirectory',
        });
        onSkip?.({
          remotePath: entry.path,
          localPath: dest,
          reason: 'filtered',
        });
        return;
      }

      if (!overwrite && (await fileExistsLocal(dest))) {
        config.logger.debug(`Skipping existing file: ${dest}`, {
          method: 'downloadDirectory',
        });
        onSkip?.({ remotePath: entry.path, localPath: dest, reason: 'exists' });
        return;
      }

      if (dryRun) {
        config.logger.info(`[dryRun] Would download ${entry.path} → ${dest}`, {
          method: 'downloadDirectory',
        });
        onSkip?.({ remotePath: entry.path, localPath: dest, reason: 'dryRun' });
        return;
      }

      try {
        config.logger.verbose(`Downloading ${entry.path} → ${dest}`, {
          method: 'downloadDirectory',
        });
        await mkdir(path.dirname(dest), { recursive: true });
        await download(config, { fromRemote: entry.path, toLocal: dest });
        onDownload?.({ remotePath: entry.path, localPath: dest });
      } catch (error) {
        config.logger.error(
          `Failed to download ${entry.path} → ${dest}; error: ${error}`,
          {
            method: 'downloadDirectory',
          },
        );
        onSkip?.({
          remotePath: entry.path,
          localPath: dest,
          reason: 'error',
          error,
        });
      }
    });

    tasks.push(task);
  }

  await Promise.all(tasks);
}
