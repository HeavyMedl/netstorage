import {
  resolveAbortSignal,
  sendRequest,
  withRetries,
  type RequestOptions,
  type NetStorageClientContext,
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
 * @param ctx - NetStorage client context containing credentials and settings.
 * @param params - Disk usage request parameters.
 * @returns A parsed object representing total files and bytes at the path.
 */
export async function du(
  ctx: NetStorageClientContext,
  { path, options }: DuParams,
): Promise<NetStorageDu> {
  ctx.logger.verbose(path, { method: 'du' });
  return withRetries(ctx, 'du', async () =>
    sendRequest<NetStorageDu>(ctx, path, {
      request: { method: 'GET' },
      headers: { action: 'du' },
      options: {
        signal: resolveAbortSignal(ctx, options),
        ...options,
      },
    }),
  );
}
