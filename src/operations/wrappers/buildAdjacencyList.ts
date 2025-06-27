import {
  remoteWalk,
  type RemoteWalkEntry,
  type RemoteWalkParams,
  type NetStorageClientContext,
} from '@/index';

export async function buildAdjacencyList(
  ctx: NetStorageClientContext,
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
  for await (const entry of remoteWalk(ctx, params)) {
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
