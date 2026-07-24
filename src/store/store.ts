import { create } from 'zustand';
import type {
  AlertKind,
  HistoryEntry,
  PersistedState,
  Settings,
  SoundChoice,
  TimerConfig,
} from '../types';
import { DEFAULT_SETTINGS, STATE_VERSION } from './defaults';
import { playSound } from '../audio/sounds';

// ---- helpers ----

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function api() {
  return window.api;
}

interface FocusSessionState {
  active: boolean;
  phase: 'focus' | 'break';
  endTime: number | null;
  completedCycles: number;
}

interface StoreState {
  loaded: boolean;
  settings: Settings;
  timers: TimerConfig[];
  history: HistoryEntry[];
  focus: FocusSessionState;
  standUpNextAt: number | null;

  // lifecycle
  load: () => Promise<void>;

  // settings
  updateSettings: (patch: Partial<Settings>) => void;
  setSound: (which: 'timer' | 'focusEnd' | 'standup', choice: SoundChoice) => void;
  setVolume: (v: number) => void;

  // timers
  addTimer: (name: string, durationMs: number, loop: boolean) => void;
  startTimer: (id: string) => void;
  pauseTimer: (id: string) => void;
  resetTimer: (id: string) => void;
  deleteTimer: (id: string) => void;
  toggleLoop: (id: string) => void;
  pauseAllTimers: () => void;
  resumeAllTimers: () => void;

  // focus
  startFocus: () => Promise<void>;
  stopFocus: () => Promise<void>;
  toggleFocus: () => void;

  // stand-up
  setStandUpEnabled: (enabled: boolean) => void;
  snoozeStandUp: () => void;

  // fired dispatch (from main scheduler)
  handleFired: (id: string, kind: AlertKind) => void;

  addHistory: (entry: Omit<HistoryEntry, 'id' | 'at'>) => void;
  clearHistory: () => void;
}

// Fixed scheduler ids for singleton schedules.
const FOCUS_ID = '__focus__';
const STANDUP_ID = '__standup__';

// Debounced persistence — the renderer is the source of truth; the main
// process just writes what we hand it.
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function persist(get: () => StoreState) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const s = get();
    const payload: PersistedState = {
      version: STATE_VERSION,
      settings: s.settings,
      timers: s.timers,
      history: s.history.slice(0, 200),
    };
    void api().saveState(payload);
  }, 300);
}

function fmt(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

export const useStore = create<StoreState>((set, get) => ({
  loaded: false,
  settings: DEFAULT_SETTINGS,
  timers: [],
  history: [],
  focus: { active: false, phase: 'focus', endTime: null, completedCycles: 0 },
  standUpNextAt: null,

  load: async () => {
    const saved = (await api().loadState()) as PersistedState | null;
    if (saved) {
      // Merge settings so new fields added in later versions get defaults.
      const settings: Settings = {
        ...DEFAULT_SETTINGS,
        ...saved.settings,
        focus: { ...DEFAULT_SETTINGS.focus, ...saved.settings?.focus },
        standUp: { ...DEFAULT_SETTINGS.standUp, ...saved.settings?.standUp },
        sounds: { ...DEFAULT_SETTINGS.sounds, ...saved.settings?.sounds },
      };
      // Re-arm any timers that were running: if their deadline has already
      // passed while the app was closed, mark them done rather than firing a
      // burst of stale notifications.
      const now = Date.now();
      const timers = (saved.timers ?? []).map((t): TimerConfig => {
        if (t.status === 'running' && t.endTime != null) {
          if (t.endTime <= now) {
            return { ...t, status: 'done', endTime: null, remainingMs: 0 };
          }
          // Still running — re-register with the main scheduler.
          void api().scheduleSet({
            id: t.id,
            kind: 'timer',
            endTime: t.endTime,
            title: `Timer: ${t.name}`,
            body: 'Time is up.',
          });
          return t;
        }
        return t;
      });
      set({ settings, timers, history: saved.history ?? [], loaded: true });
    } else {
      set({ loaded: true });
    }

    // Arm the stand-up reminder if enabled.
    if (get().settings.standUp.enabled) {
      armStandUp(set, get);
    }
  },

  updateSettings: (patch) => {
    set((s) => ({ settings: { ...s.settings, ...patch } }));
    persist(get);
  },

  setSound: (which, choice) => {
    set((s) => ({
      settings: { ...s.settings, sounds: { ...s.settings.sounds, [which]: choice } },
    }));
    persist(get);
  },

  setVolume: (v) => {
    set((s) => ({
      settings: {
        ...s.settings,
        sounds: { ...s.settings.sounds, volume: Math.max(0, Math.min(1, v)) },
      },
    }));
    persist(get);
  },

  addTimer: (name, durationMs, loop) => {
    const t: TimerConfig = {
      id: uid(),
      name: name.trim() || 'Timer',
      durationMs,
      remainingMs: durationMs,
      endTime: null,
      status: 'idle',
      loop,
    };
    set((s) => ({ timers: [...s.timers, t] }));
    persist(get);
  },

  startTimer: (id) => {
    set((s) => ({
      timers: s.timers.map((t) => {
        if (t.id !== id) return t;
        const remaining = t.status === 'done' ? t.durationMs : t.remainingMs;
        const endTime = Date.now() + remaining;
        void api().scheduleSet({
          id: t.id,
          kind: 'timer',
          endTime,
          title: `Timer: ${t.name}`,
          body: 'Time is up.',
        });
        return { ...t, status: 'running', endTime, remainingMs: remaining };
      }),
    }));
    persist(get);
  },

  pauseTimer: (id) => {
    set((s) => ({
      timers: s.timers.map((t) => {
        if (t.id !== id || t.status !== 'running' || t.endTime == null) return t;
        void api().scheduleClear(t.id);
        const remainingMs = Math.max(0, t.endTime - Date.now());
        return { ...t, status: 'paused', endTime: null, remainingMs };
      }),
    }));
    persist(get);
  },

  resetTimer: (id) => {
    set((s) => ({
      timers: s.timers.map((t) => {
        if (t.id !== id) return t;
        void api().scheduleClear(t.id);
        return { ...t, status: 'idle', endTime: null, remainingMs: t.durationMs };
      }),
    }));
    persist(get);
  },

  deleteTimer: (id) => {
    void api().scheduleClear(id);
    set((s) => ({ timers: s.timers.filter((t) => t.id !== id) }));
    persist(get);
  },

  toggleLoop: (id) => {
    set((s) => ({
      timers: s.timers.map((t) => (t.id === id ? { ...t, loop: !t.loop } : t)),
    }));
    persist(get);
  },

  pauseAllTimers: () => {
    get()
      .timers.filter((t) => t.status === 'running')
      .forEach((t) => get().pauseTimer(t.id));
  },

  resumeAllTimers: () => {
    get()
      .timers.filter((t) => t.status === 'paused')
      .forEach((t) => get().startTimer(t.id));
  },

  startFocus: async () => {
    const { focus } = get().settings;
    const phase: 'focus' | 'break' = 'focus';
    const durMin = focus.pomodoroEnabled ? focus.pomodoroFocusMin : focus.durationMin;
    const endTime = Date.now() + durMin * 60_000;
    set({ focus: { active: true, phase, endTime, completedCycles: 0 } });
    await api().setFocusActive(true);
    await api().scheduleSet({
      id: FOCUS_ID,
      kind: 'focus-end',
      endTime,
      title: focus.pomodoroEnabled ? 'Focus interval complete' : 'Focus session complete',
      body: focus.pomodoroEnabled ? 'Time for a break.' : 'Great work — session ended.',
    });
    if (focus.toggleWindowsFocusAssist) {
      const res = await api().setWindowsFocusAssist(true);
      if (!res.applied) console.info('Focus Assist:', res.message);
    }
  },

  stopFocus: async () => {
    const st = get();
    if (st.focus.active) {
      st.addHistory({ kind: 'focus', label: `Focus session (${st.focus.completedCycles} cycles)` });
    }
    await api().scheduleClear(FOCUS_ID);
    await api().setFocusActive(false);
    if (st.settings.focus.toggleWindowsFocusAssist) {
      await api().setWindowsFocusAssist(false);
    }
    set({ focus: { active: false, phase: 'focus', endTime: null, completedCycles: 0 } });
  },

  toggleFocus: () => {
    if (get().focus.active) void get().stopFocus();
    else void get().startFocus();
  },

  setStandUpEnabled: (enabled) => {
    set((s) => ({
      settings: { ...s.settings, standUp: { ...s.settings.standUp, enabled } },
    }));
    if (enabled) armStandUp(set, get);
    else {
      void api().scheduleClear(STANDUP_ID);
      set({ standUpNextAt: null });
    }
    persist(get);
  },

  snoozeStandUp: () => {
    const mins = get().settings.standUp.snoozeMin;
    const endTime = Date.now() + mins * 60_000;
    set({ standUpNextAt: endTime });
    void api().scheduleSet({
      id: STANDUP_ID,
      kind: 'standup',
      endTime,
      title: 'Time to stand up',
      body: 'Stretch, move around, rest your eyes.',
    });
  },

  handleFired: (id, kind) => {
    const st = get();
    const { sounds } = st.settings;
    const focusActive = st.focus.active;

    // Suppress non-focus sounds while a focus session is active.
    const suppressed = focusActive && (kind === 'timer' || kind === 'standup');

    const playIfEnabled = (choice: SoundChoice) => {
      if (sounds.enabled && !suppressed) playSound(choice, sounds.volume);
    };

    if (kind === 'timer') {
      const timer = st.timers.find((t) => t.id === id);
      if (!timer) return;
      playIfEnabled(sounds.timer);
      st.addHistory({ kind: 'timer', label: `Timer "${timer.name}" finished` });
      set((s) => ({
        timers: s.timers.map((t) => {
          if (t.id !== id) return t;
          if (t.loop) {
            const endTime = Date.now() + t.durationMs;
            void api().scheduleSet({
              id: t.id,
              kind: 'timer',
              endTime,
              title: `Timer: ${t.name}`,
              body: 'Time is up.',
            });
            return { ...t, status: 'running', endTime, remainingMs: t.durationMs };
          }
          return { ...t, status: 'done', endTime: null, remainingMs: 0 };
        }),
      }));
      persist(get);
      return;
    }

    if (kind === 'standup') {
      playIfEnabled(sounds.standup);
      st.addHistory({ kind: 'standup', label: 'Stand-up reminder' });
      // Re-arm for the next interval.
      if (get().settings.standUp.enabled) armStandUp(set, get);
      return;
    }

    if (kind === 'focus-end' || kind === 'break-end') {
      // Focus/break transition alerts are allowed to sound even in focus mode.
      const { focus } = st.settings;
      if (sounds.enabled) playSound(sounds.focusEnd, sounds.volume);

      if (!focus.pomodoroEnabled) {
        // Simple focus session: end it.
        void st.stopFocus();
        return;
      }

      // Pomodoro: alternate focus <-> break.
      const cur = st.focus;
      if (cur.phase === 'focus') {
        const completedCycles = cur.completedCycles + 1;
        const endTime = Date.now() + focus.pomodoroBreakMin * 60_000;
        set({ focus: { active: true, phase: 'break', endTime, completedCycles } });
        void api().scheduleSet({
          id: FOCUS_ID,
          kind: 'break-end',
          endTime,
          title: 'Break over',
          body: 'Back to focus.',
        });
      } else {
        const endTime = Date.now() + focus.pomodoroFocusMin * 60_000;
        set((s) => ({ focus: { ...s.focus, phase: 'focus', endTime } }));
        void api().scheduleSet({
          id: FOCUS_ID,
          kind: 'focus-end',
          endTime,
          title: 'Focus interval complete',
          body: 'Time for a break.',
        });
      }
      return;
    }
  },

  addHistory: (entry) => {
    const h: HistoryEntry = { ...entry, id: uid(), at: Date.now() };
    set((s) => ({ history: [h, ...s.history].slice(0, 200) }));
    persist(get);
  },

  clearHistory: () => {
    set({ history: [] });
    persist(get);
  },
}));

function armStandUp(
  set: (partial: Partial<StoreState>) => void,
  get: () => StoreState,
) {
  const mins = get().settings.standUp.intervalMin;
  const endTime = Date.now() + mins * 60_000;
  set({ standUpNextAt: endTime });
  void api().scheduleSet({
    id: STANDUP_ID,
    kind: 'standup',
    endTime,
    title: 'Time to stand up',
    body: 'Stretch, move around, rest your eyes.',
  });
}

export { fmt };
