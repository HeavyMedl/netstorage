import type { NetStorageClientContext } from '@/config/createClientContext';
import type { NetStorageFile, RequestOptions } from '@/types/shared';
import { sendRequest } from '@/transports/sendRequest';
import { withRetries } from '@/utils/withRetries';
import { resolveAbortSignal } from '@/utils/resolveAbortSignal';

/**
 * Represents the parsed structure of a NetStorage `dir` response.
 *
 * This structure reflects the directory listing returned by NetStorage,
 * which includes an optional directory name and an array of file entries.
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
 * Lists the contents of a directory at the specified path.
 */
export async function dir(
  ctx: NetStorageClientContext,
  { path, options }: DirParams,
): Promise<NetStorageDir> {
  ctx.logger.verbose(path, { method: 'dir' });
  return withRetries(ctx, 'dir', async () =>
    sendRequest<NetStorageDir>(ctx, path, {
      request: { method: 'GET' },
      headers: { action: 'dir' },
      options: {
        signal: resolveAbortSignal(ctx, options),
        ...options,
      },
    }),
  );
}
