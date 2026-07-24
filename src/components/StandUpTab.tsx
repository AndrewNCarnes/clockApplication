import { useStore } from '../store/store';
import { formatCountdown, formatTimeOfDay } from '../format';

// Recurring stand-up / movement reminder.
export function StandUpTab({ now }: { now: number }) {
  const standUp = useStore((s) => s.settings.standUp);
  const clockFormat = useStore((s) => s.settings.clockFormat);
  const updateSettings = useStore((s) => s.updateSettings);
  const setEnabled = useStore((s) => s.setStandUpEnabled);
  const snooze = useStore((s) => s.snoozeStandUp);
  const nextAt = useStore((s) => s.standUpNextAt);

  const set = (patch: Partial<typeof standUp>) =>
    updateSettings({ standUp: { ...standUp, ...patch } });

  const remaining = nextAt != null ? Math.max(0, nextAt - now) : 0;

  return (
    <div className="tabpane">
      <section className="card">
        <div className="card__headerrow">
          <h2 className="card__title">Stand-up reminder</h2>
          <label className="switch">
            <input
              type="checkbox"
              checked={standUp.enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <span>{standUp.enabled ? 'On' : 'Off'}</span>
          </label>
        </div>

        <p className="muted">
          Get a nudge to stand, stretch, and move at a regular interval while the app is open.
        </p>

        <div className="field">
          <div className="field__label">Remind me every</div>
          <div className="stepper">
            {[15, 30, 45, 60, 90].map((v) => (
              <button
                key={v}
                className={`seg ${standUp.intervalMin === v ? 'seg--active' : ''}`}
                onClick={() => set({ intervalMin: v })}
              >
                {v}m
              </button>
            ))}
          </div>
          <label className="inlinenum">
            <span>Custom</span>
            <input
              type="number"
              min={1}
              max={600}
              value={standUp.intervalMin}
              onChange={(e) =>
                set({ intervalMin: Math.max(1, Math.min(600, parseInt(e.target.value, 10) || 1)) })
              }
            />
            <span>min</span>
          </label>
        </div>

        <div className="field">
          <label className="inlinenum">
            <span>Snooze length</span>
            <input
              type="number"
              min={1}
              max={60}
              value={standUp.snoozeMin}
              onChange={(e) =>
                set({ snoozeMin: Math.max(1, Math.min(60, parseInt(e.target.value, 10) || 1)) })
              }
            />
            <span>min</span>
          </label>
        </div>

        {standUp.enabled && nextAt != null && (
          <div className="nextfire">
            <div>
              <div className="nextfire__label">Next reminder in</div>
              <div className="nextfire__time">{formatCountdown(remaining)}</div>
              <div className="muted small">at {formatTimeOfDay(nextAt, clockFormat)}</div>
            </div>
            <button className="btn btn--sm" onClick={snooze}>
              Snooze +{standUp.snoozeMin}m
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
