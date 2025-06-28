import { Command } from 'commander';
import {
  loadPersistentConfig,
  savePersistentconfig,
  clearPersistentConfig,
} from '../utils/configStore';

export default function configCommand(): Command {
  const command = new Command('config');

  command
    .command('set')
    .description('Set a config value')
    .option('--hostname <hostname>', 'Akamai hostname')
    .option('--key <key>', 'Akamai key')
    .option('--keyName <keyName>', 'Akamai key name')
    .option('--cpCode <cpCode>', 'Optional Akamai CP code')
    .option('--logLevel <level>', 'Log level (e.g., info, debug)')
    .option('--timeout <ms>', 'Request timeout in milliseconds', (v) =>
      parseInt(v, 10),
    )
    .action((options) => {
      savePersistentconfig(options);
      console.log('✅ config saved.');
    });

  command
    .command('show')
    .description('Show current config')
    .action(() => {
      const config = loadPersistentConfig();
      console.log(JSON.stringify(config, null, 2));
    });

  command
    .command('clear')
    .description('Clear all saved config')
    .action(() => {
      clearPersistentConfig();
      console.log('🧹 config cleared.');
    });

  return command;
}
