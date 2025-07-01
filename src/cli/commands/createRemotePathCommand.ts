import { Command } from 'commander';
import { stat, dir, createLogger, du, rmdir, mkdir, rm } from '@/index';
import { loadClientConfig } from '../utils/loadConfig';
import {
  getLogLevelOverride,
  handleCliError,
  printJson,
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
    .argument(
      remotePathArg.required ? '<remotePath>' : '[remotePath]',
      remotePathArg.description ?? 'Remote path to inspect',
    )
    .option(
      '-c, --cancel-after <ms>',
      'Abort the request after duration',
      validateCancelAfter,
    )
    .option('-d, --dry-run', 'Print the planned operation without executing')
    .option('-l, --log-level <level>', 'Override the log level')
    .option('-p, --pretty', 'Pretty-print the JSON output')
    .option(
      '-t, --timeout <ms>',
      'Request timeout in milliseconds',
      validateTimeout,
    )
    .option('-v, --verbose', 'Enable verbose logging')
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        `  $ nst ${name} ${examplePath}`,
        `  $ nst ${name} -p ${examplePath}`,
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
        printJson(result, pretty);
      } catch (err) {
        handleCliError(err, logger);
      }
    });
}
