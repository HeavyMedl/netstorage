import type { NetStorageClientContext } from '@/config/createClientContext';
import type { NetStorageFile, RequestOptions } from '@/types';
import { sendRequest } from '@/transports/sendRequest';
import { withRetries } from '@/utils/withRetries';
import { resolveAbortSignal } from '@/utils/resolveAbortSignal';

/**
 * Represents the parsed structure of a NetStorage `stat` response.
 *
 * This structure is derived from the XML response returned by the NetStorage
 * `stat` operation and reflects the presence of file and/or directory metadata.
 *
 * @property stat.file - Optional metadata describing the file.
 * @property stat.directory - Optional directory path returned in the stat response.
 */
export interface NetStorageStat {
  stat: {
    file?: NetStorageFile | NetStorageFile[];
    directory?: string;
  };
}

/**
 * Parameters for the `stat` operation.
 *
 * @property path - The path of the file or directory to retrieve metadata for.
 * @property options - Optional per-request configuration for timeout or cancellation.
 */
export interface StatParams {
  path: string;
  options?: RequestOptions;
}

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
