import { stat, HttpError, type NetStorageClientContext } from '@/index';

/**
 * Checks if a file exists at the specified NetStorage path.
 *
 * @param ctx - The NetStorage client context.
 * @param path - The remote file path to check.
 * @returns True if the file exists, false if not.
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
