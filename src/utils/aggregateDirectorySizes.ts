import type { RemoteWalkEntry } from '@/index';

/**
 * Aggregates file sizes and rolls them up to each directory in the walk.
 *
 * This function creates a map of directory paths to their cumulative size.
 * It assumes that entries are ordered by increasing depth, so children appear
 * before parents. Each file contributes its size to its own directory, and
 * each directory bubbles up its children's size.
 *
 * @param entries - The list of walk entries to process.
 * @returns A map of directory paths to their aggregated size in bytes.
 */
export function aggregateDirectorySizes(
  entries: RemoteWalkEntry[],
): Map<string, { aggregatedSize: number }> {
  const directoryMap = new Map<string, { aggregatedSize: number }>();

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
