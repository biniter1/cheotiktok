import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { Countdown } from '../components/Countdown';
import { backend } from '../lib/backend';
import { errorText, handle, TIER } from '../lib/copy';
import type { Me, PublicProfile } from '../lib/types';
import { useMe } from '../state/me';
import { useZone, type Phase } from '../state/useZone';

function PersonSide({ p, side, status }: { p: PublicProfile | Me; side: 'you' | 'them'; status: string }) {
  return (
    <div className="person">
      <Avatar p={p} size={96} side={side} />
      <div className="person__name">{p.displayName ?? handle(p)}</div>
      <div className="person__handle">{handle(p)}</div>
      <div className="person__meta">
        <span className="tier">{p.trustScore} điểm</span>
        <span className="tier">{TIER[p.tier].name}</span>
        {p.warning && <span className="flag">Hay bỏ follow</span>}
      </div>
      <div className="person__status">{status}</div>
    </div>
  );
}

function partnerStatus(phase: Phase): string {
  if (phase.k === 'matched') return phase.partnerConfirmed ? 'Đã bấm “Mình đã follow”' : 'Đang mở TikTok của bạn…';
  if (phase.k === 'result') return phase.result.partnerFollowed ? 'Đã follow bạn' : 'Không follow bạn';
  return '';
}

function youStatus(phase: Phase): string {
  if (phase.k === 'matched') {
    if (phase.iConfirmed) return 'Đã xác nhận, chờ hệ thống kiểm tra';
    return phase.opened ? 'Follow xong thì bấm xác nhận' : 'Mở TikTok của họ để follow';
  }
  if (phase.k === 'result') return phase.result.youFollowed ? 'Đã follow họ' : 'Chưa follow họ';
  if (phase.k === 'queued') return 'Đang trong zone';
  return 'Sẵn sàng';
}

function ResultLine({ phase }: { phase: Extract<Phase, { k: 'result' }> }) {
  const { status, youFollowed } = phase.result;
  const who = handle(phase.partner);
  if (status === 'ok') return <p className="verdict verdict--ok">Hai bạn đã follow nhau. Bạn được cộng 1 điểm.</p>;
  if (status === 'expired') return <p className="verdict">Hết giờ, chưa ai follow. Không ai bị trừ điểm.</p>;
  if (youFollowed)
    return (
      <p className="verdict verdict--warn">
        {who} không follow lại và đã bị trừ điểm. Bạn có thể bỏ follow họ, việc này không ảnh hưởng điểm của bạn.
      </p>
    );
  return <p className="verdict verdict--bad">Bạn chưa follow lại {who} nên bị trừ 2 điểm.</p>;
}

export function Zone() {
  const { me, refresh } = useMe();
  const onDone = useCallback(() => void refresh(), [refresh]);
  const { phase, join, leave, confirm, markOpened, autoNext, setAutoNext, okCount } = useZone(onDone);

  if (!me) return <div className="page-loading">Đang tải…</div>;

  const partner = phase.k === 'matched' ? phase.match.partner : phase.k === 'result' ? phase.partner : null;
  const merged = phase.k === 'result' && phase.result.status === 'ok';
  const stageState = phase.k === 'result' ? `result-${phase.result.status}` : phase.k;
  const offSides =
    phase.k === 'result' && phase.result.status !== 'ok' && phase.result.status !== 'expired'
      ? `${phase.result.youFollowed ? '' : 'stage--you-no'} ${phase.result.partnerFollowed ? '' : 'stage--them-no'}`
      : '';
  const inZone = phase.k !== 'idle' && phase.k !== 'error';

  return (
    <div className="zone">
      <div className={`stage stage--${stageState} ${offSides}`} aria-live="polite">
        <section className="half half--you" aria-label="Bạn">
          <PersonSide p={me} side="you" status={youStatus(phase)} />
        </section>

        <div className="seam" aria-hidden={!(phase.k === 'matched' || merged)}>
          {phase.k === 'matched' && <Countdown deadline={phase.deadline} total={phase.match.timeoutSec} />}
          {merged && <span className="friends">Bạn bè</span>}
        </div>

        <section className="half half--them" aria-label="Đối phương">
          {partner ? (
            <PersonSide p={partner} side="them" status={partnerStatus(phase)} />
          ) : phase.k === 'queued' ? (
            <div className="waiting">
              <span className="waiting__pulse" aria-hidden />
              <p>Đang tìm người cũng đang online…</p>
            </div>
          ) : (
            <div className="waiting">
              <p>Vào zone để được ghép với người đang online ngay lúc này.</p>
            </div>
          )}
        </section>
      </div>

      <div className="controls">
        {phase.k === 'idle' && (
          <button className="btn btn--you btn--lg" onClick={() => void join()}>
            Vào zone
          </button>
        )}

        {phase.k === 'error' && (
          <div className="notice notice--bad">
            <p>{errorText(phase.code)}</p>
            {phase.code === 'TRACKING_LOST' || phase.code === 'UNAUTHORIZED' ? (
              <a className="btn btn--ink" href={backend.loginUrl}>Đăng nhập lại bằng TikTok</a>
            ) : (
              <button className="btn btn--ink" onClick={() => void join()}>Thử lại</button>
            )}
          </div>
        )}

        {phase.k === 'queued' && (
          <button className="btn btn--ghost" onClick={() => void leave()}>
            Rời zone
          </button>
        )}

        {phase.k === 'matched' && (
          <ol className="steps">
            <li className={phase.opened ? 'steps__done' : ''}>
              <a
                className="btn btn--them"
                href={phase.match.partner.profileUrl ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                onClick={markOpened}
              >
                Mở TikTok của {handle(phase.match.partner)}
              </a>
              <span className="steps__hint">Bấm Follow trên trang của họ rồi quay lại đây.</span>
            </li>
            <li>
              <button
                className="btn btn--you"
                disabled={!phase.opened || phase.iConfirmed || phase.confirming}
                onClick={() => void confirm()}
              >
                {phase.iConfirmed ? 'Đã xác nhận' : phase.confirming ? 'Đang gửi…' : 'Mình đã follow'}
              </button>
              <span className="steps__hint">
                Hệ thống tự kiểm tra số following của bạn. Bấm khi chưa follow sẽ bị trừ 5 điểm.
              </span>
            </li>
          </ol>
        )}

        {phase.k === 'result' && (
          <div className="after">
            <ResultLine phase={phase} />
            {autoNext ? (
              <div className="after__row">
                <span className="after__next">Đang ghép người tiếp theo…</span>
                <button className="btn btn--ghost" onClick={() => void leave()}>Dừng lại</button>
              </div>
            ) : (
              <div className="after__row">
                <button className="btn btn--you" onClick={() => void join()}>Ghép người tiếp theo</button>
                <button className="btn btn--ghost" onClick={() => void leave()}>Rời zone</button>
              </div>
            )}
          </div>
        )}
      </div>

      <footer className="zone__foot">
        <label className="switch">
          <input type="checkbox" checked={autoNext} onChange={(e) => setAutoNext(e.target.checked)} />
          <span className="switch__ui" aria-hidden />
          Tự ghép người tiếp theo
        </label>
        <span className="zone__count">
          Chéo thành công phiên này: <b>{okCount}</b>
        </span>
        {inZone && phase.k !== 'queued' && phase.k !== 'result' && (
          <span className="zone__rule">Mỗi người chỉ được ghép với bạn một lần.</span>
        )}
        {!inZone && (
          <Link to="/diem" className="zone__rule">Cách tính điểm tin cậy</Link>
        )}
      </footer>
    </div>
  );
}
