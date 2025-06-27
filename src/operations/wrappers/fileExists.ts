import { stat, HttpError, type NetStorageClientContext } from '@/index';

/**
 * Check if a file exists at the specified NetStorage path.
 *
 * @param ctx - NetStorage client context
 * @param path - Remote file path to verify
 * @returns Promise resolving to true if file exists, false otherwise
 */
export async function fileExists(
  ctx: NetStorageClientContext,
  path: string,
): Promise<boolean> {
  ctx.logger.verbose(path, { method: 'fileExists' });
  try {
    const result = await stat(ctx, { path });
    return Boolean(result?.stat?.file);
  } catch (err) {
    if (err instanceof HttpError && err.code === 404) return false;
    throw err;
  }
}
