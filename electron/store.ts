import { app } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { PersistedState } from '../src/types';

// The renderer owns the shape of PersistedState; the main process just reads and
// writes it atomically to a JSON file in the per-user app data directory.

const FILE_NAME = 'clock-timer-state.json';

function filePath(): string {
  return path.join(app.getPath('userData'), FILE_NAME);
}

export async function readState(): Promise<PersistedState | null> {
  try {
    const raw = await fs.readFile(filePath(), 'utf-8');
    return JSON.parse(raw) as PersistedState;
  } catch (err: unknown) {
    // Missing file on first launch is expected; anything else we log and treat
    // as "no saved state" so the app still starts with defaults.
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code !== 'ENOENT') {
      console.error('Failed to read persisted state:', err);
    }
    return null;
  }
}

export async function writeState(state: PersistedState): Promise<void> {
  const target = filePath();
  const tmp = `${target}.tmp`;
  const data = JSON.stringify(state, null, 2);
  // Write to a temp file then rename so a crash mid-write can't corrupt the
  // saved state.
  await fs.writeFile(tmp, data, 'utf-8');
  await fs.rename(tmp, target);
}
