#!/usr/bin/env bash
# Deploy / cập nhật toàn bộ hệ thống trên máy này:  bash deploy/deploy.sh
# Lần đầu: hỏi domain + chế độ, tự sinh mọi secret vào .env.prod.
# Những lần sau: git pull rồi chạy lại là cập nhật (dữ liệu giữ nguyên).
set -euo pipefail
cd "$(dirname "$0")/.."
ENV_FILE=.env.prod
COMPOSE=(docker compose -f deploy/compose.prod.yml --env-file "$ENV_FILE")

rand() { openssl rand -hex "$1"; }

if [ ! -f "$ENV_FILE" ]; then
  echo "== Cấu hình lần đầu =="
  IP=$(curl -fsS https://api.ipify.org || true)
  DEFAULT_DOMAIN="${IP//./-}.sslip.io"
  echo "Domain trỏ về máy này. Có thể dùng DNS name Azure (vd cheo.southeastasia.cloudapp.azure.com)"
  read -rp "Domain [Enter = $DEFAULT_DOMAIN]: " DOMAIN
  DOMAIN=${DOMAIN:-$DEFAULT_DOMAIN}

  read -rp "Chạy thử với TikTok GIẢ LẬP (chưa có app TikTok)? [Y/n]: " ANS
  if [[ "${ANS:-Y}" =~ ^[Nn] ]]; then
    MOCK=0
    read -rp "TIKTOK_CLIENT_KEY: " TK
    read -rp "TIKTOK_CLIENT_SECRET: " TS
  else
    MOCK=1; TK=""; TS=""
  fi

  PG_PASSWORD=$(rand 24)
  umask 077
  cat > "$ENV_FILE" <<EOF
DOMAIN=$DOMAIN
API_REPLICAS=2

PG_PASSWORD=$PG_PASSWORD
DATABASE_URL=postgres://cheo:$PG_PASSWORD@postgres:5432/cheo
REDIS_URL=redis://redis:6379
JWT_SECRET=$(rand 32)
TOKEN_ENC_KEY=$(openssl rand -base64 32)
FRONTEND_URL=https://$DOMAIN

TIKTOK_MOCK=$MOCK
ALLOW_MOCK_IN_PROD=$MOCK
VITE_FAKE_FOLLOW=$MOCK
TIKTOK_CLIENT_KEY=$TK
TIKTOK_CLIENT_SECRET=$TS
TIKTOK_REDIRECT_URI=https://$DOMAIN/auth/tiktok/callback

LOG_LEVEL=info
PG_POOL_MAX=10
EOF
  echo "Đã tạo $ENV_FILE (chứa secret, không commit file này)."
fi

DOMAIN=$(grep '^DOMAIN=' "$ENV_FILE" | cut -d= -f2)

echo "== Build và khởi động =="
"${COMPOSE[@]}" up -d --build --remove-orphans
docker image prune -f >/dev/null

echo "== Chờ hệ thống sẵn sàng (lần đầu Caddy cần thêm ít giây để lấy chứng chỉ HTTPS) =="
for i in $(seq 1 60); do
  if curl -fsS "https://$DOMAIN/readyz" >/dev/null 2>&1; then
    echo
    echo "Chạy rồi: https://$DOMAIN"
    "${COMPOSE[@]}" ps --format 'table {{.Service}}\t{{.Status}}'
    exit 0
  fi
  printf '.'
  sleep 3
done

echo
echo "Chưa truy cập được https://$DOMAIN sau 3 phút. Kiểm tra:"
echo "  1. NSG trên Azure đã mở cổng 80 và 443"
echo "  2. Domain đã trỏ đúng IP máy này"
echo "  3. Log:  ${COMPOSE[*]} logs --tail 50 caddy api"
exit 1
