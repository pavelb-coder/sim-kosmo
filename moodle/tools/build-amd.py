#!/usr/bin/env python3
"""Сборка AMD-модуля mod_cosmolab/bridge из amd/src в amd/build.

Moodle ожидает в amd/build/bridge.min.js самодостаточный модуль с именованным
define(). Node.js и grunt для установки плагина не нужны: файл уже лежит
в репозитории. Скрипт нужен только после правки amd/src/bridge.js.

Запуск: python3 moodle/tools/build-amd.py
"""

import io
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, 'mod', 'cosmolab', 'amd', 'src', 'bridge.js')
DST = os.path.join(ROOT, 'mod', 'cosmolab', 'amd', 'build', 'bridge.min.js')

MODULE = 'mod_cosmolab/bridge'
DEPS = ['core/ajax', 'core/str']


def build(source: str) -> str:
    """Убирает лицензионный заголовок и превращает анонимный define в именованный."""
    # Лицензионный блок в начале файла.
    source = re.sub(r'\A(?:[ \t]*//[^\n]*\n)+', '', source)
    # Блочные комментарии-документация сохраняем: они не ломают модуль.

    pattern = re.compile(
        r"define\(\s*\[\s*'core/ajax'\s*,\s*'core/str'\s*\]\s*,\s*function\s*\(\s*Ajax\s*,\s*Str\s*\)\s*\{"
    )
    deps = ','.join('"%s"' % d for d in DEPS)
    replacement = 'define("%s",[%s],function(Ajax,Str){' % (MODULE, deps)

    if not pattern.search(source):
        raise SystemExit('Не найден ожидаемый define([...]) в %s' % SRC)

    source = pattern.sub(replacement, source, count=1)

    banner = (
        '// Собранный AMD-модуль плагина mod_cosmolab.\n'
        '// Источник: amd/src/bridge.js — правьте его и пересоберите tools/build-amd.py.\n'
    )
    return banner + source.strip() + '\n'


def main() -> int:
    check_only = '--check' in sys.argv[1:]

    with io.open(SRC, encoding='utf-8') as handle:
        source = handle.read()

    result = build(source)

    if check_only:
        if not os.path.exists(DST):
            print('Нет собранного файла: %s' % DST)
            return 1
        with io.open(DST, encoding='utf-8') as handle:
            current = handle.read()
        if current != result:
            print('amd/build/bridge.min.js устарел — запустите tools/build-amd.py')
            return 1
        print('amd/build/bridge.min.js соответствует amd/src/bridge.js')
        return 0

    os.makedirs(os.path.dirname(DST), exist_ok=True)
    with io.open(DST, 'w', encoding='utf-8') as handle:
        handle.write(result)

    print('Собрано: %s (%d байт)' % (DST, len(result.encode('utf-8'))))
    return 0


if __name__ == '__main__':
    sys.exit(main())
