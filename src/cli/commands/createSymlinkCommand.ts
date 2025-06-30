import { Command } from 'commander';
import { basename } from 'node:path';
import { createLogger, symlink } from '@/index';
import {
  getLogLevelOverride,
  handleCliError,
  printJson,
  resolveAbortSignal,
  validateCancelAfter,
  validateTimeout,
} from '../utils';
import { loadClientConfig } from '../utils/loadConfig';

export function createSymlinkCommand(
  logger: ReturnType<typeof createLogger>,
): Command {
  return new Command('symlink')
    .description('Create a symbolic link in NetStorage')
    .argument('<target>', 'The remote file the symlink will point to')
    .argument(
      '[symlinkPath]',
      'The remote path to create the symlink (inferred from target if omitted)',
    )
    .usage('<target> [symlinkPath] [options]')
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
    .option(
      '--dry-run',
      'Print the planned symlink operation without executing',
    )
    .option('--pretty', 'Pretty-print the JSON output')
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ npx netstorage symlink /remote/target.txt /remote/link.txt --timeout 5000 --cancel-after 3000 --verbose --dry-run --pretty',
        '',
        'Options:',
        '  --timeout <ms>        Set request timeout in milliseconds',
        '  --cancel-after <ms>   Automatically abort the request after a given time',
        '  --log-level <level>   Override the log level',
        '  -v, --verbose         Enable verbose logging',
        '  --dry-run             Print the planned symlink without executing',
        '  --pretty              Pretty-print the JSON output',
      ].join('\n'),
    )
    .action(
      async (target: string, symlinkPath: string | undefined, options) => {
        const { timeout, cancelAfter, pretty, dryRun, logLevel, verbose } =
          options;
        try {
          const config = await loadClientConfig(
            getLogLevelOverride(logLevel, verbose),
          );
          const inferredPath = symlinkPath ?? basename(target);
          if (dryRun) {
            config.logger.info(
              `[Dry Run] would symlink ${inferredPath} -> ${target}`,
            );
            return;
          }
          const result = await symlink(config, {
            pathFileTo: target,
            pathSymlink: inferredPath,
            options: {
              timeout,
              signal: resolveAbortSignal(cancelAfter),
            },
          });
          printJson(result, pretty);
        } catch (err) {
          handleCliError(err, logger);
        }
      },
    );
}
