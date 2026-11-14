#!/usr/bin/env bash
# Запуск и автообновление КосмоЛаб напрямую из GitHub на Ubuntu / Linux (порт 8086)
# Команда запуска:
# curl -fsSL https://raw.githubusercontent.com/pavelb-coder/sim-kosmo/main/run-online.sh | bash

set -euo pipefail

PORT="${PORT:-8086}"
TARGET_DIR="${HOME}/sim-kosmo"
REPO_URL="https://github.com/pavelb-coder/sim-kosmo.git"
TAR_URL="https://github.com/pavelb-coder/sim-kosmo/archive/refs/heads/main.tar.gz"

echo "=== КосмоЛаб (sim-kosmo): загрузка/обновление из GitHub ==="

if command -v git >/dev/null 2>&1; then
  if [[ -d "${TARGET_DIR}/.git" ]]; then
    git -C "$TARGET_DIR" pull --ff-only
  else
    rm -rf "$TARGET_DIR"
    git clone "$REPO_URL" "$TARGET_DIR"
  fi
else
  TMP_DIR="$(mktemp -d)"
  curl -fsSL "$TAR_URL" | tar -xz -C "$TMP_DIR"
  rm -rf "$TARGET_DIR"
  mv "${TMP_DIR}/sim-kosmo-main" "$TARGET_DIR"
  rm -rf "$TMP_DIR"
fi

chmod +x "${TARGET_DIR}/start-ubuntu.sh" "${TARGET_DIR}/install-ubuntu-service.sh"
exec "${TARGET_DIR}/start-ubuntu.sh" "$PORT"
