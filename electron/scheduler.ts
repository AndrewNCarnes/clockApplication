import type { AlertKind, ScheduleItem } from '../src/types';

// The authoritative timer scheduler lives in the MAIN process, which Electron
// does NOT throttle when windows are minimized/hidden/occluded. The renderer
// computes countdown *display* from absolute end timestamps (so it never
// drifts), but the actual "fire the notification now" decision is made here so
// alerts are on time regardless of window state.

type FiredCallback = (item: ScheduleItem) => void;

export class Scheduler {
  private items = new Map<string, ScheduleItem>();
  private interval: NodeJS.Timeout | null = null;
  private readonly onFired: FiredCallback;

  constructor(onFired: FiredCallback) {
    this.onFired = onFired;
  }

  private ensureRunning() {
    if (this.interval) return;
    // 500ms tick keeps firing within half a second of the target without
    // meaningful CPU cost. Timing is checked against Date.now(), not counted,
    // so the tick interval itself never causes drift.
    this.interval = setInterval(() => this.check(), 500);
  }

  private stopIfIdle() {
    if (this.items.size === 0 && this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private check() {
    const now = Date.now();
    for (const item of [...this.items.values()]) {
      if (now >= item.endTime) {
        this.items.delete(item.id);
        this.onFired(item);
      }
    }
    this.stopIfIdle();
  }

  set(item: ScheduleItem) {
    this.items.set(item.id, item);
    this.ensureRunning();
  }

  clear(id: string) {
    this.items.delete(id);
    this.stopIfIdle();
  }

  clearKind(kind: AlertKind) {
    for (const item of [...this.items.values()]) {
      if (item.kind === kind) this.items.delete(item.id);
    }
    this.stopIfIdle();
  }

  dispose() {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
    this.items.clear();
  }
}
