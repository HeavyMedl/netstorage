import path from 'node:path';
import { Command } from 'commander';
import { basename } from 'node:path';
import { createLogger, rename } from '@/index';
import {
  getLogLevelOverride,
  getSpinner,
  handleCliError,
  loadClientConfig,
  printJson,
  resolveAbortSignal,
  validateCancelAfter,
  validateTimeout,
} from '../utils';

export function createRenameCommand(
  logger: ReturnType<typeof createLogger>,
): Command {
  return new Command('rename')
    .alias('mv')
    .description('Rename a file or directory in NetStorage')
    .argument('<from>', 'Current path of the file or directory')
    .argument(
      '[to]',
      'New path for the file or directory (inferred from source if omitted)',
    )
    .option(
      '-c, --cancel-after <ms>',
      'Automatically abort the request after a given time',
      validateCancelAfter,
    )
    .option(
      '-d, --dry-run',
      'Print the planned rename operation without executing',
    )
    .option('-l, --log-level <level>', 'Override the log level')
    .option('-p, --pretty', 'Pretty-print the JSON output')
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
        '  $ npx nst rename old.txt new.txt',
        '  $ npx nst rename -d -p old.txt new.txt',
      ].join('\n'),
    )
    .action(async (from: string, to: string | undefined, options) => {
      let spinner;
      try {
        const { timeout, cancelAfter, pretty, dryRun, logLevel, verbose } =
          options;
        const config = await loadClientConfig(
          getLogLevelOverride(logLevel, verbose),
        );
        const inferredTo = to ?? basename(from);
        let resolvedTo = inferredTo;

        if (config.cpCode) {
          resolvedTo = path.posix.join(
            `/${config.cpCode}`,
            inferredTo.replace(/^\/+/, ''),
          );
        } else {
          config.logger.verbose(
            'Warning: `cpCode` is not configured. Ensure `pathTo` is a fully qualified path.',
          );
        }

        if (dryRun) {
          config.logger.info(
            `[Dry Run] would rename ${config.uri(from)} -> ${config.uri(resolvedTo)}`,
          );
          return;
        }
        spinner = getSpinner(config)?.start();
        const result = await rename(config, {
          pathFrom: from,
          pathTo: resolvedTo,
          options: {
            timeout,
            signal: resolveAbortSignal(cancelAfter),
          },
        });
        spinner?.stop();
        printJson(result, pretty);
      } catch (err) {
        spinner?.stop();
        handleCliError(err, logger);
      }
    });
}
