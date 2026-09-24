#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Сторож Контур DS 1.5.1. Запускается в любом проекте, куда перенесена система.

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
  SIDESTRIPE толстая цветная полоса сбоку: рамка, тень, край градиента, узкий блок (1.5.1: по классам, см. ниже)
  CAPSBADGE бейдж капсом: с 1.3 бейджи строчными, капс только в коротких метках
  GRADMARK  градиент на знаке бренда: подпись сгенерированного интерфейса
  LOOPANIM  бесконечная анимация вне вращения загрузки и мерцания заглушки: мигающие точки, пульс, бегущие рамки
  DENSITYTAP компактная плотность уменьшила цели пальца (--tap): на касании промахи
  VTMOTION  переходы View Transitions без отключения при «меньше движения»
  SYNC      копия тёмной темы для системной настройки совпадает с [data-theme="dark"]
  CONTRAST  с ключом --live: контраст каждого видимого текста в браузере (любая запись цвета через холст,
            кроме текста на градиентном и картиночном фоне), обе темы, 1280 и 390
            и живой стиль (tools/style_live.mjs): полоса, капс, градиент знака, прозрачность текста, бесконечная
            анимация и цели пальца по вычисленным стилям отрисованной страницы (1.5.1)

С 1.5.1 правила SIDESTRIPE, CAPSBADGE, GRADMARK, LOOPANIM, OPACITY, DENSITYTAP и HEX страницы читают стиль из
перечня источников: файл CSS, <style>, style="", CSS строкой в JS, el.style.*, cssText, setProperty,
setAttribute('style'), Object.assign(el.style), insertRule, <style> из JS, вложенный CSS; свои переменные файла
подставляются. Охват измерен на наборах подмен tools/tamper_ds.py, это не обещание поймать всё. Чего сторож не
видит (стиль из непереданных файлов, картинки и canvas, капс буквами, циклы на requestAnimationFrame, узкий блок
без контекста, состояния по наведению) и пределы живого слоя: DESIGN_SYSTEM.md, раздел 19.
С --live живой слой обязан запуститься: нет Node, Playwright или браузера = провал [LIVE], а не «чисто».

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
    # 1.5.1: импорт по file-URL (путь с '#', пробелами, диском Windows), проверка кода возврата и JSON.
    # Валидатор, который не запустился или вернул не то, это провал [PALETTE], а не «чисто»
    code = (f"import {{ validate }} from {json.dumps(VAL.resolve().as_uri())};"
            f"const r = validate({json.dumps(pal)}, {{mode:'{mode}', surface:'{hexv(t,'--surface')}'}});"
            "if(!r || !Array.isArray(r.report)) throw new Error('валидатор вернул не отчёт');"
            "console.log(JSON.stringify(r.report));")
    try:
        out = subprocess.run(['node', '--input-type=module', '-e', code], capture_output=True, text=True, timeout=30)
        rep = json.loads(out.stdout.strip()) if out.returncode == 0 else None
        if not isinstance(rep, list) or not rep: raise RuntimeError(next((l.strip() for l in out.stderr.splitlines() if re.search(r'^\s*\w*Error:|Cannot find module|ENOENT', l)), (out.stderr.strip().splitlines() or ['пустой отчёт'])[-1])[:160])
        for row in rep:
            if row[1] in (False, 'fail'): bad('PALETTE', f'{name}: {row[0]}: {row[2]}')
            if row[1] in ('relief', 'floor'): notes.append(f'{name}: {row[0]} требует подписей или таблицы: {row[2]}')
    except Exception as e:
        bad('PALETTE', f'{name}: валидатор палитры не запустился ({e.__class__.__name__}: {e}); нужен Node, файл tools/validate_palette.mjs')

# ---------- 1.5.1: правила стиля по источникам ----------
# Стиль собирается из перечня источников (полный перечень и то, чего сторож не видит: DESIGN_SYSTEM.md §19):
# файл CSS, блоки <style>, атрибуты style="", CSS строкой в JS, el.style.*, cssText, setAttribute('style'), insertRule,
# <style> из JS, вложенный CSS. Код JS как CSS не читается (объект {opacity:.4} это не правило),
# текст в <code>/<pre> тоже. Свои переменные файла подставляются: var(--s) с --s:3px solid var(--warn) это полоса.
TOKEN_BLOCK = re.compile(r'<style[^>]*>(?:(?!</style>).)*?--text-strong\s*:(?:(?!</style>).)*</style>', re.S)
NEUTRAL_VARS = ('--border', '--border-strong', '--divider', '--card-border', '--grid')
# мягкие подложки: рельс, дорожка, выделение фона. Узкий блок такого тона не полоса (контраст с фоном около 1,1)
SOFT_VARS = re.compile(r'var\(--(?:surface(?:-\d)?|bg|track|[\w-]+-soft)\)')
def kebab(n): return re.sub(r'[A-Z]', lambda m: '-' + m.group(0).lower(), n)
def split_top(t, ch=','):
    out, depth, cur = [], 0, ''
    for c in t:
        depth += c in '([' ; depth -= c in ')]'
        if c == ch and depth == 0: out.append(cur); cur = ''
        else: cur += c
    return out + [cur]
def flatten_css(text):
    # CSS с вложенностью (& и дочерние правила, @media, @supports, @layer): каждое правило даёт свои прямые объявления
    # с полным селектором. Объявления родителя до и после вложенного правила принадлежат родителю
    out = []
    def combine(parents, header):
        kids = [h.strip() for h in split_top(header) if h.strip()]
        if not parents or parents == ['@kf']: return kids
        return [(h.replace('&', p) if '&' in h else p + ' ' + h) for p in parents for h in kids]
    def parse(t, parents):
        i, n, buf, direct = 0, len(t), '', []
        while i < n:
            if t[i] == '{':
                header, buf = buf, ''
                depth, j = 1, i + 1
                while j < n and depth:
                    depth += {'{': 1, '}': -1}.get(t[j], 0); j += 1
                body = t[i + 1:j - 1]
                if ';' in header: pre, header = header.rsplit(';', 1); direct.append(pre)
                header = header.strip()
                if header.startswith('@'):
                    if re.match(r'@(?:-webkit-)?keyframes', header): parse(body, ['@kf'])
                    elif re.match(r'@(?:media|supports|container|layer|scope|document)', header): parse(body, parents)
                else: parse(body, combine(parents, header))
                i = j
            else:
                buf += t[i]; i += 1
        direct.append(buf)
        decl = ';'.join(x for x in direct if x.strip())
        if parents and parents != ['@kf'] and decl.strip(): out.append((', '.join(parents), decl))
    parse(text, [])
    return out
def css_sources(p, s):
    blocks, js = [], []
    def add_css(text, where):
        text = re.sub(r'/\*.*?\*/', '', text, flags=re.S)
        for sel, d in flatten_css(text): blocks.append((sel, d, where))
    def add_attrs(text, where):
        # у встроенного стиля селектор собирается из самого элемента: тег, id, class, aria-label (знак бренда по id и т.п.)
        for m in re.finditer(r'<(\w+)\b([^>]*?)\bstyle\s*=\s*(?:"([^"]*)"|\'([^\']*)\')([^>]*)>', text):
            attrs = m.group(2) + ' ' + m.group(5)
            ident = m.group(1).lower() + ''.join(('#' + x) for x in re.findall(r'\bid\s*=\s*["\']([^"\']+)', attrs)) \
                + ''.join(('.' + x.replace(' ', '.')) for x in re.findall(r'\bclass\s*=\s*["\']([^"\']+)', attrs)) \
                + ''.join(('[aria-label=' + x + ']') for x in re.findall(r'\baria-label\s*=\s*["\']([^"\']+)', attrs))
            blocks.append((ident + '[style=""]', m.group(3) or m.group(4) or '', where))
    def add_js(text):
        js.append(text)
        for m in re.finditer(r'<style[^>]*>(.*?)</style>', text, re.S): add_css(m.group(1), 'css-in-js')
        add_attrs(text, 'js')
        for m in re.finditer(r'\.style\.([a-zA-Z]+)\s*=\s*([\'"`])(.*?)\2', text): blocks.append(('[el.style]', kebab(m.group(1)) + ':' + m.group(3), 'js'))
        for m in re.finditer(r'\.style\[\s*[\'"]([\w-]+)[\'"]\s*\]\s*=\s*([\'"`])(.*?)\2', text): blocks.append(('[el.style]', kebab(m.group(1)) + ':' + m.group(3), 'js'))
        for m in re.finditer(r'\.style\.cssText\s*(?:\+?=)\s*([\'"`])(.*?)\1', text, re.S): blocks.append(('[el.style.cssText]', m.group(2), 'js'))
        for m in re.finditer(r'setAttribute\(\s*[\'"]style[\'"]\s*,\s*([\'"`])(.*?)\1', text, re.S): blocks.append(('[setAttribute style]', m.group(2), 'js'))
        for m in re.finditer(r'insertRule\(\s*([\'"`])(.*?)\1', text, re.S): add_css(m.group(2), 'insertRule')
        if re.search(r'createElement\(\s*[\'"]style[\'"]', text):
            for m in re.finditer(r'\.(?:textContent|innerHTML)\s*(?:\+?=)\s*([\'"`])(.*?)\1', text, re.S):
                if '{' in m.group(2): add_css(m.group(2), 'style из JS')
        for m in re.finditer(r'Object\.assign\(\s*[\w.$]+\.style\s*,\s*\{([^{}]*)\}', text):
            blocks.append(('[el.style]', ';'.join(kebab(k) + ':' + v for k, v in re.findall(r'([a-zA-Z]+)\s*:\s*[\'"`]([^\'"`]*)', m.group(1))), 'js'))
        for m in re.finditer(r'\.style\.setProperty\(\s*[\'"]([\w-]+)[\'"]\s*,\s*[\'"`]([^\'"`]*)', text): blocks.append(('[el.style]', m.group(1) + ':' + m.group(2), 'js'))
    if p.suffix == '.css': add_css(s, 'css'); markup = ''
    elif p.suffix == '.js': add_js(s); markup = s
    else:
        h = TOKEN_BLOCK.sub('', s)
        for m in re.finditer(r'<style[^>]*>(.*?)</style>', h, re.S): add_css(m.group(1), 'style')
        for m in re.finditer(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', h, re.S): add_js(m.group(1))
        markup = re.sub(r'<(style|script)\b[^>]*>.*?</\1>', '', h, flags=re.S)
        markup = re.sub(r'<(code|pre)\b[^>]*>.*?</\1>', '', markup, flags=re.S)
        add_attrs(markup, 'markup')
    props = {}
    for sel, d, _ in blocks:
        for k, v in re.findall(r'(--[\w-]+)\s*:\s*([^;]+)', d): props[k] = v.strip()
    def res(v, depth=0):
        nv = re.sub(r'var\(\s*(--[\w-]+)\s*(?:,[^()]*)?\)', lambda m: props.get(m.group(1), m.group(0)), v)
        return nv if nv == v or depth > 5 else res(nv, depth + 1)
    return blocks, '\n'.join(js), markup, props, res

def decls(d):
    out = {}
    for k, v in re.findall(r'(?<![\w-])(--[\w-]+|-?[a-zA-Z][\w-]*)\s*:\s*([^;]+)', d): out[k if k.startswith('--') else k.lower()] = re.sub(r'\s*!important\s*$', '', v.strip(), flags=re.I)
    return out
def length_px(t):
    t = t.strip().lower()
    m = re.fullmatch(r'(-?\d*\.?\d+)(px|rem|em)?', t)
    if m: return float(m.group(1)) * (1 if m.group(2) in (None, 'px') else 16)
    return {'thin': 1, 'medium': 3, 'thick': 5}.get(t)
STYLE_KW = r'\b(?:solid|dashed|dotted|double|groove|ridge|inset|outset)\b'

def style_rules(p, s, rel):
    blocks, js, markup, props, res = css_sources(p, s)
    neutral_broken = {k for k in NEUTRAL_VARS if k in props and not re.fullmatch(r'var\(--(?:' + '|'.join(x[2:] for x in NEUTRAL_VARS) + r')\)', props[k])}
    def colored(v):
        # цвет полосы: всё, что не нейтральная линия, не прозрачно и не «нет». Цвет не указан = currentColor = цвет
        raw = re.sub(STYLE_KW, '', v, flags=re.I)
        raw = re.sub(r'(?<![\w-])-?\d*\.?\d+(?:px|rem|em)?\b|\b(?:thin|medium|thick)\b', '', raw, flags=re.I).strip()
        if not raw: return True
        if re.fullmatch(r'(?i)transparent|none|inherit|initial|unset|0', raw): return False
        m = re.fullmatch(r'var\((--[\w-]+)\)', raw)
        if m and m.group(1) in NEUTRAL_VARS and m.group(1) not in neutral_broken: return False
        if SOFT_VARS.fullmatch(raw): return False
        return True
    def has_style(v): return not re.search(r'(?i)\bnone\b|\bhidden\b', v)
    seen = set()
    def hit(code, msg):
        if (code, msg) not in seen: seen.add((code, msg)); bad(code, msg)
    geom = []  # узкие блоки без цвета: цвет может прийти из соседнего правила того же элемента
    sides = []  # рамка сбоку прозрачная или нейтральная: цвет может прийти в правиле состояния (.is-active, .is-warn)
    for sel, d, where in blocks:
        D = {k: res(v) for k, v in decls(d).items()}
        lab = f'{rel}: {sel[-50:]}' + ('' if where in ('css', 'style') else f' ({where})')
        # --- SIDESTRIPE ---
        stripe = None
        for side in ('left', 'right', 'inline-start', 'inline-end'):
            v = D.get('border-' + side)
            if v and has_style(v):
                ws = [length_px(t) for t in v.split() if length_px(t) is not None]
                w = ws[0] if ws else 3  # ширина не указана: medium
                if w >= 2 and re.search(STYLE_KW, v, re.I) and colored(v): stripe = 'border-' + side
            wv = D.get(f'border-{side}-width'); st = D.get(f'border-{side}-style', D.get('border-style', ''))
            if wv and length_px(wv) and length_px(wv) >= 2 and st and has_style(st):
                if colored(D.get(f'border-{side}-color', D.get('border-color', ''))): stripe = f'border-{side}-width'
        if 'border-width' in D and D.get('border-style') and has_style(D['border-style']):
            ws = [length_px(t) or 0 for t in D['border-width'].split()]
            t, r, b, l = (ws + ws + ws + ws)[:4] if len(ws) == 1 else (ws[0], ws[1], ws[2], ws[3] if len(ws) > 3 else ws[1]) if len(ws) >= 3 else (ws[0], ws[1], ws[0], ws[1])
            if t == 0 and b == 0 and max(l, r) >= 2 and colored(D.get('border-color', '')): stripe = 'border-width с одной стороной'
        if 'border' in D and has_style(D['border']):
            ws = [length_px(x) for x in D['border'].split() if length_px(x) is not None]
            zero = lambda k: k in D and (re.fullmatch(r'(?i)0(px)?|none', D[k]) is not None)
            if ws and ws[0] >= 2 and colored(D['border']) and zero('border-top') and zero('border-bottom') and (zero('border-left') or zero('border-right')): stripe = 'border с обнулёнными сторонами'
        for part in re.split(r',(?![^(]*\))', D.get('box-shadow', '')):
            toks = part.split(); lens = [length_px(x) for x in toks if length_px(x) is not None]
            color = ' '.join(x for x in toks if length_px(x) is None and x.lower() != 'inset')
            if len(lens) >= 2 and abs(lens[0]) >= 2 and lens[1] == 0 and (len(lens) < 3 or lens[2] == 0) and (len(lens) < 4 or lens[3] == 0) and color and colored(color): stripe = 'тень ' + part.strip()[:30]
        bgi = D.get('background', '') + ' ' + D.get('background-image', '')
        g = re.search(r'linear-gradient\(\s*(?:90deg|270deg|to right|to left)\s*,\s*((?:[^,()]|\([^()]*\))+?)\s+(\d+(?:\.\d+)?)px\s*,\s*((?:[^,()]|\([^()]*\))+?)\s+(?:\2px|0(?:px)?)\s*[,)]', bgi)
        if g and float(g.group(2)) <= 6 and colored(g.group(1)) and g.group(1).strip() != g.group(3).strip(): stripe = 'жёсткий край градиента ' + g.group(2) + 'px'
        bs = re.search(r'/\s*(\d+(?:\.\d+)?)px\s+100%', bgi) or re.fullmatch(r'\s*(\d+(?:\.\d+)?)px\s+100%\s*', D.get('background-size', ''))
        if bs and float(bs.group(1)) <= 6 and 'gradient(' in bgi and colored(bgi.split('gradient(', 1)[1]): stripe = 'полоса размером фона ' + bs.group(1) + 'px'
        bi = D.get('border-inline')
        if bi and has_style(bi) and colored(bi):
            ws = [length_px(x) for x in bi.split() if length_px(x) is not None]
            zero = lambda k: k in D and re.fullmatch(r'(?i)0(px)?|none', D[k]) is not None
            if ws and ws[0] >= 2 and (zero('border-inline-end') or zero('border-inline-start') or zero('border-right') or zero('border-left')): stripe = 'border-inline с обнулённым концом'
        w = next((length_px(D[k]) for k in ('width', 'inline-size', 'min-width') if k in D and length_px(D[k]) is not None), None)
        tall = any(k in D and length_px(D[k]) is not None and length_px(D[k]) >= 16 for k in ('height', 'min-height', 'block-size')) \
            or D.get('height') == '100%' or D.get('block-size') == '100%' or D.get('align-self') == 'stretch' \
            or (D.get('position') in ('absolute', 'fixed') and (('top' in D and 'bottom' in D) or re.match(r'0(?:px)?\s+\S+\s+0(?:px)?\b', D.get('inset', ''))))
        inline = re.match(r'inline', D.get('display', ''))
        edge = re.search(r'::?(?:before|after)', sel) or (D.get('position') in ('absolute', 'fixed') and (re.fullmatch(r'0(?:px)?', D.get('left', D.get('right', 'x'))) or re.match(r'0(?:px)?\s+\S+\s+0(?:px)?\s+0(?:px)?|0(?:px)?\s+0(?:px)?\s+0(?:px)?\s+\S+', D.get('inset', ''))))
        heading = re.search(r'(?<![\w-])h[1-6]\b|title|head|\.sec\b|label|name', sel)
        handle = re.search(r'resize|col-resize|ew-resize|thumb|scroll|today|now-line|cursor', sel + ' ' + D.get('cursor', ''))
        if w is not None and 1 <= w <= 4 and tall and (not inline or heading or re.search(r'::?(?:before|after)', sel)) and (edge or heading) and not handle:
            bg = D.get('background-color') or D.get('background') or D.get('background-image')
            gm = re.search(r'gradient\(\s*(?:[^,()]+,\s*)?((?:[^,()]|\([^()]*\))+)', bg) if bg else None
            if bg and colored(gm.group(1).strip() if gm else bg): stripe = f'узкий цветной блок {w:g}px'
            elif not bg: geom.append(sel)
        for side in ('left', 'right', 'inline-start', 'inline-end'):
            v = D.get('border-' + side) or D.get('border')
            if v and has_style(v) and re.search(STYLE_KW, v, re.I) and not colored(v):
                ws = [length_px(t) for t in v.split() if length_px(t) is not None]
                if (ws[0] if ws else 3) >= 2:
                    sides.append((sel, side))
                    c = D.get(f'border-{side}-color')
                    if c and colored(c): hit('SIDESTRIPE', f'{lab} прозрачная рамка, у которой сторона {side} окрашена: полоса сбоку')
        if stripe: hit('SIDESTRIPE', f'{lab} рисует цветную полосу сбоку ({stripe}); тон передаёт значок или слово')
        # --- CAPSBADGE: капс только рецептом .ks-caps (короткая метка с --tracking-caps) ---
        caps = D.get('text-transform', '').lower() == 'uppercase' or re.search(r'small-caps|petite-caps', D.get('font-variant-caps', '') + D.get('font-variant', ''))
        if caps and not re.search(r'ks-caps|ks-input|(?<![\w-])(?:input|textarea|code|kbd|pre)\b', re.split(r'\s*[\s>+~]\s*', sel.strip())[-1] if sel.strip() else sel) and 'var(--tracking-caps)' not in d:
            hit('CAPSBADGE', f'{lab} набирает текст капсом; капс только у коротких меток рецептом .ks-caps')
        # --- GRADMARK ---
        grad = re.search(r'gradient\(', ' '.join(D.get(k, '') for k in ('background', 'background-image', 'fill', 'border-image'))) \
            or re.search(r'var\(--[\w-]*gradient', ' '.join(decls(d).get(k, '') for k in ('background', 'background-image')))
        if grad and re.search(r'brand|logo|emblem|monogram|(?<![\w-])mark\b|-mark\b|home|главн', sel, re.I): hit('GRADMARK', f'{lab} с градиентом')
        # --- LOOPANIM ---
        for k in ('animation', 'animation-iteration-count'):
            v = D.get(k, '')
            if not v: continue
            nums = [float(x) for x in re.findall(r'(?<![\w.-])(\d+(?:\.\d+)?(?:e\d+)?)(?![\w.%])', v)]
            loop = 'infinite' in v.lower() or any(n >= 50 for n in nums)
            spin_ok = re.search(r'\bks-spin\b', v) and re.search(r'ks-sync|load|spin|busy|progress|wait', sel)
            shim_ok = re.search(r'\bks-shimmer\b', v) and re.search(r'skeleton|shimmer|placeholder|load', sel)
            if loop and not (spin_ok or shim_ok): hit('LOOPANIM', f'{lab} крутит бесконечную анимацию; цикл допустим только у загрузки')
        # --- OPACITY ---
        OPA_OK = r':disabled|\[disabled\]|aria-disabled|is-disabled|(?<![\w-])(?:svg|path|circle|rect|line|polyline|polygon|img|video|canvas)\b|ks-sync|ks-spark|ks-ic\b|ks-skeleton|backdrop|is-hidden|ks-tip\b|ks-nav-hl'
        is_kf = re.fullmatch(r'\s*(?:from|to|\d+(?:\.\d+)?%)(?:\s*,\s*(?:from|to|\d+(?:\.\d+)?%))*\s*', sel)
        vals = []
        o = D.get('opacity')
        if o:
            m = re.fullmatch(r'(\d*\.?\d+)(%)?', o.strip())
            if m: vals.append(float(m.group(1)) / (100 if m.group(2) else 1))
        for m in re.finditer(r'opacity\(\s*(\d*\.?\d+)(%)?', D.get('filter', '')): vals.append(float(m.group(1)) / (100 if m.group(2) else 1))
        cm = re.fullmatch(r'(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\((?:[^()]|\([^()]*\))*?[,/]\s*(\d*\.?\d+)(%)?\s*\)|#[0-9a-fA-F]{6}([0-9a-fA-F]{2})', (D.get('color', '') or D.get('-webkit-text-fill-color', '')).strip())
        if not cm: cm = re.fullmatch(r'(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\((?:[^()]|\([^()]*\))*?[,/]\s*(\d*\.?\d+)(%)?\s*\)|#[0-9a-fA-F]{6}([0-9a-fA-F]{2})', D.get('-webkit-text-fill-color', '').strip())
        if re.search(r'color-mix\([^;]*\btransparent\b', D.get('color', '')): vals.append(0.5)
        if cm:
            a = (float(cm.group(1)) / (100 if cm.group(2) else 1)) if cm.group(1) else int(cm.group(3), 16) / 255
            if 0 < a < 1: vals.append(a)
        nonot = re.sub(r':not\((?:[^()]|\([^()]*\))*\)', '', sel)
        target = re.split(r'\s*[\s>+~]\s*', nonot.strip())[-1] if nonot.strip() else nonot
        opa_ok = re.search(OPA_OK, target) or re.search(r':disabled|\[disabled\]|aria-disabled|is-disabled', nonot)
        if any(0 < x < 1 for x in vals) and not is_kf and not opa_ok:
            hit('OPACITY', f'{lab} приглушает прозрачностью; для текста бери --text-muted')
        # --- DENSITYTAP ---
        if re.search(r'\[data-density\s*=\s*["\']?compact["\']?\s*\]', sel):
            if re.search(r'btn|button|input|select|textarea|seg|chip|tab|toggle|switch|checkbox|radio|option|link|nav-item|cmdk|\[role=|(?<![\w-])a\b', sel):
                for k in ('height', 'min-height', 'max-height', 'block-size', 'min-block-size', 'max-block-size'):
                    raw = decls(d).get(k, '')
                    if k not in D or re.search(r'var\(--tap(?:-sm)?\)', raw) or re.fullmatch(r'(?i)auto|none|fit-content|min-content|max-content|100%|inherit|unset', D[k].strip()): continue
                    px = length_px(D[k])
                    if px is None or px < 36: hit('DENSITYTAP', f'{lab} в компактной плотности задаёт {k}: {D[k]}; цель пальца не меньше 36 px')
        for k, lim in (('--tap', 44), ('--tap-sm', 36)):
            v = decls(d).get(k)
            if v and length_px(v) is not None and length_px(v) < lim: hit('DENSITYTAP', f'{lab} переопределяет {k} = {v}; цели пальца не меньше {lim}px')
        # --- HEX на странице проекта: цвет мимо токенов ---
        if where in ('css', 'style', 'css-in-js', 'markup', 'js', 'insertRule', 'style из JS') and p.parent.name != 'kit':
            hx = sorted(set(re.findall(r'#[0-9A-Fa-f]{3,8}\b', d)))
            if hx: hit('HEX', f'{lab}: цвет мимо токенов {hx[:4]}')
            for k, v in decls(d).items():
                if re.match(r'(?:color|background|background-color|border(?:-[\w-]+)?-color|border(?:-[\w-]+)?|fill|stroke|outline(?:-color)?)$', k) and re.search(r'(?:rgba?|hsla?)\(\s*\d', v):
                    hit('HEX', f'{lab}: цвет {k} литералом {v[:30]} мимо токенов'); break
    # цвет узкого блока в соседнем правиле того же элемента (.bar{width:3px;height:17px} .bar.is-hot{background:...})
    for gsel in geom:
        for sel, d, where in blocks:
            if sel != gsel and sel.startswith(gsel) and re.match(r'[.:\[]', sel[len(gsel):]):
                bg = decls(d).get('background-color') or decls(d).get('background')
                if bg and colored(res(bg)): hit('SIDESTRIPE', f'{rel}: {sel[-50:]} красит узкий блок {gsel} в цвет: полоса сбоку')
    for bsel, side in sides:
        for sel, d, where in blocks:
            if sel != bsel and sel.startswith(bsel) and re.match(r'[.:\[]', sel[len(bsel):]):
                dd = decls(d); c = dd.get(f'border-{side}-color') or dd.get('border-color')
                if c and colored(res(c)): hit('SIDESTRIPE', f'{rel}: {sel[-50:]} красит рамку {side} элемента {bsel[-30:]} в цвет: полоса сбоку в состоянии')
    # --- JS и разметка: циклы, которых нет в CSS ---
    # служебные имена кита: разрешение цикла действует только на вращение и перелив кита, а не на свою анимацию под тем же именем
    KIT_KF = {'spin': 'to{transform:rotate(360deg);}', 'shimmer': 'from{background-position:120%0;}to{background-position:-120%0;}'}
    for m in re.finditer(r'@(?:-webkit-)?keyframes\s+ks-(spin|shimmer)\s*\{((?:[^{}]|\{[^{}]*\})*)\}', s):
        if re.sub(r'\s+', '', m.group(2)) != KIT_KF[m.group(1)]: hit('LOOPANIM', f'{rel}: своя анимация под служебным именем ks-{m.group(1)}; разрешение цикла на неё не распространяется')
    for m in re.finditer(r'iterations\s*:\s*(Infinity|Number\.POSITIVE_INFINITY|\d+(?:\.\d+)?(?:e\d+)?)', js):
        if not re.fullmatch(r'\d+', m.group(1)) or int(m.group(1)) >= 50: hit('LOOPANIM', f'{rel}: element.animate(..., {{iterations: {m.group(1)}}}) крутит бесконечную анимацию'); break
    TOG = r'classList\.(?:toggle|add|remove)|\.hidden\s*=\s*!|\.style\.(?:opacity|visibility|display)\s*='
    for fn in re.findall(r'(?:function\s+(\w+)\s*\([^)]*\)\s*\{|(?:const|let|var)\s+(\w+)\s*=\s*(?:function\s*\w*\s*\([^)]*\)\s*\{|(?:\([^)]*\)|\w+)\s*=>\s*\{?))[^}]{0,200}?(?:' + TOG + ')', js):
        name = fn[0] or fn[1]
        if name and re.search(r'setInterval\(\s*(?:' + re.escape(name) + r'\b|(?:\([^)]*\)|\w+)\s*=>\s*' + re.escape(name) + r'\s*\()', js): hit('LOOPANIM', f'{rel}: мигание таймером setInterval({name}) переключает вид элемента')
    for m in re.finditer(r'setInterval\(\s*(?:\([^)]*\)\s*=>|function\s*\([^)]*\))\s*\{?((?:[^{}]|\{[^{}]*\}){0,300})', js):
        if re.search(TOG, m.group(1)): hit('LOOPANIM', f'{rel}: мигание таймером: setInterval переключает класс, hidden или стиль'); break
    if re.search(r'addEventListener\(\s*[\'"]animationend[\'"](?:[^;]|;(?!\s*\}\s*\)))*?classList\.add', js): hit('LOOPANIM', f'{rel}: анимация перезапускается по animationend: бесконечный цикл')
    if re.search(r'(?<![\w-])repeat\s*:\s*-1\b', js): hit('LOOPANIM', f'{rel}: анимация библиотеки с repeat: -1 крутится бесконечно')
    if re.search(r'setInterval\(\s*(?:\([^)]*\)\s*=>|function)[^;]{0,160}classList\.toggle', js): hit('LOOPANIM', f'{rel}: мигание таймером setInterval + classList.toggle')
    if re.search(r'repeat(?:Count|Dur)\s*=\s*\\?["\']indefinite', markup + js) or any(int(x) >= 50 for x in re.findall(r'repeatCount\s*=\s*\\?["\'](\d+)', markup + js)): hit('LOOPANIM', f'{rel}: анимация SVG (SMIL) с бесконечным или огромным repeatCount')
    grads = set(re.findall(r'<(?:linear|radial)Gradient\b[^>]*\bid\s*=\s*\\?["\']([^"\'\\]+)', markup + js))
    for m in re.finditer(r'<(\w+)\b([^>]*)>((?:(?!</\1>).){0,600}?)<svg\b([^>]*)>((?:(?!</svg>).)*)</svg>|<svg\b([^>]*)>((?:(?!</svg>).)*)</svg>', markup + js, re.S):
        hostattrs = (m.group(2) or '') + ' ' + (m.group(4) or m.group(6) or '')
        body = m.group(5) or m.group(7) or ''
        if re.search(r'brand|logo|emblem|monogram|mark|home|главн', hostattrs, re.I) and any(('url(#' + g + ')') in body.replace('"', '').replace("'", '') for g in grads):
            hit('GRADMARK', f'{rel}: знак бренда в SVG залит градиентом из defs'); break
    if re.search(r'<svg\b[^>]*class=\\?["\'][^"\']*(?:brand|logo|emblem|mark)[^"\']*["\'](?:(?!</svg>).)*<(?:linear|radial)Gradient', markup + js, re.S) \
       or re.search(r'class=\\?["\'][^"\']*(?:brand|logo|emblem|mark)[^"\']*["\'][^>]*>(?:(?!</(?:div|a|span|header)>).){0,400}?<svg\b(?:(?!</svg>).)*<(?:linear|radial)Gradient', markup + js, re.S):
        hit('GRADMARK', f'{rel}: знак бренда в SVG залит градиентом')

# ---------- исходники системы и страницы проекта ----------
targets = [HERE / 'kit' / f for f in ('kit.css', 'kit.js', 'charts.js', 'icons.js')] + [Path(a) for a in sys.argv[1:]]
for p in targets:
    if not p.exists(): bad('FILE', f'нет файла {p}'); continue
    s = p.read_text(encoding='utf-8')
    rel = p.name
    if EM in s: bad('EMDASH', f'{rel}: длинных тире {s.count(EM)}')
    if re.search(r'&mdash;|&#0*8212;|&#x0*2014;|\\u2014|\\u\{0*2014\}|\\0*2014\b|fromCharCode\(\s*(?:8212|0x2014)\s*\)|fromCodePoint\(\s*(?:8212|0x2014)\s*\)', s, re.I): bad('EMDASH', f'{rel}: длинное тире записано сущностью или кодом')
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
    if '::view-transition-' in body and not re.search(r'prefers-reduced-motion[^{]*\{(?:[^{}]*\{[^{}]*\})*?[^{}]*::view-transition-group\(\*\)', body):
        bad('VTMOTION', f'{rel}: переходы View Transitions не выключаются при «меньше движения»')
    # --- признаки шаблонного интерфейса (1.3, по источникам с 1.5.1) ---
    style_rules(p, s, rel)
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
LIVE_NEED = 'нужен Node и Playwright с браузером: npm i -D playwright && npx playwright install chromium (или NODE_PATH к глобальному пакету)'
def run_live(script, marker, label):
    # 1.5.1: живой слой падает громко. Упавший node или нет итоговой строки = [LIVE], а не «чисто»
    try:
        r = subprocess.run(['node', str(HERE / 'tools' / script)] + pages, capture_output=True, text=True, timeout=900)
    except (FileNotFoundError, subprocess.TimeoutExpired) as e:
        bad('LIVE', f'{label} не запустился ({e.__class__.__name__}); {LIVE_NEED}'); return None
    last = [l for l in r.stdout.splitlines() if l.strip()]
    ok = r.returncode in (0, 1) and last and (last[-1].startswith(marker) or last[-1].startswith('ИТОГО провалов контраста'))
    if not ok:
        errs = [l.strip() for l in r.stderr.splitlines() if re.search(r'^\s*\w*Error:|Cannot find module|Executable doesn.t exist|ENOENT', l)]
        err = (errs[0] if errs else (r.stderr.strip().splitlines() or ['нет итоговой строки'])[-1])[:160]
        bad('LIVE', f'{label} не запустился: {err}; {LIVE_NEED}'); return None
    return r
if LIVE and pages:
    r = run_live('contrast_live.mjs', 'КОНТРАСТ:', 'живой контраст')
    if r:
        for line in r.stdout.splitlines():
            if line.startswith('   '): bad('CONTRAST', line.strip())
    # 1.5.1: живой стиль по вычисленным стилям отрисованной страницы: цвет из чужого файла, стиль от скрипта,
    # запущенные анимации, цели пальца на касании в компактной плотности
    r = run_live('style_live.mjs', 'СТИЛЬ ЖИВЬЁМ:', 'живой стиль')
    if r:
        for line in r.stdout.splitlines():
            m = re.match(r'\s{3}\[([A-Z]+)\]\s*(.*)', line)
            if m: bad(m.group(1), 'живьём: ' + m.group(2))
elif LIVE:
    bad('LIVE', 'ключ --live без страниц: живой слой не проверил ничего; укажи html-файлы')

for n in notes: print('  заметка:', n)
if fails:
    print(f'\nПРОВАЛ: {len(fails)}')
    for c, m in fails: print(f'  [{c}] {m}')
    sys.exit(1)
print('\nСТОРОЖ DS: чисто')
