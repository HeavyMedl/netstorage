import { stat, HttpError, type NetStorageClientConfig } from '@/index';

/**
 * Check if a file exists at the specified NetStorage path.
 *
 * @param config - NetStorage client config
 * @param path - Remote file path to verify
 * @returns Promise resolving to true if file exists, false otherwise
 */
export async function isFile(
  config: NetStorageClientConfig,
  path: string,
): Promise<boolean> {
  config.logger.verbose(config.uri(path), { method: 'fileExists' });
  try {
    const result = await stat(config, { path });
    return Boolean(result?.stat?.file);
  } catch (err) {
    if (err instanceof HttpError && err.code === 404) return false;
    throw err;
  }
}
