import {
  resolveAbortSignal,
  sendRequest,
  withRetries,
  type RequestOptions,
  type NetStorageClientConfig,
} from '@/index';

/**
 * Response shape for a NetStorage `rmdir` request.
 *
 * @property {Object} status - Status metadata of the response.
 * @property {number} status.code - Status code returned by the API.
 */
export interface NetStorageRmdir {
  status: {
    code: number;
  };
}

/**
 * Parameters for the NetStorage `rmdir` operation.
 *
 * @property {string} path - Path to the NetStorage directory to remove.
 * @property {RequestOptions} [options] - Optional request configuration.
 */
export interface RmdirParams {
  path: string;
  options?: RequestOptions;
}

/**
 * Sends a request to remove a directory from NetStorage.
 *
 * @param {NetStorageClientConfig} config - Client configuration and logger.
 * @param {RmdirParams} param1 - Object containing the directory path and options.
 * @returns {Promise<NetStorageRmdir>} Parsed response from NetStorage.
 */
export async function rmdir(
  config: NetStorageClientConfig,
  { path, options }: RmdirParams,
): Promise<NetStorageRmdir> {
  config.logger.verbose(config.uri(path), { method: 'rmdir' });
  return withRetries(config, 'rmdir', async () =>
    sendRequest<NetStorageRmdir>(config, path, {
      request: { method: 'PUT' },
      headers: { action: 'rmdir' },
      options: {
        signal: resolveAbortSignal(config, options),
        ...options,
      },
    }),
  );
}
