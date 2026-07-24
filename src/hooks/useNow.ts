import { useEffect, useState } from 'react';

// Returns the current epoch-ms, re-rendering roughly every `intervalMs`.
// Crucially this reads Date.now() (the system clock) on every tick rather than
// incrementing a counter, so the displayed time can never drift even if a tick
// is delayed by background throttling. We also re-sync on window focus and
// visibility changes so a throttled/minimized window snaps to the correct time
// the instant it comes back.
export function useNow(intervalMs = 250): number {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    let raf = 0;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    const sync = () => setNow(Date.now());
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', sync);
    return () => {
      clearInterval(id);
      cancelAnimationFrame(raf);
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [intervalMs]);

  return now;
}
