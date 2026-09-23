#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Собирает data/kontur.json из живых выгрузок репозитория.

Единственное место, где цифра попадает в дашборд. Каждое значение уезжает в
конверте Протокола 9: значение, класс, источник, дата съёма, примечание.
Если выгрузки нет, ставится null и класс ДЕМО. Правдоподобное число не выдумывается.
"""
import json, os, sys, datetime, subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]          # корень репозитория
HERE = Path(__file__).resolve().parents[1]          # kontur-dashboard/
SRC  = ROOT / 'gg-seo-geo-monster' / 'data'         # выгрузки соседнего проекта
HIST = HERE / 'data' / 'history' / 'positions.ndjson'

# Цели счётчика Метрики. gg-seo-geo-monster/data/*/metrika.json их не запрашивает,
# поэтому свой goals там пустой всегда. Список целей лежит в сырой выгрузке
# Management API, снятой руками 08.07.2026 при аудите кабинета Директа
# (yandex-direct/audit/2026-07-08-atomic-audit.md): ни один скрипт и ни один
# воркфлоу её не обновляет. Дата берётся из git, оговорка стоит на экране.
GOALS_RAW_PATH = ROOT / 'yandex-direct' / 'data' / 'raw' / 'metrika-goals.json'
GOALS_RAW_SRC  = 'yandex-direct/data/raw/metrika-goals.json'

# Достижения по целям. Вопреки тому, что тут стояло раньше, их собирают ежедневно:
# yandex-direct/dashboard/make-snapshots.mjs запрашивает ym:s:goal<id>reaches по
# целям 487033158 (CRM | Все лиды) и 477925360 (Отправка контактов), воркфлоу
# direct-snapshots.yml, крон 20 6 * * *. Здесь они только читаются.
DIRECT_METRIKA_PATH = ROOT / 'yandex-direct' / 'data' / 'direct_metrika.json'
DIRECT_METRIKA_SRC  = 'yandex-direct/data/direct_metrika.json'

# Метки источника точки ряда. Оба варианта приходят из одного файла на диске:
# ни snapshot.py, ни сборка в keys.so не ходят. Разница не в способе съёма,
# а в том, какая часть файла прочитана, и её видно в «Журнале съёмов».
SRC_SNAP  = 'срез keysso.json'          # верхний блок файла: все шесть показателей
SRC_RETRO = 'ретроспектива keysso.json' # history внутри файла: только топ-10 и видимость

DANN, GIPO, DEMO = 'ДАННЫЕ', 'ГИПОТЕЗА', 'ДЕМО'

def F(v, k, s='', at='', n=''):
    return {'v': v, 'k': k, 's': s, 'at': at, 'n': n}

def load(p):
    try:
        return json.loads(Path(p).read_text(encoding='utf-8'))
    except Exception:
        return None

def load_goals_fallback(ym_counter):
    """Цели, настроенные на счётчике, когда выгрузка geo-monster их не отдаёт.

    Сверяется по id счётчика с yandex-direct/data/direct_metrika.json, чтобы не
    подставить список целей одного проекта другому. Возвращает только активные
    цели с их названиями и id. Достижений по ним в этом файле нет, они берутся
    отдельно, функцией ниже.
    """
    dm = load(DIRECT_METRIKA_PATH)
    # Счётчик в двух выгрузках хранится разными типами (int в одной, str в другой),
    # сверяем строковым представлением, а не значением как есть.
    if not dm or str(dm.get('counter')) != str(ym_counter):
        return None
    # Файл не чистый JSON: первая строка - ответ API, вторая - служебный
    # 'HTTP 200' от инструмента, которым его сняли. Берём только первую строку.
    try:
        first_line = GOALS_RAW_PATH.read_text(encoding='utf-8').splitlines()[0]
        raw = json.loads(first_line)
    except Exception:
        return None
    goals = (raw or {}).get('goals') or []
    active = [g for g in goals if g.get('status') == 'Active']
    return active or None


def git_file_date(path):
    """Дата последнего коммита файла. Не дата замера, и подписывается именно так.

    Нужна там, где в самой выгрузке даты нет: без даты класс ДАННЫЕ не проходит
    сторожа, а выдумывать дату замера нельзя. Константой её зашивать тоже нельзя -
    она молча устареет ровно в тот день, когда файл обновят.

    В мелком клоне история обрезана, и если последний коммит файла лежит за
    границей, git приписывает файл граничному коммиту. Так metrika-goals.json в
    клоне глубиной 50 выглядел снятым 16.09, хотя попал в репозиторий 08.07 при
    аудите кабинета. Поэтому дата отбрасывается, если коммит файла граничный,
    а не всегда, когда клон мелкий: внутри истории дата настоящая.
    """
    try:
        out = subprocess.run(['git', 'log', '-1', '--format=%H %cs', '--', str(path)],
                             cwd=str(ROOT), capture_output=True, text=True, timeout=10)
        parts = (out.stdout or '').split()
        if len(parts) != 2:
            return ''
        commit, date = parts
        sf = subprocess.run(['git', 'rev-parse', '--git-path', 'shallow'],
                            cwd=str(ROOT), capture_output=True, text=True, timeout=10)
        shallow = Path(sf.stdout.strip())
        if not shallow.is_absolute():
            shallow = ROOT / shallow
        if shallow.exists() and commit in shallow.read_text().split():
            return ''
        return date[:10]
    except Exception:
        return ''


# Как источник трафика в выгрузке Метрики называется у нас на экране.
CONV_SOURCES = {'Search engine traffic': 'organic', 'Ad traffic': 'ad'}

def load_conversion(ym_counter):
    """Измеренная конверсия визита в лид по счётчику, из живой выгрузки Директа.

    Берёт достижения цели «CRM | Все лиды» в разрезе источника трафика и делит
    на визиты того же источника. Выгрузку обновляет direct-snapshots.yml
    ежедневно, поэтому дата замера берётся из самого файла, а не из константы.
    Органика и реклама не смешиваются: у них разная конверсия и разный смысл.
    """
    dm = load(DIRECT_METRIKA_PATH)
    if not dm or str(dm.get('counter')) != str(ym_counter):
        return None
    at = (dm.get('generated_at') or '')[:10]
    out = {'at': at, 'goal_id': (dm.get('goals') or {}).get('leads')}
    for row in (dm.get('by_source') or []):
        key = CONV_SOURCES.get(row.get('source'))
        visits, leads = row.get('visits'), row.get('leads')
        if not key or not visits or leads is None:
            continue
        out[key] = {'visits': visits, 'leads': leads, 'cr': round(leads / visits * 100, 2)}
    return out if ('organic' in out or 'ad' in out) else None

def build_conv(conv):
    """Конверты конверсии для экрана. Визиты и заявки лежат отдельными полями,
    чтобы экран брал их как числа, а не выковыривал регуляркой из примечания."""
    if not conv or 'organic' not in conv or 'ad' not in conv:
        return None
    out = {'goal_id': conv['goal_id'], 'at': conv['at']}
    for key, human in (('organic', 'из поиска'), ('ad', 'из рекламы')):
        row = conv[key]
        env = F(row['cr'], DANN, DIRECT_METRIKA_SRC, conv['at'],
                f"{row['leads']} заявок на {row['visits']} визитов {human} за 30 дней")
        env['visits'], env['leads'] = row['visits'], row['leads']
        out[key] = env
    return out


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
                        'top50': r.get('top50'), 'src': SRC_RETRO})
    for r in hist.get(code, []):
        # Источник берём из самой точки, а не подписываем одним словом весь ряд:
        # snapshot.py помечает съём верхнего блока и добор из ретроспективы разными
        # метками, и «Журнал съёмов» существует ровно затем, чтобы их различать.
        mark = {'keys.so': SRC_SNAP, 'keysso.json history': SRC_RETRO}.get(r.get('source'), SRC_SNAP)
        ser.append({'date': r['date'], 'top10': r.get('top10'), 'vis': r.get('visibility'),
                    'top50': r.get('top50'), 'top1': r.get('top1'), 'top3': r.get('top3'),
                    'ai': r.get('ai_answers'), 'src': mark})
    # Свежий срез - такая же точка ряда, просто ещё не записанная snapshot.py: он
    # коммитит в main по будням, а сборка идёт где угодно и когда угодно. Без этой
    # строки карточка берёт значение из свежего среза, дельта считается по последней
    # записанной точке, и на экране появляется пара, которой в ряду нет.
    # Метка своя: эта точка живёт только в собранной странице. В positions.ndjson её
    # запишет snapshot.py при очередном прогоне, а до тех пор её значения топ-50 и
    # ответов ИИ пропадут, если выгрузка обновится раньше. Журнал съёмов обязан
    # различать записанную точку и показанную.
    if at and not any(r['date'] == at and r['src'] == SRC_SNAP for r in ser):
        ser.append({'date': at, 'top10': ks.get('top10'), 'vis': ks.get('visibility'),
                    'top50': ks.get('top50'), 'top1': ks.get('top1'), 'top3': ks.get('top3'),
                    'ai': ks.get('ai_answers'), 'src': 'срез keysso.json, в ряд ещё не записан'})
    byday = {}
    for r in ser:
        byday[r['date']] = {**byday.get(r['date'], {}), **{k: v for k, v in r.items() if v is not None}}
    p['series'] = [byday[k] for k in sorted(byday)]

    # Покрытие ряда по полям. Ретроспектива выгрузки несёт только топ-10 и видимость,
    # поэтому топ-50 и ответы ИИ есть на считанных точках. Показывать это обязан сам
    # дашборд (корневой CLAUDE.md §15 п.3), а не выяснять читатель по расхождению цифр.
    COV = {'top10': 'запросы в топ-10', 'top50': 'запросы в топ-50',
           'vis': 'видимость в ИИ', 'ai': 'ответы ИИ'}
    p['coverage'] = {
        'total': len(p['series']),
        'fields': [{'key': k, 'name': n,
                    'pts': sum(1 for s in p['series'] if s.get(k) is not None)}
                   for k, n in COV.items()],
    }

    # Метрика
    if ym and ym.get('visits_30d'):
        own_goals = ym.get('goals') or []
        conv = load_conversion(ym.get('counter'))
        goals_configured = None
        if not own_goals:
            fb = load_goals_fallback(ym.get('counter'))
            if fb:
                # Список целей едет в конверте, как и любая другая цифра на экране:
                # в нём число целей, источник и прямая оговорка, что файл снят руками
                # и не обновляется ничем. Иначе сторож этих данных не видит.
                # Даты нет там, где история обрезана. Выдавать в этом случае класс
                # ДАННЫЕ нельзя: он обязан нести дату, а подставить сюда сегодняшнюю
                # значит показать замер, которого не было.
                gdate = git_file_date(GOALS_RAW_PATH)
                goals_configured = F(
                    len(fb), DANN if gdate else GIPO, GOALS_RAW_SRC, gdate,
                    'список снят руками при аудите кабинета и автоматически не обновляется'
                    if gdate else
                    'список снят руками и автоматически не обновляется, дата снятия неизвестна')
                goals_configured['list'] = [{'name': g.get('name'), 'id': g.get('id')} for g in fb]
        p['ym'] = {
            'counter': F(ym.get('counter'), DANN, f"gg-seo-geo-monster/data/{cfg['dir']}/metrika.json", ym.get('measured', '')),
            'days': ym['visits_30d'],
            'bounce': F(ym.get('bounce_rate'), DANN if ym.get('bounce_rate') is not None else DEMO,
                        f"metrika.json", ym.get('measured', '')),
            'depth': F(ym.get('depth'), DANN if ym.get('depth') is not None else DEMO,
                       'metrika.json', ym.get('measured', '')),
            'goals': own_goals,
            'goals_configured': goals_configured,
            # Визиты из поиска по нашей выгрузке. Рядом с conv лежит то же число из
            # выгрузки Директа, и они не совпадают: harvest.mjs фильтрует по
            # ym:s:lastTrafficSource, make-snapshots.mjs группирует по
            # ym:s:lastsignTrafficSource. Это разные модели атрибуции, поэтому обе
            # цифры верные и обе показываются, а не выбирается одна молча (§15 п.1).
            'search_30d': F(sum(d.get('search_visits') or 0 for d in ym['visits_30d']) or None,
                            DANN, f"gg-seo-geo-monster/data/{cfg['dir']}/metrika.json",
                            ym.get('measured', ''),
                            'визиты из поиска за 30 дней, модель «последний источник»'),
            # Измеренная конверсия визита в лид. Органика и реклама раздельно:
            # у них разная цифра и разный смысл, средняя по ним не значит ничего.
            'conv': build_conv(conv),
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

    # Цена заявки из рекламы. Расход из кабинета Директа, заявки из Метрики по цели:
    # две выгрузки, и сведены они только по длине окна (30 дней), а не по датам.
    # Кроме того, заявки считаются по всему рекламному трафику, а расход только по
    # Директу (визитов из Директа 4531 из 4568 рекламных). Поэтому класс ГИПОТЕЗА.
    conv_ad = (p.get('ym') or {}).get('conv') and p['ym']['conv'].get('ad')
    if p['direct'] and not p['direct']['twin'] and conv_ad and conv_ad.get('leads'):
        spend = p['direct']['spend']['v']
        p['direct']['cpl'] = F(
            round(spend / conv_ad['leads']) if spend else None,
            GIPO if spend else DEMO,
            f"direct.json (расход) и {DIRECT_METRIKA_SRC} (заявки)",
            conv_ad['at'] if spend else '',
            f"{spend} ₽ расхода на {conv_ad['leads']} заявок из рекламы за 30 дней; "
            f"две выгрузки сведены по длине окна, а не по датам")
    elif p['direct']:
        p['direct']['cpl'] = None

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
        # Пятое поле - проект: 'gg', 'gm' или без него для общего вопроса. Экраны
        # проекта берут только свои и общие строки (BL() в core.py).
        'blockers': [
            ['Прайс за м2 по перегородкам', 'Иван', 'без него нельзя ставить цену в тексты и в Директ', 'открыт'],
            ['Средний чек по проектам', 'Иван', 'без него мост до денег не считается', 'открыт'],
            ['Сверка визитов из поиска', 'Иван', 'две выгрузки Метрики дают разное число визитов из поиска, а модель моста до денег расходится с ними в разы; пока не сверено, звено «визиты» остаётся гипотезой', 'открыт', 'gg'],
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
