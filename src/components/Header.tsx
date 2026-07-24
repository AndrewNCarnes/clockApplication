import { useStore } from '../store/store';
import { formatClock, formatDate } from '../format';

// The compact clock that stays visible in the header no matter which tab is
// active (the spec requires the current time to always be on screen).
export function Header({ now }: { now: number }) {
  const format = useStore((s) => s.settings.clockFormat);
  const { time, suffix } = formatClock(now, format, true);

  return (
    <header className="header">
      <div className="header__clock">
        <span className="header__time">{time}</span>
        {suffix && <span className="header__suffix">{suffix}</span>}
      </div>
      <div className="header__date">{formatDate(now)}</div>
    </header>
  );
}
