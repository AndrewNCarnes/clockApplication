import { useStore } from '../store/store';
import { formatClock, formatDate } from '../format';

// The big, front-and-centre clock. Reads Date.now() every tick (passed in via
// `now`) so it tracks the system clock exactly and never drifts.
export function ClockTab({ now }: { now: number }) {
  const format = useStore((s) => s.settings.clockFormat);
  const showSeconds = useStore((s) => s.settings.showSeconds);
  const updateSettings = useStore((s) => s.updateSettings);
  const { time, suffix } = formatClock(now, format, showSeconds);

  return (
    <div className="clocktab">
      <div className="clocktab__big">
        <span className="clocktab__time">{time}</span>
        {suffix && <span className="clocktab__suffix">{suffix}</span>}
      </div>
      <div className="clocktab__date">{formatDate(now)}</div>

      <div className="clocktab__controls">
        <div className="segmented">
          <button
            className={format === '12h' ? 'seg seg--active' : 'seg'}
            onClick={() => updateSettings({ clockFormat: '12h' })}
          >
            12-hour
          </button>
          <button
            className={format === '24h' ? 'seg seg--active' : 'seg'}
            onClick={() => updateSettings({ clockFormat: '24h' })}
          >
            24-hour
          </button>
        </div>
        <label className="switch">
          <input
            type="checkbox"
            checked={showSeconds}
            onChange={(e) => updateSettings({ showSeconds: e.target.checked })}
          />
          <span>Show seconds</span>
        </label>
      </div>
    </div>
  );
}
