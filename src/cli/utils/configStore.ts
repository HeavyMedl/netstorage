import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import type { NetStorageClientConfig } from '@/index';

const CONFIG_FILE = path.join(
  os.homedir(),
  '.config',
  'netstorage',
  'config.json',
);

/**
 * Loads the persisted NetStorage client configuration from the user's config file.
 *
 * @returns {Partial<NetStorageClientConfig>} The saved configuration, or an empty object if none exists.
 */
export function loadPersistentConfig(): Partial<NetStorageClientConfig> {
  if (fs.existsSync(CONFIG_FILE)) {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(raw);
  }
  return {};
}

/**
 * Merges and saves the provided configuration with the existing persisted config.
 * Creates the config directory if it does not exist.
 *
 * @param {Partial<NetStorageClientConfig>} update - Configuration values to persist.
 */
export function savePersistentconfig(
  update: Partial<NetStorageClientConfig>,
): void {
  const current = loadPersistentConfig();
  const merged = { ...current, ...update };
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf-8');
}

/**
 * Deletes the persisted NetStorage configuration file if it exists.
 */
export function clearPersistentConfig(): void {
  if (fs.existsSync(CONFIG_FILE)) {
    fs.unlinkSync(CONFIG_FILE);
  }
}

/**
 * Returns the path to the persistent configuration file.
 *
 * @returns {string} The absolute path to the saved config file.
 */
export function getPersistentConfigPath(): string {
  return CONFIG_FILE;
}
