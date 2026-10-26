/** Mọi câu chữ hiển thị liên quan tới mã backend gom về một chỗ */

export const REASON: Record<string, string> = {
  MATCH_OK: 'Chéo thành công',
  RETAIN_7D: 'Giữ follow đủ 7 ngày',
  RETAIN_30D: 'Giữ follow đủ 30 ngày',
  NO_FOLLOW: 'Không follow lại người đã follow bạn',
  FAKE_CONFIRM: 'Bấm “Mình đã follow” nhưng chưa follow',
  UNFOLLOW_CONFIRMED: 'Bỏ follow và bị xác nhận',
  FALSE_REPORT: 'Xác nhận sai người khác bỏ follow',
  APPEAL_REFUND: 'Hoàn điểm sau kháng cáo',
  ADMIN_ADJUST: 'Quản trị điều chỉnh',
};

export const TIER: Record<string, { name: string; desc: string }> = {
  low: { name: 'Cần cải thiện', desc: 'Bạn chỉ được ghép với người cùng nhóm điểm thấp.' },
  mid: { name: 'Ổn định', desc: 'Bạn được ghép với phần lớn người dùng.' },
  high: { name: 'Đáng tin', desc: 'Bạn được ghép với những người giữ follow tốt nhất.' },
};

export const ERROR: Record<string, string> = {
  ACCOUNT_SUSPENDED: 'Tài khoản đang bị khoá tạm vì điểm tin cậy dưới 10.',
  ACCOUNT_BANNED: 'Tài khoản đã bị cấm vì bỏ follow nhiều lần.',
  TRACKING_LOST: 'Mất quyền đọc số follow. Đăng nhập lại bằng TikTok để tiếp tục.',
  MATCH_NOT_PENDING: 'Lượt ghép này đã kết thúc.',
  TIMEOUT: 'Mất kết nối tới máy chủ. Đang thử lại.',
  UNAUTHORIZED: 'Phiên đăng nhập đã hết. Đăng nhập lại để tiếp tục.',
};

export const errorText = (code: string) => ERROR[code] ?? 'Có lỗi xảy ra. Thử lại sau ít phút.';

export function timeAgo(iso: string): string {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'vừa xong';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} phút trước`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} giờ trước`;
  return `${Math.round(h / 24)} ngày trước`;
}

export const handle = (p?: { username: string | null; displayName: string | null } | null) =>
  p?.username ? `@${p.username}` : p?.displayName ?? 'Người dùng';
