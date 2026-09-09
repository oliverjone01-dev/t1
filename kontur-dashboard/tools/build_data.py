#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Собирает data/kontur.json из живых выгрузок репозитория.

Единственное место, где цифра попадает в дашборд. Каждое значение уезжает в
конверте Протокола 9: значение, класс, источник, дата съёма, примечание.
Если выгрузки нет, ставится null и класс ДЕМО. Правдоподобное число не выдумывается.
"""
import json, os, sys, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]          # корень репозитория
HERE = Path(__file__).resolve().parents[1]          # kontur-dashboard/
SRC  = ROOT / 'gg-seo-geo-monster' / 'data'         # выгрузки соседнего проекта
HIST = HERE / 'data' / 'history' / 'positions.ndjson'

DANN, GIPO, DEMO = 'ДАННЫЕ', 'ГИПОТЕЗА', 'ДЕМО'

def F(v, k, s='', at='', n=''):
    return {'v': v, 'k': k, 's': s, 'at': at, 'n': n}

def load(p):
    try:
        return json.loads(Path(p).read_text(encoding='utf-8'))
    except Exception:
        return None

PROJECTS = {
    'gm': {'dir': 'glass-memory', 'name': 'GLASS-MEMORY', 'dom': 'glass-memory.ru', 'plan': 22_000_000},
    'gg': {'dir': 'genglass',     'name': 'GENGLASS',     'dom': 'genglass.ru',     'plan': 240_000_000},
}

# Внутренние факты проекта: их нет ни в одной выгрузке, они из наших же документов.
FACTS = {
    'gg': {
        'clusters': F(144, DANN, 'Карта посадочных GENGLASS, редакция от 06.09', '2026-09-06', 'кластеров в работе'),
        'themes':   F(34,  DANN, 'Карта посадочных GENGLASS', '2026-09-06', 'тем'),
        'landings': F(19,  DANN, 'Карта посадочных GENGLASS', '2026-09-06', 'посадочных описано с мета и ТЗ'),
        'core':     F(537_874, DANN, 'Карта посадочных GENGLASS, рабочее ядро по 144 кластерам', '2026-09-06', 'показов в месяц'),
        'units':    F(29,  DANN, 'Задания контентщикам, редакция 4', '2026-09-06', 'контент-единиц готово к передаче'),
        'published':F(0,   DANN, 'Задания контентщикам, редакция 4', '2026-09-06', 'опубликовано из них'),
    },
    'gm': {
        'clusters': F(None, DEMO, '', '', 'кластеризация по проекту не запускалась'),
        'themes':   F(None, DEMO, '', '', ''),
        'landings': F(None, DEMO, '', '', 'карты посадочных по проекту нет'),
        'core':     F(None, DEMO, '', '', ''),
        'units':    F(None, DEMO, '', '', 'заданий по проекту нет'),
        'published':F(None, DEMO, '', '', ''),
    },
}

def read_history():
    """Дневной ряд, накопленный нами. Ключ - пара проект плюс дата."""
    rows = {}
    if HIST.exists():
        for line in HIST.read_text(encoding='utf-8').splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                r = json.loads(line)
            except Exception:
                continue
            rows[(r.get('project'), r.get('date'))] = r
    out = {}
    for (proj, _), r in sorted(rows.items(), key=lambda kv: (kv[0][0], kv[0][1])):
        out.setdefault(proj, []).append(r)
    return out

def build_project(code, cfg, hist):
    d = SRC / cfg['dir']
    ks = load(d / 'keysso.json') or {}
    ym = load(d / 'metrika.json')
    dr = load(d / 'direct.json')
    at = ks.get('measured', '')
    src = f"keys.so через gg-seo-geo-monster/data/{cfg['dir']}/keysso.json"

    def ksf(field, note=''):
        v = ks.get(field)
        return F(v, DANN if v is not None else DEMO, src if v is not None else '', at if v is not None else '', note)

    p = {
        'code': code, 'name': cfg['name'], 'dom': cfg['dom'], 'db': 'msk',
        'plan': F(cfg['plan'], DANN, 'Roadmap H2 2026, план по брендам', '2026-07-01', 'выручка за H2'),
        'top1':  ksf('top1'), 'top3': ksf('top3'), 'top10': ksf('top10'), 'top50': ksf('top50'),
        'aivis': ksf('visibility', 'процент видимости в ответах нейросетей'),
        'aians': ksf('ai_answers', 'число ответов ИИ с нашим упоминанием'),
        'pages': F(len(ks.get('top_pages') or []) or None,
                   DANN if ks.get('top_pages') else DEMO,
                   src if ks.get('top_pages') else '', at if ks.get('top_pages') else '',
                   'страниц в выгрузке топ-страниц, не всего на сайте'),
    }

    # ряд, который умеет рисовать динамику: свой накопленный плюс тот, что пришёл из выгрузки
    ser = []
    for r in (ks.get('history') or []):
        if r.get('date'):
            ser.append({'date': r['date'], 'top10': r.get('top10'), 'vis': r.get('visibility'),
                        'top50': r.get('top50'), 'src': 'keysso.json'})
    for r in hist.get(code, []):
        ser.append({'date': r['date'], 'top10': r.get('top10'), 'vis': r.get('visibility'),
                    'top50': r.get('top50'), 'top1': r.get('top1'), 'top3': r.get('top3'),
                    'ai': r.get('ai_answers'), 'src': 'snapshot'})
    byday = {}
    for r in ser:
        byday[r['date']] = {**byday.get(r['date'], {}), **{k: v for k, v in r.items() if v is not None}}
    p['series'] = [byday[k] for k in sorted(byday)]

    # Метрика
    if ym and ym.get('visits_30d'):
        p['ym'] = {
            'counter': F(ym.get('counter'), DANN, f"gg-seo-geo-monster/data/{cfg['dir']}/metrika.json", ym.get('measured', '')),
            'days': ym['visits_30d'],
            'bounce': F(ym.get('bounce_rate'), DANN if ym.get('bounce_rate') is not None else DEMO,
                        f"metrika.json", ym.get('measured', '')),
            'depth': F(ym.get('depth'), DANN if ym.get('depth') is not None else DEMO,
                       'metrika.json', ym.get('measured', '')),
            'goals': ym.get('goals') or [],
            'top_pages': ym.get('top_pages') or [],
            'top_phrases': ym.get('top_phrases') or [],
            'at': ym.get('measured', ''),
        }
    else:
        p['ym'] = None

    # Директ. Проверка: выгрузки двух брендов не должны совпадать.
    twin = None
    if dr:
        other = 'genglass' if cfg['dir'] == 'glass-memory' else 'glass-memory'
        od = load(SRC / other / 'direct.json')
        if od and json.dumps(od, sort_keys=True) == json.dumps(dr, sort_keys=True):
            twin = other
    if dr:
        # Две выгрузки совпали побайтно, значит правой может быть в лучшем случае одна.
        # Пока не разведены по кабинетам, обе идут как гипотеза, а не как данные.
        dk = GIPO if twin else DANN
        dn = f'файл совпадает с выгрузкой {twin}, разделение по кабинетам не подтверждено' if twin else ''
        p['direct'] = {
            'spend': F(dr.get('spend_30d'), dk, f"gg-seo-geo-monster/data/{cfg['dir']}/direct.json", dr.get('measured', ''), dn),
            'clicks': F(dr.get('clicks'), dk, 'direct.json', dr.get('measured', ''), dn),
            'impr': F(dr.get('impressions'), dk, 'direct.json', dr.get('measured', ''), dn),
            'ctr': F(dr.get('ctr'), dk, 'direct.json', dr.get('measured', ''), dn),
            'cpc': F(dr.get('avg_cpc'), dk, 'direct.json', dr.get('measured', ''), dn),
            'campaigns': dr.get('campaigns') or [],
            'queries': dr.get('search_queries') or [],
            'at': dr.get('measured', ''),
            'twin': twin,
        }
    else:
        p['direct'] = None

    p['facts'] = FACTS.get(code, {})
    # Органические конкуренты: отдельная выгрузка keys.so, есть не по каждому домену.
    comp = load(SRC / 'keyso' / cfg['dom'] / 'competitors.json')
    if comp and isinstance(comp.get('data'), dict):
        rows = comp['data'].get('data') or []
        p['comp'] = {'at': (comp.get('measured') or '')[:10],
                     's': f"keys.so /report/simple/organic/concurents через gg-seo-geo-monster/data/keyso/{cfg['dom']}/competitors.json",
                     'rows': [{'domain': r.get('name'), 'common': r.get('cnt'), 'it10': r.get('it10'),
                               'it50': r.get('it50'), 'vis': r.get('vis')} for r in rows[:15]]}
    else:
        p['comp'] = None
    p['pg'] = ks.get('top_pages') or []
    p['kw'] = (ks.get('keywords') or [])[:60]
    sem = load(d / 'semantics.json') or {}
    p['sem'] = {'at': sem.get('measured', ''), 'phrases': (sem.get('phrases') or [])[:60]}
    p['adk'] = ks.get('ad_keywords') or []
    p['adc'] = ks.get('ad_competitors') or []
    return p

def main():
    hist = read_history()
    out = {
        'built': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'projects': {c: build_project(c, cfg, hist) for c, cfg in PROJECTS.items()},
        'thresh': {
            'mkt_share': F(0.15, DANN, 'Правило бюджета Богдана', '2026-07-10', 'маркетинг не более 15% выручки'),
            'roi_crisis': F(7.0, DANN, 'Порог Богдана, кризисный минимум', '2026-07-10', 'ROI 700%'),
            'roi_ideal': F(10.0, DANN, 'Ориентир Богдана', '2026-07-10', 'ROI 1000%'),
            'romi_plan': F(7.0, DANN, 'Roadmap H2 2026', '2026-07-01', 'целевой ROMI канала'),
        },
        'assum': {
            'ctr':  F(6.0,  GIPO, 'отраслевой ориентир, своей выгрузки нет', '', 'средний CTR по текущим позициям, %'),
            'crl':  F(3.0,  GIPO, 'бенчмарк ФЕНИКС: посадочная в РФ даёт 2-5%', '', 'конверсия визита в лид, %'),
            'crd':  F(11.0, DANN, 'Roistat GENGROUP, D2C', '2026-07-01', 'нижняя граница коридора 11-15%, %'),
            'chk':  F(None, GIPO, 'подтверждённой цифры нет, вводится вручную', '', 'средний чек, ₽'),
        },
        'blockers': [
            ['Прайс за м2 по перегородкам', 'Иван', 'без него нельзя ставить цену в тексты и в Директ', 'открыт'],
            ['Средний чек по проектам', 'Иван', 'без него мост до денег не считается', 'открыт'],
            ['Цели в Метрике', 'Иван', 'счётчик отдаёт визиты, но целей нет, конверсия остаётся гипотезой', 'открыт'],
            ['Разработчик: имя и срок', 'Иван', 'главный блокер, без него не публикуются посадочные', 'открыт'],
            ['Выгрузка сделок по каналу из CRM', 'Иван', 'без неё графа «факт» по деньгам пустая', 'открыт'],
        ],
        'decisions': [
            ['metal-gm.ru: развести по интенту', 'Иван', '2026-09-07', 'разблокировало С-STAL и В-03'],
            ['301 по зеркалам: не трогаем', 'Иван', '2026-09-07', 'С-ZRAM и С-ZBOL заморожены'],
            ['Внешние материалы: подряд', 'Иван', '2026-09-07', 'внутренняя нагрузка с 86-245 ч до 54-155 ч'],
            ['Срок изготовления: принять разрыв', 'Иван', '2026-09-07', 'играем на индивидуальном размере'],
        ],
        'limits': [
            ['Инструментов по API', '49 из 50', 'нет прямого метода только у «Структуры сайта»'],
            ['Частота', '10 запросов за 10 секунд', 'перед пакетом опрашиваем GET /limits/all'],
            ['Суточный лимит', '3 000 на нашем тарифе', 'проверено на живом аккаунте'],
            ['Ретроспектива по сводке', 'нет', 'историю ведём сами, снапшотом в positions.ndjson'],
            ['Параллельный доступ', 'блокировка 3-10 минут', 'аккаунт фактически однопользовательский'],
            ['Оценка трафика', 'непригодна', 'реальные визиты берём только из Метрики'],
        ],
    }
    dst = HERE / 'data' / 'kontur.json'
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding='utf-8')
    for c, p in out['projects'].items():
        print(f"{p['name']:14s} топ-10 {str((p['top10'] or {}).get('v')):>5}  "
              f"точек ряда {len(p['series']):>3}  "
              f"Метрика {'есть' if p['ym'] else 'нет'}  Директ {'есть' if p['direct'] else 'нет'}  "
              f"Конкуренты {len(p['comp']['rows']) if p['comp'] else 0}")
    print('записано:', dst.relative_to(ROOT), f"{dst.stat().st_size} байт")

if __name__ == '__main__':
    main()
