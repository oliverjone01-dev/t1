#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Собирает public/index.html из модулей и data/kontur.json.

Данные вшиваются в страницу на этапе сборки: один самодостаточный файл
одинаково работает и на Pages, и как артефакт, и с диска, без запросов в сеть.
"""
import json, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE / 'modules'))

from head import HEAD
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
from shell import BODY

ICONS = (HERE / 'modules' / 'icons.txt').read_text(encoding='utf-8')
data = json.loads((ROOT / 'data' / 'kontur.json').read_text(encoding='utf-8'))

js = '\n'.join([
    'const DB = ' + json.dumps(data, ensure_ascii=False) + ';',
    ICONS, CORE, WIDGETS, NAV,
    SCR_A, SCR_DYN, SCR_B, SCR_C, SCR_D, METH, READ, DRAW,
])
html = HEAD + '<script>\n' + js + '\n</script>\n' + BODY

out = ROOT / 'public' / 'index.html'
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(html, encoding='utf-8')
print(f'собрано: {out.relative_to(ROOT.parent)} · {len(html)} символов · данные от {data.get("built","")}')
