// Shared type definitions used by both the Electron main process and the React
// renderer. Keep this file dependency-free so it can be imported from either side.

export type AlertKind = 'timer' | 'focus-end' | 'standup' | 'break-end';

export type TimerStatus = 'idle' | 'running' | 'paused' | 'done';

export interface TimerConfig {
  id: string;
  name: string;
  /** Configured length of the timer in milliseconds. */
  durationMs: number;
  /** Remaining time when paused/idle, in milliseconds. */
  remainingMs: number;
  /** Absolute epoch ms when the timer will fire; null unless running. */
  endTime: number | null;
  status: TimerStatus;
  /** When true the timer restarts automatically after firing. */
  loop: boolean;
}

export type ThemeMode = 'light' | 'dark' | 'system';

export type ClockFormat = '12h' | '24h';

/** Built-in synthesized sounds plus the sentinel for a user-imported file. */
export type SoundId =
  | 'chime'
  | 'beep'
  | 'ding'
  | 'marimba'
  | 'alarm'
  | 'custom';

export interface SoundChoice {
  soundId: SoundId;
  /** Data URL of an imported audio file, used when soundId === 'custom'. */
  customDataUrl?: string;
  /** Original file name of the imported audio, for display. */
  customName?: string;
}

export interface SoundSettings {
  timer: SoundChoice;
  focusEnd: SoundChoice;
  standup: SoundChoice;
  /** Master volume 0..1. */
  volume: number;
  /** When false, no in-app sounds play (toasts still show). */
  enabled: boolean;
}

export interface FocusSettings {
  /** Focus session length in minutes (non-pomodoro). */
  durationMin: number;
  pomodoroEnabled: boolean;
  pomodoroFocusMin: number;
  pomodoroBreakMin: number;
  /** Best-effort toggle of Windows Focus Assist during a session. */
  toggleWindowsFocusAssist: boolean;
}

export interface StandUpSettings {
  enabled: boolean;
  intervalMin: number;
  snoozeMin: number;
}

export interface Settings {
  clockFormat: ClockFormat;
  theme: ThemeMode;
  showSeconds: boolean;
  focus: FocusSettings;
  standUp: StandUpSettings;
  sounds: SoundSettings;
  minimizeToTray: boolean;
}

export interface HistoryEntry {
  id: string;
  kind: 'focus' | 'standup' | 'timer';
  label: string;
  /** Epoch ms when the event completed. */
  at: number;
}

export interface PersistedState {
  version: number;
  settings: Settings;
  timers: TimerConfig[];
  history: HistoryEntry[];
}

/** A single item the main-process scheduler is watching. */
export interface ScheduleItem {
  id: string;
  kind: AlertKind;
  endTime: number;
  title: string;
  body: string;
}

/** Result of a best-effort Windows Focus Assist toggle. */
export interface FocusAssistResult {
  supported: boolean;
  applied: boolean;
  message: string;
}

// ---- IPC contract exposed on window.api via the preload bridge ----

export interface DesktopApi {
  loadState(): Promise<PersistedState>;
  saveState(state: PersistedState): Promise<void>;

  /** Register (or update) an item for the main-process scheduler to fire. */
  scheduleSet(item: ScheduleItem): Promise<void>;
  /** Remove a scheduled item (e.g. on pause/reset/delete). */
  scheduleClear(id: string): Promise<void>;

  /** Show a native OS toast. Suppressed by focus mode unless kind === 'focus-end'. */
  notify(payload: {
    kind: AlertKind;
    title: string;
    body: string;
  }): Promise<void>;

  /** Tell the main process whether a focus session is currently active. */
  setFocusActive(active: boolean): Promise<void>;

  /** Best-effort enable/disable of Windows Focus Assist. */
  setWindowsFocusAssist(enable: boolean): Promise<FocusAssistResult>;

  onScheduleFired(cb: (payload: { id: string; kind: AlertKind }) => void): () => void;
  onTrayCommand(cb: (cmd: TrayCommand) => void): () => void;

  platform: string;
}

export type TrayCommand =
  | 'toggle-focus'
  | 'pause-all-timers'
  | 'resume-all-timers'
  | 'show';

declare global {
  interface Window {
    api: DesktopApi;
  }
}
