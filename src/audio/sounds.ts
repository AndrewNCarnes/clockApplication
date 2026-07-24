import type { SoundChoice, SoundId } from '../types';

// Default alert sounds are synthesized with the Web Audio API so the app ships
// no binary audio assets and every built-in sound is distinct and tweakable.
// Users can also import their own mp3/wav, played back through the same volume
// control via an <audio> element from a data URL.

let ctx: AudioContext | null = null;

function audioContext(): AudioContext {
  if (!ctx) {
    ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  // Browsers/Electron may start the context suspended until a user gesture.
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

interface Note {
  freq: number;
  start: number; // seconds offset
  dur: number;
  type?: OscillatorType;
}

// Each built-in sound is a short melodic pattern so they're easy to tell apart.
const PATTERNS: Record<Exclude<SoundId, 'custom'>, Note[]> = {
  chime: [
    { freq: 880, start: 0, dur: 0.18 },
    { freq: 1320, start: 0.16, dur: 0.28, type: 'sine' },
  ],
  beep: [
    { freq: 720, start: 0, dur: 0.12, type: 'square' },
    { freq: 720, start: 0.18, dur: 0.12, type: 'square' },
  ],
  ding: [{ freq: 1046, start: 0, dur: 0.5, type: 'triangle' }],
  marimba: [
    { freq: 523, start: 0, dur: 0.16, type: 'triangle' },
    { freq: 659, start: 0.14, dur: 0.16, type: 'triangle' },
    { freq: 784, start: 0.28, dur: 0.26, type: 'triangle' },
  ],
  alarm: [
    { freq: 620, start: 0, dur: 0.15, type: 'sawtooth' },
    { freq: 460, start: 0.15, dur: 0.15, type: 'sawtooth' },
    { freq: 620, start: 0.3, dur: 0.15, type: 'sawtooth' },
    { freq: 460, start: 0.45, dur: 0.15, type: 'sawtooth' },
  ],
};

function playPattern(id: Exclude<SoundId, 'custom'>, volume: number) {
  const ac = audioContext();
  const now = ac.currentTime;
  const master = ac.createGain();
  master.gain.value = Math.max(0, Math.min(1, volume));
  master.connect(ac.destination);

  for (const note of PATTERNS[id]) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = note.type ?? 'sine';
    osc.frequency.value = note.freq;
    const t0 = now + note.start;
    const t1 = t0 + note.dur;
    // Simple attack/decay envelope to avoid clicks.
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(1, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t1);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t1 + 0.02);
  }
}

let customEl: HTMLAudioElement | null = null;

function playCustom(dataUrl: string, volume: number) {
  if (!customEl) customEl = new Audio();
  customEl.src = dataUrl;
  customEl.volume = Math.max(0, Math.min(1, volume));
  customEl.currentTime = 0;
  void customEl.play().catch(() => {
    /* autoplay/gesture restrictions — nothing else we can do here */
  });
}

/** Play a sound choice at the given master volume (0..1). */
export function playSound(choice: SoundChoice, volume: number) {
  if (choice.soundId === 'custom') {
    if (choice.customDataUrl) playCustom(choice.customDataUrl, volume);
    return;
  }
  playPattern(choice.soundId, volume);
}

/** Preview helper used by the settings UI. */
export function previewSound(id: SoundId, choice: SoundChoice, volume: number) {
  if (id === 'custom') {
    if (choice.customDataUrl) playCustom(choice.customDataUrl, volume);
    return;
  }
  playPattern(id, volume);
}

export const BUILT_IN_SOUNDS: Exclude<SoundId, 'custom'>[] = [
  'chime',
  'beep',
  'ding',
  'marimba',
  'alarm',
];
