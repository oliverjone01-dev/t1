#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Сторож, который всегда зелёный, бесполезен. Подсовываем ему испорченные версии,
каждая обязана быть поймана. Файлы восстанавливаются после каждого случая."""
import subprocess, sys, shutil, re
from pathlib import Path
HERE = Path(__file__).resolve().parents[1]
TOK, KIT, CH = HERE/'tokens'/'tokens.css', HERE/'kit'/'kit.js', HERE/'kit'/'charts.js'
KCSS = HERE/'kit'/'kit.css'
EM = '\u2014'
PAGE = HERE/'tools'/'_tamper_page.html'
CASES = [
 ('приглушённый текст провалил контраст', TOK, lambda s: s.replace('--text-muted:  #5F6B80;', '--text-muted:  #A9B1BF;', 1)),
 ('тёмный текст провалил контраст',       TOK, lambda s: s.replace('--text:        #BAC0C9;', '--text:        #3A3F47;', 1)),
 ('бейдж внимания провалил контраст',      TOK, lambda s: s.replace('--warn:    #855A00;', '--warn:    #C99A2E;', 1)),
 ('кнопка: текст на акценте',              TOK, lambda s: s.replace('--primary:       #3561C9;', '--primary:       #9DB6F0;', 1)),
 ('палитра: синий рядом с голубым',        TOK, lambda s: s.replace('--cat-2: #00806A;', '--cat-2: #2F74D0;', 1)),
 ('hex в компонентах',                     KIT, lambda s: s.replace("return '<span class=\"ks-badge ks-badge--'", "return '<span style=\"color:#FF00AA\" class=\"ks-badge ks-badge--'", 1)),
 ('hex в графиках',                        CH,  lambda s: s.replace("colors:[C.cat(slot || 3)]", "colors:['#FF00AA']", 1)),
 ('две оси Y',                             CH,  lambda s: s.replace("yaxis:{ min:lo, max:hi,", "yaxis:[{ min:lo, max:hi,", 1)),
 ('длинное тире',                          KIT, lambda s: s.replace('Следующий шаг', 'Следующий ' + EM + ' шаг', 1)),
 ('бейдж на поднятом слое',                TOK, lambda s: s.replace('--ok:      #0E754E;', '--ok:      #0F7A52;', 1)),
 ('анимация ширины',                       KCSS, lambda s: s.replace('.ks-chev{ transition:transform', '.ks-chev{ transition:width', 1)),
 ('пружинящая кривая',                     TOK, lambda s: s.replace('--ease-out: cubic-bezier(.2,.8,.2,1);', '--ease-out: cubic-bezier(.34,1.56,.64,1);', 1)),
 ('шрифт мельче 11px в токенах',           TOK, lambda s: s.replace('--fs-micro:  11px;', '--fs-micro:  10px;', 1)),
 ('шрифт мельче 11px в графике',           CH,  lambda s: s.replace("labels:{ style:{ fontSize:'11px' }, rotate:-38", "labels:{ style:{ fontSize:'9px' }, rotate:-38", 1)),
 ('копии тёмной темы разъехались',         TOK, lambda s: s.replace('--neutral:#959CA8; --neutral-soft', '--neutral:#8C93A0; --neutral-soft', 1)),
 ('подъём по наведению на касании',        KCSS, lambda s: s.replace('@media (hover:hover){ .ks-tile.is-interactive:hover{ box-shadow:var(--sh-hover); transform:translateY(-2px); border-color:var(--border-strong); } }', '.ks-tile.is-interactive:hover{ box-shadow:var(--sh-hover); transform:translateY(-2px); border-color:var(--border-strong); }', 1)),
 ('цифры моноширинным',                    KCSS, lambda s: s.replace('.ks-num{ font-family:var(--font-sans);', '.ks-num{ font-family:var(--font-mono);', 1)),
 ('бледный текст для чтения',              KCSS, lambda s: s.replace('.ks-empty{ color:var(--text-muted); }', '.ks-empty{ color:var(--text-faint); }', 1)),
]
PAGE_CASES = [
 ('страница без viewport', '<!doctype html><html><head><title>x</title></head><body>телефон</body></html>'),
 ('прозрачность на тексте', '<div class="opacity-55">подпись</div>'),
 ('ДАННЫЕ без источника', '<script>\nconst DB = {"x":{"v":1,"k":"ДАННЫЕ","s":"","at":"2026-09-01"}};\n</script>'),
 ('пустое значение как ДАННЫЕ', '<script>\nconst DB = {"x":{"v":null,"k":"ДАННЫЕ","s":"api","at":"2026-09-01"}};\n</script>'),
 ('неизвестный класс', '<script>\nconst DB = {"x":{"v":1,"k":"ПРИМЕРНО","s":"api","at":"2026-09-01"}};\n</script>'),
 ('синий и голубой соседями', '<script>opt={colors:["#5D87FF","#49BEFF"]}</script>'),
]
def run(extra=None):
    cmd = [sys.executable, str(HERE/'tools'/'check_ds.py')] + ([str(extra)] if extra else [])
    r = subprocess.run(cmd, capture_output=True, text=True)
    return r.returncode, [l.strip() for l in r.stdout.splitlines() if l.strip().startswith('[')]
caught = total = 0
for name, path, f in CASES:
    total += 1; bak = path.read_text(encoding='utf-8'); new = f(bak)
    if new == bak: print(f'  ПОДМЕНА НЕ ПРОИЗОШЛА: {name}'); continue
    path.write_text(new, encoding='utf-8')
    try:
        code, lines = run()
        if code: caught += 1; print(f'  поймано: {name:36s} -> {lines[0] if lines else ""}')
        else: print(f'  ПРОСКОЧИЛО: {name}')
    finally: path.write_text(bak, encoding='utf-8')
for name, html in PAGE_CASES:
    total += 1
    # обычный случай оборачиваем в страницу с viewport, чтобы ловилась именно подмена, а не его отсутствие
    page = html if html.startswith('<!doctype') else '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + html + '</body></html>'
    PAGE.write_text(page, encoding='utf-8')
    try:
        code, lines = run(PAGE)
        if code: caught += 1; print(f'  поймано: {name:36s} -> {lines[0] if lines else ""}')
        else: print(f'  ПРОСКОЧИЛО: {name}')
    finally: PAGE.unlink()
code, _ = run()
print(f'\nитог: {caught} из {total}; чистая система после восстановления: {"зелёная" if code == 0 else "КРАСНАЯ"}')
sys.exit(0 if caught == total and code == 0 else 1)
