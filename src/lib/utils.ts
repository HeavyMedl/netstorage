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
