import type { NetStorageClientConfig } from '@/index';

/**
 * @typedef NetStorageClientconfig
 * Represents the configuration config required to make NetStorage requests.
 *
 * @property {string} host - The NetStorage API host (e.g., 'example-nsu.akamaihd.net').
 * @property {string} key - The API key used for authentication.
 * @property {string} keyName - The name associated with the API key.
 * @property {boolean} ssl - Whether to use HTTPS (true) or HTTP (false).
 */
export function buildUri(config: NetStorageClientConfig, path: string): string {
  const protocol = config.ssl ? 'https' : 'http';
  const base = `${protocol}://${config.host}`;
  const cpCodePrefix = config.cpCode ? `/${config.cpCode}` : '';
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return new URL(`${cpCodePrefix}${normalizedPath}`, base).toString();
}
