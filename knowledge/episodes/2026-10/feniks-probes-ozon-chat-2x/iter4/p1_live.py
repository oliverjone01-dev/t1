# ФЕНИКС iter4. P1 (остаток iter3, вне этого PR): строки funnel_tests за 14.10 и 15.10 - есть ли full / ts (data/ коммита).
# python3 -I p1_live.py
import json, collections
DD = '/tmp/claude-0/-home-user-t1/67620a7f-7583-5c98-9212-3a5e79611236/scratchpad/data_753bf11/analytics-mvp/data/'
rows = [json.loads(l) for l in open(DD + 'funnel_tests.ndjson', encoding='utf-8') if l.strip()]
c = collections.Counter((r.get('date'), 'full' in r, 'ts' in r) for r in rows if r.get('date', '') >= '2026-10-13')
for k in sorted(c):
    print(k, c[k])
print('последняя дата', max(r.get('date', '') for r in rows), '| строк с ts всего', sum(1 for r in rows if 'ts' in r))
