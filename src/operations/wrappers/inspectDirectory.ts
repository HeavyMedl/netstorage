import { du, HttpError, type NetStorageClientConfig } from '@/index';

/**
 * Metadata about a remote NetStorage directory.
 *
 * @property exists - True if the directory exists on NetStorage.
 * @property isEmpty - True if the directory contains no files (empty or implicit).
 * @property fileCount - Total number of files reported by the `du` API.
 * @property byteCount - Total size in bytes reported by the `du` API.
 * @property path - Remote path of the inspected directory.
 */
export interface DirectoryInfo {
  exists: boolean;
  isEmpty: boolean;
  fileCount: number;
  byteCount: number;
  path: string;
}

/**
 * Retrieves metadata about a directory from NetStorage.
 *
 * Uses the `du` (disk usage) API to determine if the directory exists and whether it is empty.
 * An empty directory is defined as having only 1 entry (the directory itself) and 0 bytes.
 *
 * @param config - NetStorage client config containing credentials and settings.
 * @param path - Remote directory path to inspect.
 * @returns A `DirectoryInfo` object describing the directory's existence and contents.
 */
export async function getDirectoryInfo(
  config: NetStorageClientConfig,
  path: string,
): Promise<DirectoryInfo> {
  config.logger.verbose(path, { method: 'getDirectoryInfo' });
  try {
    const result = await du(config, { path });
    const files = parseInt(result.du?.['du-info']?.files ?? '0', 10);
    const bytes = parseInt(result.du?.['du-info']?.bytes ?? '0', 10);
    return {
      exists: true,
      isEmpty: files <= 1 && bytes === 0,
      fileCount: files,
      byteCount: bytes,
      path: result.du.directory,
    };
  } catch (err) {
    if (err instanceof HttpError && err.code === 404) {
      return {
        exists: false,
        isEmpty: false,
        fileCount: 0,
        byteCount: 0,
        path,
      };
    }
    throw err;
  }
}

/**
 * Determines if a given path exists as a directory on NetStorage.
 *
 * @param config - NetStorage client config.
 * @param path - Remote path to verify.
 * @returns Promise resolving to `true` if the directory exists, otherwise `false`.
 */
export async function isDirectory(
  config: NetStorageClientConfig,
  path: string,
): Promise<boolean> {
  const info = await getDirectoryInfo(config, path);
  return info.exists;
}

/**
 * Determines if a given directory path exists and is empty.
 *
 * A directory is considered empty if it contains no files and reports 0 bytes.
 *
 * @param config - NetStorage client config.
 * @param path - Remote directory path to verify.
 * @returns Promise resolving to `true` if the directory exists and is empty, otherwise `false`.
 */
export async function isEmptyDirectory(
  config: NetStorageClientConfig,
  path: string,
): Promise<boolean> {
  const info = await getDirectoryInfo(config, path);
  return info.exists && info.isEmpty;
}
