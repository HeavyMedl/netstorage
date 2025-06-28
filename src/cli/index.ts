#!/usr/bin/env node
import { Command } from 'commander';
import uploadCommand from './commands/upload';
import configCommand from './commands/config';
import { version } from '../../package.json';

const program = new Command();

program
  .name('netstorage')
  .description(`Unofficial Akamai NetStorage CLI`)
  .addCommand(configCommand())
  .addCommand(uploadCommand())
  .version(version);

program.parseAsync(process.argv);
