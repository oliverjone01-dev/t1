#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Фиксирует точку съёма позиций в дневной ряд.

Зачем: ретроспективы по сводке домена в keys.so нет. Если точку не записать,
она не восстановится задним числом никогда. Файл только дописывается,
одна строка это один проект за один день, повтор за тот же день перезаписывает строку.

  python3 tools/snapshot.py           # записать точку за сегодня
  python3 tools/snapshot.py --seed    # доложить историю из keysso.json (разово)
  python3 tools/snapshot.py --backfill # добрать свои точки из истории keysso.json в git
  python3 tools/snapshot.py --check   # проверить ряд на разрывы, ничего не писать

Свой съём можно восстановить задним числом, только если в тот день сборщик
(harvest.yml) закоммитил keysso.json: --backfill проходит по истории git и берёт
верхний блок каждой выгрузки. Дня, когда выгрузки в git нет, не вернуть ничем.
"""
import json, sys, datetime, subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]
ROOT = HERE.parent
SRC  = ROOT / 'gg-seo-geo-monster' / 'data'
HIST = HERE / 'data' / 'history' / 'positions.ndjson'
DIRS = {'gm': 'glass-memory', 'gg': 'genglass'}

def load(p):
    try: return json.loads(Path(p).read_text(encoding='utf-8'))
    except Exception: return None

def read_rows():
    rows = {}
    if HIST.exists():
        for line in HIST.read_text(encoding='utf-8').splitlines():
            line = line.strip()
            if not line: continue
            try: r = json.loads(line)
            except Exception: continue
            rows[(r['project'], r['date'])] = r
    return rows

def write_rows(rows):
    HIST.parent.mkdir(parents=True, exist_ok=True)
    keys = sorted(rows, key=lambda k: (k[1], k[0]))
    HIST.write_text('\n'.join(json.dumps(rows[k], ensure_ascii=False, sort_keys=True) for k in keys) + '\n',
                    encoding='utf-8')

def point(code, ks, date):
    return {'project': code, 'date': date,
            'top1': ks.get('top1'), 'top3': ks.get('top3'),
            'top10': ks.get('top10'), 'top50': ks.get('top50'),
            'visibility': ks.get('visibility'), 'ai_answers': ks.get('ai_answers'),
            'source': 'keys.so'}

def cmd_write():
    rows = read_rows(); added = 0
    for code, d in DIRS.items():
        ks = load(SRC / d / 'keysso.json')
        if not ks:
            print(f'  {code}: выгрузки нет, точка не записана'); continue
        date = ks.get('measured') or datetime.date.today().isoformat()
        date = date[:10]
        key = (code, date)
        new = point(code, ks, date)
        if rows.get(key) == new:
            print(f'  {code} {date}: точка уже записана, без изменений')
        else:
            rows[key] = new; added += 1
            print(f'  {code} {date}: топ-10 {ks.get("top10")}, топ-50 {ks.get("top50")}, видимость {ks.get("visibility")}')
    write_rows(rows)
    print(f'записано точек: {added}, всего в ряду: {len(rows)}')

def cmd_seed():
    """Разовый добор истории из keysso.json. Точка из выгрузки не перетирает нашу."""
    rows = read_rows(); added = 0
    for code, d in DIRS.items():
        ks = load(SRC / d / 'keysso.json') or {}
        for r in (ks.get('history') or []):
            date = (r.get('date') or '')[:10]
            if not date: continue
            key = (code, date)
            if key in rows: continue
            rows[key] = {'project': code, 'date': date, 'top1': None, 'top3': None,
                         'top10': r.get('top10'), 'top50': r.get('top50'),
                         'visibility': r.get('visibility'), 'ai_answers': None,
                         'source': 'keysso.json history'}
            added += 1
    write_rows(rows)
    print(f'добрано из выгрузки: {added}, всего в ряду: {len(rows)}')

def ok_point(ks):
    """Выгрузка, где сборщик упал, приходит с нулями и без ответов ИИ: это не точка."""
    return bool(ks) and bool(ks.get('top10') or ks.get('top50'))

def cmd_backfill():
    """Свои точки из истории git: одна на дату measured, свежий коммит за день важнее.

    Своя точка, уже записанная в ряд, не перезаписывается. Строка ретроспективы за тот
    же день (только топ-10 и видимость) заменяется полной точкой из выгрузки.
    Нужна полная история: в CI checkout с fetch-depth: 0.
    """
    rows = read_rows(); added = 0
    for code, d in DIRS.items():
        rel = f'gg-seo-geo-monster/data/{d}/keysso.json'
        try:
            revs = subprocess.run(['git', '-C', str(ROOT), 'log', '--format=%H', '--', rel],
                                  capture_output=True, text=True, check=True).stdout.split()
        except Exception as e:
            print(f'  {code}: история git недоступна ({e}), добор пропущен'); continue
        seen = set()
        for h in revs:                       # от свежих к старым
            try:
                ks = json.loads(subprocess.run(['git', '-C', str(ROOT), 'show', f'{h}:{rel}'],
                                               capture_output=True, text=True, check=True).stdout)
            except Exception:
                continue
            date = (ks.get('measured') or '')[:10]
            if not date or date in seen or not ok_point(ks):
                continue
            seen.add(date)
            cur = rows.get((code, date))
            if cur and str(cur.get('source', '')).startswith('keys.so'):
                continue                     # своя точка уже есть
            rows[(code, date)] = dict(point(code, ks, date), source='keys.so git')
            added += 1
        print(f'  {code}: выгрузок в истории {len(revs)}, дат с данными {len(seen)}')
    write_rows(rows)
    print(f'добрано своих точек из истории git: {added}, всего в ряду: {len(rows)}')

def cmd_check():
    rows = read_rows()
    if not rows: print('ряд пуст'); return 1
    bad = 0
    for code in DIRS:
        ds = sorted(d for (c, d) in rows if c == code)
        if not ds: print(f'{code}: точек нет'); bad += 1; continue
        first, last = datetime.date.fromisoformat(ds[0]), datetime.date.fromisoformat(ds[-1])
        gaps, prev = [], None
        for s in ds:
            cur = datetime.date.fromisoformat(s)
            if prev and (cur - prev).days > 8:
                gaps.append(f'{prev.isoformat()} -> {s} ({(cur - prev).days} дн.)')
            prev = cur
        stale = (datetime.date.today() - last).days
        own = sorted(d for (c, d), r in rows.items() if c == code and str(r.get('source', '')).startswith('keys.so'))
        print(f'{code}: точек {len(ds)}, своих съёмов {len(own)}, с {first} по {last}, свежесть {stale} дн.')
        prev = None
        for s_ in own:
            cur = datetime.date.fromisoformat(s_)
            if prev and (cur - prev).days > 8:
                print(f'   разрыв своих съёмов: {prev.isoformat()} -> {s_} ({(cur - prev).days} дн.)')
            prev = cur
        for g in gaps: print(f'   разрыв: {g}')
        if stale > 8:
            print(f'   ПРОСРОЧКА: последняя точка старше восьми дней'); bad += 1
    return 1 if bad else 0

if __name__ == '__main__':
    a = sys.argv[1:]
    if '--seed' in a: cmd_seed()
    elif '--backfill' in a: cmd_backfill()
    elif '--check' in a: sys.exit(cmd_check())
    else: cmd_write()
