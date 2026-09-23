#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Сторож Контур DS. Запускается в любом проекте, куда перенесена система.

  python3 tools/check_ds.py                 # проверить саму систему
  python3 tools/check_ds.py путь/к/page.html # плюс страницу проекта

Проверяет не вкус, а то, что уже ломалось:
  TOKENS    контраст каждой текстовой роли на каждой поверхности в обеих темах
  PALETTE   категориальная палитра графиков проходит валидатор в обеих темах
  HEX       цвет записан в компоненте или странице мимо токенов
  OPACITY   текст приглушён прозрачностью, а не текстовой ролью
  DUALAXIS  две оси Y на одном графике
  CVD       пара #5D87FF и #49BEFF соседними сериями
  EMDASH    длинное тире в тексте
  ENVELOPE  цифра класса ДАННЫЕ без источника или даты, пустое значение как ДАННЫЕ
  LAYOUTANIM анимация ширины, высоты, отступов (дёргает раскладку; нужен transform или grid-rows)
  BOUNCE    пружинящая кривая: параметр cubic-bezier за пределами 0..1
  FONTFLOOR функциональный текст мельче 11px (токены, CSS, подписи графиков)
  FAINTTEXT --text-faint на тексте, который надо прочесть (он только для выключенного и значков)
  VIEWPORT  у страницы нет meta viewport с width=device-width: телефон покажет её уменьшенной копией
  HOVERLIFT подъём по наведению (transform в :hover) вне @media (hover:hover): на касании залипает
  MONONUM   цифры в столбик набраны моноширинным: в 1.2 они идут шрифтом интерфейса с табличными цифрами
  SIDESTRIPE толстая цветная полоса сбоку (border-left 2px и толще тоном или цветом): главный признак шаблона
  CAPSBADGE бейдж капсом: с 1.3 бейджи строчными, капс только в коротких метках
  GRADMARK  градиент на знаке бренда: подпись сгенерированного интерфейса
  LOOPANIM  бесконечная анимация вне вращения загрузки и мерцания заглушки: мигающие точки, пульс, бегущие рамки
  DENSITYTAP компактная плотность уменьшила цели пальца (--tap): на касании промахи
  VTMOTION  переходы View Transitions без отключения при «меньше движения»
  SYNC      копия тёмной темы для системной настройки совпадает с [data-theme="dark"]
  CONTRAST  с ключом --live: реальный контраст каждого текста в браузере, обе темы, 1280 и 390

Правила LAYOUTANIM, BOUNCE, FONTFLOOR, FAINTTEXT взяты из детектора Impeccable
(npx impeccable detect) и переписаны под систему, чтобы ловить их без сети.
"""
import re, sys, json, subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]
TOK = HERE / 'tokens' / 'tokens.css'
EM = '\u2014'  # длинное тире; в самом стороже записано кодом, чтобы файл был чистым
LIVE = '--live' in sys.argv
sys.argv = [a for a in sys.argv if a != '--live']
fails, notes = [], []
def bad(code, msg): fails.append((code, msg))

# ---------- разбор токенов ----------
css = TOK.read_text(encoding='utf-8')
def block(selector_start):
    i = css.index(selector_start); j = css.index('{', i); depth, k = 1, j + 1
    while depth:
        if css[k] == '{': depth += 1
        elif css[k] == '}': depth -= 1
        k += 1
    return dict(re.findall(r'(--[\w-]+):\s*([^;]+);', css[j+1:k-1]))
LIGHT = block(':root, [data-theme="light"]{')
DARK  = block('[data-theme="dark"], :root.dark{')

# тёмная тема записана дважды: для data-theme и для системной настройки без атрибута.
# Разъехавшиеся копии дают разные цвета у разных зрителей, поэтому сверяем их.
try:
    mi = css.index('@media (prefers-color-scheme: dark)'); mj = css.index('{', css.index(':root:not(', mi))
    depth, mk = 1, mj + 1
    while depth:
        depth += {'{': 1, '}': -1}.get(css[mk], 0); mk += 1
    MEDIA = dict((a, b.strip()) for a, b in re.findall(r'(--[\w-]+):\s*([^;]+);', css[mj+1:mk-1]))
    for k, v in DARK.items():
        if k in MEDIA and MEDIA[k].replace(' ', '').lower() != v.strip().replace(' ', '').lower():
            fails.append(('SYNC', f'тёмная тема: {k} = {v.strip()} в [data-theme], но {MEDIA[k]} в prefers-color-scheme'))
        if k not in MEDIA and not k.startswith('--sh') and k != '--scroll-thumb':
            fails.append(('SYNC', f'тёмная тема: {k} нет в блоке prefers-color-scheme'))
except ValueError:
    fails.append(('SYNC', 'нет блока @media (prefers-color-scheme: dark)'))

def lin(c):
    c = c / 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
def lum(h):
    h = h.strip().lstrip('#'); r, g, b = (int(h[i:i+2], 16) for i in (0, 2, 4))
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
def ratio(a, b):
    la, lb = sorted([lum(a), lum(b)], reverse=True); return (la + 0.05) / (lb + 0.05)
def mix(fg, bg, a):
    f = [int(fg.lstrip('#')[i:i+2], 16) for i in (0, 2, 4)]; b = [int(bg.lstrip('#')[i:i+2], 16) for i in (0, 2, 4)]
    return '#' + ''.join(f'{round(x*a + y*(1-a)):02x}' for x, y in zip(f, b))
def hexv(t, k):
    v = t.get(k, '').strip()
    return v if re.fullmatch(r'#[0-9A-Fa-f]{6}', v) else None

ROLES = {'--text-strong': 7.0, '--text': 4.5, '--text-muted': 4.5, '--text-faint': 3.0, '--text-link': 4.5}
SURF = ['--bg', '--surface', '--surface-2']
for name, t in (('светлая', LIGHT), ('тёмная', DARK)):
    for role, need in ROLES.items():
        fg = hexv(t, role)
        if not fg: bad('TOKENS', f'{name}: токен {role} не задан hex-цветом'); continue
        for s in SURF:
            bg = hexv(t, s)
            if not bg: continue
            r = ratio(fg, bg)
            if r < need: bad('TOKENS', f'{name}: {role} {fg} на {s} {bg} даёт {r:.2f}:1, нужно {need}:1')
    # статус как текст на карточке и на своей подложке
    # бейдж лежит и на карточке, и на поднятом слое (строка при наведении, секция панели)
    for st in ('--ok', '--warn', '--serious', '--crit', '--neutral', '--info'):
        fg = hexv(t, st)
        soft = t.get(st + '-soft', '')
        m = re.match(r'rgba\((\d+),(\d+),(\d+),([\d.]+)\)', soft.replace(' ', ''))
        for sname in ('--surface', '--surface-2'):
            bg = hexv(t, sname)
            if not (fg and bg): continue
            if ratio(fg, bg) < 4.5: bad('TOKENS', f'{name}: статус {st} {fg} на {sname} {ratio(fg,bg):.2f}:1')
            if m:
                a = float(m.group(4)); tint = mix('#%02x%02x%02x' % tuple(int(m.group(i)) for i in (1, 2, 3)), bg, a)
                if ratio(fg, tint) < 4.5: bad('TOKENS', f'{name}: бейдж {st} {fg} на подложке поверх {sname} {tint} {ratio(fg,tint):.2f}:1')
    # текст на акцентной кнопке и фокус
    acc, on = hexv(t, '--primary'), hexv(t, '--primary-foreground')
    if acc and on and ratio(on, acc) < 4.5: bad('TOKENS', f'{name}: текст на кнопке {ratio(on,acc):.2f}:1')
    act, aon = hexv(t, '--action'), hexv(t, '--action-foreground')
    if act and aon and ratio(aon, act) < 4.5: bad('TOKENS', f'{name}: текст на основной кнопке {ratio(aon,act):.2f}:1')
    foc, card = hexv(t, '--focus'), hexv(t, '--surface')
    if foc and card and ratio(foc, card) < 3: bad('TOKENS', f'{name}: кольцо фокуса {ratio(foc,card):.2f}:1')

# ---------- плотность: компактно не трогает цели пальца ----------
try:
    DENSE = block('[data-density="compact"]{')
    for k in ('--tap', '--tap-sm'):
        if k in DENSE: bad('DENSITYTAP', f'компактная плотность меняет {k}; цели пальца всегда 44 и 36')
    BASE = block(':root{'); AIRY = block('[data-density="comfortable"]{')
    for k in DENSE:
        if k not in AIRY: bad('SYNC', f'плотность: {k} есть в compact, но нет в comfortable')
        elif AIRY[k].replace(' ', '') != BASE.get(k, '').replace(' ', ''): bad('SYNC', f'плотность: {k} в comfortable {AIRY[k]} не совпадает с :root {BASE.get(k)}')
except ValueError:
    pass

# ---------- пол шрифта и кривые в самих токенах ----------
for k, v in re.findall(r'(--fs-[\w-]+):\s*([^;]+);', css):
    nums = [float(x) for x in re.findall(r'(\d+(?:\.\d+)?)px', v)]
    if nums and min(nums) < 11: bad('FONTFLOOR', f'токен {k} = {v.strip()}, минимум 11px')
for m in re.finditer(r'cubic-bezier\(([^)]+)\)', css):
    v = [float(x) for x in m.group(1).split(',')]
    if v[1] < 0 or v[1] > 1 or v[3] < 0 or v[3] > 1: bad('BOUNCE', f'tokens.css: пружинящая кривая cubic-bezier({m.group(1)})')

# ---------- палитра графиков через валидатор ----------
VAL = HERE / 'tools' / 'validate_palette.mjs'
for name, t, mode in (('светлая', LIGHT, 'light'), ('тёмная', DARK, 'dark')):
    pal = [hexv(t, f'--cat-{i}') for i in range(1, 6)]
    if None in pal: bad('PALETTE', f'{name}: не все --cat-1..5 заданы'); continue
    code = (f"import {{ validate }} from '{VAL.as_posix()}';"
            f"const r = validate({json.dumps(pal)}, {{mode:'{mode}', surface:'{hexv(t,'--surface')}'}});"
            "console.log(JSON.stringify(r.report));")
    try:
        out = subprocess.run(['node', '--input-type=module', '-e', code], capture_output=True, text=True, timeout=30)
        rep = json.loads(out.stdout.strip() or '[]')
        for row in rep:
            if row[1] in (False, 'fail'): bad('PALETTE', f'{name}: {row[0]}: {row[2]}')
            if row[1] in ('relief', 'floor'): notes.append(f'{name}: {row[0]} требует подписей или таблицы: {row[2]}')
    except Exception as e:
        notes.append(f'валидатор палитры не запустился ({e}); проверь вручную командой из docs')

# ---------- исходники системы и страницы проекта ----------
targets = [HERE / 'kit' / f for f in ('kit.css', 'kit.js', 'charts.js', 'icons.js')] + [Path(a) for a in sys.argv[1:]]
for p in targets:
    if not p.exists(): bad('FILE', f'нет файла {p}'); continue
    s = p.read_text(encoding='utf-8')
    rel = p.name
    if EM in s: bad('EMDASH', f'{rel}: длинных тире {s.count(EM)}')
    # hex вне токенов: в компонентах и графиках цвет берётся только из переменных
    body = re.sub(r'/\*.*?\*/', '', s, flags=re.S)
    body = re.sub(r'<style[^>]*>.*?tokens.*?</style>', '', body, flags=re.S)
    hexes = set(re.findall(r'#[0-9A-Fa-f]{6}\b', body)) - {'#FFFFFF', '#ffffff', '#fff'}
    if rel in ('kit.css', 'kit.js', 'charts.js') and hexes:
        bad('HEX', f'{rel}: цвета мимо токенов {sorted(hexes)[:6]}')
    if re.search(r'class=["\'][^"\']*\bopacity-(40|45|50|55|60|70)\b', s):
        bad('OPACITY', f'{rel}: текст приглушён прозрачностью; бери --text-muted или --text-faint')
    ann = re.sub(r'annotations:\s*\{[^{}]*yaxis:\s*\[', 'annotations:{__ann__[', body)
    if re.search(r'(?<!__ann__)\byaxis:\s*\[\s*\{', ann): bad('DUALAXIS', f'{rel}: две оси Y')
    for m in re.finditer(r'colors:\s*\[([^\]]*)\]', body):
        h = [x.strip().strip('\'"').upper() for x in m.group(1).split(',')]
        if '#5D87FF' in h and '#49BEFF' in h and abs(h.index('#5D87FF') - h.index('#49BEFF')) == 1:
            bad('CVD', f'{rel}: синий и голубой соседними сериями')
    # --- адаптивность ---
    if p.suffix == '.html' and '<html' in s and not re.search(r'<meta[^>]+name=["\']viewport["\'][^>]+width=device-width', s):
        bad('VIEWPORT', f'{rel}: нет <meta name="viewport" content="width=device-width,...">')
    css_only = re.sub(r'@media\s*\(hover:\s*hover\)\s*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}', '', body)
    for m in re.finditer(r'([^{}]*:hover[^{}]*)\{([^{}]*)\}', css_only):
        if 'transform' in m.group(2) and 'transition' not in m.group(2).split('transform')[0][-12:]:
            bad('HOVERLIFT', f'{rel}: {m.group(1).strip()[-50:]} поднимает по наведению вне @media (hover:hover)')
    for m in re.finditer(r'([^{}]+)\{([^{}]*)\}', body):
        if re.search(r'is-num|ks-num|bar-value', m.group(1)) and 'var(--font-mono)' in m.group(2):
            bad('MONONUM', f'{rel}: {m.group(1).strip()[-40:]} набирает цифры моноширинным')
    # --- правила из Impeccable ---
    for m in re.finditer(r'transition\s*:([^;{}"\']*)', body):
        props = re.findall(r'(?:^|,)\s*([a-z-]+)', m.group(1))
        badp = [x for x in props if x in ('width', 'height', 'max-height', 'min-height', 'padding', 'margin', 'top', 'left', 'right', 'bottom', 'all')]
        if badp: bad('LAYOUTANIM', f'{rel}: transition по {", ".join(badp)}; бери transform, opacity или grid-template-rows')
    for m in re.finditer(r'cubic-bezier\(([^)]+)\)', body):
        try: v = [float(x) for x in m.group(1).split(',')]
        except ValueError: continue
        if len(v) == 4 and (v[1] < 0 or v[1] > 1 or v[3] < 0 or v[3] > 1): bad('BOUNCE', f'{rel}: пружинящая кривая cubic-bezier({m.group(1)})')
    for m in re.finditer(r'font-size\s*:\s*(\d+(?:\.\d+)?)px|fontSize\s*:\s*[\'"](\d+(?:\.\d+)?)px', body):
        v = float(m.group(1) or m.group(2))
        if v < 11: bad('FONTFLOOR', f'{rel}: текст {v:g}px, минимум 11px')
    for m in re.finditer(r'([^{}]+)\{([^{}]*)\}', body):
        sel, decl = m.group(1).strip(), m.group(2)
        if re.search(r'(?<![\w-])color\s*:\s*var\(--text-faint\)', decl) and not re.search(r'chev|disabled|ks-ic|icon|decor', sel):
            bad('FAINTTEXT', f'{rel}: {sel[-60:]} красит текст в --text-faint; для чтения бери --text-muted')
    if re.search(r'style=[\'"][^\'"]*(?<![\w-])color:\s*var\(--text-faint\)', body): bad('FAINTTEXT', f'{rel}: встроенный стиль с --text-faint на тексте')
    # --- движение (1.4) ---
    for m in re.finditer(r'([^{}]+)\{([^{}]*)\}', body):
        sel, decl = m.group(1).strip(), m.group(2)
        for a in re.findall(r'animation(?:-iteration-count)?\s*:([^;]*infinite[^;]*)', decl):
            if not re.search(r'\bks-(?:spin|shimmer)\b', a): bad('LOOPANIM', f'{rel}: {sel[-50:]} крутит бесконечную анимацию; цикл допустим только у загрузки')
    if '::view-transition-' in body and not re.search(r'prefers-reduced-motion[^{]*\{(?:[^{}]*\{[^{}]*\})*?[^{}]*::view-transition-group\(\*\)', body):
        bad('VTMOTION', f'{rel}: переходы View Transitions не выключаются при «меньше движения»')
    # --- признаки шаблонного интерфейса (1.3) ---
    for m in re.finditer(r'([^{}]+)\{([^{}]*)\}', body):
        sel, decl = m.group(1).strip(), m.group(2)
        if re.search(r'border-(?:left|inline-start)\s*:\s*(?:[2-9]|\d{2,})px[^;]*(?:var\(--(?:ok|warn|serious|crit|info|primary|tone|slot|cat-\d)|#[0-9a-fA-F]{3,6}|rgb)', decl): bad('SIDESTRIPE', f'{rel}: {sel[-50:]} рисует цветную полосу сбоку; тон передаёт значок или слово')
        if 'ks-badge' in sel and 'uppercase' in decl: bad('CAPSBADGE', f'{rel}: {sel[-50:]} набирает бейдж капсом')
        if 'brand-mark' in sel and 'gradient' in decl: bad('GRADMARK', f'{rel}: {sel[-50:]} с градиентом')
    for m in re.finditer(r'const DB\s*=\s*(\{.*?\});\s*\n', s, re.S):
        try: db = json.loads(m.group(1))
        except Exception: continue
        def walk(o, path):
            if isinstance(o, dict):
                if isinstance(o.get('k'), str):
                    k = o['k']
                    if k not in ('ДАННЫЕ', 'ГИПОТЕЗА', 'ДЕМО'): bad('ENVELOPE', f'{rel} {path}: класс «{k}»')
                    if k == 'ДАННЫЕ' and not o.get('s'): bad('ENVELOPE', f'{rel} {path}: ДАННЫЕ без источника')
                    if k == 'ДАННЫЕ' and not re.fullmatch(r'\d{4}-\d{2}-\d{2}', str(o.get('at') or '')): bad('ENVELOPE', f'{rel} {path}: ДАННЫЕ без даты')
                    if k == 'ДАННЫЕ' and 'v' in o and o['v'] is None: bad('ENVELOPE', f'{rel} {path}: пустое значение как ДАННЫЕ')
                for kk, vv in o.items():
                    if kk not in ('v', 'k', 's', 'at', 'n'): walk(vv, f'{path}.{kk}')
            elif isinstance(o, list):
                for i, vv in enumerate(o): walk(vv, f'{path}[{i}]')
        walk(db, 'DB')

# ---------- живой контраст в браузере ----------
pages = [a for a in sys.argv[1:] if a.endswith('.html')]
if LIVE and pages:
    r = subprocess.run(['node', str(HERE / 'tools' / 'contrast_live.mjs')] + pages, capture_output=True, text=True, timeout=600)
    for line in r.stdout.splitlines():
        if line.startswith('   '): bad('CONTRAST', line.strip())
    if r.returncode not in (0, 1): notes.append('живой контраст не запустился: ' + (r.stderr.strip().splitlines() or ['?'])[-1])
elif LIVE:
    notes.append('ключ --live без страниц: укажи html-файлы')

for n in notes: print('  заметка:', n)
if fails:
    print(f'\nПРОВАЛ: {len(fails)}')
    for c, m in fails: print(f'  [{c}] {m}')
    sys.exit(1)
print('\nСТОРОЖ DS: чисто')
