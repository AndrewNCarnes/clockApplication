import { useRef } from 'react';
import { useStore } from '../store/store';
import { BUILT_IN_SOUNDS, previewSound } from '../audio/sounds';
import { formatTimeOfDay } from '../format';
import type { SoundChoice, SoundId, ThemeMode } from '../types';

const THEMES: { id: ThemeMode; label: string }[] = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

const SOUND_SLOTS: { key: 'timer' | 'focusEnd' | 'standup'; label: string }[] = [
  { key: 'timer', label: 'Timer end' },
  { key: 'focusEnd', label: 'Focus / break end' },
  { key: 'standup', label: 'Stand-up reminder' },
];

function SoundRow({
  slotKey,
  label,
}: {
  slotKey: 'timer' | 'focusEnd' | 'standup';
  label: string;
}) {
  const choice = useStore((s) => s.settings.sounds[slotKey]);
  const volume = useStore((s) => s.settings.sounds.volume);
  const setSound = useStore((s) => s.setSound);
  const fileRef = useRef<HTMLInputElement>(null);

  const pick = (soundId: SoundId) => {
    const next: SoundChoice =
      soundId === 'custom'
        ? { soundId, customDataUrl: choice.customDataUrl, customName: choice.customName }
        : { soundId };
    setSound(slotKey, next);
  };

  const importFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setSound(slotKey, {
        soundId: 'custom',
        customDataUrl: String(reader.result),
        customName: file.name,
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="soundrow">
      <div className="soundrow__label">{label}</div>
      <div className="soundrow__controls">
        <select
          className="select"
          value={choice.soundId}
          onChange={(e) => pick(e.target.value as SoundId)}
        >
          {BUILT_IN_SOUNDS.map((id) => (
            <option key={id} value={id}>
              {id[0].toUpperCase() + id.slice(1)}
            </option>
          ))}
          <option value="custom">
            {choice.customName ? `Custom: ${choice.customName}` : 'Custom file…'}
          </option>
        </select>
        <button
          className="btn btn--sm"
          onClick={() => previewSound(choice.soundId, choice, volume)}
          title="Preview"
        >
          ▶
        </button>
        <button className="btn btn--sm" onClick={() => fileRef.current?.click()}>
          Import
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*,.mp3,.wav,.ogg"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importFile(f);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}

export function SettingsTab() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const setVolume = useStore((s) => s.setVolume);
  const history = useStore((s) => s.history);
  const clearHistory = useStore((s) => s.clearHistory);

  return (
    <div className="tabpane">
      <section className="card">
        <h2 className="card__title">Appearance</h2>
        <div className="field">
          <div className="field__label">Theme</div>
          <div className="segmented">
            {THEMES.map((t) => (
              <button
                key={t.id}
                className={`seg ${settings.theme === t.id ? 'seg--active' : ''}`}
                onClick={() => updateSettings({ theme: t.id })}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <label className="switch switch--block">
          <input
            type="checkbox"
            checked={settings.minimizeToTray}
            onChange={(e) => updateSettings({ minimizeToTray: e.target.checked })}
          />
          <span>Keep running in the system tray when the window is closed</span>
        </label>
      </section>

      <section className="card">
        <h2 className="card__title">Sounds &amp; alerts</h2>
        <label className="switch switch--block">
          <input
            type="checkbox"
            checked={settings.sounds.enabled}
            onChange={(e) =>
              updateSettings({ sounds: { ...settings.sounds, enabled: e.target.checked } })
            }
          />
          <span>Play alert sounds</span>
        </label>

        <div className="field">
          <div className="field__label">Volume</div>
          <div className="volumerow">
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={settings.sounds.volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
            />
            <span className="volumerow__val">{Math.round(settings.sounds.volume * 100)}%</span>
          </div>
        </div>

        {SOUND_SLOTS.map((s) => (
          <SoundRow key={s.key} slotKey={s.key} label={s.label} />
        ))}
      </section>

      <section className="card">
        <div className="card__headerrow">
          <h2 className="card__title">History</h2>
          {history.length > 0 && (
            <button className="btn btn--sm" onClick={clearHistory}>
              Clear
            </button>
          )}
        </div>
        {history.length === 0 ? (
          <div className="empty small">No completed sessions yet.</div>
        ) : (
          <ul className="history">
            {history.slice(0, 50).map((h) => (
              <li key={h.id} className="history__item">
                <span className={`history__badge history__badge--${h.kind}`}>{h.kind}</span>
                <span className="history__label">{h.label}</span>
                <span className="history__time">
                  {formatTimeOfDay(h.at, settings.clockFormat)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card card--about">
        <div className="muted small">
          Clock &amp; Timer · settings and running timers are saved automatically and restored on
          restart.
        </div>
      </section>
    </div>
  );
}
