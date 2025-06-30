import { Command } from 'commander';
import { createLogger, tree } from '@/index';
import { getLogLevelOverride, handleCliError } from '../utils';
import { loadClientConfig } from '../utils/loadConfig';

export function createTreeCommand(
  logger: ReturnType<typeof createLogger>,
): Command {
  return new Command('tree')
    .description('Render a directory tree of a remote NetStorage path')
    .argument('[path]', 'Remote path to walk (inferred from CWD if omitted)')
    .usage('<path> [options]')
    .option('--max-depth <n>', 'Maximum traversal depth', Number)
    .option(
      '-r, --recursive',
      'Recursively walk the full directory tree (sets max-depth to null)',
    )
    .option('--show-size', 'Display file or aggregated directory sizes')
    .option('--show-mtime', 'Display last modified timestamps')
    .option('--show-checksum', 'Display MD5 checksums if available')
    .option('--show-symlink-target', 'Display symlink targets')
    .option('--show-relative-path', 'Display relative path instead of name')
    .option('--show-absolute-path', 'Display full absolute path')
    .option('--log-level <level>', 'Override the log level')
    .option('-v, --verbose', 'Enable verbose logging')
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ npx netstorage tree /123456/assets --show-size --show-mtime --verbose',
        '',
        'Options:',
        '  --max-depth <n>             Maximum traversal depth (default: 0, use "null" for no limit)',
        '  -r, --recursive             Recursively walk the full directory tree (same as max-depth: null)',
        '  --show-size                 Display file or aggregated directory sizes',
        '  --show-mtime                Display last modified timestamps',
        '  --show-checksum             Display MD5 checksums if available',
        '  --show-symlink-target       Display symlink targets',
        '  --show-relative-path        Display relative path instead of name',
        '  --show-absolute-path        Display full absolute path',
        '  --log-level <level>         Override the log level',
        '  -v, --verbose               Enable verbose logging',
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
