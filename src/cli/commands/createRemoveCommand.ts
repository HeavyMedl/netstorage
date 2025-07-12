import { Command } from 'commander';
import { rm, createLogger, removeDirectory, isDirectory } from '@/index';
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

export function createRemoveCommand(
  logger: ReturnType<typeof createLogger>,
): Command {
  return new Command('rm')
    .description('Remove a file or directory from NetStorage')
    .argument(
      '<remotePath>',
      'Remote path of the file or directory to delete from NetStorage',
    )
    .option(
      '-c, --cancel-after <ms>',
      'Abort the request after a duration',
      validateCancelAfter,
    )
    .option(
      '-d, --dry-run',
      'Simulate the remove operation without actually deleting files',
    )
    .option('-l, --log-level <level>', 'Override the log level')
    .option('-p, --pretty', 'Pretty-print the JSON output')
    .option(
      '-r, --recursive',
      'Delete a directory and its contents recursively (required for directories)',
    )
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
        '  $ nst rm -p -d path/to/file.txt',
        '  $ nst rm -r path/to/dir',
      ].join('\n'),
    )
    .action(
      async (
        remotePath: string,
        {
          timeout,
          cancelAfter,
          pretty,
          logLevel,
          verbose,
          dryRun,
          recursive,
          quiet,
        },
      ) => {
        try {
          const config = await loadClientConfig(
            getLogLevelOverride(logLevel, verbose),
          );

          const isDir = await isDirectory(config, remotePath);

          if (dryRun) {
            config.logger.info(
              `[Dry Run] would remove ${isDir ? 'directory' : 'file'} ${config.uri(remotePath)}`,
            );
            return;
          }

          if (isDir && !recursive) {
            config.logger.warn(
              `'${config.uri(remotePath)}' is a directory. Use the --recursive flag to remove it.`,
            );
            return;
          }
          let result;
          if (isDir) {
            result = await removeDirectory(config, {
              remotePath,
            });
          } else {
            result = await rm(config, {
              path: remotePath,
              options: {
                timeout,
                signal: resolveAbortSignalCLI(cancelAfter),
              },
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
