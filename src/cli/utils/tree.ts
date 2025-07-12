import { formatBytes, formatMtime, type RemoteWalkEntry } from '@/index';
import { colorizeName } from '@/cli/utils';

interface RenderRemoteTreeOptions {
  showSize?: boolean;
  showMtime?: boolean;
  showChecksum?: boolean;
  showSymlinkTarget?: boolean;
  showRelativePath?: boolean;
  showAbsolutePath?: boolean;
  depthBuckets: { depth: number; entries: RemoteWalkEntry[] }[];
  directorySizeMap: Map<string, { aggregatedSize: number }>;
}

/**
 * Retrieves immediate children from a group of depth-bucketed entries.
 *
 * @param depthBuckets - The bucketed tree structure.
 * @param parentPath - The path of the parent directory.
 * @param depth - The depth level of the children.
 * @returns Array of child entries at the specified depth.
 */
export function getChildrenForDepthBuckets(
  depthBuckets: { depth: number; entries: RemoteWalkEntry[] }[],
  parentPath: string,
  depth: number,
): RemoteWalkEntry[] {
  const group = depthBuckets.find((bucket) => bucket.depth === depth);
  if (!group) return [];
  return group.entries.filter((e) => e.parent === parentPath);
}

/**
 * Generates a remote directory tree based on the provided entries and options.
 *
 * @param {RemoteWalkEntry[]} entries - Array of remote file system entries to render.
 * @param {RenderRemoteTreeOptions} options - Options for customizing the tree rendering.
 * @param {string} [prefix=''] - Prefix string for indentation.
 * @returns {string[]} An array of strings representing the rendered directory tree.
 */
export function generateRemoteTree(
  entries: RemoteWalkEntry[],
  options: RenderRemoteTreeOptions,
  prefix = '',
): string[] {
  const {
    showSize,
    showMtime,
    showChecksum,
    showSymlinkTarget,
    showRelativePath,
    showAbsolutePath,
    depthBuckets,
    directorySizeMap,
  } = options;

  const lines: string[] = [];

  entries.forEach((entry, index) => {
    const isLast = index === entries.length - 1;
    const connector = isLast ? '└──' : '├──';
    const nextPrefix = prefix + (isLast ? '    ' : '│   ');

    const file = entry.file;
    const isSymlink = file.type === 'symlink';
    const isDir = file.type === 'dir';
    const name = colorizeName(isDir ? `${file.name}/` : file.name, file.type);
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
    lines.push(`${prefix}${connector} ${name}${suffix}`);

    if (isDir) {
      const children = getChildrenForDepthBuckets(
        depthBuckets,
        entry.path,
        entry.depth + 1,
      );
      if (children.length > 0) {
        lines.push(...generateRemoteTree(children, options, nextPrefix));
      }
    }
  });

  return lines;
}
