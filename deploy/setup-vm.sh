#!/usr/bin/env bash
# Chạy MỘT LẦN trên máy Ubuntu mới:  sudo bash deploy/setup-vm.sh
# Cài Docker, tạo swap (máy nhỏ), cài lịch backup Postgres hằng ngày.
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Chạy bằng sudo: sudo bash deploy/setup-vm.sh" >&2
  exit 1
fi

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_USER="${SUDO_USER:-$(logname 2>/dev/null || echo root)}"

echo "==> Cài Docker"
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi
usermod -aG docker "$APP_USER" || true
systemctl enable --now docker

echo "==> Swap (tránh hết RAM khi build trên máy 1-2GB)"
MEM_MB=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
if [ "$MEM_MB" -lt 4096 ] && ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> Lịch backup Postgres 03:15 mỗi ngày, giữ 7 bản"
mkdir -p /var/backups/cheo
cat > /etc/cron.d/cheo-backup <<EOF
15 3 * * * root bash $REPO_DIR/deploy/backup.sh >> /var/log/cheo-backup.log 2>&1
EOF
chmod 644 /etc/cron.d/cheo-backup

echo
echo "Xong. Đăng xuất SSH rồi vào lại (để nhóm docker có hiệu lực), sau đó chạy:"
echo "  cd $REPO_DIR && bash deploy/deploy.sh"
