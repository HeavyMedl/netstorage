import {
  resolveAbortSignal,
  sendRequest,
  withRetries,
  type RequestOptions,
  type NetStorageClientConfig,
} from '@/index';

/**
 * Represents the parsed structure of a NetStorage `du` (disk usage) response.
 *
 * @property du - Top-level DU response wrapper.
 * @property du.du-info - Disk usage details including file and byte counts.
 * @property du.du-info.files - Total number of files.
 * @property du.du-info.bytes - Total number of bytes.
 * @property du.directory - Path of the directory reported in the DU response.
 */
export interface NetStorageDu {
  du: {
    'du-info': {
      files: string;
      bytes: string;
    };
    directory: string;
  };
}

/**
 * Parameters for the `du` operation.
 *
 * @property path - The remote NetStorage path to retrieve disk usage for.
 * @property options - Optional configuration for the request.
 */
export interface DuParams {
  path: string;
  options?: RequestOptions;
}

/**
 * Retrieves disk usage information for a given NetStorage path.
 *
 * @param config - NetStorage client config containing credentials and settings.
 * @param params - Disk usage request parameters.
 * @returns A parsed object representing total files and bytes at the path.
 */
export async function du(
  config: NetStorageClientConfig,
  { path, options }: DuParams,
): Promise<NetStorageDu> {
  config.logger.verbose(config.uri(path), { method: 'du' });
  return withRetries(config, 'du', async () =>
    sendRequest<NetStorageDu>(config, path, {
      request: { method: 'GET' },
      headers: { action: 'du' },
      options: {
        signal: resolveAbortSignal(config, options),
        ...options,
      },
    }),
  );
}
