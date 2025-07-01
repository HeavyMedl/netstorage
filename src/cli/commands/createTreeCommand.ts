import { Command } from 'commander';
import { createLogger, tree } from '@/index';
import { getLogLevelOverride, handleCliError } from '../utils';
import { loadClientConfig } from '../utils/loadConfig';

export function createTreeCommand(
  logger: ReturnType<typeof createLogger>,
): Command {
  return new Command('tree')
    .description('Render a directory tree of a remote path')
    .argument('[path]', 'Remote path to walk (inferred from CWD if omitted)')
    .option('-a, --show-absolute-path', 'Display full absolute path')
    .option('-c, --show-checksum', 'Display MD5 checksums if available')
    .option('-l, --log-level <level>', 'Override the log level')
    .option('-m, --max-depth <n>', 'Maximum traversal depth', Number)
    .option('-M, --show-mtime', 'Display last modified timestamps')
    .option('-p, --show-relative-path', 'Display relative path instead of name')
    .option(
      '-r, --recursive',
      'Recursively walk the full directory tree (sets max-depth to null)',
    )
    .option('-s, --show-size', 'Display file or aggregated directory sizes')
    .option('-t, --show-symlink-target', 'Display symlink targets')
    .option('-v, --verbose', 'Enable verbose logging')
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ npx nst tree /123456/assets --show-size --show-mtime --verbose',
      ].join('\n'),
    )
    .action(async (path: string | undefined, options) => {
      const {
        maxDepth,
        showSize,
        showMtime,
        showChecksum,
        showSymlinkTarget,
        showRelativePath,
        showAbsolutePath,
        logLevel,
        verbose,
        recursive,
      } = options;
      const resolvedMaxDepth =
        recursive || maxDepth === 'null'
          ? undefined
          : maxDepth === undefined
            ? 0
            : maxDepth;
      const inferredPath = path ?? '/';
      try {
        const config = await loadClientConfig(
          getLogLevelOverride(logLevel, verbose),
        );
        await tree(config, {
          path: inferredPath,
          maxDepth: resolvedMaxDepth,
          showSize,
          showMtime,
          showChecksum,
          showSymlinkTarget,
          showRelativePath,
          showAbsolutePath,
        });
      } catch (err) {
        handleCliError(err, logger);
      }
    });
}
