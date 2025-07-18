import { downloadDirectory, isDirectory } from '@/index';
import path from 'node:path';
import { Command } from 'commander';
import { download, createLogger } from '@/index';
import {
  validateTimeout,
  validateCancelAfter,
  handleCliError,
  resolveAbortSignalCLI,
  getLogLevelOverride,
  printJson,
  loadClientConfig,
  setLastCommandResult,
} from '../utils';

export function createDownloadCommand(
  logger: ReturnType<typeof createLogger>,
): Command {
  return new Command('download')
    .alias('dl')
    .alias('get')
    .description('Download a file or directory from NetStorage to a local path')
    .argument('<remotePath>', 'Remote path to download from')
    .argument(
      '[localPath]',
      'Local file path to save content to (inferred if omitted)',
    )
    .option(
      '-c, --cancel-after <ms>',
      'Abort the request after duration',
      validateCancelAfter,
    )
    .option('-d, --dry-run', 'Perform a dry run without writing the file')
    .option('-l, --log-level <level>', 'Override the log level')
    .option(
      '-m, --max-concurrency <number>',
      'Maximum number of concurrent downloads',
      parseInt,
    )
    .option(
      '-o, --overwrite',
      'Overwrite existing local files (default: false)',
    )
    .option('-p, --pretty', 'Pretty-print the JSON output')
    .option(
      '-t, --timeout <ms>',
      'Request timeout in milliseconds',
      validateTimeout,
    )
    .option('-v, --verbose', 'Enable verbose logging')
    .option('-q, --quiet', 'Suppress standard output')
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ nst download remote/file.txt',
        '  $ nst download -o remote/directory',
      ].join('\n'),
    )
    .action(
      async (
        remotePath,
        localPathArg,
        {
          timeout,
          cancelAfter,
          logLevel,
          dryRun,
          pretty,
          verbose,
          overwrite,
          maxConcurrency,
          quiet,
        },
      ) => {
        try {
          const config = await loadClientConfig(
            getLogLevelOverride(logLevel, verbose),
          );
          const localPath =
            localPathArg ||
            path.resolve(process.cwd(), path.basename(remotePath));

          const isDir = await isDirectory(config, remotePath);

          if (dryRun) {
            const type = isDir ? 'directory' : 'file';
            logger.info(
              `[Dry Run] Skipped download of ${type}: ${config.uri(remotePath)} → ${localPath}`,
            );
            return;
          }
          let result;
          if (isDir) {
            result = await downloadDirectory(config, {
              remotePath,
              localPath,
              dryRun,
              overwrite,
              maxConcurrency,
              shouldDownload: dryRun ? async () => false : undefined,
            });
          } else {
            result = await download(config, {
              fromRemote: remotePath,
              toLocal: localPath,
              options: { timeout, signal: resolveAbortSignalCLI(cancelAfter) },
              shouldDownload: dryRun ? async () => false : undefined,
            });
          }
          if (!quiet) printJson(result, pretty);
          setLastCommandResult(result);
        } catch (err) {
          handleCliError(err, logger);
        }
      },
    );
}
