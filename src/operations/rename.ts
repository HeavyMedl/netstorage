import {
  resolveAbortSignal,
  sendRequest,
  withRetries,
  type RequestOptions,
  type NetStorageClientConfig,
} from '@/index';

/**
 * Parsed response returned from a NetStorage rename operation.
 *
 * @property code - HTTP-style status code indicating the result of the rename operation.
 */
export interface NetStorageRename {
  status: {
    code: number;
  };
}

/**
 * Parameters required to perform a rename operation.
 *
 * @property pathFrom - Full path of the source file or directory.
 * @property pathTo - Full destination path for the renamed file or directory.
 * @property options - Optional request-level configuration (e.g., timeout, abort signal).
 */
export interface RenameParams {
  pathFrom: string;
  pathTo: string;
  options?: RequestOptions;
}

/**
 * Renames a file or directory within NetStorage.
 *
 * Performs a PUT request with the `rename` action and destination path.
 *
 * @param config - NetStorage client config with credentials and configuration.
 * @param param1 - Object containing rename parameters.
 * @returns A promise resolving to a parsed NetStorageRename result.
 */
export async function rename(
  config: NetStorageClientConfig,
  { pathFrom, pathTo, options }: RenameParams,
): Promise<NetStorageRename> {
  config.logger.verbose(`from: ${pathFrom}, to: ${pathTo}`, {
    method: 'rename',
  });
  return withRetries(config, 'rename', async () =>
    sendRequest(config, pathFrom, {
      request: { method: 'PUT' },
      headers: {
        action: 'rename',
        destination: pathTo,
      },
      options: {
        signal: resolveAbortSignal(config, options),
        ...options,
      },
    }),
  );
}
