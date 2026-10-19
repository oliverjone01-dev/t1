# ФЕНИКС iter3, ветка claude/amazing-hawking-0trncq @ 754cf5c. Проба S4: держит ли допуск max(1, 2%) на карточку
# на живых данных, если день заказа уже по Москве (поле t у всех строк orders_daily с a02b59d).
# Кабинета за прошлые недели нет, поэтому прокси - sku_views.units (аналитика OZON «Заказано», день OZON):
# то же семейство «аналитика», что «Аналитика -> Заказано, шт» в кабинете [ГИПОТЕЗА: прокси, не сам кабинет].
# Логика сверки - как plan-tab.ts cabinetCheck: сумма по товарам карточки и дням окна, с отменами, допуск на карточку.
# python3 -I s4_tolerance.py
import json, datetime as dt, collections

DD = '/home/user/t1/analytics-mvp/data/'
MSK = dt.timezone(dt.timedelta(hours=3))
plan = json.load(open(DD + 'plan_2026-10-15.json', encoding='utf-8'))
groups = json.load(open(DD + 'card_groups.json', encoding='utf-8'))['groups']
off2sku = {s['offer']: str(s['sku']) for g in groups for s in g['skus']}
cards = []
for c in plan['cards']:
    ms = off2sku.get(c['main_art'])
    g = next((g for g in groups if any(str(s['sku']) == ms for s in g['skus'])), None)
    cards.append((c['short'], [str(s['sku']) for s in g['skus']] if g else []))
sku_card = {s: i for i, (_, ss) in enumerate(cards) for s in ss}

ours_msk = collections.Counter(); ours_utc = collections.Counter()
st = collections.Counter()   # магазин: (вид, день) -> шт
od = [json.loads(l) for l in open(DD + 'orders_daily.ndjson', encoding='utf-8') if l.strip()]
raw_last = max(o['d'] for o in od)
for o in od:
    u = int(o.get('units') or 0)
    m = dt.datetime.fromisoformat(o['t'].replace('Z', '+00:00')).astimezone(MSK).date().isoformat()
    st[('utc_all', o['d'])] += u; st[('msk_all', m)] += u
    if o['status'] != 'cancelled':
        st[('utc_net', o['d'])] += u; st[('msk_net', m)] += u
    if o.get('sku') is None:
        continue
    ours_utc[(str(o['sku']), o['d'])] += u
    ours_msk[(str(o['sku']), m)] += u
sv = collections.Counter(); sv_last = ''
for l in open(DD + 'sku_views.ndjson', encoding='utf-8'):
    if not l.strip():
        continue
    r = json.loads(l)
    if r['date'] < '2026-07-01':
        continue
    sv_last = max(sv_last, r['date'])
    u = int(r.get('units') or 0)
    st[('sv', r['date'])] += u
    if str(r['sku']) in sku_card:
        sv[(str(r['sku']), r['date'])] += u


def days(a, b):
    a, b = dt.date.fromisoformat(a), dt.date.fromisoformat(b)
    return [(a + dt.timedelta(i)).isoformat() for i in range((b - a).days + 1)]


def S(kind, a, b):
    return sum(st[(kind, d)] for d in days(a, b))


print(f'orders_daily: строк {len(od)}, последний d {raw_last}; sku_views до {sv_last}')
print('Спека :41 «01-13.10: orders_daily 155 с отменами / 137 без; sku_views units 153»:')
print(f'  по дню UTC: с отменами {S("utc_all", "2026-10-01", "2026-10-13")}, без {S("utc_net", "2026-10-01", "2026-10-13")}'
      f' | по дню МСК: с отменами {S("msk_all", "2026-10-01", "2026-10-13")}, без {S("msk_net", "2026-10-01", "2026-10-13")}'
      f' | sku_views {S("sv", "2026-10-01", "2026-10-13")}')
LAST = min(raw_last, sv_last)


def check(ours, a, b, tol_min):
    out = []
    for name, ss in cards:
        c = sum(sv[(s, d)] for s in ss for d in days(a, b))
        o = sum(ours[(s, d)] for s in ss for d in days(a, b))
        out.append((name, c, o, abs(c - o) <= max(tol_min, 0.02 * c)))
    return out


# окна как у живой сверки: старт в четверг, 7 и 14 дней (22.10 сверка за 7 дней, 29.10 - за 14)
for L in (7, 14):
    starts = [d for d in days('2026-07-02', LAST) if dt.date.fromisoformat(d).weekday() == 3 and
              (dt.date.fromisoformat(d) + dt.timedelta(L - 1)).isoformat() <= LAST]
    res = collections.Counter(); per = collections.Counter(); exm = []
    for a in starts:
        b = (dt.date.fromisoformat(a) + dt.timedelta(L - 1)).isoformat()
        for mode, ours in (('msk', ours_msk), ('utc', ours_utc)):
            for tol in (1, 2):
                r = check(ours, a, b, tol)
                bad = [x for x in r if not x[3]]
                res[(mode, tol, 'card_bad')] += len(bad)
                res[(mode, tol, 'win_any_bad')] += bool(bad)
                if mode == 'msk' and tol == 1:
                    for x in bad:
                        per[x[0]] += 1
                        if len(exm) < 12:
                            exm.append(f'{a[5:]}..{b[5:]} {x[0]} кабинет(прокси) {x[1]} / отправления {x[2]}')
    n = len(starts)
    print(f'\nОкна {L} дн, старт по четвергам, {n} окон x 10 карточек = {n * 10} проверок (до {LAST}):')
    for mode in ('msk', 'utc'):
        for tol in (1, 2):
            print(f'  день {mode}, допуск max({tol}, 2%): карточек не в допуске {res[(mode, tol, "card_bad")]} из {n * 10};'
                  f' окон с ложной тревогой хотя бы по одной карточке {res[(mode, tol, "win_any_bad")]} из {n}')
    print('  по карточкам (МСК, допуск 1):', dict(per))
    for e in exm:
        print('   ', e)

# поденная разница карточек по МСК: откуда расхождение, если не граница суток
diff = collections.Counter()
for d in days('2026-08-01', LAST):
    for name, ss in cards:
        c = sum(sv[(s, d)] for s in ss); o = sum(ours_msk[(s, d)] for s in ss)
        diff[c - o] += 1
print('\nКарточка-день 01.08-' + LAST[5:] + ', прокси минус отправления (МСК): ', dict(sorted(diff.items())))
