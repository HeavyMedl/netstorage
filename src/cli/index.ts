#!/usr/bin/env node
import { Command } from 'commander';
import { version } from '../../package.json';
import { decoratedOperation } from './utils/decoratedOperation';
import {
  loadPersistentConfig,
  savePersistentconfig,
  clearPersistentConfig,
  getPersistentConfigPath,
} from './utils/configStore';

import { createLogger, stat } from '@/index';

const logger = createLogger('info', `netstorage/cli`);
const program = new Command();

program
  .name('netstorage')
  .description(`Unofficial Akamai NetStorage CLI`)
  .version(version);

program
  .command('stat')
  .description('Inspect a remote file or directory')
  .addHelpText(
    'after',
    [
      '',
      'Examples:',
      '  $ npx netstorage stat /some/file.txt',
      '  $ npx netstorage stat /some/folder --timeout 5000',
      '  $ npx netstorage stat /some/folder --cancel-after 3000',
      '',
      'Options:',
      '  --timeout <ms>        Set request timeout in milliseconds',
      '  --cancel-after <ms>   Automatically abort the request after a given time',
    ].join('\n'),
  )
  .argument('<remotePath>', 'Remote path to inspect')
  .option('--timeout <ms>', 'Request timeout in milliseconds', (v) => {
    const n = parseInt(v, 10);
    if (isNaN(n)) throw new Error('Invalid timeout value');
    return n;
  })
  .option(
    '--cancel-after <ms>',
    'Abort the request after a specified duration',
    (v) => {
      const n = parseInt(v, 10);
      if (isNaN(n)) throw new Error('Invalid cancel-after value');
      return n;
    },
  )
  .action(
    decoratedOperation(async function (
      this: Command,
      config,
      remotePath: string,
    ) {
      const opts = this.opts();
      let signal: AbortSignal | undefined;
      if (opts.cancelAfter != null) {
        const controller = new AbortController();
        signal = controller.signal;
        setTimeout(() => controller.abort(), opts.cancelAfter);
      }
      const result = await stat(config, {
        path: remotePath,
        options: {
          timeout: opts.timeout,
          signal,
        },
      });
      process.stdout.write(JSON.stringify(result));
    }),
  );

program
  .command('config')
  .alias('cfg')
  .description('Manage NetStorage CLI configuration')
  .addHelpText(
    'after',
    [
      '',
      'Examples:',
      '  $ npx netstorage config set --host example.akamai.net --key abc123 --key-name xyz',
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
      .option('--timeout <ms>', 'Request timeout in milliseconds', (v) => {
        const n = parseInt(v, 10);
        if (isNaN(n)) throw new Error('Invalid timeout value');
        return n;
      })
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

program.parseAsync(process.argv);
