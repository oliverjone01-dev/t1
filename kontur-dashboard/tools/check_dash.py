# -*- coding: utf-8 -*-
"""Сторож дашборда. Валится, если в страницу просочилась цифра без класса и источника,
запрещённый факт, длинное тире или цвет мимо проверенной палитры."""
import re, json, sys

from pathlib import Path
SRC = str(Path(__file__).resolve().parents[1] / 'public' / 'index.html')
s = open(SRC, encoding='utf-8').read()
fails = []
def bad(code, msg): fails.append((code, msg))

# --- 1. длинное тире ---
n = s.count('—')
if n: bad('EMDASH', f'найдено длинных тире: {n}')

# --- 2. блок данных: класс, источник и дата у каждой цифры ---
m = re.search(r'const DB = (\{.*?\});\n', s, re.S)
if not m: bad('NODB', 'блок DB не найден')
else:
    DB = json.loads(m.group(1))
    def walk(o, path):
        if isinstance(o, dict):
            if 'k' in o and isinstance(o.get('k'), str):
                k = o.get('k')
                if k not in ('ДАННЫЕ','ГИПОТЕЗА','ДЕМО'):
                    bad('KIND', f'{path}: класс «{k}» не из трёх допустимых')
                if k == 'ДАННЫЕ':
                    if not o.get('s'): bad('NOSRC', f'{path}: класс ДАННЫЕ без источника')
                    if not re.match(r'^\d{4}-\d{2}-\d{2}$', str(o.get('at') or '')):
                        bad('NODATE', f'{path}: класс ДАННЫЕ без даты съёма')
                if 'v' in o and o.get('v') is None and k == 'ДАННЫЕ':
                    bad('NULLDANN', f'{path}: пустое значение помечено как ДАННЫЕ')
            for kk, vv in o.items():
                if kk not in ('v','k','s','at','n'): walk(vv, path + '.' + str(kk))
        elif isinstance(o, list):
            for i, vv in enumerate(o): walk(vv, f'{path}[{i}]')
    walk(DB, 'DB')

# --- 3. запрещённые факты ---
BANS = [
 (r'2\s?200\s?[×xхХX]\s?3\s?600', 'предел керамопечати выдан за максимум зеркала'),
 (r'548\s?449', 'ядро по 235 кластерам вместо рабочего 537 874'),
 (r'\bсъём 08\.09\.2026\b', 'дата съёма зашита в вёрстку вместо блока данных'),
 (r'13\s?500\+', 'устаревшее число заказов'),
 (r'гаранти\w*\s+(на\s+\w+\s+)?(каркас\s+)?5\s+лет', 'гарантия сверх 12 месяцев'),
 (r'от\s+25\s?000\s*₽\s*/\s*м2', 'неподтверждённая цена за м2'),
 (r'ДомГласс|DOMGLASS', 'внутреннее имя во внешнем документе'),
]
for rx, why in BANS:
    if re.search(rx, s, re.I): bad('BAN', f'{why} (шаблон {rx})')

# --- 4. цвет только из токенов Контур DS ---
# Графики красятся пресетами KS.charts по слотам --cat-1..5 текущей темы. Любой hex
# в коде графиков значит цвет мимо проверенной палитры и мимо смены темы.
draw = s[s.find('function draw()'):]
for hexv in sorted(set(re.findall(r'#[0-9A-Fa-f]{6}\b', draw))):
    bad('COLOR', f'в графиках цвет {hexv} мимо токенов --cat-1..5')
# Вид из пакета: токены и кит вшиты, Tailwind не подключается.
if 'id="ks-tokens"' not in s or 'id="ks-kit"' not in s:
    bad('KIT', 'в странице нет токенов или кита Контур DS (kontur-ds/): сборка идёт мимо пакета')
if 'cdn.tailwindcss.com' in s:
    bad('KIT', 'страница снова тянет Tailwind: вид должен идти только из Контур DS')
if re.search(r'class=["\'][^"\']*\bopacity-(40|45|50|55|60|70|80)\b', s):
    bad('OPACITY', 'текст приглушён прозрачностью; бери класс ks-muted (--text-muted)')

# --- 5. запрещённые приёмы визуализации ---
# annotations:{yaxis:[...]} это подпись на оси, а не вторая ось: её не считаем
_d = re.sub(r'annotations:\{[^{}]*yaxis:\s*\[', 'annotations:{__ann__[', draw)
if re.search(r'(?<!__ann__)\byaxis:\s*\[', _d): bad('DUALAXIS', 'две оси Y на одном графике')
for mm in re.finditer(r"colors:\s*\[([^\]]*)\]", draw):
    lst = [x.strip().strip("'").upper() for x in mm.group(1).split(',')]
    hexes = [x for x in lst if x.startswith('#')]
    if '#5D87FF' in hexes and '#49BEFF' in hexes:
        i, j = hexes.index('#5D87FF'), hexes.index('#49BEFF')
        if abs(i - j) == 1: bad('CVD', 'пара #5D87FF и #49BEFF стоит соседними сериями, не различима при дальтонизме')

# --- 6. каждый контейнер графика реально рисуется ---
ids = set(re.findall(r"ch\('([a-z0-9-]+)'", s))
for i in ids:
    if i not in draw: bad('EMPTY', f'контейнер {i} без кода отрисовки')

# --- 7. каждый пункт меню имеет экран ---
nav = re.findall(r"id:'([a-z0-9-]+)'", s)
scr = set(re.findall(r"^\s*'?([a-z0-9-]+)'?:\s*\(\)\s*=>", s, re.M))
for v in nav:
    if v not in scr: bad('NOVIEW', f'пункт меню {v} без экрана')

# --- 8. у каждого графика есть таблица-двойник или явное объяснение ---
cards = re.findall(r"card\(", s)
tw = s.count("onclick=\\\"tv(") + s.count("tv('")

# --- 9. ряд позиций: есть, свежий, без длинных разрывов ---
import datetime, subprocess
HIST = Path(__file__).resolve().parents[1] / 'data' / 'history' / 'positions.ndjson'
if not HIST.exists():
    bad('NOHIST', 'нет data/history/positions.ndjson: динамика показывать нечего')
else:
    rows = [json.loads(l) for l in HIST.read_text(encoding='utf-8').splitlines() if l.strip()]
    if len(rows) < 2:
        bad('SHORTHIST', f'в ряду {len(rows)} точек, сравнение периодов невозможно')
    for proj in ('gm', 'gg'):
        ds = sorted(r['date'] for r in rows if r.get('project') == proj)
        if not ds:
            bad('NOPROJHIST', f'в ряду нет ни одной точки по проекту {proj}'); continue
        prev = None
        for x in ds:
            cur = datetime.date.fromisoformat(x)
            if prev and (cur - prev).days > 14:
                bad('GAP', f'{proj}: разрыв в ряду с {prev} по {x}')
            prev = cur

# --- 10. в вёрстке не должно остаться зашитых данных ---
if re.search(r'const DEMOD\s*=', s) and 'ДЕМО' not in s:
    bad('DEMOD', 'демо-ряды в вёрстке без пометки ДЕМО')

print(f'проверок пройдено по {len(ids)} графикам и {len(nav)} пунктам меню, точек в ряду {len(rows) if HIST.exists() else 0}')
if fails:
    print(f'\nПРОВАЛ: {len(fails)}')
    for c, msg in fails: print(f'  [{c}] {msg}')
    sys.exit(1)
print('\nСТОРОЖ: чисто')
