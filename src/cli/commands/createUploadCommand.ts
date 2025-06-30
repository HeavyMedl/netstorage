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
  printJson,
  resolveAbortSignal,
  validateCancelAfter,
  validateTimeout,
} from '../utils';
import { loadClientConfig } from '../utils/loadConfig';

export function createUploadCommand(
  logger: ReturnType<typeof createLogger>,
): Command {
  return new Command('upload')
    .description('Upload a local file or directory to NetStorage')
    .argument('<fromLocal>', 'Path to the local file or directory to upload')
    .argument(
      '[toRemote]',
      'Target NetStorage path (defaults to the basename of the local path)',
    )
    .usage('<fromLocal> [toRemote] [options]')
    .option(
      '--timeout <ms>',
      'Set request timeout in milliseconds',
      validateTimeout,
    )
    .option(
      '--cancel-after <ms>',
      'Automatically abort the request after a given time',
      validateCancelAfter,
    )
    .option('--log-level <level>', 'Override the log level')
    .option('-v, --verbose', 'Enable verbose logging')
    .option('--dry-run', 'Print the planned upload without executing')
    .option('--pretty', 'Pretty-print the JSON output')
    .option(
      '--no-overwrite',
      'Do not overwrite remote files if they already exist (default: overwrite)',
    )
    .option(
      '--follow-symlinks',
      'Follow symlinks when walking the local directory (default: false)',
    )
    .option(
      '--ignore <patterns...>',
      'Glob patterns to exclude from upload (e.g., "**/*.log" "node_modules")',
    )
    .option(
      '--max-concurrency <number>',
      'Maximum number of concurrent uploads (default: 5)',
      parseInt,
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ npx netstorage upload ./file.txt /123456/file.txt \\',
        '      --timeout 5000 --cancel-after 3000 --verbose --dry-run --pretty',
        '',
        '  $ npx netstorage upload ./local-dir /123456/remote-dir \\',
        '      --ignore "**/*.tmp" "node_modules" --max-concurrency 10 \\',
        '      --no-overwrite --follow-symlinks',
        '',
        'Options:',
        '  --timeout <ms>             Set request timeout in milliseconds',
        '  --cancel-after <ms>        Automatically abort the request after a given time',
        '  --log-level <level>        Override the log level',
        '  -v, --verbose              Enable verbose logging',
        '  --dry-run                  Print the planned upload without executing',
        '  --pretty                   Pretty-print the JSON output',
        '  --no-overwrite             Do not overwrite remote files if they already exist',
        '  --follow-symlinks          Follow symlinks when walking the local directory',
        '  --ignore <patterns...>     Glob patterns to exclude from upload (e.g., "**/*.log" "node_modules")',
        '  --max-concurrency <number> Maximum number of concurrent uploads (default: 5)',
      ].join('\n'),
    )
    .action(
      async (fromLocal: string, toRemote: string | undefined, options) => {
        const { timeout, cancelAfter, pretty, dryRun, logLevel, verbose } =
          options;

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
              shouldUpload: dryRun ? async () => false : undefined,
              overwrite: options.overwrite,
              followSymlinks: options.followSymlinks,
              ignore: options.ignore,
              maxConcurrency: options.maxConcurrency,
            });
          } else {
            result = await upload(config, {
              fromLocal,
              toRemote: inferredToRemote,
              options: {
                timeout,
                signal: resolveAbortSignal(cancelAfter),
              },
              shouldUpload: dryRun ? async () => false : undefined,
            });
          }

          if (!dryRun) {
            printJson(result, pretty);
          }

          if (dryRun) {
            const type = isDirectory ? 'directory' : 'file';
            config.logger.info(
              `[Dry Run] would upload ${type} ${fromLocal} to ${config.uri(inferredToRemote)}`,
            );
          }
        } catch (err) {
          handleCliError(err, logger);
        }
      },
    );
}
