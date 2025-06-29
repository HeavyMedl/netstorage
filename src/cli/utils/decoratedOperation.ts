import type { Command } from 'commander';
import {
  ConfigValidationError,
  createLogger,
  type NetStorageClientConfig,
} from '@/index';
import { loadClientConfig } from './loadConfig';

const logger = createLogger('info', `netstorage/cli`);

export function decoratedOperation<Args extends unknown[]>(
  fn: (
    this: Command,
    config: NetStorageClientConfig,
    ...args: Args
  ) => Promise<void>,
) {
  return async function (this: Command, ...args: Args) {
    try {
      const config = await loadClientConfig();
      await fn.call(this, config, ...args);
    } catch (err) {
      if (err instanceof ConfigValidationError) {
        logger.error(err.message);
        logger.info(`$ npx netstorage config set [${err.field}] [value]`);
      } else {
        logger.error('Unexpected error occurred.');
        console.error(err);
      }
      process.exit(1);
    }
  };
}
