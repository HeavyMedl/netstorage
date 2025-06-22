import { stat as fsStat } from 'node:fs/promises';

export type FileMetadata = { size?: string | number; mtime?: string };

/**
 * Checks if the remote file metadata is missing.
 * Useful as a reusable predicate for conditional transfer logic.
 * @param remote Remote file metadata object.
 * @returns True if remote metadata is missing, otherwise false.
 */
export function isRemoteMissing(remote?: FileMetadata): boolean {
  return !remote;
}

/**
 * Checks if the local file size differs from the remote file size.
 * Useful as a reusable predicate for conditional transfer logic.
 * @param localPath Absolute path to the local file.
 * @param remote Remote file metadata object.
 * @returns True if sizes differ or remote size is missing, otherwise false.
 */
export async function isSizeMismatch(
  localPath: string,
  remote?: FileMetadata,
): Promise<boolean> {
  if (!remote?.size) return true;
  const local = await fsStat(localPath);
  const remoteSize =
    typeof remote.size === 'string' ? parseInt(remote.size, 10) : remote.size;
  return local.size !== remoteSize;
}

/**
 * Checks if the local file modification time is newer than the remote file modification time.
 * Useful as a reusable predicate for conditional transfer logic.
 * @param localPath Absolute path to the local file.
 * @param remote Remote file metadata object.
 * @returns True if local mtime is newer, otherwise false.
 */
export async function isMtimeNewer(
  localPath: string,
  remote?: FileMetadata,
): Promise<boolean> {
  if (!remote?.mtime) return false;
  const local = await fsStat(localPath);
  const remoteTime = new Date(remote.mtime).getTime();
  return local.mtimeMs > remoteTime;
}
