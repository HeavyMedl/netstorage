import { Command } from 'commander';
import { basename } from 'node:path';
import { stat } from 'node:fs/promises';
import {
  createLogger,
  upload,
  uploadDirectory,
  type NetStorageUpload,
  type UploadResult,
} from '@/index';
import {
  getLogLevelOverride,
  handleCliError,
  loadClientConfig,
  printJson,
  resolveAbortSignalCLI,
  setLastCommandResult,
  validateCancelAfter,
  validateTimeout,
} from '../utils';

export function createUploadCommand(
  logger: ReturnType<typeof createLogger>,
): Command {
  return new Command('upload')
    .alias('up')
    .alias('put')
    .description('Upload a local file or directory to NetStorage')
    .argument('<fromLocal>', 'Path to the local file or directory to upload')
    .argument(
      '[toRemote]',
      'Target NetStorage path (defaults to the basename of the local path)',
    )
    .option(
      '-c, --cancel-after <ms>',
      'Automatically abort the request after a given time',
      validateCancelAfter,
    )
    .option('-d, --dry-run', 'Print the planned upload without executing')
    .option(
      '-f, --follow-symlinks',
      'Follow symlinks when walking the local directory (default: false)',
    )
    .option(
      '-i, --ignore <patterns...>',
      'Glob patterns to exclude from upload (e.g., "**/*.log" "node_modules")',
    )
    .option('--log-level <level>', 'Override the log level')
    .option(
      '-m, --max-concurrency <number>',
      'Maximum number of concurrent uploads (default: 5)',
      parseInt,
    )
    .option(
      '-n, --no-overwrite',
      'Do not overwrite remote files if they already exist (default: overwrite)',
    )
    .option('-p, --pretty', 'Pretty-print the JSON output')
    .option(
      '-t, --timeout <ms>',
      'Set request timeout in milliseconds',
      validateTimeout,
    )
    .option('-v, --verbose', 'Enable verbose logging')
    .option('-q, --quiet', 'Suppress standard output')
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ npx nst upload -v ./file.txt file.txt',
        '  $ npx nst upload ./local-dir remote-dir',
      ].join('\n'),
    )
    .action(
      async (
        fromLocal: string,
        toRemote: string | undefined,
        {
          timeout,
          cancelAfter,
          followSymlinks,
          ignore,
          maxConcurrency,
          overwrite,
          pretty,
          dryRun,
          logLevel,
          verbose,
          quiet,
        },
      ) => {
        try {
          const config = await loadClientConfig(
            getLogLevelOverride(logLevel, verbose),
          );

          const inferredToRemote = toRemote ?? basename(fromLocal);
          const stats = await stat(fromLocal);
          const isDirectory = stats.isDirectory();

          let result: NetStorageUpload | UploadResult[];
          if (isDirectory) {
            result = await uploadDirectory(config, {
              localPath: fromLocal,
              remotePath: inferredToRemote,
              dryRun,
              overwrite: overwrite,
              followSymlinks: followSymlinks,
              ignore,
              maxConcurrency: maxConcurrency,
              shouldUpload: dryRun ? async () => false : undefined,
            });
          } else {
            result = await upload(config, {
              fromLocal,
              toRemote: inferredToRemote,
              options: {
                timeout,
                signal: resolveAbortSignalCLI(cancelAfter),
              },
              shouldUpload: dryRun ? async () => false : undefined,
            });
          }
          if (!quiet && !dryRun) {
            printJson(result, pretty);
          }
          if (dryRun) {
            const type = isDirectory ? 'directory' : 'file';
            config.logger.info(
              `[Dry Run] would upload ${type} ${fromLocal} to ${config.uri(inferredToRemote)}`,
            );
          }
          setLastCommandResult(result);
        } catch (err) {
          handleCliError(err, logger);
        }
      },
    );
}
