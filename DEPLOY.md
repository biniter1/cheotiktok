# Deploy lên 1 máy Azure

Một máy chạy toàn bộ: Caddy (HTTPS tự động + frontend) → 2 bản API → worker, Postgres, Redis.
Frontend và API chung một domain nên đăng nhập, socket chạy ngay, không lo cookie khác site.

```
Internet ─► Caddy :443 ─┬─ /auth /me /socket.io ... ─► api ×2 ─┐
                        └─ còn lại ─► frontend (file tĩnh)       ├─► Postgres, Redis
                                                worker ──────────┘
```

## 1. Tạo máy ảo (Azure Portal)

**Virtual machines → Create → Azure virtual machine**

| Mục | Chọn |
|---|---|
| Subscription | Azure for Students |
| Region | Southeast Asia (Singapore). Nếu bị chặn bởi policy của gói sinh viên thì chọn East Asia |
| Image | Ubuntu Server 24.04 LTS – x64 |
| Size | **B2s** (2 vCPU, 4 GB). Muốn tiết kiệm credit: B1ms (1 vCPU, 2 GB) vẫn chạy được |
| Authentication | SSH public key, tải file `.pem` về và giữ kỹ |
| Inbound ports | SSH (22), HTTP (80), HTTPS (443) |

Tạo xong, vào **Public IP address** của máy:
- **Configuration → DNS name label**: đặt ví dụ `cheo-bin` → có domain miễn phí
  `cheo-bin.southeastasia.cloudapp.azure.com`
- **Assignment: Static** (để IP không đổi khi khởi động lại máy)

## 2. SSH vào máy

Windows PowerShell (lần đầu sửa quyền file key, nếu không SSH sẽ từ chối):

```powershell
icacls .\cheo_key.pem /inheritance:r /grant:r "$($env:USERNAME):(R)"
ssh -i .\cheo_key.pem azureuser@<IP-máy>
```

## 3. Lấy code và dựng máy (chỉ làm 1 lần)

Repo private → tạo token: GitHub → Settings → Developer settings → **Fine-grained tokens** →
chỉ chọn repo `cheotiktok`, quyền **Contents: Read-only**. Khi `git clone` hỏi password thì dán token.

```bash
git clone https://github.com/biniter1/cheotiktok.git
cd cheotiktok
sudo bash deploy/setup-vm.sh     # cài Docker, swap, lịch backup
exit                             # thoát rồi SSH vào lại để quyền docker có hiệu lực
```

## 4. Chạy

```bash
cd cheotiktok
bash deploy/deploy.sh
```

Lần đầu script hỏi:
- **Domain**: nhập domain Azure ở bước 1 (Enter để dùng `<ip>.sslip.io`)
- **Chạy thử với TikTok giả lập?** Enter = Có

Script tự sinh mật khẩu DB, JWT, khoá mã hoá vào `.env.prod`, build, chạy, chờ HTTPS sẵn sàng rồi in địa chỉ.

## Chế độ chạy thử (chưa có app TikTok)

- Bấm "Đăng nhập bằng TikTok" = tạo ngay một người dùng thử
- Nút "Follow (giả lập)" thay cho bấm Follow trên TikTok
- Mở trên **2 thiết bị / 2 trình duyệt khác nhau** (hoặc 1 tab ẩn danh) để hai người ghép với nhau
- Đăng nhập lại đúng người cũ: `https://<domain>/auth/tiktok?as=thu_xxxxxx`

Khi app TikTok được duyệt: sửa `.env.prod` thành `TIKTOK_MOCK=0`, `ALLOW_MOCK_IN_PROD=0`, `VITE_FAKE_FOLLOW=0`,
điền `TIKTOK_CLIENT_KEY`/`TIKTOK_CLIENT_SECRET`, khai báo redirect URI `https://<domain>/auth/tiktok/callback`
trên TikTok for Developers, rồi chạy lại `bash deploy/deploy.sh`.

## Vận hành hằng ngày

```bash
git pull && bash deploy/deploy.sh                       # cập nhật code, dữ liệu giữ nguyên
C="docker compose -f deploy/compose.prod.yml --env-file .env.prod"
$C ps                                                   # trạng thái
$C logs -f --tail 100 api worker                        # xem log
sudo bash deploy/backup.sh                              # backup tay (tự chạy 03:15 mỗi ngày)
```

- Đổi số bản API: sửa `API_REPLICAS` trong `.env.prod` rồi chạy lại `deploy.sh`
- Backup nằm ở `/var/backups/cheo` (cùng ổ đĩa với máy). Có dữ liệu thật rồi thì chép thêm ra ngoài máy
- Credit sinh viên có hạn: đặt **Cost Management → Budgets** cảnh báo khi dùng 50%/80%.
  Không dùng thì **Stop** máy trên Portal (trạng thái Deallocated) để ngừng tính tiền CPU
- `.env.prod` chứa mọi secret: không commit, không gửi ai

## Sau này: frontend trên Vercel

Khi có domain riêng (vd `cheo.vn`): Vercel phục vụ `cheo.vn`, máy này phục vụ `api.cheo.vn`
(đổi `DOMAIN` và `FRONTEND_URL=https://cheo.vn` trong `.env.prod`), Vercel đặt `VITE_API_URL=https://api.cheo.vn`.
Không dùng `*.vercel.app` + domain Azure cho bản thật: hai domain khác site, trình duyệt chặn cookie đăng nhập.
