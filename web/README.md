# Chéo — Frontend

React 19 · Vite · TypeScript · Socket.IO client. CSS viết tay, không framework UI.

## Chạy

```bash
npm install
npm run dev:mock     # giả lập toàn bộ backend trong trình duyệt, không cần server
npm run dev          # nối backend thật (mặc định proxy tới http://localhost:8080)
API_ORIGIN=http://localhost:3000 npm run dev   # đổi địa chỉ backend
npm run build        # bản production -> dist/
SINGLE_FILE=1 npm run build:mock   # bản demo 1 file HTML -> dist-demo/
```

Dev dùng proxy của Vite nên frontend và API chung origin, cookie đăng nhập chạy ngay.
Production: đặt frontend và API cùng domain (khuyên dùng, nginx route `/auth`, `/me`, `/socket.io`… về API),
hoặc khác subdomain thì build với `VITE_API_URL=https://api.ten-mien.com` và để cookie `SameSite=Lax` (cùng site).
Backend cần `FRONTEND_URL` trỏ đúng domain frontend để chuyển hướng sau khi đăng nhập.

## Deploy lên Vercel

1. Import repo trên Vercel, đặt **Root Directory = `web`** (framework Vite tự nhận, `vercel.json` đã có rewrite cho router).
2. Environment Variable: `VITE_API_URL=https://api.cheo.vn` (domain backend của bạn).
3. Gắn **custom domain** cho frontend, ví dụ `cheo.vn`. Bắt buộc: frontend và API phải **cùng domain gốc**
   (`cheo.vn` + `api.cheo.vn`). Dùng `*.vercel.app` thì cookie đăng nhập bị trình duyệt chặn vì khác site.
4. Bên backend đặt `FRONTEND_URL=https://cheo.vn` (dùng cho CORS và chuyển hướng sau đăng nhập)
   và `TIKTOK_REDIRECT_URI=https://api.cheo.vn/auth/tiktok/callback`.

Preview deployment của Vercel (`*.vercel.app`) chỉ dùng được ở chế độ giả lập: đặt `VITE_MOCK=1` cho môi trường Preview.

## Cấu trúc

```
src/
  lib/types.ts       hợp đồng dữ liệu với backend (khớp README backend)
  lib/real.ts        REST + Socket.IO thật (chỉ websocket, tự heartbeat)
  lib/mock.ts        backend giả lập cùng interface
  lib/copy.ts        toàn bộ câu chữ hiển thị cho mã lỗi, lý do trừ điểm, nhóm điểm
  state/useZone.ts   máy trạng thái ghép cặp: idle → queued → matched → result → tự ghép tiếp
  state/me.tsx       thông tin tài khoản + số cảnh báo realtime
  pages/             Landing, Zone, Alerts (Cảnh báo), Trust (Điểm tin cậy)
  styles/app.css     toàn bộ hệ thống giao diện, token màu ở đầu file
```

## Hệ thống giao diện "Duet"

Mỗi lượt ghép là một màn duet: nửa xanh là bạn, nửa hồng là đối phương. Khi cả hai follow nhau,
đường nối khép lại thành nhãn "Bạn bè", đúng chữ TikTok hiện khi hai người follow nhau.
Đây là điểm nhấn duy nhất, các phần còn lại giữ tối giản.

- Màu: Mây `#EEF1F8` nền, Mực `#191B3A` chữ, Bạn `#3550FF`, Đối phương `#FF4F8B`, Rêu `#0E9F7A` (tốt), Đỏ `#D93D4A` (trừ điểm)
- Chữ: Bricolage Grotesque (tiêu đề, con số) + Be Vietnam Pro (nội dung), tự host qua Fontsource, đủ dấu tiếng Việt
- Mobile-first: dưới 720px có tab bar dưới đáy, sân duet xếp trên/dưới
- Vạch trên thước điểm là ngưỡng luật thật (10 khoá tạm, 30 cảnh báo, 40/70 nhóm ghép)
- Trang Cảnh báo hỏi đúng thứ người dùng thấy trên TikTok: nút đang hiện "Bạn bè" hay "Đang follow"
- Tôn trọng `prefers-reduced-motion`, focus bàn phím rõ, nút xác nhận chỉ bật sau khi đã mở TikTok của đối phương
