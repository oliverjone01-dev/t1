#!/usr/bin/env python3
"""Сравнение цены покупателя на Маркете и на Ozon по главным SKU Маркета. Только чтение снимков.

Запуск: python3 -I ceny-ozon.py <корень репо> [N=20]
Источники:
  analytics-mvp/data-ym/orders.ndjson   - заказы Маркета (price = цена карточки, p_mp = скидка Маркета, p_buyer = деньги покупателя)
  analytics-mvp/data-ym/catalog.json    - каталог Маркета 16.10 (basicPrice до скидки продавца, price = цена карточки)
  analytics-mvp/data-ym/netting.ndjson  - реестр взаиморасчётов (буст по SKU)
  analytics-mvp/data/coinv_daily.ndjson  - витрина Ozon с мака (site_paid = цена покупателя с Ozon Картой, cap = цена продавца). OZON-файл, не менять.
  analytics-mvp/data/prices_daily.ndjson - цены Ozon из API (price = цена продавца после акций). С 15.10 соинвеста в нём нет (PR #487), нужен только для сверки cap.
Период заказов Маркета: 16.09-15.10 (как сводный отчёт кабинета). Цена Ozon: последний день витрины.
"""
import json, sys, statistics as st, collections

root = sys.argv[1]; N = int(sys.argv[2]) if len(sys.argv) > 2 else 20
D0, D1 = '2026-09-16', '2026-10-15'
def nd(p): return [json.loads(l) for l in open(f'{root}/{p}') if l.strip()]

cat = json.load(open(f'{root}/analytics-mvp/data-ym/catalog.json'))
cat_items, cat_ts = cat['items'], cat['generated_at'][:10]
cv_all = [r for r in nd('analytics-mvp/data/coinv_daily.ndjson') if r.get('site_paid') and r.get('cap')]
oz_day = max(r['date'] for r in cv_all)
oz = {r['art']: r for r in cv_all if r['date'] == oz_day}      # последний снимок дня побеждает
api = {r['offer']: r['price'] for r in nd('analytics-mvp/data/prices_daily.ndjson') if r['d'] == oz_day}
orders = [r for r in nd('analytics-mvp/data-ym/orders.ndjson')
          if not r['service'] and not r.get('fake') and D0 <= r['created'] <= D1]
net = nd('analytics-mvp/data-ym/netting.ndjson')

# инварианты
bad = [r for r in orders if abs(r['price'] - (r['p_buyer'] + r['p_mp'] + r['p_spasibo'] + r['p_cashback'])) > 1]
assert not bad, f'цена карточки != деньги+скидка Маркета+Плюс+Спасибо в {len(bad)} заказах, напр. {bad[0]["order"]}'
assert all(r['site_paid'] <= r['cap'] for r in oz.values()), 'Ozon: цена сайта выше цены продавца'
assert len(set(cat_items) & set(oz)) > 300, 'артикулы Маркета и Ozon не стыкуются'
cap_mismatch = [a for a in oz if a in api and abs(oz[a]['cap'] - api[a]) > 1]
assert len(cap_mismatch) < 0.05 * len(oz), f'цена продавца Ozon: витрина и API расходятся у {len(cap_mismatch)} артикулов'

boost = collections.Counter()
for r in net:
    if D0 <= r['d'] <= D1 and r['service'].startswith('Буст продаж'):
        boost[r['sku']] -= r['amount']  # удержания в реестре со знаком минус, возвраты с плюсом
assert round(boost['GGT-35-1-3-100-180']) == 107028, f'сверка буста 1-3 с отчётом кабинета не сошлась: {boost["GGT-35-1-3-100-180"]}'

cnt, by = collections.Counter(), collections.defaultdict(list)
for r in orders:
    cnt[r['sku']] += r['count']; by[r['sku']].append(r)
top = sorted(cnt, key=lambda s: (-cnt[s], -sum(r['price'] * r['count'] for r in by[s])))[:N]

def med(xs): return round(st.median(xs))
rows = []
for s in top:
    rs = by[s]; c = cat_items.get(s, {})
    card = c.get('price'); basic = c.get('basicPrice')
    buyer = med([r['price'] - r['p_mp'] for r in rs])          # что видит покупатель на Маркете: цена карточки минус скидка Маркета
    disc = round(100 * st.median([r['p_mp'] / r['price'] for r in rs]))
    lr = max(rs, key=lambda r: r['created']); last = f"{lr['price'] - lr['p_mp']:,} ({lr['created'][5:].replace('-', '.')})".replace(',', ' ')
    o = oz.get(s); ozp = o['site_paid'] if o else None; ozb = o['cap'] if o else None
    diff = (buyer - ozp) if ozp else None
    rows.append(dict(sku=s, n=cnt[s], basic=basic, card=card, mdisc=disc, buyer=buyer, last=last,
                     ozb=ozb, ozp=ozp, diff=diff, pct=(round(100 * diff / ozp) if ozp else None),
                     boost=round(boost[s])))

f = lambda v: '-' if v is None else f'{v:,}'.replace(',', ' ')
print(f'## Цена покупателя: Маркет против Ozon, топ-{N} SKU Маркета по заказам {D0}..{D1}')
print(f'Маркет: каталог {cat_ts}, заказы {D0}..{D1} (медианы), покупатель видит = цена карточки минус скидка Маркета. Ozon: витрина {oz_day}, покупатель = цена с Ozon Картой; цена продавца витрины сошлась с API у {len(oz)-len(cap_mismatch)} из {len(oz)} артикулов. Буст: реестр {D0}..{D1}, деньги+баллы. Все цифры [ДАННЫЕ].\n')
print('SKU | заказов | Маркет: до скидки продавца | карточка | скидка Маркета, медиана | покупатель видит, медиана | последний заказ (дата) | Ozon: цена продавца | Ozon: покупатель | Маркет минус Ozon, ₽ | % | буст, ₽')
print('---|---|---|---|---|---|---|---|---|---|---|---')
for r in rows:
    print(f"{r['sku']} | {r['n']} | {f(r['basic'])} | {f(r['card'])} | {r['mdisc']}% | {f(r['buyer'])} | {r['last']} | {f(r['ozb'])} | {f(r['ozp'])} | {f(r['diff'])} | {f(r['pct'])}{'%' if r['pct'] is not None else ''} | {f(r['boost'])}")
with_oz = [r for r in rows if r['pct'] is not None]
print(f"\nИтог: у {sum(1 for r in with_oz if r['diff'] < 0)} из {len(with_oz)} SKU покупатель на Маркете видит цену ниже Ozon; медиана разницы {st.median([r['pct'] for r in with_oz])}%. Нет на Ozon: {', '.join(r['sku'] for r in rows if r['pct'] is None) or 'нет'}.")

# скидка Маркета: с бустом и без, тот же период
with_b = [r['p_mp'] / r['price'] for r in orders if boost[r['sku']] > 0]
no_b = [r['p_mp'] / r['price'] for r in orders if boost[r['sku']] <= 0]
print(f"\nСкидка Маркета {D0}..{D1}: SKU с бустом - медиана {100*st.median(with_b):.0f}% ({len(with_b)} заказов), без буста - {100*st.median(no_b):.0f}% ({len(no_b)} заказов).")
