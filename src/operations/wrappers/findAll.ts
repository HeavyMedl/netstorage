import {
  remoteWalk,
  type RemoteWalkEntry,
  type RemoteWalkParams,
  type NetStorageClientConfig,
} from '@/index';

/**
 * Recursively walks a NetStorage directory and collects all entries
 * that satisfy the given predicate.
 *
 * @param config - NetStorage client config used for API requests.
 * @param params - Configuration for the directory walk and filter.
 * @property {string} params.path - The root directory path to begin walking.
 * @property {(entry: RemoteWalkEntry) => boolean | Promise<boolean>} params.predicate - A function to determine if an entry should be included.
 * @returns {Promise<RemoteWalkEntry[]>} A promise that resolves with all matching entries.
 */
export async function findAll(
  config: NetStorageClientConfig,
  params: RemoteWalkParams & {
    predicate: (entry: RemoteWalkEntry) => boolean | Promise<boolean>;
  },
): Promise<RemoteWalkEntry[]> {
  const matches: RemoteWalkEntry[] = [];
  for await (const entry of remoteWalk(config, params)) {
    if (await params.predicate(entry)) {
      matches.push(entry);
    }
  }
  return matches;
}
