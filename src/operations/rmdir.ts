import {
  resolveAbortSignal,
  sendRequest,
  withRetries,
  type RequestOptions,
  type NetStorageClientContext,
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
 * @param {NetStorageClientContext} ctx - Client configuration and logger.
 * @param {RmdirParams} param1 - Object containing the directory path and options.
 * @returns {Promise<NetStorageRmdir>} Parsed response from NetStorage.
 */
export async function rmdir(
  ctx: NetStorageClientContext,
  { path, options }: RmdirParams,
): Promise<NetStorageRmdir> {
  ctx.logger.verbose(path, { method: 'rmdir' });
  return withRetries(ctx, 'rmdir', async () =>
    sendRequest<NetStorageRmdir>(ctx, path, {
      request: { method: 'PUT' },
      headers: { action: 'rmdir' },
      options: {
        signal: resolveAbortSignal(ctx, options),
        ...options,
      },
    }),
  );
}
