import { useStore } from '../store/store';
import { DurationPicker } from './DurationPicker';
import { formatCountdown } from '../format';

// Focus session controls: plain focus timer or Pomodoro cycles. While a session
// runs the app suppresses its own alerts and best-effort toggles Windows Focus
// Assist.
export function FocusTab({ now }: { now: number }) {
  const focusSettings = useStore((s) => s.settings.focus);
  const updateSettings = useStore((s) => s.updateSettings);
  const session = useStore((s) => s.focus);
  const startFocus = useStore((s) => s.startFocus);
  const stopFocus = useStore((s) => s.stopFocus);
  const isWindows = window.api.platform === 'win32';

  const setFocus = (patch: Partial<typeof focusSettings>) =>
    updateSettings({ focus: { ...focusSettings, ...patch } });

  const remaining =
    session.endTime != null ? Math.max(0, session.endTime - now) : 0;

  return (
    <div className="tabpane">
      {session.active ? (
        <section className="card card--focus">
          <div className={`focusdisplay ${session.phase === 'break' ? 'focusdisplay--break' : ''}`}>
            <div className="focusdisplay__phase">
              {session.phase === 'break' ? 'On a break' : 'Focusing'}
            </div>
            <div className="focusdisplay__time">{formatCountdown(remaining)}</div>
            {focusSettings.pomodoroEnabled && (
              <div className="focusdisplay__cycles">
                Completed cycles: <strong>{session.completedCycles}</strong>
              </div>
            )}
            <div className="focusdisplay__note">Your notifications are silenced.</div>
          </div>
          <button className="btn btn--danger btn--wide" onClick={() => void stopFocus()}>
            End session
          </button>
        </section>
      ) : (
        <section className="card">
          <h2 className="card__title">Start a focus session</h2>

          <label className="switch switch--block">
            <input
              type="checkbox"
              checked={focusSettings.pomodoroEnabled}
              onChange={(e) => setFocus({ pomodoroEnabled: e.target.checked })}
            />
            <span>Pomodoro mode (auto-alternate focus / break)</span>
          </label>

          {focusSettings.pomodoroEnabled ? (
            <div className="grid2">
              <div>
                <div className="field__label">Focus length</div>
                <DurationPicker
                  showHours={false}
                  valueMs={focusSettings.pomodoroFocusMin * 60_000}
                  onChange={(ms) => setFocus({ pomodoroFocusMin: Math.max(1, Math.round(ms / 60_000)) })}
                />
              </div>
              <div>
                <div className="field__label">Break length</div>
                <DurationPicker
                  showHours={false}
                  valueMs={focusSettings.pomodoroBreakMin * 60_000}
                  onChange={(ms) => setFocus({ pomodoroBreakMin: Math.max(1, Math.round(ms / 60_000)) })}
                />
              </div>
            </div>
          ) : (
            <div>
              <div className="field__label">Session length</div>
              <DurationPicker
                valueMs={focusSettings.durationMin * 60_000}
                onChange={(ms) => setFocus({ durationMin: Math.max(1, Math.round(ms / 60_000)) })}
              />
            </div>
          )}

          <label className="switch switch--block">
            <input
              type="checkbox"
              checked={focusSettings.toggleWindowsFocusAssist}
              onChange={(e) => setFocus({ toggleWindowsFocusAssist: e.target.checked })}
            />
            <span>
              Also try to enable Windows Focus Assist{' '}
              <span className="hint">(best-effort{!isWindows ? ' — Windows only' : ''})</span>
            </span>
          </label>

          <button className="btn btn--primary btn--wide" onClick={() => void startFocus()}>
            Start focus
          </button>
        </section>
      )}
    </div>
  );
}
