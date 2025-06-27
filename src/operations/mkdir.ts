import {
  resolveAbortSignal,
  sendRequest,
  withRetries,
  type RequestOptions,
  type NetStorageClientContext,
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
 * @param ctx - The NetStorage client context.
 * @param params - Parameters including the target path and optional request options.
 * @returns A promise resolving to the mkdir operation response.
 */
export async function mkdir(
  ctx: NetStorageClientContext,
  { path, options }: MkdirParams,
): Promise<NetStorageMkdir> {
  ctx.logger.verbose(path, { method: 'mkdir' });
  return withRetries(ctx, 'mkdir', async () =>
    sendRequest<NetStorageMkdir>(ctx, path, {
      request: { method: 'PUT' },
      headers: { action: 'mkdir' },
      options: {
        signal: resolveAbortSignal(ctx, options),
        ...options,
      },
    }),
  );
}
