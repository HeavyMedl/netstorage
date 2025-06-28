import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import dotenv from 'dotenv';

import { createConfig, type NetStorageClientConfig } from '@/index';

import { loadPersistentConfig } from './configStore';

/**
 * Attempts to load CLI configuration from supported config files in the current working directory.
 *
 * Resolution order:
 * 1. netstorage.config.ts (must export a default object)
 * 2. netstorage.config.json
 * 3. .netstoragerc
 *
 * @returns {Promise<Partial<NetStorageClientConfig>>} Parsed config object or an empty object if none found.
 */
async function loadFileConfig(): Promise<Partial<NetStorageClientConfig>> {
  const tsConfigPath = path.resolve(process.cwd(), 'netstorage.config.ts');
  if (fs.existsSync(tsConfigPath)) {
    try {
      const mod = await import(pathToFileURL(tsConfigPath).href);
      if (mod.default && typeof mod.default === 'object') {
        return mod.default;
      }
    } catch (err) {
      console.warn('Failed to load netstorage.config.ts', err);
    }
  }

  const fallbackFiles = ['netstorage.config.json', '.netstoragerc'];
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
 * Resolves a complete NetStorage client config from layered configuration sources.
 *
 * Supported resolution order (highest to lowest priority):
 * 1. CLI options (explicit flags passed to CLI command)
 * 2. Environment variables from `.env` in current working directory (if present)
 * 3. Local config file (netstorage.config.ts, netstorage.config.json, or .netstoragerc)
 * 4. Persistent config in ~/.config/netstorage/config.json
 *
 * All layers are merged, with higher-priority values overriding lower-priority ones.
 *
 * @param {Partial<NetStorageClientConfig>} [cliOptions] - Optional config overrides from CLI flags.
 * @returns {Promise<NetStorageClientConfig>} Fully resolved configuration object.
 */
export async function loadClientConfig(
  cliOptions: Partial<NetStorageClientConfig> = {},
): Promise<NetStorageClientConfig> {
  // Load environment variables from .env file if it exists
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }

  const envConfig: Partial<NetStorageClientConfig> = {
    key: process.env.NETSTORAGE_API_KEY,
    keyName: process.env.NETSTORAGE_API_KEYNAME,
    host: process.env.NETSTORAGE_HOST,
    ssl: process.env.NETSTORAGE_SSL === 'true',
    cpCode: process.env.NETSTORAGE_CP_CODE,
  };

  const fileConfig = await loadFileConfig();

  // Load persistent CLI config
  const persistentConfig = loadPersistentConfig();

  // Merge: CLI > Env > File > Persistent
  const merged: Partial<NetStorageClientConfig> = {
    ...persistentConfig,
    ...fileConfig,
    ...envConfig,
    ...cliOptions,
  };

  return createConfig(merged as NetStorageClientConfig);
}
