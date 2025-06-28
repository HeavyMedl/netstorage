#!/usr/bin/env node
import { Command } from 'commander';
import uploadCommand from './commands/upload';
import configCommand from './commands/config';
import { version } from '../../package.json';
import { loadClientConfig } from './utils/loadConfig';

const program = new Command();

program
  .name('netstorage')
  .description('Unofficial Akamai NetStorage CLI')
  .version(version);

async function main() {
  try {
    const config = await loadClientConfig();
    program.addCommand(configCommand());
    program.addCommand(uploadCommand(config));
    return program.parseAsync(process.argv);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main();
