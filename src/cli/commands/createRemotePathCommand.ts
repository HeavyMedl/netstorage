import { Command } from 'commander';
import { stat, dir, createLogger, du, rmdir, mkdir, rm } from '@/index';
import { loadClientConfig } from '../utils/loadConfig';
import {
  getLogLevelOverride,
  handleCliError,
  resolveAbortSignal,
  validateCancelAfter,
  validateTimeout,
} from '../utils';

const operations = { stat, dir, du, rm, rmdir, mkdir };

type InspectCommandName = keyof typeof operations;

interface RemotePathCommandOptions {
  name: InspectCommandName;
  description: string;
  examplePath: string;
  logger: ReturnType<typeof createLogger>;
  remotePathArg?: {
    required?: boolean;
    description?: string;
  };
}

export function createRemotePathCommand(
  opts: RemotePathCommandOptions,
): Command {
  const {
    name,
    description,
    examplePath,
    logger,
    remotePathArg = {
      required: false,
      description: 'Remote path to inspect',
    },
  } = opts;

  return new Command(name)
    .description(description)
    .usage('[command] [options]')
    .argument(
      remotePathArg.required ? '<remotePath>' : '[remotePath]',
      remotePathArg.description ?? 'Remote path to inspect',
    )
    .option(
      '--timeout <ms>',
      'Request timeout in milliseconds',
      validateTimeout,
    )
    .option(
      '--cancel-after <ms>',
      'Abort the request after duration',
      validateCancelAfter,
    )
    .option('--pretty', 'Pretty-print the JSON output')
    .option('--log-level <level>', 'Override the log level')
    .option('-v, --verbose', 'Enable verbose logging')
    .option('--dry-run', 'Print the planned operation without executing')
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        `  $ npx netstorage ${name} ${examplePath} --timeout 5000 --cancel-after 3000 --pretty --verbose --dry-run`,
        '',
        'Options:',
        '  --timeout <ms>        Set request timeout in milliseconds',
        '  --cancel-after <ms>   Automatically abort the request after a given time',
        '  --pretty              Pretty-print the JSON output',
        '  --log-level <level>   Override the log level',
        '  -v, --verbose         Enable verbose logging',
        '  --dry-run             Print the planned operation without executing',
        '',
      ].join('\n'),
    )
    .action(async function (this: Command, remotePath?: string) {
      try {
        const { timeout, cancelAfter, pretty, logLevel, verbose, dryRun } =
          this.opts();

        const config = await loadClientConfig(
          getLogLevelOverride(logLevel, verbose),
        );

        if (dryRun) {
          config.logger.info(
            `[Dry Run] would execute '${name}' on ${config.uri(remotePath || '/')}`,
          );
          return;
        }

        const result = await operations[name](config, {
          path: remotePath || '/',
          options: {
            timeout,
            signal: resolveAbortSignal(cancelAfter),
          },
        });
        process.stdout.write(
          pretty ? JSON.stringify(result, null, 2) : JSON.stringify(result),
        );
      } catch (err) {
        handleCliError(err, logger);
      }
    });
}
