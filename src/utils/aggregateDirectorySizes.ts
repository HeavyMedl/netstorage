import type { RemoteWalkEntry } from '@/index';

/**
 * Represents the aggregated size for a directory.
 *
 * @property {number} aggregatedSize - The total size in bytes of files within the directory and its subdirectories.
 */
interface AggregatedSize {
  aggregatedSize: number;
}

/**
 * Computes cumulative file sizes for directories based on a list of remote walk entries.
 *
 * Entries are processed in reverse depth order to ensure that sizes of child directories
 * and files are rolled up to their parents.
 *
 * @param entries - List of remote file system entries to aggregate.
 * @returns A map of directory paths to their aggregated sizes in bytes.
 */
export function aggregateDirectorySizes(
  entries: RemoteWalkEntry[],
): Map<string, AggregatedSize> {
  const directoryMap = new Map<string, AggregatedSize>();

  for (const entry of [...entries].reverse()) {
    const isFile = entry.file.type === 'file';
    const isDir = entry.file.type === 'dir';

    const size = isFile
      ? Number(entry.file.size ?? 0)
      : (directoryMap.get(entry.path)?.aggregatedSize ?? 0);

    if (!directoryMap.has(entry.parent)) {
      directoryMap.set(entry.parent, { aggregatedSize: 0 });
    }

    if (entry.depth > 0) {
      const parentData = directoryMap.get(entry.parent);
      if (parentData) {
        parentData.aggregatedSize += size;
      }
    }

    // Store current directory size too
    if (isDir) {
      if (!directoryMap.has(entry.path)) {
        directoryMap.set(entry.path, { aggregatedSize: size });
      }
    }
  }

  return directoryMap;
}
