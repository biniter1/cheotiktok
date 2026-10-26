import type { PublicProfile } from '../lib/types';

interface Props {
  p: Pick<PublicProfile, 'displayName' | 'username' | 'avatarUrl'> | null | undefined;
  size?: number;
  side?: 'you' | 'them';
}

/** Ảnh TikTok nếu có; không có thì chữ cái đầu trên nền màu của phía mình/đối phương */
export function Avatar({ p, size = 48, side = 'them' }: Props) {
  const name = p?.displayName ?? p?.username ?? '?';
  const initials = name
    .split(/\s+/)
    .slice(-2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return (
    <span className={`avatar avatar--${side}`} style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden>
      {p?.avatarUrl ? <img src={p.avatarUrl} alt="" referrerPolicy="no-referrer" /> : initials}
    </span>
  );
}
