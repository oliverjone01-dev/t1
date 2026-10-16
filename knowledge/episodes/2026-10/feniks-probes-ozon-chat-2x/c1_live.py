# ФЕНИКС, аудит PR #477 @ 889c35b (съём кабинета 2 раза в день). Проба L1: живые файлы чата.
# Что считает: дубли по ключам, которые объявляет код (funnel role|art|test_id|date, gap date|art)
# и инструкция чату (acts date+art+title), источники gap_daily на дублях, поля full/ts/snap,
# объём воронки по последним дням, наличие t в orders_daily.
# python3 -I c1_live.py
import json, collections

DD = '/home/user/t1/analytics-mvp/data/'


def rd(f):
    out = []
    for l in open(DD + f, encoding='utf-8'):
        l = l.strip()
        if l:
            out.append(json.loads(l))
    return out


AGG = {'agg_median', 'agg_sum'}

# --- funnel_tests
ft = rd('funnel_tests.ndjson')
print('funnel_tests строк', len(ft))
print('  с полем full', sum('full' in r for r in ft), '| ts', sum('ts' in r for r in ft), '| snap', sum('snap' in r for r in ft))


def ft_key(r):
    role = r.get('role', '')
    art = '' if role in AGG else str(r.get('art', '')).strip()
    tid = str(r.get('test_id') or '').strip()
    if role in AGG and not tid and str(r.get('art', '')).startswith('AGG:'):
        tid = str(r['art']).split(':')[1]
    return f"{role}|{art}|{tid}|{str(r.get('date', ''))[:10]}"


kc = collections.Counter(ft_key(r) for r in ft)
print('  ключей role|art|test_id|date', len(kc), 'дублей', sum(v - 1 for v in kc.values() if v > 1))
# товар на одну дату под разными ключами (разный test_id или роль)
pa = collections.defaultdict(set)
for r in ft:
    if r.get('role') not in AGG:
        pa[(str(r.get('art', '')).strip(), str(r.get('date', ''))[:10])].add((r.get('role'), str(r.get('test_id') or '').strip()))
multi = {k: v for k, v in pa.items() if len(v) > 1}
print('  товар+дата под 2+ ключами (роль/test_id):', len(multi), list(multi.items())[:3])
byd = collections.defaultdict(lambda: [0, set()])
for r in ft:
    if r.get('role') in AGG:
        continue
    d = str(r.get('date', ''))[:10]
    byd[d][0] += float(r.get('search_views') or 0)
    byd[d][1].add(str(r.get('art', '')).strip())
for d in sorted(byd)[-8:]:
    print('   ', d, 'показы в поиске (товарные строки)', int(byd[d][0]), 'товаров', len(byd[d][1]))
roles_by_day = collections.Counter((str(r.get('date', ''))[:10], r.get('role')) for r in ft if str(r.get('date', ''))[:10] >= '2026-10-13')
print('  роли 13-15.10:', sorted(roles_by_day.items()))

# --- gap_daily
gd = rd('gap_daily.ndjson')
gk = collections.defaultdict(list)
for r in gd:
    gk[(str(r.get('date', ''))[:10], str(r.get('art', '')).strip())].append(r)
dups = {k: v for k, v in gk.items() if len(v) > 1}
print('gap_daily строк', len(gd), 'ключей date|art', len(gk), 'ключей с дублями', len(dups), 'лишних строк', sum(len(v) - 1 for v in dups.values()))
srcs = collections.Counter(tuple(sorted(str(x.get('src')) for x in v)) for v in dups.values())
print('  источники на дублях:', srcs.most_common(5))
diffv = sum(1 for v in dups.values() if len({x.get('gap_pct') for x in v}) > 1)
print('  дублей с разным gap_pct:', diffv)
dd = collections.Counter(k[0] for k in dups)
print('  даты дублей (первые 10):', sorted(dd.items())[:10], '... всего дат', len(dd))
print('  src по файлу:', collections.Counter(str(r.get('src')) for r in gd).most_common())

# --- acts_daily: ключ инструкции чату «дата + товар + название акции»
ad = rd('acts_daily.ndjson')
ak = collections.defaultdict(list)
for r in ad:
    ak[(str(r.get('date', ''))[:10], str(r.get('art', '')).strip(), str(r.get('title', '')).strip())].append(r)
adup = {k: v for k, v in ak.items() if len(v) > 1}
win = sum(1 for v in adup.values() if len({(x.get('date_from'), x.get('date_to')) for x in v}) > 1)
print('acts_daily строк', len(ad), 'ключей дата+товар+название', len(ak), 'с 2+ строками', len(adup),
      'из них с разными окнами', win, 'строк потеряется по ключу инструкции', sum(len(v) - 1 for v in adup.values()))
last = max(k[0] for k in ak)
print('  за последний день', last, ':', sum(1 for k in adup if k[0] == last), 'ключей с 2+ строками')

# --- orders_daily
od = rd('orders_daily.ndjson')
print('orders_daily строк', len(od), 'с полем t', sum(1 for r in od if r.get('t')), 'max d', max(r['d'] for r in od))
