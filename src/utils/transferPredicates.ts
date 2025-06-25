import { stat as fsStat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { NetStorageStat } from '@/operations/stat';
import type { NetStorageFile } from '@/types';
import type { NetStorageClientContext } from '@/config/createClientContext';

/**
 * Checks if the remote file metadata is missing.
 * @param ctx Client context containing logger.
 * @param netStorageStat Remote file metadata object.
 * @returns True if remote metadata is missing, otherwise false.
 */
export function isRemoteMissing(
  ctx: NetStorageClientContext,
  netStorageStat?: NetStorageStat,
): boolean {
  const file = netStorageStat?.stat?.file as NetStorageFile;
  if (!file || typeof file !== 'object' || Object.keys(file).length === 0) {
    ctx.logger.info('Remote file metadata is missing or empty.', {
      method: 'isRemoteMissing',
    });
    return true;
  }
  return false;
}

/**
 * Checks if the local file size differs from the remote file size.
 * @param ctx Client context containing logger.
 * @param localPath Absolute path to the local file.
 * @param netStorageStat Remote file metadata object.
 * @returns True if sizes differ or remote size is missing, otherwise false.
 */
export async function isSizeMismatch(
  ctx: NetStorageClientContext,
  localPath: string,
  netStorageStat?: NetStorageStat,
): Promise<boolean> {
  const file = netStorageStat?.stat?.file as NetStorageFile;
  const remoteSize =
    typeof file.size === 'string' ? parseInt(file.size, 10) : file.size;

  if (!remoteSize) {
    ctx.logger.info('Remote size is missing or invalid.', {
      method: 'isSizeMismatch',
    });
    return true;
  }

  const local = await fsStat(localPath);
  const result = local.size !== remoteSize;
  ctx.logger.info(
    `Local size: ${local.size}, Remote size: ${remoteSize}, Mismatch: ${result}`,
    { method: 'isSizeMismatch' },
  );
  return result;
}

/**
 * Checks if the local file modification time is newer than the remote file modification time.
 * @param ctx Client context containing logger.
 * @param localPath Absolute path to the local file.
 * @param netStorageStat Remote file metadata object.
 * @returns True if local mtime is newer, otherwise false.
 */
export async function isMtimeNewer(
  ctx: NetStorageClientContext,
  localPath: string,
  netStorageStat?: NetStorageStat,
): Promise<boolean> {
  const file = netStorageStat?.stat?.file as NetStorageFile;
  const remoteMtime = file.mtime;
  if (!remoteMtime) {
    ctx.logger.info('Remote mtime is missing.', { method: 'isMtimeNewer' });
    return false;
  }

  const local = await fsStat(localPath);
  const remoteTime = new Date(parseInt(remoteMtime, 10) * 1000).getTime();
  const result = local.mtimeMs > remoteTime;
  ctx.logger.info(
    `Local mtime: ${local.mtimeMs}, Remote mtime: ${remoteTime}, Is newer: ${result}`,
    { method: 'isMtimeNewer' },
  );
  return result;
}

/**
 * Compares the local file's MD5 checksum with the remote file's.
 * @param ctx Client context containing logger.
 * @param localPath Absolute path to the local file.
 * @param netStorageStat Remote file metadata object.
 * @returns True if checksums differ or remote checksum is missing, otherwise false.
 */
export async function isChecksumMismatch(
  ctx: NetStorageClientContext,
  localPath: string,
  netStorageStat?: NetStorageStat,
): Promise<boolean> {
  const file = netStorageStat?.stat?.file as NetStorageFile;
  if (!file || !file.md5) {
    ctx.logger.info('Remote MD5 is missing or file is invalid.', {
      method: 'isChecksumMismatch',
    });
    return true;
  }

  const buffer = await readFile(localPath);
  const localChecksum = createHash('md5').update(buffer).digest('hex');

  const result = localChecksum !== file.md5;
  ctx.logger.info(
    `Local MD5: ${localChecksum}, Remote MD5: ${file.md5}, Mismatch: ${result}`,
    { method: 'isChecksumMismatch' },
  );
  return result;
}
