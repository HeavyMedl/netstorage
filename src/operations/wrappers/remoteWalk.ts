import {
  dir,
  type NetStorageClientConfig,
  type NetStorageFile,
  type NetStorageStat,
} from '@/index';

/**
 * Represents a file or directory entry during a remote NetStorage walk.
 *
 * @property {NetStorageFile} file - Metadata about the file or directory.
 * @property {string} path - Full path to the entry.
 * @property {string} parent - Path of the entry’s parent directory.
 * @property {string} relativePath - Path relative to the walk root.
 * @property {number} depth - Depth of the entry from the root path.
 */
export interface RemoteWalkEntry {
  file: NetStorageFile;
  path: string;
  parent: string;
  relativePath: string;
  depth: number;
}

/**
 * Parameters to control the remote directory walk behavior.
 *
 * @property {string} path - The root NetStorage path to begin traversal from.
 * @property {number} [maxDepth] - Optional maximum recursion depth.
 * @property {(entry: RemoteWalkEntry) => boolean | Promise<boolean>} [shouldInclude] - Predicate to filter entries.
 */
export interface RemoteWalkParams {
  path: string;
  maxDepth?: number;
  shouldInclude?: (entry: RemoteWalkEntry) => boolean | Promise<boolean>;
  // followSymlinks?: boolean;
}

/**
 * Initiates a depth-first walk of a NetStorage directory.
 *
 * @param {NetStorageClientConfig} config - The NetStorage client config.
 * @param {RemoteWalkParams} params - Walk parameters.
 * @returns {AsyncGenerator<RemoteWalkEntry>} Generator yielding entries found.
 */
export async function* remoteWalk(
  config: NetStorageClientConfig,
  { path, maxDepth, shouldInclude }: RemoteWalkParams,
): AsyncGenerator<RemoteWalkEntry> {
  const rootPath = path.replace(/\/+$/, '');
  yield* remoteWalkRecursive(
    config,
    rootPath,
    rootPath,
    maxDepth,
    shouldInclude,
    0,
  );
}

/**
 * Recursively traverses a NetStorage directory in depth-first order.
 *
 * @param {NetStorageClientConfig} config - The NetStorage client config.
 * @param {string} currentPath - Current path in traversal.
 * @param {string} rootPath - Initial root path.
 * @param {number | undefined} maxDepth - Maximum depth limit.
 * @param {RemoteWalkParams['shouldInclude']} shouldInclude - Optional filter predicate.
 * @param {number} depth - Current recursion depth.
 * @returns {AsyncGenerator<RemoteWalkEntry>} Generator yielding walk entries.
 * @internal
 */
async function* remoteWalkRecursive(
  config: NetStorageClientConfig,
  currentPath: string,
  rootPath: string,
  maxDepth: number | undefined,
  shouldInclude: RemoteWalkParams['shouldInclude'],
  depth: number = 0,
): AsyncGenerator<RemoteWalkEntry> {
  if (typeof maxDepth === 'number' && depth > maxDepth) return;

  let result: NetStorageStat;
  try {
    result = await dir(config, { path: currentPath });
  } catch (err) {
    config.logger.debug(`Failed to walk ${currentPath}: ${err}`, {
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
        config,
        fullPath,
        rootPath,
        maxDepth,
        shouldInclude,
        depth + 1,
      );
    }
  }
}
