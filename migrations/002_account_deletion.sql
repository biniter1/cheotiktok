-- Tài khoản đã xoá: chỉ giữ HMAC của open_id + điểm lúc xoá.
-- Mục đích: chặn việc xoá tài khoản rồi tạo lại để "rửa" điểm tin cậy xấu.
-- Không giữ tên, ảnh, username hay bất kỳ thông tin nhận dạng đọc được nào.
create table deleted_accounts (
  open_id_hmac text primary key,
  trust_score  int not null,
  deleted_at   timestamptz not null default now()
);
