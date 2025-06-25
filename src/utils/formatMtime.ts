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
