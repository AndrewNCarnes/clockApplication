import { useStore } from '../store/store';

export type TabId = 'clock' | 'timers' | 'focus' | 'standup' | 'settings';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'clock', label: 'Clock', icon: '🕐' },
  { id: 'timers', label: 'Timers', icon: '⏱️' },
  { id: 'focus', label: 'Focus', icon: '🎯' },
  { id: 'standup', label: 'Stand-Up', icon: '🧍' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

export function Tabs({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  const runningTimers = useStore((s) => s.timers.filter((t) => t.status === 'running').length);
  const focusActive = useStore((s) => s.focus.active);
  const standUp = useStore((s) => s.settings.standUp.enabled);

  const badge = (id: TabId): number | boolean => {
    if (id === 'timers') return runningTimers > 0 ? runningTimers : false;
    if (id === 'focus') return focusActive;
    if (id === 'standup') return standUp;
    return false;
  };

  return (
    <nav className="tabs" role="tablist">
      {TABS.map((t) => {
        const b = badge(t.id);
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={active === t.id}
            className={`tab ${active === t.id ? 'tab--active' : ''}`}
            onClick={() => onChange(t.id)}
          >
            <span className="tab__icon" aria-hidden>
              {t.icon}
            </span>
            <span className="tab__label">{t.label}</span>
            {typeof b === 'number' && <span className="tab__badge">{b}</span>}
            {b === true && <span className="tab__dot" aria-hidden />}
          </button>
        );
      })}
    </nav>
  );
}
