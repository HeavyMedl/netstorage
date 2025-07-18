#!/usr/bin/env node
import { argv } from 'node:process';
import { Command } from 'commander';
import { version } from '../../package.json';

import { createLogger } from '@/index';
import { createRemotePathCommand } from './commands/createRemotePathCommand';
import { createConfigCommand } from './commands/createConfigCommand';
import { createDownloadCommand } from './commands/createDownloadCommand';
import { createUploadCommand } from './commands/createUploadCommand';
import { createSymlinkCommand } from './commands/createSymlinkCommand';
import { createSyncCommand } from './commands/createSyncCommand';
import { createRenameCommand } from './commands/createRenameCommand';
import { createMtimeCommand } from './commands/createMtimeCommand';
import { createTreeCommand } from './commands/createTreeCommand';
import { createRemoveCommand } from './commands/createRemoveCommand';
import { createReplCommand } from './commands/createReplCommand';
import { createFindCommand } from './commands/createFindCommand';

const logger = createLogger('info', `netstorage/cli`);
export const program = new Command();
program
  .name('netstorage')
  .alias('nst')
  .description(
    [
      'An unofficial CLI for Akamai NetStorage to inspect, manage, and transfer',
      'files or directories using familiar commands. Includes an interactive shell (REPL)',
      'for exploring and manipulating remote storage.',
      '',
      'Examples:',
      '  $ nst upload ./local-file.txt remote-file.txt',
      '  $ nst download remote-dir',
      '  $ nst rm remote-file.txt',
      '  $ nst # Launch interactive REPL',
      '',
      'Persistent config management and verbose logging are supported to enhance',
      'flexibility. Built-in rate limiting, retry logic, and concurrency controls',
      'ensure robust and efficient execution.',
    ].join('\n'),
  )
  .version(version);
program.addCommand(createConfigCommand(logger));
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
program.addCommand(createDownloadCommand(logger));
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
program.addCommand(createFindCommand(logger));
program.addCommand(createMtimeCommand(logger));
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
program.addCommand(createRenameCommand(logger));
program.addCommand(createRemoveCommand(logger));
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
program.addCommand(createSymlinkCommand(logger));
program.addCommand(createSyncCommand(logger));
program.addCommand(createTreeCommand(logger));
program.addCommand(createUploadCommand(logger));
program.action(() => {
  createReplCommand().parseAsync(argv);
});
program.parseAsync(argv);
