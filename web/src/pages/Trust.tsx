import { useEffect, useState } from 'react';
import { TrustMeter } from '../components/TrustMeter';
import { backend } from '../lib/backend';
import { REASON, TIER, timeAgo } from '../lib/copy';
import type { LedgerEntry } from '../lib/types';
import { useMe } from '../state/me';

const RULES: [string, string][] = [
  ['Chéo thành công, tối đa 20 lần mỗi ngày', '+1'],
  ['Giữ follow đủ 7 ngày', '+2'],
  ['Giữ follow đủ 30 ngày', '+5'],
  ['Người kia follow mà bạn không follow lại', '−2'],
  ['Bấm “Mình đã follow” nhưng chưa follow', '−5'],
  ['Bỏ follow và bị người kia xác nhận', '−10'],
];

export function Trust() {
  const { me } = useMe();
  const [ledger, setLedger] = useState<LedgerEntry[] | null>(null);

  useEffect(() => {
    backend.ledger().then(setLedger).catch(() => setLedger([]));
  }, [me?.trustScore]);

  if (!me) return <div className="page-loading">Đang tải…</div>;
  const tier = TIER[me.tier];

  return (
    <div className="page trust">
      <section className="trust__hero">
        <div className="trust__score" aria-label={`${me.trustScore} điểm tin cậy`}>
          {me.trustScore}
        </div>
        <div className="trust__tier">
          <h1>{tier.name}</h1>
          <p>{tier.desc}</p>
          {me.status === 'suspended' && me.bannedUntil && (
            <p className="flag flag--block">
              Bị khoá tạm tới {new Date(me.bannedUntil).toLocaleString('vi-VN')}.
            </p>
          )}
        </div>
      </section>

      <TrustMeter score={me.trustScore} />

      {me.stats && (
        <section className="tt-stats" aria-labelledby="tt-stats-h">
          <h2 id="tt-stats-h">Số liệu TikTok của bạn</h2>
          <dl className="tt-stats__grid">
            <div>
              <dt>Follower</dt>
              <dd>{me.stats.followerCount.toLocaleString('vi-VN')}</dd>
            </div>
            <div>
              <dt>Đang follow</dt>
              <dd>{me.stats.followingCount.toLocaleString('vi-VN')}</dd>
            </div>
            <div>
              <dt>Follower 7 ngày qua</dt>
              <dd className={me.stats.followerDelta7d > 0 ? 'pos' : me.stats.followerDelta7d < 0 ? 'neg' : ''}>
                {me.stats.followerDelta7d > 0 ? '+' : me.stats.followerDelta7d < 0 ? '−' : ''}
                {Math.abs(me.stats.followerDelta7d).toLocaleString('vi-VN')}
              </dd>
            </div>
          </dl>
          <p className="trust__note">
            Cập nhật {timeAgo(me.stats.statsTakenAt)}. Chéo đọc hai con số này từ TikTok để kiểm tra bạn đã follow lại
            người được ghép chưa, và để phát hiện khi số follower của bạn giảm. Chéo không đọc danh sách follower,
            video hay tin nhắn của bạn.
          </p>
        </section>
      )}

      <div className="trust__cols">
        <section>
          <h2>Luật tính điểm</h2>
          <table className="rules">
            <tbody>
              {RULES.map(([what, d]) => (
                <tr key={what}>
                  <td>{what}</td>
                  <td className={d.startsWith('+') ? 'pos' : 'neg'}>{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="trust__note">
            Người mới bắt đầu ở 50 điểm. Dưới 30 điểm, người được ghép với bạn sẽ thấy nhãn “Hay bỏ follow”.
            Dưới 10 điểm, tài khoản bị khoá 7 ngày. Bị xác nhận bỏ follow 5 lần thì bị cấm vĩnh viễn.
          </p>
        </section>

        <section>
          <h2>Lịch sử điểm</h2>
          {ledger === null && <div className="page-loading">Đang tải…</div>}
          {ledger?.length === 0 && <p className="trust__note">Chưa có thay đổi nào. Vào zone để chéo lượt đầu tiên.</p>}
          {ledger && ledger.length > 0 && (
            <ul className="ledger">
              {ledger.map((l, i) => (
                <li key={i}>
                  <span className="ledger__what">{REASON[l.reason] ?? l.reason}</span>
                  <span className="ledger__when">{timeAgo(l.created_at)}</span>
                  <span className={`ledger__d ${l.delta > 0 ? 'pos' : l.delta < 0 ? 'neg' : ''}`}>
                    {l.delta > 0 ? `+${l.delta}` : l.delta === 0 ? '0' : `−${-l.delta}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <DeleteAccount />
    </div>
  );
}

function DeleteAccount() {
  const [step, setStep] = useState<'idle' | 'confirm' | 'deleting' | 'error'>('idle');
  async function run() {
    setStep('deleting');
    try {
      await backend.deleteAccount();
      window.location.assign('/');
    } catch {
      setStep('error');
    }
  }
  return (
    <section className="danger-zone" aria-labelledby="del-h">
      <h2 id="del-h">Xoá tài khoản</h2>
      <p>
        Xoá quyền truy cập TikTok, số liệu follower và tên, ảnh của bạn khỏi Chéo. Người từng chéo với bạn sẽ
        không còn được theo dõi follow với bạn. Không hoàn tác được.
      </p>
      {step === 'idle' && (
        <button className="btn btn--ghost" onClick={() => setStep('confirm')}>Xoá tài khoản</button>
      )}
      {(step === 'confirm' || step === 'deleting' || step === 'error') && (
        <div className="danger-zone__confirm">
          <p>
            {step === 'error'
              ? 'Không xoá được. Kiểm tra kết nối rồi thử lại.'
              : 'Chắc chắn xoá? Điểm tin cậy hiện tại vẫn áp dụng nếu bạn đăng ký lại sau này.'}
          </p>
          <div className="after__row">
            <button className="btn btn--danger" disabled={step === 'deleting'} onClick={() => void run()}>
              {step === 'deleting' ? 'Đang xoá…' : 'Xoá vĩnh viễn'}
            </button>
            <button className="btn btn--ghost" disabled={step === 'deleting'} onClick={() => setStep('idle')}>
              Giữ tài khoản
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
