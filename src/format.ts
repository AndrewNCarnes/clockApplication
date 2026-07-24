import type { ClockFormat } from './types';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const pad = (n: number) => String(n).padStart(2, '0');

export function formatClock(
  ms: number,
  format: ClockFormat,
  showSeconds: boolean,
): { time: string; suffix: string } {
  const d = new Date(ms);
  let h = d.getHours();
  const m = d.getMinutes();
  const s = d.getSeconds();
  let suffix = '';
  if (format === '12h') {
    suffix = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
  }
  const hh = format === '12h' ? String(h) : pad(h);
  const time = showSeconds ? `${hh}:${pad(m)}:${pad(s)}` : `${hh}:${pad(m)}`;
  return { time, suffix };
}

export function formatDate(ms: number): string {
  const d = new Date(ms);
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** Format a millisecond countdown as H:MM:SS / M:SS. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function formatTimeOfDay(ms: number, format: ClockFormat): string {
  const { time, suffix } = formatClock(ms, format, false);
  return suffix ? `${time} ${suffix}` : time;
}
