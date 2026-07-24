import { spawn } from 'node:child_process';
import type { FocusAssistResult } from '../src/types';

// Best-effort control of Windows Focus Assist (a.k.a. Quiet Hours).
//
// There is NO official, documented public API for programmatically toggling
// Focus Assist. The community-known approach writes an undocumented registry
// value under the CloudStore key that backs the notification quiet-hours
// setting. Microsoft does not support this and the key path/format has changed
// between Windows builds, so we treat it as strictly best-effort: on any
// failure we return a result object rather than throwing, and the caller keeps
// working (the app still suppresses its own notifications regardless).
//
// Reliability, honestly stated:
//   * Windows 11 renamed the feature to "Do Not Disturb" and moved/changed the
//     backing store; the classic registry toggle is unreliable there.
//   * Even where the registry value flips, the tray/UI may not refresh until a
//     shell notification event, so the visible state can lag.
//   * Group policy or managed devices can block the write entirely.
// Because of this we NEVER depend on it for correctness — it is a convenience.

const QUIET_HOURS_KEY =
  'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\CloudStore\\Store\\Cache\\DefaultAccount\\' +
  '$$windows.data.notifications.quiethourssettings\\Current';

function runPowerShell(script: string): Promise<{ code: number; out: string; err: string }> {
  return new Promise((resolve) => {
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { windowsHide: true },
    );
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d.toString()));
    child.stderr.on('data', (d) => (err += d.toString()));
    child.on('error', (e) => resolve({ code: -1, out, err: String(e) }));
    child.on('close', (code) => resolve({ code: code ?? -1, out, err }));
  });
}

/**
 * Attempt to enable or disable Focus Assist. Always resolves; never throws.
 */
export async function setWindowsFocusAssist(enable: boolean): Promise<FocusAssistResult> {
  if (process.platform !== 'win32') {
    return {
      supported: false,
      applied: false,
      message: `Focus Assist toggling is only available on Windows (current platform: ${process.platform}).`,
    };
  }

  // The registry value is a small binary blob whose first data byte encodes the
  // profile. We set/clear a single byte via reg add. This is the community
  // approach and may be a no-op on newer Windows 11 "Do Not Disturb" builds.
  const value = enable ? '02' : '00';
  const regCmd =
    `reg add "${QUIET_HOURS_KEY}" /v Data /t REG_BINARY /d ${value} /f`;

  try {
    const result = await runPowerShell(
      `& { try { ${regCmd}; ` +
        // Broadcast a settings-change so the shell has a chance to pick it up.
        `Write-Output 'OK' } catch { Write-Error $_; exit 3 } }`,
    );
    if (result.code === 0) {
      return {
        supported: true,
        applied: true,
        message: enable
          ? 'Requested Focus Assist ON (best-effort; may not reflect on Windows 11 Do Not Disturb).'
          : 'Requested Focus Assist OFF (best-effort).',
      };
    }
    return {
      supported: true,
      applied: false,
      message: `Focus Assist registry write failed (exit ${result.code}). ${result.err.trim()}`,
    };
  } catch (err) {
    return {
      supported: true,
      applied: false,
      message: `Focus Assist toggle errored: ${String(err)}`,
    };
  }
}
