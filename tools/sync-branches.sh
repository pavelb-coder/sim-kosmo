#!/usr/bin/env bash
# Держит ветку moodle-plugin в актуальном состоянии относительно main.
#
# Правило репозитория: любое обновление main сопровождается обновлением ветки
# moodle-plugin (платформа + плагин Moodle). Скрипт перебазирует ветку на
# свежий main и пушит её; при конфликте останавливается и просит разрулить вручную.
#
# Использование:
#   ./tools/sync-branches.sh              # из каталога репозитория
#   ./tools/sync-branches.sh --push-main  # сначала закоммитить и запушить main
set -euo pipefail

BRANCH="moodle-plugin"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "Это не git-репозиторий: $REPO_DIR" >&2
  exit 1
fi

current_branch="$(git rev-parse --abbrev-ref HEAD)"

if [[ "${1:-}" == "--push-main" ]]; then
  if [[ "$current_branch" != "main" ]]; then
    echo "Флаг --push-main требует ветку main (сейчас: $current_branch)" >&2
    exit 1
  fi
  git add -A
  git diff --cached --quiet || git commit -m "${2:-Sync CosmoLab workspace}"
  git push origin main
fi

git fetch origin main "$BRANCH"

if ! git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  echo "Локальной ветки $BRANCH нет — создаю из origin/$BRANCH."
  git checkout -b "$BRANCH" "origin/$BRANCH"
else
  git checkout "$BRANCH"
fi

if git merge-base --is-ancestor origin/main HEAD; then
  echo "$BRANCH уже содержит актуальный main — обновление не нужно."
else
  if ! git rebase origin/main; then
    echo "ОШИБКА: конфликт при rebase $BRANCH на main. Разрешите его вручную:" >&2
    echo "  git checkout $BRANCH && git rebase origin/main" >&2
    exit 3
  fi
  git push --force-with-lease origin "$BRANCH"
  echo "Ветка $BRANCH перебазирована на main и запушена."
fi

git checkout "$current_branch" >/dev/null 2>&1 || true
echo "Готово."
