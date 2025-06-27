/**
 * Converts a byte value to a human-readable string.
 *
 * @param bytes - Input byte value.
 * @param decimals - Decimal precision (default: 2).
 * @returns Formatted string with units (e.g., "1.23 MB").
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
