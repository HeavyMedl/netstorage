import type { NetStorageClientContext } from '@/index';

/**
 * @typedef NetStorageClientContext
 * Represents the configuration context required to make NetStorage requests.
 *
 * @property {string} host - The NetStorage API host (e.g., 'example-nsu.akamaihd.net').
 * @property {string} key - The API key used for authentication.
 * @property {string} keyName - The name associated with the API key.
 * @property {boolean} ssl - Whether to use HTTPS (true) or HTTP (false).
 */
export function buildUri(
  context: NetStorageClientContext,
  path: string,
): string {
  const protocol = context.ssl ? 'https' : 'http';
  const base = `${protocol}://${context.host}`;
  const cpCodePrefix = context.cpCode ? `/${context.cpCode}` : '';
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return new URL(`${cpCodePrefix}${normalizedPath}`, base).toString();
}
