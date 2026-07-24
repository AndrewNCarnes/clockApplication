import { useStore } from '../store/store';
import { formatCountdown } from '../format';
import type { TimerConfig } from '../types';

// A single running/paused/idle timer row with independent controls.
export function TimerItem({ timer, now }: { timer: TimerConfig; now: number }) {
  const start = useStore((s) => s.startTimer);
  const pause = useStore((s) => s.pauseTimer);
  const reset = useStore((s) => s.resetTimer);
  const del = useStore((s) => s.deleteTimer);
  const toggleLoop = useStore((s) => s.toggleLoop);

  const remaining =
    timer.status === 'running' && timer.endTime != null
      ? Math.max(0, timer.endTime - now)
      : timer.status === 'done'
        ? 0
        : timer.remainingMs;

  const pct =
    timer.durationMs > 0 ? Math.max(0, Math.min(1, remaining / timer.durationMs)) : 0;

  return (
    <div className={`timer timer--${timer.status}`}>
      <div className="timer__ring" style={{ '--pct': pct } as React.CSSProperties}>
        <div className="timer__ringinner">
          <span className="timer__count">{formatCountdown(remaining)}</span>
        </div>
      </div>

      <div className="timer__main">
        <div className="timer__top">
          <span className="timer__name" title={timer.name}>
            {timer.name}
          </span>
          <button
            className={`chip ${timer.loop ? 'chip--on' : ''}`}
            title="Loop / repeat"
            onClick={() => toggleLoop(timer.id)}
          >
            🔁 Loop
          </button>
        </div>

        <div className="timer__status">
          {timer.status === 'running' && 'Running'}
          {timer.status === 'paused' && 'Paused'}
          {timer.status === 'idle' && 'Ready'}
          {timer.status === 'done' && 'Finished'}
        </div>

        <div className="timer__actions">
          {timer.status === 'running' ? (
            <button className="btn" onClick={() => pause(timer.id)}>
              Pause
            </button>
          ) : (
            <button className="btn btn--primary" onClick={() => start(timer.id)}>
              {timer.status === 'paused' ? 'Resume' : 'Start'}
            </button>
          )}
          <button className="btn" onClick={() => reset(timer.id)}>
            Reset
          </button>
          <button className="btn btn--danger" onClick={() => del(timer.id)}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
