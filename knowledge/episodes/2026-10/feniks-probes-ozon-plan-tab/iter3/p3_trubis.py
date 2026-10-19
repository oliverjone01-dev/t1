# iter3, B1: эталон 49 (TRUBIS 160, 14.09-11.10 без отмен) и запись decisions.md после d27ad7b (59 / 49; 160×80 21 / 18).
import json
DD = '/home/user/t1/analytics-mvp/data/'
plan = json.load(open(DD + 'plan_2026-10-15.json'))
G = json.load(open(DD + 'card_groups.json'))['groups']
off2sku = {s['offer']: str(s['sku']) for g in G for s in g['skus']}
c = [c for c in plan['cards'] if c['short'] == 'TRUBIS 160'][0]
ms = off2sku[c['main_art']]
g = [g for g in G if any(str(s['sku']) == ms for s in g['skus'])][0]
skus = {str(s['sku']) for s in g['skus']}
rows = [json.loads(l) for l in open(DD + 'orders_daily.ndjson', encoding='utf-8') if l.strip()]
win = [r for r in rows if '2026-09-14' <= r['d'] <= '2026-10-11']
def u(rs): return sum(int(r.get('units') or 0) for r in rs)
card = [r for r in win if str(r['sku']) in skus]; main = [r for r in win if str(r['sku']) == ms]
print('товаров в карточке', len(skus), '| карточка: заказано', u(card), 'без отмен', u([r for r in card if r['status'] != 'cancelled']),
      '| главный', c['main_art'], ': заказано', u(main), 'без отмен', u([r for r in main if r['status'] != 'cancelled']), '| порог', c['threshold'], 'u_wk_base', c['u_wk_base'])
