import type { Settings } from '../types';

export const STATE_VERSION = 1;

export const DEFAULT_SETTINGS: Settings = {
  clockFormat: '12h',
  theme: 'system',
  showSeconds: true,
  focus: {
    durationMin: 25,
    pomodoroEnabled: false,
    pomodoroFocusMin: 25,
    pomodoroBreakMin: 5,
    toggleWindowsFocusAssist: true,
  },
  standUp: {
    enabled: false,
    intervalMin: 45,
    snoozeMin: 5,
  },
  sounds: {
    timer: { soundId: 'marimba' },
    focusEnd: { soundId: 'chime' },
    standup: { soundId: 'ding' },
    volume: 0.7,
    enabled: true,
  },
  minimizeToTray: true,
};
