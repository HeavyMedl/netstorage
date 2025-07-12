import { Command } from 'commander';
import {
  buildAdjacencyList,
  aggregateDirectorySizes,
  formatBytes,
  createLogger,
  generateRemoteTree,
} from '@/index';
import {
  getLogLevelOverride,
  handleCliError,
  loadClientConfig,
  setLastCommandResult,
  writeOut,
} from '../utils';
import { colorizeName } from '@/cli/utils';

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
    .option('-q, --quiet', 'Suppress standard output')
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  $ npx nst tree',
        '  $ npx nst tree -s -M assets',
      ].join('\n'),
    )
    .action(
      async (
        remotePath: string | undefined,
        {
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
          quiet,
        },
      ) => {
        try {
          const resolvedMaxDepth =
            recursive || maxDepth === 'null' ? undefined : (maxDepth ?? 0);
          const inferredPath = remotePath ?? '/';
          const config = await loadClientConfig(
            getLogLevelOverride(logLevel, verbose),
          );
          const { depthBuckets, totalSize } = await buildAdjacencyList(config, {
            path: inferredPath,
            maxDepth: resolvedMaxDepth,
          });

          const hasEntries = depthBuckets?.[0]?.entries?.length > 0;

          let result: string[] = [];

          if (!hasEntries) {
            result.push(
              `No directory entries found at ${config.uri(inferredPath)}`,
            );
            setLastCommandResult(result);
            return;
          }

          const allEntries = depthBuckets.flatMap((bucket) => bucket.entries);
          const directorySizeMap = aggregateDirectorySizes(allEntries);
          const rootGroup = depthBuckets.find((g) => g.depth === 0);
          const rootEntries = rootGroup ? rootGroup.entries : [];

          // Sort rootEntries: directories first, then alphabetically by name
          rootEntries.sort((a, b) => {
            const aIsDir = a.file.type === 'dir';
            const bIsDir = b.file.type === 'dir';

            if (aIsDir && !bIsDir) return -1;
            if (!aIsDir && bIsDir) return 1;

            return a.file.name.localeCompare(b.file.name);
          });

          const trimmedPath = inferredPath.replace(/^\/+/, '');
          const topLabelPath = trimmedPath || '.';
          const topLabel = colorizeName(
            topLabelPath === '.' ? topLabelPath : `${topLabelPath}/`,
            'dir',
          );
          result.push(
            `${topLabel}${showSize ? ` (${formatBytes(totalSize)})` : ''}`,
          );
          result = result.concat(
            generateRemoteTree(rootEntries, {
              showSize,
              showMtime,
              showChecksum,
              showSymlinkTarget,
              showRelativePath,
              showAbsolutePath,
              depthBuckets,
              directorySizeMap,
            }),
          );
          if (!quiet) writeOut(result);
          setLastCommandResult(result);
        } catch (err) {
          handleCliError(err, logger);
        }
      },
    );
}
