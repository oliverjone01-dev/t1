# Правка ссылок на строки в JSON-отчёте ФЕНИКСА (только номера строк, оценки не меняются).
# python3 -I c14_fixrefs.py
P = '/home/user/t1/knowledge/episodes/2026-10/feniks-audit-ozon-chat-2x-20261015.json'
s = open(P, encoding='utf-8').read()
rep = [
    ('(build-tests.ts:3410)', '(build-tests.ts:3411)'),
    ('build-tests.ts:3408-3414', 'build-tests.ts:3406-3416'),
    ('funnel-tests.ts:133-137 (art агрегата обнуляется), :199', 'funnel-tests.ts:133-135 (art агрегата обнуляется), :199 (ключ)'),
]
for a, b in rep:
    assert s.count(a) == 1, a
    s = s.replace(a, b)
open(P, 'w', encoding='utf-8').write(s)
print('ok')
