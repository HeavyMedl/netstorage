import { name as packageName } from '../../package.json';

export interface NetStorageAuthConfig {
  key: string;
  keyName: string;
  host: string;
  ssl?: boolean;
}

/**
 * Asserts that a given string is non-empty and not just whitespace.
 *
 * @param {string} value - The value to validate.
 * @param {string} name - The name of the value, used in error messages.
 * @throws {TypeError} If the value is not a non-empty string.
 */
function assertNonEmpty(value: string, name: string): void {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(
      `[${packageName}]: Missing or invalid \`${name}\` in configuration`,
    );
  }
}

export function createAuthConfig(
  params: NetStorageAuthConfig,
): NetStorageAuthConfig {
  const { key, keyName, host, ssl = false } = params;

  assertNonEmpty(key, 'key');
  assertNonEmpty(keyName, 'keyName');
  assertNonEmpty(host, 'host');

  return {
    key,
    keyName,
    host,
    ssl,
  };
}
