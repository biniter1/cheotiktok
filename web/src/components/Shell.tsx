import { NavLink, Outlet } from 'react-router-dom';
import { isFakeFollow } from '../lib/backend';
import { useMe } from '../state/me';
import { Avatar } from './Avatar';
import { Footer } from './Footer';
import { Logo } from './Logo';

const NAV = [
  { to: '/zone', label: 'Zone', icon: 'M4 12h16M12 4v16' },
  { to: '/canh-bao', label: 'Cảnh báo', icon: 'M12 4l9 16H3L12 4zm0 6v4m0 3v.5' },
  { to: '/diem', label: 'Điểm tin cậy', icon: 'M5 19V11m7 8V5m7 14v-6' },
];

function Badge({ n }: { n: number }) {
  if (n <= 0) return null;
  return <span className="badge" aria-label={`${n} cảnh báo mới`}>{n > 9 ? '9+' : n}</span>;
}

export function Shell() {
  const { me, alertCount } = useMe();
  return (
    <div className="shell">
      {isFakeFollow && (
        <div className="staging-bar" role="note">
          Bản chạy thử: tài khoản và lượt follow đều là giả lập. Mở thêm một trình duyệt khác để có người ghép cặp.
        </div>
      )}
      <header className="topbar">
        <NavLink to="/zone" className="topbar__brand" aria-label="Chéo — về Zone">
          <Logo size={24} />
        </NavLink>
        <nav className="topbar__nav" aria-label="Chính">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} className="topbar__link">
              {n.label}
              {n.to === '/canh-bao' && <Badge n={alertCount} />}
            </NavLink>
          ))}
        </nav>
        {me && (
          <NavLink to="/diem" className="topbar__me">
            <span className="topbar__score">
              <b>{me.trustScore}</b> điểm
            </span>
            <Avatar p={me} size={34} side="you" />
          </NavLink>
        )}
      </header>

      <main className="shell__main">
        <Outlet />
        <Footer compact />
      </main>

      <nav className="tabbar" aria-label="Chính">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} className="tabbar__item">
            <span className="tabbar__icon">
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
                <path d={n.icon} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {n.to === '/canh-bao' && <Badge n={alertCount} />}
            </span>
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
