import { contextBridge, ipcRenderer } from 'electron';
import type {
  AlertKind,
  DesktopApi,
  FocusAssistResult,
  PersistedState,
  ScheduleItem,
  TrayCommand,
} from '../src/types';

// The preload runs with Node access but in an isolated context. We expose a
// narrow, typed surface on window.api instead of the full ipcRenderer, so the
// renderer can never reach arbitrary main-process channels.

const api: DesktopApi = {
  loadState: () => ipcRenderer.invoke('store:load') as Promise<PersistedState>,
  saveState: (state: PersistedState) => ipcRenderer.invoke('store:save', state) as Promise<void>,

  scheduleSet: (item: ScheduleItem) => ipcRenderer.invoke('schedule:set', item) as Promise<void>,
  scheduleClear: (id: string) => ipcRenderer.invoke('schedule:clear', id) as Promise<void>,

  notify: (payload) => ipcRenderer.invoke('notify', payload) as Promise<void>,

  setFocusActive: (active: boolean) =>
    ipcRenderer.invoke('focus:set-active', active) as Promise<void>,
  setWindowsFocusAssist: (enable: boolean) =>
    ipcRenderer.invoke('focus:windows-assist', enable) as Promise<FocusAssistResult>,

  onScheduleFired: (cb) => {
    const listener = (_e: unknown, payload: { id: string; kind: AlertKind }) => cb(payload);
    ipcRenderer.on('schedule:fired', listener);
    return () => ipcRenderer.removeListener('schedule:fired', listener);
  },

  onTrayCommand: (cb) => {
    const listener = (_e: unknown, cmd: TrayCommand) => cb(cmd);
    ipcRenderer.on('tray:command', listener);
    return () => ipcRenderer.removeListener('tray:command', listener);
  },

  platform: process.platform,
};

contextBridge.exposeInMainWorld('api', api);
