import {
  remoteWalk,
  type RemoteWalkEntry,
  type RemoteWalkParams,
  type NetStorageClientConfig,
} from '@/index';

/**
 * Builds an adjacency list of remote directory entries grouped by depth, and calculates the total size.
 *
 * @param config - The NetStorage client config.
 * @param params - Parameters for walking the remote directory.
 * @returns An object containing depth buckets of entries and the total size.
 * @property depthBuckets - Array of objects each containing a depth level and associated entries.
 * @property totalSize - Cumulative size of all files found in the walk.
 */
export async function buildAdjacencyList(
  config: NetStorageClientConfig,
  params: RemoteWalkParams,
): Promise<{
  depthBuckets: Array<{
    depth: number;
    entries: RemoteWalkEntry[];
  }>;
  totalSize: number;
}> {
  const grouped = new Map<number, RemoteWalkEntry[]>();
  let totalSize = 0;
  for await (const entry of remoteWalk(config, params)) {
    grouped.set(entry.depth, [...(grouped.get(entry.depth) ?? []), entry]);
    if (entry?.file?.size) {
      const size = parseInt(entry.file.size, 10);
      if (!Number.isNaN(size)) {
        totalSize += size;
      }
    }
  }
  return {
    depthBuckets: Array.from(grouped, ([depth, entries]) => ({
      depth,
      entries,
    })),
    totalSize,
  };
}
