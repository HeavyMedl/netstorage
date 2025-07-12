import { Command } from 'commander';
import { createLogger, mtime } from '@/index';
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

export function createMtimeCommand(
  logger: ReturnType<typeof createLogger>,
): Command {
  return new Command('mtime')
    .description(
      'Set the modification time for a file or directory in NetStorage',
    )
    .argument('<remotePath>', 'The remote file or directory to update')
    .argument('<date>', 'The modification date in ISO format')
    .option(
      '-c, --cancel-after <ms>',
      'Automatically abort the request after a given time',
      validateCancelAfter,
    )
    .option(
      '-d, --dry-run',
      'Print the planned mtime operation without executing',
    )
    .option('-l, --log-level <level>', 'Override the log level')
    .option('-p, --pretty', 'Pretty-print the JSON output')
    .option('-q, --quiet', 'Suppress standard output')
    .option(
      '-t, --timeout <ms>',
      'Set request timeout in milliseconds',
      validateTimeout,
    )
    .option('-v, --verbose', 'Enable verbose logging')
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ nst mtime remote/file.txt 2024-01-01T12:00:00Z',
        '  $ nst mtime -p remote/file.txt 2024-01-01T12:00:00Z',
      ].join('\n'),
    )
    .action(
      async (
        remotePath: string,
        date: string,
        { timeout, cancelAfter, pretty, dryRun, logLevel, verbose, quiet },
      ) => {
        try {
          const config = await loadClientConfig(
            getLogLevelOverride(logLevel, verbose),
          );
          const dateObj = new Date(date);
          if (isNaN(dateObj.getTime())) {
            throw new TypeError(
              'The provided date is not a valid ISO date string.',
            );
          }
          if (dryRun) {
            config.logger.info(
              `[Dry Run] would update mtime of ${config.uri(remotePath)} to ${dateObj.toISOString()}`,
            );
            return;
          }
          const result = await mtime(config, {
            path: remotePath,
            date: dateObj,
            options: {
              timeout,
              signal: resolveAbortSignalCLI(cancelAfter),
            },
          });
          if (!quiet) printJson(result, pretty);
          setLastCommandResult(result);
        } catch (err) {
          handleCliError(err, logger);
        }
      },
    );
}
