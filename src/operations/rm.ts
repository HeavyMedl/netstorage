import {
  resolveAbortSignal,
  sendRequest,
  withRetries,
  type RequestOptions,
  type NetStorageClientContext,
} from '@/index';

/**
 * Response payload for a successful NetStorage delete operation.
 *
 * @property code - HTTP status code returned by the NetStorage API.
 */
export interface NetStorageRm {
  status: {
    code: number;
  };
}

/**
 * Parameters for the NetStorage `rm` operation.
 *
 * @property path - Remote path of the file to delete.
 * @property options - Optional per-request configuration, including timeout and abort signal.
 */
export interface RmParams {
  path: string;
  options?: RequestOptions;
}

/**
 * Deletes a file from NetStorage at the specified remote path.
 *
 * @param ctx - The client context used for authentication and configuration.
 * @param params - Object containing the remote path and optional request options.
 * @returns A promise resolving to the NetStorage delete operation response.
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
