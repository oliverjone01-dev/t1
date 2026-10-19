import json
D = '/home/user/t1/analytics-mvp/data/'
g = json.load(open(D + 'card_groups.json'))
print(type(g).__name__)
if isinstance(g, dict):
    print('keys', list(g.keys())[:15])
    for k in list(g.keys())[:3]:
        v = g[k]
        print(k, type(v).__name__, json.dumps(v, ensure_ascii=False)[:400])
else:
    for v in g[:3]:
        print(json.dumps(v, ensure_ascii=False)[:400])
s = json.dumps(g, ensure_ascii=False)
for a in ['GGT-35-5-1-100-180', 'GGT-03-3-3-E-16080', 'GGM-18-2-2']:
    i = s.find(a)
    print('==', a, i)
    if i >= 0:
        print(s[max(0, i - 400):i + 300])
