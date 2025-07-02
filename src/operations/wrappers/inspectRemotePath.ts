import {
  stat,
  du,
  HttpError,
  type NetStorageClientConfig,
  type NetStorageFile,
  type NetStorageDu,
} from '@/index';

type InspectKind = 'file' | 'directory' | 'any';

/**
 * Inspect a NetStorage path to determine whether it is a file or directory (explicit or implicit).
 *
 * Attempts to `stat` the path first unless kind is explicitly `'directory'`.
 * If `stat` fails with a 404 or if the path is not a file, and kind is not `'file'`,
 * falls back to `du` to determine directory information.
 *
 * @param config - NetStorage client config.
 * @param options - Object with path to inspect and optional kind filter ('file', 'directory', or 'any').
 * @returns An object that may include a `file` (from stat) or `du` (from du), or both if applicable.
 */
export async function inspectRemotePath(
  config: NetStorageClientConfig,
  options: { path: string; kind?: InspectKind },
): Promise<{
  file?: NetStorageFile;
  du?: NetStorageDu;
}> {
  const { path, kind } = options;
  config.logger.verbose(config.uri(path), { method: 'inspectRemotePath' });

  if (kind !== 'directory') {
    try {
      const result = await stat(config, { path });
      const file = (result?.stat as { file: NetStorageFile })?.file;
      if (file?.type === 'file') return { file };
    } catch (err) {
      if (!(err instanceof HttpError && err.code === 404)) throw err;
      if (kind === 'file') return {};
    }
  }

  if (kind !== 'file') {
    try {
      const result = await du(config, { path });
      return { du: result };
    } catch (err) {
      if (!(err instanceof HttpError && err.code === 404)) throw err;
    }
  }
  return {};
}

/**
 * Convenience wrapper to determine if a NetStorage path is a file.
 *
 * @param config - NetStorage client config
 * @param path - Remote file path to check
 * @returns True if path is a file, false otherwise
 */
export async function isFile(
  config: NetStorageClientConfig,
  path: string,
): Promise<boolean> {
  const result = await inspectRemotePath(config, { path, kind: 'file' });
  return result?.file?.type === 'file';
}

/**
 * Convenience wrapper to determine if a NetStorage path is a directory.
 *
 * @param config - NetStorage client config
 * @param path - Remote directory path to check
 * @returns True if path is a directory, false otherwise
 */
export async function isDirectory(
  config: NetStorageClientConfig,
  path: string,
): Promise<boolean> {
  const result = await inspectRemotePath(config, {
    path,
    kind: 'directory',
  });
  return Boolean(result?.du?.du?.directory);
}
