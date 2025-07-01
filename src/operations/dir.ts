import {
  resolveAbortSignal,
  sendRequest,
  withRetries,
  type RequestOptions,
  type NetStorageClientConfig,
  type NetStorageFile,
} from '@/index';

/**
 * Represents the parsed structure of a NetStorage `dir` response.
 *
 * @property stat - Contains optional directory name and an array of file entries.
 */
export interface NetStorageDir {
  stat: {
    directory?: string;
    file?: NetStorageFile[];
  };
}

/**
 * Parameters for the `dir` operation.
 *
 * @property path - The path of the directory to list.
 * @property options - Optional per-request configuration.
 */
export interface DirParams {
  path: string;
  options?: RequestOptions;
}

/**
 * Lists the contents of a NetStorage directory.
 *
 * Sends a `dir` request to the specified path and returns the directory structure,
 * including files and optional directory metadata.
 *
 * @param config - The NetStorage client config containing configuration and logger.
 * @param params - The parameters for the request, including path and options.
 * @returns A promise that resolves to the parsed directory structure.
 */
export async function dir(
  config: NetStorageClientConfig,
  { path, options }: DirParams,
): Promise<NetStorageDir> {
  config.logger.verbose(config.uri(path), { method: 'dir' });
  return withRetries(config, 'dir', async () =>
    sendRequest<NetStorageDir>(config, path, {
      request: { method: 'GET' },
      headers: { action: 'dir' },
      options: {
        signal: resolveAbortSignal(config, options),
        ...options,
      },
    }),
  );
}
