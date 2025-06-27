import {
  resolveAbortSignal,
  sendRequest,
  withRetries,
  type RequestOptions,
  type NetStorageClientContext,
  type NetStorageFile,
} from '@/index';

/**
 * Represents the parsed structure of a NetStorage `dir` response.
 *
 * @property stat - Contains optional directory name and an array of file entries.
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
 * Lists the contents of a NetStorage directory.
 *
 * Sends a `dir` request to the specified path and returns the directory structure,
 * including files and optional directory metadata.
 *
 * @param ctx - The NetStorage client context containing configuration and logger.
 * @param params - The parameters for the request, including path and options.
 * @returns A promise that resolves to the parsed directory structure.
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
