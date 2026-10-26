/**
 * Thước điểm 0–100. Các vạch là ngưỡng luật thật của hệ thống (không phải trang trí):
 * 10 khoá tạm · 30 gắn cảnh báo · 40 / 70 ranh giới nhóm ghép.
 */
const MARKS = [
  { at: 10, label: 'Khoá tạm' },
  { at: 30, label: 'Cảnh báo' },
  { at: 40, label: 'Ổn định' },
  { at: 70, label: 'Đáng tin' },
];

export function TrustMeter({ score, compact = false }: { score: number; compact?: boolean }) {
  const tone = score < 30 ? 'danger' : score < 40 ? 'warn' : 'ok';
  return (
    <div
      className={`meter meter--${tone} ${compact ? 'meter--compact' : ''}`}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={score}
      aria-label="Điểm tin cậy"
    >
      <div className="meter__track">
        <div className="meter__fill" style={{ width: `${score}%` }} />
        {MARKS.map((m) => (
          <span key={m.at} className="meter__tick" style={{ left: `${m.at}%` }} />
        ))}
      </div>
      {!compact && (
        <div className="meter__labels" aria-hidden>
          {MARKS.map((m) => (
            <span key={m.at} style={{ left: `${m.at}%` }}>
              <b>{m.at}</b>
              {m.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
