import path from 'node:path';
import micromatch from 'micromatch';
import klaw from 'klaw';

/**
 * Represents an entry encountered while walking a local directory.
 *
 * @property localPath - Absolute path to the file or directory on disk.
 * @property relativePath - Path relative to the root of the traversal.
 * @property isDirectory - True if the entry is a directory.
 */
export interface LocalWalkEntry {
  localPath: string;
  relativePath: string;
  isDirectory: boolean;
}

/**
 * Options for walking a local directory tree.
 *
 * @property ignore - Optional glob patterns to exclude files or directories.
 * @property followSymlinks - Whether to follow symbolic links during traversal.
 * @property includeDirs - Whether to yield directory entries as well as files.
 * @property onEnterDir - Optional callback invoked when entering a new directory.
 */
export interface WalkLocalOptions {
  ignore?: string[];
  followSymlinks?: boolean;
  includeDirs?: boolean;
  onEnterDir?: (dirPath: string, relativePath: string) => void;
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
