import type { NetStorageClientContext } from '@/index';

/**
 * Constructs a full URI for a given path using the client context.
 *
 * @param context - The NetStorage client context containing config details.
 * @param path - The path to append to the base URL.
 * @returns A full URI string.
 */
export function buildUri(
  context: NetStorageClientContext,
  path: string,
): string {
  const protocol = context.ssl ? 'https' : 'http';
  const base = `${protocol}://${context.host}`;
  return new URL(path, base).toString();
}
