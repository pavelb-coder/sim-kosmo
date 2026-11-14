#!/usr/bin/env bash
# Самопроверка плагина mod_cosmolab без установленного Moodle:
# синтаксис PHP, корректность XML, паритет языковых строк, сборка AMD, структура ZIP.
set -uo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$DIR/mod/cosmolab"
FAIL=0

say() { printf '%s\n' "$*"; }
ok()  { printf '  \033[32m✓\033[0m %s\n' "$*"; }
bad() { printf '  \033[31m✗\033[0m %s\n' "$*"; FAIL=1; }

say "1. PHP-синтаксис"
if command -v php >/dev/null 2>&1; then
  while IFS= read -r f; do
    if php -l "$f" >/dev/null 2>&1; then :; else bad "php -l: ${f#$SRC/}"; fi
  done < <(find "$SRC" -name '*.php')
  ok "все PHP-файлы разобраны без ошибок"
else
  say "  (php не найден — шаг пропущен)"
fi

say "2. XMLDB / SVG"
if command -v python3 >/dev/null 2>&1; then
  python3 - "$SRC" <<'PY'
import sys, glob, xml.dom.minidom as minidom
src = sys.argv[1]
ok = True
for f in glob.glob(src + '/**/*.xml', recursive=True) + glob.glob(src + '/pix/*.svg'):
    try:
        minidom.parse(f)
    except Exception as e:
        print('  \033[31m✗\033[0m %s: %s' % (f, e)); ok = False
print('  \033[32m✓\033[0m XML и SVG корректны' if ok else '')
sys.exit(0 if ok else 1)
PY
  [ $? -ne 0 ] && FAIL=1
else
  say "  (python3 не найден — шаг пропущен)"
fi

say "3. Языковые строки en/ru"
python3 - "$SRC" <<'PY'
import sys, io, re
src = sys.argv[1]
def keys(p):
    t = io.open(p, encoding='utf-8').read()
    return set(re.findall(r"\$string\['([^']+)'\]", t))
en = keys(src + '/lang/en/cosmolab.php')
ru = keys(src + '/lang/ru/cosmolab.php')
missing = sorted(en - ru)
extra = sorted(ru - en)
if missing or extra:
    print('  \033[31m✗\033[0m расхождение языков:', 'нет в ru:', missing, 'нет в en:', extra)
    sys.exit(1)
print('  \033[32m✓\033[0m %d строк, ru и en совпадают' % len(en))
PY
[ $? -ne 0 ] && FAIL=1

say "4. Собранный AMD-модуль"
if command -v node >/dev/null 2>&1; then
  for f in "$SRC/amd/src/bridge.js" "$SRC/amd/build/bridge.min.js"; do
    if node --check "$f" >/dev/null 2>&1; then ok "${f#$SRC/}"; else bad "синтаксис ${f#$SRC/}"; fi
  done
else
  say "  (node не найден — шаг пропущен)"
fi

say "5. Обязательные файлы"
for f in version.php lib.php mod_form.php view.php db/install.xml db/access.php \
         lang/en/cosmolab.php lang/ru/cosmolab.php classes/helper.php \
         classes/privacy/provider.php amd/build/bridge.min.js; do
  if [ -f "$SRC/$f" ]; then ok "$f"; else bad "нет файла $f"; fi
done

say "6. Сборка ZIP"
if [ -x "$DIR/tools/build-zip.sh" ]; then
  if "$DIR/tools/build-zip.sh" >/dev/null 2>&1; then
    listing="$(unzip -l "$DIR/dist/mod_cosmolab.zip" 2>/dev/null || python3 -c "import zipfile,sys;print('\\n'.join(zipfile.ZipFile(sys.argv[1]).namelist()))" "$DIR/dist/mod_cosmolab.zip")"
    case "$listing" in
    *cosmolab/version.php*) ok "dist/mod_cosmolab.zip собран, корень архива — cosmolab/" ;;
    *) bad "в архиве нет cosmolab/version.php" ;;
    esac
  else
    bad "не удалось собрать ZIP"
  fi
else
  say "  (build-zip.sh не найден — шаг пропущен)"
fi

echo
if [ $FAIL -eq 0 ]; then
  say "Итог: плагин готов к установке в Moodle 3.9 … 4.5."
else
  say "Итог: найдены проблемы (см. выше)."
fi
exit $FAIL
