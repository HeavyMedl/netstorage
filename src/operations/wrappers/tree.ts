import {
  buildAdjacencyList,
  formatBytes,
  formatMtime,
  aggregateDirectorySizes,
  type RemoteWalkEntry,
  type RemoteWalkParams,
  type NetStorageClientConfig,
} from '@/index';

/**
 * Parameters for the `tree` operation.
 *
 * Extends `RemoteWalkParams` with additional display options.
 *
 * @property {boolean} [showSize] - Display file sizes.
 * @property {boolean} [showMtime] - Display last modified timestamps.
 * @property {boolean} [showChecksum] - Display MD5 checksums, if available.
 * @property {boolean} [showSymlinkTarget] - Display symlink target paths.
 * @property {boolean} [showRelativePath] - Show relative paths.
 * @property {boolean} [showAbsolutePath] - Show absolute paths.
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
 * Result of the `tree` operation.
 *
 * @property {Array<{ depth: number; entries: RemoteWalkEntry[] }>} depthBuckets - Entries grouped by depth.
 * @property {Map<string, { aggregatedSize: number }>} directorySizeMap - Aggregated sizes per directory.
 * @property {number} totalSize - Total size of all files in bytes.
 */
export interface TreeResult {
  depthBuckets: { depth: number; entries: RemoteWalkEntry[] }[];
  directorySizeMap: Map<string, { aggregatedSize: number }>;
  totalSize: number;
}

/**
 * Generate and print a tree structure of a remote NetStorage path.
 *
 * Walks the directory tree and renders a visual layout with optional metadata.
 *
 * @param {NetStorageClientConfig} config - Authenticated NetStorage client config.
 * @param {TreeParams} params - Tree rendering and traversal options.
 * @returns {Promise<TreeResult>} Resolves with grouped entries and size data.
 */
export async function tree(
  config: NetStorageClientConfig,
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
  config.logger.info(`Generating directory tree for ${path}`, {
    method: 'tree',
  });
  const { depthBuckets, totalSize } = await buildAdjacencyList(config, {
    path,
    maxDepth,
    shouldInclude,
  });
  // Flatten all entries for aggregation
  const allEntries: RemoteWalkEntry[] = depthBuckets.flatMap(
    (bucket) => bucket.entries,
  );
  const directorySizeMap = aggregateDirectorySizes(allEntries);

  /**
   * Get immediate children of a directory at a given depth.
   *
   * @param {string} parentPath - Path of the parent directory.
   * @param {number} depth - Depth level of children to retrieve.
   * @returns {RemoteWalkEntry[]} Array of child entries.
   */
  function getChildren(parentPath: string, depth: number) {
    const group = depthBuckets.find((bucket) => bucket.depth === depth);
    if (!group) return [];
    return group.entries.filter((e) => e.parent === parentPath);
  }
  /**
   * Recursively render a tree view of entries with optional metadata.
   *
   * @param {RemoteWalkEntry[]} entries - Entries to render.
   * @param {string} prefix - Prefix string for visual indentation.
   */
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
