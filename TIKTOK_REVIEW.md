# Hồ sơ nộp duyệt TikTok for Developers

Mọi nội dung tiếng Anh dưới đây để **dán thẳng vào form**. Thay `<DOMAIN>` bằng domain thật
(vd `cheoapp.southeastasia.cloudapp.azure.com`). Mô tả phải khớp đúng với những gì app làm.

## 1. Thông tin app (Basic information)

| Trường | Giá trị |
|---|---|
| App name | `Chéo` (nếu form không nhận dấu: `Cheo`) |
| App icon | `web/public/icon-1024.png` |
| Category | Lifestyle / Social (chọn mục gần nhất form có) |
| Platforms | Web |
| Website URL | `https://<DOMAIN>` |
| Terms of Service URL | `https://<DOMAIN>/terms` |
| Privacy Policy URL | `https://<DOMAIN>/privacy` |

**Description**

```
Chéo helps TikTok creators who are building their audience find other creators who are online at the same moment and follow each other. Users log in with TikTok, join a live matching zone and are paired one-to-one with another online user. Each person opens the other's TikTok profile, follows them, and confirms in Chéo. Chéo then checks that both people actually followed by comparing each user's following count before and after the match.

Afterwards, Chéo periodically reads each user's follower count. When a user's follower count drops, Chéo identifies which of their past matches most likely unfollowed them and asks the user to confirm by checking the profile. Every user has a public trust score: keeping follows raises it, while faking a confirmation or unfollowing lowers it, and users with low scores are only matched with each other.

Chéo never posts, follows or takes any action on TikTok on a user's behalf, and it does not read follower lists, videos or messages. Users can delete their account and data at any time.
```

## 2. Login Kit

| Trường | Giá trị |
|---|---|
| Redirect URI (Web) | `https://<DOMAIN>/auth/tiktok/callback` |
| Scopes | `user.info.basic`, `user.info.profile`, `user.info.stats` (không xin thêm scope nào khác) |

**Giải thích từng scope**

`user.info.basic`
```
Used to identify the user's account (open_id) and to show their display name and avatar in the app header, on the matching screen and to the person they are matched with.
```

`user.info.profile`
```
Used to read the user's username and profile link. The matched partner sees a button that opens this TikTok profile so they can follow the user there. The username is also shown on the matching screen and in unfollow alerts.
```

`user.info.stats`
```
Used to read follower_count and following_count. (1) Follow-back verification: Chéo compares each user's following count before and after a match to confirm both users actually followed each other. (2) Unfollow detection: Chéo reads the follower count about every 15 minutes; when it drops, Chéo finds which past matches also had their following count drop in the same window and alerts the user. The user's own counts and 7-day change are displayed to them on the Trust score page. Counts are deleted after 90 days.
```

## 3. Kịch bản video demo

Yêu cầu: quay trên **sandbox**, thấy rõ **thanh địa chỉ có domain trùng Website URL**, thể hiện đủ 3 scope.
Chuẩn bị 2 tài khoản TikTok đã thêm làm **target user** của sandbox: dùng máy tính (A) và điện thoại hoặc
một trình duyệt khác (B). Quay màn hình máy tính, đoạn của B có thể quay riêng rồi ghép.

| # | Cảnh | Scope thể hiện |
|---|---|---|
| 1 | Mở `https://<DOMAIN>`, lướt trang chủ, kéo xuống footer cho thấy link Privacy Policy và Terms. Bấm vào Privacy Policy, chuyển sang English, quay lại | (website, chính sách) |
| 2 | Bấm **Đăng nhập bằng TikTok** → màn hình cấp quyền của TikTok hiện đủ 3 quyền → bấm Authorize | cả 3 |
| 3 | Về Chéo: thanh trên cùng hiện avatar và tên. Mở trang **Điểm tin cậy**, dừng ở khối **Số liệu TikTok của bạn** (Follower, Đang follow, Follower 7 ngày qua) | basic, stats |
| 4 | Vào **Zone** → bấm **Vào zone**. B cũng vào zone → hai bên được ghép, thấy tên, username, avatar của nhau | basic, profile |
| 5 | A bấm **Mở TikTok của @...** → trang TikTok của B mở ra → bấm Follow → quay lại Chéo bấm **Mình đã follow**. B làm tương tự | profile |
| 6 | Chờ vài giây → hai nửa khép lại thành **Bạn bè**, dòng "Hai bạn đã follow nhau" (hệ thống vừa so following_count) | stats |
| 7 | Mở lại trang Điểm tin cậy: số "Đang follow" tăng 1, lịch sử điểm có dòng +1 | stats |
| 8 | B bỏ follow A trên TikTok. Chờ lượt kiểm tra kế tiếp (đặt `POLL_INTERVAL_MIN=1` khi quay để nhanh) → A mở **Cảnh báo**, thấy B trong danh sách, bấm mở TikTok của B, chọn **Đang follow** | stats, profile |
| 9 | Trang Điểm tin cậy → **Xoá tài khoản** → cho thấy bước xác nhận (có thể bấm Giữ tài khoản) | (quyền xoá dữ liệu) |

Video tối đa 50MB mỗi file, tối đa 5 file. Nếu dài, tách: (1) cảnh 1–3, (2) cảnh 4–7, (3) cảnh 8–9.

## 4. Chuyển server từ giả lập sang TikTok thật (sandbox)

Trên máy Azure, sửa `.env.prod`:

```
TIKTOK_MOCK=0
ALLOW_MOCK_IN_PROD=0
VITE_FAKE_FOLLOW=0
TIKTOK_CLIENT_KEY=<client key sandbox>
TIKTOK_CLIENT_SECRET=<client secret sandbox>
TIKTOK_REDIRECT_URI=https://<DOMAIN>/auth/tiktok/callback
```

Rồi `bash deploy/deploy.sh`. Dữ liệu người dùng thử ở chế độ giả lập vẫn còn trong DB; muốn sạch thì xoá volume
trước khi deploy: `docker compose -f deploy/compose.prod.yml --env-file .env.prod down -v` (mất toàn bộ dữ liệu).

Khi được duyệt: thay key sandbox bằng key production, chạy lại `deploy.sh`, đặt `POLL_INTERVAL_MIN` về 15.

## 5. Checklist trước khi bấm Submit

- [ ] Website mở được bằng HTTPS, domain trùng Website URL trong form
- [ ] Footer trang chủ thấy ngay link Privacy Policy và Terms, cả hai mở được
- [ ] Tên app không có chữ "TikTok"
- [ ] Đăng nhập TikTok trên sandbox chạy được với cả 2 tài khoản tester
- [ ] Video có đủ cảnh dùng 3 scope, không có scope nào thừa
- [ ] Email liên hệ trong chính sách là email bạn đọc thường xuyên
