# iter3, B5-остаток: «примерно на 3,5% лучше цели» (plan-tab.ts:361) - текст, не счётчик. Насколько он уплывёт,
# когда по базе 14.09-11.10 дойдут поздние отмены (свежие дни базы отменены меньше, чем зрелые).
# python3 -I p3_g8drift.py
import json, collections
DD = '/home/user/t1/analytics-mvp/data/'
rows = [json.loads(l) for l in open(DD + 'orders_daily.ndjson', encoding='utf-8') if l.strip()]
A, B = '2026-09-14', '2026-10-11'
rev = collections.defaultdict(float); crev = collections.defaultdict(float)
for r in rows:
    if A <= r['d'] <= B:
        rev[r['d']] += float(r.get('revenue') or 0)
        if r['status'] == 'cancelled': crev[r['d']] += float(r.get('revenue') or 0)
mature = [d for d in rev if d <= '2026-09-30']; fresh = [d for d in rev if d >= '2026-10-05']
sh = lambda ds: sum(crev[d] for d in ds) / sum(rev[d] for d in ds)
print(f'доля отмен по выручке: зрелые 14-30.09 {sh(mature):.1%} | свежие 05-11.10 {sh(fresh):.1%}')
net = sum(rev.values()) - sum(crev.values())
extra = sum(rev[d] for d in fresh) * max(0.0, sh(mature) - sh(fresh))
per = lambda x: x / 28 * 31 * 0 + x / 28 * (365.25 / 12 / 7 * 7)
base_now = net / 28 * 30.44 / 1e6; base_after = (net - extra) / 28 * 30.44 / 1e6
print(f'база без отмен сейчас {net / 1e6:.2f} млн за 28 дн -> {base_now:.2f} в месяц, к 20,4: {base_now / 20.4 - 1:+.1%}')
print(f'если свежие дни базы доберут отмены до зрелой доли: -{extra / 1e6:.2f} млн -> {base_after:.2f} в месяц, к 20,4: {base_after / 20.4 - 1:+.1%}')
