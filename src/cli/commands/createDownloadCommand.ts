import path from 'node:path';
import { Command } from 'commander';
import { download, createLogger } from '@/index';
import {
  validateTimeout,
  validateCancelAfter,
  handleCliError,
  resolveAbortSignal,
  getLogLevelOverride,
  printJson,
} from '../utils';
import { loadClientConfig } from '../utils/loadConfig';

export function createDownloadCommand(
  logger: ReturnType<typeof createLogger>,
): Command {
  return new Command('download')
    .description('Download a file from NetStorage to a local path')
    .argument('<remotePath>', 'Remote path to download from')
    .argument(
      '[localPath]',
      'Local file path to save content to (inferred if omitted)',
    )
    .option(
      '-c, --cancel-after <ms>',
      'Abort the request after duration',
      validateCancelAfter,
    )
    .option('-d, --dry-run', 'Perform a dry run without writing the file')
    .option('-l, --log-level <level>', 'Override the log level')
    .option('-p, --pretty', 'Pretty-print the JSON output')
    .option(
      '-t, --timeout <ms>',
      'Request timeout in milliseconds',
      validateTimeout,
    )
    .option('-v, --verbose', 'Enable verbose logging')
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ npx netstorage download /remote/path /local/file.txt --timeout 5000 --cancel-after 3000 --verbose --dry-run --pretty',
      ].join('\n'),
    )
    .action(async function (this: Command, remotePath, localPathArg) {
      try {
        const { timeout, cancelAfter, logLevel, dryRun, pretty, verbose } =
          this.opts();
        const config = await loadClientConfig(
          getLogLevelOverride(logLevel, verbose),
        );
        const localPath =
          localPathArg ||
          path.resolve(process.cwd(), path.basename(remotePath));
        const result = await download(config, {
          fromRemote: remotePath,
          toLocal: localPath,
          options: { timeout, signal: resolveAbortSignal(cancelAfter) },
          shouldDownload: dryRun ? async () => false : undefined,
        });
        if (dryRun) {
          logger.info(
            `[Dry Run] Skipped download: ${config.uri(remotePath)} → ${localPath}`,
          );
          return;
        }
        printJson(result, pretty);
      } catch (err) {
        handleCliError(err, logger);
      }
    });
}
