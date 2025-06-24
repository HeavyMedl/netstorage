import path from 'node:path';
import klaw from 'klaw';
import micromatch from 'micromatch';
import type { WalkLocalOptions } from '../types';
import { name as packageName } from '../../package.json';

/**
 * Converts a byte size into a human-readable string with appropriate units.
 *
 * @param bytes - The number of bytes.
 * @param decimals - Number of decimal places to include (default is 2).
 * @returns A formatted string like '1.23 MB' or '456 B'.
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = parseFloat((bytes / Math.pow(k, i)).toFixed(dm));
  return `${size} ${sizes[i]}`;
}
/**
 * Formats a Unix timestamp (in seconds) into a human-readable datetime string.
 *
 * @param unixSeconds - The Unix timestamp in seconds.
 * @returns A string like '2025-06-21 14:32:10'.
 */
export function formatMtime(unixSeconds: string | number): string {
  const date = new Date(Number(unixSeconds) * 1000);
  return date.toISOString().replace('T', ' ').split('.')[0];
}

/**
 * Recursively walks a local directory and yields files (and optionally directories).
 *
 * @param root - The root directory to start walking from.
 * @param options - Options to control filtering and traversal behavior.
 * @returns An async generator yielding each matched file or directory entry.
 */
export async function* walkLocalDir(
  root: string,
  {
    ignore = [],
    followSymlinks = false,
    includeDirs = false,
    onEnterDir,
  }: WalkLocalOptions = {},
): AsyncGenerator<{
  localPath: string;
  relativePath: string;
  isDirectory: boolean;
}> {
  const seen = new Set<string>();
  const rootAbs = path.resolve(root);

  const walker = klaw(rootAbs, { preserveSymlinks: !followSymlinks });

  for await (const item of walker) {
    const relative = path.relative(rootAbs, item.path);
    if (relative === '') continue; // skip root

    if (ignore.length && micromatch.some(relative, ignore)) continue;

    const stat = item.stats;
    const isDir = stat.isDirectory();
    const isSym = stat.isSymbolicLink?.();

    if (isDir && onEnterDir) {
      onEnterDir(item.path, relative);
    }

    if (isDir && !includeDirs) continue;

    if (isSym && !followSymlinks) continue;

    if (seen.has(item.path)) continue;
    seen.add(item.path);

    yield {
      localPath: item.path,
      relativePath: relative,
      isDirectory: isDir,
    };
  }
}

/**
 * Asserts that a given string is non-empty and not just whitespace.
 *
 * @param {string} value - The value to validate.
 * @param {string} name - The name of the value, used in error messages.
 * @throws {TypeError} If the value is not a non-empty string.
 */
export function assertNonEmpty(value: string, name: string): void {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(
      `[${packageName}]: Missing or invalid \`${name}\` in configuration`,
    );
  }
}
