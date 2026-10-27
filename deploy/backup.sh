#!/usr/bin/env bash
# Sao lưu Postgres ra /var/backups/cheo, giữ 7 ngày. Cron gọi tự động; chạy tay: sudo bash deploy/backup.sh
set -euo pipefail
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT=/var/backups/cheo
mkdir -p "$OUT"
FILE="$OUT/cheo-$(date +%F-%H%M).sql.gz"

docker compose -f "$REPO_DIR/deploy/compose.prod.yml" --env-file "$REPO_DIR/.env.prod" \
  exec -T postgres pg_dump -U cheo -d cheo --no-owner | gzip > "$FILE"

# file rỗng = backup hỏng -> báo lỗi thay vì âm thầm giữ file hỏng
if [ "$(stat -c %s "$FILE")" -lt 1000 ]; then
  echo "$(date) backup quá nhỏ, có thể lỗi: $FILE" >&2
  exit 1
fi
find "$OUT" -name 'cheo-*.sql.gz' -mtime +7 -delete
echo "$(date) ok $FILE"

# Khôi phục:  gunzip -c FILE | docker compose -f deploy/compose.prod.yml --env-file .env.prod exec -T postgres psql -U cheo -d cheo
