import { useEffect, useState } from 'react';

/** Vòng đếm ngược thời gian xác nhận của lượt ghép */
export function Countdown({ deadline, total }: { deadline: number; total: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Math.ceil((deadline - now) / 1000));
  const frac = Math.max(0, (deadline - now) / (total * 1000));
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className={`countdown ${left <= 15 ? 'countdown--low' : ''}`} role="timer" aria-label={`Còn ${left} giây`}>
      <svg viewBox="0 0 64 64" aria-hidden>
        <circle cx="32" cy="32" r={r} className="countdown__bg" />
        <circle
          cx="32"
          cy="32"
          r={r}
          className="countdown__fg"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
        />
      </svg>
      <span>{left}</span>
    </div>
  );
}
