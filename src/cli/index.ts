#!/usr/bin/env node
import { Command } from 'commander';
import { version } from '../../package.json';

import { createLogger } from '@/index';
import { createRemoteInspectCommand } from './commands/createRemoteInspectCommand';
import { createConfigCommand } from './commands/createConfigCommand';

const logger = createLogger('info', `netstorage/cli`);

const program = new Command();

program
  .name('netstorage')
  .description(`Unofficial Akamai NetStorage CLI`)
  .version(version)
  .usage('[command] [options]');

program.addCommand(
  createRemoteInspectCommand({
    name: 'stat',
    description: 'Inspect a remote file or directory',
    examplePath: '/some/file.txt',
    logger,
  }),
);

program.addCommand(
  createRemoteInspectCommand({
    name: 'dir',
    description: 'List the contents of a remote directory',
    examplePath: '/some/folder',
    logger,
  }),
);

program.addCommand(createConfigCommand(logger));

program.parseAsync(process.argv);
