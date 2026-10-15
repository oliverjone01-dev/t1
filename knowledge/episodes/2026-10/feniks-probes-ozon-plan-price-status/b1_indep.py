# ФЕНИКС, раздел 5 «Цена» (4f2409c). B1: независимый пересчёт статусов и скидки OZON моим кодом (не код автора).
# Источники: prices_daily.ndjson (снимок цен, d = дата UTC запуска 05:53 UTC), gap_daily.ndjson, plan v3 - из data/ коммита 4f2409c.
# Правило статуса - словами из decisions.md 15.10 (не из plan-tab.ts):
#   снижена: цена не выше целевой +0,5%; частично: ниже цены плана (price_now) -0,5%, но выше целевой;
#   срок не наступил (today < when) / «сегодня» (today == when) при той же цене; иначе не снижена.
# Плюс проверки: price_now плана против prices_daily на 14.10 (источник вне плана), дубли ключей, история цены (шум акций).
# python3 -I b1_indep.py <dataDir> <today> [render.json]
import json, sys, collections
D, today = sys.argv[1], sys.argv[2]
P = json.load(open(D + '/plan_2026-10-15_v3.json'))
arts = {p['art'] for p in P['price']}
pr = collections.defaultdict(dict); dup = 0; nonfin = 0
for line in open(D + '/prices_daily.ndjson'):
    r = json.loads(line)
    if r.get('offer') in arts:
        if r['d'] in pr[r['offer']]: dup += 1
        if not isinstance(r.get('price'), (int, float)): nonfin += 1; continue
        pr[r['offer']][r['d']] = r['price']
gp = collections.defaultdict(dict); gdup = 0; gnull = collections.Counter()
for line in open(D + '/gap_daily.ndjson'):
    r = json.loads(line)
    if r.get('art') in arts:
        if r['date'] in gp[r['art']]: gdup += 1
        if not isinstance(r.get('gap_pct'), (int, float)): gnull[r['art']] += 1; continue
        gp[r['art']][r['date']] = r['gap_pct']
def at(h, d):
    ks = [k for k in h if k <= d]
    return (max(ks), h[max(ks)]) if ks else (None, None)
def last(h):
    return (max(h), h[max(h)]) if h else (None, None)
pct = lambda x, base: f"{(x / base - 1) * 100:.1f}".replace('.', ',') + '%'
out = {}; cnt = collections.Counter(); pn_off = []
for p in sorted(P['price'], key=lambda p: (p['when'], p['art'])):
    a = p['art']; when = f"2026-{p['when'][3:5]}-{p['when'][0:2]}"
    d0, now = last(pr[a]); d14, p14 = at(pr[a], '2026-10-14')
    if p14 != p['price_now']: pn_off.append(f"{a}: price_now {p['price_now']} / prices_daily {d14} {p14}")
    if now is None: st = 'нет цены'
    elif now <= p['price_new'] * 1.005: st = 'снижена ' + pct(now, p['price_now'])
    elif now < p['price_now'] * 0.995: st = f"частично: {pct(now, p['price_now'])} из {pct(p['price_new'], p['price_now'])}"
    elif today < when: st = f"по плану с {p['when']}"
    elif today == when: st = f"сегодня {p['when']}: пока не снижена"
    else: st = 'не снижена'
    g0d, g0 = at(gp[a], '2026-10-14'); gd, gl = last(gp[a])
    out[a] = {'status': st, 'now': now, 'd0': d0, 'g0': g0, 'g0_date': g0d, 'gp': gl, 'gd': gd}
    cnt[st.split(' ')[0].rstrip(':')] += 1
print(f"[{today}] статусы моим кодом:", dict(cnt))
print("дубли ключа prices (offer+d):", dup, "| нечисловая цена:", nonfin, "| дубли gap (art+date):", gdup, "| gap_pct null:", dict(gnull) or 0)
print("price_now плана против prices_daily на 14.10:", "совпадает 25 из 25" if not pn_off else pn_off)
print("последний срез цен:", collections.Counter(v['d0'] for v in out.values()), "| последний срез скидки:", collections.Counter(v['gd'] for v in out.values()))
print("«было» скидки взято не за 14.10:", [f"{a} {v['g0_date']}" for a, v in out.items() if v['g0_date'] != '2026-10-14'] or 'нет')
if len(sys.argv) > 3:
    R = json.load(open(sys.argv[3])); bad = []
    for r in R['rows']:
        v = out[r['art']]
        f1 = lambda x: '-' if x is None else f"{x:.1f}".replace('.', ',') + '%'
        if r['status'] != v['status']: bad.append(f"{r['art']}: статус страница «{r['status']}» / мой «{v['status']}»")
        if r['g0'] != f1(v['g0']): bad.append(f"{r['art']}: 14.10 страница {r['g0']} / мой {f1(v['g0'])}")
        if r['gp'] != f1(v['gp']): bad.append(f"{r['art']}: сейчас страница {r['gp']} / мой {f1(v['gp'])}")
        if v['g0'] is not None and v['gp'] is not None:
            dd = v['gp'] - v['g0']
            exp = '' if abs(dd) < 0.05 else ('+' if dd > 0 else '') + f"{dd:.1f}".replace('.', ',') + ' п.п.'
            if r['gdd'] != exp: bad.append(f"{r['art']}: п.п. страница «{r['gdd']}» / мой «{exp}»")
    print(f"сверка со страницей ({sys.argv[3].split('/')[-1]}): {len(R['rows'])} строк, расхождений {len(bad)}", bad[:8])
