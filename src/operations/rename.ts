import {
  resolveAbortSignal,
  sendRequest,
  withRetries,
  type RequestOptions,
  type NetStorageClientContext,
} from '@/index';

/**
 * Represents the parsed response for a NetStorage `rename` operation.
 *
 * This structure reflects a simple success status returned from the API.
 */
export interface NetStorageRename {
  status: {
    code: number;
  };
}

/**
 * Parameters for the `rename` operation.
 *
 * @property pathFrom - The source path to rename.
 * @property pathTo - The target destination path.
 * @property options - Optional per-request configuration for timeout or cancellation.
 */
export interface RenameParams {
  pathFrom: string;
  pathTo: string;
  options?: RequestOptions;
}

/**
 * Renames a file or directory within NetStorage.
 */
export async function rename(
  ctx: NetStorageClientContext,
  { pathFrom, pathTo, options }: RenameParams,
): Promise<NetStorageRename> {
  ctx.logger.verbose(`from: ${pathFrom}, to: ${pathTo}`, { method: 'rename' });
  return withRetries(ctx, 'rename', async () =>
    sendRequest(ctx, pathFrom, {
      request: { method: 'PUT' },
      headers: {
        action: 'rename',
        destination: pathTo,
      },
      options: {
        signal: resolveAbortSignal(ctx, options),
        ...options,
      },
    }),
  );
}
