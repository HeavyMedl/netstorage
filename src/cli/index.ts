#!/usr/bin/env node
import { Command } from 'commander';
import { version } from '../../package.json';

import { createLogger } from '@/index';
import { createRemotePathCommand } from './commands/createRemotePathCommand';
import { createConfigCommand } from './commands/createConfigCommand';
import { createDownloadCommand } from './commands/createDownloadCommand';
import { createUploadCommand } from './commands/createUploadCommand';

const logger = createLogger('info', `netstorage/cli`);

const program = new Command();
program
  .name('netstorage')
  .description(`Unofficial Akamai NetStorage CLI`)
  .version(version)
  .usage('[command] [options]');
program.addCommand(
  createRemotePathCommand({
    name: 'stat',
    description: 'Inspect a remote file or directory',
    examplePath: '/some/file.txt',
    logger,
    remotePathArg: {
      required: false,
      description: 'Remote file or directory to inspect',
    },
  }),
);
program.addCommand(
  createRemotePathCommand({
    name: 'dir',
    description: 'List the contents of a remote directory',
    examplePath: '/some/folder',
    logger,
    remotePathArg: {
      required: false,
      description: 'Remote directory to list',
    },
  }),
);
program.addCommand(
  createRemotePathCommand({
    name: 'du',
    description: 'Retrieve disk usage for a remote path',
    examplePath: '/some/folder',
    logger,
    remotePathArg: {
      required: false,
      description: 'Remote path to calculate disk usage',
    },
  }),
);
program.addCommand(
  createRemotePathCommand({
    name: 'mkdir',
    description: 'Create a remote directory',
    examplePath: '/some/new-folder',
    logger,
    remotePathArg: {
      required: true,
      description: 'Remote directory path to create',
    },
  }),
);
program.addCommand(
  createRemotePathCommand({
    name: 'rmdir',
    description: 'Remove a remote directory',
    examplePath: '/some/old-folder',
    logger,
    remotePathArg: {
      required: true,
      description: 'Remote directory path to remove',
    },
  }),
);
program.addCommand(
  createRemotePathCommand({
    name: 'rm',
    description: 'Delete a remote file',
    examplePath: '/some/file.txt',
    logger,
    remotePathArg: {
      description: 'Remote file path to delete',
      required: true,
    },
  }),
);
program.addCommand(createConfigCommand(logger));
program.addCommand(createDownloadCommand(logger));
program.addCommand(createUploadCommand(logger));
program.parseAsync(process.argv);
