import {
  resolveAbortSignal,
  sendRequest,
  withRetries,
  type RequestOptions,
  type NetStorageClientConfig,
} from '@/index';

/**
 * Response payload for a successful NetStorage delete operation.
 *
 * @property code - HTTP status code returned by the NetStorage API.
 */
export interface NetStorageRm {
  status: {
    code: number;
  };
}

/**
 * Parameters for the NetStorage `rm` operation.
 *
 * @property path - Remote path of the file to delete.
 * @property options - Optional per-request configuration, including timeout and abort signal.
 */
export interface RmParams {
  path: string;
  options?: RequestOptions;
}

/**
 * Deletes a file from NetStorage at the specified remote path.
 *
 * @param config - The client config used for authentication and configuration.
 * @param params - Object containing the remote path and optional request options.
 * @returns A promise resolving to the NetStorage delete operation response.
 */
export async function rm(
  config: NetStorageClientConfig,
  { path, options }: RmParams,
): Promise<NetStorageRm> {
  config.logger.verbose(path, { method: 'delete' });
  return withRetries(config, 'rm', async () =>
    sendRequest<NetStorageRm>(config, path, {
      request: { method: 'PUT' },
      headers: { action: 'delete' },
      options: {
        signal: resolveAbortSignal(config, options),
        ...options,
      },
    }),
  );
}
