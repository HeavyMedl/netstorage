import type { NetStorageClientContext } from '@/config/createClientContext';
import type { NetStorageFile } from '@/types/shared';
import { dir } from '@/operations/dir';
import type { NetStorageStat } from '@/operations/stat';

/**
 * Represents a single entry yielded during a directory walk operation.
 *
 * This entry is derived from the `file` array in a NetStorage `dir` listing
 * and includes both the entry metadata and its fully qualified path.
 *
 * @property file - Metadata about the file or directory.
 * @property path - The full NetStorage path for the entry.
 * @property parent - The parent directory of the entry.
 * @property depth - The depth of the entry in the directory tree.
 * @property relativePath - The relative path of the entry from the root directory.
 */
export interface RemoteWalkEntry {
  file: NetStorageFile;
  path: string;
  parent: string;
  relativePath: string;
  depth: number;
}

/**
 * Parameters for the `walk` operation.
 *
 * @property path - The root NetStorage path to begin traversal from.
 * @property maxDepth - Optional maximum recursion depth. A value of 0 yields only the root contents.
 * @property shouldInclude - Optional async predicate to determine whether a given entry should be yielded.
 */
export interface RemoteWalkParams {
  path: string;
  maxDepth?: number;
  shouldInclude?: (entry: RemoteWalkEntry) => boolean | Promise<boolean>;
  // followSymlinks?: boolean;
}

/**
 * Asynchronously traverses a NetStorage directory hierarchy.
 *
 * This async generator yields metadata about each file and directory found
 * under the specified root, optionally filtered or transformed through a
 * user-defined predicate.
 *
 * @param ctx - The NetStorage client context.
 * @param params - Parameters controlling the traversal behavior.
 * @returns An async generator yielding `WalkEntry` objects.
 */
export async function* remoteWalk(
  ctx: NetStorageClientContext,
  { path, maxDepth, shouldInclude }: RemoteWalkParams,
): AsyncGenerator<RemoteWalkEntry> {
  const rootPath = path.replace(/\/+$/, '');
  yield* remoteWalkRecursive(
    ctx,
    rootPath,
    rootPath,
    maxDepth,
    shouldInclude,
    0,
  );
}

/**
 * Internal recursive helper for `remoteWalk`, used to traverse directories in
 * depth-first order.
 *
 * @param ctx - The NetStorage client context.
 * @param currentPath - The current path being traversed.
 * @param rootPath - The root path of traversal.
 * @param maxDepth - Maximum allowed depth.
 * @param shouldInclude - Optional predicate to determine which entries to yield.
 * @param depth - The current depth relative to the root path.
 * @returns An async generator yielding `WalkEntry` objects.
 * @internal
 */
async function* remoteWalkRecursive(
  ctx: NetStorageClientContext,
  currentPath: string,
  rootPath: string,
  maxDepth: number | undefined,
  shouldInclude: RemoteWalkParams['shouldInclude'],
  depth: number = 0,
): AsyncGenerator<RemoteWalkEntry> {
  if (typeof maxDepth === 'number' && depth > maxDepth) return;

  let result: NetStorageStat;
  try {
    result = await dir(ctx, { path: currentPath });
  } catch (err) {
    ctx.logger.debug(`Failed to walk ${currentPath}: ${err}`, {
      method: 'remoteWalk',
    });
    return;
  }

  const fileList: NetStorageFile[] = Array.isArray(result.stat?.file)
    ? result.stat!.file
    : result.stat?.file
      ? [result.stat.file]
      : [];

  for (const entry of fileList) {
    const fullPath = [currentPath, entry.name]
      .join('/')
      .replace(/\/{2,}/g, '/');
    const relativePath = fullPath.slice(rootPath.length).replace(/^\/+/, '');

    const walkEntry: RemoteWalkEntry = {
      file: entry,
      path: fullPath,
      parent: currentPath,
      depth,
      relativePath,
    };

    const shouldYield = shouldInclude ? await shouldInclude(walkEntry) : true;
    if (shouldYield) yield walkEntry;

    if (entry.type === 'dir') {
      yield* remoteWalkRecursive(
        ctx,
        fullPath,
        rootPath,
        maxDepth,
        shouldInclude,
        depth + 1,
      );
    }
  }
}
