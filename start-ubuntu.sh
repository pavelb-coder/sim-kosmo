#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
PORT="${1:-${PORT:-8086}}"

echo "========================================================"
echo "  КосмоЛаб (sim-kosmo) — запуск на Ubuntu / Linux"
echo "  Порт подключения: ${PORT}"
echo "========================================================"

if command -v node >/dev/null 2>&1; then
  exec node server.js --port "$PORT" --open
elif command -v python3 >/dev/null 2>&1; then
  echo "[OK] Node.js не найден — запуск встроенного сервера Python3 на http://0.0.0.0:${PORT}"
  if [[ -n "${DISPLAY:-}" || -n "${WAYLAND_DISPLAY:-}" ]] && command -v xdg-open >/dev/null 2>&1; then
    (sleep 1 && xdg-open "http://localhost:${PORT}" >/dev/null 2>&1) &
  fi
  exec python3 -m http.server "$PORT" --bind 0.0.0.0
else
  echo "Ошибка: установите nodejs или python3: sudo apt update && sudo apt install -y nodejs" >&2
  exit 1
fi
