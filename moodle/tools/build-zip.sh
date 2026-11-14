#!/usr/bin/env bash
# Сборка установочного ZIP-архива плагина mod_cosmolab для Moodle.
# Корень архива — каталог cosmolab/ (имя компонента без префикса mod_).
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$DIR/mod/cosmolab"
OUT="$DIR/dist"
NAME="mod_cosmolab.zip"

if [[ ! -d "$SRC" ]]; then
  echo "Не найден каталог плагина: $SRC" >&2
  exit 1
fi

mkdir -p "$OUT"
rm -f "$OUT/$NAME"

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

mkdir -p "$STAGE/cosmolab"
# Копируем только то, что должно попасть на сервер Moodle (без тестов и документации).
cp -r "$SRC/." "$STAGE/cosmolab/"
rm -rf "$STAGE/cosmolab/tests" "$STAGE/cosmolab/README.md" "$STAGE/cosmolab/node_modules"

( cd "$STAGE" && zip -qr "$OUT/$NAME" cosmolab )

echo "Готово: $OUT/$NAME ($(du -h "$OUT/$NAME" | cut -f1))"
echo "Установка: Администрирование сайта → Плагины → Установка плагинов → $NAME"
