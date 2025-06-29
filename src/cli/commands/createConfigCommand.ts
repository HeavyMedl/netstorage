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
    .usage('[command] [options]')
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ npx netstorage config set --host example.akamai.net --key abc123 --key-name xyz --cp-code 123456',
        '  $ npx netstorage config show',
        '  $ npx netstorage config clear',
        '  $ npx netstorage config path',
      ].join('\n'),
    )
    .addCommand(
      new Command('set')
        .description('Set a config value')
        .option('--host <host>', 'Akamai host')
        .option('--key <key>', 'Akamai key')
        .option('--key-name <keyName>', 'Akamai key name')
        .option('--cp-code <cpCode>', 'Optional Akamai CP code')
        .option('--log-level <level>', 'Log level (e.g., info, debug)')
        .option(
          '--timeout <ms>',
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
