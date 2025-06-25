import type { NetStorageClientContext } from '../config/createClientContext';
import type { RequestOptions } from '../types';
import { withRetries } from '../utils/withRetries';
import { sendRequest } from '../transports/sendRequest';
import { resolveAbortSignal } from '../utils/resolveAbortSignal';

/**
 * Represents the parsed response for a NetStorage `delete` operation.
 */
export interface NetStorageRm {
  status: {
    code: number;
  };
}

/**
 * Parameters for the `delete` operation.
 *
 * @property path - The remote path of the file to delete.
 * @property options - Optional per-request configuration for timeout or cancellation.
 */
export interface RmParams {
  path: string;
  options?: RequestOptions;
}

/**
 * Deletes a file at the specified path.
 */
export async function rm(
  ctx: NetStorageClientContext,
  { path, options }: RmParams,
): Promise<NetStorageRm> {
  ctx.logger.verbose(path, { method: 'delete' });
  return withRetries(ctx, 'rm', async () =>
    sendRequest<NetStorageRm>(ctx, path, {
      request: { method: 'PUT' },
      headers: { action: 'delete' },
      options: {
        signal: resolveAbortSignal(ctx, options),
        ...options,
      },
    }),
  );
}
