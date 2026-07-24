import { useEffect, useMemo, useState } from 'react';
import { useStore } from './store/store';
import { useNow } from './hooks/useNow';
import { Header } from './components/Header';
import { Tabs, type TabId } from './components/Tabs';
import { ClockTab } from './components/ClockTab';
import { TimersTab } from './components/TimersTab';
import { FocusTab } from './components/FocusTab';
import { StandUpTab } from './components/StandUpTab';
import { SettingsTab } from './components/SettingsTab';
import { FocusIndicator } from './components/FocusIndicator';

function useThemeClass() {
  const theme = useStore((s) => s.settings.theme);
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const prefersDark =
        window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      const dark = theme === 'dark' || (theme === 'system' && prefersDark);
      root.setAttribute('data-theme', dark ? 'dark' : 'light');
    };
    apply();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}

export function App() {
  const load = useStore((s) => s.load);
  const loaded = useStore((s) => s.loaded);
  const handleFired = useStore((s) => s.handleFired);
  const toggleFocus = useStore((s) => s.toggleFocus);
  const pauseAllTimers = useStore((s) => s.pauseAllTimers);
  const resumeAllTimers = useStore((s) => s.resumeAllTimers);
  const [tab, setTab] = useState<TabId>('clock');

  useThemeClass();
  const now = useNow(250);

  useEffect(() => {
    void load();
  }, [load]);

  // Bridge main-process scheduler fires into the store.
  useEffect(() => {
    const off = window.api.onScheduleFired(({ id, kind }) => handleFired(id, kind));
    return off;
  }, [handleFired]);

  // Tray quick commands.
  useEffect(() => {
    const off = window.api.onTrayCommand((cmd) => {
      if (cmd === 'toggle-focus') toggleFocus();
      else if (cmd === 'pause-all-timers') pauseAllTimers();
      else if (cmd === 'resume-all-timers') resumeAllTimers();
    });
    return off;
  }, [toggleFocus, pauseAllTimers, resumeAllTimers]);

  const body = useMemo(() => {
    switch (tab) {
      case 'clock':
        return <ClockTab now={now} />;
      case 'timers':
        return <TimersTab now={now} />;
      case 'focus':
        return <FocusTab now={now} />;
      case 'standup':
        return <StandUpTab now={now} />;
      case 'settings':
        return <SettingsTab />;
    }
  }, [tab, now]);

  if (!loaded) {
    return (
      <div className="app app--loading">
        <div className="spinner" aria-label="Loading" />
      </div>
    );
  }

  return (
    <div className="app">
      <Header now={now} />
      <FocusIndicator now={now} />
      <Tabs active={tab} onChange={setTab} />
      <main className="content">{body}</main>
    </div>
  );
}
