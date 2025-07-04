import fs from 'node:fs';
import path from 'node:path';

import { createConfig, type NetStorageClientConfig } from '@/index';

import { loadPersistentConfig } from './configStore';

/**
 * Loads project-level NetStorage configuration from `netstorage.json` in the current working directory.
 *
 * @returns {Promise<Partial<NetStorageClientConfig>>} Parsed config object or an empty object if not found.
 */
async function loadFileConfig(): Promise<Partial<NetStorageClientConfig>> {
  const fallbackFiles = ['netstorage.json'];
  for (const file of fallbackFiles) {
    const fullPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      const raw = fs.readFileSync(fullPath, 'utf-8');
      return JSON.parse(raw);
    }
  }

  return {};
}

/**
 * Removes any properties from the given object that have an undefined value.
 *
 * @example
 * const input = { foo: 'bar', baz: undefined };
 * const output = removeUndefined(input);
 * // output is { foo: 'bar' }
 *
 * @param obj The object to filter.
 * @returns A new object missing any properties with undefined values from the input object.
 */
function removeUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

/**
 * Resolves a complete NetStorage client config from layered configuration sources.
 *
 * Resolution order (highest to lowest priority):
 * 1. CLI options (explicit flags passed to CLI command)
 * 2. Environment variables (NETSTORAGE_* keys)
 * 3. Project-level config file (`netstorage.json` in the current directory)
 * 4. Persistent config (`~/.config/netstorage/.netstorage.json`)
 *
 * @param {Partial<NetStorageClientConfig>} [cliOptions] - Optional config overrides from CLI flags.
 * @returns {Promise<NetStorageClientConfig>} Fully resolved configuration object.
 */
export async function loadClientConfig(
  cliOptions: Partial<NetStorageClientConfig> = {},
): Promise<NetStorageClientConfig> {
  const envConfig: Partial<NetStorageClientConfig> = {
    key: process.env.NETSTORAGE_API_KEY,
    keyName: process.env.NETSTORAGE_API_KEYNAME,
    host: process.env.NETSTORAGE_HOST,
    ssl: process.env.NETSTORAGE_SSL === 'true',
    cpCode: process.env.NETSTORAGE_CP_CODE,
  };
  const fileConfig = await loadFileConfig();
  const persistentConfig = loadPersistentConfig();

  // Merge: CLI > Env > File > Persistent
  const merged: Partial<NetStorageClientConfig> = {
    ...removeUndefined(persistentConfig),
    ...removeUndefined(fileConfig),
    ...removeUndefined(envConfig),
    ...removeUndefined(cliOptions),
  };

  return createConfig(merged as NetStorageClientConfig);
}
