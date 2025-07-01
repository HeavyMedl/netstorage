import { Command } from 'commander';
import { basename } from 'node:path';
import { createLogger, rename } from '@/index';
import {
  getLogLevelOverride,
  handleCliError,
  printJson,
  resolveAbortSignal,
  validateCancelAfter,
  validateTimeout,
} from '../utils';
import { loadClientConfig } from '../utils/loadConfig';

export function createRenameCommand(
  logger: ReturnType<typeof createLogger>,
): Command {
  return new Command('rename')
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
        '  $ npx nst rename /old/path.txt /new/path.txt --timeout 5000 --cancel-after 3000 --verbose --dry-run --pretty',
      ].join('\n'),
    )
    .action(async (from: string, to: string | undefined, options) => {
      const { timeout, cancelAfter, pretty, dryRun, logLevel, verbose } =
        options;
      try {
        const config = await loadClientConfig(
          getLogLevelOverride(logLevel, verbose),
        );
        const inferredTo = to ?? basename(from);
        if (dryRun) {
          config.logger.info(
            `[Dry Run] would rename ${config.uri(from)} -> ${config.uri(inferredTo)}`,
          );
          return;
        }
        const result = await rename(config, {
          pathFrom: from,
          pathTo: inferredTo,
          options: {
            timeout,
            signal: resolveAbortSignal(cancelAfter),
          },
        });
        printJson(result, pretty);
      } catch (err) {
        handleCliError(err, logger);
      }
    });
}
