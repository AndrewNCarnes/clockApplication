import { useEffect, useState } from 'react';
import { useStore } from '../store/store';
import { DurationPicker } from './DurationPicker';
import { TimerItem } from './TimerItem';

// Create and manage any number of concurrent timers.
export function TimersTab({ now }: { now: number }) {
  const timers = useStore((s) => s.timers);
  const addTimer = useStore((s) => s.addTimer);
  const startTimer = useStore((s) => s.startTimer);
  const pauseAll = useStore((s) => s.pauseAllTimers);
  const resumeAll = useStore((s) => s.resumeAllTimers);

  const [name, setName] = useState('');
  const [durationMs, setDurationMs] = useState(5 * 60_000);
  const [loop, setLoop] = useState(false);
  const [startNow, setStartNow] = useState(true);

  // Keyboard shortcuts for the most-recently-added / first running timer:
  // Space = start/pause, R = reset. Ignored while typing in an input.
  const pauseTimer = useStore((s) => s.pauseTimer);
  const resetTimer = useStore((s) => s.resetTimer);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      const active = useStore.getState().timers;
      const t = active.find((x) => x.status === 'running') ?? active[0];
      if (!t) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (t.status === 'running') pauseTimer(t.id);
        else startTimer(t.id);
      } else if (e.key.toLowerCase() === 'r') {
        resetTimer(t.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pauseTimer, resetTimer, startTimer]);

  const create = () => {
    if (durationMs <= 0) return;
    const beforeIds = new Set(useStore.getState().timers.map((t) => t.id));
    addTimer(name, durationMs, loop);
    if (startNow) {
      const created = useStore.getState().timers.find((t) => !beforeIds.has(t.id));
      if (created) startTimer(created.id);
    }
    setName('');
  };

  const anyRunning = timers.some((t) => t.status === 'running');
  const anyPaused = timers.some((t) => t.status === 'paused');

  return (
    <div className="tabpane">
      <section className="card">
        <h2 className="card__title">New timer</h2>
        <div className="field">
          <input
            className="input"
            placeholder="Timer name (e.g. Tea, Laundry)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
          />
        </div>
        <DurationPicker valueMs={durationMs} onChange={setDurationMs} />
        <div className="field field--row">
          <label className="switch">
            <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
            <span>Loop</span>
          </label>
          <label className="switch">
            <input
              type="checkbox"
              checked={startNow}
              onChange={(e) => setStartNow(e.target.checked)}
            />
            <span>Start immediately</span>
          </label>
          <button className="btn btn--primary" onClick={create} disabled={durationMs <= 0}>
            Add timer
          </button>
        </div>
      </section>

      {timers.length > 0 && (
        <div className="bulkbar">
          <span className="bulkbar__label">
            {timers.length} timer{timers.length !== 1 ? 's' : ''}
          </span>
          <div className="bulkbar__actions">
            <button className="btn btn--sm" onClick={pauseAll} disabled={!anyRunning}>
              Pause all
            </button>
            <button className="btn btn--sm" onClick={resumeAll} disabled={!anyPaused}>
              Resume all
            </button>
          </div>
        </div>
      )}

      <section className="timerlist">
        {timers.length === 0 ? (
          <div className="empty">No timers yet. Create one above.</div>
        ) : (
          timers.map((t) => <TimerItem key={t.id} timer={t} now={now} />)
        )}
      </section>
    </div>
  );
}
