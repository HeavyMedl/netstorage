/**
 * Generates a concise pseudo-random string identifier.
 *
 * Combines random bits and the current process ID to minimize collisions.
 *
 * @returns {string} Unique string identifier.
 */
export function generateUniqueId(): string {
  let str = '';
  let r = 0;
  for (let i = 0; i < 6; i++) {
    if ((i & 0x03) === 0) r = Math.random() * 0x100000000;
    str += ((r >>> ((i & 0x03) << 3)) & 0xff).toString();
  }
  return str + process.pid;
}
