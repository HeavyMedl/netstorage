import type { NetStorageClientContext } from '@/config/createClientContext';
import type { RequestOptions } from '@/types/shared';
import { withRetries } from '@/utils/withRetries';
import { sendRequest } from '@/transports/sendRequest';
import { resolveAbortSignal } from '@/utils/resolveAbortSignal';

/**
 * Represents the parsed response for a NetStorage `symlink` operation.
 */
export interface NetStorageSymlink {
  status: {
    code: number;
  };
}

/**
 * Parameters for the `symlink` operation.
 *
 * @property pathFileTo - The target file path the symlink should point to.
 * @property pathSymlink - The path where the symbolic link will be created.
 * @property options - Optional per-request configuration for timeout or cancellation.
 */
export interface SymlinkParams {
  pathFileTo: string;
  pathSymlink: string;
  options?: RequestOptions;
}

/**
 * Creates a symbolic link in NetStorage.
 */
export async function symlink(
  ctx: NetStorageClientContext,
  { pathFileTo, pathSymlink, options }: SymlinkParams,
): Promise<NetStorageSymlink> {
  ctx.logger.verbose(`fileTo: ${pathFileTo}, symlink: ${pathSymlink}`, {
    method: 'symlink',
  });

  return withRetries(ctx, 'symlink', async () =>
    sendRequest<NetStorageSymlink>(ctx, pathSymlink, {
      request: { method: 'PUT' },
      headers: {
        action: 'symlink',
        target: pathFileTo,
      },
      options: {
        signal: resolveAbortSignal(ctx, options),
        ...options,
      },
    }),
  );
}
