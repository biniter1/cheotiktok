import { mockBackend } from './mock';
import { realBackend } from './real';

export const isMock = import.meta.env.VITE_MOCK === '1';
/** Server chạy thử (backend TIKTOK_MOCK=1): nút Follow gọi API giả lập thay vì mở TikTok */
export const isFakeFollow = !isMock && import.meta.env.VITE_FAKE_FOLLOW === '1';
export const backend = isMock ? mockBackend : realBackend;
