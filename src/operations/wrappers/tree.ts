import type { NetStorageClientContext } from '../../config/createClientContext';
import { aggregateDirectorySizes } from '../../utils/aggregateDirectorySizes';
import { formatBytes } from '../../utils/formatBytes';
import { formatMtime } from '../../utils/formatMtime';
import { buildAdjacencyList } from './buildAdjacencyList';
import type { RemoteWalkEntry, RemoteWalkParams } from './remoteWalk';

/**
 * Parameters for the `tree` operation.
 *
 * Extends the base `walk` parameters to include options for controlling
 * display behavior, such as file sizes, modification times, checksums,
 * symbolic link targets, and whether to include the full path in output.
 *
 * @property {boolean} [showSize] - Whether to include file sizes in the output.
 * @property {boolean} [showMtime] - Whether to include last modified time in the output.
 * @property {boolean} [showChecksum] - Whether to include MD5 checksums if available.
 * @property {boolean} [showSymlinkTarget] - Whether to show symlink target paths.
 * @property {boolean} [showRelativePath] - Whether to display relative path instead of full.
 * @property {boolean} [showAbsolutePath] - Whether to display full absolute path instead of relative.
 */
export interface TreeParams extends RemoteWalkParams {
  showSize?: boolean;
  showMtime?: boolean;
  showChecksum?: boolean;
  showSymlinkTarget?: boolean;
  showRelativePath?: boolean;
  showAbsolutePath?: boolean;
}

/**
 * Represents the result of a NetStorage `tree` operation.
 *
 * This structure includes directory walk entries grouped into depth buckets,
 * a map of aggregated directory sizes (in bytes), and the total cumulative size
 * of all encountered files.
 *
 * @property depthBuckets - Array of entry groups indexed by depth in the directory tree.
 * Each group contains the depth level and a list of entries (files/directories) at that level.
 * @property directorySizeMap - A Map keyed by directory path, where each value contains
 * the aggregated size (in bytes) of files and subdirectories under that directory.
 * @property totalSize - The total size in bytes of all encountered files in the walk.
 */
export interface TreeResult {
  depthBuckets: { depth: number; entries: RemoteWalkEntry[] }[];
  directorySizeMap: Map<string, { aggregatedSize: number }>;
  totalSize: number;
}

/**
 * Logs a formatted tree structure of the remote NetStorage directory.
 *
 * Uses the `walk` function to traverse the directory structure and displays
 * a visual tree layout similar to the Unix `tree` command.
 *
 * @param params - Parameters extending `TreeParams` to configure traversal
 *   and filtering.
 * @returns A promise that resolves when the directory tree has been printed.
 */
export async function tree(
  ctx: NetStorageClientContext,
  params: TreeParams,
): Promise<TreeResult> {
  const {
    path,
    maxDepth,
    shouldInclude,
    showSize,
    showMtime,
    showChecksum,
    showSymlinkTarget,
    showRelativePath,
    showAbsolutePath,
  } = params;
  ctx.logger.info(`Generating directory tree for ${path}`, {
    method: 'tree',
  });
  const { depthBuckets, totalSize } = await buildAdjacencyList(ctx, {
    path,
    maxDepth,
    shouldInclude,
  });
  // Flatten all entries for aggregation
  const allEntries: RemoteWalkEntry[] = depthBuckets.flatMap(
    (bucket) => bucket.entries,
  );
  const directorySizeMap = aggregateDirectorySizes(allEntries);

  function getChildren(parentPath: string, depth: number) {
    const group = depthBuckets.find((bucket) => bucket.depth === depth);
    if (!group) return [];
    return group.entries.filter((e) => e.parent === parentPath);
  }
  function renderTree(entries: RemoteWalkEntry[], prefix = ''): void {
    entries.forEach((entry, index) => {
      const isLast = index === entries.length - 1;
      const connector = isLast ? '└──' : '├──';
      const nextPrefix = prefix + (isLast ? '    ' : '│   ');

      const file = entry.file;
      const isSymlink = file.type === 'symlink';
      const isDir = file.type === 'dir';
      const icon = isSymlink ? '🔗' : isDir ? '📁' : '📄';
      const dirSize = directorySizeMap.get(entry.path)?.aggregatedSize ?? 0;
      const fileSize = file.size ? Number(file.size) : 0;
      const displaySize = isDir ? formatBytes(dirSize) : formatBytes(fileSize);

      const displayParts = [
        showRelativePath ? entry.relativePath : null,
        showAbsolutePath ? entry.path : null,
        showSize && (isDir || file.size) ? displaySize : null,
        showMtime && file.mtime ? formatMtime(file.mtime) : null,
        showChecksum && file.md5 ? `md5: ${file.md5}` : null,
        showSymlinkTarget && isSymlink && file.target
          ? `-> ${file.target}`
          : null,
      ].filter(Boolean);

      const suffix =
        displayParts.length > 0 ? ` (${displayParts.join(' | ')})` : '';
      process.stdout.write(
        `${prefix}${connector} ${icon} ${file.name}${suffix}\n`,
      );

      if (isDir) {
        const children = getChildren(entry.path, entry.depth + 1);
        if (children.length > 0) {
          renderTree(children, nextPrefix);
        }
      }
    });
  }
  // Find root entries (depth 0)
  const rootGroup = depthBuckets.find((g) => g.depth === 0);
  const rootEntries = rootGroup ? rootGroup.entries : [];
  process.stdout.write(
    `📁 ${path}${showSize ? ` (${formatBytes(totalSize)})` : ''}\n`,
  );
  renderTree(rootEntries, '');
  return { depthBuckets, directorySizeMap, totalSize };
}
