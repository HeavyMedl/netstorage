import { Command } from 'commander';
import {
  loadPersistentConfig,
  savePersistentconfig,
  clearPersistentConfig,
  getPersistentConfigPath,
} from '../utils/configStore';
import { validateTimeout } from '../utils';

export function createConfigCommand(
  logger: ReturnType<typeof import('@/index').createLogger>,
): Command {
  return new Command('config')
    .alias('cfg')
    .description('Manage NetStorage CLI configuration')
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ nst config set --host example.akamai.net --key abc123 --key-name xyz --cp-code 123456',
        '  $ nst config show',
        '  $ nst config clear',
        '  $ nst config path',
      ].join('\n'),
    )
    .addCommand(
      new Command('set')
        .description('Set a config value')
        .option('-c, --cp-code <cpCode>', 'Optional Akamai CP code')
        .option('-h, --host <host>', 'Akamai host')
        .option('-k, --key <key>', 'Akamai key')
        .option('-n, --key-name <keyName>', 'Akamai key name')
        .option('-l, --log-level <level>', 'Log level (e.g., info, debug)')
        .option(
          '-t, --timeout <ms>',
          'Request timeout in milliseconds',
          validateTimeout,
        )
        .action((options) => {
          savePersistentconfig(options);
          logger.info('config saved', { method: 'set' });
        }),
    )
    .addCommand(
      new Command('show').description('Show current config').action(() => {
        const config = loadPersistentConfig();
        logger.info(`${JSON.stringify(config, null, 2)}`, { method: 'show' });
      }),
    )
    .addCommand(
      new Command('clear').description('Clear all saved config').action(() => {
        clearPersistentConfig();
        logger.info('cleared', { method: 'clear' });
      }),
    )
    .addCommand(
      new Command('path')
        .description('Show location of saved config file')
        .action(() => {
          logger.info(getPersistentConfigPath(), {
            method: 'path',
          });
        }),
    );
}
