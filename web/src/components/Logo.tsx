/** Dấu nhận diện: khối duet chia đôi xanh/hồng, giữa là nhãn tích "đã follow nhau" (khớp với icon app) */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="logo">
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
        <defs>
          <clipPath id="logo-clip">
            <rect width="32" height="32" rx="9" />
          </clipPath>
        </defs>
        <g clipPath="url(#logo-clip)">
          <rect width="16" height="32" fill="var(--you)" />
          <rect x="16" width="16" height="32" fill="var(--them)" />
        </g>
        <rect x="6.5" y="12.5" width="19" height="7" rx="3.5" fill="#fff" />
        <path d="M13.6 16.1l1.8 1.7 3.2-3.4" fill="none" stroke="var(--ink)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="logo__word">chéo</span>
    </span>
  );
}
