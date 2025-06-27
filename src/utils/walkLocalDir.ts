import path from 'node:path';
import micromatch from 'micromatch';
import klaw from 'klaw';

/**
 * Represents a file or directory encountered during traversal.
 *
 * @property {string} localPath - Absolute path to the file or directory.
 * @property {string} relativePath - Path relative to the traversal root.
 * @property {boolean} isDirectory - Indicates if the entry is a directory.
 */
export interface LocalWalkEntry {
  localPath: string;
  relativePath: string;
  isDirectory: boolean;
}

/**
 * Configuration options for walking a local directory tree.
 *
 * @property {string[]} [ignore] - Glob patterns to exclude during traversal.
 * @property {boolean} [followSymlinks] - Follow symbolic links if true.
 * @property {boolean} [includeDirs] - Yield directory entries if true.
 * @property {(dirPath: string, relativePath: string) => void} [onEnterDir] - Callback when entering a directory.
 */
export interface WalkLocalOptions {
  ignore?: string[];
  followSymlinks?: boolean;
  includeDirs?: boolean;
  onEnterDir?: (dirPath: string, relativePath: string) => void;
}

/**
 * Recursively walks a local directory tree, yielding files and optionally directories.
 *
 * @param {string} root - Root directory to begin traversal.
 * @param {WalkLocalOptions} [options] - Options to configure traversal behavior.
 * @returns {AsyncGenerator<LocalWalkEntry>} Yields matching file and directory entries.
 */
export async function* walkLocalDir(
  root: string,
  {
    ignore = [],
    followSymlinks = false,
    includeDirs = false,
    onEnterDir,
  }: WalkLocalOptions = {},
): AsyncGenerator<LocalWalkEntry> {
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
