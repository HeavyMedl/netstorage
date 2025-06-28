#!/usr/bin/env node
import { Command } from 'commander';
import uploadCommand from './commands/upload';
import configCommand from './commands/context';
import { version } from '../../package.json';
import { loadClientContext } from './utils/loadContext';

const program = new Command();

program
  .name('netstorage')
  .description('Unofficial Akamai NetStorage CLI')
  .version(version);

async function main() {
  try {
    const ctx = await loadClientContext();
    program.addCommand(configCommand());
    program.addCommand(uploadCommand(ctx));
    return program.parseAsync(process.argv);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main();
