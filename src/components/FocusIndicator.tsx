import { useStore } from '../store/store';
import { formatCountdown } from '../format';

// A persistent banner shown whenever a focus session is active, on every tab,
// so it's always obvious that notifications are being suppressed.
export function FocusIndicator({ now }: { now: number }) {
  const focus = useStore((s) => s.focus);
  const stopFocus = useStore((s) => s.stopFocus);
  if (!focus.active) return null;

  const remaining = focus.endTime != null ? Math.max(0, focus.endTime - now) : 0;
  const isBreak = focus.phase === 'break';

  return (
    <div className={`focusbar ${isBreak ? 'focusbar--break' : ''}`}>
      <span className="focusbar__pulse" aria-hidden />
      <span className="focusbar__label">
        {isBreak ? 'Break' : 'Focus'} · notifications silenced
      </span>
      <span className="focusbar__time">{formatCountdown(remaining)}</span>
      <button className="btn btn--sm btn--ghost" onClick={() => void stopFocus()}>
        End
      </button>
    </div>
  );
}
