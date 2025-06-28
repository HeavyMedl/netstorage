import { Command } from 'commander';
import {
  loadPersistentContext,
  savePersistentContext,
  clearPersistentContext,
} from '../utils/contextStore';

export default function configCommand(): Command {
  const command = new Command('config');

  command
    .command('set')
    .description('Set a context value')
    .option('--hostname <hostname>', 'Akamai hostname')
    .option('--key <key>', 'Akamai key')
    .option('--keyName <keyName>', 'Akamai key name')
    .option('--cpCode <cpCode>', 'Optional Akamai CP code')
    .option('--logLevel <level>', 'Log level (e.g., info, debug)')
    .option('--timeout <ms>', 'Request timeout in milliseconds', (v) =>
      parseInt(v, 10),
    )
    .action((options) => {
      savePersistentContext(options);
      console.log('✅ Context saved.');
    });

  command
    .command('show')
    .description('Show current context')
    .action(() => {
      const config = loadPersistentContext();
      console.log(JSON.stringify(config, null, 2));
    });

  command
    .command('clear')
    .description('Clear all saved context')
    .action(() => {
      clearPersistentContext();
      console.log('🧹 Context cleared.');
    });

  return command;
}
