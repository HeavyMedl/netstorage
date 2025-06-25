import type { NetStorageClientContext } from '../config/createClientContext';
import type { RequestOptions } from '../types';
import { sendRequest } from '../transports/sendRequest';
import { withRetries } from '../utils/withRetries';
import { resolveAbortSignal } from '../utils/resolveAbortSignal';

/**
 * Represents the parsed response for a NetStorage `mkdir` operation.
 *
 * This structure reflects a simple success status returned from the API.
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
 * Creates a new directory at the specified NetStorage path.
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
