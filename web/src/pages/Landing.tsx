import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { Footer } from '../components/Footer';
import { Logo } from '../components/Logo';
import { backend, isMock } from '../lib/backend';
import { useMe } from '../state/me';

const YOU = { displayName: 'Bạn', username: 'ban.dang.len.1k', avatarUrl: null };
const THEM = { displayName: 'Ngọc Hân', username: 'hanreview.skincare', avatarUrl: null };

// Thời điểm (ms) từng bước của đoạn demo một lượt ghép
const BEATS = [900, 2200, 3300, 4300];

function DuetDemo() {
  const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [beat, setBeat] = useState(reduce ? BEATS.length : 0);
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (reduce) return;
    setBeat(0);
    const ts = BEATS.map((t, i) => setTimeout(() => setBeat(i + 1), t));
    return () => ts.forEach(clearTimeout);
  }, [run, reduce]);

  const merged = beat >= 4;
  return (
    <figure className="demo">
      <div className={`stage stage--demo ${merged ? 'stage--result-ok' : beat >= 1 ? 'stage--matched' : 'stage--queued'}`}>
        <section className="half half--you">
          <div className="person">
            <Avatar p={YOU} size={64} side="you" />
            <div className="person__handle">@{YOU.username}</div>
            <div className="person__status">{beat >= 2 ? 'Đã follow' : 'Đang mở TikTok…'}</div>
          </div>
        </section>
        <div className="seam">{merged && <span className="friends">Bạn bè</span>}</div>
        <section className="half half--them">
          {beat >= 1 ? (
            <div className="person">
              <Avatar p={THEM} size={64} side="them" />
              <div className="person__handle">@{THEM.username}</div>
              <div className="person__status">{beat >= 3 ? 'Đã follow' : 'Đang mở TikTok…'}</div>
            </div>
          ) : (
            <div className="waiting">
              <span className="waiting__pulse" aria-hidden />
            </div>
          )}
        </section>
      </div>
      <figcaption>
        Một lượt chéo trong vài giây.
        {!reduce && merged && (
          <button className="linklike" onClick={() => setRun((r) => r + 1)}>
            Xem lại
          </button>
        )}
      </figcaption>
    </figure>
  );
}

export function Landing() {
  const { me, loading } = useMe();
  if (!loading && me && !isMock) return <Navigate to="/zone" replace />;

  const cta = isMock ? (
    <Link to="/zone" className="btn btn--ink btn--lg">Đăng nhập bằng TikTok</Link>
  ) : (
    <a href={backend.loginUrl} className="btn btn--ink btn--lg">Đăng nhập bằng TikTok</a>
  );

  return (
    <div className="landing">
      <header className="landing__bar">
        <Logo size={26} />
        {cta && <a href={isMock ? '#/zone' : backend.loginUrl} className="landing__login">Đăng nhập</a>}
      </header>

      <section className="hero">
        <div className="hero__copy">
          <h1 className="hero__title">
            <span>Chéo follow với người đang online.</span> <span>Ai bùng là biết.</span>
          </h1>
          <p className="hero__lead">
            Không phải đăng bài xin chéo rồi chờ cả buổi. Vào zone, Chéo ghép bạn với một người cũng đang online,
            hai bên follow nhau trong 90 giây và hệ thống tự kiểm tra.
          </p>
          <div className="hero__cta">{cta}</div>
          <p className="hero__fine">Chéo chỉ đọc số follower và following công khai. Không đăng bài, không follow thay bạn.</p>
        </div>
        <DuetDemo />
      </section>

      <section className="how">
        <h2>Một lượt chéo diễn ra thế nào</h2>
        <ol className="how__list">
          <li>
            <h3>Ghép cặp</h3>
            <p>Bạn vào zone và được ghép ngay với một người đang online. Mỗi người chỉ gặp bạn một lần.</p>
          </li>
          <li>
            <h3>Follow nhau</h3>
            <p>Mở TikTok của họ, bấm Follow, quay lại bấm “Mình đã follow”. Người kia làm y như vậy.</p>
          </li>
          <li>
            <h3>Hệ thống kiểm tra</h3>
            <p>Chéo so số following của hai bên trước và sau lượt ghép. Ai không follow thật sẽ bị trừ điểm.</p>
          </li>
          <li>
            <h3>Theo dõi về sau</h3>
            <p>Số follower của bạn tụt, Chéo chỉ ra ai có khả năng đã bỏ follow để bạn kiểm tra và báo lại.</p>
          </li>
        </ol>
      </section>

      <section className="rules-teaser">
        <div>
          <h2>Bùng follow thì mất điểm, mất điểm thì mất người chéo</h2>
          <p>
            Ai cũng bắt đầu với 50 điểm tin cậy. Giữ follow lâu được cộng, bỏ follow bị trừ 10. Người điểm thấp chỉ
            được ghép với nhau, nên người giữ chữ tín luôn gặp người giữ chữ tín.
          </p>
        </div>
        <dl className="rules-teaser__nums">
          <div><dt>Giữ follow 30 ngày</dt><dd className="pos">+5</dd></div>
          <div><dt>Bỏ follow bị xác nhận</dt><dd className="neg">−10</dd></div>
          <div><dt>Bị xác nhận 5 lần</dt><dd className="neg">Cấm</dd></div>
        </dl>
      </section>

      <Footer />
    </div>
  );
}
