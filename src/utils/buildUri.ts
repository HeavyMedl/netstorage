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
  const url = new URL(`${protocol}://${config.host}`);

  const segments = [];
  if (config.cpCode) segments.push(config.cpCode);
  if (path) segments.push(path.replace(/^\/+/, ''));

  url.pathname = segments.join('/');

  if (url.pathname !== '/') {
    url.pathname = url.pathname.replace(/\/$/, '');
  }

  return url.toString();
}
