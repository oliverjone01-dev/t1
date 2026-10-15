# ФЕНИКС iter4, ветка claude/amazing-hawking-0trncq @ 753bf11. Проба V3a: закрытие V3 (Иван 15.10 «б»).
# 1) структурный дифф плана v2 -> v3 (что изменилось, кроме задуманного);
# 2) база порогов 14.09-11.10 НЕЗАВИСИМЫМ кодом: день МСК через astimezone, без отмен, товары card_groups минус выводимые;
# 3) порог НЕЗАВИСИМЫМ Пуассоном (рекуррентная pmf, не 1 - sum как у автора): min k, P(X >= k | λ = база/2) <= 0,15;
# 4) «Без эффекта» на странице (2 × u_wk_base) против базы/2.
# python3 -I v4_base.py
import json, math, subprocess, datetime as dt

R = '/home/user/t1'
DD = R + '/analytics-mvp/data/'
MSK = dt.timezone(dt.timedelta(hours=3))
show = lambda rev, p: json.loads(subprocess.run(['git', '-C', R, 'show', f'{rev}:{p}'], capture_output=True, text=True, check=True).stdout)
v2 = show('753bf11', 'analytics-mvp/data/plan_2026-10-15_v2.json')
v3 = show('753bf11', 'analytics-mvp/data/plan_2026-10-15_v3.json')

# 1) структурный дифф
def flat(o, p=''):
    if isinstance(o, dict):
        for k, v in o.items():
            yield from flat(v, f'{p}.{k}' if p else k)
    elif isinstance(o, list) and o and isinstance(o[0], dict) and 'short' in o[0]:
        for v in o:
            yield from flat(v, f"{p}[{v['short']}]")
    else:
        yield p, json.dumps(o, ensure_ascii=False)
a, b = dict(flat(v2)), dict(flat(v3))
print('== дифф v2 -> v3 (ключ: v2 -> v3)')
for k in sorted(set(a) | set(b)):
    if a.get(k) != b.get(k):
        va, vb = a.get(k, '<нет>'), b.get(k, '<нет>')
        print(f'  {k}: {va[:60]} -> {vb[:90]}')

# 2) база независимым кодом
groups = json.load(open(DD + 'card_groups.json', encoding='utf-8'))['groups']
off2sku = {s['offer']: str(s['sku']) for g in groups for s in g['skus']}
W = {off2sku[x] for x in v3['withdrawn']}
od = [json.loads(l) for l in open(DD + 'orders_daily.ndjson', encoding='utf-8') if l.strip()]
assert all(o.get('t') for o in od), 'есть заказы без t'
def mday(o):
    return dt.datetime.fromisoformat(o['t'].replace('Z', '+00:00')).astimezone(MSK).date().isoformat()
def cnt(ss, a='2026-09-14', b='2026-10-11'):
    return sum(int(o['units']) for o in od if o['status'] != 'cancelled' and str(o['sku']) in ss and a <= mday(o) <= b)

# 3) порог: рекуррентная pmf
def p_ge(lam, k):
    pmf, cdf = math.exp(-lam), 0.0
    for i in range(k):
        cdf += pmf; pmf *= lam / (i + 1)
    return 1 - cdf
def thr(base):
    k = 0
    while p_ge(base / 2, k) > 0.15:
        k += 1
    return k

print('\n== карточка | товаров / выводимых | база всего / от выводимых / без выводимых | порог: правило на всей базе, v2 | правило без выводимых, v3 | 2*u_wk_base v3 | P(пройти без эффекта) v3')
bad = 0
for c2, c3 in zip(v2['cards'], v3['cards']):
    ms = off2sku[c3['main_art']]
    g = next(g for g in groups if any(str(s['sku']) == ms for s in g['skus']))
    skus = {str(s['sku']) for s in g['skus']}
    w = skus & W
    b_all, b_out = cnt(skus), cnt(w)
    t_all, t_rest = thr(b_all), thr(b_all - b_out)
    expect = t_rest if b_out else c2['threshold']
    ok = c3['threshold'] == expect
    bad += not ok
    print(f"{c3['short']} | {len(skus)} / {len(w)} | {b_all} / {b_out} / {b_all - b_out} | {t_all}, {c2['threshold']} | {t_rest}, {c3['threshold']} "
          f"{'OK' if ok else 'РАСХОЖДЕНИЕ'} | {2 * c3['u_wk_base']} | {p_ge((b_all - b_out) / 2 if b_out else b_all / 2, c3['threshold']):.1%}")
print('расхождений с v3:', bad, '| выводимых всего', len(W), '| из них вне карточек плана:',
      len(W - {str(s['sku']) for c in v3['cards'] for g in groups if any(str(s['sku']) == off2sku[c['main_art']] for s in g['skus']) for s in g['skus']}))
# выводимые продают после базы? (12-14.10, без отмен, день МСК)
print('выводимые: заказы 12-14.10 без отмен', cnt(W, '2026-10-12', '2026-10-14'), '| 14.09-11.10', cnt(W))
