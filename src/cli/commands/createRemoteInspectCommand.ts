import { Command } from 'commander';
import { stat, dir, createLogger, du } from '@/index';
import { loadClientConfig } from '../utils/loadConfig';
import { handleCliError, resolveAbortSignal } from '../utils';

const operations = { stat, dir, du };

type InspectCommandName = keyof typeof operations;

export function createRemoteInspectCommand({
  name,
  description,
  examplePath,
  logger,
}: {
  name: InspectCommandName;
  description: string;
  examplePath: string;
  logger: ReturnType<typeof createLogger>;
}): Command {
  return new Command(name)
    .description(description)
    .usage('[command] [options]')
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        `  $ npx netstorage ${name} ${examplePath}`,
        `  $ npx netstorage ${name} --timeout 5000`,
        `  $ npx netstorage ${name} --cancel-after 3000`,
        `  $ npx netstorage ${name} --pretty`,
        '',
        'Options:',
        '  --timeout <ms>        Set request timeout in milliseconds',
        '  --cancel-after <ms>   Automatically abort the request after a given time',
        '  --pretty              Pretty-print the JSON output',
        '  --log-level <level>   Override the log level',
      ].join('\n'),
    )
    .argument('[remotePath]', 'Remote path to inspect')
    .option('--timeout <ms>', 'Request timeout in milliseconds')
    .option('--cancel-after <ms>', 'Abort the request after duration')
    .option('--pretty', 'Pretty-print the JSON output')
    .option('--log-level <level>', 'Override the log level')
    .action(async function (this: Command, remotePath?: string) {
      try {
        const { timeout, cancelAfter, pretty, logLevel } = this.opts();
        const config = await loadClientConfig({ logLevel });
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
