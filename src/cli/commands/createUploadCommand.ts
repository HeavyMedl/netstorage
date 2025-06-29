import { Command } from 'commander';
import { basename } from 'node:path';
import { createLogger, upload } from '@/index';
import {
  getLogLevelOverride,
  handleCliError,
  resolveAbortSignal,
  validateCancelAfter,
  validateTimeout,
} from '../utils';
import { loadClientConfig } from '../utils/loadConfig';

export function createUploadCommand(
  logger: ReturnType<typeof createLogger>,
): Command {
  return new Command('upload')
    .description('Upload a local file to NetStorage')
    .argument('<fromLocal>', 'Path to the local file to upload')
    .argument(
      '[toRemote]',
      'Target NetStorage path for the uploaded file (inferred if omitted)',
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
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ npx netstorage upload ./file.txt /123456/file.txt --timeout 5000 --cancel-after 3000 --verbose --dry-run --pretty',
        '',
        'Options:',
        '  --timeout <ms>        Set request timeout in milliseconds',
        '  --cancel-after <ms>   Automatically abort the request after a given time',
        '  --log-level <level>   Override the log level',
        '  -v, --verbose         Enable verbose logging',
        '  --dry-run             Print the planned upload without executing',
        '  --pretty              Pretty-print the JSON output',
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

          const result = await upload(config, {
            fromLocal,
            toRemote: inferredToRemote,
            options: {
              timeout,
              signal: resolveAbortSignal(cancelAfter),
            },
            shouldUpload: dryRun ? async () => false : undefined,
          });
          if (dryRun) {
            config.logger.info(
              `[Dry Run] would upload ${fromLocal} to ${config.uri(inferredToRemote)}`,
            );
            return;
          }

          process.stdout.write(
            pretty ? JSON.stringify(result, null, 2) : JSON.stringify(result),
          );
        } catch (err) {
          handleCliError(err, logger);
        }
      },
    );
}
