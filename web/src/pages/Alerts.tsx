import { useEffect, useState } from 'react';
import { Avatar } from '../components/Avatar';
import { backend } from '../lib/backend';
import { handle, timeAgo } from '../lib/copy';
import type { Suspicion } from '../lib/types';
import { useMe } from '../state/me';

type Busy = { id: number; action: 'confirm' | 'dismiss' } | null;

function SuspectItem({ s, onAnswer, busy }: { s: Suspicion; onAnswer: (a: 'confirm' | 'dismiss') => void; busy: Busy }) {
  const [opened, setOpened] = useState(false);
  const who = handle(s.suspect);
  const isBusy = busy?.id === s.id;
  return (
    <li className="suspect">
      <div className="suspect__head">
        <Avatar p={s.suspect} size={52} />
        <div>
          <div className="suspect__name">{s.suspect?.displayName ?? who}</div>
          <div className="suspect__meta">
            {who}, {timeAgo(s.created_at)}
          </div>
        </div>
      </div>
      <p className="suspect__why">
        Bạn mất {s.lost} follow. Cùng lúc đó, số người mà {who} đang follow giảm {s.following_delta}.
      </p>
      <ol className="suspect__steps">
        <li>
          <a
            className="btn btn--them btn--sm"
            href={s.suspect?.profileUrl ?? '#'}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpened(true)}
          >
            Mở TikTok của {who}
          </a>
        </li>
        <li>
          <span className="suspect__q">Nút trên trang của họ đang hiện chữ gì?</span>
          <div className="tt-choices" role="group" aria-label={`Kết quả kiểm tra ${who}`}>
            <button
              className="tt-btn tt-btn--friends"
              disabled={!opened || isBusy}
              onClick={() => onAnswer('dismiss')}
            >
              <span className="tt-btn__label">Bạn bè</span>
              <span className="tt-btn__mean">Họ vẫn follow bạn</span>
            </button>
            <button
              className="tt-btn tt-btn--following"
              disabled={!opened || isBusy}
              onClick={() => onAnswer('confirm')}
            >
              <span className="tt-btn__label">Đang follow</span>
              <span className="tt-btn__mean">Họ đã bỏ follow bạn</span>
            </button>
          </div>
          {!opened && <span className="steps__hint">Mở trang của họ trước để kiểm tra.</span>}
        </li>
      </ol>
    </li>
  );
}

export function Alerts() {
  const { setAlertCount } = useMe();
  const [items, setItems] = useState<Suspicion[] | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const load = () =>
    backend
      .suspicions()
      .then((s) => {
        setItems(s);
        setAlertCount(s.length);
        setFailed(false);
      })
      .catch(() => setFailed(true));

  useEffect(() => {
    void load();
    return backend.zone.on('follower:drop', () => void load());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function answer(s: Suspicion, action: 'confirm' | 'dismiss') {
    setBusy({ id: s.id, action });
    try {
      if (action === 'confirm') await backend.confirmSuspicion(s.id);
      else await backend.dismissSuspicion(s.id);
      setItems((cur) => {
        const next = (cur ?? []).filter((x) => x.id !== s.id);
        setAlertCount(next.length);
        return next;
      });
      setToast(
        action === 'confirm'
          ? `Đã ghi nhận. ${handle(s.suspect)} bị trừ 10 điểm và bị gắn vào lịch sử.`
          : `Đã ghi nhận ${handle(s.suspect)} vẫn follow bạn.`,
      );
      setTimeout(() => setToast(null), 4000);
    } catch {
      setToast('Không gửi được. Kiểm tra kết nối rồi thử lại.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="page">
      <header className="page__head">
        <h1>Cảnh báo</h1>
        <p>
          Khi số follower của bạn tụt, Chéo tìm những người từng chéo với bạn có số following giảm cùng lúc.
          Bạn kiểm tra trên TikTok rồi trả lời một câu là xong.
        </p>
      </header>

      {failed && <div className="notice notice--bad"><p>Không tải được danh sách. Thử tải lại trang.</p></div>}
      {items === null && !failed && <div className="page-loading">Đang tải…</div>}

      {items && items.length === 0 && (
        <div className="empty">
          <h2>Chưa ai bỏ follow bạn</h2>
          <p>Chéo kiểm tra số follower của bạn mỗi 15 phút. Có người bỏ follow, bạn sẽ thấy họ ở đây.</p>
        </div>
      )}

      {items && items.length > 0 && (
        <ul className="suspects">
          {items.map((s) => (
            <SuspectItem key={s.id} s={s} busy={busy} onAnswer={(a) => void answer(s, a)} />
          ))}
        </ul>
      )}

      <div className={`toast ${toast ? 'toast--show' : ''}`} role="status">
        {toast}
      </div>
    </div>
  );
}
