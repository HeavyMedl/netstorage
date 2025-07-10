import { Command } from 'commander';
import { stat } from 'node:fs/promises';
import { basename } from 'node:path';
import {
  createLogger,
  syncDirectory,
  syncFile,
  inspectRemotePath,
  type SyncResult,
  type NetStorageDu,
  type NetStorageFile,
} from '@/index';
import {
  getLogLevelOverride,
  handleCliError,
  loadClientConfig,
  printJson,
} from '../utils';

class SyncPathInferenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SyncPathInferenceError';
  }
}

/**
 * Infers the kind of sync operation (file or directory) based on local file system stats
 * and remote NetStorage metadata.
 *
 * Logic:
 * - If neither local nor remote (file or directory) path exists, throws an error.
 * - If direction is "upload":
 *    - Local path must exist.
 *    - Returns 'directory' or 'file' based on local stats.
 * - If direction is "download":
 *    - Returns 'directory' if local is a directory or remote is a directory.
 *    - Returns 'file' if local exists and is not a directory.
 * - If direction is "both":
 *    - Returns 'directory' if local is a directory or remote is a directory.
 *    - Returns 'file' if local exists and is not a directory.
 *    - Otherwise returns 'unknown'.
 *
 * @param localPath - Path to the local file or directory
 * @param direction - Sync direction: "upload", "download", or "both"
 * @param remoteInfo - Remote inspection result, containing optional file or directory metadata
 * @returns The inferred path kind: 'directory', 'file', or 'unknown'
 * @throws If neither path exists
 */
async function getSyncPathKind(
  localPath: string,
  direction: string,
  remoteInfo: { file?: NetStorageFile; du?: NetStorageDu },
): Promise<'file' | 'directory' | 'unknown'> {
  const localStats = await stat(localPath).catch(() => null);
  const isRemoteFile = remoteInfo?.file?.type === 'file';
  const isRemoteDir = remoteInfo?.du?.du?.directory;
  if (localStats?.isFile() && isRemoteDir) {
    throw new SyncPathInferenceError(
      [
        `Cannot sync a local file (${localPath}) to a remote directory.`,
        `Sync direction "${direction}" creates ambiguity.`,
      ].join(' '),
    );
  }
  if (localStats?.isDirectory() && isRemoteFile) {
    throw new SyncPathInferenceError(
      [
        `Cannot sync a local directory (${localPath}) to a remote file.`,
        `Sync direction "${direction}" creates ambiguity.`,
      ].join(' '),
    );
  }
  if (!localStats && !isRemoteDir && !isRemoteFile) {
    throw new SyncPathInferenceError(
      `Neither local nor remote path exists. Cannot sync.`,
    );
  }
  if (direction === 'upload') {
    if (!localStats) {
      throw new SyncPathInferenceError(
        `Local path does not exist. Cannot sync in upload mode.`,
      );
    }
    return localStats.isDirectory() ? 'directory' : 'file';
  }
  if (localStats?.isDirectory()) return 'directory';
  if (isRemoteDir) return 'directory';
  if (localStats) return 'file';
  return 'unknown';
}

export function createSyncCommand(
  logger: ReturnType<typeof createLogger>,
): Command {
  return new Command('sync')
    .description('Synchronize a local file or directory with NetStorage')
    .argument('<localPath>', 'Path to the local file or directory')
    .argument(
      '[remotePath]',
      'Remote NetStorage path (defaults to the basename of the local path)',
    )
    .option(
      '-c, --conflict-resolution <mode>',
      'Conflict resolution strategy: "preferLocal", "preferRemote", or "manual"',
    )
    .option(
      '-C, --max-concurrency <number>',
      'Maximum number of concurrent operations (default: 5)',
      parseInt,
    )
    .option('-d, --dry-run', 'Print the planned sync without executing')
    .option('-l, --log-level <level>', 'Override log level')
    .option(
      '-m, --mode <upload|download|both>',
      'Set sync mode directionality (default: "both")',
    )
    .option(
      '-p, --prune <scope>',
      'Prune extraneous files: "remote", "local", "both", or "none"',
    )
    .option('--pretty', 'Pretty-print JSON output')
    .option(
      '-s, --strategy <mode>',
      'Comparison strategy: "size", "mtime", "checksum", or "exists"',
    )
    .option('-v, --verbose', 'Enable verbose logging')
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ nst sync folder/',
        '  $ nst sync -m download -P local ./downloads/ photos/',
      ].join('\n'),
    )
    .action(
      async (localPath: string, remotePath: string | undefined, options) => {
        const {
          dryRun,
          strategy,
          mode = 'both',
          prune: deleteMode,
          conflictResolution,
          maxConcurrency,
          logLevel,
          verbose,
          pretty,
        } = options;

        try {
          const config = await loadClientConfig(
            getLogLevelOverride(logLevel, verbose),
          );
          const inferredRemote = remotePath ?? basename(localPath);
          const remoteInfo = await inspectRemotePath(config, {
            path: inferredRemote,
          });
          const syncKind = await getSyncPathKind(localPath, mode, remoteInfo);
          const isDir = syncKind === 'directory';

          let result: SyncResult;

          if (dryRun) {
            config.logger.info(
              `[Dry Run] would sync ${isDir ? 'directory' : 'file'} ${localPath} ↔ ${inferredRemote}`,
            );
            return;
          }

          if (isDir) {
            result = await syncDirectory(config, {
              localPath,
              remotePath: inferredRemote,
              dryRun,
              compareStrategy: strategy,
              syncDirection: mode,
              deleteExtraneous: deleteMode,
              conflictResolution,
              maxConcurrency,
            });
          } else {
            result = await syncFile(config, {
              localPath,
              remotePath: inferredRemote,
              dryRun,
              compareStrategy: strategy,
              syncDirection: mode,
              deleteExtraneous: deleteMode,
              conflictResolution,
              remoteFileMeta: remoteInfo.file,
            });
          }

          printJson(result, pretty);
        } catch (err) {
          handleCliError(err, logger);
        }
      },
    );
}
