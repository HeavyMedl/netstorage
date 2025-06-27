import {
  resolveAbortSignal,
  sendRequest,
  withRetries,
  type NetStorageClientContext,
  type NetStorageFile,
  type RequestOptions,
} from '@/index';

/**
 * Represents the result of a NetStorage `stat` response.
 *
 * @property file - Metadata for a file or files if present.
 * @property directory - Path of the directory if applicable.
 */
export interface NetStorageStat {
  stat: {
    file?: NetStorageFile | NetStorageFile[];
    directory?: string;
  };
}

/**
 * Parameters for performing a `stat` operation.
 *
 * @property path - Path to the file or directory to inspect.
 * @property options - Optional request configuration.
 */
export interface StatParams {
  path: string;
  options?: RequestOptions;
}

/**
 * Retrieves metadata for a file or directory in NetStorage.
 *
 * @param ctx - Context including credentials, configuration, and logger.
 * @param params - Object with the target path and optional request options.
 * @returns A promise resolving to file or directory metadata.
 */
export async function stat(
  ctx: NetStorageClientContext,
  { path, options }: StatParams,
): Promise<NetStorageStat> {
  ctx.logger.verbose(path, { method: 'stat' });
  return withRetries(ctx, 'stat', async () =>
    sendRequest<NetStorageStat>(ctx, path, {
      request: { method: 'GET' },
      headers: { action: 'stat' },
      options: {
        signal: resolveAbortSignal(ctx, options),
        ...options,
      },
    }),
  );
}
