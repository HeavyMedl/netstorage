import { Command } from 'commander';
import { basename } from 'node:path';
import { createLogger, symlink } from '@/index';
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

export function createSymlinkCommand(
  logger: ReturnType<typeof createLogger>,
): Command {
  return new Command('symlink')
    .description('Interact with NetStorage symbolic links')
    .argument('<target>', 'The remote file the symlink will point to')
    .argument(
      '[symlinkPath]',
      'The remote path to create the symlink (inferred from target if omitted)',
    )
    .option(
      '-c, --cancel-after <ms>',
      'Automatically abort the request after a given time',
      validateCancelAfter,
    )
    .option(
      '-d, --dry-run',
      'Print the planned symlink operation without executing',
    )
    .option('-l, --log-level <level>', 'Override the log level')
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
        '  $ npx nst symlink remote/target.txt',
        '  $ npx nst symlink -d -p remote/target.txt remote/link.txt',
      ].join('\n'),
    )
    .action(
      async (
        target: string,
        symlinkPath: string | undefined,
        { timeout, cancelAfter, pretty, dryRun, logLevel, verbose, quiet },
      ) => {
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
