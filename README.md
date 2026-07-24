# Clock & Timer

A clean Windows desktop app that combines a live clock, multiple concurrent
timers, a focus timer that silences notifications, and a recurring
stand-up / movement reminder — all in one window.

Built with **Electron + React + TypeScript**. Free, offline, and yours to
extend.

## Features

- **Live clock** — always visible in the header and full-size on the Clock tab.
  12/24-hour toggle, date, optional seconds. Reads the system clock every tick,
  so it never drifts.
- **Multiple timers** — create any number of named timers and run them at the
  same time. Each has independent start / pause / resume / reset / delete, an
  optional loop, a live countdown ring, a desktop toast, and a sound when it
  ends. Timers stay accurate when the window is minimized or in the background.
- **Focus timer** — start a focus session for a set duration. While active the
  app suppresses its own notifications and sounds (except the session-ended
  alert), shows a persistent "notifications silenced" banner with time
  remaining, and best-effort toggles Windows Focus Assist. **Pomodoro mode**
  auto-alternates focus/break intervals (default 25/5, both configurable) and
  counts completed cycles.
- **Stand-up reminder** — recurring nudge every N minutes with a toast + sound
  and a snooze button. Simple on/off.
- **Sounds & alerts** — distinct built-in sounds per alert type (synthesized,
  no binary assets), or import your own mp3/wav. Master volume, and native
  Windows toast notifications for everything.
- **Polish** — light/dark/system theme, system tray with quick controls,
  keyboard shortcuts (Space = start/pause, R = reset the active timer), and a
  history log of completed focus sessions, stand-ups, and timers.
- **Persistence** — settings and timers are saved to a JSON file in your
  user-data folder and restored on restart. Timers that were running are
  re-armed; ones whose deadline passed while the app was closed are marked
  finished instead of firing a burst of stale alerts.

## Getting started

Requires Node.js 18+.

```bash
npm install          # install dependencies (downloads Electron)
npm run dev          # run in development with hot reload
npm run build        # typecheck + build renderer and main process
npm run dist         # build a Windows installer (.exe) into ./release
```

`npm run dist` must be run **on Windows** (or a machine with Wine configured)
to produce the NSIS installer. `npm run build` works anywhere and is what CI
would run to verify the app compiles.

## Architecture notes

- **Background accuracy.** Renderers are throttled when the window is hidden, so
  timing is not left to `setInterval` in the UI. Every timer/reminder stores an
  absolute end timestamp; the UI computes its countdown from `Date.now()` (so it
  can't drift), and the **main process** — which Electron does not throttle —
  owns the authoritative scheduler that actually fires the notification on time.
- **Notification suppression** during focus is a simple, reliable gate in the
  main process: any toast except the focus/break transition alerts is dropped
  while a session is active. In-app sounds are gated the same way in the
  renderer.
- **State** lives in a single zustand store (renderer), persisted to disk via a
  narrow, typed IPC bridge (`window.api`) exposed by the preload script with
  context isolation on.

### Windows Focus Assist — reliability, honestly

There is **no official, supported public API** to toggle Windows Focus Assist
(a.k.a. Quiet Hours / "Do Not Disturb"). The app attempts it best-effort by
writing the community-known undocumented registry value under the notification
`CloudStore` key, via a hidden PowerShell call. What that means in practice:

- **Windows 10:** the registry toggle usually flips the setting, though the tray
  UI may not refresh until the next notification event.
- **Windows 11:** the feature was renamed "Do Not Disturb" and its backing store
  changed; the classic key is **unreliable and often a no-op** there.
- **Managed / group-policy devices:** the write can be blocked entirely.
- On any non-Windows platform it is a graceful no-op.

Because of all this the app **never depends on it for correctness** — it fails
silently (logging a note to the console) and the reliable half of the feature,
suppressing the app's *own* notifications and sounds, always works. The session
banner and the "silenced" state are driven by the app itself, not by Windows.
When a session ends or is stopped early, the app reverts the toggle.

If you want rock-solid OS-level suppression, the honest answer is to also flip
Windows' own Do Not Disturb from the Action Center — no third-party app can do
that reliably through a supported API today.

## Project layout

```
electron/           Main process (Node)
  main.ts           Window, tray, IPC, notification gating, lifecycle
  preload.ts        Typed contextBridge api on window.api
  scheduler.ts      Authoritative, throttle-immune timer scheduler
  store.ts          Atomic JSON persistence
  focusAssist.ts    Best-effort Windows Focus Assist toggle
src/                Renderer (React)
  store/            zustand store + defaults
  components/       Clock / Timers / Focus / Stand-Up / Settings tabs + header
  audio/sounds.ts   Web Audio synthesized alerts + custom file playback
  hooks/useNow.ts   Drift-free clock tick
  format.ts         Time/date/countdown formatting
  types.ts          Shared types + IPC contract
scripts/generate-icon.js   Regenerates build/icon.png
```
