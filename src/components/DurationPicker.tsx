import { useEffect, useState } from 'react';

// Small h/m/s picker used by the timer and focus creation forms.
export function DurationPicker({
  valueMs,
  onChange,
  showHours = true,
}: {
  valueMs: number;
  onChange: (ms: number) => void;
  showHours?: boolean;
}) {
  const [h, setH] = useState(Math.floor(valueMs / 3_600_000));
  const [m, setM] = useState(Math.floor((valueMs % 3_600_000) / 60_000));
  const [s, setS] = useState(Math.floor((valueMs % 60_000) / 1000));

  useEffect(() => {
    setH(Math.floor(valueMs / 3_600_000));
    setM(Math.floor((valueMs % 3_600_000) / 60_000));
    setS(Math.floor((valueMs % 60_000) / 1000));
  }, [valueMs]);

  const push = (nh: number, nm: number, ns: number) => {
    const ms = (nh * 3600 + nm * 60 + ns) * 1000;
    onChange(ms);
  };

  const clamp = (n: number, max: number) => Math.max(0, Math.min(max, Number.isFinite(n) ? n : 0));

  return (
    <div className="duration">
      {showHours && (
        <label className="duration__field">
          <input
            type="number"
            min={0}
            max={99}
            value={h}
            onChange={(e) => {
              const v = clamp(parseInt(e.target.value, 10), 99);
              setH(v);
              push(v, m, s);
            }}
          />
          <span>hr</span>
        </label>
      )}
      <label className="duration__field">
        <input
          type="number"
          min={0}
          max={59}
          value={m}
          onChange={(e) => {
            const v = clamp(parseInt(e.target.value, 10), 59);
            setM(v);
            push(h, v, s);
          }}
        />
        <span>min</span>
      </label>
      <label className="duration__field">
        <input
          type="number"
          min={0}
          max={59}
          value={s}
          onChange={(e) => {
            const v = clamp(parseInt(e.target.value, 10), 59);
            setS(v);
            push(h, m, v);
          }}
        />
        <span>sec</span>
      </label>
    </div>
  );
}
