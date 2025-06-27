import type { NetStorageClientContext } from '@/config/createClientContext';
import type { RequestOptions } from '@/types/shared';
import { sendRequest } from '@/transports/sendRequest';
import { withRetries } from '@/utils/withRetries';
import { resolveAbortSignal } from '@/utils/resolveAbortSignal';

/**
 * Represents the parsed response for a NetStorage `rmdir` operation.
 *
 * This structure reflects a simple status code returned by the API.
 */
export interface NetStorageRmdir {
  status: {
    code: number;
  };
}

/**
 * Parameters for the `rmdir` operation.
 */
export interface RmdirParams {
  path: string;
  options?: RequestOptions;
}

/**
 * Removes a directory at the specified NetStorage path.
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
