export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="logo">
      <svg width={size * 1.4} height={size} viewBox="0 0 42 30" aria-hidden>
        <circle cx="15" cy="15" r="12" fill="var(--you)" />
        <circle cx="27" cy="15" r="12" fill="var(--them)" style={{ mixBlendMode: 'multiply' }} />
      </svg>
      <span className="logo__word">chéo</span>
    </span>
  );
}
