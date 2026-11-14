#!/usr/bin/env bash
# Установка КосмоЛаб как системного сервиса systemd в Ubuntu (автозапуск на порту 8086)
set -euo pipefail

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Запустите скрипт с правами sudo: sudo ./install-ubuntu-service.sh" >&2
  exit 1
fi

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT="${PORT:-8086}"
RUN_USER="${SUDO_USER:-root}"

if command -v node >/dev/null 2>&1; then
  EXEC_CMD="$(command -v node) ${APP_DIR}/server.js --port ${PORT}"
elif command -v python3 >/dev/null 2>&1; then
  EXEC_CMD="$(command -v python3) -m http.server ${PORT} --bind 0.0.0.0 --directory ${APP_DIR}"
else
  apt-get update && apt-get install -y nodejs
  EXEC_CMD="$(command -v node) ${APP_DIR}/server.js --port ${PORT}"
fi

cat > /etc/systemd/system/sim-kosmo.service <<EOF
[Unit]
Description=CosmoLab (sim-kosmo) Virtual Laboratories on port ${PORT}
After=network.target

[Service]
Type=simple
User=${RUN_USER}
WorkingDirectory=${APP_DIR}
Environment=PORT=${PORT}
ExecStart=${EXEC_CMD}
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now sim-kosmo.service

echo "========================================================"
echo "  Сервис sim-kosmo установлен и запущен на порту ${PORT}!"
echo "  Проверка статуса: sudo systemctl status sim-kosmo"
echo "  Адрес:            http://localhost:${PORT}"
echo "========================================================"
