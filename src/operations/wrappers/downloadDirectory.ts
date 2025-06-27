import path from 'node:path';
import { stat, mkdir } from 'node:fs/promises';
import pLimit from 'p-limit';

import {
  download,
  remoteWalk,
  type NetStorageClientContext,
  type RemoteWalkEntry,
} from '@/index';

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

async function fileExistsLocal(path: string): Promise<boolean> {
  try {
    const stats = await stat(path);
    return stats.isFile();
  } catch {
    return false;
  }
}

export async function downloadDirectory(
  ctx: NetStorageClientContext,
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

  ctx.logger.info(`Downloading ${remotePath} → ${path.resolve(localPath)}`, {
    method: 'downloadDirectory',
  });

  const limit = pLimit(maxConcurrency);

  const tasks: Array<Promise<void>> = [];

  for await (const entry of remoteWalk(ctx, { path: remotePath })) {
    const dest = path.join(localPath, entry.relativePath);

    if (entry.file.type === 'dir') {
      continue;
    }

    const task = limit(async () => {
      if (shouldDownload && !(await shouldDownload(entry))) {
        ctx.logger.debug(`Skipping via shouldDownload: ${entry.path}`, {
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
        ctx.logger.debug(`Skipping existing file: ${dest}`, {
          method: 'downloadDirectory',
        });
        onSkip?.({ remotePath: entry.path, localPath: dest, reason: 'exists' });
        return;
      }

      if (dryRun) {
        ctx.logger.info(`[dryRun] Would download ${entry.path} → ${dest}`, {
          method: 'downloadDirectory',
        });
        onSkip?.({ remotePath: entry.path, localPath: dest, reason: 'dryRun' });
        return;
      }

      try {
        ctx.logger.verbose(`Downloading ${entry.path} → ${dest}`, {
          method: 'downloadDirectory',
        });
        await mkdir(path.dirname(dest), { recursive: true });
        await download(ctx, { fromRemote: entry.path, toLocal: dest });
        onDownload?.({ remotePath: entry.path, localPath: dest });
      } catch (error) {
        ctx.logger.error(
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
