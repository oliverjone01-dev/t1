# ФЕНИКС: пересекаются ли товары с новой рекламой 08.10 с группами теста 2 (замер 13.10)
import json
TJ = json.load(open('/home/user/t1/analytics-mvp/tools/tests/tests.json'))
t2 = TJ['тесты'][1]
print('test2 keys', list(t2.keys()))
print('name', t2.get('название') or t2.get('name') or t2.get('id'))
for k in ('тест', 'контроль'):
    print(k, len(t2.get(k, [])), t2.get(k, [])[:40])
for k, v in (t2.get('роли') or {}).items():
    print('роль', k, len(v), v)
NEW18 = ['GGT-03-1-3-E-16080','GGT-03-1-5-E-16080','GGT-03-1-5-O-20090','GGT-03-2-1-E-16080','GGT-03-2-1-O-20090','GGT-03-2-2-E-16080','GGT-03-2-2-O-20090','GGT-03-2-4-E-16080','GGT-03-2-4-O-20090','GGT-03-3-1-E-16080','GGT-03-3-1-O-20090','GGT-03-3-3-E-16080','GGT-03-3-3-O-18090','GGT-03-3-5-E-16080','GGT-03-3-5-O-20090','GGT-03-5-1-O-20090','GGT-47-3-5-90','GGT-48-5-1-100-180']
roles = t2.get('роли') or {}
print('NEW18 ∩ roles:', {k: sorted(set(v) & set(NEW18)) for k, v in roles.items()})
print('NEW18 ∩ контроль:', sorted(set(t2.get('контроль', [])) & set(NEW18)))
print('NEW18 ∩ тест:', sorted(set(t2.get('тест', [])) & set(NEW18)))
