import type { NetStorageClientContext } from '../config/createClientContext';
import type { RequestOptions } from '../types';
import { sendRequest } from '../transports/sendRequest';
import { withRetries } from '../utils/withRetries';
import { resolveAbortSignal } from '../utils/resolveAbortSignal';

/**
 * Represents the parsed structure of a NetStorage `du` response.
 *
 * This structure is derived from the XML response returned by the NetStorage
 * `du` operation and reflects disk usage for the specified path.
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
 * @property path - The path to retrieve disk usage information for.
 * @property options - Optional per-request configuration.
 */
export interface DuParams {
  path: string;
  options?: RequestOptions;
}

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
