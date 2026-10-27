# TikTok Chéo — Backend

Ghép cặp follow chéo realtime, xác minh follow lại, theo dõi unfollow, điểm tin cậy, xử phạt.
Node.js 22 · TypeScript · Fastify · Socket.IO · PostgreSQL · Redis · BullMQ.

## Kiến trúc HA

```
                ┌──────────── LB (nginx / Ingress) ────────────┐
                │   chỉ websocket → KHÔNG cần sticky session    │
         ┌──────┴─────┐  ┌────────────┐  ┌────────────┐
         │  API pod 1 │  │  API pod 2 │  │  API pod N │   stateless, scale ngang (HPA)
         └──────┬─────┘  └─────┬──────┘  └─────┬──────┘
                └──────────────┼───────────────┘
                     ┌─────────┴──────────┐
                     │       Redis        │  presence, hàng chờ, Socket.IO adapter,
                     │ (Sentinel/managed) │  BullMQ, rate-limit, khoá refresh token
                     └─────────┬──────────┘
         ┌─────────────┐       │       ┌──────────────┐
         │ Worker 1..N │───────┴───────│  PostgreSQL  │  (RDS Multi-AZ / Patroni)
         └─────────────┘               └──────────────┘
```

| Vấn đề khi chạy nhiều bản | Cách giải |
|---|---|
| Một người bị 2 pod ghép cùng lúc | Ghép cặp bằng **Lua script trên Redis** → atomic |
| User A ở pod 1, B ở pod 2, cần báo tin cho cả hai | **Socket.IO Redis adapter** + **redis-emitter** (worker cũng bắn event được) |
| Pod chết giữa chừng | Client tự nối lại → LB đẩy sang pod khác → vào lại hàng chờ. Trạng thái `pairing` có TTL 60s nên không kẹt vĩnh viễn |
| Verify bị chạy 2 lần (timeout + xác nhận) | `update ... where status = 'pending'` → chỉ 1 job thắng, idempotent |
| Nhiều worker cùng gọi TikTok API | **Rate limiter toàn cục** của BullMQ — thêm worker không vượt quota |
| Nhiều pod cùng refresh token 1 user | Khoá Redis `lock:refresh:<uid>` |
| Migration khi chạy nhiều bản | `pg_advisory_lock` |
| Deploy / scale xuống làm rớt request | `/readyz` trả 503 khi đang tắt → drain → đóng; rolling `maxUnavailable: 0`; PDB |

## Kết quả load test (đã chạy thật trong lúc viết)

3 instance API + 2 worker + Postgres + Redis, TikTok giả lập:

| Kịch bản | Kết quả |
|---|---|
| 300 user, mỗi người 5 lượt (1.500 lượt ghép) | 36s, **0 lỗi**, chờ ghép p50 = 99ms, p99 = 823ms |
| 300 user, **kill -9 một API pod giữa chừng** | 100 user trên pod chết **tự nối lại pod khác và chạy tiếp**, 6 thao tác dở dang bị lỗi |
| **kill -9 một worker giữa chừng** | Worker còn lại nhận hết job, không mất kết quả |
| 15 user bùng follow | 15/15 nạn nhân được báo sau ~10s, **truy đúng 15/15** kẻ bùng, mỗi kẻ bị trừ 10 điểm |

`xác nhận → kết quả p95 = 10s` là do các match mà một bên không follow phải chờ hết thời gian xác nhận (test để 10s, production 90s).

**Về tải:** 100 user online là rất nhẹ — 1 process Node giữ được hàng nghìn websocket. Chạy nhiều bản là để **không sập khi một máy chết**, không phải vì thiếu sức. Nút thắt thật khi đông là **quota TikTok API**, không phải server.

## Chạy

### Deploy lên server thật (1 máy)
Xem **[DEPLOY.md](DEPLOY.md)**: `sudo bash deploy/setup-vm.sh` một lần, sau đó `bash deploy/deploy.sh`.
Hồ sơ xin duyệt TikTok: **[TIKTOK_REVIEW.md](TIKTOK_REVIEW.md)**.

### Dev / test nhanh (Docker Compose)
```bash
cp .env.example .env            # giữ TIKTOK_MOCK=1 để chạy không cần TikTok thật
docker compose up -d --build    # 3 API + 2 worker + nginx ở :8080
docker compose up -d --scale api=5 --scale worker=3   # scale nóng
```

### Load test
```bash
npm ci && npm run build
USERS=300 MATCHES_PER_USER=5 BASE_URLS=http://localhost:8080 npm run loadtest
```
Test nhanh hơn: `MATCH_CONFIRM_TIMEOUT_SEC=10 MATCH_VERIFY_GRACE_SEC=1 POLL_INTERVAL_MIN=0.5 CORRELATE_DELAY_SEC=5 POLL_MAX_PER_MIN=6000 RATE_LIMIT_PER_MIN=100000`.

### Production (Kubernetes)
`deploy/k8s.yaml`: API (HPA 3→30, rải nhiều AZ, PDB), worker (HPA 2→10), migration Job, Ingress.
Postgres/Redis nên dùng managed có failover. Redis dùng **single/Sentinel, không dùng Cluster** (Lua script đọc nhiều key).

## Hợp đồng cho Frontend

**Đăng nhập:** chuyển hướng tới `GET /auth/tiktok` → TikTok → `/auth/tiktok/callback` → cookie `sid` (httpOnly) → về `FRONTEND_URL/zone`.

**Socket.IO** (bắt buộc `transports: ['websocket']`, `withCredentials: true`):

| Client gửi | Ý nghĩa |
|---|---|
| `heartbeat` (mỗi 10s) | báo đang online |
| `queue:join` (ack) | vào zone. Ack: `queued` / `matched` / `busy`. Nếu `busy` + `pairing` → thử lại sau 2s |
| `queue:leave` | rời zone |
| `match:confirm {matchId}` | bấm "Đã follow" |

| Server gửi | Ý nghĩa |
|---|---|
| `match:found {matchId, partner, timeoutSec}` | hiện profile đối phương + nút mở TikTok |
| `match:partner_confirmed` | đối phương đã bấm xác nhận |
| `match:result {status, youFollowed, partnerFollowed, hint}` | kết quả → client gửi lại `queue:join` để ghép người tiếp |
| `follower:drop {lost, suspects[]}` | bị tụt follow, kèm danh sách nghi phạm + link profile |
| `trust:penalty`, `appeal:resolved` | thông báo bị trừ điểm / kết quả kháng cáo |

Khi socket `reconnect` → gửi lại `queue:join`.

**REST:** `GET /me`, `GET /me/ledger`, `GET /me/suspicions`, `POST /suspicions/:id/confirm|dismiss`,
`POST /reports {targetId, note}`, `POST /appeals {suspicionId, note, evidenceUrl}`,
admin: `GET /admin/appeals`, `POST /admin/appeals/:id/resolve {accept}`.

## Luật điểm (chỉnh ở `src/domain/trust.ts`)

| Sự kiện | Điểm |
|---|---|
| Ghép thành công (tối đa 20 lần/ngày) | +1 |
| Giữ follow 7 / 30 ngày | +2 / +5 |
| Đối phương follow mà mình không follow lại | −2 |
| Bấm "Đã follow" nhưng không follow | −5 |
| Unfollow bị xác nhận | −10 |
| Xác nhận sai, bị kháng cáo lật lại | −5 (người xác nhận) |

Người mới 50 điểm. Dưới 40 → pool `low`; dưới 30 → badge cảnh báo; dưới 10 → khoá 7 ngày; 5 lần unfollow bị xác nhận → cấm vĩnh viễn theo `open_id`. Report tay không trừ điểm, chỉ bật cảnh báo khi tổng trọng số ≥ 3.

## Giới hạn cần biết

- Xác minh dựa trên **số tổng** following/follower (API TikTok không cho danh sách). Nếu user follow người ngoài đúng lúc đang ghép, có thể bị tính là đã follow; nếu nghi phạm vừa bỏ follow người khác cùng lúc, có thể bị nghi oan. Vì vậy mới có bước nạn nhân tự xác nhận + kháng cáo.
- Login Kit phải qua **app review** của TikTok trước khi dùng thật.
- `stat_snapshots` tăng nhanh: production nên partition theo tháng và xoá dữ liệu > 90 ngày.
