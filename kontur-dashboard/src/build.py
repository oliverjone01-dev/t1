#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Собирает public/index.html из модулей, пакета Контур DS и data/kontur.json.

Данные вшиваются в страницу на этапе сборки: один самодостаточный файл
одинаково работает и на Pages, и как артефакт, и с диска, без запросов в сеть.

Вид целиком из пакета kontur-ds/ в корне репозитория (Контур DS 1.5): токены и
компоненты вставляются в страницу как есть, файлы пакета здесь не правятся.
Стили открыты (в них нет данных), скрипты кита лежат в шифруемом блоке app-js
вместе с приложением: вне шифра остаются только ApexCharts с CDN и окно пароля.
"""
import json, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
DS = ROOT.parent / 'kontur-ds'
sys.path.insert(0, str(HERE / 'modules'))

from head import HEAD, LOCAL_CSS
from core import CORE
from widgets import WIDGETS
from nav import NAV
from scr_a import SCR_A
from scr_dyn import SCR_DYN
from scr_b import SCR_B
from scr_c import SCR_C
from scr_d import SCR_D
from meth import METH
from read import READ
from draw import DRAW
from shell import BODY, GATE
from app import APP

def ds(rel):
    p = DS / rel
    if not p.exists():
        sys.exit(f'нет файла пакета Контур DS: {p.relative_to(ROOT.parent)}')
    return p.read_text(encoding='utf-8').strip()

data = json.loads((ROOT / 'data' / 'kontur.json').read_text(encoding='utf-8'))

js = '\n'.join([
    'const DB = ' + json.dumps(data, ensure_ascii=False) + ';',
    ds('kit/brand.js'), ds('kit/icons.js'), ds('kit/kit.js'), ds('kit/charts.js'),
    CORE, WIDGETS, NAV,
    SCR_A, SCR_DYN, SCR_B, SCR_C, SCR_D, METH, READ, DRAW, APP,
])
head = (HEAD.replace('/*TOKENS*/', ds('tokens/tokens.css'))
            .replace('/*KIT*/', ds('kit/kit.css'))
            .replace('/*LOCAL*/', LOCAL_CSS.strip()))
# Открытая часть страницы: всё, что остаётся без шифра. tools/seal_page.mjs берёт её
# отсюда (build.py --shell) и требует, чтобы опубликованная страница вне шифроблока
# совпадала с ней до символа: вне шифра не может оказаться ничего, чего нет в исходниках.
prefix = head + '<body>\n' + BODY
suffix = GATE + '</body>\n</html>\n'
if '--shell' in sys.argv:
    sys.stdout.write(json.dumps({'prefix': prefix, 'suffix': suffix}, ensure_ascii=False))
    sys.exit(0)
# id нужен tools/seal_page.mjs: при публикации блок целиком заменяется шифротекстом.
html = prefix + '<script id="app-js">\n' + js + '\n</script>\n' + suffix

out = ROOT / 'public' / 'index.html'
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(html, encoding='utf-8')
print(f'собрано: {out.relative_to(ROOT.parent)} · {len(html)} символов · данные от {data.get("built","")}')
