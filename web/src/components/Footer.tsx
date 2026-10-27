import { Link } from 'react-router-dom';
import { OPERATOR } from '../lib/legal';
import { Logo } from './Logo';

/** Footer hiện trên mọi trang: link chính sách phải luôn thấy được (yêu cầu duyệt của TikTok) */
export function Footer({ compact = false }: { compact?: boolean }) {
  return (
    <footer className={`site-foot ${compact ? 'site-foot--compact' : ''}`}>
      {!compact && <Logo size={20} />}
      <nav className="site-foot__links" aria-label="Pháp lý">
        <Link to="/privacy">Quyền riêng tư (Privacy Policy)</Link>
        <Link to="/terms">Điều khoản (Terms of Service)</Link>
        <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>
      </nav>
      <p className="site-foot__note">Chéo không liên kết với TikTok. TikTok là thương hiệu của ByteDance.</p>
    </footer>
  );
}
