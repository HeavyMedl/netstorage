import { Command } from 'commander';
import {
  loadPersistentConfig,
  savePersistentConfig,
  clearPersistentConfig,
  getPersistentConfigPath,
  clearPersistentConfigKey,
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
        '  $ nst config set -h example.akamai.net -k abc123 -n xyz',
        '  $ nst config show',
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
          savePersistentConfig(options);
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
      new Command('clear')
        .description('Clear all or specific config key(s)')
        .argument('[key]', 'Key to clear (if specified)')
        .action((key) => {
          if (key) {
            clearPersistentConfigKey(key);
            logger.info(`cleared key: ${key}`, { method: 'clear' });
          } else {
            clearPersistentConfig();
            logger.info('cleared all config', { method: 'clear' });
          }
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
