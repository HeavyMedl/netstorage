import { name as packageName } from '../../package.json';

/**
 * Configuration required to authenticate with NetStorage.
 *
 * @property {string} key - The API key used for authentication.
 * @property {string} keyName - The name associated with the API key.
 * @property {string} host - The NetStorage hostname (without protocol).
 * @property {boolean} [ssl] - Whether to use SSL (HTTPS). Defaults to false.
 */
/**
 * Optional CP code to inform remote path construction (e.g., /123456/...)
 * @property {string} [cpCode]
 */
export interface NetStorageAuthConfig {
  key: string;
  keyName: string;
  host: string;
  ssl?: boolean;
  cpCode?: string;
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

/**
 * Validates and returns a normalized NetStorage authentication config.
 *
 * @param {NetStorageAuthConfig} params - The input configuration object.
 * @returns {NetStorageAuthConfig} The validated and normalized config.
 */
export function createAuthConfig(
  params: NetStorageAuthConfig,
): NetStorageAuthConfig {
  const { key, keyName, host, cpCode, ssl = false } = params;

  assertNonEmpty(key, 'key');
  assertNonEmpty(keyName, 'keyName');
  assertNonEmpty(host, 'host');

  return {
    key,
    keyName,
    host,
    ssl,
    cpCode,
  };
}
