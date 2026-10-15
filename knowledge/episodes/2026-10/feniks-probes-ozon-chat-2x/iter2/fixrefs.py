# Правка номеров строк в JSON-отчёте iter2 (оценки не меняются). python3 -I fixrefs.py
P = '/home/user/t1/knowledge/episodes/2026-10/feniks-audit-ozon-chat-2x-iter2-20261015.json'
s = open(P, encoding='utf-8').read()
for a, b in (('plan-tab.ts:71-89', 'plan-tab.ts:73-89'), ('funnel-tests.ts:123-131, :214', 'funnel-tests.ts:125-131, :214, :227')):
    assert s.count(a) == 1, a
    s = s.replace(a, b)
open(P, 'w', encoding='utf-8').write(s)
print('ok')
