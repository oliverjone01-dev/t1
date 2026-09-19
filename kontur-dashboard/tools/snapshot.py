#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Фиксирует точку съёма позиций в дневной ряд.

Зачем: ретроспективы по сводке домена в keys.so нет. Если точку не записать,
она не восстановится задним числом никогда. Файл только дописывается,
одна строка это один проект за один день, повтор за тот же день перезаписывает строку.

  python3 tools/snapshot.py           # записать точку за сегодня
  python3 tools/snapshot.py --seed    # доложить историю из keysso.json (разово)
  python3 tools/snapshot.py --check   # проверить ряд на разрывы, ничего не писать
"""
import json, sys, datetime
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
        print(f'{code}: точек {len(ds)}, с {first} по {last}, свежесть {stale} дн.')
        for g in gaps: print(f'   разрыв: {g}')
        if stale > 8:
            print(f'   ПРОСРОЧКА: последняя точка старше восьми дней'); bad += 1
    return 1 if bad else 0

if __name__ == '__main__':
    a = sys.argv[1:]
    if '--seed' in a: cmd_seed()
    elif '--check' in a: sys.exit(cmd_check())
    else: cmd_write()
