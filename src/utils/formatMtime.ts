/**
 * Convert a Unix timestamp (in seconds) into a formatted UTC datetime string.
 *
 * @param unixSeconds - Unix timestamp as a number or string.
 * @returns Formatted datetime string in 'YYYY-MM-DD HH:mm:ss' (UTC).
 */
export function formatMtime(unixSeconds: string | number): string {
  const date = new Date(Number(unixSeconds) * 1000);
  return date.toISOString().replace('T', ' ').split('.')[0];
}
