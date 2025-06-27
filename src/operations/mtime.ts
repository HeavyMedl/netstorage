import {
  resolveAbortSignal,
  sendRequest,
  withRetries,
  type RequestOptions,
  type NetStorageClientContext,
} from '@/index';

/**
 * Represents the parsed response for a NetStorage `mtime` operation.
 *
 * This structure reflects a simple success status returned from the API.
 */
export interface NetStorageMtime {
  status: {
    code: number;
  };
}

/**
 * Parameters for the `mtime` operation.
 *
 * @property path - Target path of the file or directory.
 * @property date - New modification date.
 * @property options - Optional per-request configuration.
 */
export interface MtimeParams {
  path: string;
  date: Date;
  options?: RequestOptions;
}

/**
 * Updates the modification time of a file or directory.
 *
 * @param ctx - The NetStorage client context.
 * @param params - Parameters including target path, date, and optional request settings.
 * @returns Parsed object structure of a NetStorage XML API response.
 * @throws {TypeError} If the provided date is not a valid Date instance.
 */
export async function mtime(
  ctx: NetStorageClientContext,
  { path, date, options }: MtimeParams,
): Promise<NetStorageMtime> {
  if (!(date instanceof Date)) {
    throw new TypeError('The date has to be an instance of Date');
  }

  ctx.logger.verbose(`${path}, date: ${date.toISOString()}`, {
    method: 'mtime',
  });

  return withRetries(ctx, 'mtime', async () =>
    sendRequest(ctx, path, {
      request: { method: 'PUT' },
      headers: {
        action: 'mtime',
        mtime: Math.floor(date.getTime() / 1000).toString(),
      },
      options: {
        signal: resolveAbortSignal(ctx, options),
        ...options,
      },
    }),
  );
}
