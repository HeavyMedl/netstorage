import { Command } from 'commander';
import { name as packageName } from '../../../package.json';
import {
  loadPersistentConfig,
  savePersistentconfig,
  clearPersistentConfig,
  getPersistentConfigPath,
} from '../utils/configStore';

import { createLogger } from '@/index';

const logger = createLogger('info', `${packageName}/cli/config`);

/**
 * Creates the `config` command for the NetStorage CLI.
 *
 * Provides subcommands to manage persistent configuration values used by the CLI.
 *
 * Subcommands:
 * - `set`: Save config values (host, key, key name, CP code, log level, timeout).
 * - `show`: Print the current persisted config as formatted JSON.
 * - `clear`: Remove all saved configuration values.
 * - `path`: Show the location of the persisted config file.
 *
 * @returns {Command} Configured Commander command instance.
 */
export default function configCommand(): Command {
  const command = new Command('config')
    .alias('cfg')
    .description('Manage NetStorage CLI configuration');

  command
    .command('set')
    .description('Set a config value')
    .option('--host <host>', 'Akamai host')
    .option('--key <key>', 'Akamai key')
    .option('--key-name <keyName>', 'Akamai key name')
    .option('--cp-code <cpCode>', 'Optional Akamai CP code')
    .option('--log-level <level>', 'Log level (e.g., info, debug)')
    .option('--timeout <ms>', 'Request timeout in milliseconds', (v) => {
      const n = parseInt(v, 10);
      if (isNaN(n)) throw new Error('Invalid timeout value');
      return n;
    })
    .action((options) => {
      savePersistentconfig(options);
      logger.info('config saved', { method: 'set' });
    });

  command
    .command('show')
    .description('Show current config')
    .action(() => {
      const config = loadPersistentConfig();
      logger.info(`${JSON.stringify(config, null, 2)}`, { method: 'show' });
    });

  command
    .command('clear')
    .description('Clear all saved config')
    .action(() => {
      clearPersistentConfig();
      logger.info('cleared', { method: 'clear' });
    });

  command
    .command('path')
    .description('Show location of saved config file')
    .action(() => {
      logger.info(getPersistentConfigPath(), {
        method: 'path',
      });
    });

  command.addHelpText(
    'after',
    [
      '',
      'Examples:',
      '  $ npx netstorage config set --host example.akamai.net --key abc123 --key-name xyz',
      '  $ npx netstorage config show',
      '  $ npx netstorage config clear',
      '  $ npx netstorage config path',
    ].join('\n'),
  );
  return command;
}
