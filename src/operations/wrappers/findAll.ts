import {
  remoteWalk,
  type RemoteWalkEntry,
  type RemoteWalkParams,
} from './remoteWalk';
import type { NetStorageClientContext } from '../../config/createClientContext';

/**
 * Recursively walks a NetStorage directory and returns all entries
 * that match the provided predicate.
 *
 * @param ctx - The operation context.
 * @param params - Parameters including the root path to walk
 *  and the predicate to match.
 * @returns A promise resolving to an array of matching entries.
 */
export async function findAll(
  ctx: NetStorageClientContext,
  params: RemoteWalkParams & {
    predicate: (entry: RemoteWalkEntry) => boolean | Promise<boolean>;
  },
): Promise<RemoteWalkEntry[]> {
  const matches: RemoteWalkEntry[] = [];
  for await (const entry of remoteWalk(ctx, params)) {
    if (await params.predicate(entry)) {
      matches.push(entry);
    }
  }
  return matches;
}
