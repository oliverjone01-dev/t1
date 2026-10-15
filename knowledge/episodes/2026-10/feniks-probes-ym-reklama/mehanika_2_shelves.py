#!/usr/bin/env python3
"""ФЕНИКС, проба 2: полки -> показы с 30.09. Только чтение.
a) какие услуги показов/полок есть в реестре (деньги) и в отчёте по баллам, по кабинетам;
b) по дням 01.08-12.10: показы и полки, баллы и деньги, оба кабинета (когда начались/кончились, есть ли другие ступеньки);
c) отчёт Маркета за октябрь (promo_monthly) целиком и promo_state: за какие дни снимок;
d) лимит «1% доставленного за 30 дней»: скользящие 30 дней против календарного месяца / 30."""
import json, sys, collections, datetime
D = (sys.argv[1] if len(sys.argv) > 1 else '/home/user/t1/analytics-mvp/data-ym').rstrip('/') + '/'
rd = lambda f: [json.loads(l) for l in open(D + f)]
n = rd('netting.ndjson'); b = rd('bonuses_monthly.ndjson'); promo = rd('promo_monthly.ndjson'); o = rd('orders.ndjson')
CAB = {'1023124': 'зеркала', '74986385': 'мебель'}
ad = lambda s: any(w in s.lower() for w in ('показ', 'полк', 'баннер', 'буст', 'продвиж', 'реклам'))
print('## a) услуги рекламы: реестр (тип, источник) и баллы')
c1 = collections.Counter((CAB[r['business']], r['service'], r['type'], r['src']) for r in n if ad(r['service']) and r['d'] >= '2026-08-01')
for k, v in sorted(c1.items()): print('  реестр', k, v)
c2 = collections.Counter((CAB[r['business']], r['service'], r['type'], r['src']) for r in b if ad(r['service']) and r['d'] >= '2026-08-01')
for k, v in sorted(c2.items()): print('  баллы ', k, v)
print('\n## b) по дням: [кабинет] показы баллы/деньги | полки баллы/деньги (только дни с ненулевыми значениями)')
day = collections.defaultdict(lambda: [0.0, 0.0, 0.0, 0.0])
def kind(s):
    s = s.lower()
    return 0 if 'показ' in s else 2 if 'полк' in s else None
for src, rows, money in (('b', b, False), ('n', n, True)):
    for r in rows:
        if r['d'] < '2026-08-01' or r['type'] not in ('Списание', 'Удержание'): continue
        kd = kind(r['service'])
        if kd is None: continue
        day[(r['business'], r['d'])][kd + (1 if money else 0)] += abs(r['amount'])
for c in CAB:
    print(' ', CAB[c] + ':', ' '.join(f"{d[5:]}:{v[0]:.0f}/{v[1]:.0f}|{v[2]:.0f}/{v[3]:.0f}" for (cc, d), v in sorted(day.items()) if cc == c and any(v)))
    for kd, nm in ((0, 'показы'), (2, 'полки')):
        ds = sorted(d for (cc, d), v in day.items() if cc == c and (v[kd] or v[kd + 1]))
        if ds: print(f"    {nm}: первый день {ds[0]}, последний {ds[-1]}, дней с расходом {len(ds)}")
print('\n## c) отчёты продвижения за 09-10 и состояние сборщика')
for r in promo:
    if r['ym'] in ('2026-09', '2026-10'): print('  ', r)
try:
    st = json.load(open(D + 'promo_state.json')); print('  promo_state:', json.dumps(st, ensure_ascii=False)[:1500])
except Exception as e: print('  promo_state нет', e)
print('\n## d) лимит показов: 1% доставленного за 30 дней / день (скользящее окно) на 12.10 и на 31.08, 30.09')
p = [r for r in o if not r['service'] and r['status'] == 'DELIVERED']
for c in CAB:
    for end in ('2026-08-31', '2026-09-30', '2026-10-12'):
        e = datetime.date.fromisoformat(end); s = (e - datetime.timedelta(days=29)).isoformat()
        rev = sum(r['revenue'] for r in p if r['business'] == c and s <= r['statusDate'] <= end)
        print(f"  {CAB[c]} окно {s}..{end}: доставлено {rev:,.0f}, 1% = {rev * 0.01:,.0f} в день; календарь октября (01-12.10)/30 = {sum(r['revenue'] for r in p if r['business'] == c and r['statusDate'][:7] == '2026-10') * 0.01 / 30:,.0f}")
