import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { ClientContext } from '@/index';

const CONFIG_DIR = path.join(os.homedir(), '.config', 'netstorage');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export function loadPersistentContext(): Partial<ClientContext> {
  if (fs.existsSync(CONFIG_FILE)) {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(raw);
  }
  return {};
}

export function savePersistentContext(update: Partial<ClientContext>): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }

  const current = loadPersistentContext();
  const merged = { ...current, ...update };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf-8');
}

export function clearPersistentContext(): void {
  if (fs.existsSync(CONFIG_FILE)) {
    fs.unlinkSync(CONFIG_FILE);
  }
}
