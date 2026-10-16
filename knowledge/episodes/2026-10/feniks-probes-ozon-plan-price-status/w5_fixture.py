# ФЕНИКС iter2 (3810a26). W5 / W3: синтетическое окно 15-28.10 поверх закреплённых data/ (копия 4f2409c), живой код страницы.
# Каталоги сценариев в scratch: все файлы - ссылки на закреплённые data/, orders_daily.ndjson - копия + синтетические строки
# (главный товар карточки, status delivered, t в 12:00 UTC, units по дням окна). Рендер - render6.mts на нужную дату.
#   below1  - у каждой карточки в окне порог - 1 (по правилу 29.10 откат у 10 из 10);
#   exact   - у каждой карточки в окне ровно порог (прошли 10 из 10);
#   nov     - окно = порог (все прошли), 29.10-03.11 каждая карточка идёт ровно в темп порог/14 (как в окне) -> ноябрь 01-03.11.
# python3 -I w5_fixture.py
import json, os, shutil, datetime as dt
SP = '/tmp/claude-0/-home-user-t1/67620a7f-7583-5c98-9212-3a5e79611236/scratchpad/p5/'
SRC = SP + 'data_4f2409c/analytics-mvp/data/'
P = json.load(open(SRC + 'plan_2026-10-15_v3.json', encoding='utf-8'))
G = json.load(open(SRC + 'card_groups.json', encoding='utf-8'))['groups']
off2sku = {s['offer']: str(s['sku']) for g in G for s in g['skus']}
days = lambda a, b: [(dt.date.fromisoformat(a) + dt.timedelta(days=k)).isoformat() for k in range((dt.date.fromisoformat(b) - dt.date.fromisoformat(a)).days + 1)]
def spread(total, ds):   # целые шт по дням, сумма = total
    out, acc = [], 0.0
    for k, d in enumerate(ds):
        want = round(total * (k + 1) / len(ds)); out.append((d, want - round(acc))); acc = want
    return [(d, u) for d, u in out if u > 0]
def make(name, per_card):   # per_card: [(card, [(d, units)])]
    dst = SP + 'fx_' + name + '/'
    if os.path.isdir(dst): shutil.rmtree(dst)
    os.makedirs(dst)
    for f in os.listdir(SRC):
        if f != 'orders_daily.ndjson': os.symlink(SRC + f, dst + f)
    shutil.copy(SRC + 'orders_daily.ndjson', dst + 'orders_daily.ndjson')
    n = 0
    with open(dst + 'orders_daily.ndjson', 'a', encoding='utf-8') as fh:
        for c, rows in per_card:
            for d, u in rows:
                n += 1
                fh.write(json.dumps({'order': f'FX-{name}-{n}', 'd': d, 't': d + 'T12:00:00Z', 'status': 'delivered', 'scheme': 'FBO',
                                     'sku': off2sku[c['main_art']], 'offer': c['main_art'], 'units': u, 'revenue': 0}, ensure_ascii=False) + '\n')
    print(name, '->', dst, 'синтетических строк', n)
W = days('2026-10-15', '2026-10-28')
make('below1', [(c, spread(c['threshold'] - 1, W)) for c in P['cards']])
make('exact', [(c, spread(c['threshold'], W)) for c in P['cards']])
make('nov', [(c, spread(c['threshold'], W) + spread(c['threshold'] / 14 * 6, days('2026-10-29', '2026-11-03'))) for c in P['cards']])
