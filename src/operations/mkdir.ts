import {
  resolveAbortSignal,
  sendRequest,
  withRetries,
  type RequestOptions,
  type NetStorageClientConfig,
} from '@/index';

/**
 * Response shape for a NetStorage `mkdir` operation.
 *
 * @property status - The status object containing a numeric status code.
 */
export interface NetStorageMkdir {
  status: {
    code: number;
  };
}

/**
 * Parameters for the `mkdir` operation.
 *
 * @property path - The full path where the new directory should be created.
 * @property options - Optional per-request configuration for timeout or cancellation.
 */
export interface MkdirParams {
  path: string;
  options?: RequestOptions;
}

/**
 * Creates a new directory on NetStorage at the specified path.
 *
 * @param config - The NetStorage client config.
 * @param params - Parameters including the target path and optional request options.
 * @returns A promise resolving to the mkdir operation response.
 */
export async function mkdir(
  config: NetStorageClientConfig,
  { path, options }: MkdirParams,
): Promise<NetStorageMkdir> {
  config.logger.verbose(config.uri(path), { method: 'mkdir' });
  return withRetries(config, 'mkdir', async () =>
    sendRequest<NetStorageMkdir>(config, path, {
      request: { method: 'PUT' },
      headers: { action: 'mkdir' },
      options: {
        signal: resolveAbortSignal(config, options),
        ...options,
      },
    }),
  );
}
