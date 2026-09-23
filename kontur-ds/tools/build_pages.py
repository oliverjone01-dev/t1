#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Собирает страницы из templates/ в самостоятельные файлы: токены, стили и скрипты кита
вшиваются внутрь, снаружи остаются только Google Fonts и ApexCharts с cdnjs.
Такой файл открывается двойным кликом, пересылается одним вложением и публикуется артефактом.

  python3 tools/build_pages.py                 все шаблоны в dist/
  python3 tools/build_pages.py obzor treker    только эти
  python3 tools/build_pages.py --out папка     в другую папку"""
import re, sys
from pathlib import Path
H = Path(__file__).resolve().parents[1]
args = sys.argv[1:]
out = H / 'dist'
if '--out' in args:
    i = args.index('--out'); out = Path(args[i + 1]); del args[i:i + 2]
names = args or [p.stem for p in sorted((H / 'templates').glob('*.html'))]
out.mkdir(parents=True, exist_ok=True)
rd = lambda p: (H / p).read_text(encoding='utf-8')

def palette_check():
    """kit/palette-check.js: валидатор палитры графиков для браузера (страница настроек вида).
    Берётся из tools/validate_palette.mjs: константы, помощники и validate(), без командной строки."""
    src = rd('tools/validate_palette.mjs').splitlines()
    a = next(i for i, l in enumerate(src) if l.startswith('const BAND'))
    z = next(i for i, l in enumerate(src) if l.startswith('export function validateOrdinal'))
    body = '\n'.join(l.replace('export const ', 'const ').replace('export function ', 'function ') for l in src[a:z]).rstrip()
    out = ('/* Контур DS · проверка палитры графиков в браузере. Генерируется tools/build_pages.py\n'
           '   из tools/validate_palette.mjs (скилл dataviz), руками не править. */\n'
           '(function(g){\n' + body + '\ng.KS_PALCHECK = { validate, contrast };\n})(window);\n')
    (H / 'kit' / 'palette-check.js').write_text(out, encoding='utf-8')
palette_check()

def inline(src):
    s = src
    for css in ('tokens/tokens.css', 'kit/kit.css'):
        s = s.replace('<link rel="stylesheet" href="../' + css + '">', '<style>\n' + rd(css) + '\n</style>')
    for js in ('brand', 'icons', 'kit', 'charts', 'motion.riv', 'palette-check'):
        code = rd('kit/' + js + '.js')
        assert '</script' not in code.lower(), js + '.js содержит </script>'
        s = s.replace('<script src="../kit/' + js + '.js"></script>', '<script>\n' + code + '\n</script>')
    left = re.findall(r'(?:href|src)="\.\./[^"]+"', s)
    assert not left, 'остались ссылки на файлы пакета: ' + ', '.join(left)
    return s

for n in names:
    s = inline(rd('templates/' + n + '.html'))
    (out / (n + '.html')).write_text(s, encoding='utf-8')
    print(f'{n}.html  {len(s.encode("utf-8")) // 1024} КБ')
